import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:api_flutter/api_flutter.dart';
import '../supabase_service.dart';
import '../../config/app_config.dart';
import '../../services/offline_queue_service.dart';

class SalesService {
  final SupabaseService _supabaseService = SupabaseService();
  late final GestionProApiClient _nextApiClient;
  String get _baseUrl => AppConfig.apiUrl;

  SalesService() {
    _nextApiClient = GestionProApiClient(
      baseUrl: AppConfig.apiUrl,
      getToken: () async {
        try {
          const storage = FlutterSecureStorage();
          String? token = await storage.read(key: 'auth_token');
          if (token == null || token.isEmpty) {
            final prefs = await SharedPreferences.getInstance();
            token = prefs.getString('auth_token');
          }
          return token;
        } catch (_) {
          return null;
        }
      },
    );
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

  List<String> _normalizeDepotNames(List<String> depots) {
    return depots.map((d) => d.trim()).where((d) => d.isNotEmpty).toSet().toList();
  }

  /// Create Invoice / POS Checkout with multi-level fallback:
  /// 1. Next.js Atomic POS Checkout API
  /// 2. Next.js /api/factures standard route
  /// 3. Supabase Direct sync
  /// 4. SQLite Offline Queue (Outbox Pattern)
  Future<String?> createInvoice(
    Map<String, dynamic> data,
    String token, {
    double? paymentAmount,
    String? paymentMethod,
    String? advanceClientId,
  }) async {
    try {
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      String? orgId = await storage.read(key: 'auth_organization_id');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
        orgId ??= prefs.getString('auth_organizationId');
      }
      final effectiveToken = secureToken ?? token;

      // 1. Try Next.js Atomic POS Checkout API first (guarantees ACID stock deduction)
      final List rawItems = data['items'] ?? [];
      if (rawItems.isNotEmpty) {
        try {
          final List<Map<String, dynamic>> checkoutItems = rawItems.map((item) {
            return {
              'id': item['article_id'],
              'quantite': item['qte'],
              'prix': item['pu_ttc'],
              'depot_origine': item['depot_origine'] ?? data['emplacement'],
            };
          }).toList();

          final checkoutPayload = {
            'clientId': data['client_id'] ?? 1,
            'depotName': data['emplacement'] ?? '',
            'moyenReglement': paymentMethod ?? 'Espece',
            'versement': paymentAmount ?? 0,
            'items': checkoutItems,
          };

          final checkoutRes = await _nextApiClient.checkout(checkoutPayload);
          if (checkoutRes['ok'] == true) {
            final String? id = checkoutRes['invoice_id']?.toString() ??
                checkoutRes['sale']?['id']?.toString() ??
                checkoutRes['invoice']?['id']?.toString();
            return id;
          }
        } catch (checkoutErr) {
          debugPrint('[SalesService] Atomic Checkout failed ($checkoutErr), trying standard API...');
        }
      }

      // 2. Standard Next.js /api/factures route
      final body = Map<String, dynamic>.from(data);
      if (orgId != null && orgId.isNotEmpty && !body.containsKey('organization_id')) {
        body['organization_id'] = orgId;
      }

      final uri = Uri.parse('$_baseUrl/api/factures');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
        body: json.encode(body),
      ).timeout(const Duration(seconds: 12));

      if (response.statusCode == 200 || response.statusCode == 201) {
        final resData = json.decode(response.body);
        return resData['id']?.toString();
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('[SalesService] Network error in createInvoice: $e');

      // 3. Fallback to Supabase Direct
      final client = _supabaseService.client;
      if (client != null) {
        try {
          final authCtx = await _getAuthContext();
          final isAdmin = authCtx['isAdmin'] as bool;
          final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
          final id = await _supabaseService.syncInvoiceDirect(data, allowedDepots: allowedDepots, isAdmin: isAdmin);
          if (id != null) return id;
        } catch (supaErr) {
          debugPrint('[SalesService] Supabase direct fallback failed: $supaErr');
        }
      }

      // 4. True Offline Queue Fallback (Guaranteed sale preservation)
      try {
        final authCtx = await _getAuthContext();
        final orgId = authCtx['organizationId']?.toString() ?? '00000000-0000-0000-0000-000000000001';
        final localId = await OfflineQueueService().enqueueInvoice(
          data: data,
          organizationId: orgId,
          paymentAmount: paymentAmount,
          paymentMethod: paymentMethod,
          advanceClientId: advanceClientId,
        );
        debugPrint('📦 [SalesService] Sale saved in Offline Queue: $localId');
        return localId;
      } catch (queueErr) {
        debugPrint('❌ [SalesService] Offline queue error: $queueErr');
        return null;
      }
    }
  }
}
