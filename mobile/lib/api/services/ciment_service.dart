import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../supabase_service.dart';
import '../../config/app_config.dart';

class CimentService {
  static final CimentService _instance = CimentService._internal();
  factory CimentService() => _instance;
  CimentService._internal();

  final SupabaseService _supabaseService = SupabaseService();
  String get _baseUrl => AppConfig.apiUrl;

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

  Future<Map<String, dynamic>> _getAuthContext() async {
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('auth_role') ?? 'vendeur';
    final isAdmin = (role.toLowerCase() == 'admin' || role.toLowerCase() == 'administrateur');
    final userId = prefs.getString('auth_userId');
    final username = prefs.getString('auth_username');
    final orgId = prefs.getString('auth_organizationId') ?? await _supabaseService.getOrganizationId();
    return {
      'isAdmin': isAdmin,
      'userId': userId,
      'username': username,
      'organizationId': orgId,
    };
  }

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
      debugPrint('CimentService: getCimentShipments fallback to Supabase: $e');
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
          debugPrint('CimentService: Supabase Ciment Shipments error: $sbErr');
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
      debugPrint('CimentService: addCimentShipment fallback to Supabase: $e');
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
      debugPrint('CimentService: updateCimentShipment fallback to Supabase: $e');
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
      debugPrint('CimentService: deleteCimentShipment fallback to Supabase: $e');
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
      debugPrint('CimentService: getCimentPayments fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        try {
          final data = await _supabaseService.client!
              .from('ciment_paiements')
              .select('*')
              .eq('ciment_id', shipmentId)
              .order('date_paiement', ascending: false);
          return data as List<dynamic>;
        } catch (sbErr) {
          debugPrint('CimentService: Supabase Ciment Payments error: $sbErr');
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
      debugPrint('CimentService: addCimentPayment fallback to Supabase: $e');
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
          final shipmentRow = await _supabaseService.client!
              .from('gestion_ciment')
              .select('client_tel')
              .eq('id', shipmentId)
              .single();
          final clientTel = shipmentRow['client_tel'] as String;

          final clientRow = await _supabaseService.client!
              .from('clients')
              .select('id')
              .or('tel.eq.$clientTel,nom.eq.$clientTel')
              .limit(1)
              .single();
          final clientId = clientRow['id'];

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

          double remainingToPay = amount;
          for (var adv in advances) {
            if (remainingToPay <= 0) break;

            final double advRem = (double.tryParse(adv['montant_restant'].toString()) ?? 0.0);
            final double deduct = remainingToPay < advRem ? remainingToPay : advRem;
            final double newRem = double.parse((advRem - deduct).toStringAsFixed(2));
            final String newStat = newRem <= 0 ? 'Utilisée' : 'Partiellement utilisée';

            await _supabaseService.client!
                .from('avances_clients')
                .update({'montant_restant': newRem, 'statut': newStat})
                .eq('id', adv['id']);

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
      debugPrint('CimentService: deleteCimentPayment fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        final payData = await _supabaseService.client!
            .from('ciment_paiements')
            .select('*')
            .eq('id', paymentId)
            .single();
        
        final String shipmentId = payData['ciment_id'].toString();
        final String moyen = payData['moyen_paiement'].toString();

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

            final adv = await _supabaseService.client!
                .from('avances_clients')
                .select('montant_restant, montant_initial')
                .eq('id', advId)
                .single();
            
            final double advRem = (double.tryParse(adv['montant_restant'].toString()) ?? 0.0);
            final double advInit = (double.tryParse(adv['montant_initial'].toString()) ?? 0.0);
            final double newRem = double.parse((advRem + uMnt).toStringAsFixed(2));
            final String newStat = newRem >= advInit ? "Disponible" : "Partiellement utilisée";

            await _supabaseService.client!
                .from('avances_clients')
                .update({'montant_restant': newRem, 'statut': newStat})
                .eq('id', advId);

            await _supabaseService.client!.from('paiements').delete().eq('id', u['id']);
          }
        }

        await _supabaseService.client!.from('ciment_paiements').delete().eq('id', paymentId);

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
