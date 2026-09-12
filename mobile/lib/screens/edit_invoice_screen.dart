import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:uuid/uuid.dart';

import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../models/invoice_model.dart';
import '../models/article_model.dart';

class EditItem {
  final Article article;
  int quantity;
  double price; // Prix effectif sur la facture
  double tauxTva; // taux utilisé on invoice (percentage)
  
  EditItem({required this.article, this.quantity = 1, required this.price, this.tauxTva = 0.0});
  
  double get total => price * quantity;
}

class EditInvoiceScreen extends StatefulWidget {
  final Invoice invoice;

  const EditInvoiceScreen({super.key, required this.invoice});

  @override
  State<EditInvoiceScreen> createState() => _EditInvoiceScreenState();
}

class _EditInvoiceScreenState extends State<EditInvoiceScreen> {
  bool _isLoading = true;
  List<Article> _allArticles = [];
  List<EditItem> _items = [];
  
  final _numberFormat = NumberFormat("#,##0", "fr_FR");
  final Color _primaryColor = const Color(0xFF4A00E0);

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final articlesData = await ApiService().getArticles(auth.token!);
      List<Article> allArticles = articlesData.map((item) => Article.fromJson(item)).toList();
      
      final invoiceItems = await ApiService().getInvoiceItems(widget.invoice.id.toString(), auth.token!);
      debugPrint('Loaded ${invoiceItems.length} items for invoice ${widget.invoice.id}');

      List<EditItem> loadedItems = [];
      for (var item in invoiceItems) {
        String artId = item['article_id']?.toString() ?? "";
        try {
          Article article;
          try {
            article = allArticles.firstWhere((a) => a.id == artId);
          } catch (_) {
            // Fallback for missing article metadata (e.g. deleted articles)
            article = Article(
              id: artId,
              reference: item['reference'] ?? '?',
              designation: item['designation'] ?? 'Article inconnu',
              prixVenteHT: (item['pu_ttc'] ?? item['price'] ?? 0.0).toDouble(),
              taxe: 0.0,
              quantite: 0.0,
            );
          }
          
          double itemPrice = (item['pu_ttc'] ?? item['price'] ?? article.prixVente).toDouble();
          double taxFromDb = (item['taux_tva_item'] as num?)?.toDouble() ?? article.taxe;
          
          loadedItems.add(EditItem(
            article: article,
            quantity: (item['qte'] ?? item['quantity'] ?? 1).toInt(),
            price: itemPrice,
            tauxTva: taxFromDb,
          ));
        } catch (e) {
          debugPrint('Error processing invoice item: $e');
        }
      }

      if (mounted) {
        setState(() {
          _allArticles = allArticles;
          _items = loadedItems;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur chargement: $e")));
      }
    }
  }

  double get totalAmount {
    var total = 0.0;
    for (var item in _items) {
      total += item.total;
    }
    return total;
  }

  Future<void> _addToCart(Article article) async {
    int index = _items.indexWhere((item) => item.article.id == article.id);
    if (index >= 0) {
      setState(() {
        _items[index].quantity++;
      });
    } else {
      // Pour les nouveaux items, on cherche le prix historique si la facture est ancienne
      double priceToUse = article.prixVente;
      
      try {
        final histPrice = await ApiService().getHistoricalPrice(article.id, widget.invoice.date);
        if (histPrice != null) {
          priceToUse = histPrice;
        }
      } catch (e) {
        debugPrint("Erreur prix historique: $e");
      }

      setState(() {
        _items.add(EditItem(article: article, price: priceToUse));
      });
    }
  }

  void _removeSingleItem(String articleId) {
    int index = _items.indexWhere((item) => item.article.id == articleId);
    if (index >= 0) {
      setState(() {
        if (_items[index].quantity > 1) {
          _items[index].quantity--;
        } else {
          _items.removeAt(index);
        }
      });
    }
  }

  Future<void> _scanBarcode() async {
    final String? code = await Navigator.push(context, MaterialPageRoute(builder: (context) => const SimpleScannerPage()));
    if (code != null) {
      try {
        final article = _allArticles.firstWhere((a) => a.reference.toLowerCase() == code.toLowerCase());
        _addToCart(article);
      } catch (_) {}
    }
  }

