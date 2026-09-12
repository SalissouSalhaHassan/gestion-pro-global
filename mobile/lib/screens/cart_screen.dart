import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../models/company_model.dart';
import '../models/client_model.dart';
import '../models/article_model.dart';
import '../models/deposit_model.dart';

import '../utils/pdf_generator.dart';
import 'pdf_preview_screen.dart';
import 'printer_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  bool _isLoading = false;
  List<Client> _clients = [];
  List<Article> _allArticles = [];
  Client? _selectedClient;
  bool _clientPickerLoading = false;
  
  String _paymentMethod = 'Espèce';
  List<Deposit> _availableAcomptes = [];
  Deposit? _selectedAcompte;
  bool _loadingAcomptes = false;

  final _numberFormat = NumberFormat("#,##0", "fr_FR");

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final clientsData = await ApiService().getClients(auth.token!);
      if (mounted) {
        setState(() {
          _clients = clientsData.map((item) => Client.fromJson(item)).toList();
          if (_clients.isNotEmpty && _selectedClient == null) {
            final def = _clients.firstWhere(
              (c) => c.nom.toLowerCase().contains('divers'),
              orElse: () => _clients.first,
            );
            _selectedClient = def;
          }
        });
      }
    } catch (e) {
      debugPrint("Clients load error: $e");
    }
    try {
      final articlesData = await ApiService().getArticles(auth.token!);
      if (mounted) {
        setState(() {
          _allArticles = articlesData
              .map((item) => Article.fromJson(item))
              .toList();
        });
      }
    } catch (e) {
      debugPrint("Articles load error: $e");
    }
  }

  Future<void> _loadAcomptes() async {
    if (_selectedClient == null) {
      if (mounted) {
        setState(() {
          _availableAcomptes = [];
          _selectedAcompte = null;
          _loadingAcomptes = false;
        });
      }
      return;
    }

    if (mounted) setState(() => _loadingAcomptes = true);
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final data = await ApiService().getDeposits(auth.token!);
      final List<Deposit> filtered = data
          .map((j) => Deposit.fromJson(Map<String, dynamic>.from(j)))
          .where((d) => d.clientId == _selectedClient!.id && d.remainingAmount > 0)
          .toList();

      Deposit? nextSelected;
      if (_selectedAcompte != null) {
        for (final d in filtered) {
          if (d.id == _selectedAcompte!.id) {
            nextSelected = d;
            break;
          }
        }
      }

      if (mounted) {
        setState(() {
          _availableAcomptes = filtered;
          _selectedAcompte = nextSelected;
          _loadingAcomptes = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loadingAcomptes = false;
          _availableAcomptes = [];
          _selectedAcompte = null;
        });
      }
    }
  }

  Future<void> _scanBarcode() async {
    final String? code = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const SimpleScannerPage()),
    );

    if (code != null) {
      try {
        final article = _allArticles.firstWhere(
          (a) =>
              (a.codeBarre != null &&
                  a.codeBarre!.toLowerCase() == code.toLowerCase()) ||
              a.reference.toLowerCase() == code.toLowerCase(),
        );

        if (mounted) {
          final auth = Provider.of<AuthProvider>(context, listen: false);
          final prefs = await SharedPreferences.getInstance();
          String lastDepot = prefs.getString('last_depot') ?? 'Boutique';
          
          if (!auth.isAdmin && auth.depots.isNotEmpty) {
            if (!auth.depots.contains(lastDepot)) {
              lastDepot = auth.depots.first;
            }
          }

          Provider.of<CartProvider>(
            context,
            listen: false,
          ).addToCart(article, qty: 1, depot: lastDepot);

          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Ajouté: ${article.designation}"),
              backgroundColor: Colors.green,
              duration: const Duration(seconds: 1),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text("Produit introuvable: $code"),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    }
  }

  Future<void> _submitOrder() async {
    final cart = Provider.of<CartProvider>(context, listen: false);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final api = ApiService();

    if (cart.items.isEmpty) {
      _showSnackBar("Le panier est vide!", Colors.orange);
      return;
    }
    if (_selectedClient == null) {
      _showSnackBar("Veuillez sélectionner un client", Colors.orange);
      return;
    }
    if (_paymentMethod == 'Acompte' && _selectedAcompte == null) {
      _showSnackBar("Veuillez sélectionner un acompte", Colors.orange);
      return;
    }

    setState(() => _isLoading = true);

    try {
      final blLocal = "MOB-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}";
      // compute detailed financials including TVA
      double totalHtCalc = 0.0;
      double totalTvaCalc = 0.0;
      double tauxFacture = 0.0;
      List<Map<String, dynamic>> itemsPayload = [];

      for (var item in cart.items) {
        final double puTtc = item.unitPrice;
        final double taxe = item.article.taxe;
        final double puHt = (taxe > 0) ? puTtc / (1 + (taxe / 100)) : puTtc;
        final double montantTvaItem = ((puTtc - puHt) * item.quantity);

        totalHtCalc += puHt * item.quantity;
        totalTvaCalc += montantTvaItem;
        if (tauxFacture == 0 && taxe > 0) tauxFacture = taxe;

        itemsPayload.add({
          "article_id": item.article.id,
          "code_art": item.article.reference,
          "description": item.article.designation,
          "qte": item.quantity,
          "pu_ttc": puTtc,
          "pu_ht": puHt,
          "taux_tva_item": taxe,
          "montant_tva_item": montantTvaItem,
          "depot_origine": item.selectedDepot,
        });
      }

      // Validation: if there are taxable items but computed TVA is zero, warn the user
      if (totalTvaCalc == 0 && cart.items.any((it) => it.article.taxe > 0)) {
        if (mounted) {
          _showSnackBar("Attention: certains articles sont soumis à la TVA mais le montant de TVA calculé est nul. Vérifiez les paramètres.", Colors.orange);
          setState(() => _isLoading = false);
        }
        return;
      }

      final invoiceData = {
        "client_id": _selectedClient!.id,
        "client_nom": _selectedClient!.nom,
        "user_id": auth.userId,
        "bl_number": blLocal,
        "date_facture": DateFormat('yyyy-MM-dd').format(DateTime.now()),
        "total_ttc": cart.totalAmount,
        "total_ht": totalHtCalc,
        "total_tva": totalTvaCalc,
        "taux_tva_facture": tauxFacture,
        "vendeur": auth.username ?? "MobileApp",
        "emplacement": auth.emplacement ?? (auth.allowedDepots.isNotEmpty ? auth.allowedDepots.first : ""),
        "items": itemsPayload,
      };

      final double paymentAmount;
      if (_paymentMethod == 'Crédit') {
        paymentAmount = 0.0;
      } else if (_paymentMethod == 'Acompte') {
        final remaining = _selectedAcompte?.remainingAmount ?? 0.0;
        paymentAmount = remaining < cart.totalAmount ? remaining : cart.totalAmount;
      } else {
        paymentAmount = cart.totalAmount;
      }

      final resultId = await api.createInvoice(
        invoiceData,
        auth.token!,
        paymentAmount: paymentAmount,
        paymentMethod: _paymentMethod,
        advanceClientId: _paymentMethod == 'Acompte' ? _selectedAcompte?.id : null,
      );

      if (mounted && resultId != null) {
        _showSnackBar("Facture créée avec succès !", Colors.green);
      }

      final invoiceForPrint = {
        'date': DateFormat('yyyy-MM-dd HH:mm').format(DateTime.now()),
        'client': _selectedClient!.nom,
        'total_amount': cart.totalAmount,
        'bl_number': blLocal,
        'items': cart.items
            .map(
              (item) => {
                'name': item.article.designation,
                'quantity': item.quantity,
                'price': item.unitPrice,
              },
            )
            .toList(),
      };

      cart.clearCart();

      if (mounted) {
        setState(() {
          _isLoading = false;
          _paymentMethod = 'Espèce';
          _selectedAcompte = null;
          _availableAcomptes = [];
        });
        _showPrintOptionsDialog(invoiceForPrint, auth);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackBar("Erreur: ${e.toString()}", Colors.red);
      }
    }
  }

  void _showPrintOptionsDialog(
    Map<String, dynamic> invoiceData,
    AuthProvider auth,
  ) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text("Succès"),
        content: const Text(
          "Facture enregistrée ! Comment voulez-vous imprimer ?",
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pop(ctx);
            },
            child: const Text("Ignorer", style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton.icon(
            icon: const Icon(Icons.picture_as_pdf),
            label: const Text("PDF A4"),
            onPressed: () async {
              Navigator.pop(ctx);
              final companyInfo = await ApiService().getCompanyInfo(
                auth.token!,
              );
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => PdfPreviewScreen(
                    invoiceRef: invoiceData['bl_number'],
                    buildPdf: (format) async {
                      return PdfInvoiceGenerator.generateInvoice(
                        company: CompanyInfo.fromJson(companyInfo),
                        clientName: invoiceData['client'],
                        items: invoiceData['items'],
                        totalAmount: invoiceData['total_amount'],
                        invoiceRef: invoiceData['bl_number'],
                        sellerName: auth.username ?? "Admin",
                        location: auth.emplacement ?? (auth.allowedDepots.isNotEmpty ? auth.allowedDepots.first : ""),
                        pageFormat: format,
                      );
                    },
                  ),
                ),
              );
            },
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: _primaryColor,
              foregroundColor: Colors.white,
            ),
            icon: const Icon(Icons.print),
            label: const Text("Thermique"),
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => PrinterScreen(invoiceData: invoiceData),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  @override
  Widget build(BuildContext context) {
    final cart = Provider.of<CartProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F9),
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
          "Mon Panier",
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        centerTitle: true,
        elevation: 0,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
            tooltip: "Scanner",
            onPressed: _scanBarcode,
          ),
          if (cart.items.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep, color: Colors.white),
              tooltip: "Vider le panier",
              onPressed: () {
                cart.clearCart();
              },
            ),
        ],
      ),
      body: Column(
        children: [
          _buildClientSelector(),
          Expanded(
            child: cart.items.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    padding: const EdgeInsets.fromLTRB(15, 0, 15, 15),
                    itemCount: cart.items.length,
                    itemBuilder: (ctx, i) {
                      return _buildCartItem(cart.items[i], cart);
                    },
                  ),
          ),
          _buildBottomSection(cart),
        ],
      ),
    );
  }

  Widget _buildClientSelector() {
    return InkWell(
      onTap: _openClientPicker,
      child: Container(
        margin: const EdgeInsets.all(15),
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(15),
          boxShadow: [
            BoxShadow(
              color: Colors.grey.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 12,
              backgroundColor: _primaryColor.withOpacity(0.1),
              child: Icon(Icons.person, size: 14, color: _primaryColor),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                _selectedClient?.nom ?? "Sélectionner un client",
                style: const TextStyle(fontWeight: FontWeight.w600),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (_clientPickerLoading)
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Icon(Icons.arrow_drop_down_circle, color: _primaryColor),
          ],
        ),
      ),
    );
  }

  Future<void> _openClientPicker() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _clientPickerLoading = true);
    
    try {
      final data = await ApiService().getClients(auth.token!);
      if (mounted) {
        _clients = data.map((item) => Client.fromJson(item)).toList();
      }
    } catch (e) {
      debugPrint("Error loading clients: $e");
    } finally {
      if (mounted) setState(() => _clientPickerLoading = false);
    }

    if (!mounted || _clients.isEmpty) return;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        List<Client> filtered = List<Client>.from(_clients);
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom,
                left: 15,
                right: 15,
                top: 15,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text("Sélectionner un client", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                  const SizedBox(height: 10),
                  TextField(
                    decoration: const InputDecoration(
                      hintText: "Recherche...",
                      prefixIcon: Icon(Icons.search),
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    onChanged: (q) {
                      final qq = q.toLowerCase();
                      setModalState(() {
                        filtered = _clients.where((c) {
                          return c.nom.toLowerCase().contains(qq) ||
                              c.telephone.toLowerCase().contains(qq);
                        }).toList();
                      });
                    },
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 350,
                    child: ListView.builder(
                      itemCount: filtered.length,
                      itemBuilder: (c, i) {
                        final client = filtered[i];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: _primaryColor.withOpacity(0.1),
                            child: Icon(Icons.person, color: _primaryColor),
                          ),
                          title: Text(client.nom),
                          subtitle: Text(client.telephone),
                          onTap: () {
                            setState(() {
                              _selectedClient = client;
                              _selectedAcompte = null;
                              _availableAcomptes = [];
                            });
                            Navigator.pop(ctx);
                            if (_paymentMethod == 'Acompte') {
                              _loadAcomptes();
                            }
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          }
        );
      },
    );
  }

  Widget _buildCartItem(dynamic item, CartProvider cart) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.08),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: const Color(0xFFF3F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.shopping_bag_outlined, color: _primaryColor),
            ),
            const SizedBox(width: 15),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.article.designation,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        "${_numberFormat.format(item.unitPrice)} FCFA",
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                      const SizedBox(width: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.orange.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: Colors.orange.withOpacity(0.3)),
                        ),
                        child: Text(
                          item.selectedDepot,
                          style: TextStyle(color: Colors.orange[800], fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFF3F5F9),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    children: [
                      _buildQtyButton(Icons.remove, () => cart.removeSingleItem(item.article.id, item.selectedDepot)),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Text("${item.quantity}", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      ),
                      _buildQtyButton(Icons.add, () => cart.addToCart(item.article, qty: 1, depot: item.selectedDepot, price: item.price)),
                    ],
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  "${_numberFormat.format(item.total)} FCFA",
                  style: TextStyle(fontWeight: FontWeight.bold, color: _primaryColor, fontSize: 14),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQtyButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(padding: const EdgeInsets.all(5), child: Icon(icon, size: 16, color: Colors.black87)),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.remove_shopping_cart_outlined, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 20),
          Text("Votre panier est vide", style: TextStyle(fontSize: 18, color: Colors.grey.shade500, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildBottomSection(CartProvider cart) {
    return Container(
      padding: const EdgeInsets.all(25),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20, offset: const Offset(0, -5))],
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("Total à payer", style: TextStyle(fontSize: 16, color: Colors.grey)),
              Text("${_numberFormat.format(cart.totalAmount)} FCFA", style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 15),
          _buildPaymentMethodSelector(),
          const SizedBox(height: 15),
          InkWell(
            onTap: (cart.items.isEmpty || _isLoading) ? null : _submitOrder,
            borderRadius: BorderRadius.circular(15),
            child: Container(
              height: 55,
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: (cart.items.isEmpty || _isLoading)
                      ? [Colors.grey.shade300, Colors.grey.shade400]
                      : [_primaryColor, _secondaryColor],
                ),
                borderRadius: BorderRadius.circular(15),
              ),
              child: Center(
                child: _isLoading
                    ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, color: Colors.white),
                          SizedBox(width: 10),
                          Text("VALIDER LA COMMANDE", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                        ],
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("Mode de règlement", style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 8),
        Row(
          children: [
            _buildMethodChip("Espèce", Icons.money),
            const SizedBox(width: 8),
            _buildMethodChip("Autre", Icons.more_horiz, color: Colors.blue),
          ],
        ),
        if (_paymentMethod != 'Espèce') ...[
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            value: _paymentMethod == 'Espèce' ? 'Chèque' : _paymentMethod,
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            ),
            items: ['Chèque', 'Virement', 'Mobile Money', 'Crédit', 'Acompte']
                .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                .toList(),
            onChanged: (val) async {
              if (val == null) return;
              setState(() {
                _paymentMethod = val;
                if (val != 'Acompte') {
                  _selectedAcompte = null;
                }
              });
              if (val == 'Acompte') {
                await _loadAcomptes();
              }
            },
          ),
        ],
        if (_paymentMethod == 'Acompte') ...[
          const SizedBox(height: 10),
          if (_selectedClient == null)
            const Text("Sélectionnez un client pour voir les acomptes.", style: TextStyle(color: Colors.red))
          else if (_loadingAcomptes)
            const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(strokeWidth: 2))
          else if (_availableAcomptes.isEmpty)
            const Text("Aucun acompte disponible pour ce client.", style: TextStyle(color: Colors.red))
          else
            DropdownButtonFormField<Deposit>(
              value: _selectedAcompte,
              items: _availableAcomptes
                  .map((a) => DropdownMenuItem(
                        value: a,
                        child: Text("${a.reference} (${a.remainingAmount.toInt()} F)"),
                      ))
                  .toList(),
              onChanged: (v) => setState(() => _selectedAcompte = v),
              decoration: InputDecoration(
                labelText: "Sélectionner l'acompte",
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
        ],
      ],
    );
  }

  Widget _buildMethodChip(String label, IconData icon, {Color color = Colors.green}) {
    bool isSelected = (_paymentMethod == label) || (label == 'Autre' && _paymentMethod != 'Espèce');
    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() {
            _paymentMethod = label == 'Autre' ? 'Chèque' : label;
            if (_paymentMethod != 'Acompte') {
              _selectedAcompte = null;
            }
          });
          if (_paymentMethod == 'Acompte') {
            _loadAcomptes();
          }
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.12) : Colors.white,
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: isSelected ? color : Colors.grey.shade300, width: isSelected ? 2 : 1),
          ),
          child: Column(
            children: [
              Icon(icon, size: 20, color: isSelected ? color : Colors.grey),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal, color: isSelected ? color : Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }
}

class SimpleScannerPage extends StatelessWidget {
  const SimpleScannerPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Scanner Code-Barre")),
      body: MobileScanner(
        controller: MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates),
        onDetect: (capture) {
          final List<Barcode> barcodes = capture.barcodes;
          for (final barcode in barcodes) {
            if (barcode.rawValue != null) {
              Navigator.pop(context, barcode.rawValue);
              break;
            }
          }
        },
      ),
    );
  }
}
