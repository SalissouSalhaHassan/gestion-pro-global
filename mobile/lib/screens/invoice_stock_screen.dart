// lib/screens/invoice_stock_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';

/// A screen that displays two main sections:
///   1️⃣ List of invoices ("Factures")
///   2️⃣ List of stocks ("Stocks")
///
/// Both sections are refreshed automatically every 2 seconds.
class InvoiceStockScreen extends StatefulWidget {
  const InvoiceStockScreen({Key? key}) : super(key: key);

  @override
  State<InvoiceStockScreen> createState() => _InvoiceStockScreenState();
}

class _InvoiceStockScreenState extends State<InvoiceStockScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _invoices = [];
  List<dynamic> _stocks = [];
  bool _loadingInvoices = true;
  bool _loadingStocks = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    // Initial fetch
    _fetchInvoices();
    _fetchStocks();
    // Refresh every 2 seconds
    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 2));
      if (!mounted) return false;
      _fetchInvoices();
      _fetchStocks();
      return true;
    });
  }

  Future<void> _fetchInvoices() async {
    setState(() => _loadingInvoices = true);
    try {
      // Replace with your actual API call
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final data = await ApiService().getInvoices(
        auth.token ?? '',
        forceRefresh: false,
        vendeur: auth.isAdmin ? null : auth.username,
      );
      setState(() => _invoices = data ?? []);
    } catch (e) {
      // ignore errors for demo – you could show a snackbar
    } finally {
      if (mounted) setState(() => _loadingInvoices = false);
    }
  }

  Future<void> _fetchStocks() async {
    setState(() => _loadingStocks = true);
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final data = await ApiService().getStocks(token: auth.token);
      setState(() => _stocks = data ?? []);
    } catch (e) {
      // ignore errors for demo
    } finally {
      if (mounted) setState(() => _loadingStocks = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Widget _buildList(List<dynamic> items, bool loading) {
    if (loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (items.isEmpty) {
      return const Center(child: Text('Aucune donnée disponible'));
    }
    return ListView.separated(
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final item = items[index];
        // Assuming each item has an 'id' and a 'description' field – adapt as needed
        final title = item['reference'] ?? item['id']?.toString() ?? 'Item $index';
        final subtitle = item['designation'] ?? item['description'] ?? '';
        return ListTile(
          leading: const Icon(Icons.article_outlined),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text(subtitle),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Factures & Stocks'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.receipt_long), text: 'Factures'),
            Tab(icon: Icon(Icons.inventory), text: 'Stocks'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildList(_invoices, _loadingInvoices),
          _buildList(_stocks, _loadingStocks),
        ],
      ),
    );
  }
}
