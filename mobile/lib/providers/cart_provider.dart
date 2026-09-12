import 'package:flutter/material.dart';
import '../models/article_model.dart';

class CartItem {
  final Article article;
  int quantity;
  final String selectedDepot;
  double? price;

  CartItem({
    required this.article, 
    this.quantity = 1,
    required this.selectedDepot,
    this.price,
  });

  double get unitPrice => price ?? article.prixVente;
  double get total => unitPrice * quantity;
}

class CartProvider with ChangeNotifier {
  final List<CartItem> _items = [];

  List<CartItem> get items => _items;

  void addToCart(Article article, {int qty = 1, String depot = "Principal", double? price}) {
    int index = _items.indexWhere(
      (item) => item.article.id == article.id && item.selectedDepot == depot && (item.price ?? item.article.prixVente) == (price ?? article.prixVente)
    );

    if (index >= 0) {
      _items[index].quantity += qty;
    } else {
      _items.add(CartItem(
        article: article, 
        quantity: qty,
        selectedDepot: depot,
        price: price,
      ));
    }
    notifyListeners();
  }

  void removeSingleItem(int articleId, String depot) {
    int index = _items.indexWhere(
      (item) => item.article.id == articleId && item.selectedDepot == depot
    );
    
    if (index >= 0) {
      if (_items[index].quantity > 1) {
        _items[index].quantity--;
      } else {
        _items.removeAt(index);
      }
      notifyListeners();
    }
  }

  void deleteItem(int articleId, String depot) {
    _items.removeWhere(
      (item) => item.article.id == articleId && item.selectedDepot == depot
    );
    notifyListeners();
  }

  void clearCart() {
    _items.clear();
    notifyListeners();
  }

  double get totalAmount {
    var total = 0.0;
    for (var item in _items) {
      total += item.total;
    }
    return total;
  }

  int get itemCount {
    return _items.length;
  }
}
