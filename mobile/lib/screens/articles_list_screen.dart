import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../models/article_model.dart'; // تأكد من استيراد الموديل
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import 'cart_screen.dart';

class ArticlesListScreen extends StatefulWidget {
  const ArticlesListScreen({super.key});

  @override
  State<ArticlesListScreen> createState() => _ArticlesListScreenState();
}

class _ArticlesListScreenState extends State<ArticlesListScreen> {
  late Future<List<dynamic>> _articlesFuture;

  @override
  void initState() {
    super.initState();
    // جلب المنتجات عند بدء الشاشة
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _articlesFuture = ApiService().getArticles(
      auth.token!,
      userId: auth.userId,
      allowedDepots: auth.allowedDepots,
      isAdmin: auth.isAdmin,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Articles"),
        actions: [
          // أيقونة السلة مع العداد
          Consumer<CartProvider>(
            builder: (_, cart, ch) => Badge(
              label: Text(cart.itemCount.toString()),
              isLabelVisible: cart.itemCount > 0,
              child: IconButton(
                icon: const Icon(Icons.shopping_cart),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (context) => const CartScreen()),
                  );
                },
              ),
            ),
          ),
          const SizedBox(width: 15),
        ],
      ),
      body: FutureBuilder<List<dynamic>>(
        future: _articlesFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text("Erreur: ${snapshot.error}"));
          } else if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return const Center(child: Text("Aucun article trouvé"));
          }

          final articlesData = snapshot.data!;

          return ListView.builder(
            itemCount: articlesData.length,
            padding: const EdgeInsets.all(8),
            itemBuilder: (context, index) {
              final item = articlesData[index] as Map<String, dynamic>;
              final article = Article.fromJson(item);

              return Card(
                elevation: 2,
                margin: const EdgeInsets.symmetric(vertical: 6),
                child: Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Row(
                    children: [
                      // 1. الدائرة الملونة
                      CircleAvatar(
                        radius: 25,
                        backgroundColor: Colors.blue.shade100,
                        child: Text(
                          article.designation.isNotEmpty
                              ? article.designation.substring(0, 1).toUpperCase()
                              : "?",
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                      ),
                      const SizedBox(width: 15),

                      // 2. النصوص (مع حل مشكلة Overflow باستخدام Expanded)
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              article.designation,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                              maxLines: 2, // حد أقصى سطرين
                              overflow: TextOverflow
                                  .ellipsis, // وضع ... إذا كان النص طويلاً
                            ),
                            const SizedBox(height: 5),
                            Builder(
                              builder: (context) {
                                final auth = Provider.of<AuthProvider>(context, listen: false);
                                final double currentStock = article.getStockForDepots(auth.allowedDepots);
                                return Text(
                                  "${article.prixVenteTTC.toStringAsFixed(2)} FCFA | Stock: ${currentStock.toInt()}",
                                  style: TextStyle(
                                    color: currentStock < 5
                                        ? Colors.red
                                        : Colors.grey[700],
                                    fontWeight: FontWeight.w500,
                                  ),
                                );
                              }
                            ),
                          ],
                        ),
                      ),

                      // 3. زر الإضافة للسلة
                      Consumer<CartProvider>(
                        builder: (context, cart, child) {
                          return IconButton(
                            icon: const Icon(
                              Icons.add_circle,
                              color: Colors.green,
                              size: 35,
                            ),
                            onPressed: () {
                              final auth = Provider.of<AuthProvider>(context, listen: false);
                              final allowed = auth.allowedDepots;
                               String targetDepot = allowed.isNotEmpty ? allowed.first : "Boutique";

                              cart.addToCart(article, depot: targetDepot);

                              // رسالة تأكيد
                              ScaffoldMessenger.of(
                                context,
                              ).hideCurrentSnackBar();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    '${article.designation} ajouté au panier ($targetDepot)!',
                                  ),
                                  duration: const Duration(seconds: 1),
                                ),
                              );
                            },
                          );
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
