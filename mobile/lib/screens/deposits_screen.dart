import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../models/client_model.dart';
import '../models/company_model.dart'; // Add import
import 'package:intl/intl.dart';
import '../utils/pdf_deposit_generator.dart';
import 'package:pdf/pdf.dart';
import 'pdf_preview_screen.dart';

// --- Modèle de données (Model) ---
import '../models/deposit_model.dart';

class DepositsScreen extends StatefulWidget {
  const DepositsScreen({super.key});

  @override
  State<DepositsScreen> createState() => _DepositsScreenState();
}

class _DepositsScreenState extends State<DepositsScreen> {
  // --- Couleurs et Design (Modern Light Theme) ---
  final Color _bgColor = const Color(0xFFF3F5F9); // خلفية فاتحة عصرية
  final Color _cardColor = Colors.white; // البطاقات بيضاء
  final Color _primaryColor = const Color(
    0xFF6C63FF,
  ); // لون أساسي (بنفسجي عصري)
  final Color _textDark = const Color(0xFF2D3436); // لون النصوص الداكن
  final Color _textGrey = const Color(0xFF636E72); // لون النصوص الفرعية

  List<Deposit> _allDeposits = [];
  List<Deposit> _filteredDeposits = [];
  List<Client> _clients = []; // Liste des clients pré-chargée
  bool _isLoading = true;
  String _selectedFilter = "Tous";
  String _searchQuery = "";
  String _selectedVendor = "Tous les vendeurs";
  DateTime? _startDate;
  DateTime? _endDate;

  @override
  void initState() {
    super.initState();
    // Default: current month
    final now = DateTime.now();
    _startDate = DateTime(now.year, now.month, 1);
    _endDate = now;
    
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    // 1. Try to load from cache immediately to avoid waiting
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token != null) {
      final cached = await ApiService().getDeposits(token, forceRefresh: false);
      if (cached.isNotEmpty && mounted) {
        setState(() {
          _allDeposits = cached.map((json) => Deposit.fromJson(json)).toList();
          _applyFilters();
          _isLoading = false;
        });
      }
    }
    
