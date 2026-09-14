import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../supabase_service.dart';
import '../../config/app_config.dart';
import '../../services/offline_queue_service.dart';

class ArticleService {
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

  /// Get articles with Next.js API -> Supabase Fallback -> Local SQLite Caching
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
    try {
      debugPrint('ArticleService: START getArticles directly');
      final effectiveToken = await _getEffectiveToken(token);
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId'] as String?;

      final uri = Uri.parse('$_baseUrl/api/articles');
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

      debugPrint('ArticleService: Response status: ${response.statusCode}');

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final List items = data['items'] ?? [];
        if (items.isNotEmpty) {
          OfflineQueueService().cacheArticles(items);
        }
        return items;
      } else {
        throw Exception('HTTP ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('ArticleService: ERROR in getArticles: $e');

      // 2. Supabase Fallback
      if (await _ensureSupabaseReady()) {
        try {
          final authCtx = await _getAuthContext();
          final effectiveIsAdmin = isAdmin || (authCtx['isAdmin'] ?? false);
          final effectiveUserId = userId ?? authCtx['userId'];
          final effectiveDepots = allowedDepots ?? (authCtx['allowedDepots'] as List<String>?);

          debugPrint('ArticleService: Supabase getArticlesWithStocks fallback');
          final supaItems = await _supabaseService.getArticlesWithStocks(
            search: search,
            userId: effectiveUserId,
            allowedDepots: effectiveDepots,
            isAdmin: effectiveIsAdmin,
          );
          if (supaItems.isNotEmpty) {
            OfflineQueueService().cacheArticles(supaItems);
          }
          return supaItems;
        } catch (supaErr) {
          debugPrint('ArticleService: Supabase getArticles failed: $supaErr');
        }
      }

      // 3. SQLite Offline Cache
      final cachedArticles = await OfflineQueueService().getCachedArticles(search: search);
      if (cachedArticles.isNotEmpty) {
        debugPrint('📦 ArticleService: Loaded ${cachedArticles.length} articles from local SQLite cache');
        return cachedArticles;
      }
      return [];
    }
  }

  /// Create article with initial stock and price history, strictly scoped by organization_id
  Future<void> addArticleWithImage(Map<String, String> fields, String? image, String token) async {
    if (await _ensureSupabaseReady()) {
      final authCtx = await _getAuthContext();
      final bool isAdmin = authCtx['isAdmin'] ?? false;
      if (!isAdmin) {
        throw Exception('Action non autorisée: droits Administrateur requis');
      }

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
        } else if ([
          'p_achat_ht',
          'p_achat_ttc',
          'p_vente_ht',
          'p_vente_ttc',
          'taxe',
          'quantite',
          'stock_min',
          'stock_alerte',
          'qte_min'
        ].contains(k)) {
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
        'utilisateur': fields['utilisateur'] ?? authCtx['username'] ?? 'MobileApp',
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
            final double q = ((s['quantite'] ?? 0) as num).toDouble();
            moveInserts.add({
              'id': const Uuid().v4(),
              'article_id': id,
              if (orgId != null && orgId.isNotEmpty) 'organization_id': orgId,
              'date_mouvement': DateTime.now().toIso8601String().split('T')[0],
              'type': 'ENTREE',
              'quantite': q,
              'stock_avant': 0.0,
              'stock_apres': q,
              'entree': q,
              'sortie': 0.0,
              'depot': s['depot_nom'] ?? '',
              'nr_doc': 'STOCK-INIT',
              'utilisateur': data['utilisateur'] ?? authCtx['username'] ?? 'MobileApp',
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
        username: fields['utilisateur'] ?? authCtx['username'] ?? 'Admin',
      );
    }
  }

  /// Update article
  Future<bool> updateArticle(String id, Map<String, dynamic> data, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
        var q = _supabaseService.client!.from('articles').update(data).eq('id', id);
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        await q;
        return true;
      } catch (e) {
        debugPrint('ArticleService: updateArticle error: $e');
      }
    }
    return false;
  }

  /// Soft delete article
  Future<bool> deleteArticle(String id, String token) async {
    if (await _ensureSupabaseReady()) {
      try {
        final authCtx = await _getAuthContext();
        final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
        var q = _supabaseService.client!
            .from('articles')
            .update({'is_deleted': true})
            .eq('id', id);
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        await q;
        return true;
      } catch (e) {
        debugPrint('ArticleService: deleteArticle error: $e');
      }
    }
    return false;
  }
}
