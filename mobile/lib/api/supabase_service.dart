import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';
import 'package:bcrypt/bcrypt.dart';
import 'package:intl/intl.dart';
import '../config/app_config.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  bool _isInitialized = false;
  SupabaseClient? _client;

  SupabaseClient? get client => _client;
  bool get isInitialized => _isInitialized;

  Future<void> logActivity({
    required String actionType,
    required String entityType,
    String? entityId,
    String? details,
    String? userId,
    String? username,
  }) async {
    if (!_isInitialized) await init();
    if (_client == null) return;
    try {
      // We try to insert with both timestamp and created_at to be safe
      await _client!.from('activity_logs').insert({
        'user_id': userId,
        'username': username,
        'action_type': actionType,
        'entity_type': entityType,
        'entity_id': entityId,
        'details': details,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      try {
        await _client!.from('activity_logs').insert({
          'user_id': userId,
          'username': username,
          'action_type': actionType,
          'entity_type': entityType,
          'entity_id': entityId,
          'details': details,
        });
      } catch (_) {
        debugPrint('Failed to log activity: $e');
      }
    }
  }

  Future<Map<String, dynamic>?> getLatestAppConfig() async {
    if (!_isInitialized) await init();
    if (_client == null) return null;
    try {
      final res = await _client!.from('app_config').select().limit(1).maybeSingle();
      return res;
    } catch (e) {
      debugPrint('Error fetching app config: $e');
      return null;
    }
  }

  List<String> _parseDepotList(dynamic raw) {
    if (raw == null) return [];
    final str = raw.toString();
    if (str.trim().isEmpty) return [];
    final values = str.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty);
    return values.toSet().toList();
  }

  List<String> _extractDepotNames(dynamic rows) {
    final Set<String> names = {};
    if (rows is List) {
      for (final r in rows) {
        final rowActive = r is Map ? r['is_active'] : null;
        if (rowActive == false) continue;
        final depot = r is Map ? r['depots'] : null;
        if (depot is Map) {
          final name = depot['nom']?.toString().trim();
          final isActive = depot['is_active'];
          final isDeleted = depot['is_deleted'];
          if (name != null && name.isNotEmpty) {
            if (isDeleted == true) continue;
            if (isActive == false) continue;
            names.add(name);
          }
        }
      }
    }
    return names.toList();
  }

  Future<List<String>> getUserDepots(String userId) async {
    if (!_isInitialized) await init();
    if (_client == null) return [];
    try {
      final res = await _client!
          .from('user_depots')
          .select('is_active, depots(nom, is_active, is_deleted)')
          .eq('user_id', userId);
      return _extractDepotNames(res);
    } catch (e) {
      // Fallback if extra columns are missing or schema is older
      try {
        final res = await _client!
            .from('user_depots')
            .select('depots(nom)')
            .eq('user_id', userId);
        return _extractDepotNames(res);
      } catch (e2) {
        debugPrint('Error fetching assigned depots for user: $e2');
        return [];
      }
    }
  }

  Future<Set<String>> getUserArticleIds(String userId) async {
    if (!_isInitialized) await init();
    if (_client == null) return {};
    try {
      final res = await _client!
          .from('user_articles')
          .select('article_id, is_active')
          .eq('user_id', userId);
      final ids = <String>{};
      for (final r in (res as List)) {
        final rowActive = r is Map ? r['is_active'] : null;
        if (rowActive == false) continue;
        final id = r['article_id']?.toString();
        if (id != null && id.isNotEmpty) ids.add(id);
      }
      return ids;
    } catch (e) {
      // Fallback to older schema without is_active
      try {
        final res = await _client!
            .from('user_articles')
            .select('article_id')
            .eq('user_id', userId);
        final ids = <String>{};
        for (final r in (res as List)) {
          final id = r['article_id']?.toString();
          if (id != null && id.isNotEmpty) ids.add(id);
        }
        return ids;
      } catch (e2) {
        debugPrint('Error fetching assigned articles for user: $e2');
        return {};
      }
    }
  }

  Future<void> init() async {
    if (_isInitialized) return;
    try {
      final url = AppConfig.supabaseUrl;
      final key = AppConfig.supabaseAnonKey;
      
      debugPrint('Supabase: Initializing with URL: ${url.isNotEmpty ? url : "EMPTY"}');
      if (url.isNotEmpty && key.isNotEmpty) {
        await Supabase.initialize(url: url, anonKey: key, debug: kDebugMode);
        _client = Supabase.instance.client;
        _isInitialized = true;
        debugPrint('Supabase: Initialization successful for GESTION PRO GLOBAL');
      } else {
        debugPrint('Supabase: Missing URL or Key');
      }
    } catch (e) {
      debugPrint('Supabase: Initialization error: $e');
    }
  }

  Future<Map<String, dynamic>?> loginDirect(String username, String password) async {
    if (!_isInitialized) await init();
    if (!_isInitialized) throw Exception("Cloud non initialisé");
    try {
      final trimmed = username.trim();
      dynamic response;

      // 1. Direct username lookup
      try {
        response = await _client!.from('users').select().ilike('utilisateur', trimmed).maybeSingle();
      } catch (postgrestErr) {
        debugPrint('Direct users select blocked by RLS: $postgrestErr');
        throw Exception("Identifiant ou mot de passe incorrect.");
      }

      // 2. Fallback: If input is an email, lookup organization by email and get its users
      if (response == null && trimmed.contains('@')) {
        try {
          final org = await _client!.from('organizations').select('id').ilike('email', trimmed).maybeSingle();
          if (org != null) {
            final orgUsers = await _client!
                .from('users')
                .select()
                .eq('organization_id', org['id'])
                .order('admin', ascending: false);
            if (orgUsers is List && orgUsers.isNotEmpty) {
              for (var u in orgUsers) {
                final hPass = u['mot_de_passe'] as String?;
                bool isMatch = false;
                try { isMatch = BCrypt.checkpw(password, hPass ?? ''); } catch (_) { isMatch = (password == hPass); }
                if (isMatch) {
                  response = u;
                  break;
                }
              }
              response ??= orgUsers.first;
            }
          }
        } catch (orgErr) {
          debugPrint('Direct org users query warning: $orgErr');
        }
      }

      if (response == null) throw Exception("Utilisateur ou Email non trouvé");

      final hashedPassword = response['mot_de_passe'] as String?;
      if (hashedPassword == null) throw Exception("Pas de mot de passe");
      bool isValid = false;
      try { isValid = BCrypt.checkpw(password, hashedPassword); } catch (_) { isValid = (password == hashedPassword); }
      if (isValid) {
        final adminVal = response['admin']?.toString().toLowerCase();
        final isAdmin = (adminVal == 'oui' || adminVal == 'admin' || adminVal == 'administrateur');

        final orgId = response['organization_id']?.toString() ?? '00000000-0000-0000-0000-000000000001';
        String orgName = 'GESTION PRO GLOBAL';
        String currency = 'FCFA';

        // Check organization active status & get branding
        try {
          final orgData = await _client!.from('organizations').select('id, name, currency, is_active').eq('id', orgId).maybeSingle();
          if (orgData != null) {
            if (orgData['is_active'] == false) {
              throw Exception("Ce compte ou organisation est suspendu. Veuillez contacter le support.");
            }
            orgName = orgData['name'] ?? orgName;
            currency = orgData['currency'] ?? currency;
          }
        } catch (orgErr) {
          debugPrint('Direct login org check warning: $orgErr');
          if (orgErr.toString().contains('suspendu')) rethrow;
        }

        // Fetch explicitly assigned depots logic here (Deny-by-Default system)
        List<String> assignedDepots = [];
        if (!isAdmin) {
          try {
            assignedDepots = await getUserDepots(response['id'].toString());
          } catch(e) {
             debugPrint('Error fetching assigned depots for user: $e');
          }
          // Fallback to legacy text field if needed
          if (assignedDepots.isEmpty) {
            assignedDepots = _parseDepotList(response['depots']);
            if (assignedDepots.isEmpty && response['emplacement'] != null) {
              final emp = response['emplacement'].toString().trim();
              if (emp.isNotEmpty) {
                assignedDepots.add(emp);
              }
            }
          }
        }

        return {
          'access_token': 'direct_access',
          'token_type': 'bearer',
          'role': isAdmin ? 'admin' : 'vendeur',
          'username': response['utilisateur'],
          'user_id': response['id'], 
          'depots': isAdmin ? '' : assignedDepots.join(','), 
          'emplacement': response['emplacement'] ?? '',
          'organization_id': orgId,
          'organization_name': orgName,
          'currency': currency,
        };
      }
      throw Exception("Mot de passe incorrect");
    } catch (e) { rethrow; }
  }

  Future<String?> getOrganizationId() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final id = prefs.getString('auth_organizationId');
      if (id != null && id.isNotEmpty) return id;
      const storage = FlutterSecureStorage();
      return await storage.read(key: 'auth_organization_id');
    } catch (_) {
      return null;
    }
  }

  Future<List<dynamic>> getTableData(String table, {int? from, int? to}) async {
    if (!_isInitialized) await init();
    try { 
      dynamic query = _client!.from(table).select();
      final orgId = await getOrganizationId();
      if (orgId != null && orgId.isNotEmpty) {
        const orgTables = [
          'articles',
          'factures',
          'facture_items',
          'clients',
          'fournisseurs',
          'mouvements',
          'depots',
          'caisse_journal',
          'informations_entreprise',
          'depenses',
          'loyers',
          'contrats',
          'contrat_paiements',
          'parametres_numerotation',
          'avances_clients',
          'users',
          'paiements',
          'ciment_operations',
          'gestion_ciment',
          'ciment_paiements',
          'activity_logs',
          'notifications'
        ];
        if (orgTables.contains(table)) {
          query = query.eq('organization_id', orgId);
        }
      }
      if (table == 'clients' || table == 'fournisseurs' || table == 'articles' || table == 'contrats') {
        query = query.or('is_deleted.eq.false,is_deleted.is.null');
      }
      if (table == 'clients') {
        query = query.order('nom', ascending: true);
      }
      if (from != null && to != null) {
        query = query.range(from, to);
      }
      return await query;
    } catch (_) { return []; }
  }

  Future<List<dynamic>> getArticlesWithStocks({int? from, int? to, String? search, String? userId, List<String>? allowedDepots, bool isAdmin = false}) async {
    if (!_isInitialized) await init();
    if (_client == null) {
      debugPrint('Supabase: Client is NULL in getArticlesWithStocks');
      return [];
    }

    try {
      final List<String> cleanedAllowedDepots = (allowedDepots ?? []).where((d) => d.trim().isNotEmpty).toSet().toList();
      List<String> effectiveDepots = cleanedAllowedDepots;

      final orgId = await getOrganizationId();

      // 1. Fetch Articles (with security & multi-tenant filter)
      dynamic query = _client!.from('articles').select('*').or('is_deleted.eq.false,is_deleted.is.null');
      if (orgId != null && orgId.isNotEmpty) {
        query = query.eq('organization_id', orgId);
      }
      
      // [SECURITY FILTER] Strict Hiding for Sellers
      if (!isAdmin && userId != null) {
        List<String> depots = List<String>.from(effectiveDepots);
        if (depots.isEmpty) {
          depots = await getUserDepots(userId);
        }
        effectiveDepots = depots;
        try {
          // 1. Get explicitly assigned articles
          final Set<String> allowedIds = await getUserArticleIds(userId);

          // 2. Get articles with stock in allowed depots
          if (depots.isNotEmpty) {
             final stockRes = await _client!.from('stocks')
                .select('article_id')
                .filter('quantite', 'not.eq', 0)
                .inFilter('depot_nom', depots);
             for (var r in stockRes) {
                allowedIds.add(r['article_id'].toString());
             }
          }
          
          // If no articles are allowed, return early
          if (allowedIds.isEmpty) return [];
          
          // Filter main query by these IDs
          query = query.inFilter('id', allowedIds.toList());
        } catch (e) {
          debugPrint('Security filter error in getArticlesWithStocks: $e');
        }
      }

      if (search != null && search.isNotEmpty) {
        query = query.or('reference.ilike.%$search%,designation.ilike.%$search%');
      }

      query = query.order('designation', ascending: true);
      
      if (from != null && to != null) {
        query = query.range(from, to);
      }

      final List<dynamic> articlesData = await query;
      debugPrint('Supabase: Fetched ${articlesData.length} articles');

      if (articlesData.isEmpty) return [];

      // Extract all Article IDs
      final List<String> articleIds = articlesData.map((a) => a['id'].toString()).toList();

      // 2. Fetch Stocks for these articles (only authorized depots for sellers)
      List<dynamic> allStocks = [];
      if (isAdmin || effectiveDepots.isNotEmpty) {
        dynamic stockQuery = _client!
            .from('stocks')
            .select('article_id, depot_nom, quantite')
            .inFilter('article_id', articleIds);
        if (!isAdmin && effectiveDepots.isNotEmpty) {
          stockQuery = stockQuery.inFilter('depot_nom', effectiveDepots);
        }
        allStocks = await stockQuery;
      }

      // Group stocks by article_id
      final Map<String, List<Map<String, dynamic>>> stocksByArticle = {};
      for (var s in allStocks) {
        final aId = s['article_id'].toString();
        if (!stocksByArticle.containsKey(aId)) {
          stocksByArticle[aId] = [];
        }
        stocksByArticle[aId]!.add({
          'depot_nom': s['depot_nom'] ?? 'Principal',
          'quantite': (s['quantite'] as num?)?.toDouble() ?? 0.0,
        });
      }

      // 3. Merge data
      return articlesData.map((a) {
        final m = Map<String, dynamic>.from(a);
        final aId = m['id'].toString();
        
        final articleStocks = stocksByArticle[aId] ?? [];
        
        m['stocks'] = articleStocks;
        double total = 0;
        for (var s in articleStocks) {
          total += (s['quantite'] as double);
        }
        m['quantite'] = total;
        
        m['prix_vente'] = (m['p_vente_ttc'] ?? m['prix_vente'] ?? 0).toDouble();
        m['prix_achat'] = (m['p_u_ht'] ?? m['prix_achat'] ?? 0).toDouble();
        return m;
      }).toList();
    } catch (e) {
      debugPrint('Supabase Error (getArticlesWithStocks): $e');
      throw Exception("Erreur synchronisation articles: $e");
    }
  }


  Future<List<dynamic>> getInvoicesWithClients({String? vendeur, int? from, int? to, String? search, bool isAdmin = false, List<String> allowedDepots = const []}) async {
    if (!_isInitialized) await init();
    if (_client == null) return [];

    try {
      debugPrint('Supabase: Fetching invoices (v: $vendeur, s: $search)');
      
      final orgId = await getOrganizationId();
      
      // Use dynamic to allow both filter and transform builders
      dynamic query = _client!.from('factures').select('*, clients(nom)');
      if (orgId != null && orgId.isNotEmpty) {
        query = query.eq('organization_id', orgId);
      }
      
      if (!isAdmin) {
        if (vendeur != null && vendeur != 'admin' && vendeur.isNotEmpty) {
          query = query.eq('vendeur', vendeur);
        } else {
          query = query.eq('id', -1); // Deny if no valid vendeur is provided for non-admin
        }
      }

      if (search != null && search.trim().isNotEmpty) {
        final s = '%${search.trim()}%';
        // Smart search: match BL number OR client name (via joined table)
        // Correct syntax for searching in joined tables: 'table.column'
        query = query.or('bl_number.ilike.$s,clients.nom.ilike.$s');
      }
      
      query = query.order('date_facture', ascending: false);
      if (from != null && to != null) {
        query = query.range(from, to);
      }

      final List<dynamic> data = await query;
      
      return data.map((f) {
        final m = Map<String, dynamic>.from(f);
        
        // Priority 1: Data stored directly in the invoice header
        String? name = m['client_nom']?.toString();
        
        // Priority 2: Data from the joined clients table
        if (name == null || name.trim().isEmpty || name == 'Client Inconnu') {
          final clientData = m['clients'];
          if (clientData != null) {
            if (clientData is Map) {
              name = clientData['nom']?.toString();
            } else if (clientData is List && clientData.isNotEmpty) {
              name = clientData[0]['nom']?.toString();
            }
          }
        }
        
        m['client_nom'] = (name != null && name.isNotEmpty) ? name : 'Client Inconnu';
        return m;
      }).toList();
    } catch (e) {
      debugPrint('⚠️ Supabase getInvoicesWithClients Error: $e');
      // Fallback to simple select if join fails
      try {
        final orgId = await getOrganizationId();
        dynamic fallbackQuery = _client!.from('factures').select('*, clients(nom)');
        if (orgId != null && orgId.isNotEmpty) {
          fallbackQuery = fallbackQuery.eq('organization_id', orgId);
        }
        final List<dynamic> rawData = await fallbackQuery
            .order('date_facture', ascending: false)
            .limit(20);
        return rawData;
      } catch (_) {
        return [];
      }
    }
  }

  Future<String?> syncInvoiceDirect(Map<String, dynamic> data, {List<String>? allowedDepots, bool isAdmin = false}) async {
    if (!_isInitialized) await init();
    // Do NOT catch here — let real errors propagate so the UI shows them
    final payload = Map<String, dynamic>.from(data);
    final items = List.from(payload.remove('items') ?? []);
    if (!isAdmin) {
      final allowed = (allowedDepots ?? []).map((e) => e.trim()).where((e) => e.isNotEmpty).toSet();
      if (allowed.isEmpty) {
        throw Exception("Accès refusé: aucun dépôt assigné.");
      }
      for (final item in items) {
        final depot = (item['depot_origine'] ?? 'Boutique').toString();
        if (!allowed.contains(depot)) {
          throw Exception("Accès refusé au dépôt '$depot'.");
        }
      }
    }
    final double totalTtc = (payload['total_ttc'] as num?)?.toDouble() ?? 0.0;
    double totalHtPayload = (payload['total_ht'] as num?)?.toDouble() ?? totalTtc;
    double totalTvaPayload = (payload['total_tva'] as num?)?.toDouble() ?? 0.0;
    double tauxFacturePayload = (payload['taux_tva_facture'] as num?)?.toDouble() ?? 0.0;

    final orgId = await getOrganizationId();

    final invoiceToInsert = {
      if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
      'date_facture': payload['date_facture'] ?? DateTime.now().toIso8601String().split('T')[0],
      'bl_number': payload['bl_number'],
      'client_id': int.tryParse(payload['client_id']?.toString() ?? '0') ?? 0,
      'total_ttc': totalTtc,
      'montant_restant': totalTtc,
      'statut': 'Non payée',
      'vendeur': payload['vendeur'] ?? 'MobileApp',
      'emplacement': payload['emplacement'] ?? '',
      'total_ht': totalHtPayload,
      'total_tva': totalTvaPayload,
      'taux_tva_facture': tauxFacturePayload,
      'nbr_art': items.length,
      'created_at': DateTime.now().toIso8601String(),
      'updated_at': DateTime.now().toIso8601String(),
      'is_deleted': false,
    };
    debugPrint('📤 Inserting facture...');
    final res = await _client!.from('factures').insert(invoiceToInsert).select().single();
    final String factureId = res['id'].toString();
    debugPrint('✅ Facture created with id: $factureId');
    for (var item in items) {
      final String artId = item['article_id'].toString();
      final double qte = (item['qte'] as num).toDouble();
      final double puTtc = (item['pu_ttc'] as num).toDouble();
      final String depot = item['depot_origine'] ?? 'Boutique';
      final double tauxItem = (item['taux_tva_item'] as num?)?.toDouble() ?? 0.0;
      final double puHtItem = (item['pu_ht'] as num?)?.toDouble() ?? puTtc;
      final double montTvaItem = (item['montant_tva_item'] as num?)?.toDouble() ?? ((puTtc - puHtItem) * qte);

      await _client!.from('facture_items').insert({
        if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
        'facture_id': int.tryParse(factureId) ?? 0,
        'article_id': int.tryParse(artId) ?? 0,
        'code_art': item['code_art'] ?? '',
        'description': item['description'] ?? '',
        'qte': qte,
        'pu_ttc': puTtc,
        'pu_ht': puHtItem,
        'total_item_ttc': puTtc * qte,
        'total_item_ht': puHtItem * qte,
        'depot_origine': depot,
        'taux_tva_item': tauxItem,
        'montant_tva_item': montTvaItem,
      });
      try {
        final stockData = await _client!.from('stocks').select().eq('article_id', artId).eq('depot_nom', depot).maybeSingle();
        final double oldQty = stockData != null ? ((stockData['quantite'] as num?)?.toDouble() ?? 0.0) : 0.0;
        final double newQty = oldQty - qte;
        if (stockData != null) {
          await _client!.from('stocks').update({'quantite': newQty}).eq('id', stockData['id']);
        } else {
          await _client!.from('stocks').insert({
            if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
            'article_id': artId,
            'depot_nom': depot,
            'quantite': -qte,
          });
        }
        await _client!.from('mouvements').insert({
          if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
          'article_id': int.tryParse(artId) ?? 0,
          'type': 'SORTIE',
          'quantite': -qte,
          'date_mouvement': DateTime.now().toIso8601String().split('T')[0],
          'nr_doc': payload['bl_number'],
          'depot': depot,
          'utilisateur': payload['vendeur'] ?? 'MobileApp',
          'stock_avant': oldQty,
          'sortie': qte,
          'entree': 0,
          'stock_apres': newQty,
        });
      } catch (stockErr) {
        debugPrint('⚠️ Stock update error (non-fatal): $stockErr');
      }
    }
    try {
      final cRes = await _client!.from('clients').select('credit_facture').eq('id', payload['client_id']).single();
      await _client!.from('clients').update({'credit_facture': ((cRes['credit_facture'] ?? 0) as num).toDouble() + totalTtc}).eq('id', payload['client_id']);
    } catch (clientErr) {
      debugPrint('⚠️ Client credit update error (non-fatal): $clientErr');
    }
    
    // Record Activity Logs
    try {
      final user = payload['vendeur'] ?? 'MobileApp';
      // 1. Log Invoice Creation
      await logActivity(
        actionType: 'CREATE',
        entityType: 'facture',
        entityId: factureId,
        details: 'Facture #${payload['bl_number']} pour client ID ${payload['client_id']} - Total: $totalTtc',
        username: user,
      );

      // 2. Log TVA details
      await logActivity(
        actionType: 'TVA_CREATION',
        entityType: 'facture',
        entityId: factureId,
        details: 'total_tva=$totalTvaPayload taux_tva_facture=$tauxFacturePayload',
        username: user,
      );
    } catch (_) {}

    return factureId;
  }

  Future<bool> syncClientDirect(Map<String, dynamic> data) async {
    if (!_isInitialized) await init();
    try {
      final orgId = data['organization_id'] ?? await getOrganizationId();
      final payload = {
        'ref_client': data['ref_client'] ?? 'CLT-${DateTime.now().millisecondsSinceEpoch}',
        'nom': data['nom'],
        'tel': (data['tel'] ?? data['telephone'])?.toString().trim().isEmpty == true ? null : (data['tel'] ?? data['telephone']),
        'email': data['email']?.toString().trim().isEmpty == true ? null : data['email'],
        'site': (data['site'] ?? data['site_web'])?.toString().trim().isEmpty == true ? null : (data['site'] ?? data['site_web']),
        'adresse': data['adresse']?.toString().trim().isEmpty == true ? null : data['adresse'],
        'contact': (data['contact'] ?? data['personne_contact'])?.toString().trim().isEmpty == true ? null : (data['contact'] ?? data['personne_contact']),
        'gsm': data['gsm']?.toString().trim().isEmpty == true ? null : data['gsm'],
        'fax': data['fax']?.toString().trim().isEmpty == true ? null : data['fax'],
        'ice': data['ice']?.toString().trim().isEmpty == true ? null : data['ice'],
        'rc': data['rc']?.toString().trim().isEmpty == true ? null : data['rc'],
        'patente': data['patente']?.toString().trim().isEmpty == true ? null : data['patente'],
        'nif': data['nif']?.toString().trim().isEmpty == true ? null : data['nif'],
        'art_imp': data['art_imp']?.toString().trim().isEmpty == true ? null : data['art_imp'],
        'n_compte': (data['n_compte'] ?? data['compte_bancaire'])?.toString().trim().isEmpty == true ? null : (data['n_compte'] ?? data['compte_bancaire']),
        'montant_plafond': (data['montant_plafond'] is num)
            ? (data['montant_plafond'] as num).toDouble()
            : (double.tryParse(data['montant_plafond']?.toString() ?? '0') ?? 0.0),
        'pre_client': data['pre_client'] == true || data['pre_paiement'] == true,
        'prix_client': data['prix_client'] ?? 1,
        'commerciale': (data['commerciale'] ?? data['nom_commercial'])?.toString().trim().isEmpty == true ? null : (data['commerciale'] ?? data['nom_commercial']),
        'type_client': data['type_client'] ?? 'Détail',
        'is_deleted': false,
        if (orgId != null && orgId.toString().isNotEmpty) 'organization_id': orgId.toString(),
        'created_at': DateTime.now().toIso8601String(),
        'updated_at': DateTime.now().toIso8601String(),
      };
      await _client!.from('clients').insert(payload);
      
      // Log Activity
      await logActivity(
        actionType: 'CREATE',
        entityType: 'client',
        entityId: data['nom']?.toString() ?? '',
        details: 'Nouveau client: ${data['nom']}',
        username: 'MobileApp',
      );

      return true;
    } catch (e) {
      debugPrint('❌ syncClientDirect error: $e');
      return false;
    }
  }

  Future<bool> syncSupplierDirect(Map<String, dynamic> data) async {
    if (!_isInitialized) await init();
    try {
      final payload = Map<String, dynamic>.from(data);
      payload.remove('id');
      final orgId = payload['organization_id'] ?? await getOrganizationId();
      if (orgId != null && orgId.toString().isNotEmpty) {
        payload['organization_id'] = orgId.toString();
      }
      await _client!.from('fournisseurs').insert(payload);
      return true;
    } catch (_) { return false; }
  }

  Future<Map<String, dynamic>?> syncDepositDirect(Map<String, dynamic> data) async {
    if (!_isInitialized) await init();
    try {
      final payload = {
        'client_id': int.tryParse(data['client_id']?.toString() ?? '0') ?? 0,
        'date_avance': data['date_avance'] ?? DateTime.now().toIso8601String().split('T')[0],
        'montant_initial': (data['montant_initial'] ?? 0).toDouble(),
        'montant_restant': (data['montant_restant'] ?? data['montant_initial'] ?? 0).toDouble(),
        'moyen_paiement': data['moyen_paiement'] ?? data['moyen'] ?? 'Espèce',
        'reference_paiement': data['reference_paiement'] ?? data['reference'] ?? 'DEP-${DateTime.now().millisecondsSinceEpoch}',
        'notes': data['notes'] ?? '',
        'utilisateur': data['utilisateur'] ?? 'MobileApp',
        'statut': data['statut'] ?? 'Disponible',
        'emplacement': data['emplacement'] ?? '',
      };
      
      // Perform insert and select the generated row
      final res = await _client!.from('avances_clients').insert(payload).select().single();
      return Map<String, dynamic>.from(res);
    } catch (e) {
      debugPrint('❌ syncDepositDirect error: $e');
      return null;
    }
  }

  Future<bool> payInvoiceDirect(String id, double amount, String method, {String? reference, String? date, String? advanceClientId, String? utilisateur}) async {
    if (!_isInitialized) await init();
    try {
      final res = await _client!.from('factures').select('client_id, montant_paye, total_ttc').eq('id', id).single();
      final double newPaid = ((res['montant_paye'] ?? 0) as num).toDouble() + amount;
      final double total = ((res['total_ttc'] ?? 0) as num).toDouble();
      
      // 1. Update Invoice
      await _client!.from('factures').update({
        'montant_paye': newPaid, 
        'montant_restant': total - newPaid, 
        'statut': (total - newPaid <= 0.01) ? 'Payée' : 'Partiellement Payée'
      }).eq('id', id);
      
      // 2. If using advance, deduct from it
      if (advanceClientId != null) {
        final advRes = await _client!.from('avances_clients').select('montant_restant').eq('id', advanceClientId).single();
        final double currentAdv = (advRes['montant_restant'] as num).toDouble();
        final double newAdvBalance = currentAdv - amount;
        await _client!.from('avances_clients').update({
          'montant_restant': newAdvBalance,
          'statut': newAdvBalance <= 0 ? 'Utilisée' : 'Partiellement utilisée',
          'updated_at': DateTime.now().toIso8601String()
        }).eq('id', advanceClientId);
      }

      // 3. Record Payment
      await _client!.from('paiements').insert({
        'client_id': int.tryParse(res['client_id']?.toString() ?? '0') ?? 0, 
        'facture_id': int.tryParse(id) ?? 0, 
        'avance_client_id': int.tryParse(advanceClientId?.toString() ?? '0'),
        'montant_regle': amount, 
        'moyen_reglement': method, 
        'date_operation': date ?? DateTime.now().toIso8601String().split('T')[0], 
        'utilisateur': utilisateur ?? 'MobileApp'
      });

      // Log Activity
      await logActivity(
        actionType: 'PAIEMENT',
        entityType: 'facture',
        entityId: id,
        details: 'Paiement de $amount par $method',
        username: utilisateur ?? 'MobileApp',
      );

      return true;
    } catch (e) { 
      debugPrint('❌ payInvoiceDirect error: $e');
      return false; 
    }
  }

  Future<bool> cancelInvoiceDirect(String id) async {
    if (!_isInitialized) await init();
    try {
      // 1. Get Invoice Data
      final inv = await _client!.from('factures').select('client_id, total_ttc, statut, bl_number').eq('id', id).single();
      if (inv['statut'] == 'Annulée') return true;

      final String clientId = inv['client_id'];
      final double totalTtc = ((inv['total_ttc'] ?? 0) as num).toDouble();
      final String blNumber = inv['bl_number'] ?? 'INV-$id';

      // 2. Restore Stock for each item
      final items = await _client!.from('facture_items').select('article_id, qte, depot_origine').eq('facture_id', id);
      final orgId = await getOrganizationId();
      
      for (var item in items) {
        final dynamic rawArtId = item['article_id'];
        final int? artId = rawArtId is num ? rawArtId.toInt() : int.tryParse(rawArtId.toString());
        if (artId == null) continue;

        final double qte = ((item['qte'] ?? 0) as num).toDouble();
        final String depot = (item['depot_origine'] ?? 'Boutique').toString().trim();

        // Query stocks for this article
        var stockQuery = _client!.from('stocks').select().eq('article_id', artId);
        if (orgId != null && orgId.isNotEmpty) {
          stockQuery = stockQuery.eq('organization_id', orgId);
        }
        final stockRows = await stockQuery;
        final matchingStock = (stockRows as List<dynamic>?)?.firstWhere(
          (s) => (s['depot_nom'] ?? '').toString().trim().toLowerCase() == depot.toLowerCase(),
          orElse: () => null,
        );

        double oldQty = 0.0;
        double newQty = qte;

        if (matchingStock != null) {
          oldQty = ((matchingStock['quantite'] ?? 0) as num).toDouble();
          newQty = oldQty + qte;
          await _client!.from('stocks').update({'quantite': newQty}).eq('id', matchingStock['id']);
        } else {
          await _client!.from('stocks').insert({
            'article_id': artId,
            'depot_nom': depot,
            'quantite': newQty,
            if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
          });
        }

        // Record Movement (ENTREE - Cancellation)
        await _client!.from('mouvements').insert({
          if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
          'article_id': artId,
          'type': 'ENTREE',
          'quantite': qte,
          'date_mouvement': DateTime.now().toIso8601String().split('T')[0],
          'nr_doc': 'ANN-$blNumber',
          'depot': depot,
          'utilisateur': 'MobileApp',
          'entree': qte,
          'sortie': 0,
          'stock_avant': oldQty,
          'stock_apres': newQty
        });
      }

      // 3. Update Client Credit
      try {
        final cRes = await _client!.from('clients').select('credit_facture').eq('id', clientId).single();
        final double oldCredit = ((cRes['credit_facture'] ?? 0) as num).toDouble();
        await _client!.from('clients').update({'credit_facture': oldCredit - totalTtc}).eq('id', clientId);
      } catch (e) {
        debugPrint('⚠️ Client credit update error: $e');
      }

      // 4. Update Invoice Status
      await _client!.from('factures').update({
        'statut': 'Annulée',
        'montant_restant': 0.0,
        'updated_at': DateTime.now().toIso8601String()
      }).eq('id', id);

      // Log Activity
      await logActivity(
        actionType: 'ANNULATION',
        entityType: 'facture',
        entityId: id,
        details: 'Facture #$blNumber annulée',
        username: 'MobileApp',
      );

      return true;
    } catch (e) {
      debugPrint('❌ cancelInvoiceDirect error: $e');
      return false;
    }
  }

  Future<bool> insertData(String table, Map<String, dynamic> data) async {
    if (!_isInitialized) await init();
    try {
      final payload = Map<String, dynamic>.from(data);
      // Remove manual id if present to allow DB to generate SERIAL id
      payload.remove('id');
      await _client!.from(table).insert(payload);
      return true;
    } catch (_) { return false; }
  }

  Future<void> reinit(String url, String key) async {
    _client = SupabaseClient(url, key);
    _isInitialized = true;
  }

  Future<bool> payPurchaseDirect(String id, double amount, String method, {String? reference, String? date, String? utilisateur}) async {
    if (!_isInitialized) await init();
    try {
      final res = await _client!.from('achats').select('montant_paye, montant_total').eq('id', id).single();
      final double newPaid = ((res['montant_paye'] ?? 0) as num).toDouble() + amount;
      final double total = ((res['montant_total'] ?? 0) as num).toDouble();
      
      await _client!.from('achats').update({
        'montant_paye': newPaid, 
        'statut': (total - newPaid <= 0.01) ? 'Payée' : 'Partiellement Payée'
      }).eq('id', id);
      
      await _client!.from('paiements').insert({
        'achat_id': int.tryParse(id) ?? 0,
        'montant_regle': amount, 
        'moyen_reglement': method, 
        'date_operation': date ?? DateTime.now().toIso8601String().split('T')[0], 
        'reference_paiement': reference,
        'utilisateur': utilisateur ?? 'MobileApp'
      });
      
      // Log Activity
      await logActivity(
        actionType: 'PAIEMENT',
        entityType: 'achat',
        entityId: id,
        details: 'Paiement fournisseur de $amount par $method',
        username: utilisateur ?? 'MobileApp',
      );

      return true;
    } catch (e) { 
      debugPrint('❌ payPurchaseDirect error: $e');
      return false; 
    }
  }

  Future<bool> createPurchaseDirect(Map<String, dynamic> data) async {
    if (!_isInitialized) await init();
    try {
      final List items = data.remove('items') ?? [];
      final String depot = data['depot_nom'] ?? 'Boutique';

      // 1. Insert Header (Remove id to let SERIAL handle it)
      data.remove('id');
      final resHead = await _client!.from('achats').insert(data).select().single();
      final String realId = resHead['id'].toString();
      
      // 2. Process Items
      for (var item in items) {
        final itemData = Map<String, dynamic>.from(item);
        itemData.remove('id');
        itemData['achat_id'] = int.tryParse(realId) ?? 0;
        await _client!.from('achat_items').insert(itemData);
        
        final String artId = itemData['article_id'].toString();
        final double qte = ((itemData['quantite'] ?? 0) as num).toDouble();
        final double priceHT = ((itemData['prix_unitaire_ht'] ?? 0) as num).toDouble();
        
        // 3. Update Depot Stock
        final stockData = await _client!.from('stocks').select('id, quantite').eq('article_id', artId).eq('depot_nom', depot).maybeSingle();
        double stockAvant = 0;
        if (stockData != null) {
          stockAvant = ((stockData['quantite'] ?? 0) as num).toDouble();
          await _client!.from('stocks').update({'quantite': stockAvant + qte}).eq('id', stockData['id']);
        } else {
          await _client!.from('stocks').insert({
            'article_id': int.tryParse(artId.toString()) ?? 0,
            'depot_nom': depot,
            'quantite': qte,
          });
        }
        
        // 4. Update Article Aggregates (Qty & PMP)
        final artRes = await _client!.from('articles').select('quantite, p_achat_ht').eq('id', artId).single();
        final double totalQtyOld = ((artRes['quantite'] ?? 0) as num).toDouble();
        final double oldPMP = ((artRes['p_achat_ht'] ?? 0) as num).toDouble();
        
        final double totalQtyNew = totalQtyOld + qte;
        double newPMP = oldPMP;
        if (totalQtyNew > 0) {
           newPMP = ( (oldPMP * totalQtyOld) + (priceHT * qte) ) / totalQtyNew;
        }

        await _client!.from('articles').update({
          'quantite': totalQtyNew,
          'p_achat_ht': newPMP
        }).eq('id', artId);
        
        // 5. Record Movement
        final orgId = await getOrganizationId();
        await _client!.from('mouvements').insert({
          if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
          'article_id': int.tryParse(artId.toString()) ?? 0,
          'date_mouvement': DateTime.now().toIso8601String().split('T')[0],
          'type': 'ENTREE',
          'stock_avant': stockAvant,
          'quantite': qte,
          'stock_apres': stockAvant + qte,
          'depot': depot,
          'prix': priceHT,
          'nr_doc': 'ACH-$realId',
          'utilisateur': 'MobileApp'
        });
      }
      
      // Log Activity
      await logActivity(
        actionType: 'CREATE',
        entityType: 'achat',
        entityId: realId,
        details: 'Nouvel achat #${data['nr_facture'] ?? realId} - Total: ${data['montant_total']}',
        username: 'MobileApp',
      );

      return true;
    } catch (e) {
      debugPrint('❌ createPurchaseDirect error: $e');
      return false;
    }
  }

  Future<bool> deletePurchaseDirect(String id) async {
    if (!_isInitialized) await init();
    try {
      final items = await _client!.from('achat_items').select('article_id, quantite').eq('achat_id', id);
      final purchase = await _client!.from('achats').select('depot_nom').eq('id', id).single();
      final String depot = purchase['depot_nom'] ?? 'Boutique';

      for (var item in items) {
        final String artId = item['article_id'];
        final double qte = ((item['quantite'] ?? 0) as num).toDouble();
        
        final stockData = await _client!.from('stocks').select('id, quantite').eq('article_id', artId).eq('depot_nom', depot).maybeSingle();
        if (stockData != null) {
          final double oldQty = ((stockData['quantite'] ?? 0) as num).toDouble();
          await _client!.from('stocks').update({'quantite': oldQty - qte}).eq('id', stockData['id']);
          
          // Record Movement
          final orgId = await getOrganizationId();
          await _client!.from('mouvements').insert({
            if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
            'article_id': int.tryParse(artId.toString()) ?? 0,
            'date_mouvement': DateTime.now().toIso8601String().split('T')[0],
            'type': 'SORTIE', // Reversal is a sortie or negative entry
            'stock_avant': oldQty,
            'quantite': -qte,
            'stock_apres': oldQty - qte,
            'depot': depot,
            'nr_doc': 'DEL-PUR-$id',
            'utilisateur': 'MobileApp',
            'sortie': qte,
            'entree': 0
          });

          // Sync Articles table aggregate
          final stockRes = await _client!.from('stocks').select('quantite').eq('article_id', artId);
          double totalQty = 0;
          for (var s in stockRes) {
            totalQty += ((s['quantite'] ?? 0) as num).toDouble();
          }
          await _client!.from('articles').update({'quantite': totalQty}).eq('id', artId);
        }
      }
      await _client!.from('achats').delete().eq('id', id);
      return true;
    } catch (e) {
      debugPrint('❌ deletePurchaseDirect error: $e');
      return false;
    }
  }

  Future<bool> updatePurchaseDirect(String id, Map<String, dynamic> data) async {
    if (!_isInitialized) await init();
    try {
      // 1. Get old items to reverse stock
      final oldItems = await _client!.from('achat_items').select('article_id, quantite').eq('achat_id', id);
      final purchase = await _client!.from('achats').select('depot_nom').eq('id', id).single();
      final String depot = purchase['depot_nom'] ?? 'Boutique';

      for (var item in oldItems) {
        final String artId = item['article_id'];
        final double qte = ((item['quantite'] ?? 0) as num).toDouble();
        final stockData = await _client!.from('stocks').select('id, quantite').eq('article_id', artId).eq('depot_nom', depot).maybeSingle();
        if (stockData != null) {
          final double oldQty = ((stockData['quantite'] ?? 0) as num).toDouble();
          await _client!.from('stocks').update({'quantite': oldQty - qte}).eq('id', stockData['id']);
          
          // Reversal movement
          final orgId = await getOrganizationId();
          await _client!.from('mouvements').insert({
            if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
            'article_id': int.tryParse(artId.toString()) ?? 0,
            'date_mouvement': DateTime.now().toIso8601String().split('T')[0],
            'type': 'SORTIE',
            'stock_avant': oldQty,
            'quantite': -qte,
            'stock_apres': oldQty - qte,
            'depot': depot,
            'nr_doc': 'REV-PUR-$id',
            'utilisateur': 'MobileApp',
            'sortie': qte,
            'entree': 0
          });
        }
      }

      // 2. Remove old items
      await _client!.from('achat_items').delete().eq('achat_id', id);

      // 3. Update header
      final items = data.remove('items') as List;
      await _client!.from('achats').update(data).eq('id', id);

      // 4. Insert new items and update stock
      for (var item in items) {
        final itemData = Map<String, dynamic>.from(item);
        itemData.remove('id');
        itemData['achat_id'] = int.tryParse(id) ?? 0;
        await _client!.from('achat_items').insert(itemData);

        // Update stock
        final String artId = itemData['article_id'];
        final double qte = ((itemData['quantite'] ?? 0) as num).toDouble();
        final stockData = await _client!.from('stocks').select('id, quantite').eq('article_id', artId).eq('depot_nom', depot).maybeSingle();
        double stockAvant = 0;
        if (stockData != null) {
          stockAvant = ((stockData['quantite'] ?? 0) as num).toDouble();
          await _client!.from('stocks').update({'quantite': stockAvant + qte}).eq('id', stockData['id']);
        } else {
          final orgId = await getOrganizationId();
          await _client!.from('stocks').insert({
            if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
            'article_id': int.tryParse(artId.toString()) ?? 0,
            'depot_nom': depot,
            'quantite': qte,
          });
        }

        // Record movement
        final orgId = await getOrganizationId();
        await _client!.from('mouvements').insert({
          if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
          'article_id': int.tryParse(artId.toString()) ?? 0,
          'date_mouvement': DateTime.now().toIso8601String().split('T')[0],
          'type': 'ENTREE',
          'stock_avant': stockAvant,
          'quantite': qte,
          'stock_apres': stockAvant + qte,
          'depot': depot,
          'nr_doc': 'UPD-PUR-$id',
          'utilisateur': 'MobileApp'
        });

        // Sync total quantity
        final stockRes = await _client!.from('stocks').select('quantite').eq('article_id', artId);
        double totalQty = 0;
        for (var s in stockRes) {
          totalQty += ((s['quantite'] ?? 0) as num).toDouble();
        }
        await _client!.from('articles').update({'quantite': totalQty}).eq('id', artId);
      }
      return true;
    } catch (e) {
      debugPrint('❌ updatePurchaseDirect error: $e');
      return false;
    }
  }
}
