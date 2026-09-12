class RentPayment {
  final int id;
  final int contratId;
  final String datePaiement;
  final double montant;
  final String modePaiement;
  final String? description;
  final String? nomDeMois;
  final int? qteMois;
  final String? periodeDebut;
  final String? periodeFin;
  final String? locataireNomComplet;
  final String? bienLoueDetails;
  final String? refLocataire;

  RentPayment({
    required this.id,
    required this.contratId,
    required this.datePaiement,
    required this.montant,
    required this.modePaiement,
    this.description,
    this.nomDeMois,
    this.qteMois,
    this.periodeDebut,
    this.periodeFin,
    this.locataireNomComplet,
    this.bienLoueDetails,
    this.refLocataire,
  });

  factory RentPayment.fromJson(Map<String, dynamic> json) {
    return RentPayment(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      contratId: json['contrat_id'] is int ? json['contrat_id'] : int.parse(json['contrat_id'].toString()),
      datePaiement: json['date_paiement'] ?? "",
      montant: (json['montant'] ?? 0.0).toDouble(),
      modePaiement: json['mode_paiement'] ?? "",
      description: json['description'],
      nomDeMois: json['nom_de_mois'],
      qteMois: json['qte_mois'] != null
          ? (json['qte_mois'] is int ? json['qte_mois'] : int.parse(json['qte_mois'].toString()))
          : null,
      periodeDebut: json['periode_debut'],
      periodeFin: json['periode_fin'],
      locataireNomComplet: json['locataire_nom_complet'],
      bienLoueDetails: json['bien_loue_details'],
      refLocataire: json['ref_locataire'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'contrat_id': contratId,
      'date_paiement': datePaiement,
      'montant': montant,
      'mode_paiement': modePaiement,
      'description': description,
      'nom_de_mois': nomDeMois,
      'qte_mois': qteMois,
      'periode_debut': periodeDebut,
      'periode_fin': periodeFin,
    };
  }
}
