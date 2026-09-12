import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../models/company_model.dart';
import '../providers/auth_provider.dart';
import '../utils/pdf_stock_report_generator.dart';
import '../utils/pdf_stock_movement_generator.dart';
import '../utils/pdf_movement_list_generator.dart';
import '../screens/pdf_preview_screen.dart';
import '../models/article_model.dart';

class StockAdjustmentScreen extends StatefulWidget {
  const StockAdjustmentScreen({super.key});

  @override
  State<StockAdjustmentScreen> createState() => _StockAdjustmentScreenState();
}

class _StockAdjustmentScreenState extends State<StockAdjustmentScreen> {
  final Color _backgroundColor = const Color(0xFF1E212B);
  final Color _cardColor = const Color(0xFF2B2D30);
  final Color _accentColor = const Color(0xFF0078D4);
  final Color _textColor = const Color(0xFFF5F5F5);
  final Color _labelColor = const Color(0xFFA1A1AA);

  final TextEditingController _searchController = TextEditingController();
  List<Article> _articles = [];
  List<Article> _filteredArticles = [];
  bool _isLoading = true;
  String _selectedDepotFilter = "Boutique";

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchArticles();
    });
  }

  Future<void> _fetchArticles() async {
    setState(() => _isLoading = true);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final token = auth.token;
    
    try {
      await auth.refreshDepots();
      final depots = auth.allowedDepots;
      if (mounted) {
        setState(() {
           if (!depots.contains(_selectedDepotFilter) && depots.isNotEmpty) {
             _selectedDepotFilter = depots.first;
           }
        });
      }
      
      final data = await ApiService().getArticles(token!);

      if (mounted) {
        setState(() {
          _articles = data.map((json) => Article.fromJson(json)).toList();
          _filteredArticles = _articles;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _filterArticles(String query) {
    setState(() {
      _filteredArticles = _articles
          .where(
            (article) =>
                article.reference.toLowerCase().contains(query.toLowerCase()) ||
                article.designation.toLowerCase().contains(query.toLowerCase()),
          )
          .toList();
    });
  }

  void _openAdjustmentModal(Article article) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.canAdjustStock) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("⛔ Accès refusé"), backgroundColor: Colors.red),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: _cardColor,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: StockEntryForm(
          article: article,
          backgroundColor: _cardColor,
          textColor: _textColor,
          labelColor: _labelColor,
          accentColor: _accentColor,
          currentDepot: _selectedDepotFilter,
          onSave: (double qty, String date, String depot) async {
            try {
              final auth = Provider.of<AuthProvider>(context, listen: false);
              await ApiService().adjustStock(article.id, qty, depot, date, auth.token!);
              if (!mounted) return;
              Navigator.pop(context);
              _fetchArticles();
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Stock mis à jour"), backgroundColor: Colors.green));
            } catch (e) {
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur: $e"), backgroundColor: Colors.red));
            }
          },
        ),
      ),
    );
  }

  void _openTransferModal(Article article) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (!auth.canAdjustStock) return;
    
    String sourceDepot = _selectedDepotFilter;
    String destinationDepot = "Magasin";
    final qtyController = TextEditingController();
    final dateController = TextEditingController(text: DateFormat('dd/MM/yyyy').format(DateTime.now()));
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: _cardColor,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: StatefulBuilder(
          builder: (ctx, setModal) => Container(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text("Transfert de Stock", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                DropdownButtonFormField<String>(
                  value: sourceDepot,
                  items: auth.allowedDepots.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                  onChanged: (v) => setModal(() => sourceDepot = v!),
                  decoration: const InputDecoration(labelText: "Source"),
                ),
                DropdownButtonFormField<String>(
                  value: destinationDepot,
                  items: auth.allowedDepots.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                  onChanged: (v) => setModal(() => destinationDepot = v!),
                  decoration: const InputDecoration(labelText: "Destination"),
                ),
                TextField(controller: qtyController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Quantité")),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: saving ? null : () async {
                    final v = double.tryParse(qtyController.text) ?? 0;
                    if (v <= 0) return;
                    setModal(() => saving = true);
                    try {
                      await ApiService().transferStock(article.id, sourceDepot, destinationDepot, v, dateController.text, auth.token!);
                      if (!mounted) return;
                      Navigator.pop(context);
                      _fetchArticles();
                    } catch (_) {} finally { setModal(() => saving = false); }
                  },
                  child: const Text("Valider"),
                )
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _printStockList() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final companyMap = await ApiService().getCompanyInfo(auth.token!);
    final company = CompanyInfo.fromJson(companyMap);

    Navigator.push(context, MaterialPageRoute(builder: (_) => PdfPreviewScreen(
      invoiceRef: "STOCK",
      buildPdf: (format) async => PdfStockReportGenerator.generateReport(
        company: company,
        depotName: _selectedDepotFilter,
        articles: _filteredArticles,
        generatedBy: auth.username ?? "Admin",
        pageFormat: format,
      ),
    )));
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    return Scaffold(
      backgroundColor: _backgroundColor,
      appBar: AppBar(
        backgroundColor: _backgroundColor,
        title: const Text("Mise à Jour du Stock", style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(icon: const Icon(Icons.print), onPressed: _printStockList),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchArticles),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            color: _cardColor,
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  value: _selectedDepotFilter,
                  items: auth.allowedDepots.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
                  onChanged: (val) => setState(() => _selectedDepotFilter = val!),
                  decoration: const InputDecoration(labelText: "Dépôt"),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _searchController,
                  onChanged: _filterArticles,
                  decoration: const InputDecoration(hintText: "Rechercher...", prefixIcon: Icon(Icons.search)),
                ),
              ],
            ),
          ),
          Expanded(
            child: _isLoading ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    itemCount: _filteredArticles.length,
                    itemBuilder: (context, index) {
                      final item = _filteredArticles[index];
                      final displayQty = item.depotStocks[_selectedDepotFilter] ?? 0.0;
                      return ListTile(
                        onTap: () => _openAdjustmentModal(item),
                        title: Text(item.reference, style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
                        subtitle: Text(item.designation, style: const TextStyle(color: Colors.white)),
                        trailing: Text(displayQty.toStringAsFixed(2), style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class StockEntryForm extends StatefulWidget {
  final Article article;
  final Color backgroundColor;
  final Color textColor;
  final Color labelColor;
  final Color accentColor;
  final String currentDepot;
  final Function(double, String, String) onSave;

  const StockEntryForm({super.key, required this.article, required this.backgroundColor, required this.textColor, required this.labelColor, required this.accentColor, required this.currentDepot, required this.onSave});

  @override
  State<StockEntryForm> createState() => _StockEntryFormState();
}

class _StockEntryFormState extends State<StockEntryForm> {
  final TextEditingController _qtyController = TextEditingController();
  final TextEditingController _dateController = TextEditingController();
  double _newStock = 0.0;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _newStock = widget.article.depotStocks[widget.currentDepot] ?? 0.0;
    _dateController.text = DateFormat('dd/MM/yyyy').format(DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text("Ajustement (${widget.currentDepot})", style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
          TextField(
            controller: _qtyController,
            keyboardType: TextInputType.number,
            autofocus: true,
            onChanged: (v) => setState(() => _newStock = (widget.article.depotStocks[widget.currentDepot] ?? 0) + (double.tryParse(v) ?? 0)),
            decoration: const InputDecoration(labelText: "Qté (+/-)"),
          ),
          const SizedBox(height: 10),
          Text("Nouveau Stock: ${_newStock.toStringAsFixed(2)}", style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _isSaving ? null : () {
              setState(() => _isSaving = true);
              widget.onSave(double.parse(_qtyController.text), _dateController.text, widget.currentDepot);
            },
            child: const Text("Valider"),
          )
        ],
      ),
    );
  }
}