    // 2. Then try to fetch from network
    _fetchDeposits(forceRefresh: true);
    _fetchClients();
  }

  Future<void> _fetchClients() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;
    try {
      final data = await ApiService().getClients(token);
      if (mounted) {
        setState(() {
          _clients = data.map((json) => Client.fromJson(json)).toList();
        });
      }
    } catch (e) {
      debugPrint("Error fetching clients: $e");
    }
  }

  Future<void> _fetchDeposits({bool forceRefresh = false}) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final token = auth.token;

    try {
      final data = await ApiService().getDeposits(
        token!,
        forceRefresh: forceRefresh,
        vendeur: auth.isAdmin ? null : auth.username,
      );
      if (mounted) {
        setState(() {
          _allDeposits = data.map((json) => Deposit.fromJson(json)).toList();
          _applyFilters();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
      debugPrint("ERREUR FETCH DEPOSITS: $e");
    }
  }

  DateTime? _parseAnyDate(String dateStr) {
    if (dateStr.isEmpty) return null;
    try {
      // YYYY-MM-DD
      if (dateStr.contains('-') && dateStr.length >= 10) {
        return DateTime.parse(dateStr.substring(0, 10));
      }
      // DD/MM/YYYY
      if (dateStr.contains('/')) {
        final parts = dateStr.split('/');
        if (parts.length == 3) {
          final d = int.parse(parts[0]);
          final m = int.parse(parts[1]);
          final yStr = parts[2];
          final y = yStr.length == 2 ? 2000 + int.parse(yStr) : int.parse(yStr);
          return DateTime(y, m, d);
        }
      }
    } catch (_) {}
    return null;
  }

  void _applyFilters() {
    setState(() {
      _filteredDeposits = _allDeposits.where((deposit) {
        // Status Match
        final statusMatch =
            _selectedFilter == "Tous" || deposit.status == _selectedFilter;
        
        // Search Match (Client or Ref)
        final searchMatch =
            _searchQuery.isEmpty ||
            deposit.clientName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            deposit.reference.toLowerCase().contains(_searchQuery.toLowerCase());
        
        // Vendor Match
        final vendorMatch = _selectedVendor == "Tous les vendeurs" || 
                           deposit.vendeur == _selectedVendor;

        // Date Match
        bool dateMatch = true;
        if (_startDate != null && _endDate != null) {
          final depDate = _parseAnyDate(deposit.date);
          if (depDate != null) {
            // Ignore time for comparison
            final start = DateTime(_startDate!.year, _startDate!.month, _startDate!.day);
            final end = DateTime(_endDate!.year, _endDate!.month, _endDate!.day, 23, 59, 59);
            dateMatch = depDate.isAfter(start.subtract(const Duration(seconds: 1))) && 
                        depDate.isBefore(end.add(const Duration(seconds: 1)));
          }
        }

        return statusMatch && searchMatch && vendorMatch && dateMatch;
      }).toList();
    });
  }

  void _clearFilters() {
    final now = DateTime.now();
    setState(() {
      _selectedFilter = "Tous";
      _searchQuery = "";
      _selectedVendor = "Tous les vendeurs";
      _startDate = DateTime(now.year, now.month, 1);
      _endDate = now;
      _applyFilters();
    });
  }

  Future<void> _printReceipt(Deposit deposit) async {
    setState(() => _isLoading = true);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final token = auth.token;

    if (token == null) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Erreur: Token d'authentification manquant.")),
        );
      }
      return;
    }

    try {
      final api = ApiService();
      // Fetch company info and movements in parallel
      final results = await Future.wait([
        api.getCompanyInfo(token),
        api.getDepositMovements(deposit.id, token),
      ]);

      final company = CompanyInfo.fromJson(results[0] as Map<String, dynamic>);
      final rawMovements = results[1] as List<dynamic>;

      // Build movements list: initial deposit first, then payments
      final List<DepositMovement> movements = [
        DepositMovement(
          date: deposit.date,
          type: 'Dépôt Initial',
          reference: deposit.reference,
          amount: deposit.initialAmount,
        ),
        ...rawMovements.map((m) => DepositMovement.fromJson(m as Map<String, dynamic>)),
      ];

      setState(() => _isLoading = false);

      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PdfPreviewScreen(
              invoiceRef: deposit.reference,
              title: "Reçu de Dépôt",
              initialFormat: PdfPageFormat.a4,
              buildPdf: (format) async {
                return PdfDepositGenerator.generateReceipt(
                  company: company,
                  clientName: deposit.clientName,
                  amount: deposit.initialAmount,
                  remainingAmount: deposit.remainingAmount,
                  reference: deposit.reference,
                  date: deposit.date,
                  createdBy: deposit.vendeur,
                  location: deposit.emplacement,
                  movements: movements,
                  pageFormat: format,
                );
              },
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Erreur impression: $e")),
        );
      }
    }
  }

  void _showWithdrawDialog(Deposit deposit) async {
    final amountController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          "Effectuer un retrait",
          style: TextStyle(color: _textDark, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  const Text(
                    "Solde Disponible",
                    style: TextStyle(color: Colors.green, fontSize: 12),
                  ),
                  Text(
                    "${deposit.remainingAmount.toStringAsFixed(0)} FCFA",
                    style: const TextStyle(
                      color: Colors.green,
                      fontWeight: FontWeight.bold,
                      fontSize: 24,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: amountController,
              keyboardType: TextInputType.number,
              style: TextStyle(
                color: _textDark,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              decoration: InputDecoration(
                labelText: "Montant à retirer",
                labelStyle: TextStyle(color: _textGrey),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: _primaryColor, width: 2),
                ),
                suffixText: "FCFA",
                prefixIcon: const Icon(Icons.money),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text("Annuler", style: TextStyle(color: _textGrey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
                onPressed: () async {
                  double? amount = double.tryParse(amountController.text);
                  if (amount != null &&
                      amount > 0 &&
                      amount <= deposit.remainingAmount) {
                    final token = Provider.of<AuthProvider>(context, listen: false).token;
                    if (token == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("Non authentifié")),
                      );
                      return;
                    }

                    // --- OPTIMISTIC UI UPDATE ---
                    setState(() {
                      // Update local balance immediately using copyWith
                      final double newBalance = deposit.remainingAmount - amount;
                      String newStatus = deposit.status;
                      if (newBalance <= 0) {
                        newStatus = 'Utilisée';
                      } else if (deposit.status == 'Disponible') {
                        newStatus = 'Partiellement utilisée';
                      }
                      
                      // We need to find the index to replace the object in the list
                      int idx = _allDeposits.indexOf(deposit);
                      if (idx != -1) {
                        _allDeposits[idx] = deposit.copyWith(
                          remainingAmount: newBalance,
                          status: newStatus,
                        );
                      }
                      _applyFilters();
                    });

                    try {
                      Navigator.pop(ctx);
                      
                      await ApiService().withdrawDeposit(
                        deposit.id,
                        amount,
                        token,
                      );
                      
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("Retrait effectué avec succès !"),
                            backgroundColor: Colors.green,
                          ),
                        );
                      }
                    } catch (e) {
                      // Rollback on error
                      setState(() {
                         int idx = _allDeposits.indexWhere((d) => d.id == deposit.id);
                         if (idx != -1) {
                           double restoredBalance = _allDeposits[idx].remainingAmount + amount;
                           _allDeposits[idx] = _allDeposits[idx].copyWith(
                             remainingAmount: restoredBalance,
                           );
                         }
                         _applyFilters();
                      });
                      
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text("Erreur retrait: $e"),
                            backgroundColor: Colors.red,
                          ),
                        );
                      }
                    }
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("Montant invalide"),
                        backgroundColor: Colors.red,
                      ),
                    );
                  }
                },
            child: const Text(
              "Confirmer Retrait",
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }

  void _showAddDepositDialog() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final token = auth.token;
    if (token == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Non authentifié")),
      );
      return;
    }

    // On utilise les clients déjà chargés, plus besoin d'attendre l'API ici !
    Client? selectedClient;
    final amountController = TextEditingController();
    bool isSaving = false;

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            backgroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            title: Text(
              "Nouveau Dépôt",
              style: TextStyle(color: _textDark, fontWeight: FontWeight.bold),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<Client>(
                      isExpanded: true,
                      hint: Text(
                        "Sélectionner Client",
                        style: TextStyle(color: _textGrey),
                      ),
                      value: selectedClient,
                      items: _clients
                          .map(
                            (c) => DropdownMenuItem(
                              value: c,
                              child: Text(
                                c.nom,
                                style: TextStyle(
                                  color: _textDark,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (val) =>
                          setDialogState(() => selectedClient = val),
                    ),
                  ),
                ),
                const SizedBox(height: 15),
                TextField(
                  controller: amountController,
                  keyboardType: TextInputType.number,
                  style: TextStyle(
                    color: _textDark,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: InputDecoration(
                    labelText: "Montant",
                    labelStyle: TextStyle(color: _textGrey),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    suffixText: "FCFA",
                    prefixIcon: const Icon(Icons.attach_money),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text("Annuler", style: TextStyle(color: _textGrey)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primaryColor,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                ),
                onPressed: isSaving ? null : () async {
                  if (selectedClient != null &&
                      amountController.text.isNotEmpty) {
                    setDialogState(() => isSaving = true);
                    final double amount = double.parse(amountController.text);
                    final String now = DateFormat('yyyy-MM-dd').format(DateTime.now());
                    
                    final data = {
                      "client_id": selectedClient!.id,
                      "montant_initial": amount,
                      "montant_restant": amount,
                      "date_avance": now,
                      "moyen_paiement": "Espèce",
                      "utilisateur": auth.username ?? "MobileApp",
                      "statut": "Disponible",
                    };

                    // --- OPTIMISTIC UI UPDATE ---
                    final tempId = "OFF-${DateTime.now().millisecondsSinceEpoch}";
                    final tempDeposit = Deposit(
                      id: tempId,
                      clientId: selectedClient!.id,
                      clientName: selectedClient!.nom,
                      initialAmount: amount,
                      remainingAmount: amount,
                      paymentMethod: "Espèce", // Required field
                      reference: "TEMP-${tempId.substring(tempId.length - 4)}",
                      status: "Disponible",
                      date: now,
                      vendeur: auth.username ?? "Moi",
                      emplacement: "",
                      movements: [],
                      pending: true,
                    );

                    setState(() {
                      _allDeposits.insert(0, tempDeposit);
                      _applyFilters();
                    });

                    try {
                      Navigator.pop(context);
                      
                      final result = await ApiService().createDeposit(data, token);
                      
                      if (result != null && context.mounted) {
                        final String realId = result['id'].toString();
                        final String realRef = result['reference_paiement']?.toString() ?? tempDeposit.reference;

                        // Update the temporary deposit in the list with real values from DB
                        setState(() {
                          int idx = _allDeposits.indexWhere((d) => d.id == tempId);
                          if (idx != -1) {
                            _allDeposits[idx] = _allDeposits[idx].copyWith(
                              id: realId, 
                              reference: realRef,
                              pending: false
                            );
                          }
                          _applyFilters();
                        });

                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: const Text("Dépôt enregistré !"),
                            backgroundColor: Colors.green,
                            action: SnackBarAction(
                              label: "IMPRIMER",
                              textColor: Colors.white,
                              onPressed: () => _printReceipt(_allDeposits.firstWhere((d) => d.id == realId)),
                            ),
                          ),
                        );
                      } else if (context.mounted) {
                        throw Exception("Échec de l'enregistrement (ID non retourné)");
                      }
                    } catch (e) {
                      debugPrint("Erreur ajout: $e");
                      // Rollback
                      setState(() {
                        _allDeposits.removeWhere((d) => d.id == tempId);
                        _applyFilters();
                      });
                      
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text("Erreur lors de l'enregistrement: $e"),
                            backgroundColor: Colors.red,
                          ),
                        );
                      }
                    }
                  }
                },
                child: isSaving 
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) 
                  : const Text(
                      "Enregistrer",
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    double totalRestant = _filteredDeposits.fold(
      0,
      (sum, item) => sum + item.remainingAmount,
    );

    return Scaffold(
      backgroundColor: _bgColor,
      // --- AppBar بتصميم متدرج وجذاب ---
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_primaryColor, const Color(0xFF8E2DE2)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        elevation: 8,
        title: const Text(
          "Avances Clients",
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _fetchDeposits(forceRefresh: true),
            tooltip: "Actualiser",
          ),
          IconButton(
            icon: const Icon(Icons.filter_list_off),
            onPressed: _clearFilters,
            tooltip: "Effacer les filtres",
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. Barre de recherche et filtres
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(20),
              ),
            ),
            child: Column(
              children: [
                // row 1: Search
                TextField(
                  style: TextStyle(color: _textDark),
                  onChanged: (val) {
                    _searchQuery = val;
                    _applyFilters();
                  },
                  decoration: InputDecoration(
                    hintText: "Nom client ou référence...",
                    hintStyle: TextStyle(color: _textGrey),
                    prefixIcon: Icon(Icons.search, color: _primaryColor),
                    filled: true,
                    fillColor: _bgColor,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(15),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  ),
                ),
                const SizedBox(height: 12),
                
                // row 2: Dates
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _startDate ?? DateTime.now(),
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setState(() => _startDate = picked);
                            _applyFilters();
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: _bgColor,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.calendar_today, size: 16, color: _primaryColor),
                              const SizedBox(width: 8),
                              Text(
                                _startDate == null ? "Du" : DateFormat('dd/MM/yy').format(_startDate!),
                                style: TextStyle(color: _textDark, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: _endDate ?? DateTime.now(),
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setState(() => _endDate = picked);
                            _applyFilters();
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: _bgColor,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.calendar_today, size: 16, color: _primaryColor),
                              const SizedBox(width: 8),
                              Text(
                                _endDate == null ? "Au" : DateFormat('dd/MM/yy').format(_endDate!),
                                style: TextStyle(color: _textDark, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // row 3: Vendor Dropdown (if multiple vendors exist)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: _bgColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: _selectedVendor,
                      style: TextStyle(color: _textDark, fontSize: 14),
                      items: _getVendorsList().map((v) => DropdownMenuItem(
                        value: v,
                        child: Text(v),
                      )).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedVendor = val);
                          _applyFilters();
                        }
                      },
                    ),
                  ),
                ),

                const SizedBox(height: 12),
                
                // Status Chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip("Tous"),
                      _buildFilterChip("Disponible"),
                      _buildFilterChip("Partiellement utilisée"),
                      _buildFilterChip("Utilisée"),
                      _buildFilterChip("Annulée"),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // 2. قائمة الإيداعات
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : _filteredDeposits.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.inbox_rounded,
                          size: 80,
                          color: Colors.grey.shade300,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          "Aucun dépôt trouvé",
                          style: TextStyle(color: _textGrey, fontSize: 18),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _filteredDeposits.length,
                    itemBuilder: (context, index) {
                      return _buildDepositCard(_filteredDeposits[index]);
                    },
                  ),
          ),

          // 3. الشريط السفلي (الإجمالي) بشكل حديث
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -5),
                ),
              ],
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(20),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: _bgColor,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.account_balance_wallet,
                        color: _primaryColor,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "ENREG.",
                          style: TextStyle(
                            color: _textGrey,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          "${_filteredDeposits.length}",
                          style: TextStyle(
                            color: _textDark,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      "SOLDE TOTAL",
                      style: TextStyle(
                        color: _textGrey,
                        fontSize: 10,
                        letterSpacing: 1.0,
                      ),
                    ),
                    Text(
                      "${totalRestant.toStringAsFixed(0)} FCFA",
                      style: TextStyle(
                        color: _primaryColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showAddDepositDialog,
        backgroundColor: _primaryColor,
        elevation: 5,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text(
          "NOUVEAU",
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
          ),
        ),
      ),
    );
  }

  // --- Widgets ---
  List<String> _getVendorsList() {
    final vendors = _allDeposits.map((d) => d.vendeur).toSet().toList();
    vendors.sort();
    return ["Tous les vendeurs", ...vendors];
  }

  Widget _buildFilterChip(String label) {
    bool isSelected =
        _selectedFilter == label ||
        (label == "Partiellement utilisée" &&
            _selectedFilter == "Partiellement utilisée");
    String displayLabel = label == "Partiellement utilisée"
        ? "Partiel."
        : label;

    return Container(
      margin: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(displayLabel),
        labelStyle: TextStyle(
          color: isSelected ? Colors.white : _textDark,
          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
        ),
        selected: isSelected,
        onSelected: (bool selected) {
          setState(() {
            _selectedFilter = label;
            _applyFilters();
          });
        },
        selectedColor: _primaryColor,
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(
            color: isSelected ? Colors.transparent : Colors.grey.shade300,
          ),
        ),
        elevation: isSelected ? 4 : 0,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  Widget _buildDepositCard(Deposit deposit) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        deposit.clientName,
                        style: TextStyle(
                          color: _textDark,
                          fontWeight: FontWeight.bold,
                          fontSize: 17,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Icon(Icons.person_outline, size: 14, color: _textGrey),
                          const SizedBox(width: 4),
                          Text(
                            deposit.vendeur,
                            style: TextStyle(color: _textGrey, fontSize: 13),
                          ),
                          if (deposit.emplacement.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Icon(Icons.location_on, size: 14, color: Colors.orange.shade700),
                            const SizedBox(width: 4),
                            Text(
                              deposit.emplacement,
                              style: TextStyle(
                                color: Colors.orange.shade800,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "Réf: ${deposit.reference}",
                        style: TextStyle(color: _textGrey, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: _bgColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                       Text(
                        _parseAnyDate(deposit.date) != null 
                          ? DateFormat('dd/MM/yy').format(_parseAnyDate(deposit.date)!)
                          : deposit.date,
                        style: TextStyle(
                          color: _textGrey,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 30, thickness: 1),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildAmountColumn(
                  "INITIAL",
                  deposit.initialAmount,
                  _textGrey,
                  15,
                ),
                // تمييز المبلغ المتبقي بحجم أكبر ولون مميز
                _buildAmountColumn(
                  "RESTANT",
                  deposit.remainingAmount,
                  Colors.green,
                  22,
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildStatusBadge(deposit.status),
                // زر الخيارات (أيقونة أكبر)
                Container(
                  decoration: BoxDecoration(
                    color: _bgColor,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: PopupMenuButton<String>(
                    icon: Icon(Icons.more_horiz, color: _primaryColor),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    onSelected: (value) {
                      if (value == 'retrait') _showWithdrawDialog(deposit);
                      if (value == 'print') _printReceipt(deposit);
                    },
                    itemBuilder: (context) => [
                      if (deposit.remainingAmount > 0)
                        const PopupMenuItem(
                          value: "retrait",
                          child: Row(
                            children: [
                              Icon(Icons.output_rounded, color: Colors.orange),
                              SizedBox(width: 10),
                              Text("Retrait"),
                            ],
                          ),
                        ),
                      const PopupMenuItem(
                        value: "print",
                        child: Row(
                          children: [
                            Icon(Icons.print_rounded, color: Colors.blue),
                            SizedBox(width: 10),
                            Text("Imprimer Reçu"),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAmountColumn(
    String label,
    double amount,
    Color color,
    double fontSize,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: Colors.grey.shade500,
            fontSize: 11,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          "${amount.toStringAsFixed(0)} FCFA",
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.w800,
            fontSize: fontSize,
          ),
        ),
      ],
    );
  }

  Widget _buildStatusBadge(String status) {
    Color color = status == "Disponible"
        ? Colors.green
        : (status.contains("Partiel") ? Colors.orange : Colors.grey);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Icon(Icons.circle, size: 8, color: color),
          const SizedBox(width: 6),
          Text(
            status,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
