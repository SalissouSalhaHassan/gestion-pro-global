class AppUser {
  final String id;
  final String username;
  final String? nomPrenom;
  final String? langue;
  final String role; // "admin" or "vendeur"
  final List<String> depots; // Unauthorized if empty for non-admins

  AppUser({
    required this.id,
    required this.username,
    this.nomPrenom,
    this.langue,
    required this.role,
    this.depots = const [],
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    String roleStr = (json['role'] ?? json['admin'] ?? 'vendeur').toString().toLowerCase();
    String normalizedRole = (roleStr == 'oui' || roleStr == 'admin') ? 'admin' : 'vendeur';
    
    List<String> depotsList = [];
    if (json['user_depots'] is List) {
      for (final ud in (json['user_depots'] as List)) {
        final depot = ud is Map ? ud['depots'] : null;
        final name = (depot is Map ? depot['nom'] : null)?.toString();
        if (name != null && name.trim().isNotEmpty) depotsList.add(name.trim());
      }
    }
    if (depotsList.isEmpty && json['depots'] != null) {
      final depotsStr = json['depots'].toString();
      if (depotsStr.isNotEmpty) {
        depotsList = depotsStr.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
      }
    }

    return AppUser(
      id: json['id']?.toString() ?? "",
      username: json['username'] ?? json['utilisateur'] ?? '',
      nomPrenom: json['nom_prenom'],
      langue: json['langue'],
      role: normalizedRole,
      depots: depotsList,
    );
  }
}
