import 'package:flutter/material.dart';
import 'dart:async';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../models/invoice_model.dart';
import '../utils/pdf_generator.dart';
import '../models/company_model.dart';
import '../models/article_model.dart';
import 'pdf_preview_screen.dart';
import 'edit_invoice_screen.dart';
import '../models/deposit_model.dart';
import '../services/excel_export_service.dart';

class InvoicesListScreen extends StatefulWidget {
  const InvoicesListScreen({super.key});

  @override
  State<InvoicesListScreen> createState() => _InvoicesListScreenState();
}

class _InvoicesListScreenState extends State<InvoicesListScreen> {
  List<Invoice> _invoices = [];
  bool _isLoading = true;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  int _currentPage = 0;
  final int _pageSize = 20;

  final _numberFormat = NumberFormat("#,##0", "fr_FR");
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  
  // For Smart Search
  List<Invoice> _allFetchedInvoices = []; // All data from server
  List<Invoice> _displayInvoices = [];    // Filtered data for UI
  Timer? _debounce;

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFE5E5E5);

  @override
  void initState() {
    super.initState();
    _fetchInvoices();
    _searchController.addListener(_onSearchChanged);
    _scrollController.addListener(_scrollListener);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _scrollListener() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      if (!_isFetchingMore && _hasMore && !_isLoading) {
        _fetchInvoices(loadMore: true);
      }
    }
  }

  void _onSearchChanged() {
    final query = _searchController.text.toLowerCase().trim();
    
    // 1. Instant Local Filter (Smart & Fast)
    if (query.isEmpty) {
      _displayInvoices = List.from(_allFetchedInvoices);
    } else {
      _displayInvoices = _allFetchedInvoices.where((inv) {
        return inv.blNumber.toLowerCase().contains(query) || 
               inv.clientName.toLowerCase().contains(query) ||
               inv.vendeur.toLowerCase().contains(query) ||
               inv.emplacement.toLowerCase().contains(query);
      }).toList();
    }
    setState(() {}); // Immediate update

    // 2. Debounced Server Search
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () {
      _fetchInvoices(forceRefresh: true);
    });
  }

  Future<void> _fetchInvoices({bool forceRefresh = false, bool loadMore = false}) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final token = auth.token;
    if (token == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    if (loadMore) {
      if (_isFetchingMore || !_hasMore) return;
      setState(() => _isFetchingMore = true);
    } else {
      setState(() {
        _isLoading = true;
        _currentPage = 0;
        _hasMore = true;
      });
    }

    try {
      final String searchQuery = _searchController.text.trim();
      
      final data = await ApiService().getInvoices(
        token,
        forceRefresh: forceRefresh,
        vendeur: auth.isAdmin ? null : auth.username,
        page: _currentPage,
        pageSize: _pageSize,
        search: searchQuery.isNotEmpty ? searchQuery : null,
      );
      
      if (mounted) {
        setState(() {
          final List<Invoice> mapped = [];
          for (var json in data) {
            try {
              mapped.add(Invoice.fromJson(Map<String, dynamic>.from(json)));
            } catch (e) {
              debugPrint("❌ Item parsing error: $e");
            }
          }
          
          if (loadMore) {
            _allFetchedInvoices.addAll(mapped);
          } else {
            _allFetchedInvoices = mapped;
          }

          // Apply local filter to new data
          final query = _searchController.text.toLowerCase().trim();
          if (query.isEmpty) {
            _displayInvoices = List.from(_allFetchedInvoices);
          } else {
            _displayInvoices = _allFetchedInvoices.where((inv) {
              return inv.blNumber.toLowerCase().contains(query) || 
                     inv.clientName.toLowerCase().contains(query) ||
                     inv.vendeur.toLowerCase().contains(query) ||
                     inv.emplacement.toLowerCase().contains(query);
            }).toList();
          }

          if (mapped.length < _pageSize) {
            _hasMore = false;
          } else {
            _currentPage++;
          }
          
          _isLoading = false;
          _isFetchingMore = false;
        });
      }
    } catch (e) {
      debugPrint("❌ Erreur chargement invoices: $e");
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isFetchingMore = false;
        });
      }
    }
  }

  Future<void> _processPayment(
    Invoice invoice,
    double amount,
    String method, {
    String? advanceClientId,
  }) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final api = ApiService();

      await api.payInvoice(
        invoice.id,
        amount,
        method,
        auth.token!,
        advanceClientId: advanceClientId,
      );

      if (mounted) Navigator.pop(context);

      setState(() {
        final index = _allFetchedInvoices.indexWhere((i) => i.id == invoice.id);
        if (index != -1) {
          _allFetchedInvoices[index].montantPaye += amount;
          if (_allFetchedInvoices[index].montantPaye >= _allFetchedInvoices[index].totalTTC - 0.01) {
            _allFetchedInvoices[index].statut = "Payée";
          } else if (_allFetchedInvoices[index].montantPaye > 0.01) {
            _allFetchedInvoices[index].statut = "Payée Partiellement";
          }
          
          // Also update display list if visible
          final dispIndex = _displayInvoices.indexWhere((i) => i.id == invoice.id);
          if (dispIndex != -1) {
            _displayInvoices[dispIndex] = _allFetchedInvoices[index];
          }
        }
      });

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Paiement réussi !"), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text("Erreur"),
            content: Text(e.toString().replaceAll("Exception:", "")),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("OK")),
            ],
          ),
        );
      }
    }
  }

  Future<void> _previewInvoice(Invoice inv, {String mode = 'Invoice'}) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final api = ApiService();

      final companyInfoMap = await api.getCompanyInfo(auth.token!);
      final companyInfo = CompanyInfo.fromJson(companyInfoMap);
      final itemsData = await api.getInvoiceItems(inv.id.toString(), auth.token!);

      final List<Map<String, dynamic>> pdfItems = itemsData.map((item) {
        final price = (item['pu_ttc'] ?? item['price'] ?? 0) as num;
        final qty = (item['qte'] ?? item['quantity'] ?? 1) as num;
        return {
          "code_art": (item['code_art'] ?? item['reference'] ?? item['code'] ?? "-").toString(),
          "name": (item['designation'] ?? item['description'] ?? "Article").toString(),
          "depot": (item['depot_origine'] ?? item['depots']?['nom'] ?? (inv.emplacement.isNotEmpty ? inv.emplacement : "Boutique")).toString(),
          "quantity": qty.toDouble(),
          "price": price.toDouble(),
          "total": (item['total_item_ttc'] ?? item['total'] as num?)?.toDouble() ?? (price.toDouble() * qty.toDouble()),
        };
      }).toList();

      if (pdfItems.isEmpty) {
        pdfItems.add({
          "code_art": "-",
          "name": "Détails non disponibles",
          "depot": inv.emplacement.isNotEmpty ? inv.emplacement : "Boutique",
          "quantity": 1.0,
          "price": inv.totalTTC,
          "total": inv.totalTTC,
        });
      }

      List<Map<String, dynamic>> payments = [];
      try {
        final rawPayments = await api.getInvoicePayments(inv.id, auth.token!);
        payments = rawPayments.map((p) => {
          'date': p['date_operation'] ?? '',
          'method': p['moyen_reglement'] ?? '',
          'amount': ((p['montant_regle'] ?? 0) as num).toDouble(),
        }).toList();
      } catch (_) {}

      if (mounted) {
        Navigator.pop(context);
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => PdfPreviewScreen(
              invoiceRef: inv.blNumber,
              initialMode: mode,
              enableModeToggle: true,
              buildPdfWithMode: (format, currentMode) async {
                return PdfInvoiceGenerator.generateInvoice(
                  company: companyInfo,
                  clientName: inv.clientName,
                  items: pdfItems,
                  totalAmount: inv.totalTTC,
                  invoiceRef: inv.blNumber,
                  sellerName: inv.vendeur.isNotEmpty ? inv.vendeur : (auth.username ?? "Admin"),
                  paidAmount: inv.montantPaye,
                  location: inv.emplacement,
                  payments: payments,
                  pageFormat: format,
                  mode: currentMode,
                  invoiceDate: DateTime.tryParse(inv.date),
                  invoiceId: inv.id,
                );
              },
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Erreur PDF: $e"), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _cancelInvoice(Invoice invoice) async {
    setState(() {
      final index = _allFetchedInvoices.indexWhere((i) => i.id == invoice.id);
      if (index != -1) {
        _allFetchedInvoices[index].statut = "Annulée";
        
        final dispIndex = _displayInvoices.indexWhere((i) => i.id == invoice.id);
        if (dispIndex != -1) {
          _displayInvoices[dispIndex].statut = "Annulée";
        }
      }
    });

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      await ApiService().cancelInvoice(invoice.id, auth.token!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Facture annulée"), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Erreur: $e"), backgroundColor: Colors.red),
        );
        _fetchInvoices();
      }
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
              colors: [_primaryColor, _secondaryColor],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        title: const Text(
          "Factures",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 22, color: Colors.white),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download, color: Colors.white),
            onPressed: () {
              if (_invoices.isEmpty) return;
              final data = _invoices.map((i) => {
                'numero': i.blNumber,
                'date': i.date,
                'client_nom': i.clientName,
                'total': i.totalTTC,
                'statut': i.statut,
              }).toList();
              ExcelExportService.exportInvoices(data, context);
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () => _fetchInvoices(forceRefresh: true),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : _displayInvoices.isEmpty
                ? Center(child: Text(_searchController.text.isEmpty ? "Aucune facture trouvée" : "Aucun résultat pour \"${_searchController.text}\"", style: TextStyle(color: Colors.grey.shade600, fontSize: 16)))
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
                    itemCount: _displayInvoices.length + (_hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == _displayInvoices.length) {
                        return Padding(
                          padding: const EdgeInsets.all(15),
                          child: Center(child: CircularProgressIndicator(color: _primaryColor)),
                        );
                      }
                      return _buildInvoiceCard(_displayInvoices[index]);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(25)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: TextField(
        controller: _searchController,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          hintText: "Rechercher (Client, N°, Vendeur)...",
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 15),
          prefixIcon: Icon(Icons.search_rounded, color: _primaryColor, size: 28),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.cancel_rounded, color: Colors.grey),
                  onPressed: () {
                    _searchController.clear();
                    _onSearchChanged();
                  },
                )
              : null,
          filled: true,
          fillColor: const Color(0xFFF5F7FA),
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(15),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(15),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(15),
            borderSide: BorderSide(color: _primaryColor.withOpacity(0.3), width: 1),
          ),
        ),
      ),
    );
  }

  Widget _buildInvoiceCard(Invoice inv) {
    double restant = inv.totalTTC - inv.montantPaye;
    if (restant < 0) restant = 0;

    bool isCancelled = inv.statut.toLowerCase().contains("annul");
    bool isPaid = !isCancelled && (restant <= 1.0);

    Color statusColor = isCancelled ? Colors.grey : (isPaid ? Colors.green : (inv.montantPaye > 0 ? Colors.orange : Colors.red));
    String statusText = isCancelled ? "ANNULÉE" : (isPaid ? "PAYÉE" : (inv.montantPaye > 0 ? "PARTIEL" : "NON PAYÉE"));

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Container(width: 8, color: statusColor),
              Expanded(
                child: InkWell(
                  onTap: () => _showInvoiceOptions(inv),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(inv.blNumber, style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey.shade600, fontSize: 13)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                              child: Text(statusText, style: TextStyle(color: statusColor, fontWeight: FontWeight.w900, fontSize: 11)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: const Color(0xFFF3F5F9),
                              child: Text(inv.clientName.isNotEmpty ? inv.clientName[0].toUpperCase() : "?", 
                                style: TextStyle(color: _primaryColor, fontWeight: FontWeight.w900, fontSize: 18)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(inv.clientName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18), maxLines: 1, overflow: TextOverflow.ellipsis),
                                  Text(inv.date, style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                                ],
                              ),
                            ),
                            Icon(Icons.more_vert_rounded, color: Colors.grey.shade400),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            _buildInfoTag(Icons.person, inv.vendeur.isNotEmpty ? inv.vendeur : "Admin"),
                            const SizedBox(width: 10),
                            _buildInfoTag(Icons.store, inv.emplacement.isNotEmpty ? inv.emplacement : "Boutique"),
                          ],
                        ),
                        const Padding(padding: EdgeInsets.symmetric(vertical: 15), child: Divider(height: 1, thickness: 0.8)),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildBigAmountColumn("TOTAL", inv.totalTTC, Colors.black87),
                            _buildBigAmountColumn("PAYÉ", inv.montantPaye, Colors.green.shade700),
                            _buildBigAmountColumn("RESTANT", isCancelled ? 0.0 : restant, isCancelled ? Colors.grey : const Color(0xFFD32F2F)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoTag(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F2F5),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Colors.blueGrey),
          const SizedBox(width: 4),
          Text(
            text,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Colors.blueGrey,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBigAmountColumn(String label, double amount, Color valueColor) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.blueGrey.shade400)),
        const SizedBox(height: 6),
        Text(_numberFormat.format(amount), style: TextStyle(fontWeight: FontWeight.w900, fontSize: 21, color: valueColor)),
      ],
    );
  }

  void _showInvoiceOptions(Invoice inv) {
    bool isCancelled = inv.statut.toLowerCase().contains("annul");
    double restant = inv.totalTTC - inv.montantPaye;
    bool isPaid = restant <= 1.0;
    final auth = Provider.of<AuthProvider>(context, listen: false);

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(padding: const EdgeInsets.all(15), child: Text(inv.blNumber, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.grey))),
            if (!isCancelled && !isPaid)
              ListTile(
                leading: const CircleAvatar(backgroundColor: Colors.green, child: Icon(Icons.attach_money, color: Colors.white)),
                title: const Text("Effectuer un règlement", style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () { Navigator.pop(context); _showPaymentModal(inv); },
              ),
            if (!isCancelled && auth.isAdmin)
              ListTile(
                leading: const CircleAvatar(backgroundColor: Colors.orange, child: Icon(Icons.edit, color: Colors.white)),
                title: const Text("Modifier la facture", style: TextStyle(fontWeight: FontWeight.bold)),
                onTap: () async {
                  Navigator.pop(context);
                  bool? result = await Navigator.push(context, MaterialPageRoute(builder: (context) => EditInvoiceScreen(invoice: inv)));
                  if (result == true) _fetchInvoices();
                },
              ),
            ListTile(
              leading: const CircleAvatar(backgroundColor: Color(0xFF059669), child: Icon(Icons.receipt_long, color: Colors.white)),
              title: const Text("Facture de Vente (Reçu)", style: TextStyle(fontWeight: FontWeight.bold)),
              subtitle: const Text("Reçu officiel conforme au Web"),
              onTap: () { Navigator.pop(context); _previewInvoice(inv, mode: 'Invoice'); },
            ),
            ListTile(
              leading: const CircleAvatar(backgroundColor: Color(0xFFEA580C), child: Icon(Icons.local_shipping_outlined, color: Colors.white)),
              title: const Text("Bon de Livraison (BL)", style: TextStyle(fontWeight: FontWeight.bold)),
              subtitle: const Text("Bordereau sans montants financiers"),
              onTap: () { Navigator.pop(context); _previewInvoice(inv, mode: 'BL'); },
            ),
            if (!isCancelled && auth.canDeleteInvoice)
              ListTile(
                leading: const CircleAvatar(backgroundColor: Colors.redAccent, child: Icon(Icons.cancel, color: Colors.white)),
                title: const Text("Annuler la facture"),
                onTap: () { Navigator.pop(context); _confirmCancellation(inv); },
              ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _showPaymentModal(Invoice inv) {
    double restant = inv.totalTTC - inv.montantPaye;
    final amountController = TextEditingController(text: restant.toInt().toString());
    String method = "Espèces";
    List<Deposit> availableAcomptes = [];
    Deposit? selectedAcompte;
    bool isLoadingAcomptes = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Container(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text("Nouveau Règlement", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                const SizedBox(height: 30),
                TextField(
                  controller: amountController,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  decoration: InputDecoration(labelText: "Montant à verser", border: OutlineInputBorder(borderRadius: BorderRadius.circular(15))),
                ),
                const SizedBox(height: 20),
                DropdownButtonFormField<String>(
                  value: method,
                  items: ["Espèces", "Mobile Money", "Chèque", "Virement", "Acompte"].map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                  onChanged: (v) async {
                    setModalState(() {
                      method = v.toString();
                      if (method != "Acompte") selectedAcompte = null;
                    });
                    if (method == "Acompte" && availableAcomptes.isEmpty) {
                      setModalState(() => isLoadingAcomptes = true);
                      try {
                        final auth = Provider.of<AuthProvider>(context, listen: false);
                        final all = await ApiService().getDeposits(auth.token!);
                        setModalState(() {
                          availableAcomptes = all.map((j) => Deposit.fromJson(j)).where((d) => d.clientId == inv.clientId && d.remainingAmount > 0).toList();
                          isLoadingAcomptes = false;
                        });
                      } catch (_) { setModalState(() => isLoadingAcomptes = false); }
                    }
                  },
                  decoration: InputDecoration(labelText: "Moyen de paiement", border: OutlineInputBorder(borderRadius: BorderRadius.circular(15))),
                ),
                if (method == "Acompte") ...[
                  const SizedBox(height: 20),
                  if (isLoadingAcomptes) const CircularProgressIndicator()
                  else if (availableAcomptes.isEmpty) const Text("Aucun acompte disponible", style: TextStyle(color: Colors.red))
                  else DropdownButtonFormField<Deposit>(
                    value: selectedAcompte,
                    items: availableAcomptes.map((a) => DropdownMenuItem(value: a, child: Text("${a.reference} (${a.remainingAmount.toInt()} F)"))).toList(),
                    onChanged: (v) => setModalState(() { selectedAcompte = v; if (v != null) amountController.text = (v.remainingAmount < restant ? v.remainingAmount : restant).toInt().toString(); }),
                    decoration: InputDecoration(labelText: "Sélectionner l'acompte", border: OutlineInputBorder(borderRadius: BorderRadius.circular(15))),
                  ),
                ],
                const SizedBox(height: 30),
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: ElevatedButton(
                    onPressed: () {
                      if (method == "Acompte" && selectedAcompte == null) return;
                      double? val = double.tryParse(amountController.text.trim());
                      if (val != null && val > 0) {
                        _processPayment(inv, val, method, advanceClientId: selectedAcompte?.id);
                      }
                    },
                    child: const Text("VALIDER LE PAIEMENT"),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _confirmCancellation(Invoice inv) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Confirmer"),
        content: const Text("Voulez-vous vraiment annuler cette facture ?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Non")),
          ElevatedButton(onPressed: () { Navigator.pop(ctx); _cancelInvoice(inv); }, child: const Text("Oui, Annuler")),
        ],
      ),
    );
  }
}
