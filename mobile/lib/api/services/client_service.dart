import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../supabase_service.dart';
import '../../config/app_config.dart';
import '../../services/offline_queue_service.dart';

class ClientService {
  final SupabaseService _supabaseService = SupabaseService();
  String get _baseUrl => AppConfig.apiUrl;

  Future<bool> _ensureSupabaseReady() async {
    if (!_supabaseService.isInitialized) await _supabaseService.init();
    return _supabaseService.isInitialized && _supabaseService.client != null;
  }

  Future<Map<String, dynamic>> _getAuthContext() async {
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('auth_role') ?? 'vendeur';
    final isAdmin = (role.toLowerCase() == 'admin' || role.toLowerCase() == 'administrateur');
    final userId = prefs.getString('auth_userId');
    final username = prefs.getString('auth_username');
    final depots = prefs.getStringList('auth_depots') ?? [];
    final orgId = prefs.getString('auth_organizationId') ?? await _supabaseService.getOrganizationId();
    return {
      'isAdmin': isAdmin,
      'userId': userId,
      'username': username,
      'allowedDepots': depots,
      'organizationId': orgId,
    };
  }

  Future<String> _getEffectiveToken(String token) async {
    if (token.isNotEmpty) return token;
    const storage = FlutterSecureStorage();
    String? secureToken = await storage.read(key: 'auth_token');
    if (secureToken == null || secureToken.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      secureToken = prefs.getString('auth_token');
    }
    return secureToken ?? '';
  }

  /// Fetch clients with Next.js API -> Supabase Fallback -> Local SQLite Cache
  Future<List<dynamic>> getClients(String token, {bool forceRefresh = false}) async {
    try {
      debugPrint('ClientService: START getClients');
      final effectiveToken = await _getEffectiveToken(token);
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId'] as String?;

      final uri = Uri.parse('$_baseUrl/api/clients');
      final headers = <String, String>{
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $effectiveToken',
      };
      if (orgId != null && orgId.isNotEmpty) {
        headers['x-organization-id'] = orgId;
      }

      final response = await http.get(
        uri,
        headers: headers,
      ).timeout(const Duration(seconds: 5));

      debugPrint('ClientService: getClients response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final clients = json.decode(response.body) as List<dynamic>;
        if (clients.isNotEmpty) {
          OfflineQueueService().cacheClients(clients);
        }
        return clients;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ClientService: ERROR in getClients: $e — falling back to Supabase');
      if (await _ensureSupabaseReady()) {
        try {
          final authCtx = await _getAuthContext();
          final orgId = authCtx['organizationId'] as String?;
          var q = _supabaseService.client!
              .from('clients')
              .select()
              .or('is_deleted.eq.false,is_deleted.is.null');
          if (orgId != null && orgId.isNotEmpty) {
            q = q.eq('organization_id', orgId);
          }
          final data = await q.order('nom');
          debugPrint('ClientService: Supabase Fallback SUCCESS, found ${data.length} items');
          if (data.isNotEmpty) {
            OfflineQueueService().cacheClients(data);
          }
          return data;
        } catch (sbErr) {
          debugPrint('ClientService: Supabase Fallback ERROR: $sbErr');
        }
      }

      // Offline SQLite cache fallback
      final cachedClients = await OfflineQueueService().getCachedClients();
      if (cachedClients.isNotEmpty) {
        debugPrint('📦 ClientService: Loaded ${cachedClients.length} clients from local SQLite cache');
        return cachedClients;
      }
      return [];
    }
  }

  /// Create client with multi-tenancy support
  Future<bool> createClientFull(Map<String, dynamic> data, String token) async {
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken(token);

      final body = Map<String, dynamic>.from(data);
      if (orgId != null && orgId.isNotEmpty && !body.containsKey('organization_id')) {
        body['organization_id'] = orgId;
      }

      final uri = Uri.parse('$_baseUrl/api/clients');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
        body: json.encode(body),
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200 || response.statusCode == 201) {
        debugPrint('✅ ClientService: Client created successfully via API');
        return true;
      }
      debugPrint('⚠️ ClientService: /api/clients returned ${response.statusCode}, falling back to Supabase direct');
    } catch (e) {
      debugPrint('⚠️ ClientService: createClientFull API error: $e, falling back to Supabase direct');
    }

    if (await _ensureSupabaseReady()) {
      return await _supabaseService.syncClientDirect(data);
    }
    return false;
  }

  /// Update client information
  Future<bool> updateClient(String id, Map<String, dynamic> data, String token) async {
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken(token);

      final body = Map<String, dynamic>.from(data);
      if (orgId != null && orgId.isNotEmpty && !body.containsKey('organization_id')) {
        body['organization_id'] = orgId;
      }

      final uri = Uri.parse('$_baseUrl/api/clients/$id');
      final response = await http.put(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
        body: json.encode(body),
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        debugPrint('✅ ClientService: Client updated via API');
        return true;
      }
    } catch (e) {
      debugPrint('⚠️ ClientService: updateClient API error: $e, falling back to Supabase direct');
    }

    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
        var q = _supabaseService.client!.from('clients').update(data).eq('id', id);
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        await q;
        return true;
      } catch (sbErr) {
        debugPrint('ClientService: Supabase updateClient error: $sbErr');
      }
    }
    return false;
  }

  /// Delete / Soft-delete client
  Future<bool> deleteClient(String id, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
        var q = _supabaseService.client!
            .from('clients')
            .update({'is_deleted': true})
            .eq('id', id);
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        await q;
        return true;
      } catch (e) {
        debugPrint('ClientService: deleteClient error: $e');
      }
    }
    return false;
  }

  /// Bulk client payment with strict organization_id multi-tenancy
  Future<void> payClientBulk(String clientId, double amount, String method, String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final username = authCtx['username']?.toString() ?? 'MobileApp';

      await _supabaseService.client!.from('paiements').insert({
        'id': const Uuid().v4(),
        'client_id': clientId,
        'montant_regle': amount,
        'moyen_reglement': method,
        'date_operation': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'utilisateur': username,
        if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
      });
    }
  }

  /// Get invoices for a specific client
  Future<List<Map<String, dynamic>>> getClientInvoices(String clientId, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

        var q = _supabaseService.client!
            .from('factures')
            .select()
            .eq('client_id', clientId)
            .eq('is_deleted', false);
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        final data = await q.order('date_facture', ascending: false);
        return List<Map<String, dynamic>>.from(data);
      } catch (e) {
        debugPrint('ClientService: getClientInvoices error: $e');
        return [];
      }
    }
    return [];
  }

  /// Get payments for a specific client
  Future<List<Map<String, dynamic>>> getClientPayments(String clientId, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

        var q = _supabaseService.client!
            .from('paiements')
            .select('*, factures(bl_number)')
            .eq('client_id', clientId);
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        final payments = await q.order('date_operation', ascending: false);
        return (payments as List).map((p) {
          final m = Map<String, dynamic>.from(p);
          m['amount'] = (m['montant_regle'] as num?)?.toDouble() ?? 0.0;
          m['date'] = m['date_operation'] ?? '';
          m['method'] = m['mode_paiement'] ?? m['moyen_reglement'] ?? '';
          m['bl_number'] = m['factures']?['bl_number'] ?? '';
          m['type'] = 'Paiement';
          return m;
        }).toList();
      } catch (e) {
        debugPrint('ClientService: getClientPayments error: $e');
        return [];
      }
    }
    return [];
  }
}
