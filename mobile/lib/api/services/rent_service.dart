import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../supabase_service.dart';
import '../../config/app_config.dart';

class RentService {
  static final RentService _instance = RentService._internal();
  factory RentService() => _instance;
  RentService._internal();

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
      debugPrint('RentService: getContracts fallback to Supabase: $e');
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
          debugPrint('RentService: Supabase Contracts error: $sbErr');
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
      debugPrint('RentService: getContractDetails fallback to Supabase: $e');
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
          debugPrint('RentService: Supabase Contract details error: $sbErr');
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
      debugPrint('RentService: addContract fallback to Supabase: $e');
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
      debugPrint('RentService: updateContract fallback to Supabase: $e');
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
      debugPrint('RentService: deleteContract fallback to Supabase: $e');
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
      debugPrint('RentService: getRentPayments fallback to Supabase: $e');
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
          debugPrint('RentService: Supabase Payments error: $sbErr');
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
      debugPrint('RentService: getRentPaymentsForContract fallback to Supabase: $e');
      if (await _ensureSupabaseReady()) {
        try {
          return await _supabaseService.client!
              .from('contrat_paiements')
              .select('*')
              .eq('contrat_id', contractId)
              .order('id', ascending: false);
        } catch (sbErr) {
          debugPrint('RentService: Supabase Contract Payments error: $sbErr');
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
      debugPrint('RentService: addRentPayment fallback to Supabase: $e');
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
      debugPrint('RentService: deleteRentPayment error: $e');
      rethrow;
    }
  }
}
