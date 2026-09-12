import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../providers/auth_provider.dart';
import '../providers/rent_provider.dart';
import '../models/contract_model.dart';

class AddContractScreen extends StatefulWidget {
  final Contract? contract; // If null, we create. If not null, we edit.
  const AddContractScreen({super.key, this.contract});

  @override
  State<AddContractScreen> createState() => _AddContractScreenState();
}

class _AddContractScreenState extends State<AddContractScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _nomController;
  late TextEditingController _refController;
  late TextEditingController _telController;
  late TextEditingController _emailController;
  late TextEditingController _cniController;
  late TextEditingController _adresseController;
  late TextEditingController _profController;
  late TextEditingController _bienDetailsController;
  late TextEditingController _quartierController;
  late TextEditingController _loyerController;
  late TextEditingController _cautionController;
  late TextEditingController _anneeController;

  String? _dateNaissance;
  String _typeBien = "Boutique";
  String _moisDebut = "1";
  String _statut = "Actif";

  bool _isSaving = false;

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);

  final List<String> _typesBien = ["Appartement", "Chambre", "Boutique", "Maison", "Terrain"];
  final List<Map<String, String>> _moisList = [
    {"v": "1", "l": "Janvier"}, {"v": "2", "l": "Février"}, {"v": "3", "l": "Mars"},
    {"v": "4", "l": "Avril"}, {"v": "5", "l": "Mai"}, {"v": "6", "l": "Juin"},
    {"v": "7", "l": "Juillet"}, {"v": "8", "l": "Août"}, {"v": "9", "l": "Septembre"},
    {"v": "10", "l": "Octobre"}, {"v": "11", "l": "Novembre"}, {"v": "12", "l": "Décembre"}
  ];

  @override
  void initState() {
    super.initState();
    final isEditing = widget.contract != null;
    
    _nomController = TextEditingController(text: isEditing ? widget.contract!.locataireNomComplet : "");
    _refController = TextEditingController(
      text: isEditing 
          ? widget.contract!.refLocataire 
          : "LOC-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}"
    );
    _telController = TextEditingController(text: isEditing ? widget.contract!.locataireTelephone ?? "" : "");
    _emailController = TextEditingController(text: isEditing ? widget.contract!.locataireEmail ?? "" : "");
    _cniController = TextEditingController(text: isEditing ? widget.contract!.locataireCni ?? "" : "");
    _adresseController = TextEditingController(text: isEditing ? widget.contract!.adresseComplete ?? "" : "");
    _profController = TextEditingController(text: isEditing ? widget.contract!.profession ?? "" : "");
    _bienDetailsController = TextEditingController(text: isEditing ? widget.contract!.bienLoueDetails : "");
    _quartierController = TextEditingController(text: isEditing ? widget.contract!.quartier ?? "" : "");
    _loyerController = TextEditingController(text: isEditing ? widget.contract!.loyerMensuel.toInt().toString() : "");
    _cautionController = TextEditingController(text: isEditing ? widget.contract!.caution.toInt().toString() : "");
    _anneeController = TextEditingController(text: isEditing ? (widget.contract!.anneeDebut ?? DateTime.now().year).toString() : DateTime.now().year.toString());
    
    if (isEditing) {
      _dateNaissance = widget.contract!.dateNaissance;
      if (widget.contract!.typeBien != null && _typesBien.contains(widget.contract!.typeBien)) {
        _typeBien = widget.contract!.typeBien!;
      }
      if (widget.contract!.moisDebut != null) {
        _moisDebut = widget.contract!.moisDebut!.toString();
      }
      _statut = widget.contract!.statut;
    }
  }

  @override
  void dispose() {
    _nomController.dispose();
    _refController.dispose();
    _telController.dispose();
    _emailController.dispose();
    _cniController.dispose();
    _adresseController.dispose();
    _profController.dispose();
    _bienDetailsController.dispose();
    _quartierController.dispose();
    _loyerController.dispose();
    _cautionController.dispose();
    _anneeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final rentProvider = Provider.of<RentProvider>(context, listen: false);
    final isEditing = widget.contract != null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFF),
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_primaryColor, _secondaryColor],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        title: Text(
          isEditing ? "Modifier le Contrat" : "Nouveau Contrat",
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle("Informations du Locataire", Icons.person),
              _buildLocataireFields(),
              const SizedBox(height: 20),
              _buildSectionTitle("Détails du Bien Loué", Icons.home),
              _buildBienFields(),
              const SizedBox(height: 20),
              _buildSectionTitle("Informations Financières", Icons.wallet),
              _buildFinanceFields(),
              const SizedBox(height: 20),
              _buildSectionTitle("Statut du contrat", Icons.info_outline),
              _buildStatusField(),
              const SizedBox(height: 30),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 3,
                  ),
                  onPressed: _isSaving ? null : () => _saveForm(auth, rentProvider),
                  child: _isSaving
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          isEditing ? "SAUVEGARDER LES MODIFICATIONS" : "CRÉER LE CONTRAT",
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 4),
      child: Row(
        children: [
          Icon(icon, color: _primaryColor, size: 20),
          const SizedBox(width: 8),
          Text(
            title.toUpperCase(),
            style: TextStyle(color: Colors.grey.shade700, fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.0),
          ),
        ],
      ),
    );
  }

  Widget _buildLocataireFields() {
    final DateFormat formatter = DateFormat('dd/MM/yyyy');
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10)],
      ),
      child: Column(
        children: [
          TextFormField(
            controller: _nomController,
            decoration: const InputDecoration(labelText: "Nom complet des locataires *", prefixIcon: Icon(Icons.person)),
            validator: (v) => v == null || v.trim().isEmpty ? "Veuillez entrer le nom du locataire" : null,
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _refController,
                  decoration: const InputDecoration(labelText: "Référence (Code) *", prefixIcon: Icon(Icons.qr_code_2)),
                  validator: (v) => v == null || v.trim().isEmpty ? "Obligatoire" : null,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _telController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: "Téléphone", prefixIcon: Icon(Icons.phone)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: "Email", prefixIcon: Icon(Icons.email)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _cniController,
                  decoration: const InputDecoration(labelText: "Numéro CNI", prefixIcon: Icon(Icons.badge)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    DateTime? initial = _dateNaissance != null ? DateTime.tryParse(_dateNaissance!) : DateTime.now();
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: initial ?? DateTime.now(),
                      firstDate: DateTime(1920),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) {
                      setState(() {
                        _dateNaissance = picked.toIso8601String().split('T')[0];
                      });
                    }
                  },
                  icon: const Icon(Icons.cake),
                  label: Text(_dateNaissance != null ? formatter.format(DateTime.parse(_dateNaissance!)) : "Né(e) le"),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _profController,
            decoration: const InputDecoration(labelText: "Profession", prefixIcon: Icon(Icons.work)),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _adresseController,
            decoration: const InputDecoration(labelText: "Adresse complète", prefixIcon: Icon(Icons.location_on)),
            maxLines: 2,
          ),
        ],
      ),
    );
  }

  Widget _buildBienFields() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10)],
      ),
      child: Column(
        children: [
          DropdownButtonFormField<String>(
            value: _typeBien,
            items: _typesBien.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
            onChanged: (v) => setState(() => _typeBien = v.toString()),
            decoration: const InputDecoration(labelText: "Type de bien *", prefixIcon: Icon(Icons.category)),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _bienDetailsController,
            decoration: const InputDecoration(labelText: "Description / Détails du bien loué *", prefixIcon: Icon(Icons.info_outline)),
            validator: (v) => v == null || v.trim().isEmpty ? "Veuillez décrire le bien" : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _quartierController,
            decoration: const InputDecoration(labelText: "Quartier", prefixIcon: Icon(Icons.map)),
          ),
        ],
      ),
    );
  }

  Widget _buildFinanceFields() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10)],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _loyerController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: "Loyer mensuel *", prefixIcon: Icon(Icons.payments)),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return "Obligatoire";
                    if (double.tryParse(v) == null) return "Invalide";
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _cautionController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: "Caution (Garantie)", prefixIcon: Icon(Icons.lock)),
                  validator: (v) {
                    if (v != null && v.isNotEmpty && double.tryParse(v) == null) return "Invalide";
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _anneeController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: "Année de début *", prefixIcon: Icon(Icons.calendar_today)),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return "Obligatoire";
                    if (int.tryParse(v) == null) return "Invalide";
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _moisDebut,
                  items: _moisList.map((e) => DropdownMenuItem(value: e["v"], child: Text(e["l"]!))).toList(),
                  onChanged: (v) => setState(() => _moisDebut = v.toString()),
                  decoration: const InputDecoration(labelText: "Mois de début *", prefixIcon: Icon(Icons.date_range)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatusField() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10)],
      ),
      child: DropdownButtonFormField<String>(
        value: _statut,
        items: [
          const DropdownMenuItem(value: "Actif", child: Text("✅ Actif")),
          const DropdownMenuItem(value: "Expiré", child: Text("⏳ Expiré")),
          const DropdownMenuItem(value: "Annulé", child: Text("❌ Annulé")),
        ],
        onChanged: (v) => setState(() => _statut = v.toString()),
        decoration: const InputDecoration(labelText: "Statut du contrat", prefixIcon: Icon(Icons.rule)),
      ),
    );
  }

  void _saveForm(AuthProvider auth, RentProvider rentProvider) async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() => _isSaving = true);

    try {
      final payload = {
        "locataire_nom_complet": _nomController.text.trim(),
        "ref_locataire": _refController.text.trim(),
        "locataire_telephone": _telController.text.trim().isEmpty ? null : _telController.text.trim(),
        "locataire_email": _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
        "locataire_cni": _cniController.text.trim().isEmpty ? null : _cniController.text.trim(),
        "date_naissance": _dateNaissance,
        "adresse_complete": _adresseController.text.trim().isEmpty ? null : _adresseController.text.trim(),
        "profession": _profController.text.trim().isEmpty ? null : _profController.text.trim(),
        "type_bien": _typeBien,
        "bien_loue_details": _bienDetailsController.text.trim(),
        "quartier": _quartierController.text.trim().isEmpty ? null : _quartierController.text.trim(),
        "loyer_mensuel": double.parse(_loyerController.text.trim()),
        "caution": _cautionController.text.trim().isEmpty ? 0.0 : double.parse(_cautionController.text.trim()),
        "annee_debut": int.parse(_anneeController.text.trim()),
        "mois_debut": int.parse(_moisDebut),
        "statut": _statut,
      };

      if (widget.contract == null) {
        await rentProvider.addContract(auth, payload);
      } else {
        await rentProvider.updateContract(auth, widget.contract!.id, payload);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(widget.contract == null ? "Contrat créé avec succès !" : "Contrat mis à jour !"),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text("Erreur"),
            content: Text("Une erreur est survenue lors de la sauvegarde: $e"),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("OK")),
            ],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }
}
