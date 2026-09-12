import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';

class AddProductScreen extends StatefulWidget {
  const AddProductScreen({super.key});

  @override
  State<AddProductScreen> createState() => _AddProductScreenState();
}

class _AddProductScreenState extends State<AddProductScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Controllers
  final _refCtrl = TextEditingController();
  final _barcodeCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _buyPriceCtrl = TextEditingController();
  final _sellPriceCtrl = TextEditingController();
  final _taxCtrl = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _unitCtrl = TextEditingController();
  final _minQtyCtrl = TextEditingController(); 

  List<dynamic> _depots = [];
  final Map<String, TextEditingController> _stockControllers = {};

  File? _selectedImage;
  bool _isLoading = false;
  bool _isDepotsLoading = true;

  // Colors
  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _backgroundColor = const Color(0xFFF8F9FA);

  @override
  void initState() {
    super.initState();
    _loadDepots();
  }

  Future<void> _loadDepots() async {
    setState(() => _isDepotsLoading = true);
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) {
      setState(() => _isDepotsLoading = false);
      return;
    }
    try {
      final data = await ApiService().getDepotsDetailed(token);
      if (mounted) {
        setState(() {
          _depots = data;
          _stockControllers.clear();
          for (var d in _depots) {
             final name = d['nom'];
             if (name != null) {
               _stockControllers[name] = TextEditingController();
             }
          }
          _isDepotsLoading = false;
        });
      }
    } catch (e) {
      debugPrint("Error loading depots: $e");
      if (mounted) setState(() => _isDepotsLoading = false);
    }
  }

  void _generateReference() {
    final random = Random();
    final number = 10000 + random.nextInt(90000);
    setState(() {
      _refCtrl.text = "ART$number";
    });
  }

  void _generateBarcode() {
    final random = Random();
    String code = "";
    for (int i = 0; i < 13; i++) {
      code += random.nextInt(10).toString();
    }
    setState(() {
      _barcodeCtrl.text = code;
    });
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: source);
    if (pickedFile != null) setState(() => _selectedImage = File(pickedFile.path));
  }

  Future<void> _scanBarcode() async {
    final code = await Navigator.push(context, MaterialPageRoute(builder: (_) => const SimpleBarcodeScanner()));
    if (code != null) setState(() => _barcodeCtrl.text = code);
  }

  Future<void> _saveProduct() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);
    final token = Provider.of<AuthProvider>(context, listen: false).token;

    try {
      final Map<String, String> fields = {
        'reference': _refCtrl.text,
        'designation': _nameCtrl.text,
        'code_barre': _barcodeCtrl.text,
        'p_achat_ht': (_buyPriceCtrl.text.isEmpty ? '0' : _buyPriceCtrl.text),
        'p_vente_ht': (_sellPriceCtrl.text.isEmpty ? '0' : _sellPriceCtrl.text),
        'taxe': (_taxCtrl.text.isEmpty ? '0' : _taxCtrl.text),
        'famille': _categoryCtrl.text,
        'unite': _unitCtrl.text,
        'stock_min': _minQtyCtrl.text.isEmpty ? '0' : _minQtyCtrl.text,
      };

      // Add dynamic stocks
      _stockControllers.forEach((name, ctrl) {
         fields['qte_${name}'] = ctrl.text.isEmpty ? '0' : ctrl.text;
      });

      await ApiService().addArticleWithImage(
        fields,
        _selectedImage?.path,
        token!,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("✅ Produit ajouté avec succès !"), backgroundColor: Colors.green)
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Erreur: $e"), backgroundColor: Colors.red)
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _backgroundColor,
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_primaryColor, _primaryColor.withOpacity(0.8)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 0,
        leading: const BackButton(color: Colors.white),
        title: const Text("Nouveau Produit", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Image Picker
              _buildImagePicker(),
              const SizedBox(height: 25),

              // 2. Identification
              _buildSectionCard(
                title: "Identification",
                icon: Icons.info_outline,
                children: [
                   Row(
                    children: [
                      Expanded(child: _buildTextField(controller: _refCtrl, label: "Référence *", required: true)),
                      const SizedBox(width: 10),
                      _buildActionButton("Générer", _generateReference, Colors.orange),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _buildTextField(controller: _barcodeCtrl, label: "Code-Barre")),
                      const SizedBox(width: 8),
                      _buildActionButton("Scan", _scanBarcode, Colors.blue),
                      const SizedBox(width: 8),
                      _buildActionButton("Auto", _generateBarcode, Colors.purple),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _buildTextField(controller: _nameCtrl, label: "Désignation *", required: true),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _buildTextField(controller: _categoryCtrl, label: "Famille (Catégorie)")),
                      const SizedBox(width: 12),
                      Expanded(child: _buildTextField(controller: _unitCtrl, label: "Unité (ex: Kg, Pc)")),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 20),

              // 3. Tarification
              _buildSectionCard(
                title: "Prix & Visibilité",
                icon: Icons.monetization_on_outlined,
                children: [
                  Row(
                    children: [
                      Expanded(child: _buildTextField(controller: _buyPriceCtrl, label: "P. Achat", isNumber: true)),
                      const SizedBox(width: 12),
                      Expanded(child: _buildTextField(controller: _sellPriceCtrl, label: "P. Vente", isNumber: true)),
                      const SizedBox(width: 12),
                      Expanded(child: _buildTextField(controller: _taxCtrl, label: "TVA (%)", isNumber: true)),
                    ],
                  ),
                ],
              ),

              const SizedBox(height: 20),
              
              // 4. Stock & Alert
              _buildSectionCard(
                title: "Stock & Alertes",
                icon: Icons.inventory_2_outlined,
                children: [
                   _buildTextField(controller: _minQtyCtrl, label: "Stock Alerte (Min)", isNumber: true),
                   const SizedBox(height: 20),
                   const Text("Initialiser le stock par dépôt", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blueGrey, fontSize: 12)),
                   const SizedBox(height: 10),
                   if (_isDepotsLoading) 
                     const Center(child: Padding(padding: EdgeInsets.all(8.0), child: CircularProgressIndicator()))
                   else if (_depots.isEmpty)
                     const Center(child: Text("Aucun dépôt trouvé", style: TextStyle(color: Colors.grey)))
                   else
                     GridView.builder(
                       shrinkWrap: true,
                       physics: const NeverScrollableScrollPhysics(),
                       gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                         crossAxisCount: 2,
                         childAspectRatio: 2.5,
                         crossAxisSpacing: 10,
                         mainAxisSpacing: 10
                       ),
                       itemCount: _depots.length,
                       itemBuilder: (context, index) {
                         final name = _depots[index]['nom'];
                         return _buildStockField(name, _stockControllers[name]!);
                       },
                     ),
                ],
              ),


              const SizedBox(height: 35),

              // 5. Submit Button
              SizedBox(
                width: double.infinity,
                height: 55,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 5,
                    shadowColor: _primaryColor.withOpacity(0.4),
                  ),
                  onPressed: _isLoading ? null : _saveProduct,
                  child: _isLoading 
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        "ENREGISTRER L'ARTICLE",
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16, letterSpacing: 1),
                      ),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImagePicker() {
    return Center(
      child: GestureDetector(
        onTap: () => _showImageSourceDialog(),
        child: Stack(
          children: [
            Container(
              width: 130,
              height: 130,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
                border: Border.all(color: Colors.white, width: 4),
                image: _selectedImage != null 
                  ? DecorationImage(image: FileImage(_selectedImage!), fit: BoxFit.cover)
                  : null,
              ),
              child: _selectedImage == null
                  ? Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_photo_alternate_outlined, size: 45, color: _primaryColor.withOpacity(0.3)),
                        const SizedBox(height: 5),
                        Text("Photo", style: TextStyle(color: Colors.grey.shade400, fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                    )
                  : null,
            ),
            Positioned(
              bottom: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: Colors.orange,
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: Colors.black26, blurRadius: 10)],
                ),
                child: const Icon(Icons.edit, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({required String title, required IconData icon, required List<Widget> children}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: _primaryColor, size: 20),
              const SizedBox(width: 10),
              Text(
                title,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF2D3436)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }

  Widget _buildActionButton(String label, VoidCallback onTap, Color color) {
    return SizedBox(
      height: 55,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
           backgroundColor: color.withOpacity(0.1),
           foregroundColor: color,
           elevation: 0,
           shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
           padding: const EdgeInsets.symmetric(horizontal: 14)
        ),
        onPressed: onTap,
        child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    bool isNumber = false,
    bool required = false,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: isNumber ? TextInputType.number : TextInputType.text,
      validator: required ? (v) => v!.isEmpty ? "Requis" : null : null,
      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.grey.shade500, fontSize: 13, fontWeight: FontWeight.w500),
        filled: true,
        fillColor: const Color(0xFFF9FAFB),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
           borderRadius: BorderRadius.circular(14),
           borderSide: const BorderSide(color: Color(0xFFEDF2F7)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: _primaryColor.withOpacity(0.5), width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
    );
  }

  Widget _buildStockField(String label, TextEditingController ctrl) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, 
          style: const TextStyle(fontSize: 11, color: Color(0xFF636E72), fontWeight: FontWeight.bold),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        SizedBox(
          height: 45,
          child: TextFormField(
            controller: ctrl,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            decoration: InputDecoration(
              hintText: "0",
              hintStyle: TextStyle(color: Colors.grey.shade300),
              filled: true,
              fillColor: const Color(0xFFF9FAFB),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFEDF2F7))),
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
            ),
          ),
        ),
      ],
    );
  }

  void _showImageSourceDialog() {
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Galerie'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Caméra'),
              onTap: () {
                Navigator.pop(ctx);
                _pickImage(ImageSource.camera);
              },
            ),
          ],
        ),
      ),
    );
  }
}

class SimpleBarcodeScanner extends StatelessWidget {
  const SimpleBarcodeScanner({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Scan Code-Barre")),
      body: MobileScanner(
        onDetect: (capture) {
          final List<Barcode> barcodes = capture.barcodes;
           if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
              Navigator.pop(context, barcodes.first.rawValue);
           }
        },
      ),
    );
  }
}
