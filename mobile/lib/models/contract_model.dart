class Contract {
  final int id;
  final String refLocataire;
  final String locataireNomComplet;
  final String? locataireTelephone;
  final String? locataireEmail;
  final String? locataireCni;
  final String? dateNaissance;
  final String? adresseComplete;
  final String? profession;
  final String? pieceJointe;
  final String? typeBien;
  final String bienLoueDetails;
  final String? quartier;
  final double loyerMensuel;
  final double caution;
  final int? anneeDebut;
  final int? moisDebut;
  final String statut;
  final double totalPaye;
  final double retards;
  final String moisImpayes;
  final String echeance;

  Contract({
    required this.id,
    required this.refLocataire,
    required this.locataireNomComplet,
    this.locataireTelephone,
    this.locataireEmail,
    this.locataireCni,
    this.dateNaissance,
    this.adresseComplete,
    this.profession,
    this.pieceJointe,
    this.typeBien,
    required this.bienLoueDetails,
    this.quartier,
    required this.loyerMensuel,
    required this.caution,
    this.anneeDebut,
    this.moisDebut,
    required this.statut,
    required this.totalPaye,
    required this.retards,
    required this.moisImpayes,
    required this.echeance,
  });

  factory Contract.fromJson(Map<String, dynamic> json) {
    return Contract(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      refLocataire: json['ref_locataire'] ?? "",
      locataireNomComplet: json['locataire_nom_complet'] ?? "",
      locataireTelephone: json['locataire_telephone'],
      locataireEmail: json['locataire_email'],
      locataireCni: json['locataire_cni'],
      dateNaissance: json['date_naissance'],
      adresseComplete: json['adresse_complete'],
      profession: json['profession'],
      pieceJointe: json['piece_jointe'],
      typeBien: json['type_bien'],
      bienLoueDetails: json['bien_loue_details'] ?? "",
      quartier: json['quartier'],
      loyerMensuel: (json['loyer_mensuel'] ?? 0.0).toDouble(),
      caution: (json['caution'] ?? 0.0).toDouble(),
      anneeDebut: json['annee_debut'] != null
          ? (json['annee_debut'] is int ? json['annee_debut'] : int.parse(json['annee_debut'].toString()))
          : null,
      moisDebut: json['mois_debut'] != null
          ? (json['mois_debut'] is int ? json['mois_debut'] : int.parse(json['mois_debut'].toString()))
          : null,
      statut: json['statut'] ?? "Actif",
      totalPaye: (json['total_paye'] ?? 0.0).toDouble(),
      retards: (json['retards'] ?? 0.0).toDouble(),
      moisImpayes: json['mois_impayes'] ?? "",
      echeance: json['echeance'] ?? "N/A",
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'locataire_nom_complet': locataireNomComplet,
      'ref_locataire': refLocataire,
      'locataire_telephone': locataireTelephone,
      'locataire_email': locataireEmail,
      'locataire_cni': locataireCni,
      'date_naissance': dateNaissance,
      'adresse_complete': adresseComplete,
      'profession': profession,
      'piece_jointe': pieceJointe,
      'type_bien': typeBien,
      'bien_loue_details': bienLoueDetails,
      'quartier': quartier,
      'loyer_mensuel': loyerMensuel,
      'caution': caution,
      'annee_debut': anneeDebut,
      'mois_debut': moisDebut,
      'statut': statut,
    };
  }

  Contract copyWith({
    int? id,
    String? refLocataire,
    String? locataireNomComplet,
    String? locataireTelephone,
    String? locataireEmail,
    String? locataireCni,
    String? dateNaissance,
    String? adresseComplete,
    String? profession,
    String? pieceJointe,
    String? typeBien,
    String? bienLoueDetails,
    String? quartier,
    double? loyerMensuel,
    double? caution,
    int? anneeDebut,
    int? moisDebut,
    String? statut,
    double? totalPaye,
    double? retards,
    String? moisImpayes,
    String? echeance,
  }) {
    return Contract(
      id: id ?? this.id,
      refLocataire: refLocataire ?? this.refLocataire,
      locataireNomComplet: locataireNomComplet ?? this.locataireNomComplet,
      locataireTelephone: locataireTelephone ?? this.locataireTelephone,
      locataireEmail: locataireEmail ?? this.locataireEmail,
      locataireCni: locataireCni ?? this.locataireCni,
      dateNaissance: dateNaissance ?? this.dateNaissance,
      adresseComplete: adresseComplete ?? this.adresseComplete,
      profession: profession ?? this.profession,
      pieceJointe: pieceJointe ?? this.pieceJointe,
      typeBien: typeBien ?? this.typeBien,
      bienLoueDetails: bienLoueDetails ?? this.bienLoueDetails,
      quartier: quartier ?? this.quartier,
      loyerMensuel: loyerMensuel ?? this.loyerMensuel,
      caution: caution ?? this.caution,
      anneeDebut: anneeDebut ?? this.anneeDebut,
      moisDebut: moisDebut ?? this.moisDebut,
      statut: statut ?? this.statut,
      totalPaye: totalPaye ?? this.totalPaye,
      retards: retards ?? this.retards,
      moisImpayes: moisImpayes ?? this.moisImpayes,
      echeance: echeance ?? this.echeance,
    );
  }
}
