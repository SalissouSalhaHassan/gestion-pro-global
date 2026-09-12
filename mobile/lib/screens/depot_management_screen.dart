import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../api/api_service.dart';

class DepotManagementScreen extends StatefulWidget {
  const DepotManagementScreen({super.key});

  @override
  State<DepotManagementScreen> createState() => _DepotManagementScreenState();
}

class _DepotManagementScreenState extends State<DepotManagementScreen> {
  List<dynamic> _depots = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchDepots();
  }

  Future<void> _fetchDepots() async {
    setState(() => _isLoading = true);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final data = await ApiService().getDepotsDetailed(auth.token!);
      setState(() {
        _depots = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) _msg("Erreur: $e", isError: true);
    }
  }

  void _showDepotDialog({Map<String, dynamic>? depot}) {
    final isEdit = depot != null;
    final nomCtrl = TextEditingController(text: depot?['nom'] ?? "");
    final empCtrl = TextEditingController(text: depot?['emplacement'] ?? "");
    final respCtrl = TextEditingController(text: depot?['responsable'] ?? "");
    bool isActive = depot?['is_active'] ?? true;
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(isEdit ? "Modifier Dépôt" : "Nouveau Dépôt"),
          content: SingleChildScrollView(
            child: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: nomCtrl,
                    decoration: const InputDecoration(labelText: "Nom du Dépôt *", border: OutlineInputBorder()),
                    validator: (v) => (v == null || v.isEmpty) ? "Requis" : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: empCtrl,
                    decoration: const InputDecoration(labelText: "Emplacement", border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: respCtrl,
                    decoration: const InputDecoration(labelText: "Responsable", border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    title: const Text("Actif"),
                    value: isActive,
                    onChanged: (v) => setState(() => isActive = v),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Annuler")),
            ElevatedButton(
              onPressed: () async {
                if (formKey.currentState!.validate()) {
                  final data = {
                    if (isEdit) "id": depot['id'],
                    "nom": nomCtrl.text.trim(),
                    "emplacement": empCtrl.text.trim(),
                    "responsable": respCtrl.text.trim(),
                    "is_active": isActive,
                  };
                  Navigator.pop(ctx);
                  await _saveDepot(data);
                }
              },
              child: const Text("Enregistrer"),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveDepot(Map<String, dynamic> data) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await ApiService().saveDepot(data, auth.token!);
      _msg("Dépôt enregistré avec succès");
      _fetchDepots();
    } catch (e) {
      _msg("Erreur: $e", isError: true);
    }
  }

  Future<void> _deleteDepot(String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Supprimer"),
        content: const Text("Voulez-vous vraiment supprimer ce dépôt ?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Non")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Oui", style: TextStyle(color: Colors.white)),
          )
        ],
      ),
    );

    if (confirmed == true) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      try {
        await ApiService().deleteDepot(id, auth.token!);
        _msg("Dépôt supprimé");
        _fetchDepots();
      } catch (e) {
        _msg("Erreur: $e", isError: true);
      }
    }
  }

  void _msg(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: isError ? Colors.red : Colors.green),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Gestion des Dépôts"),
        backgroundColor: const Color(0xFF4A00E0),
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: _depots.length,
              itemBuilder: (ctx, i) {
                final d = _depots[i];
                final bool isActive = d['is_active'] ?? true;
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: isActive ? Colors.green.shade100 : Colors.red.shade100,
                      child: Icon(Icons.store, color: isActive ? Colors.green : Colors.red),
                    ),
                    title: Text(d['nom'] ?? "-", style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text("${d['emplacement'] ?? ''} • ${d['responsable'] ?? '-'}"),
                    trailing: PopupMenuButton(
                      itemBuilder: (ctx) => [
                        const PopupMenuItem(value: 'edit', child: Text("Modifier")),
                        const PopupMenuItem(value: 'delete', child: Text("Supprimer", style: TextStyle(color: Colors.red))),
                      ],
                      onSelected: (v) {
                        if (v == 'edit') _showDepotDialog(depot: d);
                        if (v == 'delete') _deleteDepot(d['id']);
                      },
                    ),
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showDepotDialog(),
        backgroundColor: const Color(0xFF4A00E0),
        child: const Icon(Icons.add),
      ),
    );
  }
}