  void _showAddProductDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.7,
        padding: const EdgeInsets.all(10),
        child: Column(
          children: [
            const Text("Ajouter un produit", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            Expanded(
              child: ListView.builder(
                itemCount: _allArticles.length,
                itemBuilder: (ctx, i) {
                  final art = _allArticles[i];
                  return ListTile(
                    title: Text(art.designation),
                    subtitle: Text("${_numberFormat.format(art.prixVente)} FCFA"),
                    trailing: const Icon(Icons.add_circle, color: Colors.blue),
                    onTap: () async {
                      Navigator.pop(ctx);
                      await _addToCart(art);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _saveChanges() async {
    if (_items.isEmpty) return;
    setState(() => _isLoading = true);
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final uuid = const Uuid();
      // rebuild invoice payload with tax details
      double totalHtCalc = 0.0;
      double totalTvaCalc = 0.0;
      double tauxFacture = 0.0;
      List<Map<String, dynamic>> itemsPayload = [];

      for (var item in _items) {
        final double puTtc = item.price;
        final double taxe = item.tauxTva;
        final double puHt = (taxe > 0) ? puTtc / (1 + taxe / 100) : puTtc;
        final double montantTvaItem = ((puTtc - puHt) * item.quantity);

        totalHtCalc += puHt * item.quantity;
        totalTvaCalc += montantTvaItem;
        if (tauxFacture == 0 && taxe > 0) tauxFacture = taxe;

        itemsPayload.add({
          "id": uuid.v4(),
          "article_id": item.article.id,
          "code_art": item.article.reference,
          "description": item.article.designation,
          "qte": item.quantity,
          "pu_ttc": puTtc,
          "pu_ht": puHt,
          "taux_tva_item": taxe,
          "montant_tva_item": montantTvaItem,
          "total_item_ttc": item.total,
          "total_item_ht": puHt * item.quantity,
        });
      }

      if (totalTvaCalc == 0 && _items.any((it) => it.article.taxe > 0)) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content: Text("Attention: TVA calculée est nulle malgré des articles taxables.")));
          setState(() => _isLoading = false);
        }
        return;
      }

      final invoiceData = {
        "total_ttc": totalAmount,
        "total_ht": totalHtCalc,
        "total_tva": totalTvaCalc,
        "taux_tva_facture": tauxFacture,
        "items": itemsPayload,
      };
      // Note: UpdateInvoice method would need to be updated in api_service if it was removed
      // But I kept it in the refactored ApiService.
      await ApiService().updateInvoice(widget.invoice.id, invoiceData, auth.token!);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur: $e")));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Modifier Facture ${widget.invoice.blNumber}"),
        backgroundColor: _primaryColor,
        actions: [
          IconButton(icon: const Icon(Icons.qr_code_scanner), onPressed: _scanBarcode),
          IconButton(icon: const Icon(Icons.add), onPressed: _showAddProductDialog),
        ],
      ),
      body: _isLoading 
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(10),
                    itemCount: _items.length,
                    itemBuilder: (ctx, i) => _buildItemCard(_items[i]),
                  ),
                ),
                _buildBottomBar(),
              ],
            ),
    );
  }

  Widget _buildItemCard(EditItem item) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
             Expanded(
               child: Column(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 children: [
                   Text(item.article.designation, style: const TextStyle(fontWeight: FontWeight.bold)),
                   Text("${_numberFormat.format(item.price)} FCFA"),
                 ],
               ),
             ),
             Row(
               children: [
                 IconButton(icon: const Icon(Icons.remove_circle_outline), onPressed: () => _removeSingleItem(item.article.id)),
                 Text("${item.quantity}"),
                 IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: () => _addToCart(item.article)),
               ],
             ),
             Text("${_numberFormat.format(item.total)}", style: TextStyle(fontWeight: FontWeight.bold, color: _primaryColor)),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar() {
    // calculate HT, TVA totals for display
    double htCalc = 0.0;
    double tvaCalc = 0.0;
    double tauxFact = 0.0;
    for (var item in _items) {
      final double qt = item.quantity.toDouble();
      final double puTtc = item.price;
      final double taxe = item.tauxTva;
      final double puHt = (taxe > 0) ? puTtc / (1 + taxe / 100) : puTtc;
      htCalc += puHt * qt;
      tvaCalc += (puTtc - puHt) * qt;
      if (tauxFact == 0 && taxe > 0) tauxFact = taxe;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("Nouveau Total:"),
              Text("${_numberFormat.format(totalAmount)} FCFA", style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _primaryColor)),
            ],
          ),
          const SizedBox(height: 4),
          Text("HT: ${_numberFormat.format(htCalc)} FCFA"),
          Text("TVA (${tauxFact.toStringAsFixed(2)}%): ${_numberFormat.format(tvaCalc)} FCFA"),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: _primaryColor),
              onPressed: _saveChanges,
              child: const Text("ENREGISTRER", style: TextStyle(color: Colors.white)),
            ),
          )
        ],
      ),
    );
  }
}

class SimpleScannerPage extends StatelessWidget {
  const SimpleScannerPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Scanner")),
      body: MobileScanner(
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
