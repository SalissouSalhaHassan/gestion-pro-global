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

class MarketplaceStoreScreen extends StatefulWidget {
  final VoidCallback? onBackToApp;

  const MarketplaceStoreScreen({super.key, this.onBackToApp});

  @override
  State<MarketplaceStoreScreen> createState() => _MarketplaceStoreScreenState();
}

class _MarketplaceStoreScreenState extends State<MarketplaceStoreScreen> with SingleTickerProviderStateMixin {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final NumberFormat _currencyFormat = NumberFormat("#,##0", "fr_FR");
  Timer? _debounce;
  final MobileScannerController _scannerController = MobileScannerController();

  List<Article> _articles = [];
  bool _isLoading = false;
  String _selectedCategory = "Explore";
  int _bottomNavIndex = 0; // 0: Home, 1: Shop, 2: Feed, 3: Cart, 4: Account

  final List<String> _categories = [
    "Explore",
    "SuperDeals",
    "Electronics",
    "Fashion",
    "Outillage",
    "Auto-Moto",
    "Maison & Bureau",
    "Accessoires",
  ];

  final List<Map<String, dynamic>> _quickPills = [
    {"label": "Coins", "icon": Icons.monetization_on_rounded, "color": Color(0xFFFFB300)},
    {"label": "Prize Land", "icon": Icons.videogame_asset_rounded, "color": Color(0xFF7C4DFF)},
    {"label": "Brand+", "icon": Icons.verified_rounded, "color": Color(0xFF00B0FF)},
    {"label": "Clearance", "icon": Icons.local_fire_department_rounded, "color": Color(0xFFFF1744)},
    {"label": "Play & Earn", "icon": Icons.card_giftcard_rounded, "color": Color(0xFF00E676)},
  ];

