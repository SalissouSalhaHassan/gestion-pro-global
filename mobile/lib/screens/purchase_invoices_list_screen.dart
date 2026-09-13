import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/purchase_provider.dart';
import 'add_purchase_invoice_screen.dart';
import 'edit_purchase_invoice_screen.dart';
import 'purchase_details_screen.dart';
import 'suppliers_list_screen.dart';
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
  final Color _primaryDark = const Color(0xFF0F172A);
  final Color _indigoTheme = const Color(0xFF4F46E5);
  final Color _purpleTheme = const Color(0xFF7C3AED);
  final Color _backgroundColor = const Color(0xFFF8FAFC);

  final TextEditingController _searchController = TextEditingController();
  final NumberFormat _numberFormat = NumberFormat("#,##0", "fr_FR");
  String _searchQuery = '';
  String _selectedStatus = 'all'; // 'all', 'Payée', 'Partielle', 'Non Payée'

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final purchaseProv = Provider.of<PurchaseProvider>(context, listen: false);
    Future.microtask(() {
      if (!mounted) return;
      purchaseProv.fetchPurchases(auth);
    });
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

  void _showActionMenu(BuildContext context, PurchaseInvoice invoice) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 8, bottom: 12),
                  height: 5,
                  width: 48,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: _indigoTheme.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(Icons.receipt_long, color: _indigoTheme, size: 22),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Achat N° ${invoice.invoiceNumber ?? 'PUR-${invoice.id ?? '-'}'}",
                              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                            ),
                            Text(
                              invoice.supplierName ?? 'Fournisseur inconnu',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 16),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.remove_red_eye_outlined, color: Colors.blue, size: 20),
                  ),
                  title: const Text("Voir Détails", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  subtitle: const Text("Articles, quantités et prix unitaires", style: TextStyle(fontSize: 12)),
                  onTap: () async {
                    Navigator.pop(ctx);
                    _openDetails(invoice);
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.emerald.shade50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.account_balance_wallet_outlined, color: Colors.emerald, size: 20),
                  ),
                  title: const Text("Règlement Fournisseur", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  subtitle: const Text("Enregistrer un décaissement ou acompte", style: TextStyle(fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _showPaymentModal(invoice);
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.purple.shade50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.print_outlined, color: Colors.purple, size: 20),
                  ),
                  title: const Text("Imprimer / Bon d'achat", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  subtitle: const Text("Générer le PDF de réception fournisseur", style: TextStyle(fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _previewPurchase(invoice);
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.edit_outlined, color: Colors.orange, size: 20),
                  ),
                  title: const Text("Modifier la facture", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  subtitle: const Text("Ajuster les articles ou montants", style: TextStyle(fontSize: 12)),
                  onTap: () async {
                    Navigator.pop(ctx);
                    _openEdit(invoice);
                  },
                ),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
                  ),
                  title: const Text("Supprimer l'achat", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Colors.red)),
                  subtitle: const Text("Annuler l'opération et déduire les stocks", style: TextStyle(fontSize: 12)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _confirmDeletion(invoice);
                  },
                ),
                const SizedBox(height: 10),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _openDetails(PurchaseInvoice invoice) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final api = ApiService();
      final fullData = await api.getPurchaseWithItems(invoice.id!);
      if (mounted) Navigator.pop(context);

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
  }

  Future<void> _openEdit(PurchaseInvoice invoice) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final api = ApiService();
      final fullData = await api.getPurchaseWithItems(invoice.id!);
      if (mounted) Navigator.pop(context);

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
    final double remainingAmount = (invoice.totalAmount - invoice.paidAmount).clamp(0, double.infinity);
    final amountController = TextEditingController(
      text: remainingAmount > 0 ? remainingAmount.toStringAsFixed(0) : '0',
    );
    String method = 'Espèces';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    height: 5,
                    width: 48,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.emerald.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.payment, color: Colors.emerald, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Règlement Fournisseur", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                          Text(
                            "Facture: ${invoice.invoiceNumber ?? 'PUR-${invoice.id}'} - ${invoice.supplierName ?? ''}",
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("Dette restante à régler:", style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.amber)),
                      Text(
                        "${_numberFormat.format(remainingAmount)} FCFA",
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.amber),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: amountController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    labelText: "Montant du versement (FCFA)",
                    prefixIcon: const Icon(Icons.monetization_on_outlined),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                    filled: true,
                    fillColor: Colors.grey.shade50,
                  ),
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: method,
                  items: ['Espèces', 'Mobile Money', 'Chèque', 'Virement'].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                  onChanged: (val) => setModalState(() => method = val!),
                  decoration: InputDecoration(
                    labelText: "Mode de règlement",
                    prefixIcon: const Icon(Icons.account_balance_wallet_outlined),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                    filled: true,
                    fillColor: Colors.grey.shade50,
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.emerald,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      elevation: 0,
                    ),
                    onPressed: () {
                      final amount = double.tryParse(amountController.text);
                      if (amount != null && amount > 0) {
                        _processPayment(invoice, amount, method);
                        Navigator.pop(ctx);
                      }
                    },
                    child: const Text("Valider le paiement", style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.emerald,
            content: Text("✅ Règlement enregistré avec succès"),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: Colors.red, content: Text("Erreur: $e")));
      }
    }
  }

  void _confirmDeletion(PurchaseInvoice invoice) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Colors.red, size: 28),
            SizedBox(width: 10),
            Text("Supprimer l'achat ?"),
          ],
        ),
        content: const Text(
          "Cette action est irréversible. Les stocks correspondants seront automatiquement déduits du dépôt.",
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Annuler"),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              _deletePurchase(invoice);
            },
            child: const Text("Supprimer"),
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.black87,
            content: Text("Achat supprimé et stock réajusté avec succès"),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(backgroundColor: Colors.red, content: Text("Erreur de suppression: $e")));
      }
    }
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Color bgIconColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.slate.withOpacity(0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title.toUpperCase(),
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                  color: Color(0xFF64748B),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: bgIconColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: iconColor, size: 18),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: iconColor == Colors.red ? const Color(0xFFE11D48) : const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final purchaseProvider = Provider.of<PurchaseProvider>(context);
    final purchases = purchaseProvider.purchases;

    // Financial KPI Calculations matching Web
    final double totalAchats = purchases.fold(0.0, (sum, p) => sum + p.totalAmount);
    final double totalPaye = purchases.fold(0.0, (sum, p) => sum + p.paidAmount);
    final double detteRestante = totalAchats - totalPaye;
    final int countAchats = purchases.length;

    // Filtering
    final filteredPurchases = purchases.where((inv) {
      // 1. Search Query
      if (_searchQuery.isNotEmpty) {
        final ref = (inv.invoiceNumber ?? '').toLowerCase();
        final supp = (inv.supplierName ?? '').toLowerCase();
        final depot = (inv.depotNom ?? '').toLowerCase();
        if (!ref.contains(_searchQuery) && !supp.contains(_searchQuery) && !depot.contains(_searchQuery)) {
          return false;
        }
      }

      // 2. Status Filter
      if (_selectedStatus != 'all') {
        final st = inv.status.toLowerCase();
        if (_selectedStatus == 'Payée') {
          final isPaid = (inv.paidAmount >= inv.totalAmount && inv.totalAmount > 0) || st == 'payée';
          if (!isPaid) return false;
        } else if (_selectedStatus == 'Partielle') {
          final isPart = (inv.paidAmount > 0 && inv.paidAmount < inv.totalAmount) || st.contains('partiel');
          if (!isPart) return false;
        } else if (_selectedStatus == 'Non Payée') {
          final isUnpaid = (inv.paidAmount <= 0) || st.contains('non');
          if (!isUnpaid) return false;
        }
      }

      return true;
    }).toList();

    return Scaffold(
      backgroundColor: _backgroundColor,
      body: CustomScrollView(
        slivers: [
          // 1. Executive Hero SliverAppBar
          SliverAppBar(
            expandedHeight: 240,
            pinned: true,
            elevation: 0,
            backgroundColor: _primaryDark,
            leading: IconButton(
              icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white, size: 20),
              onPressed: () => Navigator.pop(context),
            ),
            actions: [
              IconButton(
                icon: purchaseProvider.isLoading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, color: Colors.white, size: 22),
                tooltip: "Actualiser",
                onPressed: () {
                  purchaseProvider.fetchPurchases(
                    Provider.of<AuthProvider>(context, listen: false),
                    forceRefresh: true,
                  );
                },
              ),
              const SizedBox(width: 6),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0xFF0F172A), // Slate 900
                      Color(0xFF1E1B4B), // Indigo 950
                      Color(0xFF312E81), // Indigo 900
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 48, 20, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                                ),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 12),
                                  SizedBox(width: 5),
                                  Text(
                                    "APPROVISIONNEMENT & ACHATS",
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFF064E3B).withOpacity(0.6),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.auto_awesome, color: Color(0xFFFBBF24), size: 12),
                                  const SizedBox(width: 4),
                                  Text(
                                    "$countAchats Factures",
                                    style: const TextStyle(
                                      color: Color(0xFF34D399),
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          "Historique des Achats & Fournisseurs",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 19,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          "Pilotage des approvisionnements, factures d'achat, règlements et réceptions",
                          style: TextStyle(
                            color: Colors.slate.shade300,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const Spacer(),
                        // Dual Fast Actions: Fichier Fournisseurs & Nouvel Achat
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Colors.white24),
                                  backgroundColor: Colors.white.withOpacity(0.08),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                ),
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (context) => const SuppliersListScreen()),
                                  );
                                },
                                icon: const Icon(Icons.people_alt_outlined, color: Color(0xFF818CF8), size: 16),
                                label: const Text(
                                  "Fichier Fournisseurs",
                                  style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF4F46E5),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  elevation: 4,
                                ),
                                onPressed: () {
                                  final authProvider = Provider.of<AuthProvider>(context, listen: false);
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (context) => const AddPurchaseInvoiceScreen()),
                                  ).then((_) {
                                    if (!mounted) return;
                                    purchaseProvider.fetchPurchases(authProvider, forceRefresh: true);
                                  });
                                },
                                icon: const Icon(Icons.add_shopping_cart, size: 16),
                                label: const Text(
                                  "Nouvel Achat",
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          // 2. Executive 4K KPI Summary Grid
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: _buildKpiCard(
                          title: "Total Achats",
                          value: "${_numberFormat.format(totalAchats)} F",
                          subtitle: "Volume global facturé",
                          icon: Icons.shopping_bag_outlined,
                          iconColor: const Color(0xFF4F46E5),
                          bgIconColor: const Color(0xFFEEF2FF),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildKpiCard(
                          title: "Montant Réglé",
                          value: "${_numberFormat.format(totalPaye)} F",
                          subtitle: "Paiements décaissés",
                          icon: Icons.check_circle_outline,
                          iconColor: const Color(0xFF059669),
                          bgIconColor: const Color(0xFFECFDF5),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _buildKpiCard(
                          title: "Dettes Fournisseurs",
                          value: "${_numberFormat.format(detteRestante)} F",
                          subtitle: "Restant dû à décaisser",
                          icon: Icons.account_balance_wallet_outlined,
                          iconColor: const Color(0xFFE11D48),
                          bgIconColor: const Color(0xFFFFF1F2),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildKpiCard(
                          title: "Commandes",
                          value: "$countAchats",
                          subtitle: "Factures validées",
                          icon: Icons.receipt_long_outlined,
                          iconColor: const Color(0xFF7C3AED),
                          bgIconColor: const Color(0xFFF5F3FF),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // 3. Search & Filter Bar Toolbar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Search Box
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.slate.withOpacity(0.15)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.02),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        hintText: 'Rechercher réf, fournisseur, magasin...',
                        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                        prefixIcon: const Icon(Icons.search, color: Color(0xFF4F46E5), size: 20),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, color: Colors.grey, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  FocusScope.of(context).unfocus();
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip("Tous", 'all'),
                        const SizedBox(width: 8),
                        _buildFilterChip("Payée", 'Payée', activeColor: const Color(0xFF059669)),
                        const SizedBox(width: 8),
                        _buildFilterChip("Partielle", 'Partielle', activeColor: const Color(0xFFD97706)),
                        const SizedBox(width: 8),
                        _buildFilterChip("Non Payée", 'Non Payée', activeColor: const Color(0xFFE11D48)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 4. Invoices List or Empty State
          if (purchaseProvider.isLoading)
            const SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Color(0xFF4F46E5)),
                    SizedBox(height: 16),
                    Text(
                      "Chargement des achats...",
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
            )
          else if (filteredPurchases.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.indigo.shade50,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.shopping_cart_outlined, size: 54, color: _indigoTheme.withOpacity(0.5)),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        _searchQuery.isNotEmpty ? 'Aucune facture correspondante' : 'Aucune facture d\'achat enregistrée',
                        style: const TextStyle(color: Color(0xFF1E293B), fontSize: 16, fontWeight: FontWeight.w900),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _searchQuery.isNotEmpty
                            ? 'Vérifiez le terme saisi dans la barre de recherche.'
                            : 'Créez votre première facture d\'achat pour alimenter les stocks et suivre vos règlements.',
                        style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _indigoTheme,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                        ),
                        onPressed: () {
                          final authProvider = Provider.of<AuthProvider>(context, listen: false);
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => const AddPurchaseInvoiceScreen()),
                          ).then((_) {
                            if (!mounted) return;
                            purchaseProvider.fetchPurchases(authProvider, forceRefresh: true);
                          });
                        },
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text("Créer un achat", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 80),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    final invoice = filteredPurchases[index];
                    return _buildPurchaseCard(invoice);
                  },
                  childCount: filteredPurchases.length,
                ),
              ),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          final authProvider = Provider.of<AuthProvider>(context, listen: false);
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AddPurchaseInvoiceScreen()),
          ).then((_) {
            if (!mounted) return;
            purchaseProvider.fetchPurchases(authProvider, forceRefresh: true);
          });
        },
        backgroundColor: _indigoTheme,
        elevation: 4,
        icon: const Icon(Icons.add, color: Colors.white, size: 20),
        label: const Text(
          "Nouvel Achat",
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 13),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String value, {Color activeColor = const Color(0xFF4F46E5)}) {
    final bool isSelected = _selectedStatus == value;
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () {
        setState(() {
          _selectedStatus = value;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? activeColor : Colors.slate.withOpacity(0.18),
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: activeColor.withOpacity(0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w900 : FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildPurchaseCard(PurchaseInvoice invoice) {
    final double restAmount = (invoice.totalAmount - invoice.paidAmount).clamp(0, double.infinity);
    final bool isPaid = invoice.paidAmount >= invoice.totalAmount && invoice.totalAmount > 0;
    final bool isPartial = invoice.paidAmount > 0 && invoice.paidAmount < invoice.totalAmount;

    Color badgeColor = const Color(0xFFE11D48); // Rose/Red
    Color badgeBg = const Color(0xFFFFF1F2);
    String statusText = "NON PAYÉE";
    IconData statusIcon = Icons.error_outline;

    if (isPaid || invoice.status.toLowerCase() == 'payée') {
      badgeColor = const Color(0xFF059669); // Emerald
      badgeBg = const Color(0xFFECFDF5);
      statusText = "PAYÉE";
      statusIcon = Icons.check_circle_outline;
    } else if (isPartial || invoice.status.toLowerCase().contains('partiel')) {
      badgeColor = const Color(0xFFD97706); // Amber
      badgeBg = const Color(0xFFFFFBEB);
      statusText = "PARTIELLE";
      statusIcon = Icons.access_time;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.slate.withOpacity(0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _showActionMenu(context, invoice),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Header Row
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEEF2FF),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFC7D2FE)),
                          ),
                          child: Text(
                            invoice.invoiceNumber ?? 'PUR-${invoice.id ?? '-'}',
                            style: const TextStyle(
                              color: Color(0xFF4338CA),
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              fontFamily: 'monospace',
                            ),
                          ),
                        ),
                        if (invoice.depotNom != null && invoice.depotNom!.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.slate.shade100,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.storefront, size: 11, color: Colors.slate.shade600),
                                const SizedBox(width: 3),
                                Text(
                                  invoice.depotNom!,
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.slate.shade700),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                    Row(
                      children: [
                        Icon(Icons.calendar_today_outlined, size: 12, color: Colors.grey.shade500),
                        const SizedBox(width: 4),
                        Text(
                          DateFormat('dd/MM/yyyy').format(invoice.date),
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Supplier Row
                Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: const Color(0xFFF1F5F9),
                      child: const Icon(Icons.business, size: 18, color: Color(0xFF475569)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            invoice.supplierName ?? 'Fournisseur direct',
                            style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 14,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (invoice.notes != null && invoice.notes!.isNotEmpty)
                            Text(
                              invoice.notes!,
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                    // Status Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: badgeBg,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: badgeColor.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(statusIcon, size: 12, color: badgeColor),
                          const SizedBox(width: 4),
                          Text(
                            statusText,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: badgeColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Financial 3-column stats
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Total
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Total Achat", style: TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text(
                            "${_numberFormat.format(invoice.totalAmount)} F",
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                          ),
                        ],
                      ),
                      // Paid
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const Text("Montant Réglé", style: TextStyle(fontSize: 10, color: Color(0xFF059669), fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text(
                            "${_numberFormat.format(invoice.paidAmount)} F",
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w900, color: Color(0xFF059669)),
                          ),
                        ],
                      ),
                      // Reste
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          const Text("Dette Restante", style: TextStyle(fontSize: 10, color: Color(0xFFE11D48), fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text(
                            "${_numberFormat.format(restAmount)} F",
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                              color: restAmount > 0 ? const Color(0xFFE11D48) : const Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                // Card Footer Action Buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        foregroundColor: const Color(0xFF4F46E5),
                      ),
                      onPressed: () => _openDetails(invoice),
                      icon: const Icon(Icons.visibility_outlined, size: 16),
                      label: const Text("Détails", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    ),
                    const SizedBox(width: 4),
                    TextButton.icon(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        foregroundColor: Colors.purple,
                      ),
                      onPressed: () => _previewPurchase(invoice),
                      icon: const Icon(Icons.print_outlined, size: 16),
                      label: const Text("Imprimer", style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    ),
                    const SizedBox(width: 4),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: restAmount > 0 ? Colors.emerald : Colors.grey.shade100,
                        foregroundColor: restAmount > 0 ? Colors.white : Colors.grey.shade700,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      ),
                      onPressed: () => _showPaymentModal(invoice),
                      icon: Icon(Icons.payment, size: 15, color: restAmount > 0 ? Colors.white : Colors.grey.shade600),
                      label: Text(
                        restAmount > 0 ? "Régler" : "Payé",
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
