import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:api_flutter/api_flutter.dart';
import 'supabase_service.dart';
import '../config/app_config.dart';

class ApiService {
  final SupabaseService _supabaseService = SupabaseService();
  late final GestionProApiClient _nextApiClient;

  String get _baseUrl => AppConfig.apiUrl;

  ApiService() {
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
        } catch (e) {
          debugPrint('ApiService: getToken error: $e');
          return null;
        }
      },
      getOrganizationId: () async {
        try {
          const storage = FlutterSecureStorage();
          String? orgId = await storage.read(key: 'auth_organization_id');
          if (orgId == null || orgId.isEmpty) {
            final prefs = await SharedPreferences.getInstance();
            orgId = prefs.getString('auth_organizationId');
          }
          return orgId;
        } catch (e) {
          debugPrint('ApiService: getOrganizationId error: $e');
          return null;
        }
      },
    );
  }



  Future<bool> _ensureSupabaseReady() async {
    if (!_supabaseService.isInitialized) await _supabaseService.init();
    return _supabaseService.isInitialized && _supabaseService.client != null;
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

  List<String> _normalizeDepotNames(List<String> depots) {
    return depots.map((d) => d.trim()).where((d) => d.isNotEmpty).toSet().toList();
  }

  List<String> _parseDepotString(String? depots) {
    if (depots == null || depots.trim().isEmpty) return [];
    return depots.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toSet().toList();
  }

  Future<List<String>> _fetchAllActiveDepots() async {
    final client = _supabaseService.client!;
    try {
      final orgId = await _supabaseService.getOrganizationId();
      var q = client.from('depots').select('nom, is_active, is_deleted');
      if (orgId != null && orgId.isNotEmpty) {
        q = q.eq('organization_id', orgId);
      }
      final res = await q;
      final names = <String>[];
      for (final d in (res as List)) {
        final name = d['nom']?.toString().trim();
        final isActive = d['is_active'];
        final isDeleted = d['is_deleted'];
        if (name != null && name.isNotEmpty) {
          if (isDeleted == true) continue;
          if (isActive == false) continue;
          names.add(name);
        }
      }
      return names.toSet().toList();
    } catch (_) {
      try {
        final orgId = await _supabaseService.getOrganizationId();
        var q = client.from('depots').select('nom');
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        final res = await q;
        return (res as List).map((e) => e['nom'].toString()).toSet().toList();
      } catch (_) {
        return [];
      }
    }
  }

  Future<List<String>> refreshUserDepots({bool force = false}) async {
    if (!await _ensureSupabaseReady()) return [];
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('auth_role') ?? 'vendeur';
    bool isAdmin = (role.toLowerCase() == 'admin' || role.toLowerCase() == 'administrateur');
    final cached = prefs.getStringList('auth_depots') ?? [];
    final last = prefs.getInt('auth_depots_ts') ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    final userId = prefs.getString('auth_userId');

    // [SECURITY] Verify admin flag from DB to avoid false admin from role_id or stale cache.
    if (userId != null && userId.isNotEmpty) {
      try {
        final row = await _supabaseService.client!
            .from('users')
            .select('admin')
            .eq('id', userId)
            .maybeSingle();
        final adminVal = row?['admin']?.toString().toLowerCase();
        final dbIsAdmin = (adminVal == 'oui' || adminVal == 'admin' || adminVal == 'administrateur');
        if (dbIsAdmin != isAdmin) {
          isAdmin = dbIsAdmin;
          await prefs.setString('auth_role', isAdmin ? 'admin' : 'vendeur');
        }
      } catch (_) {}
    }

    if (!force && cached.isNotEmpty && (now - last) < 5 * 60 * 1000) {
      return cached;
    }

    List<String> depots = [];
    if (isAdmin) {
      depots = await _fetchAllActiveDepots();
    } else {
      if (userId != null && userId.isNotEmpty) {
        try {
          depots = await _supabaseService.getUserDepots(userId);
        } catch (e) {
          debugPrint('Error getting user depots in refreshUserDepots: $e');
        }
        if (depots.isEmpty) {
          // Fallback to legacy depots text field and emplacement
          try {
            final userRow = await _supabaseService.client!
                .from('users')
                .select('depots, emplacement')
                .eq('id', userId)
                .maybeSingle();
            depots = _parseDepotString(userRow?['depots']?.toString());
            if (depots.isEmpty && userRow?['emplacement'] != null) {
              final emp = userRow!['emplacement'].toString().trim();
              if (emp.isNotEmpty) {
                depots.add(emp);
              }
            }
          } catch (_) {}
        }
      }
    }

    depots = _normalizeDepotNames(depots);
    await prefs.setStringList('auth_depots', depots);
    await prefs.setInt('auth_depots_ts', now);
    return depots;
  }

  void _assertDepotsAccess(List<String> allowedDepots, Iterable<String> depots) {
    // Deny-by-default: vendors must have explicit depot assignments.
    final allowed = _normalizeDepotNames(allowedDepots);
    if (allowed.isEmpty) {
      throw Exception("Accès refusé: aucun dépôt assigné.");
    }
    for (final depot in depots) {
      final name = depot.toString().trim();
      if (name.isEmpty) continue;
      if (!allowed.contains(name)) {
        throw Exception("Accès refusé au dépôt '$name'.");
      }
    }
  }

  String? _effectiveVendeur(Map<String, dynamic> authCtx, String? requested) {
    final isAdmin = authCtx['isAdmin'] as bool;
    if (isAdmin) return requested;
    return (authCtx['username'] as String?) ?? requested;
  }

  Future<void> _requireAdmin() async {
    final authCtx = await _getAuthContext();
    if (!(authCtx['isAdmin'] as bool)) {
      throw Exception("Accès refusé: action réservée aux administrateurs.");
    }
  }

  Future<void> _syncUserDepotsByNames(String userId, List<String> depots) async {
    if (!await _ensureSupabaseReady()) return;
    final client = _supabaseService.client!;
    try {
      await client.from('user_depots').delete().eq('user_id', userId);
      if (depots.isEmpty) return;

      final res = await client.from('depots').select('id, nom').inFilter('nom', depots);
      final inserts = <Map<String, dynamic>>[];
      for (final d in (res as List)) {
        final depotId = d['id']?.toString();
        if (depotId != null && depotId.isNotEmpty) {
          inserts.add({'user_id': userId, 'depot_id': depotId});
        }
      }
      if (inserts.isNotEmpty) {
        await client.from('user_depots').insert(inserts);
      }
    } catch (e) {
      debugPrint('user_depots sync warning: $e');
    }
  }

  Future<Map<String, dynamic>> login(String username, String password) async {
    // 1. Try Unified API (Next.js) first
    try {
      debugPrint('🔑 Attempting login via Unified API (Next.js)...');
      final res = await _nextApiClient.login(username, password);
      debugPrint('✅ Login successful via Unified API');
      return res;
    } catch (e) {
      debugPrint('⚠️ Unified API login failed: $e');
      
      // 2. Fallback to direct Supabase login
      if (!await _ensureSupabaseReady()) {
         // If Next.js failed AND Supabase is not configured, we can't login
         throw Exception("Connexion impossible: Sèrveur Next.js indisponible ($e) et Cloud non configuré.");
      }
      
      try {
        final res = await _supabaseService.loginDirect(username, password);
        if (res != null) return res;
      } catch (err) {
        final errStr = err.toString();
        if (errStr.contains('42501') || errStr.contains('permission denied')) {
          throw Exception("Identifiant ou mot de passe incorrect.");
        }
        rethrow;
      }
    }
    throw Exception("Échec de l'authentification");
  }

  Future<Map<String, dynamic>> _getAuthContext({bool refresh = false}) async {
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('auth_role') ?? 'vendeur';
    final isAdmin = (role.toLowerCase() == 'admin' || role.toLowerCase() == 'administrateur');
    final userId = prefs.getString('auth_userId');
    final username = prefs.getString('auth_username');
    List<String> depots = prefs.getStringList('auth_depots') ?? [];
    if (!isAdmin) {
      final last = prefs.getInt('auth_depots_ts') ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      final isStale = (now - last) > 5 * 60 * 1000;
      if (refresh || depots.isEmpty || isStale) {
        depots = await refreshUserDepots(force: refresh);
      }
    }
    final orgId = prefs.getString('auth_organizationId') ?? await _supabaseService.getOrganizationId();
    return { 'isAdmin': isAdmin, 'userId': userId, 'username': username, 'allowedDepots': depots, 'organizationId': orgId };
  }

  // --- Core Data Fetching ---
  Future<List<dynamic>> getArticles(String token, {bool forceRefresh = false, int? page, int? pageSize, String? search, String? userId, List<String>? allowedDepots, bool isAdmin = false}) async {
    try {
      debugPrint('ApiService: START getArticles directly');
      
      // Get token manually to be 100% sure
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      debugPrint('ApiService: Using token (len: ${effectiveToken.length})');

      final uri = Uri.parse('$_baseUrl/api/articles');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
        },
      ).timeout(const Duration(seconds: 5));

      debugPrint('ApiService: Response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List items = data['items'] ?? [];
        return items;
      } else {
        debugPrint('ApiService: Error Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getArticles: $e');
      // Fallback to old behavior
      if (await _ensureSupabaseReady()) {
        int? from, to;
        if (page != null && pageSize != null) {
          from = page * pageSize;
          to = from + pageSize - 1;
        }
        
        final authCtx = await _getAuthContext(refresh: forceRefresh);
        final effectiveUserId = userId ?? authCtx['userId'];
        final effectiveAdmin = isAdmin || (authCtx['isAdmin'] as bool);
        final authDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
        final effectiveDepots = effectiveAdmin ? _normalizeDepotNames(allowedDepots ?? authDepots) : authDepots;

        return await _supabaseService.getArticlesWithStocks(
          from: from, 
          to: to, 
          search: search,
          userId: effectiveUserId,
          allowedDepots: effectiveDepots,
          isAdmin: effectiveAdmin,
        );
      }
      return [];
    }
  }

  Future<List<dynamic>> getClients(String token, {bool forceRefresh = false}) async {
    try {
      debugPrint('ApiService: START getClients directly');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
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

      debugPrint('ApiService: getClients response: ${response.statusCode}');

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        debugPrint('ApiService: getClients ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getClients: $e — falling back to Supabase');
      if (await _ensureSupabaseReady()) {
        try {
          debugPrint('ApiService: Supabase Fallback getClients');
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
          debugPrint('ApiService: Supabase Fallback getClients SUCCESS, found ${data.length} items');
          return data;
        } catch (sbErr) {
          debugPrint('ApiService: Supabase Fallback getClients CRITICAL ERROR: $sbErr');
          return [];
        }
      }
      return [];
    }
  }

  Future<List<dynamic>> getInvoices(String token, {bool forceRefresh = false, String? vendeur, int? page, int? pageSize, String? search}) async {
    try {
      debugPrint('ApiService: START getInvoices directly');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId'] as String?;

      // Build query parameters
      final Map<String, String> params = {};
      if (vendeur != null) params['vendeur'] = vendeur;
      if (page != null) params['page'] = page.toString();
      if (pageSize != null) params['pageSize'] = pageSize.toString();
      if (search != null && search.isNotEmpty) params['search'] = search;
      
      final queryString = params.isNotEmpty ? '?' + params.entries.map((e) => '${e.key}=${e.value}').join('&') : '';
      final uri = Uri.parse('$_baseUrl/api/invoices$queryString');
      
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
      ).timeout(const Duration(seconds: 8));

      debugPrint('ApiService: getInvoices response: ${response.statusCode}');

      if (response.statusCode == 200) {
        final res = json.decode(response.body);
        if (res is List) return res;
        if (res is Map && res.containsKey('data')) return res['data'] as List<dynamic>;
        return [];
      } else {
        debugPrint('ApiService: getInvoices ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getInvoices: $e — falling back to Supabase');
      // Fallback to Supabase
      if (await _ensureSupabaseReady()) {
        int? from, to;
        if (page != null && pageSize != null) {
          from = (page - 1) * pageSize;
          to = from + pageSize - 1;
        }
        final authCtx = await _getAuthContext();
        final bool isAdmin = authCtx['isAdmin'];
        final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
        final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);
        return await _supabaseService.getInvoicesWithClients(vendeur: effectiveVendeur, from: from, to: to, search: search, isAdmin: isAdmin, allowedDepots: allowedDepots);
      }
      return [];
    }
  }

  Future<List<dynamic>> getDepotsDetailed(String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final bool isAdmin = authCtx['isAdmin'];
      final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      
      var q = _supabaseService.client!.from('depots').select();
      if (orgId != null && orgId.isNotEmpty) {
        q = q.eq('organization_id', orgId);
      }
      
      if (isAdmin) {
        return await q.order('nom');
      } else if (allowedDepots.isNotEmpty) {
        return await q.inFilter('nom', allowedDepots).order('nom');
      } else {
        return []; // Deny-by-default: if vendor has no assigned depots, return empty
      }
    }
    return [];
  }

  Future<List<String>> getDepots(String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final bool isAdmin = authCtx['isAdmin'];
      final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

      if (isAdmin) {
        return await _fetchAllActiveDepots();
      } else if (allowedDepots.isNotEmpty) {
        var q = _supabaseService.client!.from('depots').select('nom');
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        final data = await q.inFilter('nom', allowedDepots).order('nom');
        return (data as List).map((e) => e['nom'].toString()).toList();
      } else {
        return []; // Deny-by-default: return empty list
      }
    }
    return ["Principal"];
  }

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

  Future<List<dynamic>> getPurchases(String token, {bool forceRefresh = false}) async {
    // 1. Try Next.js API first
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      final effectiveToken = secureToken ?? token;

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
          debugPrint('ApiService: Fetched ${data.length} purchases from Next.js API');
          return data;
        }
      } else {
        debugPrint('ApiService: Purchases API returned status ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: Purchases API failed ($e), falling back to Supabase');
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
        debugPrint('ApiService: Fetched ${headers.length} purchase headers from Supabase');
        return headers;
      } catch (e) {
        debugPrint('ApiService Global Error (getPurchases): $e');
        return [];
      }
    }
    return [];
  }

  Future<String> getNextPurchaseRef() async {
    // Try API first
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }

      final uri = Uri.parse('$_baseUrl/api/purchases/next-ref');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (secureToken != null && secureToken.isNotEmpty) 'Authorization': 'Bearer $secureToken',
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
        debugPrint('ApiService Error (getNextPurchaseRef): $e');
        final dateStr = DateFormat('ddMMyy').format(DateTime.now());
        return "ACH-$dateStr-0001";
      }
    }
    final dateStr = DateFormat('ddMMyy').format(DateTime.now());
    return "ACH-$dateStr-0001";
  }

  Future<Map<String, dynamic>?> getPurchaseWithItems(String id) async {
    // 1. Try Next.js API first
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }

      final uri = Uri.parse('$_baseUrl/api/purchases/$id');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (secureToken != null && secureToken.isNotEmpty) 'Authorization': 'Bearer $secureToken',
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
      debugPrint('ApiService: API getPurchaseWithItems failed ($e), falling back to Supabase');
    }

    // 2. Fallback to Supabase
    if (await _ensureSupabaseReady()) {
      try {
        final client = _supabaseService.client!;
        debugPrint('ApiService: Starting FULL fetch for Purchase ID: $id');

        final purchase = await client.from('achats').select().eq('id', id).maybeSingle();
        if (purchase == null) {
          debugPrint('ApiService: Purchase record NOT found for ID: $id');
          return null;
        }
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
        } catch (e) {
          result['items'] = [];
        }

        try {
          final payments = await client.from('paiements').select().eq('achat_id', id).order('date_operation', ascending: true);
          result['payments'] = payments;
          result['paiements'] = payments;
        } catch (e) {
          result['payments'] = [];
        }
        
        return result;
      } catch (e) {
        debugPrint('ApiService Exception in getPurchaseWithItems: $e');
        return null;
      }
    }
    return null;
  }

  Future<List<dynamic>> getUsers(String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final orgId = await _supabaseService.getOrganizationId();
        var q = _supabaseService.client!
            .from('users')
            .select('*, user_depots(depots(nom))');
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        return await q.order('utilisateur');
      } catch (_) {
        try {
          final orgId = await _supabaseService.getOrganizationId();
          var q = _supabaseService.client!.from('users').select();
          if (orgId != null && orgId.isNotEmpty) {
            q = q.eq('organization_id', orgId);
          }
          return await q.order('utilisateur');
        } catch (_) {
          return [];
        }
      }
    }
    return [];
  }

  Future<List<dynamic>> getExpenses(String token, {String? startDate, String? endDate, bool forceRefresh = false}) async {
    try {
      debugPrint('ApiService: START getExpenses directly');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId'] as String?;
      
      final Map<String, String> params = {};
      if (startDate != null) params['start'] = startDate;
      if (endDate != null) params['end'] = endDate;
      
      final queryString = params.isNotEmpty ? '?' + params.entries.map((e) => '${e.key}=${e.value}').join('&') : '';
      final uri = Uri.parse('$_baseUrl/api/expenses$queryString');
      
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
      );

      debugPrint('ApiService: getExpenses response: ${response.statusCode}');

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        debugPrint('ApiService: getExpenses ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getExpenses: $e');
      if (await _ensureSupabaseReady()) {
        final authCtx = await _getAuthContext();
        final bool isAdmin = authCtx['isAdmin'];
        final orgId = authCtx['organizationId'] as String?;
        final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);

        var query = _supabaseService.client!.from('depenses').select();
        
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
      return [];
    }
  }
  
  Future<List<dynamic>> getDeposits(String token, {bool forceRefresh = false, String? vendeur}) async {
    try {
      debugPrint('ApiService: START getDeposits directly');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId'] as String?;
      final uri = Uri.parse('$_baseUrl/api/advances');
      
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

      debugPrint('ApiService: getDeposits response: ${response.statusCode}');

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        debugPrint('ApiService: getDeposits ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getDeposits: $e — falling back to Supabase');
      if (await _ensureSupabaseReady()) {
        try {
          final authCtx = await _getAuthContext();
          final orgId = authCtx['organizationId'] as String?;
          final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);
          debugPrint('ApiService: Supabase Fallback getDeposits (vendeur: $effectiveVendeur)');
          
          var query = _supabaseService.client!.from('avances_clients').select('*, clients(nom)');
          if (orgId != null && orgId.isNotEmpty) {
            query = query.eq('organization_id', orgId);
          }
          if (effectiveVendeur != null) {
            query = query.eq('utilisateur', effectiveVendeur);
          }
          final data = await query.order('date_avance', ascending: false);
          debugPrint('ApiService: Supabase Fallback getDeposits SUCCESS, found ${data.length} items');
          return data;
        } catch (sbErr) {
          debugPrint('ApiService: Supabase Fallback getDeposits join failed: $sbErr — trying simple select');
          try {
             final authCtx = await _getAuthContext();
             final orgId = authCtx['organizationId'] as String?;
             var sq = _supabaseService.client!.from('avances_clients').select();
             if (orgId != null && orgId.isNotEmpty) {
               sq = sq.eq('organization_id', orgId);
             }
             final simpleData = await sq.order('date_avance', ascending: false).limit(50);
             return simpleData;
          } catch (simpleErr) {
             debugPrint('ApiService: Supabase Fallback getDeposits CRITICAL ERROR: $simpleErr');
             return [];
          }
        }
      }
      return [];
    }
  }

  Future<List<dynamic>> getNotifications(String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        return await _supabaseService.client!
            .from('notifications')
            .select()
            .eq('is_read', false)
            .order('created_at', ascending: false);
      } catch (e) {
        debugPrint('getNotifications error: $e');
        return [];
      }
    }
    return [];
  }

  Future<void> markNotificationAsRead(String id, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        await _supabaseService.client!
            .from('notifications')
            .update({'is_read': true})
            .eq('id', id);
      } catch (e) {
        debugPrint('markNotificationAsRead error: $e');
      }
    }
  }

  /// Fetch movements for a specific deposit (on-demand, for printing only)
  Future<List<dynamic>> getDepositMovements(String depositId, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        return await _supabaseService.client!
            .from('paiements')
            .select('date_operation, montant_regle, moyen_reglement, reference_paiement, facture_id, notes')
            .eq('avance_client_id', depositId)
            .order('date_operation', ascending: true);
      } catch (e) {
        debugPrint('getDepositMovements error: $e');
        return [];
      }
    }
    return [];
  }


  Future<List<dynamic>> getStockMovements({required String token, String? startDate, String? endDate, String? depot, String? search, String? articleId}) async {
    final authCtx = await _getAuthContext();
    final bool isAdmin = authCtx['isAdmin'] ?? false;
    final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>? ?? []);
    final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

    if (!isAdmin && allowedDepots.isEmpty) return [];

    // 1. Try Next.js API first (/api/stock/mouvements)
    try {
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      final effectiveToken = secureToken ?? token;

      final Map<String, String> queryParams = {};
      if (startDate != null && startDate.isNotEmpty) queryParams['startDate'] = startDate;
      if (endDate != null && endDate.isNotEmpty) queryParams['endDate'] = endDate;
      if (depot != null && depot != 'Tous' && depot.isNotEmpty) queryParams['depot'] = depot;
      if (search != null && search.trim().isNotEmpty) queryParams['search'] = search.trim();
      if (articleId != null && articleId.isNotEmpty) queryParams['articleId'] = articleId;

      final uri = Uri.parse('$_baseUrl/api/stock/mouvements').replace(queryParameters: queryParams.isNotEmpty ? queryParams : null);
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
          debugPrint('ApiService: Fetched ${data.length} movements from Next.js API');
          return data.map((m) {
            final double qte = (m['quantite'] as num?)?.toDouble() ?? 
                (((m['entree'] as num?)?.toDouble() ?? 0.0) - ((m['sortie'] as num?)?.toDouble() ?? 0.0));
            return {
              'id': m['id'],
              'date': m['date_mouvement'] ?? m['date'] ?? '',
              'code_article': m['articles']?['reference'] ?? m['code_article'] ?? '-',
              'designation': m['articles']?['designation'] ?? m['designation'] ?? '-',
              'operation': m['type'] ?? m['operation'] ?? '',
              'no_doc': m['nr_doc'] ?? m['no_doc'] ?? '-',
              'tiers': m['fournisseur_client'] ?? m['tiers'] ?? '-',
              'depot': m['depot'] ?? '',
              'responsable': m['utilisateur'] ?? m['responsable'] ?? 'Système',
              'stock_avant': (m['stock_avant'] as num?)?.toDouble() ?? 0.0,
              'mouvement': qte,
              'stock_apres': (m['stock_apres'] as num?)?.toDouble() ?? 0.0,
            };
          }).toList();
        }
      }
    } catch (e) {
      debugPrint('ApiService: /api/stock/mouvements failed ($e), falling back to Supabase');
    }

    // 2. Direct Supabase Fallback (Strictly multi-tenant)
    if (await _ensureSupabaseReady()) {
      var q = _supabaseService.client!.from('mouvements').select('*, articles(reference, designation)');
      
      // CRITICAL: Always enforce multi-tenancy by organization_id
      if (orgId != null && orgId.isNotEmpty) {
        q = q.eq('organization_id', orgId);
      }

      if (startDate != null && startDate.isNotEmpty) q = q.gte('date_mouvement', startDate);
      if (endDate != null && endDate.isNotEmpty) q = q.lte('date_mouvement', endDate);
      if (articleId != null && articleId.isNotEmpty) q = q.eq('article_id', articleId);
      
      if (!isAdmin) {
        q = q.inFilter('depot', allowedDepots);
        if (depot != null && depot != 'Tous' && !allowedDepots.contains(depot)) {
          throw Exception("Accès refusé au dépôt '$depot'.");
        }
      }
      if (depot != null && depot != 'Tous' && depot.isNotEmpty) q = q.eq('depot', depot);

      if (search != null && search.trim().isNotEmpty) {
        final term = search.trim();
        try {
          var artQ = _supabaseService.client!.from('articles').select('id');
          if (orgId != null && orgId.isNotEmpty) {
            artQ = artQ.eq('organization_id', orgId);
          }
          final arts = await artQ.or('designation.ilike.%$term%,reference.ilike.%$term%');
          final artIds = (arts as List).map((a) => a['id'].toString()).toList();
          if (artIds.isNotEmpty) {
            q = q.or('nr_doc.ilike.%$term%,fournisseur_client.ilike.%$term%,article_id.in.(${artIds.join(",")})');
          } else {
            q = q.or('nr_doc.ilike.%$term%,fournisseur_client.ilike.%$term%');
          }
        } catch (_) {
          q = q.or('nr_doc.ilike.%$term%,fournisseur_client.ilike.%$term%');
        }
      }

      final data = await q.order('date_mouvement', ascending: false).limit(2000);
      return (data as List).map((m) => {
        'id': m['id'],
        'date': m['date_mouvement'],
        'code_article': m['articles']?['reference'] ?? '-',
        'designation': m['articles']?['designation'] ?? '-',
        'operation': m['type'],
        'no_doc': m['nr_doc'] ?? '-',
        'tiers': m['fournisseur_client'] ?? '-',
        'depot': m['depot'],
        'responsable': m['utilisateur'] ?? 'Système',
        'stock_avant': (m['stock_avant'] as num?)?.toDouble() ?? 0.0,
        'mouvement': (m['quantite'] as num?)?.toDouble() ?? 0.0,
        'stock_apres': (m['stock_apres'] as num?)?.toDouble() ?? 0.0,
      }).toList();
    }
    return [];
  }

  // --- Create/Update/Delete ---
  Future<List<dynamic>> getActiveDepots(String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final bool isAdmin = authCtx['isAdmin'];
      final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final client = _supabaseService.client!;

      if (!isAdmin && allowedDepots.isEmpty) return [];

      try {
        var q = client.from('depots').select().eq('is_deleted', false).eq('is_active', true);
        if (orgId != null && orgId.isNotEmpty) q = q.eq('organization_id', orgId);
        if (!isAdmin) q = q.inFilter('nom', allowedDepots);
        return await q.order('nom');
      } catch (_) {
        var q = client.from('depots').select();
        if (orgId != null && orgId.isNotEmpty) q = q.eq('organization_id', orgId);
        if (!isAdmin) q = q.inFilter('nom', allowedDepots);
        return await q.order('nom');
      }
    }
    return [];
  }

  Future<String?> createInvoice(Map<String, dynamic> data, String token, {double? paymentAmount, String? paymentMethod, String? advanceClientId}) async {
    try {
      debugPrint('ApiService: START createInvoice directly');
      
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

          debugPrint('ApiService: Invoking atomic /api/pos/checkout...');
          final checkoutRes = await _nextApiClient.checkout(checkoutPayload);
          if (checkoutRes['ok'] == true) {
            final String? id = checkoutRes['invoice_id']?.toString() ??
                checkoutRes['sale']?['id']?.toString() ??
                checkoutRes['invoice']?['id']?.toString();
            debugPrint('✅ Atomic Checkout successful: ID=$id');
            return id;
          }
        } catch (checkoutErr) {
          debugPrint('⚠️ Atomic POS Checkout failed ($checkoutErr), trying standard /api/invoices...');
        }
      }

      // 2. Standard /api/invoices fallback
      final uri = Uri.parse('$_baseUrl/api/invoices');
      final body = Map<String, dynamic>.from(data);
      if (orgId != null && orgId.isNotEmpty) {
        body['organization_id'] = orgId;
      }
      
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
          if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
        },
        body: json.encode(body),
      );

      debugPrint('ApiService: createInvoice response: ${response.statusCode}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        final resData = json.decode(response.body);
        final String? id = resData['id']?.toString();
        
        if (id != null && (paymentAmount ?? 0) > 0) {
          await payInvoice(id, paymentAmount!, paymentMethod ?? 'Espèce', token, advanceClientId: advanceClientId);
        }
        return id;
      } else {
        debugPrint('ApiService: createInvoice ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in createInvoice: $e');
      // Fallback to Supabase
      if (await _ensureSupabaseReady()) {
        final authCtx = await _getAuthContext();
        final isAdmin = authCtx['isAdmin'] as bool;
        final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
        final id = await _supabaseService.syncInvoiceDirect(data, allowedDepots: allowedDepots, isAdmin: isAdmin);
        if (id != null && (paymentAmount ?? 0) > 0) {
          await payInvoice(id, paymentAmount!, paymentMethod ?? 'Espèce', token, advanceClientId: advanceClientId);
        }
        return id;
      }
      return null;
    }
  }

  Future<bool> createClientFull(Map<String, dynamic> data, String token) async {
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      final effectiveToken = secureToken ?? token;
      
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

      debugPrint('ApiService: createClientFull response: ${response.statusCode}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        debugPrint('✅ ApiService: Client created successfully via API');
        return true;
      }
      debugPrint('⚠️ ApiService: /api/clients returned ${response.statusCode}: ${response.body}, falling back to Supabase direct...');
    } catch (e) {
      debugPrint('⚠️ ApiService: createClientFull API error: $e, falling back to Supabase direct');
    }

    if (await _ensureSupabaseReady()) {
      return await _supabaseService.syncClientDirect(data);
    }
    return false;
  }

  Future<void> addSupplier(Map<String, dynamic> data, String token) async {
    if (await _ensureSupabaseReady()) await _supabaseService.syncSupplierDirect(data);
  }

  Future<bool> createPurchase(Map<String, dynamic> data, String token) async {
    // 1. Try Next.js API first
    try {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      final effectiveToken = secureToken ?? token;

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
        debugPrint('✅ ApiService: Purchase created via Next.js API');
        return true;
      }
      debugPrint('⚠️ ApiService: /api/purchases POST returned ${response.statusCode}: ${response.body}');
    } catch (e) {
      debugPrint('ApiService: createPurchase API failed ($e), falling back to Supabase');
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

    // 1. Try Next.js API first
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
        debugPrint('✅ ApiService: Purchase deleted via Next.js API');
        return true;
      }
    } catch (e) {
      debugPrint('ApiService: deletePurchase API failed ($e), falling back to Supabase');
    }

    // 2. Direct Supabase Fallback
    if (await _ensureSupabaseReady()) {
      return await _supabaseService.deletePurchaseDirect(purchaseId);
    }
    return false;
  }

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

    // 1. Try Next.js API first
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
        debugPrint('✅ ApiService: Purchase payment recorded via Next.js API');
        return true;
      }
    } catch (e) {
      debugPrint('ApiService: payPurchase API failed ($e), falling back to Supabase');
    }

    // 2. Direct Supabase Fallback
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

    // 1. Try Next.js API first
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
        debugPrint('✅ ApiService: Purchase updated via Next.js API');
        return true;
      }
    } catch (e) {
      debugPrint('ApiService: updatePurchase API failed ($e), falling back to Supabase');
    }

    // 2. Direct Supabase Fallback
    if (await _ensureSupabaseReady()) {
      return await _supabaseService.updatePurchaseDirect(purchaseId, data);
    }
    return false;
  }

  Future<void> addArticleWithImage(Map<String, String> fields, String? image, String token) async {
    if (await _ensureSupabaseReady()) {
      await _requireAdmin();
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final Map<String, dynamic> data = {};
      final String id = const Uuid().v4();
      data['id'] = id;
      if (orgId != null && orgId.isNotEmpty && !data.containsKey('organization_id')) {
        data['organization_id'] = orgId;
      }
      
      final Map<String, double> stocks = {};
      
      fields.forEach((k, v) {
        if (k.startsWith('qte_')) {
          final depotName = k.substring(4);
          stocks[depotName] = double.tryParse(v) ?? 0.0;
        } else if (['p_achat_ht', 'p_achat_ttc', 'p_vente_ht', 'p_vente_ttc', 'taxe', 'quantite', 'stock_min', 'stock_alerte', 'qte_min'].contains(k)) {
          // Map stock_min to qte_min to match schema
          final key = k == 'stock_min' ? 'qte_min' : k;
          data[key] = double.tryParse(v) ?? 0.0;
        } else {
          data[k] = v;
        }
      });
      
      // 1. Insert Article
      await _supabaseService.client!.from('articles').insert(data);
      
      // 1.5. Record initial price in history
      double pAchatHt = double.tryParse(fields['p_achat_ht'] ?? '0') ?? 0.0;
      double pVenteHt = double.tryParse(fields['p_vente_ht'] ?? '0') ?? 0.0;
      await _supabaseService.client!.from('prix_histoire').insert({
        'id': const Uuid().v4(),
        'article_id': id,
        if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
        'p_achat_ht': pAchatHt,
        'p_vente_ht': pVenteHt,
        'utilisateur': fields['utilisateur'] ?? 'MobileApp',
        'date_changement': DateTime.now().toIso8601String(),
      });
      
      // 2. Insert Initial Stocks
      if (stocks.isNotEmpty) {
        final List<Map<String, dynamic>> stockInserts = [];
        stocks.forEach((depot, qte) {
          if (qte != 0) {
            stockInserts.add({
              'id': const Uuid().v4(),
              'article_id': id,
              if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
              'depot_nom': depot,
              'quantite': qte,
              'updated_at': DateTime.now().toIso8601String(),
            });
          }
        });
        
        if (stockInserts.isNotEmpty) {
          await _supabaseService.client!.from('stocks').insert(stockInserts);
          
          // 3. Create initial movements
          final List<Map<String, dynamic>> moveInserts = [];
          for (var s in stockInserts) {
            moveInserts.add({
              'id': const Uuid().v4(),
              'article_id': id,
              if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
              'date_mouvement': DateTime.now().toIso8601String().split('T')[0],
              'type': 'ENTREE',
              'quantite': s['quantite'],
              'utilisateur': data['utilisateur'] ?? 'MobileApp',
            });
          }
          if (moveInserts.isNotEmpty) {
            await _supabaseService.client!.from('mouvements').insert(moveInserts);
          }
        }
      }
      
      // Log Activity
      await _supabaseService.logActivity(
        actionType: 'CREATE',
        entityType: 'article',
        entityId: id,
        details: 'Nouvel article: ${fields['designation']} - Ref: ${fields['reference']}',
        username: fields['utilisateur'] ?? 'Admin',
      );
    }
  }

  Future<void> payInvoice(String id, double amount, String method, String token, {String? reference, String? date, String? advanceClientId}) async {
    try {
      debugPrint('ApiService: START payInvoice directly for $id');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      final uri = Uri.parse('$_baseUrl/api/invoices/$id/payments');
      
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
        },
        body: json.encode({
          'montant_regle': amount,
          'moyen_reglement': method,
          'date_operation': date ?? DateTime.now().toIso8601String().split('T')[0],
          'reference_paiement': reference,
          'avance_client_id': advanceClientId,
        }),
      );

      debugPrint('ApiService: payInvoice response: ${response.statusCode}');

      if (response.statusCode != 200 && response.statusCode != 201) {
        debugPrint('ApiService: payInvoice ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in payInvoice: $e');
      if (await _ensureSupabaseReady()) {
        final authCtx = await _getAuthContext();
        final username = authCtx['username']?.toString();
        await _supabaseService.payInvoiceDirect(
          id,
          amount,
          method,
          reference: reference,
          date: date,
          advanceClientId: advanceClientId,
          utilisateur: username,
        );
      }
    }
  }

  Future<void> cancelInvoice(String id, String token) async {
    if (await _ensureSupabaseReady()) {
      await _requireAdmin();
      await _supabaseService.cancelInvoiceDirect(id);
    }
  }

  Future<void> updateInvoice(String id, Map<String, dynamic> data, String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final isAdmin = authCtx['isAdmin'] as bool;
      final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      final username = authCtx['username']?.toString();

      if (!isAdmin) {
        final invoice = await _supabaseService.client!
            .from('factures')
            .select('vendeur')
            .eq('id', id)
            .maybeSingle();
        final invVendeur = invoice?['vendeur']?.toString();
        if (username != null && invVendeur != null && invVendeur.toLowerCase() != username.toLowerCase()) {
          throw Exception("Accès refusé: facture non autorisée.");
        }
      }
      // if header totals missing but items are passed we can recompute simple values
      final items = data.remove('items');
      if (items != null) {
        double totTtc = 0.0;
        double totHt = 0.0;
        double totTva = 0.0;
        double tauxFact = 0.0;
        for (var item in items) {
          double qte = (item['qte'] as num?)?.toDouble() ?? 0.0;
          double puTtc = (item['pu_ttc'] as num?)?.toDouble() ?? 0.0;
          double tauxItem = (item['taux_tva_item'] as num?)?.toDouble() ?? 0.0;
          double puHt = (item['pu_ht'] as num?)?.toDouble() ?? (tauxItem>0 ? puTtc/(1+tauxItem/100) : puTtc);
          double montTva = (item['montant_tva_item'] as num?)?.toDouble() ?? ((puTtc - puHt) * qte);
          totTtc += puTtc * qte;
          totHt += puHt * qte;
          totTva += montTva;
          if (tauxFact == 0 && tauxItem > 0) tauxFact = tauxItem;
        }
        data['total_ttc'] = data['total_ttc'] ?? totTtc;
        data['total_ht'] = data['total_ht'] ?? totHt;
        data['total_tva'] = data['total_tva'] ?? totTva;
        data['taux_tva_facture'] = data['taux_tva_facture'] ?? tauxFact;
      }
      await _supabaseService.client!.from('factures').update(data).eq('id', id);
      if (items != null) {
        if (!isAdmin) {
          final depotsToCheck = (items as List)
              .map((i) => (i['depot_origine'] ?? 'Boutique').toString())
              .toList();
          _assertDepotsAccess(allowedDepots, depotsToCheck);
        }
        await _supabaseService.client!.from('facture_items').delete().eq('facture_id', id);
        for (var item in items) { 
          item['id'] = const Uuid().v4();
          item['facture_id'] = id; 
          await _supabaseService.client!.from('facture_items').insert(item); 
        }
      }

      // log TVA change/update if present
      try {
        final tv = data['total_tva'];
        final ttf = data['taux_tva_facture'];
        if (tv != null || ttf != null) {
          await _supabaseService.client!.from('activity_logs').insert({
            'user_id': username ?? 'MobileApp',
            'username': username ?? 'MobileApp',
            'action_type': 'TVA_MISE_A_JOUR',
            'entity_type': 'facture',
            'entity_id': id,
            'details': 'total_tva=$tv taux_tva_facture=$ttf',
            'ip_address': null,
            'device_info': null,
          });
        }
      } catch (_) {}
    }
  }

  Future<Map<String, dynamic>?> createDeposit(Map<String, dynamic> data, String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      data['utilisateur'] = data['utilisateur'] ?? authCtx['username'];
      return await _supabaseService.syncDepositDirect(data);
    }
    return null;
  }

  Future<void> withdrawDeposit(String id, double amount, String token) async {
    if (await _ensureSupabaseReady()) {
      final client = _supabaseService.client!;
      final authCtx = await _getAuthContext();
      final username = authCtx['username']?.toString();
      
      // 1. Fetch current balance
      final res = await client.from('avances_clients').select('montant_restant, client_id, reference_paiement, utilisateur, emplacement').eq('id', id).maybeSingle();
      if (res == null) throw Exception("Dépôt introuvable (ID: $id)");

      final double current = (res['montant_restant'] as num).toDouble();
      final double newBalance = current - amount;
      
      // 2. Update balance and status
      await client.from('avances_clients').update({
        'montant_restant': newBalance,
        'statut': newBalance <= 0 ? 'Utilisée' : 'Partiellement utilisée',
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', id);

      // 3. Record the "Retrait" in paiements table for Bilan/Cash Report
      await client.from('paiements').insert({
        'id': const Uuid().v4(),
        'client_id': res['client_id'],
        'avance_client_id': id,
        'montant_regle': -amount, // Negative for withdrawal
        'moyen_reglement': 'Espèce',
        'reference_paiement': 'RET-AV-${res['reference_paiement']}',
        'date_operation': DateTime.now().toIso8601String().split('T')[0],
        'utilisateur': username ?? res['utilisateur'] ?? 'MobileApp',
        'notes': 'Retrait partiel de l\'avance',
      });
    }
  }

  Future<void> deleteExpense(String id, String token) async {
    if (await _ensureSupabaseReady()) await _supabaseService.client!.from('depenses').delete().eq('id', id);
  }

  Future<void> adjustStock(String articleId, double quantity, String depot, String date, String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final username = authCtx['username']?.toString() ?? 'System';
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      final client = _supabaseService.client!;
      
      var stockQ = client.from('stocks').select().eq('article_id', articleId).eq('depot_nom', depot);
      if (orgId != null && orgId.isNotEmpty) stockQ = stockQ.eq('organization_id', orgId);
      final stock = await stockQ.maybeSingle();

      double oldStock = 0.0;
      if (stock != null) {
        oldStock = (stock['quantite'] as num).toDouble();
        final double newStock = oldStock + quantity;
        await client.from('stocks').update({'quantite': newStock}).eq('id', stock['id']);
      } else {
        await client.from('stocks').insert({
          'id': const Uuid().v4(),
          'article_id': articleId,
          'depot_nom': depot,
          'quantite': quantity,
          if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
        });
      }

      // Record in mouvements table with organization_id
      try {
        await client.from('mouvements').insert({
          if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
          'article_id': int.tryParse(articleId) ?? 0,
          'date_mouvement': date.isNotEmpty ? date : DateTime.now().toIso8601String().split('T')[0],
          'type': quantity >= 0 ? 'ENTREE' : 'SORTIE',
          'stock_avant': oldStock,
          'quantite': quantity,
          'stock_apres': oldStock + quantity,
          'depot': depot,
          'nr_doc': 'AJUST-${DateTime.now().millisecondsSinceEpoch.toString().substring(7)}',
          'utilisateur': username,
          if (quantity >= 0) 'entree': quantity else 'sortie': -quantity,
        });
      } catch (e) {
        debugPrint('⚠️ Stock adjustment movement insert failed (non-fatal): $e');
      }

      await _supabaseService.logActivity(
        actionType: 'AJUSTEMENT',
        entityType: 'stock',
        entityId: articleId,
        details: 'Ajustement de $quantity dans $depot',
        username: username,
      );
    }
  }

  Future<Map<String, dynamic>> transferStock(String articleId, String source, String dest, double quantity, String date, String token) async {
    if (await _ensureSupabaseReady()) {
      await _requireAdmin();
      await adjustStock(articleId, -quantity, source, date, token);
      await adjustStock(articleId, quantity, dest, date, token);

      // Log Activity
      await _supabaseService.logActivity(
        actionType: 'TRANSFERT',
        entityType: 'stock',
        entityId: articleId,
        details: 'Transfert de $quantity de $source vers $dest',
        username: 'Admin',
      );

      return {'success': true, 'source_stock': 0, 'destination_stock': 0};
    }
    return {'success': false};
  }

  Future<void> saveDepot(Map<String, dynamic> data, String token) async {
    if (await _ensureSupabaseReady()) {
      await _requireAdmin();
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      if (data['id'] != null) {
        final id = data.remove('id');
        await _supabaseService.client!.from('depots').update(data).eq('id', id);
      } else {
        final payload = Map<String, dynamic>.from(data);
        payload['id'] = const Uuid().v4();
        if (orgId != null && orgId.isNotEmpty && !payload.containsKey('organization_id')) {
          payload['organization_id'] = orgId;
        }
        await _supabaseService.client!.from('depots').insert(payload);
      }
    }
  }

  Future<void> deleteDepot(String id, String token) async {
    if (await _ensureSupabaseReady()) {
      await _requireAdmin();
      await _supabaseService.client!.from('depots').delete().eq('id', id);
    }
  }

  Future<void> createUserFull(Map<String, dynamic> data, String token) async {
    if (await _ensureSupabaseReady()) {
      await _requireAdmin();
      final payload = Map<String, dynamic>.from(data);
      if (payload['id'] == null) payload['id'] = const Uuid().v4();
      final String userId = payload['id'].toString();

      List<String> depotsList = [];
      if (payload['depots'] != null) {
        if (payload['depots'] is List) {
          depotsList = _normalizeDepotNames((payload['depots'] as List).map((e) => e.toString()).toList());
        } else {
          depotsList = _parseDepotString(payload['depots'].toString());
        }
        payload['depots'] = depotsList.join(', ');
      }

      await _supabaseService.client!.from('users').insert(payload);

      if (depotsList.isNotEmpty) {
        await _syncUserDepotsByNames(userId, depotsList);
      }
    }
  }

  Future<void> updateUserFull(String id, Map<String, dynamic> data, String token) async {
    if (await _ensureSupabaseReady()) {
      await _requireAdmin();
      final payload = Map<String, dynamic>.from(data);
      List<String> depotsList = [];
      if (payload.containsKey('depots')) {
        if (payload['depots'] is List) {
          depotsList = _normalizeDepotNames((payload['depots'] as List).map((e) => e.toString()).toList());
        } else {
          depotsList = _parseDepotString(payload['depots']?.toString());
        }
        payload['depots'] = depotsList.join(', ');
      }
      await _supabaseService.client!.from('users').update(payload).eq('id', id);
      if (payload.containsKey('depots')) {
        await _syncUserDepotsByNames(id, depotsList);
      }
    }
  }

  Future<void> deleteUser(String id, String token) async {
    if (await _ensureSupabaseReady()) {
      await _requireAdmin();
      await _supabaseService.client!.from('users').delete().eq('id', id);
    }
  }

  Future<void> payClientBulk(String clientId, double amount, String method, String token) async {
    if (await _ensureSupabaseReady()) {
      await _supabaseService.client!.from('paiements').insert({
        'id': const Uuid().v4(),
        'client_id': clientId, 
        'montant_regle': amount, 
        'moyen_reglement': method, 
        'date_operation': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'utilisateur': 'MobileApp'
      });
    }
  }

  // --- Stats & Reports ---
  Future<Map<String, dynamic>> getDashboardStats(String token, {bool forceRefresh = false, String? vendeur}) async {
    try {
      debugPrint('ApiService: START getDashboardStats directly');
      
      final effectiveToken = await _getEffectiveToken(token);
      
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId'] as String?;
      final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);

      final uri = Uri.parse('$_baseUrl/api/dashboard');
      
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

      debugPrint('ApiService: getDashboardStats response: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        int totalClients = (data['totalClients'] as num?)?.toInt() ?? (data['total_clients'] as num?)?.toInt() ?? 0;
        int totalProducts = (data['totalProducts'] as num?)?.toInt() ?? (data['total_products'] as num?)?.toInt() ?? 0;
        double dailySales = (data['todaySales'] as num?)?.toDouble() ?? (data['daily_sales'] as num?)?.toDouble() ?? 0.0;
        int invoiceCount = (data['todayInvoices'] as num?)?.toInt() ?? (data['invoice_count'] as num?)?.toInt() ?? 0;
        int lowStock = (data['lowStockCount'] as num?)?.toInt() ?? (data['low_stock'] as num?)?.toInt() ?? 0;

        // Fallback to direct scoped count from Supabase if 0 (e.g. initial load or lightweight API)
        if (totalClients == 0 || totalProducts == 0 || dailySales == 0.0) {
          try {
            if (await _ensureSupabaseReady()) {
              final client = _supabaseService.client!;
              if (totalClients == 0) {
                var cq = client.from('clients').select('id').or('is_deleted.eq.false,is_deleted.is.null');
                if (orgId != null && orgId.isNotEmpty) cq = cq.eq('organization_id', orgId);
                final cRes = await cq;
                totalClients = (cRes as List).length;
              }
              if (totalProducts == 0) {
                var pq = client.from('articles').select('id').or('is_deleted.eq.false,is_deleted.is.null');
                if (orgId != null && orgId.isNotEmpty) pq = pq.eq('organization_id', orgId);
                final pRes = await pq;
                totalProducts = (pRes as List).length;
              }
              if (dailySales == 0.0 && invoiceCount == 0) {
                final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
                var sq = client.from('factures')
                    .select('total_ttc')
                    .gte('date_facture', today)
                    .lte('date_facture', '${today}T23:59:59.999Z')
                    .neq('statut', 'Annulée')
                    .or('is_deleted.eq.false,is_deleted.is.null');
                if (orgId != null && orgId.isNotEmpty) sq = sq.eq('organization_id', orgId);
                if (effectiveVendeur != null) sq = sq.eq('vendeur', effectiveVendeur);
                final sRes = await sq;
                final sList = sRes as List;
                if (sList.isNotEmpty) {
                  invoiceCount = sList.length;
                  for (var f in sList) {
                    dailySales += (f['total_ttc'] as num?)?.toDouble() ?? 0.0;
                  }
                }
              }
            }
          } catch (_) {}
        }

        return {
          'daily_sales': dailySales,
          'invoice_count': invoiceCount,
          'total_clients': totalClients,
          'total_products': totalProducts,
          'low_stock': lowStock,
        };
      } else {
        debugPrint('ApiService: getDashboardStats ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getDashboardStats: $e');
      if (await _ensureSupabaseReady()) {
        try {
          final client = _supabaseService.client!;
          final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
          final authCtx = await _getAuthContext();
          final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);
          final orgId = authCtx['organizationId'] as String?;
          
          var q = client.from('factures')
              .select('total_ttc')
              .gte('date_facture', today)
              .lte('date_facture', '${today}T23:59:59.999Z')
              .neq('statut', 'Annulée')
              .or('is_deleted.eq.false,is_deleted.is.null');
          
          if (orgId != null && orgId.isNotEmpty) {
            q = q.eq('organization_id', orgId);
          }
          if (effectiveVendeur != null) {
            q = q.eq('vendeur', effectiveVendeur);
          }
          
          final facturesRes = await q;
          double dailyTotal = 0.0;
          final facturesList = facturesRes as List;
          for (var f in facturesList) {
            dailyTotal += (f['total_ttc'] as num?)?.toDouble() ?? 0.0;
          }

          var cq = client.from('clients').select('id').or('is_deleted.eq.false,is_deleted.is.null');
          if (orgId != null && orgId.isNotEmpty) cq = cq.eq('organization_id', orgId);
          final clientsRes = await cq;

          var aq = client.from('articles').select('id').or('is_deleted.eq.false,is_deleted.is.null');
          if (orgId != null && orgId.isNotEmpty) aq = aq.eq('organization_id', orgId);
          final articlesRes = await aq;

          final invCount = facturesList.length;

          return {
            'daily_sales': dailyTotal,
            'total_clients': (clientsRes as List).length,
            'total_products': (articlesRes as List).length,
            'invoice_count': invCount
          };
        } catch (_) { return {}; }
      }
      return {};
    }
  }

  Future<Map<String, dynamic>> getCashReport(String token, {String? date, String? vendeur}) async {
    try {
      debugPrint('ApiService: START getCashReport directly');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      final targetDate = date ?? DateFormat('yyyy-MM-dd').format(DateTime.now());
      final uri = Uri.parse('$_baseUrl/api/reports/cash-balance?start=$targetDate&end=$targetDate${vendeur != null ? '&cashier=$vendeur' : ''}');
      
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
        },
      );

      debugPrint('ApiService: getCashReport response: ${response.statusCode}');

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
          'depenses_list': depensesList
        };
      } else {
        debugPrint('ApiService: getCashReport ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getCashReport via API: $e — falling back to Supabase');
      // Fallback: use direct Supabase queries
      if (await _ensureSupabaseReady()) {
        try {
          final client = _supabaseService.client!;
          final targetDate = date ?? DateFormat('yyyy-MM-dd').format(DateTime.now());
          
          // Enforce seller scoping
          final authCtx = await _getAuthContext();
          final isAdmin = authCtx['isAdmin'] as bool;
          final username = authCtx['username'] as String?;
          final effectiveVendeur = isAdmin ? vendeur : username;

          // Fetch all data in parallel
          final results = await Future.wait([
            _fetchPaiementsForReport(client, targetDate, effectiveVendeur),
            _fetchAdvancesForReport(client, targetDate, effectiveVendeur),
            _fetchFacturesForReport(client, targetDate, effectiveVendeur),
            _fetchDepensesForReport(client, targetDate, effectiveVendeur),
          ]);

          final paiements = results[0] as List;
          final advances = results[1] as List;
          final factures = results[2] as List;
          final depenses = results[3] as List;

          // Build recettes list from paiements (actual cash flow)
          final recettesList = <Map<String, dynamic>>[];
          for (final p in paiements) {
            final montant = (p['montant_regle'] as num?)?.toDouble() ?? 0.0;
            if (montant == 0) continue;

            final fact = p['factures'];
            final adv = p['avances_clients'];
            
            String clientName = 'Client';
            String info = p['moyen_reglement'] ?? '';
            String type = montant > 0 ? 'Paiement' : 'Retrait';

            if (fact is Map) {
              type = 'Vente (Caisse)';
              info = fact['bl_number'] ?? info;
              final cData = fact['clients'];
              if (cData is Map) clientName = (cData['nom'] ?? '').toString().trim();
            } else if (adv is Map) {
              type = 'Avance Client';
              info = adv['reference_paiement'] ?? info;
              final cData = adv['clients'];
              if (cData is Map) clientName = (cData['nom'] ?? '').toString().trim();
            }

            recettesList.add({
              'client': clientName,
              'type': type,
              'montant': montant,
              'info': info,
              'user': p['utilisateur'] ?? '',
              'date': p['date_operation'] ?? '',
            });
          }

          // Build credit sales from unpaid factures
          for (final f in factures) {
            final statut = (f['statut'] ?? '').toString().toLowerCase();
            if (statut == 'non payée' || statut == 'non paye') {
              final totalTtc = (f['total_ttc'] as num?)?.toDouble() ?? 0.0;
              if (totalTtc == 0) continue;
              
              String clientName = 'Client';
              final cData = f['clients'];
              if (cData is Map) clientName = (cData['nom'] ?? '').toString().trim();
              
              recettesList.add({
                'client': clientName,
                'type': 'Vente (Crédit)',
                'montant': totalTtc,
                'info': 'Crédit (${f['bl_number']})',
                'user': f['vendeur'] ?? '',
                'date': f['date_facture'] ?? '',
              });
            }
          }

          // Build depenses list
          final depensesList = <Map<String, dynamic>>[];
          for (final d in depenses) {
            depensesList.add({
              'libelle': d['libelle'] ?? 'Dépense',
              'operateur': d['operateur'] ?? '',
              'montant': (d['montant'] as num?)?.toDouble() ?? 0.0,
              'date': d['date_depense'] ?? '',
            });
          }

          final totalRecettes = recettesList.fold(0.0, (s, r) => s + (r['montant'] as double));
          final totalDepenses = depensesList.fold(0.0, (s, d) => s + (d['montant'] as double));

          return {
            'total_recettes': totalRecettes,
            'total_depenses': totalDepenses,
            'solde': totalRecettes - totalDepenses,
            'recettes_list': recettesList,
            'depenses_list': depensesList,
          };
        } catch (sbErr) {
          debugPrint('ApiService: Supabase fallback for getCashReport also failed: $sbErr');
        }
      }
      return {'total_recettes': 0, 'total_depenses': 0, 'solde': 0, 'recettes_list': [], 'depenses_list': []};
    }
  }

  /// Fetches cash report data for a date range in a single query (used for weekly/monthly).
  Future<Map<String, dynamic>> getCashReportRange(String token, {required String startDate, required String endDate, String? vendeur}) async {
    try {
      // Try Next.js API first
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      final effectiveToken = secureToken ?? token;
      
      final vendeurParam = vendeur != null ? '&cashier=$vendeur' : '';
      final uri = Uri.parse('$_baseUrl/api/reports/cash-balance?start=$startDate&end=$endDate$vendeurParam');
      final response = await http.get(uri, headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $effectiveToken',
      });

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final summary = data['summary'] ?? {};
        final List entries = data['entries'] ?? [];

        final List<Map<String, dynamic>> recettesList = [];
        final List<Map<String, dynamic>> depensesList = [];
        // Group by date for chart
        final Map<String, Map<String, double>> byDate = {};

        for (var e in entries) {
          final entree = (e['entree'] as num?)?.toDouble() ?? 0.0;
          final sortie = (e['sortie'] as num?)?.toDouble() ?? 0.0;
          final dateKey = e['date']?.toString().substring(0, 10) ?? startDate;
          byDate[dateKey] ??= {'sales': 0, 'expenses': 0};
          byDate[dateKey]!['sales'] = byDate[dateKey]!['sales']! + entree;
          byDate[dateKey]!['expenses'] = byDate[dateKey]!['expenses']! + sortie;

          if (entree > 0) {
            recettesList.add({'client': e['ref'] ?? 'Client', 'type': e['type'] ?? 'Vente', 'montant': entree, 'info': e['moyen'] ?? '', 'user': e['user'] ?? '', 'date': e['date'] ?? ''});
          }
          if (sortie > 0) {
            depensesList.add({'libelle': '${e['type']}: ${e['ref']}', 'operateur': e['user'] ?? '-', 'montant': sortie, 'date': e['date'] ?? ''});
          }
        }

        final series = byDate.entries.map((e) {
          final dt = DateTime.tryParse(e.key);
          return {'date': dt != null ? DateFormat('dd/MM').format(dt) : e.key, 'sales': e.value['sales'], 'expenses': e.value['expenses']};
        }).toList()..sort((a, b) => a['date'].toString().compareTo(b['date'].toString()));

        return {
          'summary': {
            'total_recettes': (summary['totalIncome'] as num?)?.toDouble() ?? 0.0,
            'total_depenses': (summary['totalExpenses'] as num?)?.toDouble() ?? 0.0,
            'solde': (summary['netBalance'] as num?)?.toDouble() ?? 0.0,
            'recettes_list': recettesList,
            'depenses_list': depensesList,
          },
          'series': series,
        };
      }
      throw Exception('HTTP ${response.statusCode}');
    } catch (_) {
      // Supabase fallback: fetch range at once
      if (await _ensureSupabaseReady()) {
        try {
          final client = _supabaseService.client!;
          final authCtx = await _getAuthContext();
          final isAdmin = authCtx['isAdmin'] as bool;
          final username = authCtx['username'] as String?;
          final effectiveVendeur = isAdmin ? vendeur : username;

          final orgId = authCtx['organizationId'] as String?;

          // Fetch paiements, depenses, and unpaid factures for the range in parallel
          var pq = client.from('paiements').select('montant_regle, facture_id, avance_client_id, moyen_reglement, utilisateur, date_operation, '
              'factures(bl_number, clients(nom)), '
              'avances_clients(reference_paiement, clients(nom))')
              .gte('date_operation', startDate).lte('date_operation', endDate);
          if (orgId != null && orgId.isNotEmpty) pq = pq.eq('organization_id', orgId);
          if (effectiveVendeur != null) pq = pq.eq('utilisateur', effectiveVendeur);

          var dq = client.from('depenses').select('montant, libelle, operateur, date_depense')
              .gte('date_depense', startDate).lte('date_depense', endDate);
          if (orgId != null && orgId.isNotEmpty) dq = dq.eq('organization_id', orgId);
          if (effectiveVendeur != null) dq = dq.eq('operateur', effectiveVendeur);

          var fq = client.from('factures').select('total_ttc, client_id, statut, bl_number, vendeur, date_facture, clients(nom)')
              .gte('date_facture', startDate).lte('date_facture', '${endDate}T23:59:59.999Z')
              .inFilter('statut', ['Non Payée', 'Non payée', 'Non payee', 'Non Payee']);
          if (orgId != null && orgId.isNotEmpty) fq = fq.eq('organization_id', orgId);
          if (effectiveVendeur != null) fq = fq.eq('vendeur', effectiveVendeur);

          final results = await Future.wait([pq, dq, fq]);
          final paiements = results[0] as List;
          final depenses = results[1] as List;
          final factures = results[2] as List;

          // Group by date for chart
          final Map<String, Map<String, double>> byDate = {};
          final recettesList = <Map<String, dynamic>>[];
          final depensesList = <Map<String, dynamic>>[];

          for (final p in paiements) {
            final montant = (p['montant_regle'] as num?)?.toDouble() ?? 0.0;
            if (montant == 0) continue;
            
            final dk = p['date_operation']?.toString().substring(0, 10) ?? startDate;
            byDate[dk] ??= {'sales': 0, 'expenses': 0};
            
            if (montant > 0) byDate[dk]!['sales'] = byDate[dk]!['sales']! + montant;
            else byDate[dk]!['expenses'] = byDate[dk]!['expenses']! + montant.abs();

            final fact = p['factures'];
            final adv = p['avances_clients'];
            String clientName = 'Client';
            String info = p['moyen_reglement'] ?? '';
            String type = montant > 0 ? 'Paiement' : 'Retrait';

            if (fact is Map) {
              type = 'Vente (Caisse)';
              info = fact['bl_number'] ?? info;
              final cData = fact['clients'];
              if (cData is Map) clientName = (cData['nom'] ?? '').toString().trim();
            } else if (adv is Map) {
              type = 'Avance Client';
              info = adv['reference_paiement'] ?? info;
              final cData = adv['clients'];
              if (cData is Map) clientName = (cData['nom'] ?? '').toString().trim();
            }

            recettesList.add({
              'client': clientName,
              'type': type,
              'montant': montant,
              'info': info,
              'user': p['utilisateur'] ?? '',
              'date': p['date_operation'] ?? '',
            });
          }
          for (final f in factures) {
            final totalTtc = (f['total_ttc'] as num?)?.toDouble() ?? 0.0;
            if (totalTtc == 0) continue;
            
            final dk = f['date_facture']?.toString().substring(0, 10) ?? startDate;
            byDate[dk] ??= {'sales': 0, 'expenses': 0};
            byDate[dk]!['sales'] = byDate[dk]!['sales']! + totalTtc;
            
            String clientName = 'Client';
            final cData = f['clients'];
            if (cData is Map) clientName = (cData['nom'] ?? '').toString().trim();
            
            recettesList.add({
              'client': clientName,
              'type': 'Vente (Crédit)',
              'montant': totalTtc,
              'info': 'Crédit (${f['bl_number']})',
              'user': f['vendeur'] ?? '',
              'date': f['date_facture'] ?? '',
            });
          }
          for (final d in depenses) {
            final montant = (d['montant'] as num?)?.toDouble() ?? 0.0;
            final dk = d['date_depense']?.toString().substring(0, 10) ?? startDate;
            byDate[dk] ??= {'sales': 0, 'expenses': 0};
            byDate[dk]!['expenses'] = byDate[dk]!['expenses']! + montant;
            depensesList.add({'libelle': d['libelle'] ?? 'Dépense', 'operateur': d['operateur'] ?? '', 'montant': montant, 'date': d['date_depense'] ?? ''});
          }

          final totalRecettes = recettesList.fold(0.0, (s, r) => s + (r['montant'] as double));
          final totalDepenses = depensesList.fold(0.0, (s, d) => s + (d['montant'] as double));

          final series = byDate.entries.map((e) {
            final dt = DateTime.tryParse(e.key);
            return {'date': dt != null ? DateFormat('dd/MM').format(dt) : e.key, 'sales': e.value['sales'], 'expenses': e.value['expenses']};
          }).toList()..sort((a, b) => a['date'].toString().compareTo(b['date'].toString()));

          return {
            'summary': {
              'total_recettes': totalRecettes,
              'total_depenses': totalDepenses,
              'solde': totalRecettes - totalDepenses,
              'recettes_list': recettesList,
              'depenses_list': depensesList,
            },
            'series': series,
          };
        } catch (sbErr) {
          debugPrint('getCashReportRange Supabase fallback failed: $sbErr');
        }
      }
      return {
        'summary': {'total_recettes': 0.0, 'total_depenses': 0.0, 'solde': 0.0, 'recettes_list': [], 'depenses_list': []},
        'series': [],
      };
    }
  }

  // Helper methods for parallel report fetching
  Future<List<dynamic>> _fetchPaiementsForReport(SupabaseClient client, String target, String? vendeur) async {
    // We select payments and join with factures and advances to get client names and references
    const selectStr = 'id, montant_regle, facture_id, avance_client_id, moyen_reglement, utilisateur, date_operation, '
        'factures(bl_number, clients(nom)), '
        'avances_clients(reference_paiement, clients(nom))';

    if (vendeur == null || vendeur.isEmpty) {
      return await client
          .from('paiements')
          .select(selectStr)
          .eq('date_operation', target);
    }

    final List<dynamic> results = [];

    // 1) Payments linked to invoices: filter by invoice.vendeur (more reliable)
    try {
      final linked = await client
          .from('paiements')
          .select('$selectStr, factures!inner(vendeur)')
          .eq('date_operation', target)
          .eq('factures.vendeur', vendeur);
      results.addAll(linked);
    } catch (_) {}

    // 2) Payments without invoices or linked to other things: filter by utilisateur
    try {
      final other = await client
          .from('paiements')
          .select(selectStr)
          .eq('date_operation', target)
          .eq('utilisateur', vendeur);
      for (final row in other) {
        // Avoid duplicates if already added via linked
        if (row['facture_id'] == null || !results.any((r) => r['id'] == row['id'])) {
           results.add(row);
        }
      }
    } catch (_) {}

    return results;
  }

  Future<List<dynamic>> _fetchAdvancesForReport(SupabaseClient client, String target, String? vendeur) async {
    var q = client.from('avances_clients').select('montant_initial, client_id, utilisateur, clients(nom)').eq('date_avance', target);
    if (vendeur != null) q = q.eq('utilisateur', vendeur);
    return await q;
  }

  Future<List<dynamic>> _fetchFacturesForReport(SupabaseClient client, String target, String? vendeur) async {
    var q = client.from('factures').select('total_ttc, date_facture, montant_restant, client_id, statut, bl_number, vendeur, clients(nom)').eq('date_facture', target);
    if (vendeur != null) q = q.eq('vendeur', vendeur);
    return await q;
  }

  Future<dynamic> _fetchDepensesForReport(SupabaseClient client, String target, String? vendeur) {
    var q = client.from('depenses').select('montant, date_depense, libelle, operateur').eq('date_depense', target);
    if (vendeur != null) q = q.eq('operateur', vendeur);
    return q;
  }

  Future<List<dynamic>> getActivityLogs(String token, {String? startDate, String? endDate, String? username, String? module}) async {
    if (await _ensureSupabaseReady()) {
      final orgId = await _supabaseService.getOrganizationId();
      try {
        var q = _supabaseService.client!.from('activity_logs').select();
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        
        // Use 'timestamp' as primary, but will catch if it fails
        String timeCol = 'timestamp';
        
        if (startDate != null) q = q.gte(timeCol, startDate);
        if (endDate != null) q = q.lte(timeCol, endDate);
        
        if (username != null && username != "Tous") {
          q = q.eq('username', username);
        }
        
        if (module != null && module != "Toutes") {
          q = q.eq('entity_type', module);
        }
        
        return await q.order(timeCol, ascending: false).limit(100);
      } catch (e) {
        debugPrint('getActivityLogs with timestamp failed, trying created_at: $e');
        try {
          var q = _supabaseService.client!.from('activity_logs').select();
          if (orgId != null && orgId.isNotEmpty) {
            q = q.eq('organization_id', orgId);
          }
          if (startDate != null) q = q.gte('created_at', startDate);
          if (endDate != null) q = q.lte('created_at', endDate);
          if (username != null && username != "Tous") q = q.eq('username', username);
          if (module != null && module != "Toutes") q = q.eq('entity_type', module);
          return await q.order('created_at', ascending: false).limit(100);
        } catch (e2) {
          debugPrint('getActivityLogs fallback also failed: $e2');
          return [];
        }
      }
    }
    return [];
  }
  
  Future<Map<String, dynamic>> getCompanyInfo(String token) async {
    if (await _ensureSupabaseReady()) {
      final orgId = await _supabaseService.getOrganizationId();
      dynamic query = _supabaseService.client!.from('informations_entreprise').select();
      if (orgId != null && orgId.isNotEmpty) {
        query = query.eq('organization_id', orgId);
      }
      final data = await query.maybeSingle();
      return data ?? {};
    }
    return {};
  }

  // --- Invoice Items & Payments ---
  Future<List<dynamic>> getInvoiceItems(String invoiceId, String token) async {
    try {
      debugPrint('ApiService: START getInvoiceItems directly for $invoiceId');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      final uri = Uri.parse('$_baseUrl/api/invoices/$invoiceId');
      
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
        },
      );

      debugPrint('ApiService: getInvoiceItems response: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List rawItems = data['facture_items'] ?? [];
        
        final result = <Map<String, dynamic>>[];
        for (var item in rawItems) {
          final m = Map<String, dynamic>.from(item);
          
          // Map fields to match mobile app expectations
          m['designation'] = m['description'] ?? 'Article';
          m['quantity'] = (m['qte'] as num?)?.toInt() ?? 1;
          m['price'] = ((m['pu_ttc'] ?? m['pu_ht'] ?? 0) as num).toDouble();
          m['total'] = ((m['total_item_ttc'] ?? m['total_item_ht'] ?? 0) as num).toDouble();
          
          if (m['total'] == 0 && m['price'] > 0) {
            m['total'] = (m['price'] as double) * (m['quantity'] as int);
          }
          
          result.add(m);
        }
        return result;
      } else {
        debugPrint('ApiService: getInvoiceItems ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getInvoiceItems: $e');
      // Fallback to Supabase
      if (await _ensureSupabaseReady()) {
        try {
          debugPrint('🔍 Fetching items for invoiceId: $invoiceId (Fallback)');
          List<dynamic> items;
          try {
            items = await _supabaseService.client!
                .from('facture_items')
                .select('*, articles(designation, reference)')
                .eq('facture_id', invoiceId);
          } catch (_) {
            items = await _supabaseService.client!
                .from('facture_items')
                .select('*')
                .eq('facture_id', invoiceId);
          }
              
          final result = <Map<String, dynamic>>[];
          for (var item in items) {
            final m = Map<String, dynamic>.from(item);
            final artData = m['articles'] ?? m['article'] ?? {};
            
            String designation = '';
            if (artData is Map && (artData['designation'] ?? '').toString().isNotEmpty) {
              designation = artData['designation'];
            } else if ((m['description'] ?? '').toString().isNotEmpty) {
              designation = m['description'];
            }
            
            m['designation'] = designation.isNotEmpty ? designation : 'Article';
            m['quantity'] = (m['qte'] as num?)?.toInt() ?? 1;
            m['price'] = ((m['pu_ttc'] ?? m['pu_ht'] ?? 0) as num).toDouble();
            m['total'] = ((m['total_item_ttc'] ?? m['total_item_ht'] ?? 0) as num).toDouble();
            
            result.add(m);
          }
          return result;
        } catch (err) {
          debugPrint('❌ Fallback getInvoiceItems error: $err');
          return [];
        }
      }
      return [];
    }
  }

  Future<List<dynamic>> getInvoicePayments(String invoiceId, String token) async {
    try {
      debugPrint('ApiService: START getInvoicePayments directly for $invoiceId');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      final uri = Uri.parse('$_baseUrl/api/invoices/$invoiceId/payments');
      
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
        },
      );

      debugPrint('ApiService: getInvoicePayments response: ${response.statusCode}');

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        debugPrint('ApiService: getInvoicePayments ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getInvoicePayments: $e');
      if (await _ensureSupabaseReady()) {
        try {
          return await _supabaseService.client!
              .from('paiements')
              .select('*')
              .eq('facture_id', invoiceId)
              .order('date_operation', ascending: true);
        } catch (_) { return []; }
      }
      return [];
    }
  }

  // --- Expenses ---
  Future<void> addExpense(Map<String, dynamic> data, String token) async {
    try {
      debugPrint('ApiService: START addExpense directly');
      
      const storage = FlutterSecureStorage();
      String? secureToken = await storage.read(key: 'auth_token');
      if (secureToken == null || secureToken.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        secureToken = prefs.getString('auth_token');
      }
      
      final effectiveToken = secureToken ?? token;
      final uri = Uri.parse('$_baseUrl/api/expenses');
      
      final payload = Map<String, dynamic>.from(data);
      
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
        },
        body: json.encode(payload),
      );

      debugPrint('ApiService: addExpense response: ${response.statusCode}');

      if (response.statusCode != 200 && response.statusCode != 201) {
        debugPrint('ApiService: addExpense ERROR Body: ${response.body}');
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in addExpense: $e');
      if (await _ensureSupabaseReady()) {
        final payload = Map<String, dynamic>.from(data);
        
        final authCtx = await _getAuthContext();
        if (!(authCtx['isAdmin'] as bool)) {
          final allowedDepots = authCtx['allowedDepots'] as List<String>;
        }
        
        await _supabaseService.client!.from('depenses').insert(payload);

        // Log Activity
        await _supabaseService.logActivity(
          actionType: 'CREATE',
          entityType: 'depense',
          details: 'Dépense: ${payload['libelle']} - Montant: ${payload['montant']}',
          username: authCtx['username'] ?? 'MobileApp',
        );
      }
    }
  }

  // --- Client History ---
  Future<List<Map<String, dynamic>>> getClientInvoices(String clientId, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final data = await _supabaseService.client!
            .from('factures')
            .select()
            .eq('client_id', clientId)
            .eq('is_deleted', false)
            .order('date_facture', ascending: false);
        return List<Map<String, dynamic>>.from(data);
      } catch (e) {
        debugPrint('getClientInvoices error: $e');
        return [];
      }
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getClientPayments(String clientId, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final payments = await _supabaseService.client!
            .from('paiements')
            .select('*, factures(bl_number)')
            .eq('client_id', clientId)
            .order('date_operation', ascending: false);
        return (payments as List).map((p) {
          final m = Map<String, dynamic>.from(p);
          // Normalize keys for client_details_screen display
          m['amount'] = (m['montant_regle'] as num?)?.toDouble() ?? 0.0;
          m['date'] = m['date_operation'] ?? '';
          m['method'] = m['mode_paiement'] ?? '';
          m['bl_number'] = m['factures']?['bl_number'] ?? '';
          m['type'] = 'Paiement';
          return m;
        }).toList();
      } catch (e) {
        debugPrint('getClientPayments error: $e');
        return [];
      }
    }
    return [];
  }

  // --- Stocks ---
  Future<List<dynamic>> getStocks({String? token}) async {
    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final bool isAdmin = authCtx['isAdmin'];
        final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
        if (!isAdmin && allowedDepots.isEmpty) return [];

        var q = _supabaseService.client!
            .from('stocks')
            .select('*, articles(reference, designation)');
        if (!isAdmin) q = q.inFilter('depot_nom', allowedDepots);
        return await q.order('depot_nom');
      } catch (e) {
        debugPrint('getStocks error: $e');
        return [];
      }
    }
    return [];
  }

  // Stubs for unused but required methods
  Future<List<Map<String, dynamic>>> getWeeklySales(String token, {String? vendeur}) async {
    if (await _ensureSupabaseReady()) {
      try {
        final client = _supabaseService.client!;
        final lastWeek = DateTime.now().subtract(const Duration(days: 7));
        final startDate = DateFormat('yyyy-MM-dd').format(lastWeek);
        final authCtx = await _getAuthContext();
        final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);
        final orgId = authCtx['organizationId'] as String?;
        
        var q = client.from('factures')
            .select('date_facture, total_ttc')
            .gte('date_facture', startDate)
            .neq('statut', 'Annulée')
            .or('is_deleted.eq.false,is_deleted.is.null');
            
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        if (effectiveVendeur != null) {
          q = q.eq('vendeur', effectiveVendeur);
        }
        
        final res = await q.order('date_facture');

        final Map<String, double> grouped = {};
        for (var f in (res as List)) {
          final rawDate = f['date_facture']?.toString() ?? '';
          if (rawDate.isEmpty) continue;
          final dateStr = rawDate.split('T')[0].split(' ')[0];
          DateTime? date;
          try {
            date = DateFormat('yyyy-MM-dd').parse(dateStr);
          } catch (_) {
            date = DateTime.tryParse(rawDate);
          }
          if (date == null) continue;
          final dayName = DateFormat('dd/MM').format(date); // Use dd/MM to match screenshot
          
          final amt = (f['total_ttc'] as num?)?.toDouble() ?? 0.0;
          grouped[dayName] = (grouped[dayName] ?? 0.0) + amt;
        }

        // Return a list of the last 7 days to ensure chart is not empty even if no sales
        final result = <Map<String, dynamic>>[];
        for (int i = 6; i >= 0; i--) {
          final date = DateTime.now().subtract(Duration(days: i));
          final dayName = DateFormat('dd/MM').format(date);
          result.add({
            'date': dayName,
            'total': grouped[dayName] ?? 0.0,
          });
        }
        return result;
      } catch (e) {
        debugPrint('getWeeklySales error: $e');
      }
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getTopProducts(String token, {String? vendeur}) async {
    if (await _ensureSupabaseReady()) {
      try {
        final client = _supabaseService.client!;
        final authCtx = await _getAuthContext();
        final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);
        final orgId = authCtx['organizationId'] as String?;
        
        var q = client.from('facture_items')
            .select('description, qte, total_item_ttc, factures!inner(vendeur, organization_id, is_deleted, statut)')
            .neq('factures.statut', 'Annulée')
            .or('factures.is_deleted.eq.false,factures.is_deleted.is.null');
        
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('factures.organization_id', orgId);
        }
        if (effectiveVendeur != null) {
          q = q.eq('factures.vendeur', effectiveVendeur);
        }
        
        final res = await q.limit(200);

        final Map<String, Map<String, dynamic>> products = {};
        for (var item in (res as List)) {
          final name = item['description'] ?? 'Inconnu';
          if (name == 'Détails non disponibles' || name.isEmpty) continue;
          
          final qte = (item['qte'] as num?)?.toDouble() ?? 0.0;
          final totalAmt = (item['total_item_ttc'] as num?)?.toDouble() ?? 0.0;

          if (!products.containsKey(name)) {
            products[name] = {'name': name, 'total': 0.0, 'quantity': 0.0, 'revenue': 0.0};
          }
          products[name]!['total'] += totalAmt;
          products[name]!['revenue'] += totalAmt;
          products[name]!['quantity'] += qte;
        }

        final list = products.values.toList();
        list.sort((a, b) => (b['total'] as double).compareTo(a['total'] as double));
        return list.take(5).toList();
      } catch (e) {
        debugPrint('getTopProducts error: $e');
      }
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getLowStock(String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final isAdmin = authCtx['isAdmin'] as bool;
        final userId = authCtx['userId'] as String?;
        final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);

        final articles = await _supabaseService.getArticlesWithStocks(
          userId: isAdmin ? null : userId,
          allowedDepots: isAdmin ? null : allowedDepots,
          isAdmin: isAdmin,
        );
        final lowStock = (articles as List).where((a) {
          final qte = (a['quantite'] as num?)?.toDouble() ?? 0.0;
          final min = (a['qte_min'] as num?)?.toDouble() ?? 0.0;
          return qte <= min && min > 0;
        }).take(10).toList();

        return lowStock.map((a) => {
          'name': a['designation'] ?? 'Inconnu',
          'current_stock': (a['quantite'] as num?)?.toDouble() ?? 0.0,
          'min_stock': (a['qte_min'] as num?)?.toDouble() ?? 0.0,
        }).toList();
      } catch (e) {
        debugPrint('getLowStock error: $e');
      }
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getTopClients(String token, {String? vendeur}) async {
    if (await _ensureSupabaseReady()) {
      try {
        final client = _supabaseService.client!;
        final authCtx = await _getAuthContext();
        final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);
        final orgId = authCtx['organizationId'] as String?;
        var q = client.from('factures')
            .select('total_ttc, clients(nom)')
            .neq('statut', 'Annulée')
            .or('is_deleted.eq.false,is_deleted.is.null');
            
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        if (effectiveVendeur != null) {
          q = q.eq('vendeur', effectiveVendeur);
        }
        
        final res = await q.limit(200);

        final Map<String, double> clients = {};
        for (var f in (res as List)) {
          final name = f['clients']?['nom'] ?? 'Client Divers';
          final amt = (f['total_ttc'] as num?)?.toDouble() ?? 0.0;
          clients[name] = (clients[name] ?? 0.0) + amt;
        }

        final list = clients.entries.map((e) => {'name': e.key, 'total': e.value}).toList();
        list.sort((a, b) => (b['total'] as double).compareTo(a['total'] as double));
        return list.take(5).toList();
      } catch (e) {
        debugPrint('getTopClients error: $e');
      }
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getSalesVsExpenses(String token, {String? vendeur}) async {
    if (await _ensureSupabaseReady()) {
      try {
        final client = _supabaseService.client!;
        final lastMonth = DateTime.now().subtract(const Duration(days: 30));
        final startDate = DateFormat('yyyy-MM-dd').format(lastMonth);
        final authCtx = await _getAuthContext();
        final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);
        final orgId = authCtx['organizationId'] as String?;

        // Fetch sales
        var sq = client.from('factures')
            .select('date_facture, total_ttc')
            .gte('date_facture', startDate)
            .neq('statut', 'Annulée')
            .or('is_deleted.eq.false,is_deleted.is.null');
            
        if (orgId != null && orgId.isNotEmpty) {
          sq = sq.eq('organization_id', orgId);
        }
        if (effectiveVendeur != null) {
          sq = sq.eq('vendeur', effectiveVendeur);
        }
        
        final salesRes = await sq;

        // Fetch expenses
        var eq = client.from('depenses')
            .select('date_depense, montant')
            .gte('date_depense', startDate);
            
        if (orgId != null && orgId.isNotEmpty) {
          eq = eq.eq('organization_id', orgId);
        }
        if (effectiveVendeur != null) {
          eq = eq.eq('operateur', effectiveVendeur);
        }
        
        final expensesRes = await eq;

        final Map<String, Map<String, double>> grouped = {};
        
        for (var f in (salesRes as List)) {
          final date = (f['date_facture'] as String).substring(0, 10);
          final amt = (f['total_ttc'] as num?)?.toDouble() ?? 0.0;
          if (!grouped.containsKey(date)) grouped[date] = {'sales': 0.0, 'expenses': 0.0};
          grouped[date]!['sales'] = (grouped[date]!['sales'] ?? 0.0) + amt;
        }

        for (var d in (expensesRes as List)) {
          final date = (d['date_depense'] as String).substring(0, 10);
          final amt = (d['montant'] as num?)?.toDouble() ?? 0.0;
          if (!grouped.containsKey(date)) grouped[date] = {'sales': 0.0, 'expenses': 0.0};
          grouped[date]!['expenses'] = (grouped[date]!['expenses'] ?? 0.0) + amt;
        }

        final sortedDates = grouped.keys.toList()..sort();
        return sortedDates.map((date) => {
          'date': date,
          'sales': grouped[date]!['sales'],
          'expenses': grouped[date]!['expenses'],
        }).toList();
      } catch (e) {
        debugPrint('getSalesVsExpenses error: $e');
      }
    }
    return [];
  }

  Future<double?> getHistoricalPrice(String articleId, String date) async {
    if (await _ensureSupabaseReady()) {
      try {
        final res = await _supabaseService.client!
            .from('prix_histoire')
            .select('p_vente_ht')
            .eq('article_id', articleId)
            .lte('date_changement', date)
            .order('date_changement', ascending: false)
            .limit(1)
            .maybeSingle();
        if (res != null) return (res['p_vente_ht'] as num).toDouble();
      } catch (e) {
        debugPrint('getHistoricalPrice error: $e');
      }
    }
    return null;
  }

  // ─── Rent Management (Gestion des Loyers) ───

  List<dynamic> _calculateContractsWithStats(List<dynamic> contracts, List<dynamic> payments) {
    final Map<int, double> totals = {};
    final Map<int, DateTime> latestPaymentDates = {};

    for (var p in payments) {
      final int cId = p['contrat_id'] is int ? p['contrat_id'] : int.parse(p['contrat_id'].toString());
      final double amt = (p['montant'] ?? 0.0).toDouble();
      totals[cId] = (totals[cId] ?? 0.0) + amt;

      final pDateStr = p['periode_fin'] ?? p['date_paiement'];
      if (pDateStr != null) {
        final pDate = DateTime.tryParse(pDateStr.toString());
        if (pDate != null) {
          if (latestPaymentDates[cId] == null || pDate.isAfter(latestPaymentDates[cId]!)) {
            latestPaymentDates[cId] = pDate;
          }
        }
      }
    }

    return contracts.map((c) {
      final m = Map<String, dynamic>.from(c);
      final int id = m['id'] is int ? m['id'] : int.parse(m['id'].toString());
      final double paid = totals[id] ?? 0.0;

      final bool isInactive = m['statut'] == "Expiré" || m['statut'] == "Annulé";
      final today = isInactive && m['updated_at'] != null
          ? DateTime.tryParse(m['updated_at'].toString()) ?? DateTime.now()
          : DateTime.now();
      final currentYearReal = today.year;
      final currentMonthReal = today.month;

      final int startYear = m['annee_debut'] != null
          ? (m['annee_debut'] is int ? m['annee_debut'] : int.parse(m['annee_debut'].toString()))
          : 2024;
      final int startMonth = m['mois_debut'] != null
          ? (m['mois_debut'] is int ? m['mois_debut'] : int.parse(m['mois_debut'].toString()))
          : 1;

      final double loyerMensuel = (m['loyer_mensuel'] ?? 0.0).toDouble();

      final int totalMonthsExpected = (currentYearReal - startYear) * 12 + (currentMonthReal - startMonth + 1);
      final int monthsPaid = loyerMensuel > 0 ? (paid / loyerMensuel).floor() : 0;
      final int unpaidMonthsCount = (totalMonthsExpected - monthsPaid).clamp(0, 999999);
      final double retards = unpaidMonthsCount * loyerMensuel;

      String moisImpayes = "À jour";
      if (unpaidMonthsCount > 0) {
        final Map<int, int> unpaidYears = {};
        int currentYearIter = startYear;
        int currentMonthIter = startMonth;
        int monthsToSkip = monthsPaid;
        int remainingToCount = unpaidMonthsCount;

        while (remainingToCount > 0) {
          if (monthsToSkip > 0) {
            monthsToSkip--;
          } else {
            unpaidYears[currentYearIter] = (unpaidYears[currentYearIter] ?? 0) + 1;
            remainingToCount--;
          }

          currentMonthIter++;
          if (currentMonthIter > 12) {
            currentMonthIter = 1;
            currentYearIter++;
          }

          if (currentYearIter > currentYearReal + 5) break;
        }

        moisImpayes = unpaidYears.entries
            .map((e) => "${e.key}: ${e.value}m")
            .join(", ");
      }

      String echeance = "N/A";
      final lastPayDate = latestPaymentDates[id];
      if (lastPayDate != null) {
        final nextMonth = DateTime(lastPayDate.year, lastPayDate.month + 1, 1);
        echeance = DateFormat('dd/MM/yyyy').format(nextMonth);
      } else {
        final start = DateTime(startYear, startMonth, 1);
        echeance = DateFormat('dd/MM/yyyy').format(start);
      }

      m['total_paye'] = paid;
      m['retards'] = retards;
      m['mois_impayes'] = moisImpayes;
      m['echeance'] = echeance;

      return m;
    }).toList();
  }

  Future<List<dynamic>> getContracts(String token, {bool forceRefresh = false}) async {
    final effectiveToken = await _getEffectiveToken(token);
    final authCtx = await _getAuthContext();
    final orgId = authCtx['organizationId'] as String?;

    try {
      final uri = Uri.parse('$_baseUrl/api/loyers');
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

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: getContracts fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        try {
          var cq = _supabaseService.client!
              .from('contrats')
              .select('*')
              .or('is_deleted.eq.false,is_deleted.is.null');
          if (orgId != null && orgId.isNotEmpty) {
            cq = cq.eq('organization_id', orgId);
          }
          final contracts = await cq.order('id', ascending: false);

          final payments = await _supabaseService.client!
              .from('contrat_paiements')
              .select('contrat_id, montant, date_paiement, periode_fin');

          return _calculateContractsWithStats(contracts, payments);
        } catch (sbErr) {
          debugPrint('ApiService: Supabase Contracts error: $sbErr');
          return [];
        }
      }
      return [];
    }
  }

  Future<Map<String, dynamic>?> getContractDetails(int id, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/loyers/$id');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        return json.decode(response.body) as Map<String, dynamic>;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: getContractDetails fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        try {
          final contract = await _supabaseService.client!
              .from('contrats')
              .select('*')
              .eq('id', id)
              .single();
          
          final payments = await _supabaseService.client!
              .from('contrat_paiements')
              .select('contrat_id, montant, date_paiement, periode_fin')
              .eq('contrat_id', id);

          final calculatedList = _calculateContractsWithStats([contract], payments);
          if (calculatedList.isNotEmpty) {
            return calculatedList.first;
          }
        } catch (sbErr) {
          debugPrint('ApiService: Supabase Contract details error: $sbErr');
        }
      }
      return null;
    }
  }

  Future<void> addContract(Map<String, dynamic> data, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/loyers');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode(data),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 201) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: addContract fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        final payload = Map<String, dynamic>.from(data);
        if (payload['loyer_mensuel'] != null) {
          payload['loyer_mensuel'] = double.tryParse(payload['loyer_mensuel'].toString()) ?? 0.0;
        }
        if (payload['caution'] != null) {
          payload['caution'] = double.tryParse(payload['caution'].toString()) ?? 0.0;
        }
        final authCtx = await _getAuthContext();
        payload['created_at'] = DateTime.now().toIso8601String();
        payload['is_deleted'] = false;
        if (authCtx['organizationId'] != null) {
          payload['organization_id'] = authCtx['organizationId'];
        }
        
        await _supabaseService.client!.from('contrats').insert(payload);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }

  Future<void> updateContract(int id, Map<String, dynamic> data, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/loyers/$id');
      final response = await http.put(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode(data),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: updateContract fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        final payload = Map<String, dynamic>.from(data);
        if (payload['loyer_mensuel'] != null) {
          payload['loyer_mensuel'] = double.tryParse(payload['loyer_mensuel'].toString()) ?? 0.0;
        }
        if (payload['caution'] != null) {
          payload['caution'] = double.tryParse(payload['caution'].toString()) ?? 0.0;
        }
        payload['updated_at'] = DateTime.now().toIso8601String();
        
        await _supabaseService.client!.from('contrats').update(payload).eq('id', id);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }

  Future<void> deleteContract(int id, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/loyers/$id');
      final response = await http.delete(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: deleteContract fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        await _supabaseService.client!
            .from('contrats')
            .update({'is_deleted': true, 'deleted_at': DateTime.now().toIso8601String()})
            .eq('id', id);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }

  Future<List<dynamic>> getRentPayments(String token, {Map<String, String>? filters}) async {
    final effectiveToken = await _getEffectiveToken(token);
    final authCtx = await _getAuthContext();
    final orgId = authCtx['organizationId'] as String?;

    try {
      final Map<String, String> queryParams = {};
      if (filters != null) {
        queryParams.addAll(filters);
      }
      final queryString = queryParams.isNotEmpty ? '?' + queryParams.entries.map((e) => '${e.key}=${e.value}').join('&') : '';
      final uri = Uri.parse('$_baseUrl/api/loyers/payments$queryString');
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

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: getRentPayments fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        try {
          var query = _supabaseService.client!
              .from('contrat_paiements')
              .select('''
                id, date_paiement, montant, mode_paiement, nom_de_mois,
                qte_mois, periode_debut, periode_fin, description,
                contrat_id,
                contrats!inner (
                  locataire_nom_complet,
                  bien_loue_details,
                  ref_locataire,
                  organization_id
                )
              ''');

          if (orgId != null && orgId.isNotEmpty) {
            query = query.eq('contrats.organization_id', orgId);
          }

          if (filters != null) {
            final locataire = filters['locataire'];
            final mois = filters['mois'];
            final mode = filters['mode'];
            final startDate = filters['start_date'];
            final endDate = filters['end_date'];

            if (locataire != null && locataire.isNotEmpty) {
              query = query.ilike('contrats.locataire_nom_complet', '%$locataire%');
            }
            if (mois != null && mois.isNotEmpty) {
              query = query.ilike('nom_de_mois', '%$mois%');
            }
            if (mode != null && mode.isNotEmpty && mode != 'Tous') {
              query = query.eq('mode_paiement', mode);
            }
            if (startDate != null && startDate.isNotEmpty) {
              query = query.gte('date_paiement', startDate);
            }
            if (endDate != null && endDate.isNotEmpty) {
              query = query.lte('date_paiement', endDate);
            }
          }

          final data = await query.order('id', ascending: false);

          return (data as List).map((row) => {
            'id': row['id'],
            'contrat_id': row['contrat_id'],
            'date_paiement': row['date_paiement'],
            'montant': row['montant'],
            'mode_paiement': row['mode_paiement'],
            'nom_de_mois': row['nom_de_mois'],
            'qte_mois': row['qte_mois'],
            'periode_debut': row['periode_debut'],
            'periode_fin': row['periode_fin'],
            'description': row['description'],
            'locataire_nom_complet': row['contrats']?['locataire_nom_complet'],
            'bien_loue_details': row['contrats']?['bien_loue_details'],
            'ref_locataire': row['contrats']?['ref_locataire'],
          }).toList();
        } catch (sbErr) {
          debugPrint('ApiService: Supabase Payments error: $sbErr');
          return [];
        }
      }
      return [];
    }
  }

  Future<List<dynamic>> getRentPaymentsForContract(int contractId, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/loyers/$contractId/payments');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: getRentPaymentsForContract fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        try {
          return await _supabaseService.client!
              .from('contrat_paiements')
              .select('*')
              .eq('contrat_id', contractId)
              .order('id', ascending: false);
        } catch (sbErr) {
          debugPrint('ApiService: Supabase Contract Payments error: $sbErr');
          return [];
        }
      }
      return [];
    }
  }

  Future<void> addRentPayment(int contractId, Map<String, dynamic> data, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/loyers/$contractId/payments');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode(data),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 201) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: addRentPayment fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        final payload = Map<String, dynamic>.from(data);
        payload['contrat_id'] = contractId;
        if (payload['montant'] != null) {
          payload['montant'] = double.tryParse(payload['montant'].toString()) ?? 0.0;
        }
        if (payload['qte_mois'] != null) {
          payload['qte_mois'] = int.tryParse(payload['qte_mois'].toString()) ?? 1;
        }
        payload['created_at'] = DateTime.now().toIso8601String();
        
        await _supabaseService.client!.from('contrat_paiements').insert(payload);
        await _supabaseService.client!.from('contrats').update({'statut': 'Actif'}).eq('id', contractId);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }

  Future<void> deleteRentPayment(int paymentId, String token) async {
    try {
      if (await _ensureSupabaseReady()) {
        await _supabaseService.client!
            .from('contrat_paiements')
            .delete()
            .eq('id', paymentId);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    } catch (e) {
      debugPrint('ApiService: deleteRentPayment error: $e');
      rethrow;
    }
  }

  // ─── Cement Management (Gestion de Ciment) ───

  Future<List<dynamic>> getCimentShipments(String token, {Map<String, String>? filters}) async {
    final effectiveToken = await _getEffectiveToken(token);
    final authCtx = await _getAuthContext();
    final orgId = authCtx['organizationId'] as String?;

    try {
      final Map<String, String> queryParams = {};
      if (filters != null) queryParams.addAll(filters);
      final queryString = queryParams.isNotEmpty ? '?' + queryParams.entries.map((e) => '${e.key}=${e.value}').join('&') : '';
      final uri = Uri.parse('$_baseUrl/api/ciment/shipments$queryString');
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

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: getCimentShipments fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        try {
          var query = _supabaseService.client!
              .from('gestion_ciment')
              .select('*');

          if (orgId != null && orgId.isNotEmpty) {
            query = query.eq('organization_id', orgId);
          }

          if (filters != null) {
            final clientTel = filters['client_tel'];
            final camionNo = filters['camion_no'];
            final startDate = filters['startDate'];
            final endDate = filters['endDate'];

            if (clientTel != null && clientTel.isNotEmpty) {
              query = query.ilike('client_tel', '%$clientTel%');
            }
            if (camionNo != null && camionNo.isNotEmpty) {
              query = query.ilike('camion_no', '%$camionNo%');
            }
            if (startDate != null && startDate.isNotEmpty) {
              query = query.gte('created_at', startDate);
            }
            if (endDate != null && endDate.isNotEmpty) {
              final endDateTime = endDate.contains('T') ? endDate : '${endDate}T23:59:59Z';
              query = query.lte('created_at', endDateTime);
            }
          }

          final data = await query.order('created_at', ascending: false);
          return data as List<dynamic>;
        } catch (sbErr) {
          debugPrint('ApiService: Supabase Ciment Shipments error: $sbErr');
          return [];
        }
      }
      return [];
    }
  }

  Future<void> addCimentShipment(Map<String, dynamic> data, String token) async {
    final effectiveToken = await _getEffectiveToken(token);
    final authCtx = await _getAuthContext();
    final orgId = authCtx['organizationId'] as String?;

    try {
      final uri = Uri.parse('$_baseUrl/api/ciment/shipments');
      final headers = <String, String>{
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $effectiveToken',
      };
      if (orgId != null && orgId.isNotEmpty) {
        headers['x-organization-id'] = orgId;
      }
      final response = await http.post(
        uri,
        headers: headers,
        body: json.encode(data),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 201 && response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: addCimentShipment fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        final payload = Map<String, dynamic>.from(data);
        final ton = double.tryParse(payload['tonnage'].toString()) ?? 0.0;
        final price = double.tryParse(payload['pu'].toString()) ?? 0.0;
        final fCiment = double.tryParse(payload['frais_ciment']?.toString() ?? '0') ?? 0.0;
        final fTransport = double.tryParse(payload['frais_transport']?.toString() ?? '0') ?? 0.0;
        final tvaP = double.tryParse(payload['tva_pourcentage']?.toString() ?? '19') ?? 19.0;
        final bicP = double.tryParse(payload['bic_pourcentage']?.toString() ?? '2') ?? 2.0;

        final base = (ton * price) + fCiment + fTransport;
        final tva = base * tvaP / 100.0;
        final bic = base * bicP / 100.0;
        final total = base + tva + bic;

        payload['tonnage'] = ton;
        payload['pu'] = price;
        payload['frais_ciment'] = fCiment;
        payload['frais_transport'] = fTransport;
        payload['tva_pourcentage'] = tvaP;
        payload['bic_pourcentage'] = bicP;
        payload['total'] = total;
        payload['utilisateur'] = authCtx['username'] ?? 'MobileApp';
        payload['user_id'] = authCtx['userId'];
        if (orgId != null && orgId.isNotEmpty) {
          payload['organization_id'] = orgId;
        }
        payload['created_at'] = DateTime.now().toIso8601String();
        payload['updated_at'] = DateTime.now().toIso8601String();
        payload['montant_paye'] = 0.0;
        payload['statut_paiement'] = "Non Payé";

        payload.remove('id'); // Ensure DB generates UUID

        await _supabaseService.client!.from('gestion_ciment').insert(payload);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }

  Future<void> updateCimentShipment(String id, Map<String, dynamic> data, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/ciment/shipments');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({...data, 'id': id}),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: updateCimentShipment fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        final payload = Map<String, dynamic>.from(data);
        final ton = double.tryParse(payload['tonnage'].toString()) ?? 0.0;
        final price = double.tryParse(payload['pu'].toString()) ?? 0.0;
        final fCiment = double.tryParse(payload['frais_ciment']?.toString() ?? '0') ?? 0.0;
        final fTransport = double.tryParse(payload['frais_transport']?.toString() ?? '0') ?? 0.0;
        final tvaP = double.tryParse(payload['tva_pourcentage']?.toString() ?? '19') ?? 19.0;
        final bicP = double.tryParse(payload['bic_pourcentage']?.toString() ?? '2') ?? 2.0;

        final base = (ton * price) + fCiment + fTransport;
        final tva = base * tvaP / 100.0;
        final bic = base * bicP / 100.0;
        final total = base + tva + bic;

        payload['tonnage'] = ton;
        payload['pu'] = price;
        payload['frais_ciment'] = fCiment;
        payload['frais_transport'] = fTransport;
        payload['tva_pourcentage'] = tvaP;
        payload['bic_pourcentage'] = bicP;
        payload['total'] = total;
        payload['updated_at'] = DateTime.now().toIso8601String();

        payload.remove('id');
        payload.remove('created_at');
        payload.remove('montant_paye');
        payload.remove('statut_paiement');

        await _supabaseService.client!.from('gestion_ciment').update(payload).eq('id', id);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }

  Future<void> deleteCimentShipment(String id, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/ciment/shipments/$id');
      final response = await http.delete(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: deleteCimentShipment fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        await _supabaseService.client!.from('gestion_ciment').delete().eq('id', id);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }

  Future<List<dynamic>> getCimentPayments(String shipmentId, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/ciment/payments?shipmentId=$shipmentId');
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: getCimentPayments fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        try {
          final data = await _supabaseService.client!
              .from('ciment_paiements')
              .select('*')
              .eq('ciment_id', shipmentId)
              .order('date_paiement', ascending: false);
          return data as List<dynamic>;
        } catch (sbErr) {
          debugPrint('ApiService: Supabase Ciment Payments error: $sbErr');
          return [];
        }
      }
      return [];
    }
  }

  Future<void> addCimentPayment(String shipmentId, Map<String, dynamic> data, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/ciment/payments');
      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: json.encode({...data, 'shipmentId': shipmentId}),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: addCimentPayment fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        final amount = double.tryParse(data['montant'].toString()) ?? 0.0;
        final moyen = data['moyen'] ?? 'Espèces';
        final reference = data['reference'] ?? '';
        final datePay = DateTime.now().toIso8601String().split('T')[0];
        final paymentId = const Uuid().v4();

        final authCtx = await _getAuthContext();
        final username = authCtx['username'] ?? 'MobileApp';
        final userId = authCtx['userId'];

        // Recalculate remaining balance before adding
        final shipRow = await _supabaseService.client!
            .from('gestion_ciment')
            .select('total, montant_paye')
            .eq('id', shipmentId)
            .single();
        final double totalShipment = (double.tryParse(shipRow['total'].toString()) ?? 0.0);
        final double alreadyPaid = (double.tryParse(shipRow['montant_paye'].toString()) ?? 0.0);
        final double remainder = totalShipment - alreadyPaid;

        if (amount > remainder + 0.1) {
          throw Exception("Le montant du paiement (${amount.toInt()} F) dépasse le reste à payer (${remainder.toInt()} F).");
        }


        if (moyen == "Avance Client") {
          // 1. Get client tel from shipment
          final shipmentRow = await _supabaseService.client!
              .from('gestion_ciment')
              .select('client_tel')
              .eq('id', shipmentId)
              .single();
          final clientTel = shipmentRow['client_tel'] as String;

          // 2. Get client ID
          final clientRow = await _supabaseService.client!
              .from('clients')
              .select('id')
              .or('tel.eq.$clientTel,nom.eq.$clientTel')
              .limit(1)
              .single();
          final clientId = clientRow['id'];

          // 3. Get available advances
          final List<dynamic> advances = await _supabaseService.client!
              .from('avances_clients')
              .select('id, montant_restant, montant_initial')
              .eq('client_id', clientId)
              .inFilter('statut', ['Disponible', 'Partiellement utilisée'])
              .order('date_avance', ascending: true);

          double totalAvailable = advances.fold(0.0, (sum, a) => sum + (double.tryParse(a['montant_restant'].toString()) ?? 0.0));
          if (totalAvailable < amount) {
            throw Exception('Solde insuffisant. Disponible: ${totalAvailable.toInt()} FCFA');
          }

          // 4. Deduct advances sequentially
          double remainingToPay = amount;
          for (var adv in advances) {
            if (remainingToPay <= 0) break;

            final double advRem = (double.tryParse(adv['montant_restant'].toString()) ?? 0.0);
            final double deduct = remainingToPay < advRem ? remainingToPay : advRem;
            final double newRem = double.parse((advRem - deduct).toStringAsFixed(2));
            final String newStat = newRem <= 0 ? 'Utilisée' : 'Partiellement utilisée';

            // Update advance
            await _supabaseService.client!
                .from('avances_clients')
                .update({'montant_restant': newRem, 'statut': newStat})
                .eq('id', adv['id']);

            // Log usage
            final usageId = const Uuid().v4();
            await _supabaseService.client!
                .from('paiements')
                .insert({
                  'id': usageId,
                  'avance_client_id': adv['id'],
                  'date_operation': datePay,
                  'montant_regle': deduct,
                  'moyen_reglement': 'Usage',
                  'reference_paiement': 'CIM-PAY-${paymentId.substring(0, 8)}',
                  'utilisateur': username,
                  'notes': 'Paiement Chargement Ciment ID: $shipmentId'
                });

            remainingToPay -= deduct;
          }
        }

        // Insert ciment_paiements
        await _supabaseService.client!
            .from('ciment_paiements')
            .insert({
              'id': paymentId,
              'ciment_id': shipmentId,
              'date_paiement': datePay,
              'montant': amount,
              'moyen_paiement': moyen,
              'reference': reference,
              'utilisateur': username,
              'user_id': userId,
              'created_at': DateTime.now().toIso8601String()
            });

        // Recalculate totals
        final List<dynamic> allPays = await _supabaseService.client!
            .from('ciment_paiements')
            .select('montant')
            .eq('ciment_id', shipmentId);
        
        final double totalPaid = allPays.fold(0.0, (sum, p) => sum + (double.tryParse(p['montant'].toString()) ?? 0.0));

        String status = 'Non Payé';
        if (totalPaid >= totalShipment) status = 'Payé';
        else if (totalPaid > 0) status = 'Partiel';

        await _supabaseService.client!
            .from('gestion_ciment')
            .update({'montant_paye': totalPaid, 'statut_paiement': status})
            .eq('id', shipmentId);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }

  Future<void> deleteCimentPayment(String paymentId, String token) async {
    try {
      final uri = Uri.parse('$_baseUrl/api/ciment/payments/$paymentId');
      final response = await http.delete(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode != 200) {
        throw Exception('HTTP ${response.statusCode}: ${response.body}');
      }
    } catch (e) {
      debugPrint('ApiService: deleteCimentPayment fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        // 1. Get payment details
        final payData = await _supabaseService.client!
            .from('ciment_paiements')
            .select('*')
            .eq('id', paymentId)
            .single();
        
        final String shipmentId = payData['ciment_id'].toString();
        final String moyen = payData['moyen_paiement'].toString();

        // 2. Rollback Avance Client if needed
        if (moyen == "Avance Client") {
          final String refNew = "CIM-PAY-${paymentId.substring(0, 8)}";
          final String refOld = "PAY-CIMENT-${shipmentId.substring(0, 8)}";

          final List<dynamic> usages = await _supabaseService.client!
              .from('paiements')
              .select('id, avance_client_id, montant_regle')
              .inFilter('reference_paiement', [refNew, refOld])
              .ilike('notes', '%$shipmentId%');

          for (var u in usages) {
            final double uMnt = (double.tryParse(u['montant_regle'].toString()) ?? 0.0);
            final String advId = u['avance_client_id'].toString();

            // Get current advance state
            final adv = await _supabaseService.client!
                .from('avances_clients')
                .select('montant_restant, montant_initial')
                .eq('id', advId)
                .single();
            
            final double advRem = (double.tryParse(adv['montant_restant'].toString()) ?? 0.0);
            final double advInit = (double.tryParse(adv['montant_initial'].toString()) ?? 0.0);
            final double newRem = double.parse((advRem + uMnt).toStringAsFixed(2));
            final String newStat = newRem >= advInit ? "Disponible" : "Partiellement utilisée";

            // Refund
            await _supabaseService.client!
                .from('avances_clients')
                .update({'montant_restant': newRem, 'statut': newStat})
                .eq('id', advId);

            // Delete usage log
            await _supabaseService.client!.from('paiements').delete().eq('id', u['id']);
          }
        }

        // 3. Delete from ciment_paiements
        await _supabaseService.client!.from('ciment_paiements').delete().eq('id', paymentId);

        // 4. Recalculate Shipment totals
        final List<dynamic> allPays = await _supabaseService.client!
            .from('ciment_paiements')
            .select('montant')
            .eq('ciment_id', shipmentId);
        final double totalPaid = allPays.fold(0.0, (sum, p) => sum + (double.tryParse(p['montant'].toString()) ?? 0.0));

        final shipRow = await _supabaseService.client!
            .from('gestion_ciment')
            .select('total')
            .eq('id', shipmentId)
            .single();
        final double totalShipment = (double.tryParse(shipRow['total'].toString()) ?? 0.0);

        String status = "Non Payé";
        if (totalPaid >= totalShipment) status = "Payé";
        else if (totalPaid > 0) status = "Partiel";

        await _supabaseService.client!
            .from('gestion_ciment')
            .update({'montant_paye': totalPaid, 'statut_paiement': status})
            .eq('id', shipmentId);
      } else {
        throw Exception('Impossible de se connecter au Cloud.');
      }
    }
  }
}
