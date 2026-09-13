import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../providers/dashboard_provider.dart';
import '../services/update_service.dart';
import 'package:package_info_plus/package_info_plus.dart';

// --- استيراد الشاشات ---
import 'login_screen.dart';
import 'clients_list_screen.dart';
import 'products_screen.dart';
import 'add_product_screen.dart';
import 'printer_screen.dart';
import 'invoices_list_screen.dart';
import 'deposits_screen.dart';
import 'expenses_screen.dart';
import 'cash_report_screen.dart';
import 'stock_adjustment_screen.dart';
import 'permissions_summary_screen.dart';
import 'stock_journal_screen.dart';
import 'users_management_screen.dart';
import 'suppliers_list_screen.dart';
import 'purchase_invoices_list_screen.dart';
import 'depot_management_screen.dart';
import 'activity_log_screen.dart';
import 'analyses_screen.dart';
import 'settings_screen.dart';
import 'loyers_list_screen.dart';
import 'rent_payments_list_screen.dart';
import 'ciment_list_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  final Color _primaryColor = const Color(0xFF2900DF);
  final Color _backgroundColor = const Color(0xFFF5F7FB);

  int _selectedIndex = 0;
  String _appVersion = "v1.0.0";

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(seconds: 1),
      vsync: this,
    );
    _controller.forward();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // 1. Check for updates (Smart & Fast)
      UpdateService.checkUpdate(context);
      
      // 2. Load app version for drawer
      final packageInfo = await PackageInfo.fromPlatform();
      setState(() {
        _appVersion = "v${packageInfo.version}";
      });

      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.token != null) {
        Provider.of<DashboardProvider>(context, listen: false).fetchDashboardData(
          auth.token!,
          vendeur: auth.isAdmin ? null : auth.username,
        );
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    final List<Widget> pages = [
      _HomeDashboardFragment(
        onRefresh: () async {
           await Provider.of<DashboardProvider>(context, listen: false).fetchDashboardData(
             authProvider.token!, 
             forceRefresh: true,
             vendeur: authProvider.isAdmin ? null : authProvider.username,
           );
        },
      ),
      const AnalysesScreen(),
      const SettingsScreen(),
    ];

    return Scaffold(
      extendBodyBehindAppBar: true,
      backgroundColor: Colors.transparent,
      appBar: _buildModernAppBar(authProvider),
      drawer: _buildAdministrationDrawer(context, authProvider),
      body: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              color: _backgroundColor,
              gradient: const LinearGradient(
                colors: [Colors.white, Color(0xFFF0F2F8)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: IndexedStack(
              index: _selectedIndex,
              children: pages,
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNavigationBar(),
    );
  }

  Widget _buildBottomNavigationBar() {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF13002D),
        border: Border(
          top: BorderSide(color: Colors.white10, width: 0.5),
        ),
      ),
      child: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() => _selectedIndex = index);
        },
        selectedItemColor: const Color(0xFFD500F9),
        unselectedItemColor: Colors.white.withAlpha(128),
        backgroundColor: const Color(0xFF13002D),
        elevation: 0,
        showUnselectedLabels: true,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Accueil'),
          BottomNavigationBarItem(icon: Icon(Icons.analytics), label: 'Analyses'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Paramètres'),
        ],
      ),
    );
  }

  Widget _buildAdministrationDrawer(BuildContext context, AuthProvider auth) {
    return Drawer(
      child: Column(
        children: [
          _buildDrawerHeader(auth),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildDrawerSectionTitle("Opérations Système"),
                if (auth.isAdmin || auth.canManageUsers) ...[
                  _buildDrawerItem(Icons.add_box_rounded, "Nouveau Produit", Colors.orange, () => _nav(context, AddProductScreen())),
                  _buildDrawerItem(Icons.store_rounded, "Gestion Dépôts", Colors.teal, () => _nav(context, const DepotManagementScreen())),
                ],
                if (auth.canManageUsers)
                  _buildDrawerItem(Icons.manage_accounts_rounded, "Utilisateurs", Colors.deepPurple, () => _nav(context, const UsersManagementScreen())),
                if (auth.isAdmin) ...[
                  _buildDrawerItem(Icons.lock_person_rounded, "Permissions", Colors.deepOrange, () => _nav(context, const PermissionsSummaryScreen())),
                  _buildDrawerItem(Icons.history_edu_rounded, "Journal d'Activité", Colors.blueGrey, () => _nav(context, const ActivityLogScreen())),
                ],
                _buildDrawerItem(Icons.home_work_rounded, "Gestion des Loyers", Colors.indigo, () => _nav(context, const LoyersListScreen())),
                _buildDrawerItem(Icons.receipt_long_rounded, "Paiements Loyers", Colors.blueGrey, () => _nav(context, const RentPaymentsListScreen())),
                _buildDrawerItem(Icons.local_shipping_rounded, "Gestion Ciment", Colors.indigo, () => _nav(context, const CimentListScreen())),
                const Divider(),
                _buildDrawerSectionTitle("Outils"),
                if (auth.canViewReports)
                  _buildDrawerItem(Icons.query_stats_rounded, "Rentabilité", Colors.green, () => _showProductProfitabilityDialog(context)),
                _buildDrawerItem(Icons.print_rounded, "Imprimante", Colors.black87, () => _nav(context, const PrinterScreen())),
                const SizedBox(height: 20),
                _buildDrawerItem(Icons.logout_rounded, "Déconnexion", Colors.redAccent, () => _logout(context, auth)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Text("GESTION PRO $_appVersion", style: const TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerHeader(AuthProvider auth) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF4A00E0), Color(0xFF8E2DE2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CircleAvatar(
                radius: 30,
                backgroundColor: Colors.white24,
                child: Icon(Icons.storefront_rounded, color: Colors.white, size: 34),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      auth.organizationName,
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        auth.currency,
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 15),
          Text(auth.username ?? "Utilisateur", style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          Text(auth.isAdmin ? "Administrateur" : "Collaborateur", style: const TextStyle(color: Colors.white70, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildDrawerSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(title.toUpperCase(), style: TextStyle(color: Colors.grey.shade500, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildDrawerItem(IconData icon, String label, Color color, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: color, size: 22),
      title: Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      trailing: const Icon(Icons.chevron_right, size: 18, color: Colors.grey),
      onTap: () {
        Navigator.pop(context);
        onTap();
      },
    );
  }

  void _logout(BuildContext context, AuthProvider auth) {
    auth.logout();
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => const LoginScreen()),
      (route) => false,
    );
  }

  PreferredSizeWidget _buildModernAppBar(AuthProvider auth) {
    String title = auth.organizationName;
    if (_selectedIndex == 1) title = "Analyses";
    if (_selectedIndex == 2) title = "Paramètres";

    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: true,
      title: Text(
        title.toUpperCase(),
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.2),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      flexibleSpace: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [Color(0xFF2900DF), Color(0xFF8600FF)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
      ),
      iconTheme: const IconThemeData(color: Colors.white),
      actions: [
        IconButton(
          icon: const Icon(Icons.power_settings_new_rounded, color: Colors.redAccent, size: 26),
          onPressed: () => _showLogoutConfirmation(context, auth),
        ),
        const SizedBox(width: 5),
      ],
    );
  }

  void _showLogoutConfirmation(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Déconnexion"),
        content: const Text("Voulez-vous vraiment quitter l'application ?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Annuler")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () { Navigator.pop(ctx); _logout(context, auth); },
            child: const Text("Déconnexion", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showProductProfitabilityDialog(BuildContext context) {
    showDialog(context: context, builder: (context) => const _ProductProfitabilityDialog());
  }

  void _nav(BuildContext context, Widget page) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => page));
  }
}

class _HomeDashboardFragment extends StatelessWidget {
  final Future<void> Function() onRefresh;

  const _HomeDashboardFragment({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final username = authProvider.username ?? "Admin";

    return Consumer<DashboardProvider>(
      builder: (context, dashboard, child) {
        return RefreshIndicator(
          onRefresh: onRefresh,
          child: SingleChildScrollView(
            padding: const EdgeInsets.only(top: 10),
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 10),
                _buildHeaderStats(username, authProvider.isAdmin, dashboard),
                const SizedBox(height: 20),
                _buildSectionTitle("Opérations Rapides", Icons.bolt_rounded),
                _buildQuickActionsGrid(context),
                const SizedBox(height: 20),
                _buildSectionTitle("Mouvements Financiers", Icons.account_balance_rounded),
                _buildFinanceButtons(context, authProvider),
                const SizedBox(height: 20),
                _buildSectionTitle("Gestion des Stocks", Icons.inventory_2_rounded),
                _buildStockButtons(context, authProvider),
                const SizedBox(height: 20),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeaderStats(String username, bool isAdmin, DashboardProvider dashboard) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF2900DF), Color(0xFF8600FF)],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2900DF).withAlpha(64),
            blurRadius: 15,
            offset: const Offset(0, 8),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Bienvenue,", style: TextStyle(color: Colors.white.withAlpha(216), fontSize: 14)),
                  const SizedBox(height: 4),
                  Text(
                    username.toLowerCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const Icon(Icons.person, color: Colors.white, size: 36),
            ],
          ),
          const SizedBox(height: 25),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildStatItem("Ventes Jour", "${dashboard.todaySales.toStringAsFixed(0)} F", Icons.trending_up, Colors.white),
              _buildStatItem("Articles", "${dashboard.totalArticles}", Icons.inventory, Colors.white),
              _buildStatItem("Clients", "${dashboard.totalClients}", Icons.group, Colors.white),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color.withAlpha(216), size: 14),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(color: color.withAlpha(200), fontSize: 11, fontWeight: FontWeight.w500),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: TextStyle(color: color, fontSize: 20, fontWeight: FontWeight.bold),
        ),
      ],
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF2900DF), size: 18),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF1F1F1F)),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionsGrid(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: _buildActionCard(
              context,
              "VENTE DIRECTE",
              Icons.add_shopping_cart,
              const Color(0xFF2900DF),
              () => _nav(context, const ProductsScreen()),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: _buildActionCard(
              context,
              "LISTE FACTURES",
              Icons.receipt_long,
              const Color(0xFFFFA726),
              () => _nav(context, const InvoicesListScreen()),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFinanceButtons(BuildContext context, AuthProvider auth) {
    final buttons = <Widget>[];
    if (auth.canAccessClients) {
      buttons.add(_buildCircleAction(context, "Clients", Icons.people, const Color(0xFF9C27B0), () => _nav(context, const ClientsListScreen())));
    }
    if (auth.isAdmin || auth.hasPermission('deposits.view')) {
      buttons.add(_buildCircleAction(context, "Dépôts", Icons.account_balance_wallet, const Color(0xFF009688), () => _nav(context, const DepositsScreen())));
    }
    if (auth.isAdmin || auth.hasPermission('expenses.view')) {
      buttons.add(_buildCircleAction(context, "Dépenses", Icons.trending_down, const Color(0xFFEF5350), () => _nav(context, const ExpensesScreen())));
    }
    if (auth.canAccessFinance) {
      buttons.add(_buildCircleAction(context, "Caisse", Icons.savings, const Color(0xFF4CAF50), () => _nav(context, const CashReportScreen())));
    }
    if (auth.isAdmin || auth.hasPermission('loyers.view')) {
      buttons.add(_buildCircleAction(context, "Loyers", Icons.home_rounded, const Color(0xFF3F51B5), () => _nav(context, const LoyersListScreen())));
    }

    if (buttons.isEmpty) return const SizedBox.shrink();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: buttons,
      ),
    );
  }

  Widget _buildStockButtons(BuildContext context, AuthProvider auth) {
    final buttons = <Widget>[];
    if (auth.canAdjustStock) {
      buttons.add(_buildCircleAction(context, "Mouvement", Icons.swap_horiz, const Color(0xFF3F51B5), () => _nav(context, const StockAdjustmentScreen())));
    }
    if (auth.canAccessInventory) {
      buttons.add(_buildCircleAction(context, "Journal", Icons.history, const Color(0xFF795548), () => _nav(context, const StockJournalScreen())));
    }
    if (auth.canAccessPurchases) {
      buttons.add(_buildCircleAction(context, "Achats", Icons.shopping_bag, const Color(0xFF4E342E), () => _nav(context, const PurchaseInvoicesListScreen())));
      buttons.add(_buildCircleAction(context, "Fournisseur", Icons.local_shipping, const Color(0xFFFF9800), () => _nav(context, const SuppliersListScreen())));
    }
    if (auth.isAdmin || auth.hasPermission('ciment.view')) {
      buttons.add(_buildCircleAction(context, "Ciment", Icons.local_shipping_rounded, const Color(0xFF3F51B5), () => _nav(context, const CimentListScreen())));
    }

    if (buttons.isEmpty) return const SizedBox.shrink();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: buttons,
      ),
    );
  }

  Widget _buildActionCard(BuildContext context, String title, IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        height: 115,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(color: color.withAlpha(64), blurRadius: 10, offset: const Offset(0, 4)),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: Colors.white, size: 36),
            const SizedBox(height: 12),
            Text(
              title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13, letterSpacing: 0.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCircleAction(BuildContext context, String label, IconData icon, Color color, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: SizedBox(
        width: 68,
        child: InkWell(
          onTap: onTap,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 60,
                width: 60,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(color: color.withAlpha(64), blurRadius: 8, offset: const Offset(0, 4)),
                  ],
                ),
                child: Icon(icon, color: Colors.white, size: 26),
              ),
              const SizedBox(height: 8),
              Text(
                label,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF333333)),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _nav(BuildContext context, Widget page) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => page));
  }
}


