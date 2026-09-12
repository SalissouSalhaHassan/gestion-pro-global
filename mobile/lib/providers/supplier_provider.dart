import 'package:flutter/material.dart';
import '../models/supplier_model.dart';
import '../api/api_service.dart';
import 'auth_provider.dart';

class SupplierProvider with ChangeNotifier {
  List<Supplier> _suppliers = [];
  bool _isLoading = false;
  final ApiService _apiService = ApiService();

  List<Supplier> get suppliers => _suppliers;
  bool get isLoading => _isLoading;

  Future<void> fetchSuppliers(AuthProvider auth, {bool forceRefresh = false}) async {
    if (auth.token == null) return;
    _isLoading = true;
    notifyListeners();

    try {
      final data = await _apiService.getSuppliers(auth.token!, forceRefresh: forceRefresh);
      debugPrint('Suppliers fetched: ${data.length}');
      _suppliers = data.map((e) => Supplier.fromJson(e)).toList();
    } catch (e) {
      debugPrint('Error fetching suppliers: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addSupplier(AuthProvider auth, String name, String phone, String address) async {
    if (auth.token == null) return;
    try {
      final newSupplier = {
        'nom': name,
        'tel': phone,
        'adresse': address,
        'credit': 0.0,
      };
      
      await _apiService.addSupplier(newSupplier, auth.token!);
      
      // Refresh list
      await fetchSuppliers(auth, forceRefresh: false);
    } catch (e) {
      debugPrint('Error adding supplier: $e');
      rethrow;
    }
  }
}
