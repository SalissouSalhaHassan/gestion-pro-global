import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../supabase_service.dart';
import '../../config/app_config.dart';

class StockService {
  final SupabaseService _supabaseService = SupabaseService();
  String get _baseUrl => AppConfig.apiUrl;

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

  Future<String?> _getEffectiveToken(String fallbackToken) async {
    const storage = FlutterSecureStorage();
    String? token = await storage.read(key: 'auth_token');
    if (token == null || token.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      token = prefs.getString('auth_token');
    }
    return token ?? fallbackToken;
  }

  /// Get stock journal movements strictly isolated by organization_id
  Future<List<dynamic>> getStockMovements({
    required String token,
    String? startDate,
    String? endDate,
    String? depot,
    String? search,
    String? articleId,
  }) async {
    final authCtx = await _getAuthContext();
    final bool isAdmin = authCtx['isAdmin'] ?? false;
    final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>? ?? []);
    final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

    if (!isAdmin && allowedDepots.isEmpty) return [];

    // 1. Try Next.js API first
    try {
      final effectiveToken = await _getEffectiveToken(token);
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
      debugPrint('[StockService] /api/stock/mouvements failed ($e), falling back to Supabase');
    }

    // 2. Direct Supabase Fallback
    final client = _supabaseService.client;
    if (client != null) {
      var q = client.from('mouvements').select('*, articles(reference, designation)');
      if (orgId != null && orgId.isNotEmpty) q = q.eq('organization_id', orgId);
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
          var artQ = client.from('articles').select('id');
          if (orgId != null && orgId.isNotEmpty) artQ = artQ.eq('organization_id', orgId);
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

  /// Adjust stock with atomic balance updates and movement logging
  Future<void> adjustStock(String articleId, double quantity, String depot, String date, String token) async {
    final client = _supabaseService.client;
    if (client == null) return;

    final authCtx = await _getAuthContext();
    final username = authCtx['username']?.toString() ?? 'System';
    final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

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

    // Record movement
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
      debugPrint('[StockService] Stock adjustment movement insert failed: $e');
    }

    await _supabaseService.logActivity(
      actionType: 'AJUSTEMENT',
      entityType: 'stock',
      entityId: articleId,
      details: 'Ajustement de $quantity dans $depot',
      username: username,
    );
  }

  /// Transfer stock between two depots
  Future<Map<String, dynamic>> transferStock(String articleId, String source, String dest, double quantity, String date, String token) async {
    await adjustStock(articleId, -quantity, source, date, token);
    await adjustStock(articleId, quantity, dest, date, token);

    await _supabaseService.logActivity(
      actionType: 'TRANSFERT',
      entityType: 'stock',
      entityId: articleId,
      details: 'Transfert de $quantity de $source vers $dest',
      username: 'Admin',
    );

    return {'success': true, 'source_stock': 0, 'destination_stock': 0};
  }

  /// Get detailed depot list scoped by organization
  Future<List<dynamic>> getDepotsDetailed(String token) async {
    final client = _supabaseService.client;
    if (client == null) return [];

    final authCtx = await _getAuthContext();
    final bool isAdmin = authCtx['isAdmin'];
    final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
    final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

    var q = client.from('depots').select();
    if (orgId != null && orgId.isNotEmpty) q = q.eq('organization_id', orgId);

    if (isAdmin) {
      return await q.order('nom');
    } else if (allowedDepots.isNotEmpty) {
      return await q.inFilter('nom', allowedDepots).order('nom');
    }
    return [];
  }

  /// Fetch all active depot names
  Future<List<String>> fetchAllActiveDepots() async {
    final client = _supabaseService.client;
    if (client == null) return [];
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

  /// Get active depot names for user
  Future<List<String>> getDepots(String token) async {
    final client = _supabaseService.client;
    if (client != null) {
      final authCtx = await _getAuthContext();
      final bool isAdmin = authCtx['isAdmin'];
      final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

      if (isAdmin) {
        return await fetchAllActiveDepots();
      } else if (allowedDepots.isNotEmpty) {
        var q = client.from('depots').select('nom');
        if (orgId != null && orgId.isNotEmpty) {
          q = q.eq('organization_id', orgId);
        }
        final data = await q.inFilter('nom', allowedDepots).order('nom');
        return (data as List).map((e) => e['nom'].toString()).toList();
      } else {
        return [];
      }
    }
    return ["Principal"];
  }

  /// Get active depots rows
  Future<List<dynamic>> getActiveDepots(String token) async {
    final client = _supabaseService.client;
    if (client != null) {
      final authCtx = await _getAuthContext();
      final bool isAdmin = authCtx['isAdmin'];
      final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();

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

  /// Get full stock inventory
  Future<List<dynamic>> getStocks({String? token}) async {
    final client = _supabaseService.client;
    if (client != null) {
      try {
        final authCtx = await _getAuthContext();
        final bool isAdmin = authCtx['isAdmin'];
        final List<String> allowedDepots = _normalizeDepotNames(authCtx['allowedDepots'] as List<String>);
        if (!isAdmin && allowedDepots.isEmpty) return [];

        var q = client.from('stocks').select('*, articles(reference, designation)');
        if (!isAdmin) q = q.inFilter('depot_nom', allowedDepots);
        return await q.order('depot_nom');
      } catch (e) {
        debugPrint('[StockService] getStocks error: $e');
        return [];
      }
    }
    return [];
  }

  /// Save or create a depot
  Future<void> saveDepot(Map<String, dynamic> data, String token) async {
    final client = _supabaseService.client;
    if (client != null) {
      final authCtx = await _getAuthContext();
      final orgId = authCtx['organizationId']?.toString() ?? await _supabaseService.getOrganizationId();
      if (data['id'] != null) {
        final id = data.remove('id');
        await client.from('depots').update(data).eq('id', id);
      } else {
        final payload = Map<String, dynamic>.from(data);
        payload['id'] = const Uuid().v4();
        if (orgId != null && orgId.isNotEmpty && !payload.containsKey('organization_id')) {
          payload['organization_id'] = orgId;
        }
        await client.from('depots').insert(payload);
      }
    }
  }

  /// Delete a depot
  Future<void> deleteDepot(String id, String token) async {
    final client = _supabaseService.client;
    if (client != null) {
      await client.from('depots').delete().eq('id', id);
    }
  }
}
