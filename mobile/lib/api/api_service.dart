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
import '../services/offline_queue_service.dart';
import 'services/client_service.dart';
import 'services/stock_service.dart';
import 'services/sales_service.dart';
import 'services/expenses_service.dart';
import 'services/article_service.dart';
import 'services/auth_service.dart';
import 'services/purchase_service.dart';
import 'services/rent_service.dart';
import 'services/ciment_service.dart';

class ApiService {
  final SupabaseService _supabaseService = SupabaseService();
  final ClientService _clientService = ClientService();
  final StockService _stockService = StockService();
  final SalesService _salesService = SalesService();
  final ExpensesService _expensesService = ExpensesService();
  final ArticleService _articleService = ArticleService();
  final AuthService _authService = AuthService();
  final PurchaseService _purchaseService = PurchaseService();
  final RentService _rentService = RentService();
  final CimentService _cimentService = CimentService();
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

  // --- Auth & Session ---
  Future<String> _getEffectiveToken(String token) async {
    return await _authService.getEffectiveToken(token);
  }

  Future<Map<String, dynamic>> _getAuthContext({bool refresh = false}) async {
    return await _authService.getAuthContext(refresh: refresh);
  }

  Future<List<String>> refreshUserDepots({bool force = false}) async {
    return await _authService.refreshUserDepots(force: force);
  }

  Future<Map<String, dynamic>> login(String username, String password) async {
    return await _authService.login(username, password);
  }

  Future<void> _requireAdmin() async {
    await _authService.requireAdmin();
  }

  String? _effectiveVendeur(Map<String, dynamic> authCtx, String? requested) {
    final isAdmin = authCtx['isAdmin'] as bool;
    if (isAdmin) return requested;
    return (authCtx['username'] as String?) ?? requested;
  }

  List<String> _normalizeDepotNames(List<String> depots) {
    return depots.map((d) => d.trim()).where((d) => d.isNotEmpty).toSet().toList();
  }

  List<String> _parseDepotString(String? depots) {
    if (depots == null || depots.trim().isEmpty) return [];
    return depots.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toSet().toList();
  }

