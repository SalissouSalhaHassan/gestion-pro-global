import 'package:flutter/material.dart';
import '../api/api_service.dart';
import '../api/supabase_service.dart';
import 'package:intl/intl.dart'; 

class DashboardProvider with ChangeNotifier {
  final ApiService _apiService = ApiService();
  final SupabaseService _supabaseService = SupabaseService();

  double _salesToday = 0.0;
  int _clientsCount = 0;
  int _articlesCount = 0;
  
  List<Map<String, dynamic>> _weeklySales = [];
  List<Map<String, dynamic>> _topProducts = [];
  List<Map<String, dynamic>> _lowStock = [];
  List<Map<String, dynamic>> _topClients = [];
  List<Map<String, dynamic>> _salesVsExpenses = [];

  bool _isLoading = false;
  String? _error;

  double get salesToday => _salesToday;
  double get todaySales => _salesToday;
  int get clientsCount => _clientsCount;
  int get totalClients => _clientsCount;
  int get articlesCount => _articlesCount;
  int get totalArticles => _articlesCount;
  List<Map<String, dynamic>> get weeklySales => _weeklySales;
  List<Map<String, dynamic>> get topProducts => _topProducts;
  List<Map<String, dynamic>> get lowStock => _lowStock;
  List<Map<String, dynamic>> get topClients => _topClients;
  List<Map<String, dynamic>> get salesVsExpenses => _salesVsExpenses;
  bool get isLoading => _isLoading;
  String? get error => _error;

  double get healthScore => 80.0; 
  double get salesGrowth => 0.0;

  Future<void> fetchDashboardData(String token, {bool forceRefresh = false, String? vendeur}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final basicData = await _apiService.getDashboardStats(token, forceRefresh: forceRefresh, vendeur: vendeur);
      
      if (basicData.isNotEmpty) {
        _salesToday = (basicData['daily_sales'] ?? 0).toDouble();
        _clientsCount = basicData['total_clients'] ?? 0;
        _articlesCount = basicData['total_products'] ?? 0;
      } else {
        await _fetchFromSupabase(vendeur: vendeur);
      }

      final results = await Future.wait<dynamic>([
        _apiService.getWeeklySales(token, vendeur: vendeur),
        _apiService.getTopProducts(token, vendeur: vendeur),
        _apiService.getLowStock(token),
        _apiService.getTopClients(token, vendeur: vendeur),
        _apiService.getSalesVsExpenses(token, vendeur: vendeur),
      ]);

      _weeklySales = results[0];
      _topProducts = results[1];
      _lowStock = results[2];
      _topClients = results[3];
      _salesVsExpenses = results[4];

    } catch (e) {
      debugPrint("Dashboard Error: $e");
      try {
        await _fetchFromSupabase(vendeur: vendeur);
      } catch (supaErr) {
        _error = supaErr.toString();
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _fetchFromSupabase({String? vendeur}) async {
    if (!_supabaseService.isInitialized) await _supabaseService.init();
    final client = _supabaseService.client;
    if (client == null) return;

    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

    try {
      var facturesQuery = client.from('factures').select('total_ttc').eq('date_facture', today).neq('statut', 'Annulée');
      if (vendeur != null) {
        facturesQuery = facturesQuery.eq('vendeur', vendeur);
      }
      final factures = await facturesQuery;
      
      double sales = 0.0;
      for (var f in factures) {
        sales += (f['total_ttc'] as num?)?.toDouble() ?? 0.0;
      }
      _salesToday = sales;

      final clientsRes = await client.from('clients').select('id');
      _clientsCount = (clientsRes as List).length;

      final productsRes = await client.from('articles').select('id');
      _articlesCount = (productsRes as List).length;
    } catch (e) {
      debugPrint("Error fetching from Supabase: $e");
    }
  }
}
