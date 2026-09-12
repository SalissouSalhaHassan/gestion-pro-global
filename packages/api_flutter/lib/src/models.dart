class Article {
  final int id;
  final String reference;
  final String designation;
  final String? codeBarre;
  final double pAchatHt;
  final double pVenteTtc;
  final String unite;
  final int? categorieId;
  final bool isDeleted;
  final double? quantite;
  final String? createdAt;
  final List<dynamic>? stocks;

  Article({
    required this.id,
    required this.reference,
    required this.designation,
    this.codeBarre,
    required this.pAchatHt,
    required this.pVenteTtc,
    required this.unite,
    this.categorieId,
    required this.isDeleted,
    this.quantite,
    this.createdAt,
    this.stocks,
  });

  factory Article.fromJson(Map<String, dynamic> json) {
    return Article(
      id: json['id'],
      reference: json['reference'] ?? '',
      designation: json['designation'] ?? '',
      codeBarre: json['code_barre'],
      pAchatHt: (json['p_achat_ht'] as num?)?.toDouble() ?? 0.0,
      pVenteTtc: (json['p_vente_ttc'] as num?)?.toDouble() ?? 0.0,
      unite: json['unite'] ?? 'Unité',
      categorieId: json['categorie_id'],
      isDeleted: json['is_deleted'] ?? false,
      quantite: (json['quantite'] as num?)?.toDouble(),
      createdAt: json['created_at'],
      stocks: json['stocks'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'reference': reference,
      'designation': designation,
      'code_barre': codeBarre,
      'p_achat_ht': pAchatHt,
      'p_vente_ttc': pVenteTtc,
      'unite': unite,
      'categorie_id': categorieId,
      'is_deleted': isDeleted,
      'quantite': quantite,
      'created_at': createdAt,
      'stocks': stocks,
    };
  }


}

class Depot {
  final int id;
  final String nom;
  final String? adresse;
  final bool isActive;

  Depot({
    required this.id,
    required this.nom,
    this.adresse,
    required this.isActive,
  });

  factory Depot.fromJson(Map<String, dynamic> json) {
    return Depot(
      id: json['id'],
      nom: json['nom'],
      adresse: json['adresse'],
      isActive: json['is_active'] ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'nom': nom,
      'adresse': adresse,
      'is_active': isActive,
    };
  }
}
