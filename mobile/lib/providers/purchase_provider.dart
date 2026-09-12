import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/purchase_invoice_model.dart';
import '../models/supplier_model.dart';
import '../api/api_service.dart';
import 'auth_provider.dart';

class PurchaseProvider with ChangeNotifier {
  List<PurchaseInvoice> _purchases = [];
  bool _isLoading = false;
  final ApiService _apiService = ApiService();

  List<PurchaseInvoice> get purchases => _purchases;
  bool get isLoading => _isLoading;

  Future<void> fetchPurchases(AuthProvider auth, {bool forceRefresh = false}) async {
    if (auth.token == null) return;
    _isLoading = true;
    notifyListeners();

    try {
      final data = await _apiService.getPurchases(auth.token!, forceRefresh: forceRefresh);
      debugPrint('Purchases fetched: ${data.length}');
      
      final List<PurchaseInvoice> loaded = [];
      for (var item in data) {
        try {
          loaded.add(PurchaseInvoice.fromJson(item));
        } catch (e) {
          debugPrint('Error parsing purchase item: $e');
        }
      }
      
      _purchases = loaded;
      _purchases.sort((a, b) => b.date.compareTo(a.date));
    } catch (e) {
      debugPrint('Error fetching purchases: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> createPurchase(
    AuthProvider auth,
    Supplier supplier,
    String? depotNom,
    String? numeroFacture,
    String? notes,
    List<PurchaseInvoiceItem> items,
    double totalAmount,
    double paidAmount,
    String status,
  ) async {
    if (auth.token == null) return;
    try {
      final purchaseData = {
        'fournisseur_id': supplier.id,
        'fournisseur_nom': supplier.name,
        'numero_facture': numeroFacture,
        'depot_nom': depotNom,
        'notes': notes,
        'date_achat': DateFormat('yyyy-MM-dd').format(DateTime.now()),
        'sous_total': totalAmount,
        'remise': 0.0,
        'taxe': 0.0,
        'transport': 0.0,
        'montant_total': totalAmount,
        'montant_paye': paidAmount,
        'statut': status,
        'items': items.map((e) => e.toJson()).toList(),
      };
      
      debugPrint('Purchase payload keys: ${purchaseData.keys}');
      debugPrint('Purchase items count: ${(purchaseData['items'] as List).length}');

      await _apiService.createPurchase(purchaseData, auth.token!);
      await fetchPurchases(auth, forceRefresh: true);
    } catch (e) {
      debugPrint('Error creating purchase: $e');
      rethrow;
    }
  }

  Future<void> payPurchase(AuthProvider auth, String purchaseId, double amount, String method) async {
    if (auth.token == null) return;
    try {
      await _apiService.payPurchase(purchaseId, amount, method, auth.token!);
      await fetchPurchases(auth, forceRefresh: true);
    } catch (e) {
      debugPrint('Error paying purchase: $e');
      rethrow;
    }
  }

  Future<void> deletePurchase(AuthProvider auth, String purchaseId) async {
    if (auth.token == null) return;
    try {
      await _apiService.deletePurchase(purchaseId, auth.token!);
      await fetchPurchases(auth, forceRefresh: true);
    } catch (e) {
      debugPrint('Error deleting purchase: $e');
      rethrow;
    }
  }

  Future<void> updatePurchase(AuthProvider auth, String purchaseId, Map<String, dynamic> data) async {
    if (auth.token == null) return;
    try {
      await _apiService.updatePurchase(purchaseId, data, auth.token!);
      await fetchPurchases(auth, forceRefresh: true);
    } catch (e) {
      debugPrint('Error updating purchase: $e');
      rethrow;
    }
  }
}
