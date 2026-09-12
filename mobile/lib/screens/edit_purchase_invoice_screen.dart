import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/supplier_provider.dart';
import '../providers/purchase_provider.dart';
import '../models/supplier_model.dart';
import '../models/purchase_invoice_model.dart';
import '../api/api_service.dart';

class EditPurchaseInvoiceScreen extends StatefulWidget {
  final PurchaseInvoice invoice;
  const EditPurchaseInvoiceScreen({super.key, required this.invoice});

  @override
  State<EditPurchaseInvoiceScreen> createState() => _EditPurchaseInvoiceScreenState();
}

class _EditPurchaseInvoiceScreenState extends State<EditPurchaseInvoiceScreen> {
  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF3F5F9);
  
  Supplier? _selectedSupplier;
  final List<PurchaseInvoiceItem> _items = [];
  bool _isLoading = false;
  final _apiService = ApiService();
  List<dynamic> _allProducts = [];
  List<dynamic> _depots = [];
  dynamic _selectedDepot;
  
  final _paidAmountController = TextEditingController();
  final _invoiceNumberController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _invoiceNumberController.text = widget.invoice.invoiceNumber ?? '';
    _paidAmountController.text = widget.invoice.paidAmount.toStringAsFixed(0);
    _notesController.text = widget.invoice.notes ?? '';
    _items.addAll(widget.invoice.items);

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final supplierProv = Provider.of<SupplierProvider>(context, listen: false);

    Future.microtask(() async {
      await supplierProv.fetchSuppliers(auth);
      if (mounted) {
        setState(() {
          try {
            _selectedSupplier = supplierProv.suppliers.firstWhere((s) => s.id == widget.invoice.supplierId);
          } catch (_) {}
        });
      }

      try {
        final products = await _apiService.getArticles(auth.token!);
        final depots = await _apiService.getActiveDepots(auth.token!);
        if (!mounted) return;
        setState(() {
          _allProducts = products;
          _depots = depots;
          try {
            // Find depot by name mentioned in invoice if possible
            // Note: Purchase model should ideally have depot_nom or depot_id
            // For now, we'll try to match name
          } catch (_) {}
        });
      } catch (e) {
        debugPrint('Error loading dependencies: $e');
      }
    });
  }

  @override
  void dispose() {
    _paidAmountController.dispose();
    _invoiceNumberController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  double get _totalAmount => _items.fold(0.0, (sum, item) => sum + item.total);

  void _addItem() {
    showDialog(
      context: context,
      builder: (ctx) => _ProductSelectionDialog(
        products: _allProducts,
        onSelected: (product, double qty, price) {
          setState(() {
            _items.add(
              PurchaseInvoiceItem(
                productId: product['id'],
                productName: product['designation'] ?? 'Produit',
                unite: product['unite'],
                quantity: qty,
                purchasePrice: price,
              ),
            );
          });
        },
      ),
    );
  }

  Future<void> _submit() async {
    if (_selectedSupplier == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Veuillez sélectionner un fournisseur')));
      return;
    }
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Veuillez ajouter des produits')));
      return;
    }

    setState(() => _isLoading = true);

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      double paid = double.tryParse(_paidAmountController.text) ?? 0.0;
      
      String status = 'impayee';
      if (paid >= _totalAmount - 0.01) status = 'payee';
      else if (paid > 0) status = 'partiel';

      final purchaseData = {
        'fournisseur_id': _selectedSupplier!.id,
        'fournisseur_nom': _selectedSupplier!.name,
        'numero_facture': _invoiceNumberController.text.trim(),
        'notes': _notesController.text.trim(),
        'sous_total': _totalAmount,
        'remise': widget.invoice.remise,
        'taxe': widget.invoice.taxe,
        'transport': widget.invoice.transport,
        'montant_total': _totalAmount,
        'montant_paye': paid,
        'statut': status,
        'items': _items.map((e) => e.toJson()).toList(),
      };

      await Provider.of<PurchaseProvider>(context, listen: false).updatePurchase(
        auth,
        widget.invoice.id!,
        purchaseData,
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
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
            gradient: LinearGradient(colors: [_primaryColor, _secondaryColor]),
          ),
        ),
        title: const Text('Modifier Facture Achat', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                DropdownButtonFormField<Supplier>(
                  value: _selectedSupplier,
                  decoration: InputDecoration(
                    labelText: 'Fournisseur',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  items: Provider.of<SupplierProvider>(context).suppliers.map((s) => DropdownMenuItem(value: s, child: Text(s.name))).toList(),
                  onChanged: (val) => setState(() => _selectedSupplier = val),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _invoiceNumberController,
                  decoration: InputDecoration(
                    labelText: 'N° Facture',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _notesController,
                  decoration: InputDecoration(
                    labelText: 'Notes',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _items.length,
              itemBuilder: (ctx, i) {
                final item = _items[i];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: ListTile(
                    title: Text(item.productName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${item.quantity} x ${item.purchasePrice.toStringAsFixed(2)}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('${item.total.toStringAsFixed(2)} DA', style: TextStyle(fontWeight: FontWeight.bold, color: _primaryColor)),
                        IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () => setState(() => _items.removeAt(i)),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            color: Colors.white,
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total:', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    Text('${_totalAmount.toStringAsFixed(2)} DA', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _primaryColor)),
                  ],
                ),
                const SizedBox(height: 15),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.add),
                        label: const Text('Produit'),
                        onPressed: _addItem,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: _primaryColor, foregroundColor: Colors.white),
                        onPressed: _isLoading ? null : _submit,
                        child: _isLoading ? const CircularProgressIndicator() : const Text('Enregistrer'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductSelectionDialog extends StatefulWidget {
  final List<dynamic> products;
  final Function(dynamic product, double qty, double price) onSelected;
  const _ProductSelectionDialog({required this.products, required this.onSelected});
  @override
  State<_ProductSelectionDialog> createState() => _ProductSelectionDialogState();
}

class _ProductSelectionDialogState extends State<_ProductSelectionDialog> {
  dynamic _selectedProduct;
  final _qtyController = TextEditingController(text: '1');
  final _priceController = TextEditingController();
  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ajouter Produit'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<dynamic>(
            isExpanded: true,
            hint: const Text('Produit'),
            items: widget.products.map((p) => DropdownMenuItem(value: p, child: Text(p['designation'] ?? 'Inconnu'))).toList(),
            onChanged: (val) {
              setState(() {
                _selectedProduct = val;
                if (val != null) _priceController.text = (val['prix_achat'] ?? 0.0).toString();
              });
            },
          ),
          const SizedBox(height: 10),
          TextField(controller: _qtyController, decoration: const InputDecoration(labelText: 'Qté'), keyboardType: TextInputType.number),
          const SizedBox(height: 10),
          TextField(controller: _priceController, decoration: const InputDecoration(labelText: 'Prix'), keyboardType: TextInputType.number),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
        ElevatedButton(
          onPressed: () {
            if (_selectedProduct != null) {
              widget.onSelected(_selectedProduct, double.tryParse(_qtyController.text) ?? 1.0, double.tryParse(_priceController.text) ?? 0.0);
              Navigator.pop(context);
            }
          },
          child: const Text('Ajouter'),
        ),
      ],
    );
  }
}
