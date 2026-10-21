import 'package:flutter/material.dart';
import 'dart:async';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_service.dart';
import '../models/article_model.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import 'cart_screen.dart';
import '../services/excel_export_service.dart';
import '../services/notification_service.dart';
import 'add_product_screen.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});

  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  List<Article> _rawArticles = [];
  List<Article> _filteredArticles = [];
  bool _isLoading = false;
  bool _isFetchingMore = false;
  bool _hasMore = true;
  int _currentPage = 0;
  final int _pageSize = 100; // Increased page size for rich search experience

  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final _numberFormat = NumberFormat("#,##0", "fr_FR");
  Timer? _debounce;
  final MobileScannerController _scannerController = MobileScannerController();

  // Smart filter tags
  String _selectedFilterTag = 'Tous'; // 'Tous', 'En Stock', 'Rupture', 'Prix Gros'

  // Colors
  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);

  @override
  void initState() {
    super.initState();
    _fetchArticles();
    _searchController.addListener(_onSearchChanged);
    _scrollController.addListener(_scrollListener);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _debounce?.cancel();
    _scannerController.dispose();
    super.dispose();
  }

  void _scrollListener() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      if (!_isFetchingMore && _hasMore && !_isLoading && _searchController.text.trim().isEmpty) {
        _fetchArticles(loadMore: true);
      }
    }
  }

  /// Normalize string for intelligent multi-dialect & French accents matching
  String _normalizeString(String text) {
    var s = text.toLowerCase().trim();
    // French accents normalization
    s = s.replaceAll(RegExp(r'[éèêë]'), 'e');
    s = s.replaceAll(RegExp(r'[àâä]'), 'a');
    s = s.replaceAll(RegExp(r'[îï]'), 'i');
    s = s.replaceAll(RegExp(r'[ôö]'), 'o');
    s = s.replaceAll(RegExp(r'[ùûü]'), 'u');
    s = s.replaceAll(RegExp(r'[ç]'), 'c');
    // Arabic normalization
    s = s.replaceAll(RegExp(r'[أإآ]'), 'ا');
    s = s.replaceAll('ة', 'ه');
    s = s.replaceAll('ى', 'ي');
    // Remove unnecessary punctuation
    s = s.replaceAll(RegExp(r'[-_/,\.]'), ' ');
    return s;
  }

  /// Instant local smart multi-keyword search
  void _applyLocalSmartSearch() {
    final query = _normalizeString(_searchController.text);
    final keywords = query.split(RegExp(r'\s+')).where((k) => k.isNotEmpty).toList();

    final auth = Provider.of<AuthProvider>(context, listen: false);

    setState(() {
      _filteredArticles = _rawArticles.where((article) {
        // Tag-based filtering
        if (_selectedFilterTag == 'En Stock') {
          final stock = auth.isAdmin ? article.totalAllDepotsStock : article.getStockForDepots(auth.allowedDepots);
          if (stock <= 0) return false;
        } else if (_selectedFilterTag == 'Rupture') {
          final stock = auth.isAdmin ? article.totalAllDepotsStock : article.getStockForDepots(auth.allowedDepots);
          if (stock > 0) return false;
        } else if (_selectedFilterTag == 'Prix Gros') {
          if (article.prixGros == null || article.prixGros! <= 0) return false;
        }

        if (keywords.isEmpty) return true;

        final target = _normalizeString("${article.designation} ${article.reference} ${article.codeBarre ?? ''} ${article.famille ?? ''}");

        // Smart AND match: every keyword must exist in the target
        return keywords.every((kw) => target.contains(kw));
      }).toList();
    });
  }

  void _onSearchChanged() {
    // 1. Instant instant feedback locally (0 delay!)
    _applyLocalSmartSearch();

    // 2. Debounced server fetch if query has 2+ characters to find items not in first page
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 600), () {
      final q = _searchController.text.trim();
      if (q.isNotEmpty) {
        _fetchArticles(forceRefresh: true);
      }
    });
  }

  // --- Show Add Dialog with Dynamic Depot Selection ---
  Future<void> showAddToCartDialog(Article article) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final allowedDepots = auth.allowedDepots;
    
    final Map<String, double> depots = {};
    
    if (auth.isAdmin) {
       depots.addAll(article.depotStocks);
       if (depots.isEmpty && article.quantite > 0) {
         depots['Boutique'] = article.quantite;
       }
       if (depots.isEmpty) depots['Boutique'] = 0.0;
    } else {
       for (var depotName in allowedDepots) {
         depots[depotName] = article.depotStocks[depotName] ?? 0.0;
       }
    }

    if (depots.isEmpty && article.getStockForDepots(allowedDepots) > 0) {
      depots['Boutique'] = article.getStockForDepots(allowedDepots);
    }

    String selectedDepot = depots.isNotEmpty ? depots.keys.first : (allowedDepots.isNotEmpty ? allowedDepots.first : 'Boutique');
    
    final prefs = await SharedPreferences.getInstance();
    final last = prefs.getString('last_depot');
    if (last != null && depots.containsKey(last)) {
      selectedDepot = last;
    }
    double maxQty = depots.isNotEmpty ? (depots[selectedDepot] ?? 0) : 0;

    final qtyController = TextEditingController(text: "1");
    final priceController = TextEditingController(text: article.prixVente.toStringAsFixed(0));

    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              title: Text(
                article.designation,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: _primaryColor.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        const Text("Prix de vente (FCFA)", style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.bold)),
                        TextField(
                          controller: priceController,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: _primaryColor,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  if (depots.isEmpty)
                    const Text(
                      "Stock épuisé !",
                      style: TextStyle(
                        color: Colors.red,
                        fontWeight: FontWeight.bold,
                      ),
                    )
                  else
                    DropdownButtonFormField<String>(
                      initialValue: selectedDepot,
                      decoration: InputDecoration(
                        labelText: "Choisir le dépôt",
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        filled: true,
                        fillColor: Colors.grey[100],
                      ),
                      items: depots.entries.map((entry) {
                        return DropdownMenuItem(
                          value: entry.key,
                          child: Text("${entry.key} (${entry.value.toInt()})"),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            selectedDepot = val;
                            maxQty = depots[val]!;
                            qtyController.text = "1";
                          });
                        }
                      },
                    ),

                  const SizedBox(height: 20),

                  if (depots.isNotEmpty)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildQtyBtn(Icons.remove, () {
                          int current = int.tryParse(qtyController.text) ?? 1;
                          if (current > 1) {
                            setDialogState(
                              () =>
                                  qtyController.text = (current - 1).toString(),
                            );
                          }
                        }),
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 10),
                          width: 80,
                          child: TextField(
                            controller: qtyController,
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            decoration: InputDecoration(
                              contentPadding: const EdgeInsets.symmetric(
                                vertical: 10,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                          ),
                        ),
                        _buildQtyBtn(Icons.add, () {
                          int current = int.tryParse(qtyController.text) ?? 0;
                          if (current < maxQty) {
                            setDialogState(
                              () =>
                                  qtyController.text = (current + 1).toString(),
                            );
                          }
                        }),
                      ],
                    ),

                  if (depots.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 5),
                      child: Text(
                        "Max: ${maxQty.toInt()}",
                        style: TextStyle(color: Colors.grey[600], fontSize: 12),
                      ),
                    ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text(
                    "Annuler",
                    style: TextStyle(color: Colors.grey),
                  ),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primaryColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: depots.isEmpty
                      ? null
                      : () async {
                          int finalQty = int.tryParse(qtyController.text) ?? 1;
                          if (finalQty > maxQty) finalQty = maxQty.toInt();
                          if (finalQty < 1) finalQty = 1;

                          double? finalPrice = double.tryParse(priceController.text);

                          Provider.of<CartProvider>(
                            context,
                            listen: false,
                          ).addToCart(
                            article,
                            qty: finalQty,
                            depot: selectedDepot,
                            price: finalPrice,
                          );
                          final prefs = await SharedPreferences.getInstance();
                          await prefs.setString('last_depot', selectedDepot);
                          if (!ctx.mounted) return;
                          if (!context.mounted) return;
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text("${article.designation} ajouté au panier"),
                              backgroundColor: Colors.green,
                              duration: const Duration(seconds: 1),
                            ),
                          );
                        },
                  child: const Text(
                    "Ajouter",
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildQtyBtn(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: _primaryColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: _primaryColor),
      ),
    );
  }

  void _openBarcodeScanner() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        height: MediaQuery.of(context).size.height * 0.6,
        decoration: const BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: const Text(
                "Scanner un code-barres",
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            Expanded(
              child: MobileScanner(
                controller: _scannerController,
                onDetect: (capture) {
                  final List<Barcode> barcodes = capture.barcodes;
                  for (final barcode in barcodes) {
                    final code = barcode.rawValue;
                    if (code != null) {
                      _scannerController.stop();
                      Navigator.pop(context);
                      _handleScannedCode(code);
                      break;
                    }
                  }
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                IconButton(
                  icon: const Icon(Icons.flash_on, color: Colors.white),
                  onPressed: () => _scannerController.toggleTorch(),
                ),
                IconButton(
                  icon: const Icon(Icons.cameraswitch, color: Colors.white),
                  onPressed: () => _scannerController.switchCamera(),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    "Annuler",
                    style: TextStyle(color: Colors.white),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  void _handleScannedCode(String code) {
    _searchController.text = code;
    _fetchArticles(forceRefresh: true);
  }

  Future<void> _fetchArticles({bool forceRefresh = false, bool loadMore = false}) async {
    if (loadMore) {
      if (_isFetchingMore || !_hasMore) return;
      setState(() => _isFetchingMore = true);
    } else {
      if (_isLoading) return;
      setState(() {
        _isLoading = true;
        _currentPage = 0;
        _hasMore = true;
      });
    }

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (!loadMore) await auth.refreshDepots(); 
      
      final String searchQuery = _searchController.text.trim();
      
      final data = await ApiService().getArticles(
        auth.token!,
        forceRefresh: forceRefresh,
        page: _currentPage,
        pageSize: _pageSize,
        search: searchQuery.isNotEmpty ? searchQuery : null,
        userId: auth.userId,
        allowedDepots: auth.allowedDepots,
        isAdmin: auth.isAdmin,
      );

      final loadedArticles = data
          .map((item) => Article.fromJson(item))
          .toList();

      if (mounted) {
        setState(() {
          if (loadMore) {
            _rawArticles.addAll(loadedArticles);
          } else {
            _rawArticles = loadedArticles;
          }
          
          if (loadedArticles.length < _pageSize) {
            _hasMore = false;
          } else {
            _currentPage++;
          }
          
          _isLoading = false;
          _isFetchingMore = false;
        });

        _applyLocalSmartSearch();

        if (!loadMore && loadedArticles.isNotEmpty && searchQuery.isEmpty) {
          await NotificationService().checkLowStock(loadedArticles, threshold: 5);
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Erreur: ${e.toString()}")));
        setState(() {
          _isLoading = false;
          _isFetchingMore = false;
        });
      }
    }
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
          "Liste des Produits",
          style: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 22,
            color: Colors.white,
          ),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            tooltip: 'Recharger les produits',
            onPressed: () => _fetchArticles(forceRefresh: true),
          ),
          IconButton(
            icon: const Icon(Icons.file_download, color: Colors.white),
            tooltip: 'Exporter Excel',
            onPressed: () {
              if (_filteredArticles.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Aucune donnée à exporter")),
                );
                return;
              }
              final data = _filteredArticles
                  .map(
                    (a) => {
                      'reference': a.reference,
                      'designation': a.designation,
                      'prix_vente': a.prixVente,
                      'quantite': a.quantite,
                    },
                  )
                  .toList();
              ExcelExportService.exportProducts(data, context);
            },
          ),
          Padding(
            padding: const EdgeInsets.only(right: 15, top: 5),
            child: Stack(
              alignment: Alignment.center,
              children: [
                IconButton(
                  icon: const Icon(
                    Icons.shopping_cart_outlined,
                    size: 28,
                    color: Colors.white,
                  ),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (context) => const CartScreen()),
                  ).then((_) {
                     _fetchArticles(forceRefresh: false);
                  }),
                ),
                if (cart.itemCount > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.redAccent,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(blurRadius: 2, color: Colors.black26),
                        ],
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 18,
                        minHeight: 18,
                      ),
                      child: Text(
                        '${cart.itemCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Smart Search Bar with Camera & Clear
          Container(
            padding: const EdgeInsets.fromLTRB(15, 14, 15, 6),
            color: const Color(0xFFF3F5F9),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: _primaryColor.withValues(alpha: 0.08),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        hintText: 'Recherche intelligente (Nom, Réf, Famille)...',
                        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                        prefixIcon: Icon(
                          Icons.search_rounded,
                          color: _primaryColor,
                          size: 24,
                        ),
                        filled: true,
                        fillColor: Colors.white,
                        contentPadding: const EdgeInsets.symmetric(vertical: 14),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide.none,
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(color: Colors.grey.shade200),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(16),
                          borderSide: BorderSide(
                            color: _primaryColor,
                            width: 2,
                          ),
                        ),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.cancel_rounded, color: Colors.grey, size: 20),
                                onPressed: () {
                                  _searchController.clear();
                                  _applyLocalSmartSearch();
                                  FocusScope.of(context).unfocus();
                                },
                              )
                            : null,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                GestureDetector(
                  onTap: _openBarcodeScanner,
                  child: Container(
                    height: 50,
                    width: 50,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [_primaryColor, _secondaryColor],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: _primaryColor.withValues(alpha: 0.3),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.qr_code_scanner_rounded,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Smart Filter Pills & Results Count
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 6),
            color: const Color(0xFFF3F5F9),
            child: Row(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('Tous', Icons.apps_rounded),
                        const SizedBox(width: 6),
                        _buildFilterChip('En Stock', Icons.check_circle_outline_rounded),
                        const SizedBox(width: 6),
                        _buildFilterChip('Rupture', Icons.remove_circle_outline_rounded),
                        const SizedBox(width: 6),
                        _buildFilterChip('Prix Gros', Icons.loyalty_rounded),
                      ],
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    "${_filteredArticles.length} art.",
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: _primaryColor,
                    ),
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: _isLoading && _rawArticles.isEmpty
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : _filteredArticles.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.search_off_rounded,
                          size: 70,
                          color: Colors.grey.shade300,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _searchController.text.isNotEmpty 
                              ? "Aucun résultat pour \"${_searchController.text}\""
                              : "Aucun article disponible",
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.grey.shade600,
                          ),
                        ),
                        if (_searchController.text.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          TextButton.icon(
                            onPressed: () {
                              _searchController.clear();
                              _applyLocalSmartSearch();
                            },
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text("Effacer la recherche"),
                          ),
                        ],
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 15,
                      vertical: 5,
                    ),
                    itemCount: _filteredArticles.length + (_hasMore && _searchController.text.isEmpty ? 1 : 0),
                    itemBuilder: (ctx, i) {
                      if (i == _filteredArticles.length) {
                        return Padding(
                          padding: const EdgeInsets.all(15),
                          child: Center(child: CircularProgressIndicator(color: _primaryColor)),
                        );
                      }
                      return _buildProductCard(_filteredArticles[i]);
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: Provider.of<AuthProvider>(context).isAdmin || Provider.of<AuthProvider>(context).canManageUsers 
        ? FloatingActionButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const AddProductScreen())).then((_) => _fetchArticles(forceRefresh: true)),
            backgroundColor: _primaryColor,
            child: const Icon(Icons.add, color: Colors.white),
          )
        : null,
    );
  }

  Widget _buildProductCard(Article article) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final double currentStock = auth.isAdmin 
        ? article.totalAllDepotsStock 
        : article.getStockForDepots(auth.allowedDepots);
        
    final bool isOutOfStock = currentStock <= 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.08),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () async => await showAddToCartDialog(article),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        _primaryColor.withValues(alpha: 0.1),
                        _secondaryColor.withValues(alpha: 0.1),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      article.designation.isNotEmpty
                          ? article.designation.substring(0, 1).toUpperCase()
                          : "?",
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: _primaryColor,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 15),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        article.designation,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: isOutOfStock
                              ? Colors.red.withValues(alpha: 0.1)
                              : const Color.fromARGB(
                                  255,
                                  4,
                                  122,
                                  8,
                                ).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          isOutOfStock
                              ? "Rupture de stock"
                              : "Stock: ${currentStock.toInt()}",
                          style: TextStyle(
                            color: isOutOfStock
                                ? Colors.red
                                : const Color.fromARGB(255, 6, 50, 8),
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      "${_numberFormat.format(article.prixVente)} F",
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: _primaryColor,
                      ),
                    ),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: () async => await showAddToCartDialog(article),
                      borderRadius: BorderRadius.circular(30),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: _primaryColor,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: _primaryColor.withValues(alpha: 0.3),
                              blurRadius: 6,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.add,
                          color: Colors.white,
                          size: 24,
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
    );
  }

  Widget _buildFilterChip(String label, IconData icon) {
    final isSelected = _selectedFilterTag == label;
    return GestureDetector(
      onTap: () {
        setState(() => _selectedFilterTag = label);
        _applyLocalSmartSearch();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? _primaryColor : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? _primaryColor : Colors.grey.shade300,
            width: 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: _primaryColor.withValues(alpha: 0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  )
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: isSelected ? Colors.white : Colors.grey.shade600,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                color: isSelected ? Colors.white : Colors.grey.shade800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
