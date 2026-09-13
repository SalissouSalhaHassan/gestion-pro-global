class CompanyInfo {
  final String nom;
  final String adresse;
  final String tel;
  final String email;
  final String nif;
  final String rc;
  final String? notesPiedFacture;
  final String? cachetUrl;
  final bool showQrCode;
  final bool showStamp;

  CompanyInfo({
    required this.nom,
    required this.adresse,
    required this.tel,
    required this.email,
    required this.nif,
    required this.rc,
    this.notesPiedFacture,
    this.cachetUrl,
    this.showQrCode = true,
    this.showStamp = true,
  });

  factory CompanyInfo.fromJson(Map<String, dynamic> json) {
    return CompanyInfo(
      nom: json['nom_entreprise'] ?? json['nom'] ?? 'ETS SALISSOU SALHA',
      adresse: json['adresse'] ?? '',
      tel: json['telephone'] ?? json['tel'] ?? '',
      email: json['email'] ?? '',
      nif: json['nif'] ?? '',
      rc: json['rc'] ?? '',
      notesPiedFacture: json['notes_pied_facture'],
      cachetUrl: json['cachet_url'],
      showQrCode: json['show_qr_code'] != false,
      showStamp: json['show_stamp'] != false,
    );
  }
}
