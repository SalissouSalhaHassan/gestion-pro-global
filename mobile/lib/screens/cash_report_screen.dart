import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../models/company_model.dart';
import 'package:intl/intl.dart';
import '../utils/pdf_daily_report_generator.dart';
import 'pdf_preview_screen.dart';
import '../services/excel_export_service.dart';
import '../widgets/dashboard/sales_vs_expenses_line_chart.dart';
import '../widgets/dashboard/top_clients_pie_chart.dart';

class CashReportScreen extends StatefulWidget {
  const CashReportScreen({super.key});

  @override
  State<CashReportScreen> createState() => _CashReportScreenState();
}

class _CashReportScreenState extends State<CashReportScreen> {
  Map<String, dynamic>? _report;
  bool _isLoading = false;
  String? _errorMessage; // متغير جديد لحفظ رسالة الخطأ
  DateTime _selectedDate = DateTime.now();
  final NumberFormat _fmt = NumberFormat("#,##0", "fr_FR");
  String _mode = "daily";
  String _selectedVendeur = "Tous";
  List<String> _vendeurs = [];
  bool _loadingVendeurs = false;
  List<Map<String, dynamic>> _chartSeries = [];
  List<Map<String, dynamic>> _topClients = [];
  double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }

  @override
  void initState() {
    super.initState();
    _fetchReport();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.isAdmin) {
        _loadVendeurs();
      }
    });
  }

  Future<void> _fetchReport() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null; // تصفير الخطأ عند بدء التحميل
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final token = auth.token;
    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final String? vendeurFilter = auth.isAdmin
        ? (_selectedVendeur == "Tous" ? null : _selectedVendeur)
        : auth.username;

    try {
      if (_mode == "daily") {
        final data = await ApiService().getCashReport(token!, date: dateStr, vendeur: vendeurFilter);
        setState(() {
          _report = data;
          _chartSeries = [
            {
              "date": DateFormat('dd/MM').format(_selectedDate),
              "sales": _toDouble(data['total_recettes']),
              "expenses": _toDouble(data['total_depenses']),
            },
          ];
          _topClients = _computeTopClients(
            List<Map<String, dynamic>>.from(data['recettes_list'] ?? []),
          );
        });
      } else if (_mode == "weekly") {
        final startOfWeek = _selectedDate.subtract(
          Duration(days: _selectedDate.weekday - 1),
        );
        final endOfWeek = startOfWeek.add(const Duration(days: 6));
        final data = await ApiService().getCashReportRange(
          token!,
          startDate: DateFormat('yyyy-MM-dd').format(startOfWeek),
          endDate: DateFormat('yyyy-MM-dd').format(endOfWeek),
          vendeur: vendeurFilter,
        );
        setState(() {
          _report = data['summary'];
          _chartSeries = List<Map<String, dynamic>>.from(data['series'] ?? []);
          _topClients = _computeTopClients(
            List<Map<String, dynamic>>.from(data['summary']['recettes_list'] ?? []),
          );
        });
      } else {
        // Monthly: fetch entire month at once
        final startOfMonth = DateTime(_selectedDate.year, _selectedDate.month, 1);
        final endOfMonth = DateTime(_selectedDate.year, _selectedDate.month + 1, 0);
        final data = await ApiService().getCashReportRange(
          token!,
          startDate: DateFormat('yyyy-MM-dd').format(startOfMonth),
          endDate: DateFormat('yyyy-MM-dd').format(endOfMonth),
          vendeur: vendeurFilter,
        );
        setState(() {
          _report = data['summary'];
          _chartSeries = List<Map<String, dynamic>>.from(data['series'] ?? []);
          _topClients = _computeTopClients(
            List<Map<String, dynamic>>.from(data['summary']['recettes_list'] ?? []),
          );
        });
      }

    } catch (e) {
      setState(() {
        _errorMessage = e.toString();
        // إذا كان الخطأ يحتوي على 401، نوضح الرسالة
        if (e.toString().contains("401") ||
            e.toString().contains("Unauthorized")) {
          _errorMessage = "Session expirée. Veuillez vous reconnecter.";
        }
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadVendeurs() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.isAdmin || auth.token == null) return;
    setState(() => _loadingVendeurs = true);
    try {
      final users = await ApiService().getUsers(auth.token!);
      final names = <String>{};
      for (final u in users) {
        final adminVal = u['admin']?.toString().toLowerCase();
        final isAdminUser = adminVal == 'oui' || adminVal == 'admin' || adminVal == 'administrateur';
        if (isAdminUser) continue;
        final username = u['utilisateur']?.toString().trim();
        if (username != null && username.isNotEmpty) {
          names.add(username);
        }
      }
      final list = names.toList()..sort();
      setState(() {
        _vendeurs = list;
        if (_selectedVendeur != "Tous" && !_vendeurs.contains(_selectedVendeur)) {
          _selectedVendeur = "Tous";
        }
      });
    } catch (_) {
      // Ignore vendor load errors; filter will remain disabled
    } finally {
      if (mounted) {
        setState(() => _loadingVendeurs = false);
      }
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      locale: const Locale("fr", "FR"), // لمحاولة جعل التقويم فرنسي
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _fetchReport();
    }
  }

  Future<void> _printReport() async {
    if (_report == null) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final companyMap = await ApiService().getCompanyInfo(auth.token!);
    final company = CompanyInfo.fromJson(companyMap);
    final String cashier = auth.isAdmin
        ? (_selectedVendeur == "Tous" ? "Tous" : _selectedVendeur)
        : (auth.username ?? "Vendeur");

    if (!mounted) return;

    final DateTime startDate;
    final DateTime endDate;
    if (_mode == "daily") {
      startDate = _selectedDate;
      endDate = _selectedDate;
    } else if (_mode == "weekly") {
      startDate = _selectedDate.subtract(Duration(days: _selectedDate.weekday - 1));
      endDate = startDate.add(const Duration(days: 6));
    } else {
      startDate = DateTime(_selectedDate.year, _selectedDate.month, 1);
      endDate = DateTime(_selectedDate.year, _selectedDate.month + 1, 0);
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PdfPreviewScreen(
          invoiceRef: _mode == "daily"
              ? "BILAN-${DateFormat('ddMM').format(_selectedDate)}"
              : _mode == "weekly"
              ? "BILAN-S-${DateFormat('ddMM').format(_selectedDate)}"
              : "BILAN-M-${DateFormat('MM').format(_selectedDate)}",
          buildPdf: (format) async {
            return PdfDailyReportGenerator.generateReport(
              company: company,
              date: _selectedDate,
              startDate: startDate,
              endDate: endDate,
              solde: _toDouble(_report?['solde']),
              totalRecettes: _toDouble(_report?['total_recettes']),
              totalDepenses: _toDouble(_report?['total_depenses']),
              recettes: List<Map<String, dynamic>>.from(
                _report!['recettes_list'] ?? [],
              ),
              depenses: List<Map<String, dynamic>>.from(
                _report!['depenses_list'] ?? [],
              ),
              generatedBy: auth.username ?? "Admin",
              cashier: cashier,
              pageFormat: format,
            );
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F9),
      appBar: AppBar(
        title: const Text("Bilan", style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.5)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        foregroundColor: Colors.white,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4A00E0), Color(0xFF8E2DE2)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        actions: [
          if (_report != null)
            IconButton(
              icon: const Icon(Icons.print_rounded),
              tooltip: "Imprimer",
              onPressed: _printReport,
            ),
          if (_report != null)
            IconButton(
              icon: const Icon(Icons.file_download_rounded),
              tooltip: "Exporter Excel",
              onPressed: () async {
                await ExcelExportService.exportCashReport(
                  _report!,
                  context,
                  title: _mode == "daily"
                      ? "Journalier"
                      : _mode == "weekly"
                      ? "Hebdomadaire"
                      : "Mensuel",
                );
              },
            ),
          IconButton(
            icon: const Icon(Icons.calendar_month_rounded),
            onPressed: _pickDate,
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    // 1. حالة التحميل
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF4A00E0)),
      );
    }

    // 2. حالة الخطأ (مثل 401 أو انقطاع النت)
    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 60,
                color: Colors.redAccent,
              ),
              const SizedBox(height: 10),
              Text(
                "Erreur de chargement",
                style: TextStyle(
                  color: Colors.grey[800],
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: _fetchReport,
                icon: const Icon(Icons.refresh),
                label: const Text("Réessayer"),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4A00E0),
                  foregroundColor: Colors.white,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // 3. حالة عدم وجود بيانات (نادر الحدوث مع هيكلية البيانات الحالية لكن للاحتياط)
    if (_report == null) {
      return const Center(child: Text("Aucune donnée disponible"));
    }

    // 4. حالة عرض البيانات بنجاح
    return SingleChildScrollView(
      padding: const EdgeInsets.all(15),
      child: Column(
        children: [
          Row(
            children: [
              ChoiceChip(
                label: const Text("Journalier"),
                selected: _mode == "daily",
                onSelected: (_) {
                  setState(() => _mode = "daily");
                  _fetchReport();
                },
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text("Hebdomadaire"),
                selected: _mode == "weekly",
                onSelected: (_) {
                  setState(() => _mode = "weekly");
                  _fetchReport();
                },
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text("Mensuel"),
                selected: _mode == "monthly",
                onSelected: (_) {
                  setState(() => _mode = "monthly");
                  _fetchReport();
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
          // التاريخ المختار
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.today, size: 18, color: Colors.grey),
                const SizedBox(width: 8),
                Text(
                  DateFormat('EEEE d MMMM yyyy').format(_selectedDate),
                  style: TextStyle(
                    color: Colors.grey[800],
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          if (auth.isAdmin) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Row(
                children: [
                  const Icon(Icons.person, size: 18, color: Colors.grey),
                  const SizedBox(width: 8),
                  Expanded(
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        isExpanded: true,
                        value: _selectedVendeur,
                        items: [
                          const DropdownMenuItem(
                            value: "Tous",
                            child: Text("Tous les vendeurs"),
                          ),
                          ..._vendeurs.map(
                            (v) => DropdownMenuItem(
                              value: v,
                              child: Text(v),
                            ),
                          ),
                        ],
                        onChanged: _loadingVendeurs
                            ? null
                            : (val) {
                                if (val == null) return;
                                setState(() => _selectedVendeur = val);
                                _fetchReport();
                              },
                      ),
                    ),
                  ),
                  if (_loadingVendeurs)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // البطاقة الرئيسية (الرصيد)
          _buildSummaryCard(
            "SOLDE CAISSE",
            _toDouble(_report?['solde']),
            const Color(0xFF4A00E0),
          ),
          const SizedBox(height: 15),

          Row(
            children: [
              Expanded(
                child: _buildSummaryCard(
                  "TOTAL ENTRÉES",
                  _toDouble(_report?['total_recettes']),
                  Colors.green,
                  isSmall: true,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildSummaryCard(
                  "TOTAL SORTIES",
                  _toDouble(_report?['total_depenses']),
                  Colors.red,
                  isSmall: true,
                ),
              ),
            ],
          ),

          const SizedBox(height: 25),
          if (_chartSeries.isNotEmpty) ...[
            const Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: EdgeInsets.only(left: 5, bottom: 10),
                child: Text(
                  "Évolution Entrées vs Sorties",
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF1A004D)),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2A0845), Color(0xFF6441A5)], // "Deep Space" Purple
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF6441A5).withOpacity(0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
                border: Border.all(color: Colors.white.withOpacity(0.1), width: 1),
              ),
              child: SalesVsExpensesLineChart(data: _chartSeries),
            ),
            const SizedBox(height: 30),
          ],
          if (_topClients.isNotEmpty) ...[
            const Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: EdgeInsets.only(left: 5, bottom: 10),
                child: Text(
                  "Top Clients",
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF1A004D)),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2A0845), Color(0xFF6441A5)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF6441A5).withOpacity(0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
                border: Border.all(color: Colors.white.withOpacity(0.1), width: 1),
              ),
              child: SizedBox(
                height: 250,
                child: TopClientsPieChart(topClients: _topClients),
              ),
            ),
            const SizedBox(height: 30),
          ],
          const Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: EdgeInsets.only(left: 5, bottom: 10),
              child: Text(
                "Détails des Opérations",
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF1A004D)),
              ),
            ),
          ),
          const SizedBox(height: 10),

          // قائمة العمليات
          ..._buildTransactionsList(),

          const SizedBox(height: 30), // مسافة في الأسفل
        ],
      ),
    );
  }

  Widget _buildSummaryCard(
    String title,
    double amount,
    Color color, {
    bool isSmall = false,
  }) {
    // Determine gradient based on color type
    final List<Color> gradientColors;
    if (color == const Color(0xFF4A00E0)) {
      gradientColors = [const Color(0xFF4A00E0), const Color(0xFF8E2DE2)];
    } else if (color == Colors.green) {
      gradientColors = [const Color(0xFF00B09B), const Color(0xFF96C93D)];
    } else {
      gradientColors = [const Color(0xFFFF416C), const Color(0xFFFF4B2B)];
    }

    return Container(
      padding: EdgeInsets.all(isSmall ? 18 : 25),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: gradientColors.last.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            title,
            style: TextStyle(
              color: Colors.white.withOpacity(0.9),
              fontSize: isSmall ? 11 : 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              "${_fmt.format(amount)} FCFA",
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: isSmall ? 20 : 32,
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _computeTopClients(
    List<Map<String, dynamic>> recettes,
  ) {
    final Map<String, double> sums = {};
    for (final r in recettes) {
      final client = (r['client'] ?? '').toString();
      final montant = _toDouble(r['montant']);
      if (montant <= 0) continue;
      sums[client] = (sums[client] ?? 0.0) + montant;
    }
    final entries = sums.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));
    final top = entries
        .take(5)
        .map((e) => {"name": e.key, "total": e.value})
        .toList();
    return top;
  }

  List<Widget> _buildTransactionsList() {
    List<Widget> list = [];

    // إضافة الإيرادات (Recettes)
    if (_report!['recettes_list'] != null) {
      for (var item in _report!['recettes_list']) {
        String subtitle = item['type'] ?? "Opération";
        if (item['info'] != null) {
          subtitle += " (${item['info']})";
        }
        
        list.add(
          _buildTransTile(
            title: item['client'] ?? "Client Inconnu",
            subtitle: subtitle,
            amount: _toDouble(item['montant']),
            isIncome: _toDouble(item['montant']) >= 0,
          ),
        );
      }
    }

    // إضافة المصاريف (Dépenses)
    if (_report!['depenses_list'] != null) {
      for (var item in _report!['depenses_list']) {
        list.add(
          _buildTransTile(
            title: item['libelle'] ?? "Dépense",
            subtitle: "Dépense - ${item['operateur'] ?? ''}",
            amount: _toDouble(item['montant']),
            isIncome: false,
          ),
        );
      }
    }

    if (list.isEmpty) {
      list.add(
        Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            children: [
              Icon(Icons.inbox, size: 50, color: Colors.grey[300]),
              const SizedBox(height: 10),
              Text(
                "Aucune opération aujourd'hui",
                style: TextStyle(color: Colors.grey[500]),
              ),
            ],
          ),
        ),
      );
    }

    return list;
  }

  Widget _buildTransTile({
    required String title,
    required String subtitle,
    required double amount,
    required bool isIncome,
  }) {
    return Card(
      elevation: 2,
      shadowColor: Colors.black12,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 15, vertical: 5),
        leading: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: (isIncome ? Colors.green : Colors.red).withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(
            isIncome ? Icons.arrow_downward : Icons.arrow_upward,
            color: isIncome ? Colors.green : Colors.red,
            size: 20,
          ),
        ),
        title: Text(
          title,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
        ),
        subtitle: Text(
          subtitle,
          style: TextStyle(color: Colors.grey[600], fontSize: 13),
        ),
        trailing: Text(
          "${isIncome ? '+' : '-'}${_fmt.format(amount)}",
          style: TextStyle(
            color: isIncome ? Colors.green : Colors.red,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ),
    );
  }
}
