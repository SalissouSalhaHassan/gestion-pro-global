class StockMovement {
  final String id;
  final String date;
  final String codeArticle;
  final String designation;
  final String operation;
  final String noDoc;
  final String tiers;
  final String depot;
  final String responsable;
  final double stockAvant;
  final double mouvement;
  final double stockApres;

  StockMovement({
    required this.id,
    required this.date,
    required this.codeArticle,
    required this.designation,
    required this.operation,
    required this.noDoc,
    required this.tiers,
    required this.depot,
    required this.responsable,
    required this.stockAvant,
    required this.mouvement,
    required this.stockApres,
  });

  factory StockMovement.fromJson(Map<String, dynamic> json) {
    double toDouble(dynamic v) {
      if (v == null) return 0.0;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString()) ?? 0.0;
    }

    final depot = (json['depot'] ??
            json['depot_nom'] ??
            json['depot_source'] ??
            json['depot_destination'] ??
            '')
        .toString();

    final date = (json['date'] ??
            json['date_mouvement'] ??
            json['created_at'] ??
            '')
        .toString();

    double mouvementVal = toDouble(json['mouvement']);
    if (mouvementVal == 0.0) {
      final q = json['quantite'] ?? json['quantity'];
      mouvementVal = toDouble(q);
      final entree = toDouble(json['entree']);
      final sortie = toDouble(json['sortie']);
      if (entree != 0.0 || sortie != 0.0) {
        mouvementVal = entree - sortie;
      }
    }

    double stockAvantVal = toDouble(json['stock_avant'] ?? json['stock_before']);
    double stockApresVal = toDouble(json['stock_apres'] ?? json['stock_after']);
    if (stockAvantVal == 0.0 && stockApresVal == 0.0 && mouvementVal != 0.0) {
      stockApresVal = stockAvantVal + mouvementVal;
    }

    return StockMovement(
      id: json['id']?.toString() ?? "",
      date: date,
      codeArticle: (json['code_article'] ?? json['reference'] ?? "").toString(),
      designation: (json['designation'] ?? json['article_name'] ?? "").toString(),
      operation: (json['operation'] ?? json['type'] ?? "").toString(),
      noDoc: (json['no_doc'] ?? json['nr_doc'] ?? json['reference'] ?? "-").toString(),
      tiers: (json['tiers'] ?? json['fournisseur_client'] ?? "-").toString(),
      depot: depot,
      responsable: (json['responsable'] ?? json['responsable_name'] ?? json['utilisateur'] ?? "Systeme").toString(),
      stockAvant: stockAvantVal,
      mouvement: mouvementVal,
      stockApres: stockApresVal,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'date': date,
      'code_article': codeArticle,
      'designation': designation,
      'operation': operation,
      'no_doc': noDoc,
      'tiers': tiers,
      'depot': depot,
      'responsable': responsable,
      'stock_avant': stockAvant,
      'mouvement': mouvement,
      'stock_apres': stockApres,
    };
  }
}
