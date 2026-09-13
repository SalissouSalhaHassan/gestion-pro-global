class Client {
  final String id;
  final String nom;
  final String telephone;
  final String adresse;
  final String email;
  final String siteWeb;
  final String personneContact;
  final String gsm;
  final String fax;
  final String ice;
  final String rc;
  final String nif;
  final String patente;
  final String compteBancaire;
  final String nomCommercial;
  final double montantPlafond;
  final String prePaiement;
  final double solde;

  Client({
    required this.id,
    required this.nom,
    required this.telephone,
    required this.adresse,
    this.email = "",
    this.siteWeb = "",
    this.personneContact = "",
    this.gsm = "",
    this.fax = "",
    this.ice = "",
    this.rc = "",
    this.nif = "",
    this.patente = "",
    this.compteBancaire = "",
    this.nomCommercial = "",
    this.montantPlafond = 0.0,
    this.prePaiement = "false",
    required this.solde,
  });

  factory Client.fromJson(Map<String, dynamic> json) {
    return Client(
      id: json['id'].toString(),
      nom: json['nom'] ?? "",
      telephone: json['telephone'] ?? json['tel'] ?? "",
      adresse: json['adresse'] ?? "",
      email: json['email'] ?? "",
      siteWeb: json['site_web'] ?? json['site'] ?? "",
      personneContact: json['personne_contact'] ?? json['contact'] ?? "",
      gsm: json['gsm'] ?? "",
      fax: json['fax'] ?? "",
      ice: json['ice'] ?? "",
      rc: json['rc'] ?? "",
      nif: json['nif'] ?? "",
      patente: json['patente'] ?? "",
      compteBancaire: json['compte_bancaire'] ?? json['n_compte'] ?? "",
      nomCommercial: json['nom_commercial'] ?? json['commerciale'] ?? "",
      montantPlafond: (json['montant_plafond'] is num)
          ? (json['montant_plafond'] as num).toDouble()
          : (double.tryParse(json['montant_plafond']?.toString() ?? '0') ?? 0.0),
      prePaiement: (json['pre_paiement'] ?? json['pre_client'] ?? "false").toString(),
      solde: (num.tryParse(json['credit_facture']?.toString() ?? '') ??
              num.tryParse(json['solde']?.toString() ?? '') ??
              0)
          .toDouble(),
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      "nom": nom,
      "tel": telephone,
      "email": email,
      "site": siteWeb,
      "contact": personneContact,
      "gsm": gsm,
      "fax": fax,
      "ice": ice,
      "rc": rc,
      "nif": nif,
      "patente": patente,
      "art_imp": "", // Placeholder if not in model yet
      "n_compte": compteBancaire,
      "commerciale": nomCommercial,
      "montant_plafond": montantPlafond,
      "pre_client": prePaiement == "true" || prePaiement == "t",
      "adresse": adresse,
    };
  }
}
