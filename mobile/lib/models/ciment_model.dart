class CimentShipment {
  final String id;
  final String clientTel;
  final String camionNo;
  final String? transporteur;
  final String? typeCiment;
  final String destination;
  final String? chauffeur;
  final String? chauffeurTel;
  final String? bons;
  final String? arrivage;
  final double tonnage;
  final double pu;
  final double fraisCiment;
  final double fraisTransport;
  final double tvaPourcentage;
  final double bicPourcentage;
  final double total;
  final double montantPaye;
  final String statutPaiement;
  final String? utilisateur;
  final String? userId;
  final String createdAt;
  final String updatedAt;

  CimentShipment({
    required this.id,
    required this.clientTel,
    required this.camionNo,
    this.transporteur,
    this.typeCiment,
    required this.destination,
    this.chauffeur,
    this.chauffeurTel,
    this.bons,
    this.arrivage,
    required this.tonnage,
    required this.pu,
    this.fraisCiment = 0.0,
    this.fraisTransport = 0.0,
    this.tvaPourcentage = 19.0,
    this.bicPourcentage = 2.0,
    required this.total,
    this.montantPaye = 0.0,
    required this.statutPaiement,
    this.utilisateur,
    this.userId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory CimentShipment.fromJson(Map<String, dynamic> json) {
    return CimentShipment(
      id: json['id'].toString(),
      clientTel: json['client_tel'] ?? "",
      camionNo: json['camion_no'] ?? "",
      transporteur: json['transporteur'],
      typeCiment: json['type_ciment'],
      destination: json['destination'] ?? "",
      chauffeur: json['chauffeur'],
      chauffeurTel: json['chauffeur_tel'],
      bons: json['bons'],
      arrivage: json['arrivage'],
      tonnage: (json['tonnage'] ?? 0.0).toDouble(),
      pu: (json['pu'] ?? 0.0).toDouble(),
      fraisCiment: (json['frais_ciment'] ?? 0.0).toDouble(),
      fraisTransport: (json['frais_transport'] ?? 0.0).toDouble(),
      tvaPourcentage: (json['tva_pourcentage'] ?? 19.0).toDouble(),
      bicPourcentage: (json['bic_pourcentage'] ?? 2.0).toDouble(),
      total: (json['total'] ?? 0.0).toDouble(),
      montantPaye: (json['montant_paye'] ?? 0.0).toDouble(),
      statutPaiement: json['statut_paiement'] ?? "Non Payé",
      utilisateur: json['utilisateur'],
      userId: json['user_id']?.toString(),
      createdAt: json['created_at'] ?? "",
      updatedAt: json['updated_at'] ?? "",
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'client_tel': clientTel,
      'camion_no': camionNo,
      'transporteur': transporteur,
      'type_ciment': typeCiment,
      'destination': destination,
      'chauffeur': chauffeur,
      'chauffeur_tel': chauffeurTel,
      'bons': bons,
      'arrivage': arrivage,
      'tonnage': tonnage,
      'pu': pu,
      'frais_ciment': fraisCiment,
      'frais_transport': fraisTransport,
      'tva_pourcentage': tvaPourcentage,
      'bic_pourcentage': bicPourcentage,
      'total': total,
      'montant_paye': montantPaye,
      'statut_paiement': statutPaiement,
      'utilisateur': utilisateur,
      'user_id': userId,
    };
  }
}

class CimentPayment {
  final String id;
  final String cimentId;
  final double montant;
  final String moyenPaiement;
  final String? reference;
  final String datePaiement;
  final String? utilisateur;
  final String? userId;
  final String createdAt;

  CimentPayment({
    required this.id,
    required this.cimentId,
    required this.montant,
    required this.moyenPaiement,
    this.reference,
    required this.datePaiement,
    this.utilisateur,
    this.userId,
    required this.createdAt,
  });

  factory CimentPayment.fromJson(Map<String, dynamic> json) {
    return CimentPayment(
      id: json['id'].toString(),
      cimentId: json['ciment_id'].toString(),
      montant: (json['montant'] ?? 0.0).toDouble(),
      moyenPaiement: json['moyen_paiement'] ?? "Espèces",
      reference: json['reference'],
      datePaiement: json['date_paiement'] ?? "",
      utilisateur: json['utilisateur'],
      userId: json['user_id']?.toString(),
      createdAt: json['created_at'] ?? "",
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'ciment_id': cimentId,
      'montant': montant,
      'moyen_paiement': moyenPaiement,
      'reference': reference,
      'date_paiement': datePaiement,
      'utilisateur': utilisateur,
      'user_id': userId,
    };
  }
}
