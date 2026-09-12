import 'package:flutter/material.dart';
import '../models/ciment_model.dart';
import '../api/api_service.dart';
import 'auth_provider.dart';

class CimentProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<CimentShipment> _shipments = [];
  List<CimentPayment> _payments = [];
  bool _isLoading = false;

  List<CimentShipment> get shipments => _shipments;
  List<CimentPayment> get payments => _payments;
  bool get isLoading => _isLoading;

  // Stats
  double _tonnageTotal = 0.0;
  double _totalFacture = 0.0;
  double _totalEncaisse = 0.0;
  double _resteAPayer = 0.0;

  double get tonnageTotal => _tonnageTotal;
  double get totalFacture => _totalFacture;
  double get totalEncaisse => _totalEncaisse;
  double get resteAPayer => _resteAPayer;

  void _calculateStats() {
    _tonnageTotal = 0.0;
    _totalFacture = 0.0;
    _totalEncaisse = 0.0;

    for (var s in _shipments) {
      _tonnageTotal += s.tonnage;
      _totalFacture += s.total;
      _totalEncaisse += s.montantPaye;
    }
    _resteAPayer = _totalFacture - _totalEncaisse;
  }

  Future<void> fetchShipments(AuthProvider auth, {Map<String, String>? filters}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final data = await _apiService.getCimentShipments(auth.token!, filters: filters);
      _shipments = data.map((json) => CimentShipment.fromJson(json)).toList();
      _calculateStats();
    } catch (e) {
      debugPrint("CimentProvider: fetchShipments error: $e");
      _shipments = [];
      _tonnageTotal = 0.0;
      _totalFacture = 0.0;
      _totalEncaisse = 0.0;
      _resteAPayer = 0.0;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addShipment(AuthProvider auth, Map<String, dynamic> data) async {
    await _apiService.addCimentShipment(data, auth.token!);
    await fetchShipments(auth);
  }

  Future<void> updateShipment(AuthProvider auth, String id, Map<String, dynamic> data) async {
    await _apiService.updateCimentShipment(id, data, auth.token!);
    await fetchShipments(auth);
  }

  Future<void> deleteShipment(AuthProvider auth, String id) async {
    await _apiService.deleteCimentShipment(id, auth.token!);
    await fetchShipments(auth);
  }

  Future<List<CimentPayment>> fetchPayments(AuthProvider auth, String shipmentId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final data = await _apiService.getCimentPayments(shipmentId, auth.token!);
      _payments = data.map((json) => CimentPayment.fromJson(json)).toList();
      return _payments;
    } catch (e) {
      debugPrint("CimentProvider: fetchPayments error: $e");
      _payments = [];
      return [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addPayment(AuthProvider auth, String shipmentId, Map<String, dynamic> data) async {
    await _apiService.addCimentPayment(shipmentId, data, auth.token!);
    await fetchPayments(auth, shipmentId);
    // Reload shipments to update stats & paid amounts
    await fetchShipments(auth);
  }

  Future<void> deletePayment(AuthProvider auth, String paymentId, String shipmentId) async {
    await _apiService.deleteCimentPayment(paymentId, auth.token!);
    await fetchPayments(auth, shipmentId);
    // Reload shipments to update stats & paid amounts
    await fetchShipments(auth);
  }
}
