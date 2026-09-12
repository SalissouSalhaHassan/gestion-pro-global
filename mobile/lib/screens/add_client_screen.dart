import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';

class AddClientScreen extends StatefulWidget {
  const AddClientScreen({super.key});

  @override
  State<AddClientScreen> createState() => _AddClientScreenState();
}

class _AddClientScreenState extends State<AddClientScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;

  // Controllers
  final _nomController = TextEditingController();
  final _emailController = TextEditingController();
  final _siteWebController = TextEditingController();
  final _adresseController = TextEditingController();
  
  final _contactController = TextEditingController();
  final _telController = TextEditingController();
  final _gsmController = TextEditingController();
  final _faxController = TextEditingController();

  final _iceController = TextEditingController();
  final _rcController = TextEditingController();
  final _nifController = TextEditingController();
  final _patenteController = TextEditingController();
  final _compteController = TextEditingController();

  final _nomCommercialController = TextEditingController();
  final _plafondController = TextEditingController(text: "0.0");
  final _artImpController = TextEditingController(); // NEW
  bool _prePaiement = false;

  final Color _primaryColor = const Color(0xFF4A00E0);

  @override
  void dispose() {
    _nomController.dispose();
    _emailController.dispose();
    _siteWebController.dispose();
    _adresseController.dispose();
    _contactController.dispose();
    _telController.dispose();
    _gsmController.dispose();
    _faxController.dispose();
    _iceController.dispose();
    _rcController.dispose();
    _nifController.dispose();
    _patenteController.dispose();
    _compteController.dispose();
    _nomCommercialController.dispose();
    _plafondController.dispose();
    _artImpController.dispose(); // NEW
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final token = Provider.of<AuthProvider>(context, listen: false).token;
      if (token == null) throw Exception("Non authentifié");

      // Prepare data map
      final clientData = {
        "nom": _nomController.text.trim(),
        "tel": _telController.text.trim(),
        "email": _emailController.text.trim(),
        "site": _siteWebController.text.trim(),
        "adresse": _adresseController.text.trim(),
        
        "contact": _contactController.text.trim(),
        "gsm": _gsmController.text.trim(),
        "fax": _faxController.text.trim(),
        
        "ice": _iceController.text.trim(),
        "rc": _rcController.text.trim(),
        "nif": _nifController.text.trim(),
        "patente": _patenteController.text.trim(),
        "n_compte": _compteController.text.trim(),
        
        "commerciale": _nomCommercialController.text.trim(),
        "montant_plafond": double.tryParse(_plafondController.text) ?? 0.0,
        "pre_client": _prePaiement,
        "art_imp": _artImpController.text.trim(), // NEW
      };

      final success = await ApiService().createClientFull(clientData, token);

      if (mounted) {
        if (success) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Client ajouté avec succès")),
          );
          Navigator.pop(context, true); // Return true to refresh list
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Erreur lors de l'ajout. Veuillez réessayer."),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Erreur: ${e.toString()}")),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F9),
      appBar: AppBar(
        title: const Text("Ajouter un Nouveau Client"),
        backgroundColor: _primaryColor,
        elevation: 0,
        centerTitle: true,
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: _primaryColor))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              physics: const BouncingScrollPhysics(),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    _buildSectionTitle("Identité"),
                    _buildCard([
                      _buildTextField("Réf. Client", controller: null, readOnly: true, hint: "Auto (000011)"),
                      const SizedBox(height: 15),
                      _buildTextField("Nom Client (*)", controller: _nomController, required: true),
                      const SizedBox(height: 15),
                      _buildTextField("Email", controller: _emailController, keyboardType: TextInputType.emailAddress),
                      const SizedBox(height: 15),
                      _buildTextField("Site Web", controller: _siteWebController, keyboardType: TextInputType.url),
                      const SizedBox(height: 15),
                      _buildTextField("Adresse", controller: _adresseController, maxLines: 2),
                    ]),

                    const SizedBox(height: 20),
                    _buildSectionTitle("Contacts"),
                    _buildCard([
                      _buildTextField("Personne à Contacter", controller: _contactController),
                      const SizedBox(height: 15),
                      _buildTextField("Téléphone", controller: _telController, keyboardType: TextInputType.phone),
                      const SizedBox(height: 15),
                      _buildTextField("GSM", controller: _gsmController, keyboardType: TextInputType.phone),
                      const SizedBox(height: 15),
                      _buildTextField("Fax", controller: _faxController, keyboardType: TextInputType.phone),
                    ]),

                    const SizedBox(height: 20),
                    _buildSectionTitle("Informations Légales & Fiscales"),
                    _buildCard([
                      Row(
                        children: [
                          Expanded(child: _buildTextField("ICE", controller: _iceController)),
                          const SizedBox(width: 15),
                          Expanded(child: _buildTextField("NIF", controller: _nifController)),
                        ],
                      ),
                      const SizedBox(height: 15),
                      Row(
                        children: [
                          Expanded(child: _buildTextField("R.C.", controller: _rcController)),
                          const SizedBox(width: 15),
                          Expanded(child: _buildTextField("Patente", controller: _patenteController)),
                        ],
                      ),
                      const SizedBox(height: 15),
                      Row(
                        children: [
                          Expanded(child: _buildTextField("Art. Imp.", controller: _artImpController)),
                          const SizedBox(width: 15),
                          Expanded(child: _buildTextField("N° Compte Bancaire", controller: _compteController, keyboardType: TextInputType.number)),
                        ],
                      ),
                    ]),

                    const SizedBox(height: 20),
                    _buildSectionTitle("Commercial & Crédit"),
                    _buildCard([
                      _buildTextField("Nom Commercial", controller: _nomCommercialController),
                      const SizedBox(height: 15),
                      Row(
                        children: [
                          Expanded(
                            child: _buildTextField("Montant Plafond", controller: _plafondController, keyboardType: TextInputType.number),
                          ),
                          const SizedBox(width: 15),
                          Expanded(
                            child: CheckboxListTile(
                              title: const Text("Pré-paiement", style: TextStyle(fontSize: 14)),
                              value: _prePaiement,
                              onChanged: (val) => setState(() => _prePaiement = val ?? false),
                              dense: true,
                              contentPadding: EdgeInsets.zero,
                              controlAffinity: ListTileControlAffinity.leading,
                              activeColor: _primaryColor,
                            ),
                          ),
                        ],
                      ),
                    ]),

                    const SizedBox(height: 30),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            onPressed: _submit,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              padding: const EdgeInsets.symmetric(vertical: 15),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: const Text("Valider", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 15),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => Navigator.pop(context),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.redAccent,
                              padding: const EdgeInsets.symmetric(vertical: 15),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: const Text("Quitter", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10, left: 5),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Text(
          title,
          style: TextStyle(
            color: Colors.blue.shade700,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  Widget _buildCard(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }

  Widget _buildTextField(String label, {
    TextEditingController? controller,
    bool readOnly = false,
    String? hint,
    TextInputType? keyboardType,
    int maxLines = 1,
    bool required = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black87),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          readOnly: readOnly,
          keyboardType: keyboardType,
          maxLines: maxLines,
          validator: required ? (val) => val == null || val.isEmpty ? "Champ requis" : null : null,
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            filled: true,
            fillColor: readOnly ? Colors.grey.shade100 : Colors.grey.shade50,
            contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: Colors.grey.shade300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: _primaryColor),
            ),
          ),
        ),
      ],
    );
  }
}
