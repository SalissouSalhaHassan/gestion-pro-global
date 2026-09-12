import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/dashboard/sales_chart_widget.dart';
import '../widgets/dashboard/top_clients_pie_chart.dart';
import '../widgets/dashboard/sales_vs_expenses_line_chart.dart';
import '../widgets/dashboard/top_products_widget.dart';
import '../widgets/dashboard/low_stock_widget.dart';
import 'cash_report_screen.dart';
import 'invoices_list_screen.dart';
import 'clients_list_screen.dart';
import 'articles_list_screen.dart';
import 'stock_adjustment_screen.dart';

class AnalysesScreen extends StatefulWidget {
  const AnalysesScreen({super.key});

  @override
  State<AnalysesScreen> createState() => _AnalysesScreenState();
}

class _AnalysesScreenState extends State<AnalysesScreen> {
  final Color _accentColor = const Color(0xFF8E2DE2);
  final Color _primaryColor = const Color(0xFF4A00E0);
  final _numberFormat = NumberFormat("#,##0", "fr_FR");

  void _openScreen(Widget screen) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => screen),
    );
  }

  void _showHealthInfo() {
    showModalBottomSheet(
      context: context,
      backgroundColor: _primaryColor,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Container(
        padding: const EdgeInsets.all(25),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text("Analyse de Sant?", style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            Text(
              "Ce score est calcul? en fonction de la croissance de vos ventes hebdomadaires et de l'?tat de votre stock.",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withOpacity(0.8)),
            ),
            const SizedBox(height: 30),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: _accentColor),
              onPressed: () => Navigator.pop(context),
              child: const Text("Compris", style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );
  }


  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // 1. Background Gradient
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_primaryColor, _accentColor.withOpacity(0.8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
          
          // 2. Dashboard Content
          Consumer<DashboardProvider>(
            builder: (context, dashboard, child) {
              if (dashboard.isLoading && dashboard.weeklySales.isEmpty) {
                return const Center(child: CircularProgressIndicator(color: Colors.white));
              }

              return RefreshIndicator(
                onRefresh: () async {
                  if (authProvider.token != null) {
                    await dashboard.fetchDashboardData(
                      authProvider.token!, 
                      forceRefresh: true,
                      vendeur: authProvider.isAdmin ? null : authProvider.username,
                    );
                  }
                },
                displacement: 100,
                color: _primaryColor,
                child: CustomScrollView(
                  physics: const BouncingScrollPhysics(),
                  slivers: [
                    _buildSliverAppBar(),
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildHealthIndicator(dashboard),
                            const SizedBox(height: 25),
                            
                            _buildQuickStats(dashboard),
                            const SizedBox(height: 25),
                            
                            _buildSectionTitle("Performance Hebdomadaire"),
                            const SizedBox(height: 15),
                            _buildGlassCard(
                              child: SalesChartWidget(weeklySales: dashboard.weeklySales),
                              height: 250,
                              onTap: () => _openScreen(const CashReportScreen()),
                              ignoreChildPointer: true,
                            ),
                            
                            const SizedBox(height: 30),
                            _buildSectionTitle("Revenus vs Dépenses"),
                            const SizedBox(height: 15),
                            _buildGlassCard(
                              child: SalesVsExpensesLineChart(data: dashboard.salesVsExpenses),
                              height: 250,
                              onTap: () => _openScreen(const CashReportScreen()),
                              ignoreChildPointer: true,
                            ),
                            
                            const SizedBox(height: 30),
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      _buildSectionTitle("Clients"),
                                      const SizedBox(height: 15),
                                      _buildGlassCard(
                                        child: TopClientsPieChart(topClients: dashboard.topClients),
                                        height: 200,
                                        onTap: () => _openScreen(const ClientsListScreen()),
                                        ignoreChildPointer: true,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            
                            const SizedBox(height: 30),
                            _buildSectionTitle("Meilleurs Produits"),
                            const SizedBox(height: 15),
                            _buildGlassCard(
                              child: TopProductsWidget(products: dashboard.topProducts),
                              onTap: () => _openScreen(const ArticlesListScreen()),
                              ignoreChildPointer: true,
                            ),

                            const SizedBox(height: 30),
                            _buildSectionTitle("Alertes Stock"),
                            const SizedBox(height: 15),
                            _buildGlassCard(
                              child: LowStockWidget(lowStockItems: dashboard.lowStock),
                              color: Colors.red.withOpacity(0.1),
                              onTap: () => _openScreen(const StockAdjustmentScreen()),
                              ignoreChildPointer: true,
                            ),
                            
                            const SizedBox(height: 100),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 120.0,
      floating: true,
      pinned: true,
      backgroundColor: Colors.transparent,
      elevation: 0,
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.only(left: 20, bottom: 16),
        centerTitle: false,
        title: const Text(
          "Analyses & Insights",
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 20,
          ),
        ),
        background: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
            child: Container(color: Colors.white.withOpacity(0.05)),
          ),
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.calendar_month_rounded, color: Colors.white),
          onPressed: () {
            showDateRangePicker(
              context: context,
              firstDate: DateTime(2020),
              lastDate: DateTime.now(),
              builder: (context, child) {
                return Theme(
                  data: Theme.of(context).copyWith(
                    colorScheme: ColorScheme.dark(
                      primary: _accentColor,
                      onPrimary: Colors.white,
                      surface: _primaryColor,
                      onSurface: Colors.white,
                    ),
                  ),
                  child: child!,
                );
              },
            );
          },
        ),
      ],
    );
  }


  Widget _buildQuickStats(DashboardProvider dashboard) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          _buildStatTile(
            "Ventes Aujourd'hui",
            "${_numberFormat.format(dashboard.salesToday)} F",
            Icons.trending_up,
            Colors.greenAccent,
            subtitle: dashboard.salesGrowth != 0 
              ? "${dashboard.salesGrowth > 0 ? '+' : ''}${dashboard.salesGrowth.toStringAsFixed(1)}% vs hier"
              : null,
            onTap: () => _openScreen(const InvoicesListScreen()),
          ),
          const SizedBox(width: 15),
          _buildStatTile(
            "Total Clients",
            dashboard.totalClients.toString(),
            Icons.people_outline,
            Colors.blueAccent,
            onTap: () => _openScreen(const ClientsListScreen()),
          ),
          const SizedBox(width: 15),
          _buildStatTile(
            "Articles en Stock",
            dashboard.totalArticles.toString(),
            Icons.inventory_2_outlined,
            Colors.orangeAccent,
            onTap: () => _openScreen(const ArticlesListScreen()),
          ),
        ],
      ),
    );
  }

  Widget _buildStatTile(String label, String value, IconData icon, Color color, {String? subtitle, VoidCallback? onTap}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              width: 160,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white.withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(icon, color: color, size: 28),
                  const SizedBox(height: 15),
                  Text(
                    value,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    label,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                      fontSize: 12,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 5),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: subtitle.contains('+') ? Colors.greenAccent : Colors.redAccent,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHealthIndicator(DashboardProvider dashboard) {
    final score = dashboard.healthScore;
    Color healthColor = Colors.greenAccent;
    String status = "Excellent";
    IconData icon = Icons.check_circle_outline;

    if (score < 40) {
      healthColor = Colors.redAccent;
      status = "Critique";
      icon = Icons.error_outline;
    } else if (score < 70) {
      healthColor = Colors.orangeAccent;
      status = "Am?lioration requise";
      icon = Icons.warning_amber_rounded;
    }

    return _buildGlassCard(
      child: Row(
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 60,
                height: 60,
                child: CircularProgressIndicator(
                  value: score / 100,
                  backgroundColor: Colors.white.withOpacity(0.1),
                  color: healthColor,
                  strokeWidth: 6,
                ),
              ),
              Text(
                "${score.toInt()}",
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ],
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Sant? de l'entreprise",
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(icon, color: healthColor, size: 14),
                    const SizedBox(width: 5),
                    Text(
                      status,
                      style: TextStyle(color: healthColor, fontWeight: FontWeight.w600, fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.info_outline, color: Colors.white54, size: 20),
            onPressed: _showHealthInfo,
          ),
        ],
      ),
      onTap: _showHealthInfo,
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w800,
        color: Colors.white,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildGlassCard({
    required Widget child,
    double? height,
    Color? color,
    VoidCallback? onTap,
    bool ignoreChildPointer = false,
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(25),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(25),
            child: Container(
              width: double.infinity,
              height: height,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: color ?? Colors.white.withOpacity(0.1),
                borderRadius: BorderRadius.circular(25),
                border: Border.all(color: Colors.white.withOpacity(0.15)),
              ),
              child: IgnorePointer(
                ignoring: ignoreChildPointer,
                child: child,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