  Future<List<String>> _fetchAllActiveDepots() async {
    return await _stockService.fetchAllActiveDepots();
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

  // --- Articles ---
  Future<List<dynamic>> getArticles(
    String token, {
    bool forceRefresh = false,
    int? page,
    int? pageSize,
    String? search,
    String? userId,
    List<String>? allowedDepots,
    bool isAdmin = false,
  }) async {
    return await _articleService.getArticles(
      token,
      forceRefresh: forceRefresh,
      page: page,
      pageSize: pageSize,
      search: search,
      userId: userId,
      allowedDepots: allowedDepots,
      isAdmin: isAdmin,
    );
  }

  Future<void> addArticleWithImage(Map<String, String> fields, dynamic imageFile, String token) async {
    await _articleService.addArticleWithImage(fields, imageFile, token);
  }

  Future<bool> updateArticle(String id, Map<String, dynamic> data, String token) async {
    return await _articleService.updateArticle(id, data, token);
  }

  Future<bool> deleteArticle(String id, String token) async {
    return await _articleService.deleteArticle(id, token);
  }

  // --- Clients ---
  Future<List<dynamic>> getClients(String token, {bool forceRefresh = false}) async {
    return await _clientService.getClients(token, forceRefresh: forceRefresh);
  }

  Future<bool> createClientFull(Map<String, dynamic> clientData, String token) async {
    return await _clientService.createClientFull(clientData, token);
  }

  Future<List<Map<String, dynamic>>> getClientInvoices(String clientId, String token) async {
    return await _clientService.getClientInvoices(clientId, token);
  }

  Future<List<Map<String, dynamic>>> getClientPayments(String clientId, String token) async {
    return await _clientService.getClientPayments(clientId, token);
  }

  // --- Invoices & Sales ---
  Future<List<dynamic>> getInvoices(String token, {bool forceRefresh = false, String? vendeur, int? page, int? pageSize, String? search}) async {
    return await _salesService.getInvoices(token, forceRefresh: forceRefresh, vendeur: vendeur, page: page, pageSize: pageSize, search: search);
  }

  // --- Depots & Stock ---
  Future<List<String>> getDepots(String token) async {
    return await _stockService.getDepots(token);
  }

  Future<List<dynamic>> getDepotsDetailed(String token) async {
    return await _stockService.getDepotsDetailed(token);
  }

  Future<List<dynamic>> getActiveDepots(String token) async {
    return await _stockService.getActiveDepots(token);
  }

  Future<List<dynamic>> getStocks({String? token}) async {
    return await _stockService.getStocks(token: token);
  }

  // --- Purchases & Suppliers ---
  Future<List<dynamic>> getSuppliers(String token, {bool forceRefresh = false}) async {
    return await _purchaseService.getSuppliers(token, forceRefresh: forceRefresh);
  }

  Future<List<dynamic>> getPurchases(String token, {bool forceRefresh = false}) async {
    return await _purchaseService.getPurchases(token, forceRefresh: forceRefresh);
  }

  Future<String> getNextPurchaseRef() async {
    return await _purchaseService.getNextPurchaseRef();
  }

  Future<Map<String, dynamic>?> getPurchaseWithItems(String id) async {
    return await _purchaseService.getPurchaseWithItems(id);
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
    return await _expensesService.getExpenses(startDate: startDate, endDate: endDate, forceRefresh: forceRefresh);
  }

  Future<void> addExpense(Map<String, dynamic> data, String token) async {
    await _expensesService.addExpense(data, token);
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
    return await _stockService.getStockMovements(token: token, startDate: startDate, endDate: endDate, depot: depot, search: search, articleId: articleId);
  }

  // --- Create/Update/Delete ---
  Future<String?> createInvoice(Map<String, dynamic> data, String token, {double? paymentAmount, String? paymentMethod, String? advanceClientId}) async {
    return await _salesService.createInvoice(data, token, paymentAmount: paymentAmount, paymentMethod: paymentMethod, advanceClientId: advanceClientId);
  }

  Future<String?> createInvoiceDirectOnline(Map<String, dynamic> data, {double? paymentAmount, String? paymentMethod, String? advanceClientId}) async {
    return await _salesService.createInvoiceDirectOnline(data, paymentAmount: paymentAmount, paymentMethod: paymentMethod, advanceClientId: advanceClientId);
  }

  Future<bool> updateClient(String id, Map<String, dynamic> data, String token) async {
    return await _clientService.updateClient(id, data, token);
  }

  Future<bool> deleteClient(String id, String token) async {
    return await _clientService.deleteClient(id, token);
  }

  Future<void> addSupplier(Map<String, dynamic> data, String token) async {
    await _purchaseService.addSupplier(data, token);
  }

  Future<bool> createPurchase(Map<String, dynamic> data, String token) async {
    return await _purchaseService.createPurchase(data, token);
  }

  Future<bool> deletePurchase(String purchaseId, String token) async {
    return await _purchaseService.deletePurchase(purchaseId, token);
  }

  Future<bool> payPurchase(String purchaseId, double amount, String method, String token, {String? reference, String? date}) async {
    return await _purchaseService.payPurchase(purchaseId, amount, method, token, reference: reference, date: date);
  }

  Future<bool> updatePurchase(String purchaseId, Map<String, dynamic> data, String token) async {
    return await _purchaseService.updatePurchase(purchaseId, data, token);
  }

  Future<void> payInvoice(String id, double amount, String method, String token, {String? reference, String? date, String? advanceClientId}) async {
    await _salesService.payInvoice(id, amount, method, token, reference: reference, date: date, advanceClientId: advanceClientId);
  }

  Future<void> cancelInvoice(String id, String token) async {
    await _salesService.cancelInvoice(id, token);
  }

  Future<void> updateInvoice(String id, Map<String, dynamic> data, String token) async {
    await _salesService.updateInvoice(id, data, token);
  }

  Future<List<dynamic>> getDeposits(String token, {bool forceRefresh = false, String? vendeur}) async {
    try {
      debugPrint('ApiService: START getDeposits directly');
      final effectiveToken = await _getEffectiveToken(token);
      final uri = Uri.parse('$_baseUrl/api/advances');
      
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $effectiveToken',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ApiService: ERROR in getDeposits: $e â€” falling back to Supabase');
      if (await _ensureSupabaseReady()) {
        try {
          final authCtx = await _getAuthContext();
          final effectiveVendeur = _effectiveVendeur(authCtx, vendeur);
          var query = _supabaseService.client!.from('avances_clients').select('*, clients(nom)');
          if (effectiveVendeur != null) {
            query = query.eq('utilisateur', effectiveVendeur);
          }
          final data = await query.order('date_avance', ascending: false);
          return data;
        } catch (sbErr) {
          try {
             final simpleData = await _supabaseService.client!.from('avances_clients').select().order('date_avance', ascending: false).limit(50);
             return simpleData;
          } catch (_) {
             return [];
          }
        }
      }
      return [];
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
    await _expensesService.deleteExpense(id, token);
  }

  Future<void> adjustStock(String articleId, double quantity, String depot, String date, String token) async {
    await _stockService.adjustStock(articleId, quantity, depot, date, token);
  }

  Future<Map<String, dynamic>> transferStock(String articleId, String source, String dest, double quantity, String date, String token) async {
    return await _stockService.transferStock(articleId, source, dest, quantity, date, token);
  }

  Future<void> saveDepot(Map<String, dynamic> data, String token) async {
    await _stockService.saveDepot(data, token);
  }

  Future<void> deleteDepot(String id, String token) async {
    await _stockService.deleteDepot(id, token);
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
    await _clientService.payClientBulk(clientId, amount, method, token);
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

  Future<List<dynamic>> _fetchDepensesForReport(SupabaseClient client, String target, String? vendeur) async {
    var q = client.from('depenses').select('montant, date_depense, libelle, operateur').eq('date_depense', target);
    if (vendeur != null) q = q.eq('operateur', vendeur);
    final res = await q;
    return res as List<dynamic>;
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
    return await _salesService.getInvoiceItems(invoiceId, token);
  }

  Future<List<dynamic>> getInvoicePayments(String invoiceId, String token) async {
    return await _salesService.getInvoicePayments(invoiceId, token);
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

    // â”€â”€â”€ Rent Management (Gestion des Loyers) â”€â”€â”€
  Future<List<dynamic>> getContracts(String token, {bool forceRefresh = false}) async {
    return await _rentService.getContracts(token, forceRefresh: forceRefresh);
  }

  Future<Map<String, dynamic>?> getContractDetails(int id, String token) async {
    return await _rentService.getContractDetails(id, token);
  }

  Future<void> addContract(Map<String, dynamic> data, String token) async {
    await _rentService.addContract(data, token);
  }

  Future<void> updateContract(int id, Map<String, dynamic> data, String token) async {
    await _rentService.updateContract(id, data, token);
  }

  Future<void> deleteContract(int id, String token) async {
    await _rentService.deleteContract(id, token);
  }

  Future<List<dynamic>> getRentPayments(String token, {Map<String, String>? filters}) async {
    return await _rentService.getRentPayments(token, filters: filters);
  }

  Future<List<dynamic>> getRentPaymentsForContract(int contractId, String token) async {
    return await _rentService.getRentPaymentsForContract(contractId, token);
  }

  Future<void> addRentPayment(int contractId, Map<String, dynamic> data, String token) async {
    await _rentService.addRentPayment(contractId, data, token);
  }

  Future<void> deleteRentPayment(int paymentId, String token) async {
    await _rentService.deleteRentPayment(paymentId, token);
  }

  // â”€â”€â”€ Cement Management (Gestion de Ciment) â”€â”€â”€
  Future<List<dynamic>> getCimentShipments(String token, {Map<String, String>? filters}) async {
    return await _cimentService.getCimentShipments(token, filters: filters);
  }

  Future<void> addCimentShipment(Map<String, dynamic> data, String token) async {
    await _cimentService.addCimentShipment(data, token);
  }

  Future<void> updateCimentShipment(String id, Map<String, dynamic> data, String token) async {
    await _cimentService.updateCimentShipment(id, data, token);
  }

  Future<void> deleteCimentShipment(String id, String token) async {
    await _cimentService.deleteCimentShipment(id, token);
  }

  Future<List<dynamic>> getCimentPayments(String shipmentId, String token) async {
    return await _cimentService.getCimentPayments(shipmentId, token);
  }

  Future<void> addCimentPayment(String shipmentId, Map<String, dynamic> data, String token) async {
    await _cimentService.addCimentPayment(shipmentId, data, token);
  }

  Future<void> deleteCimentPayment(String paymentId, String token) async {
    await _cimentService.deleteCimentPayment(paymentId, token);
  }
}