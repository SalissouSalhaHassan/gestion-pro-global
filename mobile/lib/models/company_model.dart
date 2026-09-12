class CompanyInfo {
  final String nom;
  final String adresse;
  final String tel;
  final String email;
  final String nif;
  final String rc;

  CompanyInfo({
    required this.nom,
    required this.adresse,
    required this.tel,
    required this.email,
    required this.nif,
    required this.rc,
  });

  factory CompanyInfo.fromJson(Map<String, dynamic> json) {
    return CompanyInfo(
      nom: json['nom_entreprise'] ?? 'Mon Entreprise',
      adresse: json['adresse'] ?? '',
      tel: json['telephone'] ?? '',
      email: json['email'] ?? '',
      nif: json['nif'] ?? '',
      rc: json['rc'] ?? '',
    );
  }
}
