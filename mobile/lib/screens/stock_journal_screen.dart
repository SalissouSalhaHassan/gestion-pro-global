import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../models/stock_movement_model.dart';

class StockJournalScreen extends StatefulWidget {
  const StockJournalScreen({super.key});

  @override
  State<StockJournalScreen> createState() => _StockJournalScreenState();
}

class _StockJournalScreenState extends State<StockJournalScreen> {
  final ApiService _apiService = ApiService();
  
  List<StockMovement> _movements = [];
  bool _isLoading = false;
  
  DateTime? _startDate;
  DateTime? _endDate;
  String _selectedDepot = "Tous";
  List<String> _depots = ["Tous"];
  final TextEditingController _searchCtrl = TextEditingController();

  final Color primaryColor = const Color(0xFF8F00FF);

  @override
  void initState() {
    super.initState();
    _endDate = DateTime.now();
    _startDate = DateTime.now().subtract(const Duration(days: 30));
    
    _loadDepots();
    _fetchMovements();
  }

  Future<void> _loadDepots() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final depotsData = await _apiService.getDepotsDetailed(auth.token!);
      if (mounted) {
        setState(() {
          final names = depotsData.map((d) => d['nom'].toString()).toList();
          if (auth.isAdmin) {
            _depots = ["Tous", ...names];
            if (!_depots.contains(_selectedDepot)) _selectedDepot = "Tous";
          } else {
            _depots = names;
            if (_depots.isNotEmpty) {
              if (!_depots.contains(_selectedDepot) || _selectedDepot == "Tous") {
                _selectedDepot = _depots.first;
              }
            } else {
              _selectedDepot = "";
            }
          }
        });
      }
    } catch (e) {
      debugPrint("Error loading depots: $e");
    }
  }

  Future<void> _fetchMovements() async {
    setState(() => _isLoading = true);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    
    try {
      final data = await _apiService.getStockMovements(
        token: auth.token!,
        startDate: _startDate != null ? DateFormat('yyyy-MM-dd').format(_startDate!) : null,
        endDate: _endDate != null ? DateFormat('yyyy-MM-dd').format(_endDate!) : null,
        depot: _selectedDepot.isEmpty ? null : _selectedDepot,
        search: _searchCtrl.text,
      );
      
      if (mounted) {
        setState(() {
          _movements = data.map((item) => StockMovement.fromJson(item)).toList();
          _isLoading = false;
        });
      }

    } catch (e) {
      debugPrint("Error fetching stock movements: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text("Journal de Stock", style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchMovements,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterBar(),
          Expanded(
            child: _isLoading 
              ? Center(child: CircularProgressIndicator(color: primaryColor))
              : _movements.isEmpty 
                ? _buildEmptyState()
                : _buildDataTable(),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: primaryColor,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: Column(
        children: [
          TextField(
            controller: _searchCtrl,
            style: const TextStyle(color: Colors.black),
            decoration: InputDecoration(
              hintText: "Réf, Article, Doc ou Tiers...",
              prefixIcon: IconButton(
                icon: const Icon(Icons.search, color: Colors.grey),
                onPressed: _fetchMovements,
              ),
              suffixIcon: _searchCtrl.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, color: Colors.grey),
                      onPressed: () {
                        _searchCtrl.clear();
                        _fetchMovements();
                      },
                    )
                  : null,
              filled: true,
              fillColor: Colors.white,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
            onSubmitted: (_) => _fetchMovements(),
            onChanged: (_) {
              setState(() {});
            },
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: _pickDateRange,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.white.withOpacity(0.3)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.calendar_today, size: 16, color: Colors.white),
                        const SizedBox(width: 8),
                        Text(
                          _startDate == null ? "Toutes dates" : "${DateFormat('dd/MM').format(_startDate!)} - ${DateFormat('dd/MM').format(_endDate!)}",
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 1,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withOpacity(0.3)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: _depots.isEmpty ? null : _selectedDepot,
                      dropdownColor: primaryColor,
                      icon: const Icon(Icons.arrow_drop_down, color: Colors.white),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      hint: const Text("Aucun dépôt", style: TextStyle(color: Colors.white70, fontSize: 13)),
                      items: _depots.map((d) => DropdownMenuItem(value: d, child: Text(d))).toList(),
                      onChanged: _depots.isEmpty ? null : (val) {
                        setState(() => _selectedDepot = val!);
                        _fetchMovements();
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _pickDateRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      initialDateRange: (_startDate != null && _endDate != null)
          ? DateTimeRange(start: _startDate!, end: _endDate!)
          : null,
      builder: (context, child) {
        return Theme(
          data: ThemeData.light().copyWith(
            colorScheme: ColorScheme.light(
              primary: primaryColor,
              onPrimary: Colors.white,
              onSurface: Colors.black,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _startDate = picked.start;
        _endDate = picked.end;
      });
      _fetchMovements();
    }
  }

  Widget _buildDataTable() {
    return SingleChildScrollView(
      scrollDirection: Axis.vertical,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columnSpacing: 20,
          headingRowHeight: 45,
          headingRowColor: WidgetStateProperty.all(primaryColor.withOpacity(0.05)),
          horizontalMargin: 15,
          columns: const [
            DataColumn(label: Text("Date", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Article", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Désignation", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Opération", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("N° Doc", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Tiers", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Dépôt", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Responsable", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Stock Avant", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Mouvement", style: TextStyle(fontWeight: FontWeight.bold))),
            DataColumn(label: Text("Stock Après", style: TextStyle(fontWeight: FontWeight.bold))),
          ],
          rows: _movements.map((m) => _buildRow(m)).toList(),
        ),
      ),
    );
  }

  String _formatDate(String raw) {
    if (raw.trim().isEmpty) return "-";
    final dt = DateTime.tryParse(raw);
    if (dt != null) {
      return DateFormat('dd/MM/yyyy').format(dt);
    }
    return raw;
  }

  DataRow _buildRow(StockMovement m) {
    Color mvColor = Colors.grey;
    if (m.mouvement > 0) mvColor = Colors.green;
    if (m.mouvement < 0) mvColor = Colors.red;

    return DataRow(cells: [
      DataCell(Text(_formatDate(m.date))),
      DataCell(Text(m.codeArticle, style: const TextStyle(fontSize: 12))),
      DataCell(SizedBox(width: 150, child: Text(m.designation, maxLines: 1, overflow: TextOverflow.ellipsis))),
      DataCell(Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: _getOpColor(m.operation).withOpacity(0.1),
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: _getOpColor(m.operation).withOpacity(0.2)),
        ),
        child: Text(m.operation, style: TextStyle(color: _getOpColor(m.operation), fontSize: 11, fontWeight: FontWeight.bold)),
      )),
      DataCell(Text(m.noDoc)),
      DataCell(SizedBox(width: 100, child: Text(m.tiers, overflow: TextOverflow.ellipsis))),
      DataCell(Text(m.depot)),
      DataCell(Text(m.responsable)),
      DataCell(Text(m.stockAvant.toStringAsFixed(2))),
      DataCell(Text(
        (m.mouvement >= 0 ? "+" : "") + m.mouvement.toStringAsFixed(2),
        style: TextStyle(color: mvColor, fontWeight: FontWeight.bold),
      )),
      DataCell(Text(m.stockApres.toStringAsFixed(2), style: const TextStyle(fontWeight: FontWeight.bold))),
    ]);
  }

  Color _getOpColor(String type) {
    switch (type.toUpperCase()) {
      case 'ACHAT': return Colors.blue;
      case 'VENTE': return Colors.green;
      case 'TRANSFERT': return Colors.orange;
      case 'SORTIE': return Colors.red;
      case 'ENTREE': return Colors.teal;
      default: return Colors.grey;
    }
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.history, size: 80, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text("Aucun mouvement trouvé", style: TextStyle(color: Colors.grey[600], fontSize: 16)),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _fetchMovements,
            child: Text("Réessayer", style: TextStyle(color: primaryColor)),
          )
        ],
      ),
    );
  }
}
