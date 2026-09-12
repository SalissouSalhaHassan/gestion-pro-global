import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/purchase_provider.dart';
import 'add_purchase_invoice_screen.dart';
import 'edit_purchase_invoice_screen.dart';
import 'purchase_details_screen.dart';
import 'pdf_preview_screen.dart';
import '../utils/pdf_purchase_generator.dart';
import '../models/company_model.dart';
import '../api/api_service.dart';
import '../models/purchase_invoice_model.dart';

class PurchaseInvoicesListScreen extends StatefulWidget {
  const PurchaseInvoicesListScreen({super.key});

  @override
  State<PurchaseInvoicesListScreen> createState() =>
      _PurchaseInvoicesListScreenState();
}

class _PurchaseInvoicesListScreenState extends State<PurchaseInvoicesListScreen> {
  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF3F5F9);

  final TextEditingController _searchController = TextEditingController();
  final NumberFormat _numberFormat = NumberFormat("#,##0.00", "fr_FR");
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final purchaseProv = Provider.of<PurchaseProvider>(context, listen: false);
    Future.microtask(
      () {
        if (!mounted) return;
        purchaseProv.fetchPurchases(auth);
      },
    );
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showActionMenu(BuildContext context, dynamic invoice) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 5),
                height: 5,
                width: 50,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Text(
                  "Achat N° ${invoice.invoiceNumber ?? '-'}",
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.info_outline, color: Colors.blue),
                title: const Text("Voir Détails"),
                onTap: () async {
                  Navigator.pop(ctx); // Close the bottom sheet

                  // Show loading
                  showDialog(
                    context: context,
                    barrierDismissible: false,
                    builder: (ctx) => const Center(child: CircularProgressIndicator()),
                  );
                  
                  try {
                    final auth = Provider.of<AuthProvider>(context, listen: false);
                    final api = ApiService();
                    final fullData = await api.getPurchaseWithItems(invoice.id!);
                    if (mounted) Navigator.pop(context); // hide loading
                    
                    PurchaseInvoice detailInvoice = invoice;
                    if (fullData != null) {
                      detailInvoice = PurchaseInvoice.fromJson(fullData);
                    }
                    
                    if (mounted) {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => PurchaseDetailsScreen(invoice: detailInvoice),
                        ),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
                    }
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.print, color: Colors.purple),
                title: const Text("Imprimer"),
                onTap: () {
                  Navigator.pop(ctx);
                  _previewPurchase(invoice);
                },
              ),
              ListTile(
                leading: const Icon(Icons.edit, color: Colors.orange),
                title: const Text("Modifier"),
                onTap: () async {
                  Navigator.pop(ctx);
                  // Show loading
                  showDialog(
                    context: context,
                    barrierDismissible: false,
                    builder: (ctx) => const Center(child: CircularProgressIndicator()),
                  );
                  
                  try {
                    final api = ApiService();
                    final fullData = await api.getPurchaseWithItems(invoice.id!);
                    if (mounted) Navigator.pop(context); // hide loading
                    
                    PurchaseInvoice editInvoice = invoice;
                    if (fullData != null) {
                      editInvoice = PurchaseInvoice.fromJson(fullData);
                    }
                    
                    if (mounted) {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => EditPurchaseInvoiceScreen(invoice: editInvoice),
                        ),
                      );
                    }
                  } catch (e) {
                    if (mounted) {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
                    }
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.payment, color: Colors.green),
                title: const Text("Règlement"),
                onTap: () {
                  Navigator.pop(ctx);
                  _showPaymentModal(invoice);
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text("Supprimer"),
                onTap: () {
                  Navigator.pop(ctx);
                  _confirmDeletion(invoice);
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _previewPurchase(PurchaseInvoice invoice) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final api = ApiService();

      // Fetch full details (items) before previewing
      final fullData = await api.getPurchaseWithItems(invoice.id!);
      PurchaseInvoice finalInvoice = invoice;
      if (fullData != null) {
        finalInvoice = PurchaseInvoice.fromJson(fullData);
      }

      final companyMap = await api.getCompanyInfo(auth.token!);
      final company = CompanyInfo.fromJson(companyMap);

      if (mounted) {
        Navigator.pop(context);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (ctx) => PdfPreviewScreen(
              invoiceRef: finalInvoice.invoiceNumber ?? 'PUR-${finalInvoice.id}',
              buildPdf: (format) => PdfPurchaseGenerator.generatePdf(company, finalInvoice),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur PDF: $e')),
        );
      }
    }
  }

  void _showPaymentModal(PurchaseInvoice invoice) {
    final amountController = TextEditingController(text: (invoice.totalAmount - invoice.paidAmount).toStringAsFixed(0));
    String method = 'Espèces';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text("Règlement Achat", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 20),
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: "Montant"),
              ),
              const SizedBox(height: 15),
              DropdownButtonFormField<String>(
                value: method,
                items: ['Espèces', 'Mobile Money', 'Chèque', 'Virement'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                onChanged: (val) => method = val!,
                decoration: const InputDecoration(labelText: "Mode"),
              ),
              const SizedBox(height: 25),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: _primaryColor, foregroundColor: Colors.white),
                  onPressed: () {
                    final amount = double.tryParse(amountController.text);
                    if (amount != null && amount > 0) {
                      _processPayment(invoice, amount, method);
                      Navigator.pop(ctx);
                    }
                  },
                  child: const Text("Valider le paiement"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _processPayment(PurchaseInvoice inv, double amount, String method) async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final prov = Provider.of<PurchaseProvider>(context, listen: false);
      await prov.payPurchase(auth, inv.id!, amount, method);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Paiement enregistré")));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur: $e")));
      }
    }
  }

  void _confirmDeletion(PurchaseInvoice invoice) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Supprimer l'achat ?"),
        content: const Text("Cette action est irréversible et annulera les stocks correspondants."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Annuler")),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _deletePurchase(invoice);
            },
            child: const Text("Supprimer", style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Future<void> _deletePurchase(PurchaseInvoice invoice) async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final prov = Provider.of<PurchaseProvider>(context, listen: false);
      await prov.deletePurchase(auth, invoice.id!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Achat supprimé")));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur lors de la suppression: $e")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final purchaseProvider = Provider.of<PurchaseProvider>(context);

    // Filter purchases
    final filteredPurchases = purchaseProvider.purchases.where((inv) {
      if (_searchQuery.isEmpty) return true;
      final ref = (inv.invoiceNumber ?? '').toLowerCase();
      final supp = (inv.supplierName ?? '').toLowerCase();
      return ref.contains(_searchQuery) || supp.contains(_searchQuery);
    }).toList();

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
        title: const Text(
          'Factures d\'achat',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () {
              purchaseProvider.fetchPurchases(
                Provider.of<AuthProvider>(context, listen: false),
                forceRefresh: true,
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Container(
            padding: const EdgeInsets.all(15),
            color: _backgroundColor,
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Rechercher (Réf, Fournisseur)...',
                hintStyle: TextStyle(color: Colors.grey.shade500),
                prefixIcon: Icon(Icons.search, color: _primaryColor),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 20),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide.none,
                ),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.grey),
                        onPressed: () {
                          _searchController.clear();
                          FocusScope.of(context).unfocus();
                        },
                      )
                    : null,
              ),
            ),
          ),
          
          Expanded(
            child: purchaseProvider.isLoading
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : filteredPurchases.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.dashboard_customize_outlined, size: 80, color: Colors.grey.shade300),
                            const SizedBox(height: 20),
                            Text(
                              _searchQuery.isNotEmpty ? 'Aucun résultat' : 'Aucune facture d\'achat',
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 18, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: filteredPurchases.length,
                        itemBuilder: (ctx, i) {
                          final invoice = filteredPurchases[i];
                          final bool isPaid = invoice.paidAmount >= invoice.totalAmount && invoice.totalAmount > 0;
                          final bool isPartial = invoice.paidAmount > 0 && invoice.paidAmount < invoice.totalAmount;
                          
                          Color statusColor = Colors.red;
                          String statusText = "Non Payée";
                          
                          if (isPaid || invoice.status.toLowerCase().contains("pay")) {
                             if (invoice.status.toLowerCase() == "payée" || isPaid) {
                               statusColor = Colors.green;
                               statusText = "Payée";
                             } else if (invoice.status.toLowerCase().contains("partiel") || isPartial) {
                               statusColor = Colors.orange;
                               statusText = "Partielle";
                             }
                          }

                          return Container(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () => _showActionMenu(context, invoice),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          "Réf: ${invoice.invoiceNumber ?? '-'}",
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            color: _primaryColor,
                                            fontSize: 14,
                                          ),
                                        ),
                                        Text(
                                          DateFormat('dd/MM/yyyy').format(invoice.date),
                                          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      invoice.supplierName ?? 'Fournisseur inconnu',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16,
                                        color: Colors.black87,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Total: ${_numberFormat.format(invoice.totalAmount)} F',
                                              style: const TextStyle(
                                                fontWeight: FontWeight.w900,
                                                fontSize: 14,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              'Payé: ${_numberFormat.format(invoice.paidAmount)} F',
                                              style: TextStyle(
                                                color: Colors.green.shade700,
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13,
                                              ),
                                            ),
                                          ],
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: statusColor.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(8),
                                            border: Border.all(color: statusColor.withValues(alpha: 0.5)),
                                          ),
                                          child: Text(
                                            statusText.toUpperCase(),
                                            style: TextStyle(
                                              fontSize: 11,
                                              color: statusColor,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          final authProvider = Provider.of<AuthProvider>(context, listen: false);
          final purchaseProvider = Provider.of<PurchaseProvider>(context, listen: false);
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AddPurchaseInvoiceScreen()),
          ).then((_) {
            if (!mounted) return;
            purchaseProvider.fetchPurchases(
              authProvider,
              forceRefresh: true,
            );
          });
        },
        backgroundColor: _primaryColor,
        child: const Icon(Icons.add, color: Colors.white, size: 28),
      ),
    );
  }
}
