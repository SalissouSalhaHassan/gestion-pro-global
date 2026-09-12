import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import 'package:intl/intl.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  List<dynamic> _expenses = [];
  bool _isLoading = false;
  final NumberFormat _fmt = NumberFormat("#,##0", "fr_FR");
  String _searchText = "";
  List<String> _operators = ["Tous"];
  String _selectedOperator = "Tous";
  bool _showGlobalTotal = false;

  DateTime? _startDate;
  DateTime? _endDate;

  @override
  void initState() {
    super.initState();
    _fetchExpenses();
  }

  void _updateOperators(List<dynamic> data) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.isAdmin) {
      final ops = data.map((e) => (e['operateur'] ?? '').toString()).where((s) => s.isNotEmpty).toSet().toList()..sort();
      _operators = ["Tous", ...ops];
    } else {
      _operators = [auth.username ?? "Moi"];
      _selectedOperator = auth.username ?? "Moi";
    }
  }

  Future<void> _fetchExpenses() async {
    setState(() => _isLoading = true);
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final data = await ApiService().getExpenses(
        auth.token!,
        startDate: _startDate != null ? DateFormat('yyyy-MM-dd').format(_startDate!) : null,
        endDate: _endDate != null ? DateFormat('yyyy-MM-dd').format(_endDate!) : null,
      );
      if (mounted) {
        setState(() {
          _expenses = data;
          _updateOperators(data);
        });
      }
    } catch (_) {} finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> _filteredExpenses() {
    final query = _searchText.trim().toLowerCase();
    return _expenses.where((e) {
      final libelle = (e['libelle'] ?? '').toString().toLowerCase();
      final operateur = (e['operateur'] ?? '').toString();
      final matchesSearch = query.isEmpty || libelle.contains(query);
      final matchesOperator = _selectedOperator == "Tous" || operateur == _selectedOperator;
      return matchesSearch && matchesOperator;
    }).toList();
  }

  double _sumFiltered() {
    double total = 0.0;
    for (final e in _filteredExpenses()) {
      total += (e['montant'] as num?)?.toDouble() ?? 0.0;
    }
    return total;
  }

  double _sumAll() {
    double total = 0.0;
    for (final e in _expenses) {
      total += (e['montant'] as num?)?.toDouble() ?? 0.0;
    }
    return total;
  }

  void _showExpenseDialog({Map<String, dynamic>? item}) {
    final libelleCtrl = TextEditingController(text: item?['libelle']?.toString() ?? "");
    final montantCtrl = TextEditingController(text: item?['montant']?.toString() ?? "");
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom + 20, left: 20, right: 20, top: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(item == null ? "Nouvelle Dépense" : "Modifier Dépense", style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              TextField(controller: libelleCtrl, decoration: const InputDecoration(labelText: "Motif")),
              TextField(controller: montantCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Montant")),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: isSaving ? null : () async {
                    if (libelleCtrl.text.isEmpty || montantCtrl.text.isEmpty) return;
                    setModalState(() => isSaving = true);
                    final auth = Provider.of<AuthProvider>(context, listen: false);
                    final data = {
                      "date_depense": item != null ? item['date_depense'] : DateFormat('yyyy-MM-dd').format(DateTime.now()),
                      "libelle": libelleCtrl.text,
                      "montant": double.parse(montantCtrl.text),
                      "operateur": item != null ? item['operateur'] : auth.username,
                    };
                    if (item != null && item['id'] != null) {
                      data['id'] = item['id'];
                    }
                    try {
                      await ApiService().addExpense(data, auth.token!);
                      if (mounted) { Navigator.pop(ctx); _fetchExpenses(); }
                    } catch (_) { if (mounted) setModalState(() => isSaving = false); }
                  },
                  child: isSaving ? const CircularProgressIndicator() : const Text("Enregistrer"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Dépenses"),
        backgroundColor: Colors.redAccent,
        actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _fetchExpenses)],
      ),
      body: _isLoading ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    itemCount: _filteredExpenses().length,
                    itemBuilder: (context, index) {
                      final item = _filteredExpenses()[index];
                      return ListTile(
                        title: Text(item['libelle'] ?? 'Dépense'),
                        subtitle: Text("${item['date_depense']} • ${item['operateur']}"),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text("-${_fmt.format(item['montant'])}", style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                            IconButton(
                              icon: const Icon(Icons.edit, color: Colors.blue, size: 20),
                              onPressed: () => _showExpenseDialog(item: item),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete, color: Colors.red, size: 20),
                              onPressed: () async {
                                 final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
                                   title: const Text("Supprimer"),
                                   actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Non")), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text("Oui"))],
                                 ));
                                 if (confirm == true) {
                                   final auth = Provider.of<AuthProvider>(context, listen: false);
                                   await ApiService().deleteExpense(item['id'].toString(), auth.token!);
                                   _fetchExpenses();
                                 }
                              },
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      const Text("Total: ", style: TextStyle(fontWeight: FontWeight.bold)),
                      const Spacer(),
                      Text("-${_fmt.format(_sumFiltered())}", style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 18)),
                    ],
                  ),
                )
              ],
            ),
      floatingActionButton: FloatingActionButton(onPressed: () => _showExpenseDialog(), backgroundColor: Colors.redAccent, child: const Icon(Icons.add)),
    );
  }
}
