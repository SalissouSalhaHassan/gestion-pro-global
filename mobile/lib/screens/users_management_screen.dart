import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../api/api_service.dart';
import '../models/user_model.dart';
import '../services/excel_export_service.dart';

class UsersManagementScreen extends StatefulWidget {
  const UsersManagementScreen({super.key});

  @override
  State<UsersManagementScreen> createState() => _UsersManagementScreenState();
}

class _UsersManagementScreenState extends State<UsersManagementScreen> {
  List<AppUser> _users = [];
  bool _loading = true;
  String _roleFilter = "Tous";
  final TextEditingController _searchCtrl = TextEditingController();

  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final data = await ApiService().getUsers(auth.token!);
      setState(() {
        _users = data.map((e) => AppUser.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _users = [];
        _loading = false;
      });
    }
  }

  void _showUserDialog({AppUser? user}) {
    final isEdit = user != null;
    final usernameCtrl = TextEditingController(text: user?.username ?? "");
    final fullNameCtrl = TextEditingController(text: user?.nomPrenom ?? ""); // Assuming nomPrenom exists or we use map
    final passwordCtrl = TextEditingController(); // Empty for edit implies no change
    final depotsCtrl = TextEditingController(text: user?.depots.join(", ") ?? "");
    String role = user?.role ?? "vendeur";
    String language = user?.langue ?? "FR";

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? "Modifier: ${user.username}" : "Nouvel Utilisateur"),
        content: SizedBox(
          width: 400,
          child: SingleChildScrollView(
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   _buildTextField(usernameCtrl, "Nom d'utilisateur *", required: true),
                   const SizedBox(height: 12),
                   _buildTextField(fullNameCtrl, "Nom Complet"),
                   const SizedBox(height: 12),
                   _buildTextField(passwordCtrl, isEdit ? "Mot de passe (Laisser vide si inchangé)" : "Mot de passe *", required: !isEdit, obscure: true),
                   const SizedBox(height: 12),
                   Row(
                     children: [
                       Expanded(
                         child: DropdownButtonFormField<String>(
                            value: role,
                            items: const [
                              DropdownMenuItem(value: "vendeur", child: Text("Vendeur")),
                              DropdownMenuItem(value: "admin", child: Text("Admin")),
                            ],
                            onChanged: (v) => role = v ?? "vendeur",
                            decoration: const InputDecoration(labelText: "Rôle", border: OutlineInputBorder()),
                          ),
                       ),
                       const SizedBox(width: 12),
                       Expanded(
                         child: DropdownButtonFormField<String>(
                            value: language,
                            items: const [
                              DropdownMenuItem(value: "FR", child: Text("Français")),
                              DropdownMenuItem(value: "AR", child: Text("العربية")),
                            ],
                            onChanged: (v) => language = v ?? "FR",
                            decoration: const InputDecoration(labelText: "Langue", border: OutlineInputBorder()),
                          ),
                       ),
                     ],
                   ),
                   const SizedBox(height: 12),
                   _buildTextField(depotsCtrl, "Dépôts (séparés par virgule)"),
                   const SizedBox(height: 5),
                   const Text("Ex: Boutique, Magasin, Dépôt 1", style: TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ),
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Annuler")),
          ElevatedButton(
            onPressed: () async {
              if (_formKey.currentState!.validate()) {
                Navigator.pop(ctx);
                  await _saveUser(
                  isEdit: isEdit,
                  userId: user?.id,
                  data: {
                    "utilisateur": usernameCtrl.text.trim(),
                    "nom_prenom": fullNameCtrl.text.trim(),
                    "mot_de_passe": passwordCtrl.text.isNotEmpty ? passwordCtrl.text : null,
                    "langue": language,
                    "depots": depotsCtrl.text.trim(),
                    "admin": role == "admin" ? "Oui" : "Non",
                  }
                );
              }
            },
            child: const Text("Enregistrer"),
          ),
        ],
      ),
    );
  }

  Future<void> _saveUser({required bool isEdit, String? userId, required Map<String, dynamic> data}) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final cleanData = Map<String, dynamic>.from(data)
        ..removeWhere((key, value) => value == null);
        
      if (isEdit && userId != null) {
        await ApiService().updateUserFull(userId, cleanData, auth.token!);
        if (mounted) _msg("Utilisateur mis à jour");
      } else {
        await ApiService().createUserFull(cleanData, auth.token!);
        if (mounted) _msg("Utilisateur créé");
      }
      _fetchUsers();
    } catch (e) {
      if (mounted) _msg("Erreur: $e", isError: true);
    }
  }

  Future<void> _deleteUser(AppUser user) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Supprimer"),
        content: Text("Supprimer ${user.username} ?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Non")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Oui", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      try {
        await ApiService().deleteUser(user.id, auth.token!);
        if (mounted) _msg("Utilisateur supprimé");
        _fetchUsers();
      } catch (e) {
        if (mounted) _msg("Erreur: $e", isError: true);
      }
    }
  }

  void _msg(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: isError ? Colors.red : Colors.green),
    );
  }

  Widget _buildTextField(TextEditingController ctrl, String label, {bool required = false, bool obscure = false}) {
    return TextFormField(
      controller: ctrl,
      obscureText: obscure,
      validator: required ? (v) => (v == null || v.isEmpty) ? "Requis" : null : null,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final Color primary = const Color(0xFF4A00E0);
    final Color secondary = const Color(0xFF8E2DE2);

    if (!auth.canManageUsers) {
      return Scaffold(
        appBar: AppBar(title: const Text("Accès Refusé")),
        body: const Center(child: Text("Accès réservé aux administrateurs.")),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F9),
      appBar: AppBar(
        title: const Text("Gestion Utilisateurs", style: TextStyle(fontWeight: FontWeight.bold)),
        flexibleSpace: Container(
          decoration: BoxDecoration(gradient: LinearGradient(colors: [primary, secondary])),
        ),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download),
            onPressed: () async {
               final data = _filteredUsers().map((u) => {"username": u.username, "role": u.role}).toList();
               await ExcelExportService.exportUsers(data, context);
            },
          )
        ],
      ),
      body: Column(
        children: [
          // Header / Search Bar
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.add),
                        label: const Text("NOUVEAU"),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: () => _showUserDialog(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: "Rechercher...",
                          prefixIcon: const Icon(Icons.search, size: 20),
                          filled: true,
                          fillColor: Colors.grey.shade100,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          contentPadding: const EdgeInsets.symmetric(vertical: 0),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _filterChip("Tous"),
                    const SizedBox(width: 8),
                    _filterChip("Admin"),
                    const SizedBox(width: 8),
                    _filterChip("Vendeur"),
                  ],
                ),
              ],
            ),
          ),
          
          Expanded(
            child: _loading 
              ? Center(child: CircularProgressIndicator(color: primary)) 
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _filteredUsers().length,
                  itemBuilder: (ctx, i) => _userTile(_filteredUsers()[i]),
                ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label) {
    final selected = _roleFilter == label;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (v) => setState(() => _roleFilter = label),
      selectedColor: const Color(0xFF4A00E0).withOpacity(0.2),
      labelStyle: TextStyle(color: selected ? const Color(0xFF4A00E0) : Colors.black),
    );
  }

  Widget _userTile(AppUser user) {
    final isAdmin = user.role.toLowerCase() == "admin";
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: isAdmin ? Colors.amber.shade100 : Colors.blue.shade100,
          child: Icon(isAdmin ? Icons.star : Icons.person, color: isAdmin ? Colors.amber.shade800 : Colors.blue.shade800),
        ),
        title: Text(user.username, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(isAdmin ? "Administrateur" : "Vendeur", style: TextStyle(color: Colors.grey.shade600)),
            if (user.depots.isNotEmpty)
              Text("Dépôts: ${user.depots.join(', ')}", style: TextStyle(fontSize: 11, color: Colors.grey.shade500), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.edit, color: Colors.blueGrey),
              onPressed: () => _showUserDialog(user: user),
              tooltip: "Modifier",
            ),
            IconButton(
              icon: const Icon(Icons.delete, color: Colors.redAccent),
              onPressed: () => _deleteUser(user),
              tooltip: "Supprimer",
            ),
          ],
        ),
      ),
    );
  }

  List<AppUser> _filteredUsers() {
    final q = _searchCtrl.text.trim().toLowerCase();
    return _users.where((u) {
      final matchesRole = _roleFilter == "Tous" || u.role.toLowerCase() == _roleFilter.toLowerCase();
      final matchesSearch = u.username.toLowerCase().contains(q);
      return matchesRole && matchesSearch;
    }).toList();
  }
}