class _ProductProfitabilityDialog extends StatefulWidget {
  const _ProductProfitabilityDialog();

  @override
  State<_ProductProfitabilityDialog> createState() => _ProductProfitabilityDialogState();
}

class _ProductProfitabilityDialogState extends State<_ProductProfitabilityDialog> {
  final ApiService _apiService = ApiService(); // Added ApiService instance
  List<dynamic> _allProducts = [];
  List<dynamic> _filteredProducts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProducts();
  }

  Future<void> _loadProducts() async {
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final products = await _apiService.getArticles(auth.token!); // Use local instance
      if (mounted) setState(() { _allProducts = products; _filteredProducts = products; _isLoading = false; });
    } catch (_) { if (mounted) setState(() => _isLoading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
       shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
       child: Container(
         height: 500, padding: const EdgeInsets.all(16),
         child: Column(
            children: [
              const Text("Rentabilité par Produit", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              Expanded(
                child: _isLoading ? const Center(child: CircularProgressIndicator())
                   : ListView.builder(
                       itemCount: _filteredProducts.length,
                       itemBuilder: (context, index) {
                         final p = _filteredProducts[index];
                         final double margin = (p['prix_vente'] ?? 0).toDouble() - (p['prix_achat'] ?? 0).toDouble();
                         return ListTile(
                           title: Text(p['nom'] ?? 'Sans nom', style: const TextStyle(fontWeight: FontWeight.bold)),
                           trailing: Text("${margin.toStringAsFixed(0)} F", style: TextStyle(color: margin >= 0 ? Colors.green : Colors.red, fontWeight: FontWeight.bold)),
                         );
                       },
                     ),
              ),
              TextButton(onPressed: () => Navigator.pop(context), child: const Text("Fermer"))
            ],
         ),
       ),
    );
  }
}
