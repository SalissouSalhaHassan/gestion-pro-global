import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
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

  void _assertDepotsAccess(List<String> allowedDepots, Iterable<String> depots) {
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

      // 2. Standard Next.js /api/invoices route
      final body = Map<String, dynamic>.from(data);
      if (orgId != null && orgId.isNotEmpty && !body.containsKey('organization_id')) {
        body['organization_id'] = orgId;
      }

      final uri = Uri.parse('$_baseUrl/api/invoices');
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
        final String? id = resData['id']?.toString();
        if (id != null && (paymentAmount ?? 0) > 0) {
          await payInvoice(id, paymentAmount!, paymentMethod ?? 'Espèce', token, advanceClientId: advanceClientId);
        }
        return id;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('[SalesService] Network error in createInvoice: $e');

      // 3. Fallback to Supabase Direct
      if (await _ensureSupabaseReady()) {
        try {
          final authCtx = await _getAuthContext();
          final isAdmin = authCtx['isAdmin'] as bool;
          final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
          final id = await _supabaseService.syncInvoiceDirect(data, allowedDepots: allowedDepots, isAdmin: isAdmin);
          if (id != null) {
            if ((paymentAmount ?? 0) > 0) {
              await payInvoice(id, paymentAmount!, paymentMethod ?? 'Espèce', token, advanceClientId: advanceClientId);
            }
            return id;
          }
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

  /// Direct online sync method used by OfflineQueueService
  Future<String?> createInvoiceDirectOnline(
    Map<String, dynamic> data, {
    double? paymentAmount,
    String? paymentMethod,
    String? advanceClientId,
  }) async {
    const storage = FlutterSecureStorage();
    String? token = await storage.read(key: 'auth_token');
    if (token == null || token.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      token = prefs.getString('auth_token');
    }

    // 1. Try Atomic Checkout
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
      } catch (e) {
        debugPrint('createInvoiceDirectOnline: Atomic checkout failed: $e');
      }
    }

    // 2. Try standard /api/factures
    try {
      final url = Uri.parse('$_baseUrl/api/factures');
      final response = await http.post(
        url,
        headers: {
          'Content-Type': 'application/json',
          if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode(data),
      ).timeout(const Duration(seconds: 15));

      if (response.statusCode == 200 || response.statusCode == 201) {
        final res = jsonDecode(response.body);
        final id = res['id']?.toString() ?? res['data']?['id']?.toString();
        if (id != null && (paymentAmount ?? 0) > 0 && token != null) {
          await payInvoice(id, paymentAmount!, paymentMethod ?? 'Espèce', token, advanceClientId: advanceClientId);
        }
        return id;
      }
    } catch (e) {
      debugPrint('createInvoiceDirectOnline: /api/factures failed: $e');
    }

    // 3. Try Supabase fallback
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final isAdmin = authCtx['isAdmin'] as bool;
      final allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      final id = await _supabaseService.syncInvoiceDirect(data, allowedDepots: allowedDepots, isAdmin: isAdmin);
      if (id != null && (paymentAmount ?? 0) > 0 && token != null) {
        await payInvoice(id, paymentAmount!, paymentMethod ?? 'Espèce', token, advanceClientId: advanceClientId);
      }
      return id;
    }

    throw Exception('All remote sync targets unreachable');
  }

  /// Get Invoices with pagination, search, and multi-tenant scoping
  Future<List<dynamic>> getInvoices(
    String token, {
    bool forceRefresh = false,
    String? vendeur,
    int? page,
    int? pageSize,
    String? search,
  }) async {
    try {
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

      final response = await http.get(uri, headers: headers).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final res = json.decode(response.body);
        if (res is List) return res;
        if (res is Map && res.containsKey('data')) return res['data'] as List<dynamic>;
        return [];
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('[SalesService] getInvoices network failed ($e), falling back to Supabase');
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
        return await _supabaseService.getInvoicesWithClients(
          vendeur: effectiveVendeur,
          from: from,
          to: to,
          search: search,
          isAdmin: isAdmin,
          allowedDepots: allowedDepots,
        );
      }
      return [];
    }
  }

  /// Pay invoice partially or fully
  Future<void> payInvoice(
    String id,
    double amount,
    String method,
    String token, {
    String? reference,
    String? date,
    String? advanceClientId,
  }) async {
    try {
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

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('[SalesService] payInvoice network error ($e), fallback to Supabase');
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

  /// Cancel invoice (Admin only)
  Future<void> cancelInvoice(String id, String token) async {
    if (await _ensureSupabaseReady()) {
      await _supabaseService.cancelInvoiceDirect(id);
    }
  }

  /// Update invoice and its items
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
          double puHt = (item['pu_ht'] as num?)?.toDouble() ?? (tauxItem > 0 ? puTtc / (1 + tauxItem / 100) : puTtc);
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

  /// Get detailed items for an invoice
  Future<List<dynamic>> getInvoiceItems(String invoiceId, String token) async {
    try {
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

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List rawItems = data['facture_items'] ?? [];

        final result = <Map<String, dynamic>>[];
        for (var item in rawItems) {
          final m = Map<String, dynamic>.from(item);
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
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      if (await _ensureSupabaseReady()) {
        try {
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
        } catch (_) {
          return [];
        }
      }
      return [];
    }
  }

  /// Get payments list for an invoice
  Future<List<dynamic>> getInvoicePayments(String invoiceId, String token) async {
    try {
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

      if (response.statusCode == 200) {
        return json.decode(response.body) as List<dynamic>;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      if (await _ensureSupabaseReady()) {
        try {
          return await _supabaseService.client!
              .from('paiements')
              .select('*')
              .eq('facture_id', invoiceId)
              .order('date_operation', ascending: true);
        } catch (_) {
          return [];
        }
      }
      return [];
    }
  }
}