  @override
  void initState() {
    super.initState();
    _fetchProducts();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _debounce?.cancel();
    _scannerController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _fetchProducts();
    });
  }

  Future<void> _fetchProducts({bool forceRefresh = false}) async {
    if (_isLoading) return;
    setState(() => _isLoading = true);

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.token == null) {
        setState(() => _isLoading = false);
        return;
      }

      final query = _searchController.text.trim();
      final data = await ApiService().getArticles(
        auth.token!,
        forceRefresh: forceRefresh,
        page: 0,
        pageSize: 60,
        search: query.isNotEmpty ? query : null,
        userId: auth.userId,
        allowedDepots: auth.allowedDepots,
        isAdmin: auth.isAdmin,
      );

      final loaded = data.map((json) => Article.fromJson(json)).toList();

      if (mounted) {
        setState(() {
          _articles = loaded;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  // Scanner modal
  void _openScanner() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.black,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SizedBox(
        height: MediaQuery.of(ctx).size.height * 0.65,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: const Text(
                "Scanner un produit",
                style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            Expanded(
              child: MobileScanner(
                controller: _scannerController,
                onDetect: (capture) {
                  for (final barcode in capture.barcodes) {
                    final code = barcode.rawValue;
                    if (code != null) {
                      _scannerController.stop();
                      Navigator.pop(ctx);
                      _searchController.text = code;
                      _fetchProducts(forceRefresh: true);
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
                  icon: const Icon(Icons.flip_camera_ios, color: Colors.white),
                  onPressed: () => _scannerController.switchCamera(),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text("Annuler", style: TextStyle(color: Colors.white)),
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // Quick Add To Cart Dialog
  Future<void> _quickAddToCart(Article article) async {
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
      for (var d in allowedDepots) {
        depots[d] = article.depotStocks[d] ?? 0.0;
      }
    }

    if (depots.isEmpty && article.getStockForDepots(allowedDepots) > 0) {
      depots['Boutique'] = article.getStockForDepots(allowedDepots);
    }

    String selectedDepot = depots.isNotEmpty
        ? depots.keys.first
        : (allowedDepots.isNotEmpty ? allowedDepots.first : 'Boutique');

    final prefs = await SharedPreferences.getInstance();
    final last = prefs.getString('last_depot');
    if (last != null && depots.containsKey(last)) {
      selectedDepot = last;
    }

    double maxQty = depots[selectedDepot] ?? 0.0;
    final qtyController = TextEditingController(text: "1");

    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final discount = _calculateDiscount(article);
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF6F7F9),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: _buildProductThumbnail(article),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  "XOF ${_currencyFormat.format(article.prixVente.toInt())}",
                                  style: const TextStyle(
                                    fontSize: 19,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF111111),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                if (discount != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFF2442),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      "-$discount%",
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              article.designation,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFF333333),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              "Réf: ${article.reference}",
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 28),
                  if (depots.isNotEmpty) ...[
                    const Text(
                      "Sélectionner le dépôt :",
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: selectedDepot,
                      decoration: InputDecoration(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        filled: true,
                        fillColor: const Color(0xFFF9FAFB),
                      ),
                      items: depots.entries.map((e) {
                        return DropdownMenuItem(
                          value: e.key,
                          child: Text("${e.key} (Stock: ${e.value.toInt()})"),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedDepot = val;
                            maxQty = depots[val] ?? 0.0;
                            qtyController.text = "1";
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 16),
                  ],
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "Quantité :",
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                      ),
                      Row(
                        children: [
                          IconButton(
                            onPressed: () {
                              int cur = int.tryParse(qtyController.text) ?? 1;
                              if (cur > 1) {
                                setModalState(() => qtyController.text = (cur - 1).toString());
                              }
                            },
                            icon: const Icon(Icons.remove_circle_outline, color: Color(0xFF555555)),
                          ),
                          SizedBox(
                            width: 60,
                            child: TextField(
                              controller: qtyController,
                              keyboardType: TextInputType.number,
                              textAlign: TextAlign.center,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              decoration: const InputDecoration(isDense: true, border: InputBorder.none),
                            ),
                          ),
                          IconButton(
                            onPressed: () {
                              int cur = int.tryParse(qtyController.text) ?? 1;
                              if (cur < maxQty) {
                                setModalState(() => qtyController.text = (cur + 1).toString());
                              }
                            },
                            icon: const Icon(Icons.add_circle_outline, color: Color(0xFF111111)),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF2442),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                        elevation: 0,
                      ),
                      onPressed: depots.isEmpty
                          ? null
                          : () async {
                              int q = int.tryParse(qtyController.text) ?? 1;
                              if (q < 1) q = 1;
                              if (q > maxQty && maxQty > 0) q = maxQty.toInt();

                              Provider.of<CartProvider>(context, listen: false).addToCart(
                                article,
                                qty: q,
                                depot: selectedDepot,
                                price: article.prixVente,
                              );

                              final p = await SharedPreferences.getInstance();
                              await p.setString('last_depot', selectedDepot);

                              if (!ctx.mounted) return;
                              Navigator.pop(ctx);

                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  backgroundColor: const Color(0xFF111111),
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                  content: Row(
                                    children: [
                                      const Icon(Icons.check_circle_rounded, color: Color(0xFF00E676)),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          "Ajouté au panier (${article.designation})",
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                  duration: const Duration(seconds: 2),
                                ),
                              );
                            },
                      child: const Text(
                        "Ajouter au Panier",
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  int? _calculateDiscount(Article article) {
    if (article.prixGros != null && article.prixGros! > 0 && article.prixVente > article.prixGros!) {
      final pct = ((article.prixVente - article.prixGros!) / article.prixVente * 100).round();
      if (pct > 0) return pct;
    }
    // Subtle fallback discount based on article ID hash to match AliExpress deals feel
    final pseudo = (article.id.hashCode.abs() % 45) + 15;
    return pseudo;
  }

  Widget _buildProductThumbnail(Article article) {
    if (article.imagePath != null && article.imagePath!.trim().isNotEmpty) {
      return Image.network(
        article.imagePath!,
        fit: BoxFit.cover,
        errorBuilder: (ctx, err, stack) => _fallbackProductIcon(article),
      );
    }
    return _fallbackProductIcon(article);
  }

  Widget _fallbackProductIcon(Article article) {
    final hash = article.designation.hashCode.abs();
    final colors = [
      const Color(0xFFE8F5E9),
      const Color(0xFFE3F2FD),
      const Color(0xFFF3E5F5),
      const Color(0xFFFFF3E0),
      const Color(0xFFFFEBEE),
    ];
    final color = colors[hash % colors.length];

    return Container(
      color: color,
      child: Center(
        child: Icon(
          Icons.inventory_2_rounded,
          size: 38,
          color: Colors.grey.shade500,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = Provider.of<CartProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      body: SafeArea(
        child: RefreshIndicator(
          color: const Color(0xFFFF2442),
          onRefresh: () => _fetchProducts(forceRefresh: true),
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              // 1. TOP HEADER (AliExpress Brand + Notifications)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          if (widget.onBackToApp != null)
                            IconButton(
                              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: widget.onBackToApp,
                            ),
                          if (widget.onBackToApp != null) const SizedBox(width: 8),
                          RichText(
                            text: const TextSpan(
                              children: [
                                TextSpan(
                                  text: "Ali",
                                  style: TextStyle(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFFFF5000), // AliExpress Orange/Red
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                TextSpan(
                                  text: "Express",
                                  style: TextStyle(
                                    fontSize: 26,
                                    fontWeight: FontWeight.w900,
                                    color: Color(0xFF111111),
                                    letterSpacing: -0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.notifications_none_rounded, size: 28, color: Colors.black87),
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text("Pas de nouvelles notifications"),
                                  duration: Duration(seconds: 1),
                                ),
                              );
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // 2. SEARCH BAR WITH CAMERA/SCANNER ICON & SEARCH BUTTON
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFE0E0E0), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.04),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const SizedBox(width: 12),
                        GestureDetector(
                          onTap: _openScanner,
                          child: const Icon(Icons.camera_alt_outlined, color: Color(0xFF222222), size: 24),
                        ),
                        const SizedBox(width: 8),
                        Container(width: 1, height: 20, color: Colors.grey.shade300),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _searchController,
                            decoration: const InputDecoration(
                              hintText: "OPPO Find X9 Ultra / Rechercher...",
                              hintStyle: TextStyle(color: Color(0xFF9E9E9E), fontSize: 14),
                              border: InputBorder.none,
                              isDense: true,
                            ),
                          ),
                        ),
                        if (_searchController.text.isNotEmpty)
                          IconButton(
                            icon: const Icon(Icons.close, size: 18, color: Colors.grey),
                            onPressed: () {
                              _searchController.clear();
                              _fetchProducts();
                            },
                          ),
                        Container(
                          margin: const EdgeInsets.only(right: 4),
                          width: 40,
                          height: 40,
                          decoration: const BoxDecoration(
                            color: Color(0xFF111111),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.search, color: Colors.white, size: 20),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 3. HORIZONTAL CATEGORY TABS
              SliverToBoxAdapter(
                child: Container(
                  height: 44,
                  margin: const EdgeInsets.only(top: 8),
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _categories.length,
                    itemBuilder: (context, index) {
                      final cat = _categories[index];
                      final isSelected = cat == _selectedCategory;
                      return GestureDetector(
                        onTap: () {
                          setState(() => _selectedCategory = cat);
                          _fetchProducts();
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          alignment: Alignment.center,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                cat,
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                                  color: isSelected ? Colors.black : const Color(0xFF757575),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Container(
                                width: isSelected ? 22 : 0,
                                height: 3,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF00A854),
                                  borderRadius: BorderRadius.circular(2),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

              // 4. ACTION PILLS ROW (Coins, Prize Land, Brand+, Clearance, Play & Earn)
              SliverToBoxAdapter(
                child: Container(
                  height: 60,
                  margin: const EdgeInsets.symmetric(vertical: 4),
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: _quickPills.length,
                    itemBuilder: (context, index) {
                      final pill = _quickPills[index];
                      return Container(
                        margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.grey.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(pill['icon'] as IconData, size: 16, color: pill['color'] as Color),
                            const SizedBox(width: 6),
                            Text(
                              pill['label'] as String,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF424242),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),

              // 5. SUPERDEALS SECTION HEADER
              SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: const [
                          Text(
                            "SuperDeals",
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF111111),
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF0F2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: const [
                            Icon(Icons.bolt_rounded, size: 16, color: Color(0xFFFF2442)),
                            SizedBox(width: 4),
                            Text(
                              "Limited time 80% off",
                              style: TextStyle(
                                color: Color(0xFFFF2442),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Icon(Icons.chevron_right, size: 16, color: Color(0xFFFF2442)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // 6. SUPERDEALS HORIZONTAL CAROUSEL
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 240,
                  child: _articles.isEmpty
                      ? const Center(child: Text("Aucun article trouvé"))
                      : ListView.builder(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          itemCount: _articles.length > 8 ? 8 : _articles.length,
                          itemBuilder: (context, index) {
                            final article = _articles[index];
                            final discount = _calculateDiscount(article);
                            return Container(
                              width: 145,
                              margin: const EdgeInsets.symmetric(horizontal: 5),
                              child: GestureDetector(
                                onTap: () => _quickAddToCart(article),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Image Container
                                    Container(
                                      height: 145,
                                      width: 145,
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(12),
                                        border: Border.all(color: Colors.grey.shade200),
                                      ),
                                      child: Stack(
                                        children: [
                                          ClipRRect(
                                            borderRadius: BorderRadius.circular(12),
                                            child: SizedBox.expand(
                                              child: _buildProductThumbnail(article),
                                            ),
                                          ),
                                          if (index == 2)
                                            Positioned(
                                              bottom: 0,
                                              left: 0,
                                              right: 0,
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(vertical: 2),
                                                decoration: const BoxDecoration(
                                                  color: Color(0xFFFFC107),
                                                  borderRadius: BorderRadius.vertical(bottom: Radius.circular(12)),
                                                ),
                                                child: Row(
                                                  mainAxisAlignment: MainAxisAlignment.center,
                                                  children: const [
                                                    Icon(Icons.check, size: 12, color: Colors.black87),
                                                    Text(
                                                      "Choice",
                                                      style: TextStyle(
                                                        fontSize: 10,
                                                        fontWeight: FontWeight.w900,
                                                        fontStyle: FontStyle.italic,
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    // Price in XOF
                                    Text(
                                      "XOF${_currencyFormat.format(article.prixVente.toInt())}",
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w900,
                                        color: Color(0xFF111111),
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    // Red discount pill
                                    if (discount != null)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFF2442),
                                          borderRadius: BorderRadius.circular(3),
                                        ),
                                        child: Text(
                                          "$discount% off",
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 10,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ),

              // 7. SECONDARY DISCOVERY HEADERS ("Top rankings", "Viva Fashion", "Sports Hot")
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              "Top rankings",
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.black87),
                            ),
                            Text("Daily rankings", style: TextStyle(fontSize: 11, color: Colors.grey)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              "Viva Fashion",
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.black87),
                            ),
                            Text("Your fashion choice", style: TextStyle(fontSize: 11, color: Colors.grey)),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            Text(
                              "Sports Hot",
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Colors.black87),
                            ),
                            Text("Peak savings", style: TextStyle(fontSize: 11, color: Colors.grey)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // 8. PRODUCT DISCOVERY GRID
              if (_isLoading && _articles.isEmpty)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(
                      child: CircularProgressIndicator(color: Color(0xFFFF2442)),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 16,
                      childAspectRatio: 0.68,
                    ),
                    sliver: SliverChildBuilderDelegate(
                      (context, index) {
                        final article = _articles[index];
                        final discount = _calculateDiscount(article);

                        return GestureDetector(
                          onTap: () => _quickAddToCart(article),
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Thumbnail
                                Expanded(
                                  flex: 6,
                                  child: Container(
                                    width: double.infinity,
                                    decoration: BoxDecoration(
                                      color: Colors.grey.shade50,
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                                      child: _buildProductThumbnail(article),
                                    ),
                                  ),
                                ),
                                // Details
                                Expanded(
                                  flex: 5,
                                  child: Padding(
                                    padding: const EdgeInsets.all(8.0),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          article.designation,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFF222222),
                                          ),
                                        ),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                "XOF${_currencyFormat.format(article.prixVente.toInt())}",
                                                style: const TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w900,
                                                  color: Color(0xFF111111),
                                                ),
                                              ),
                                            ),
                                            if (discount != null)
                                              Text(
                                                "-$discount%",
                                                style: const TextStyle(
                                                  color: Color(0xFFFF2442),
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                ),
                                              ),
                                          ],
                                        ),
                                        // Quick Add Pill
                                        Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.symmetric(vertical: 4),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFF2442).withOpacity(0.08),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          alignment: Alignment.center,
                                          child: Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: const [
                                              Icon(Icons.add_shopping_cart_rounded, size: 14, color: Color(0xFFFF2442)),
                                              SizedBox(width: 4),
                                              Text(
                                                "Ajouter",
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFFFF2442),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                      childCount: _articles.length,
                    ),
                  ),
                ),

              const SliverToBoxAdapter(child: SizedBox(height: 30)),
            ],
          ),
        ),
      ),

      // 9. BOTTOM NAVIGATION BAR (Home, Shop, Feed, Cart, Account)
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Colors.grey.shade200, width: 1)),
        ),
        child: BottomNavigationBar(
          currentIndex: _bottomNavIndex,
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: const Color(0xFFFF2442),
          unselectedItemColor: const Color(0xFF616161),
          selectedLabelStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
          unselectedLabelStyle: const TextStyle(fontSize: 11),
          elevation: 0,
          onTap: (index) {
            setState(() => _bottomNavIndex = index);
            if (index == 3) {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CartScreen()),
              );
            }
          },
          items: [
            BottomNavigationBarItem(
              icon: Container(
                padding: const EdgeInsets.all(4),
                decoration: _bottomNavIndex == 0
                    ? BoxDecoration(
                        color: const Color(0xFFFF2442),
                        borderRadius: BorderRadius.circular(8),
                      )
                    : null,
                child: Icon(
                  Icons.storefront_rounded,
                  color: _bottomNavIndex == 0 ? Colors.white : const Color(0xFF616161),
                  size: 20,
                ),
              ),
              label: "Home",
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.manage_search_rounded),
              label: "Shop",
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.wifi_tethering_rounded),
              label: "Feed",
            ),
            BottomNavigationBarItem(
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.shopping_cart_outlined),
                  if (cart.itemCount > 0)
                    Positioned(
                      top: -4,
                      right: -8,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFF2442),
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                        child: Text(
                          "${cart.itemCount}",
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              label: "Cart",
            ),
            const BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              label: "Account",
            ),
          ],
        ),
      ),
    );
  }
}
