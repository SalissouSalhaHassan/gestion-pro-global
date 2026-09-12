import 'package:flutter/material.dart';
import '../models/client_model.dart';

class EditClientScreen extends StatefulWidget {
  final Client client;

  const EditClientScreen({super.key, required this.client});

  @override
  _EditClientScreenState createState() => _EditClientScreenState();
}

class _EditClientScreenState extends State<EditClientScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nomController;
  late TextEditingController _emailController;
  late TextEditingController _telephoneController;
  late TextEditingController _adresseController;

  final Color _primaryColor = const Color(0xFF4A00E0);

  @override
  void initState() {
    super.initState();
    _nomController = TextEditingController(text: widget.client.nom);
    _emailController = TextEditingController(text: widget.client.email);
    _telephoneController = TextEditingController(text: widget.client.telephone);
    _adresseController = TextEditingController(text: widget.client.adresse);
  }

  @override
  void dispose() {
    _nomController.dispose();
    _emailController.dispose();
    _telephoneController.dispose();
    _adresseController.dispose();
    super.dispose();
  }

  void _saveClient() {
    if (_formKey.currentState!.validate()) {
      // Logique de sauvegarde à implémenter
      // Par exemple, appeler une API ou mettre à jour la base de données locale
      final updatedClient = Client(
        id: widget.client.id,
        nom: _nomController.text,
        email: _emailController.text,
        telephone: _telephoneController.text,
        adresse: _adresseController.text,
        solde: widget.client.solde, // Le solde n'est pas modifiable ici
      );

      debugPrint('Client mis à jour : ${updatedClient.nom}');
      
      // Affiche un message de succès et revient à l'écran précédent
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Client mis à jour avec succès!')),
      );
      
      // On passe le client mis à jour à l'écran de détails
      Navigator.of(context).pop(updatedClient); 
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Modifier le Client'),
        backgroundColor: _primaryColor,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.save),
            onPressed: _saveClient,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              _buildTextFormField(
                controller: _nomController,
                labelText: 'Nom du client',
                icon: Icons.person,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Veuillez entrer un nom';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),
              _buildTextFormField(
                controller: _telephoneController,
                labelText: 'Téléphone',
                icon: Icons.phone,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 20),
              _buildTextFormField(
                controller: _emailController,
                labelText: 'Email',
                icon: Icons.email,
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 20),
              _buildTextFormField(
                controller: _adresseController,
                labelText: 'Adresse',
                icon: Icons.location_on,
              ),
              const SizedBox(height: 40),
              ElevatedButton.icon(
                icon: const Icon(Icons.save),
                label: const Text('Enregistrer les modifications'),
                onPressed: _saveClient,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primaryColor,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  textStyle: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextFormField({
    required TextEditingController controller,
    required String labelText,
    required IconData icon,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: labelText,
        prefixIcon: Icon(icon, color: _primaryColor),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: _primaryColor, width: 2),
        ),
      ),
      keyboardType: keyboardType,
      validator: validator,
    );
  }
}
