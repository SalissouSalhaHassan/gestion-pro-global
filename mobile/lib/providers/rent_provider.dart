import 'package:flutter/material.dart';
import '../models/contract_model.dart';
import '../models/rent_payment_model.dart';
import '../api/api_service.dart';
import 'auth_provider.dart';

class RentProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<Contract> _contracts = [];
  List<RentPayment> _payments = [];
  bool _isLoading = false;
  bool _isSaving = false;
  String? _error;

  List<Contract> get contracts => _contracts;
  List<RentPayment> get payments => _payments;
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  String? get error => _error;

  Future<void> fetchContracts(AuthProvider auth, {bool forceRefresh = false}) async {
    if (auth.token == null) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _apiService.getContracts(auth.token!, forceRefresh: forceRefresh);
      _contracts = data.map((json) => Contract.fromJson(Map<String, dynamic>.from(json))).toList();
    } catch (e) {
      debugPrint('Error fetching contracts in provider: $e');
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchPayments(AuthProvider auth, {bool forceRefresh = false, Map<String, String>? filters}) async {
    if (auth.token == null) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final data = await _apiService.getRentPayments(auth.token!, filters: filters);
      _payments = data.map((json) => RentPayment.fromJson(Map<String, dynamic>.from(json))).toList();
    } catch (e) {
      debugPrint('Error fetching payments in provider: $e');
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<RentPayment>> fetchPaymentsForContract(AuthProvider auth, int contractId) async {
    if (auth.token == null) return [];
    try {
      final data = await _apiService.getRentPaymentsForContract(contractId, auth.token!);
      return data.map((json) => RentPayment.fromJson(Map<String, dynamic>.from(json))).toList();
    } catch (e) {
      debugPrint('Error fetching payments for contract $contractId: $e');
      return [];
    }
  }

  Future<void> addContract(AuthProvider auth, Map<String, dynamic> data) async {
    if (auth.token == null) return;
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.addContract(data, auth.token!);
      await fetchContracts(auth, forceRefresh: true);
    } catch (e) {
      debugPrint('Error adding contract: $e');
      _error = e.toString();
      rethrow;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<void> updateContract(AuthProvider auth, int id, Map<String, dynamic> data) async {
    if (auth.token == null) return;
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.updateContract(id, data, auth.token!);
      await fetchContracts(auth, forceRefresh: true);
    } catch (e) {
      debugPrint('Error updating contract: $e');
      _error = e.toString();
      rethrow;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<void> deleteContract(AuthProvider auth, int id) async {
    if (auth.token == null) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.deleteContract(id, auth.token!);
      _contracts.removeWhere((c) => c.id == id);
    } catch (e) {
      debugPrint('Error deleting contract: $e');
      _error = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addPayment(AuthProvider auth, int contractId, Map<String, dynamic> data) async {
    if (auth.token == null) return;
    _isSaving = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.addRentPayment(contractId, data, auth.token!);
      await fetchContracts(auth, forceRefresh: true);
    } catch (e) {
      debugPrint('Error adding payment: $e');
      _error = e.toString();
      rethrow;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  Future<void> deletePayment(AuthProvider auth, int paymentId, int contractId) async {
    if (auth.token == null) return;
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      await _apiService.deleteRentPayment(paymentId, auth.token!);
      await fetchContracts(auth, forceRefresh: true);
    } catch (e) {
      debugPrint('Error deleting payment: $e');
      _error = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
