class Supplier {
  final String? id;
  final String? reference; // ref_fournisseur
  final String name;
  final String? contact; // person to contact
  final String? phone; // tel
  final String? gsm;
  final String? email;
  final String? address;
  final String? website; // site
  final double balance; // credit
  
  Supplier({
    this.id,
    this.reference,
    required this.name,
    this.contact,
    this.phone,
    this.gsm,
    this.email,
    this.address,
    this.website,
    this.balance = 0.0,
  });

  factory Supplier.fromJson(Map<String, dynamic> json) {
    return Supplier(
      id: json['id']?.toString(),
      reference: json['ref_fournisseur'] ?? json['reference'],
      name: json['nom'] ?? json['name'] ?? 'Inconnu',
      contact: json['contact'],
      phone: json['tel'] ?? json['telephone'] ?? json['phone'],
      gsm: json['gsm'],
      email: json['email'],
      address: json['adresse'] ?? json['address'],
      website: json['site'] ?? json['website'],
      balance: double.tryParse(json['credit']?.toString() ?? json['balance']?.toString() ?? json['solde']?.toString() ?? '0') ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'ref_fournisseur': reference,
      'nom': name,
      'contact': contact,
      'tel': phone,
      'gsm': gsm,
      'adresse': address,
      'email': email,
      'site': website,
      'credit': balance, // Note: For Supabase, credit is used instead of solde
    };
  }
}
