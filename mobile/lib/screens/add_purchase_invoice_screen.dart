import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/supplier_provider.dart';
import '../providers/purchase_provider.dart';
import '../models/supplier_model.dart';
import '../models/purchase_invoice_model.dart';
import '../api/api_service.dart';

class AddPurchaseInvoiceScreen extends StatefulWidget {
  const AddPurchaseInvoiceScreen({super.key});

  @override
  State<AddPurchaseInvoiceScreen> createState() =>
      _AddPurchaseInvoiceScreenState();
}

class _AddPurchaseInvoiceScreenState extends State<AddPurchaseInvoiceScreen> {
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
  void dispose() {
    _paidAmountController.dispose();
    _invoiceNumberController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final supplierProv = Provider.of<SupplierProvider>(context, listen: false);
    Future.microtask(() async {
      // 1. Fetch Next Ref
      try {
        final nextRef = await _apiService.getNextPurchaseRef();
        if (mounted) {
          _invoiceNumberController.text = nextRef;
        }
      } catch (e) {
        debugPrint('Error fetching next ref: $e');
      }

      // 2. Fetch Suppliers
      await supplierProv.fetchSuppliers(auth);

      // 3. Fetch Products and Depots
      try {
        final products = await _apiService.getArticles(auth.token!);
        final depots = await _apiService.getActiveDepots(auth.token!);
        if (!mounted) return;
        setState(() {
          _allProducts = products;
          _depots = depots;
        });
      } catch (e) {
        debugPrint('Error loading dependencies: $e');
      }
    });
  }

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

  double get _totalAmount => _items.fold(0.0, (sum, item) => sum + item.total);

  Future<void> _submit() async {
    if (_selectedSupplier == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez sélectionner un fournisseur')),
      );
      return;
    }
    if (_items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez ajouter des produits')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);

      double paid = double.tryParse(_paidAmountController.text) ?? 0.0;
      // Simple validation or logic: paid amount shouldn't exceed total ideally,
      // but let's allow flexibility or just clamp it if strict.
      // For now, we trust the input but ensure status is correct.

      String status = 'impayee';
      if (paid >= _totalAmount - 0.01) {
        // Tolerance for float comparison
        status = 'payee';
      } else if (paid > 0) {
        status = 'partiel';
      }

      await Provider.of<PurchaseProvider>(
        context,
        listen: false,
      ).createPurchase(
        auth,
        _selectedSupplier!,
        _selectedDepot != null ? _selectedDepot['nom'] : null,
        _invoiceNumberController.text.trim().isEmpty ? null : _invoiceNumberController.text.trim(),
        _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
        _items,
        _totalAmount,
        paid,
        status,
      );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Erreur: $e')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final supplierProvider = Provider.of<SupplierProvider>(context);

    return Scaffold(
      backgroundColor: _backgroundColor,
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
        title: const Text('Nouvelle Facture Achat', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Supplier & Payment Info
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                DropdownButtonFormField<Supplier>(
                  initialValue: _selectedSupplier,
                  decoration: InputDecoration(
                    labelText: 'Fournisseur',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: const Color(0xFFF0F2F5),
                  ),
                  items: supplierProvider.suppliers.map((s) {
                    return DropdownMenuItem(value: s, child: Text(s.name));
                  }).toList(),
                  onChanged: (val) {
                    setState(() => _selectedSupplier = val);
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<dynamic>(
                  initialValue: _selectedDepot,
                  decoration: InputDecoration(
                    labelText: 'Dépôt',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: const Color(0xFFF0F2F5),
                  ),
                  items: _depots.map((d) {
                    return DropdownMenuItem(value: d, child: Text(d['nom'] ?? 'Inconnu'));
                  }).toList(),
                  onChanged: (val) {
                    setState(() => _selectedDepot = val);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _invoiceNumberController,
                  decoration: InputDecoration(
                    labelText: 'N° Facture (Auto)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: const Color(0xFFF0F2F5),
                    helperText: 'Généré automatiquement si vide',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _paidAmountController,
                  decoration: InputDecoration(
                    labelText: 'Montant Versé (DA)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    helperText: 'Laisser vide ou 0 pour crédit',
                    filled: true,
                    fillColor: const Color(0xFFF0F2F5),
                  ),
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _notesController,
                  maxLength: 250,
                  maxLines: 2,
                  decoration: InputDecoration(
                    labelText: 'Notes',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: const Color(0xFFF0F2F5),
                  ),
                ),
              ],
            ),
          ),

          // Items List
          Expanded(
            child: ListView.builder(
              itemCount: _items.length,
              itemBuilder: (ctx, i) {
                final item = _items[i];
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: ListTile(
                    title: Text(item.productName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${item.quantity} x ${item.purchasePrice.toStringAsFixed(2)} DA', style: TextStyle(color: Colors.grey.shade600)),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('${item.total.toStringAsFixed(2)} DA', style: TextStyle(fontWeight: FontWeight.w900, color: _primaryColor)),
                        IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () {
                            setState(() {
                              _items.removeAt(i);
                            });
                          },
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Footer
          Container(
            padding: const EdgeInsets.all(16.0),
            color: Colors.white,
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Total:',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      '${_totalAmount.toStringAsFixed(2)} DA',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: _primaryColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: Icon(Icons.add, color: _primaryColor),
                        label: Text('Ajouter Produit', style: TextStyle(color: _primaryColor, fontWeight: FontWeight.w600)),
                        style: OutlinedButton.styleFrom(
                          side: BorderSide(color: _primaryColor),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        onPressed: _addItem,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _primaryColor,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                        child: _isLoading
                            ? const CircularProgressIndicator()
                            : const Text('Valider', style: TextStyle(fontWeight: FontWeight.bold)),
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

  const _ProductSelectionDialog({
    required this.products,
    required this.onSelected,
  });

  @override
  State<_ProductSelectionDialog> createState() =>
      _ProductSelectionDialogState();
}

class _ProductSelectionDialogState extends State<_ProductSelectionDialog> {
  dynamic _selectedProduct;
  final _qtyController = TextEditingController(text: '1');
  final _priceController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ajouter Produit'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<dynamic>(
              isExpanded: true,
              hint: const Text('Sélectionner un produit'),
              initialValue: _selectedProduct,
              items: widget.products.map((p) {
                return DropdownMenuItem(
                  value: p,
                  child: Text(
                    p['designation'] ?? 'Inconnu',
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              }).toList(),
              onChanged: (val) {
                setState(() {
                  _selectedProduct = val;
                  if (val != null) {
                    // Default price from product if available (prix_achat)
                    _priceController.text = (val['prix_achat'] ?? 0.0)
                        .toString();
                  }
                });
              },
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _qtyController,
              decoration: const InputDecoration(labelText: 'Quantité'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _priceController,
              decoration: const InputDecoration(labelText: 'Prix Achat (DA)'),
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Annuler'),
        ),
        ElevatedButton(
          onPressed: () {
            if (_selectedProduct == null) return;
            final qty = double.tryParse(_qtyController.text) ?? 1.0;
            final price = double.tryParse(_priceController.text) ?? 0.0;
            widget.onSelected(_selectedProduct, qty, price);
            Navigator.of(context).pop();
          },
          child: const Text('Ajouter'),
        ),
      ],
    );
  }
}
