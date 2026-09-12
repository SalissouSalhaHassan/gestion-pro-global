import 'package:flutter/foundation.dart';

class Invoice {
  final String id;
  final String blNumber;
  final String date;
  final String clientName;
  final double totalTTC;
  final double totalHT;
  final double totalTVA;
  final double tauxTVA;
  double montantPaye;
  String statut;
  final String clientId;
  final bool isPending;
  final double montantRestantInitial;
  final String vendeur;
  final String emplacement;

  Invoice({
    required this.id,
    required this.blNumber,
    required this.date,
    required this.clientId,
    required this.clientName,
    required this.totalTTC,
    required this.totalHT,
    required this.totalTVA,
    required this.tauxTVA,
    required this.montantPaye,
    required this.statut,
    required this.isPending,
    required this.montantRestantInitial,
    required this.vendeur,
    required this.emplacement,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    try {
      double toDouble(dynamic value) {
        if (value == null) return 0.0;
        if (value is num) return value.toDouble();
        return double.tryParse(value.toString()) ?? 0.0;
      }

      final String id = json['id']?.toString() ?? "";
      // إصلاح: جعل رقم BL آمناً بدون substring
      final bl = json['bl_number'] ?? json['bl'] ?? "FAC-${id.length > 8 ? id.substring(0, 8) : id}";
      final date = json['date_facture'] ?? json['date'] ?? "";
      
      String? cNom = json['client_nom'] ?? json['client_name'];
      if ((cNom == null || cNom.trim().isEmpty) && json['clients'] != null) {
        final clientsData = json['clients'];
        if (clientsData is Map) {
          cNom = clientsData['nom']?.toString();
        } else if (clientsData is List && clientsData.isNotEmpty) {
          cNom = clientsData[0]['nom']?.toString();
        }
      }

      return Invoice(
        id: id,
        blNumber: bl.toString(),
        date: date.toString(),
        clientId: (json['client_id'] ?? "").toString(),
        clientName: (cNom != null && cNom.isNotEmpty) ? cNom : "Client Inconnu",
        totalTTC: toDouble(json['total_ttc']),
        totalHT: toDouble(json['total_ht']),
        totalTVA: toDouble(json['total_tva']),
        tauxTVA: toDouble(json['taux_tva_facture'] ?? json['taux_tva'] ?? 0),
        montantPaye: toDouble(json['montant_paye']),
        statut: (json['statut'] ?? "Non payée").toString(),
        isPending: (json['pending'] == true),
        montantRestantInitial: toDouble(json['montant_restant']),
        vendeur: (json['vendeur'] ?? "").toString(),
        emplacement: (json['emplacement'] ?? "").toString(),
      );
    } catch (e) {
      debugPrint("❌ Error mapping Invoice: $e");
      return Invoice(
        id: "ERR", blNumber: "ERR", date: "", clientId: "", clientName: "Erreur",
        totalTTC: 0, totalHT: 0, totalTVA: 0, tauxTVA: 0, montantPaye: 0, statut: "Error", isPending: false,
        montantRestantInitial: 0, vendeur: "", emplacement: "",
      );
    }
  }
}
