import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../config/app_config.dart';
import '../supabase_service.dart';

class ExpensesService {
  static final ExpensesService _instance = ExpensesService._internal();
  factory ExpensesService() => _instance;
  ExpensesService._internal();

  final SupabaseService _supabase = SupabaseService();
  String get _baseUrl => AppConfig.apiUrl;

  Future<String?> _getToken() async {
    const storage = FlutterSecureStorage();
    String? token = await storage.read(key: 'auth_token');
    if (token == null || token.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      token = prefs.getString('auth_token');
    }
    return token;
  }

  Future<Map<String, dynamic>> _getAuthContext() async {
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('auth_role') ?? 'vendeur';
    final isAdmin = (role.toLowerCase() == 'admin' || role.toLowerCase() == 'administrateur');
    final userId = prefs.getString('auth_userId');
    final username = prefs.getString('auth_username');
    final depots = prefs.getStringList('auth_depots') ?? [];
    final orgId = prefs.getString('auth_organizationId') ?? await _supabase.getOrganizationId();
    return {
      'isAdmin': isAdmin,
      'userId': userId,
      'username': username,
      'allowedDepots': depots,
      'organizationId': orgId,
    };
  }

  /// Get expenses list filtered by date range and multi-tenancy
  Future<List<dynamic>> getExpenses({
    String? startDate,
    String? endDate,
    bool forceRefresh = false,
  }) async {
    final token = await _getToken();
    final authCtx = await _getAuthContext();
    final orgId = authCtx['organizationId'] as String?;

    // 1. Next.js API
    try {
      final Map<String, String> params = {};
      if (startDate != null) params['start'] = startDate;
      if (endDate != null) params['end'] = endDate;

      final queryString = params.isNotEmpty ? '?' + params.entries.map((e) => '${e.key}=${e.value}').join('&') : '';
      final uri = Uri.parse('$_baseUrl/api/expenses$queryString');

      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      }
    } catch (e) {
      debugPrint('ExpensesService: Next.js API getExpenses failed: $e');
    }

    // 2. Supabase Fallback
    try {
      final client = _supabase.client;
      if (client != null) {
        final bool isAdmin = authCtx['isAdmin'] ?? false;
        final List<String> allowedDepots = (authCtx['allowedDepots'] as List<String>?) ?? [];

        var query = client.from('depenses').select();
        if (orgId != null && orgId.isNotEmpty) {
          query = query.eq('organization_id', orgId);
        }

        if (!isAdmin) {
          if (allowedDepots.isNotEmpty) {
            query = query.inFilter('emplacement', allowedDepots);
          } else {
            return [];
          }
        }

        if (startDate != null) query = query.gte('date_depense', startDate);
        if (endDate != null) query = query.lte('date_depense', endDate);
        return await query.order('date_depense', ascending: false);
      }
    } catch (e) {
      debugPrint('ExpensesService: Supabase getExpenses failed: $e');
    }

    return [];
  }

  /// Add a new expense
  Future<void> addExpense(Map<String, dynamic> data) async {
    final token = await _getToken();
    final authCtx = await _getAuthContext();
    final orgId = authCtx['organizationId'] as String?;

    final payload = Map<String, dynamic>.from(data);
    if (orgId != null && orgId.isNotEmpty && !payload.containsKey('organization_id')) {
      payload['organization_id'] = orgId;
    }

    // 1. Next.js API
    try {
      final uri = Uri.parse('$_baseUrl/api/expenses');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
        body: json.encode(payload),
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200 || response.statusCode == 201) {
        return;
      }
    } catch (e) {
      debugPrint('ExpensesService: Next.js API addExpense failed: $e');
    }

    // 2. Supabase Fallback
    try {
      final client = _supabase.client;
      if (client != null) {
        await client.from('depenses').insert(payload);

        await _supabase.logActivity(
          actionType: 'CREATE',
          entityType: 'depense',
          details: 'Dépense: ${payload['libelle']} - Montant: ${payload['montant']}',
          username: authCtx['username'] ?? 'MobileApp',
        );
      }
    } catch (e) {
      debugPrint('ExpensesService: Supabase addExpense failed: $e');
      rethrow;
    }
  }

  /// Cash report for a single date
  Future<Map<String, dynamic>> getCashReport({String? date, String? vendeur}) async {
    final token = await _getToken();
    final targetDate = date ?? DateFormat('yyyy-MM-dd').format(DateTime.now());
    final authCtx = await _getAuthContext();
    final orgId = authCtx['organizationId'] as String?;

    try {
      final uri = Uri.parse('$_baseUrl/api/reports/cash-balance?start=$targetDate&end=$targetDate${vendeur != null ? '&cashier=$vendeur' : ''}');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final summary = data['summary'] ?? {};
        final List entries = data['entries'] ?? [];

        final List<Map<String, dynamic>> recettesList = [];
        final List<Map<String, dynamic>> depensesList = [];

        for (var e in entries) {
          final entree = (e['entree'] as num?)?.toDouble() ?? 0.0;
          final sortie = (e['sortie'] as num?)?.toDouble() ?? 0.0;

          if (entree > 0) {
            recettesList.add({
              'client': e['ref'] ?? 'Client',
              'type': e['type'] ?? 'Paiement',
              'montant': entree,
              'info': e['moyen'] ?? '',
              'user': e['user'] ?? '',
              'date': e['date'] ?? '',
            });
          }
          if (sortie > 0) {
            depensesList.add({
              'libelle': '${e['type']}: ${e['ref']}',
              'operateur': e['user'] ?? '-',
              'montant': sortie,
              'date': e['date'] ?? '',
            });
          }
        }

        return {
          'total_recettes': (summary['totalIncome'] as num?)?.toDouble() ?? 0.0,
          'total_depenses': (summary['totalExpenses'] as num?)?.toDouble() ?? 0.0,
          'solde': (summary['netBalance'] as num?)?.toDouble() ?? 0.0,
          'recettes_list': recettesList,
          'depenses_list': depensesList,
        };
      }
    } catch (e) {
      debugPrint('ExpensesService: getCashReport error: $e');
    }

    return {
      'total_recettes': 0.0,
      'total_depenses': 0.0,
      'solde': 0.0,
      'recettes_list': [],
      'depenses_list': [],
    };
  }

  /// Delete an expense by id
  Future<void> deleteExpense(String id, String token) async {
    final client = _supabase.client;
    if (client != null) {
      await client.from('depenses').delete().eq('id', id);
    }
  }
}

