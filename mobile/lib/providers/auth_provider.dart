import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_service.dart';
import '../api/supabase_service.dart';

class AuthProvider with ChangeNotifier {
  String? _token;
  String? _signature;
  String? _username;
  String? _role; 
  String? _userId; 
  String? _emplacement; 
  String? _organizationId;
  List<String> _permissions = [];
  List<String> _depots = []; 
  final ApiService _apiService = ApiService();
  final _storage = const FlutterSecureStorage();

  String? get token => _token;
  String? get signature => _signature;
  String? get username => _username;
  String? get role => _role;
  String? get userId => _userId;
  String? get emplacement => _emplacement;
  String? get organizationId => _organizationId;
  List<String> get permissions => _permissions;
  List<String> get depots => _depots;
  
  List<String> _allKnownDepots = ["Boutique", "Magasin", "Dépôt 1", "Dépôt 2"];

  List<String> get allowedDepots {
     if (isAdmin) {
       return _allKnownDepots.isNotEmpty ? _allKnownDepots : ["Boutique", "Magasin", "Dépôt 1", "Dépôt 2"];
     }
     return _depots;
  }
  
  Future<void> refreshDepots() async {
    if (_token == null) return;
    try {
      final depots = await _apiService.refreshUserDepots(force: true);
      final prefs = await SharedPreferences.getInstance();
      final role = prefs.getString('auth_role');
      if (role != null && role.isNotEmpty && role != _role) {
        _role = role;
      }
      if (isAdmin) {
        _allKnownDepots = depots;
      } else {
        _depots = depots;
      }
      notifyListeners();
    } catch (_) {}
  }
  
  bool get isAuthenticated => _token != null;
  bool get isAuth => _token != null;
  
  bool get isAdmin => _role?.toLowerCase() == "admin" || _role?.toLowerCase() == "administrateur" || _role?.toLowerCase() == "gerant";
  
  // RBAC Permission checks matching Web app
  bool hasPermission(String permission) {
    if (isAdmin) return true;
    if (_permissions.contains('*')) return true;
    return _permissions.contains(permission);
  }

  bool get canAccessPOS => hasPermission('pos.access') || hasPermission('pos.sale') || !isAdmin; // POS is open to sales staff
  bool get canAccessInventory => hasPermission('inventory.view') || hasPermission('stock.view') || isAdmin;
  bool get canAccessClients => hasPermission('clients.view') || true;
  bool get canAccessPurchases => hasPermission('purchases.view') || isAdmin;
  bool get canAccessFinance => hasPermission('finance.view') || hasPermission('caisse.view') || isAdmin;
  bool get canAccessReports => hasPermission('reports.view') || isAdmin;
  bool get canDeleteInvoice => hasPermission('invoices.delete') || isAdmin;
  bool get canAdjustStock => hasPermission('stock.adjust') || isAdmin;
  bool get canManageUsers => hasPermission('users.manage') || isAdmin;
  bool get canViewPurchasePrices => hasPermission('inventory.view_cost') || isAdmin;
  bool get canGiveDiscounts => hasPermission('pos.discount') || isAdmin;
  bool get canViewDailySalesReports => hasPermission('reports.daily_sales') || true;

  Future<void> login(String username, String password) async {
    try {
      final responseData = await _apiService.login(username, password);
      
      if (responseData != null) {
        _token = responseData['access_token'];
        _signature = responseData['signature']?.toString();
        _username = responseData['username'] ?? username;
        _role = responseData['role'] ?? 'vendeur';
        _userId = responseData['user_id']?.toString();
        _emplacement = responseData['emplacement'];
        _organizationId = responseData['organization_id']?.toString();
        
        if (responseData['permissions'] != null && responseData['permissions'] is List) {
          _permissions = (responseData['permissions'] as List).map((p) => p.toString()).toList();
        } else {
          _permissions = [];
        }

        if (responseData['depots'] != null) {
          if (responseData['depots'] is List) {
            _depots = (responseData['depots'] as List).map((e) => e.toString().trim()).toList();
          } else {
            final depotsStr = responseData['depots'].toString();
            _depots = depotsStr.isNotEmpty ? depotsStr.split(',').map((e) => e.trim()).toList() : [];
          }
        } else {
          _depots = [];
        }

        if (_token == null) throw Exception("Le token est vide");

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('auth_username', _username!);
        await prefs.setString('auth_role', _role!);
        if (_userId != null) await prefs.setString('auth_userId', _userId!);
        if (_emplacement != null) await prefs.setString('auth_emplacement', _emplacement!);
        if (_organizationId != null) await prefs.setString('auth_organizationId', _organizationId!);
        await prefs.setStringList('auth_permissions', _permissions);
        await prefs.setStringList('auth_depots', _depots);
        await prefs.setInt('auth_depots_ts', DateTime.now().millisecondsSinceEpoch);
        
        await _storage.write(key: 'auth_token', value: _token);
        if (_organizationId != null) await _storage.write(key: 'auth_organization_id', value: _organizationId);
        if (_signature != null) await _storage.write(key: 'auth_signature', value: _signature);
        await _storage.write(key: 'saved_username', value: username);
        await _storage.write(key: 'saved_password', value: password);
        await _storage.write(key: 'saved_role', value: _role);

        await refreshDepots();
        notifyListeners();
      }
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, String>?> getSavedCredentials() async {
    final username = await _storage.read(key: 'saved_username');
    final password = await _storage.read(key: 'saved_password');
    if (username != null && password != null) {
      return {'username': username, 'password': password};
    }
    return null;
  }

  Future<void> logout() async {
    _token = null;
    _signature = null;
    _username = null;
    _role = null;
    _userId = null;
    _emplacement = null;
    _organizationId = null;
    _permissions = [];
    _depots = [];
    
    final prefs = await SharedPreferences.getInstance();
    // Remove only auth-related keys, preserving supabase_url and supabase_key
    await prefs.remove('auth_username');
    await prefs.remove('auth_role');
    await prefs.remove('auth_userId');
    await prefs.remove('auth_emplacement');
    await prefs.remove('auth_organizationId');
    await prefs.remove('auth_permissions');
    await prefs.remove('auth_depots');
    await prefs.remove('auth_depots_ts');
    
    // Only remove the session token, KEEP credentials for biometrics if enabled
    await _storage.delete(key: 'auth_token');
    await _storage.delete(key: 'auth_signature');
    await _storage.delete(key: 'auth_organization_id');
    
    notifyListeners();
  }

  Future<bool> getBiometricEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('biometric_enabled') ?? false;
  }

  Future<void> setBiometricEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometric_enabled', value);
    if (!value) {
      // If disabling, clear saved credentials for security
      await _storage.delete(key: 'saved_username');
      await _storage.delete(key: 'saved_password');
    }
  }

  Future<void> tryAutoLogin() async {
    final token = await _storage.read(key: 'auth_token');
    if (token == null) return;

    final prefs = await SharedPreferences.getInstance();
    _token = token;
    _signature = await _storage.read(key: 'auth_signature');
    _username = prefs.getString('auth_username') ?? "Utilisateur";
    _role = await _storage.read(key: 'saved_role') ?? prefs.getString('auth_role') ?? "vendeur";
    _userId = prefs.getString('auth_userId');
    _emplacement = prefs.getString('auth_emplacement');
    _organizationId = prefs.getString('auth_organizationId') ?? await _storage.read(key: 'auth_organization_id');
    _permissions = prefs.getStringList('auth_permissions') ?? [];
    _depots = prefs.getStringList('auth_depots') ?? [];
    
    await refreshDepots();
    notifyListeners();
  }
}
