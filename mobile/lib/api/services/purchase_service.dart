import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../supabase_service.dart';
import '../../config/app_config.dart';

class PurchaseService {
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

  List<String> _normalizeDepotNames(List<String> depots) {
    return depots.map((d) => d.trim()).where((d) => d.isNotEmpty).toSet().toList();
  }

  void _assertDepotsAccess(List<String> allowed, List<String> requested) {
    final normAllowed = _normalizeDepotNames(allowed);
    final normRequested = _normalizeDepotNames(requested);
    for (final r in normRequested) {
      if (!normAllowed.contains(r)) {
        throw Exception("Accès refusé au dépôt: $r");
      }
    }
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

  /// Get suppliers with multi-tenancy filter
  Future<List<dynamic>> getSuppliers(String token, {bool forceRefresh = false}) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      var q = _supabaseService.client!.from('fournisseurs').select().or('is_deleted.eq.false,is_deleted.is.null');
      if (orgId != null && orgId.isNotEmpty) {
        q = q.eq('organization_id', orgId);
      }
      return await q.order('nom');
    }
    return [];
  }

  /// Add supplier with multi-tenancy support
  Future<void> addSupplier(Map<String, dynamic> data, String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final body = Map<String, dynamic>.from(data);
      if (orgId != null && orgId.isNotEmpty && !body.containsKey('organization_id')) {
        body['organization_id'] = orgId;
      }
      await _supabaseService.syncSupplierDirect(body);
    }
  }

  /// Get purchases with API -> Supabase Fallback
  Future<List<dynamic>> getPurchases(String token, {bool forceRefresh = false}) async {
    // 1. Try Next.js API first
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken(token);

      final uri = Uri.parse('$_baseUrl/api/purchases');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data is List) {
          debugPrint('PurchaseService: Fetched ${data.length} purchases from Next.js API');
          return data;
        }
      } else {
        debugPrint('PurchaseService: Purchases API returned status ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('PurchaseService: Purchases API failed ($e), falling back to Supabase');
    }

    // 2. Fallback to Supabase
    if (await _ensureSupabaseReady()) {
      try {
        final client = _supabaseService.client!;
        final authCtx = await _getAuthContext();
        final bool isAdmin = authCtx['isAdmin'] ?? false;
        final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>? ?? []);
        final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

        var q = client.from('achats').select();
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        if (!isAdmin && allowedDepots.isNotEmpty) {
          q = q.inFilter('depot_nom', allowedDepots);
        }
        final headers = await q.order('date_achat', ascending: false);
        debugPrint('PurchaseService: Fetched ${headers.length} purchase headers from Supabase');
        return headers;
      } catch (e) {
        debugPrint('PurchaseService Global Error (getPurchases): $e');
        return [];
      }
    }
    return [];
  }

  /// Generate next purchase reference number
  Future<String> getNextPurchaseRef() async {
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken('');

      final uri = Uri.parse('$_baseUrl/api/purchases/next-ref');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (effectiveToken.isNotEmpty) 'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
      ).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['nextRef'] != null) {
          return data['nextRef'].toString();
        }
      }
    } catch (_) {}

    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
        var q = _supabaseService.client!.from('achats').select('id');
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        final res = await q;
        final count = (res as List).length;
        final dateStr = DateFormat('ddMMyy').format(DateTime.now());
        return "ACH-$dateStr-${(count + 1).toString().padLeft(4, '0')}";
      } catch (e) {
        debugPrint('PurchaseService Error (getNextPurchaseRef): $e');
        final dateStr = DateFormat('ddMMyy').format(DateTime.now());
        return "ACH-$dateStr-0001";
      }
    }
    final dateStr = DateFormat('ddMMyy').format(DateTime.now());
    return "ACH-$dateStr-0001";
  }

  /// Get purchase with detailed line items and payments
  Future<Map<String, dynamic>?> getPurchaseWithItems(String id) async {
    // 1. Try Next.js API first
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken('');

      final uri = Uri.parse('$_baseUrl/api/purchases/$id');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (effectiveToken.isNotEmpty) 'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data is Map<String, dynamic>) {
          return data;
        }
      }
    } catch (e) {
      debugPrint('PurchaseService: API getPurchaseWithItems failed ($e), falling back to Supabase');
    }

    // 2. Fallback to Supabase
    if (await _ensureSupabaseReady()) {
      try {
        final client = _supabaseService.client!;
        final purchase = await client.from('achats').select().eq('id', id).maybeSingle();
        if (purchase == null) return null;

        final authCtx = await _getAuthContext();
        final bool isAdmin = authCtx['isAdmin'] ?? false;
        final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>? ?? []);
        if (!isAdmin && allowedDepots.isNotEmpty) {
          final depotName = purchase['depot_nom']?.toString().trim() ?? '';
          if (depotName.isNotEmpty) {
            _assertDepotsAccess(allowedDepots, [depotName]);
          }
        }
        final result = Map<String, dynamic>.from(purchase);

        try {
          final items = await client.from('achat_items').select().eq('achat_id', id);
          result['items'] = items;
          result['achat_items'] = items;
        } catch (_) {
          result['items'] = [];
        }

        try {
          final payments = await client.from('paiements').select().eq('achat_id', id).order('date_operation', ascending: true);
          result['payments'] = payments;
          result['paiements'] = payments;
        } catch (_) {
          result['payments'] = [];
        }

        return result;
      } catch (e) {
        debugPrint('PurchaseService Exception in getPurchaseWithItems: $e');
        return null;
      }
    }
    return null;
  }

  /// Create purchase invoice
  Future<bool> createPurchase(Map<String, dynamic> data, String token) async {
    // 1. Try Next.js API first
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken(token);

      final body = Map<String, dynamic>.from(data);
      if (orgId != null && orgId.isNotEmpty && !body.containsKey('organization_id')) {
        body['organization_id'] = orgId;
      }

      final uri = Uri.parse('$_baseUrl/api/purchases');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
        body: json.encode(body),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200 || response.statusCode == 201) {
        debugPrint('✅ PurchaseService: Purchase created via Next.js API');
        return true;
      }
    } catch (e) {
      debugPrint('PurchaseService: createPurchase API failed ($e), falling back to Supabase');
    }

    // 2. Direct Supabase Fallback
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final isAdmin = authCtx['isAdmin'] as bool? ?? false;
      final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>? ?? []);
      if (!isAdmin && allowedDepots.isNotEmpty) {
        final depotName = (data['depot_nom'] ?? 'Boutique').toString();
        if (depotName.isNotEmpty) {
          _assertDepotsAccess(allowedDepots, [depotName]);
        }
      }
      return await _supabaseService.createPurchaseDirect(data);
    }
    return false;
  }

  /// Delete purchase invoice
  Future<bool> deletePurchase(String purchaseId, String token) async {
    final authCtx = await _getAuthContext();
    final isAdmin = authCtx['isAdmin'] as bool;
    if (!isAdmin) {
      final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      if (await _ensureSupabaseReady()) {
        final purchase = await _supabaseService.client!
            .from('achats')
            .select('depot_nom')
            .eq('id', purchaseId)
            .maybeSingle();
        final depotName = purchase?['depot_nom']?.toString() ?? '';
        _assertDepotsAccess(allowedDepots, [depotName]);
      }
    }

    try {
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken(token);

      final uri = Uri.parse('$_baseUrl/api/purchases/$purchaseId');
      final response = await http.delete(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200 || response.statusCode == 204) {
        debugPrint('✅ PurchaseService: Purchase deleted via Next.js API');
        return true;
      }
    } catch (e) {
      debugPrint('PurchaseService: deletePurchase API failed ($e), falling back to Supabase');
    }

    if (await _ensureSupabaseReady()) {
      return await _supabaseService.deletePurchaseDirect(purchaseId);
    }
    return false;
  }

  /// Pay purchase invoice
  Future<bool> payPurchase(String purchaseId, double amount, String method, String token, {String? reference, String? date}) async {
    final authCtx = await _getAuthContext();
    final isAdmin = authCtx['isAdmin'] as bool;
    if (!isAdmin) {
      final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      if (await _ensureSupabaseReady()) {
        final purchase = await _supabaseService.client!
            .from('achats')
            .select('depot_nom')
            .eq('id', purchaseId)
            .maybeSingle();
        final depotName = purchase?['depot_nom']?.toString() ?? '';
        _assertDepotsAccess(allowedDepots, [depotName]);
      }
    }

    try {
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken(token);

      final uri = Uri.parse('$_baseUrl/api/purchases/$purchaseId/payments');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
        body: json.encode({
          'amount': amount,
          'method': method,
          'reference': reference ?? 'REC-MOB-${DateTime.now().millisecondsSinceEpoch}',
          if (date != null) 'date': date,
        }),
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200 || response.statusCode == 201) {
        debugPrint('✅ PurchaseService: Purchase payment recorded via Next.js API');
        return true;
      }
    } catch (e) {
      debugPrint('PurchaseService: payPurchase API failed ($e), falling back to Supabase');
    }

    if (await _ensureSupabaseReady()) {
      return await _supabaseService.payPurchaseDirect(
        purchaseId,
        amount,
        method,
        reference: reference,
        date: date,
        utilisateur: authCtx['username']?.toString(),
      );
    }
    return false;
  }

  /// Update purchase invoice
  Future<bool> updatePurchase(String purchaseId, Map<String, dynamic> data, String token) async {
    final authCtx = await _getAuthContext();
    final isAdmin = authCtx['isAdmin'] as bool;
    if (!isAdmin) {
      final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      String depotName = data['depot_nom']?.toString() ?? '';
      if (depotName.isEmpty && await _ensureSupabaseReady()) {
        final purchase = await _supabaseService.client!
            .from('achats')
            .select('depot_nom')
            .eq('id', purchaseId)
            .maybeSingle();
        depotName = purchase?['depot_nom']?.toString() ?? '';
      }
      _assertDepotsAccess(allowedDepots, [depotName]);
    }

    try {
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final effectiveToken = await _getEffectiveToken(token);

      final uri = Uri.parse('$_baseUrl/api/purchases/$purchaseId');
      final response = await http.put(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
        body: json.encode(data),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        debugPrint('✅ PurchaseService: Purchase updated via Next.js API');
        return true;
      }
    } catch (e) {
      debugPrint('PurchaseService: updatePurchase API failed ($e), falling back to Supabase');
    }

    if (await _ensureSupabaseReady()) {
      return await _supabaseService.updatePurchaseDirect(purchaseId, data);
    }
    return false;
  }
}
