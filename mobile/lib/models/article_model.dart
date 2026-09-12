import 'dart:convert';
import 'package:flutter/foundation.dart';

class Article {
  final String id;
  final String reference;
  final String? codeBarre;
  final String designation;
  final double prixVenteHT;
  final double taxe;

  // الكمية الإجمالية
  final double quantite;

  // خريطة لتخزين اسم المستودع وكميته ديناميكياً
  final Map<String, double> depotStocks;

  // تفاصيل الكميات (للإبقاء على التوافق إذا لزم الأمر)
  double get qteBoutique => depotStocks['Boutique'] ?? 0;
  double get qteMagasin => depotStocks['Magasin'] ?? 0;
  double get qteDepot1 => depotStocks['Dépôt 1'] ?? 0;
  double get qteDepot2 => depotStocks['Dépôt 2'] ?? 0;

  double get prixVenteTTC => prixVenteHT * (1 + taxe / 100);
  double get prixVente => prixVenteTTC;

  /// Returns the sum of stock for the given list of depot names.
  /// If the list is empty, it returns 0 for non-admins, but we handle that in the UI.
  double getStockForDepots(List<String> authorizedDepots) {
    if (depotStocks.isEmpty) return quantite;
    if (authorizedDepots.isEmpty) return 0;
    double total = 0;
    for (var depot in authorizedDepots) {
      total += depotStocks[depot] ?? 0;
    }
    return total;
  }
  
  // Getter for absolute total from all parsed depots (ignoring permissions)
  double get totalAllDepotsStock {
    if (depotStocks.isEmpty) return quantite; // Fallback to global if map empty
    return depotStocks.values.fold(0.0, (sum, val) => sum + val);
  }

  Article({
    required this.id,
    required this.reference,
    this.codeBarre,
    required this.designation,
    required this.prixVenteHT,
    required this.taxe,
    required this.quantite,
    this.depotStocks = const {},
  });

  factory Article.fromJson(Map<String, dynamic> json) {
    if (kDebugMode) {
      print("--- RAW ARTICLE DATA ---");
      print(jsonEncode(json));
      print("------------------------");
    }

    // Initialize with EMPTY map. 
    // Do NOT pre-fill with "Principal", "Boutique" etc. 
    // This fixes the issue where old/ghost depots appear.
    Map<String, double> stocks = {};

    // 1. Force overlay from 'stocks' list if present (Preferred Dynamic Way)
    if (json['stocks'] != null && json['stocks'] is List) {
      for (var stock in json['stocks']) {
        // Use the EXACT name from server. Do not "canonicalize" or change it.
        String? name = stock['depot_nom'] ?? stock['depot'] ?? stock['name'];
        name = name?.toString().trim();
        var qVal = stock['quantite'];
        double qty = double.tryParse(qVal?.toString() ?? '0') ?? 0.0;

        if (name != null && name.isNotEmpty) {
           stocks[name] = qty;
        }
      }
    }
    // 2. Fallback: Check for flatten keys ONLY if dynamic list is missing or empty
    // This is for very old API versions, but we prioritize the list above.
    if (stocks.isEmpty) {
      dynamic _toDbl(dynamic v) => (double.tryParse(v?.toString() ?? '0') ?? 0.0);
      
      if (json['qte_boutique'] != null) stocks['Boutique'] = _toDbl(json['qte_boutique']);
      if (json['qte_magasin'] != null) stocks['Magasin'] = _toDbl(json['qte_magasin']);
      if (json['qte_depot1'] != null) stocks['Dépôt 1'] = _toDbl(json['qte_depot1']);
      if (json['qte_depot2'] != null) stocks['Dépôt 2'] = _toDbl(json['qte_depot2']);
    }

    // Debug: verify parsed stocks
    if (kDebugMode && json['stocks'] != null) {
      print("--- PARSED STOCKS ---");
      stocks.forEach((key, value) {
        print("Depot: '$key' -> $value");
      });
      print("---------------------");
    }

    double toDouble(dynamic value) {
      if (value == null) return 0.0;
      if (value is num) return value.toDouble();
      return double.tryParse(value.toString()) ?? 0.0;
    }

    return Article(
      id: json['id'].toString(),
      reference: json['reference']?.toString() ?? '',
      codeBarre: (json['code_barre'] ?? json['codebarre'])?.toString(),
      designation: (json['designation'] ?? json['name'] ?? '').toString(),
      prixVenteHT: toDouble(json['p_vente_ttc'] ?? json['p_vente_ht'] ?? json['prix_vente'] ?? json['price'] ?? 0),
      taxe: toDouble(json['taxe'] ?? 0.0),
      quantite: toDouble(json['quantite'] ?? json['qte'] ?? 0),
      depotStocks: stocks,
    );
  }
}
