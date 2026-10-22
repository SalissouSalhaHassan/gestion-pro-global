import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../providers/auth_provider.dart';
import '../providers/rent_provider.dart';
import '../models/contract_model.dart';
import '../models/rent_payment_model.dart';
import 'contract_details_screen.dart';
import 'add_contract_screen.dart';
import 'rent_payments_list_screen.dart';
import '../api/api_service.dart';
import '../models/company_model.dart';
import '../utils/pdf_rent_payment_generator.dart';
import 'pdf_preview_screen.dart';

class LoyersListScreen extends StatefulWidget {
  const LoyersListScreen({super.key});

  @override
  State<LoyersListScreen> createState() => _LoyersListScreenState();
}

class _LoyersListScreenState extends State<LoyersListScreen> {
  final TextEditingController _searchController = TextEditingController();
  final NumberFormat _numberFormat = NumberFormat("#,##0", "fr_FR");

  List<Contract> _allContracts = [];
  List<Contract> _displayContracts = [];
  bool _isLoading = true;

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF8FAFF);

  String _selectedFilter = "Tous"; // "Tous", "Actif", "Retard", "Expiré"

  @override
  void initState() {
    super.initState();
    _fetchContracts();
    _searchController.addListener(_applyFilters);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _applyFilters() {
    final query = _searchController.text.toLowerCase().trim();
    setState(() {
      _displayContracts = _allContracts.where((c) {
        // Query match
        final matchesQuery = query.isEmpty ||
            c.locataireNomComplet.toLowerCase().contains(query) ||
            c.refLocataire.toLowerCase().contains(query) ||
            c.bienLoueDetails.toLowerCase().contains(query) ||
            (c.quartier?.toLowerCase().contains(query) ?? false);

        if (!matchesQuery) return false;

        // Status filter match
        if (_selectedFilter == "Actif") {
          return c.statut == "Actif";
        } else if (_selectedFilter == "Retard") {
          return c.retards > 0 || c.moisImpayes.contains('m');
        } else if (_selectedFilter == "Expiré") {
          return c.statut == "Expiré";
        }
        return true;
      }).toList();
    });
  }

  Future<void> _fetchContracts() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final rentProvider = Provider.of<RentProvider>(context, listen: false);
    setState(() => _isLoading = true);

    try {
      await rentProvider.fetchContracts(auth, forceRefresh: true);
      if (mounted) {
        setState(() {
          _allContracts = rentProvider.contracts;
          _isLoading = false;
        });
        _applyFilters();
      }
    } catch (e) {
      debugPrint("Error loading contracts: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  double get _totalCollected {
    return _allContracts.fold(0.0, (sum, c) => sum + (c.totalPaye));
  }

  int get _activeContractsCount {
    return _allContracts.where((c) => c.statut == "Actif").length;
  }

  int get _lateContractsCount {
    return _allContracts.where((c) => c.retards > 0 || c.moisImpayes.contains('m')).length;
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);

    return Scaffold(
      backgroundColor: _backgroundColor,
      appBar: AppBar(
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_primaryColor, _secondaryColor],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        title: const Text(
          "Gestion des Loyers",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: Colors.white),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.receipt_long_rounded, color: Colors.white),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RentPaymentsListScreen())),
            tooltip: "Liste de tous les paiements",
          ),
          IconButton(
            icon: const Icon(Icons.print_rounded, color: Colors.white),
            onPressed: _printGeneralReport,
            tooltip: "Imprimer Rapport Général",
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _fetchContracts,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          _buildStatsCards(),
          _buildFilterChips(),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : _displayContracts.isEmpty
                    ? Center(
                        child: Text(
                          _searchController.text.isEmpty
                              ? "Aucun contrat trouvé"
                              : "Aucun résultat pour \"${_searchController.text}\"",
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        itemCount: _displayContracts.length,
                        itemBuilder: (context, index) {
                          return _buildContractCard(_displayContracts[index], auth);
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: auth.isAdmin
          ? FloatingActionButton.extended(
              onPressed: () async {
                bool? result = await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AddContractScreen()),
                );
                if (result == true) _fetchContracts();
              },
              backgroundColor: _primaryColor,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text("Nouveau Contrat", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            )
          : null,
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: TextField(
        controller: _searchController,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        decoration: InputDecoration(
          hintText: "Rechercher un locataire, réf, bien...",
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
          prefixIcon: Icon(Icons.search_rounded, color: _primaryColor, size: 24),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.cancel_rounded, color: Colors.grey),
                  onPressed: () {
                    _searchController.clear();
                    _applyFilters();
                  },
                )
              : null,
          filled: true,
          fillColor: const Color(0xFFF5F7FA),
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: _primaryColor.withOpacity(0.3), width: 1),
          ),
        ),
      ),
    );
  }

  Widget _buildStatsCards() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
      height: 110,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _buildStatCard(
            "Total Contrats",
            "${_allContracts.length}",
            [const Color(0xFF4F46E5), const Color(0xFF6366F1)],
            Icons.file_copy_rounded,
          ),
          _buildStatCard(
            "Contrats Actifs",
            "$_activeContractsCount",
            [const Color(0xFF059669), const Color(0xFF10B981)],
            Icons.people_alt_rounded,
          ),
          _buildStatCard(
            "Contrats en Retard",
            "$_lateContractsCount",
            [const Color(0xFFE11D48), const Color(0xFFF43F5E)],
            Icons.warning_amber_rounded,
          ),
          _buildStatCard(
            "Total Encaissé",
            "${_numberFormat.format(_totalCollected)} F",
            [const Color(0xFFF59E0B), const Color(0xFFF97316)],
            Icons.account_balance_wallet_rounded,
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips() {
    final filters = [
      {"id": "Tous", "label": "Tous (${_allContracts.length})"},
      {"id": "Actif", "label": "Actifs ($_activeContractsCount)"},
      {"id": "Retard", "label": "En Retard ($_lateContractsCount)"},
      {"id": "Expiré", "label": "Expirés (${_allContracts.where((c) => c.statut == 'Expiré').length})"},
    ];

    return Container(
      height: 40,
      margin: const EdgeInsets.only(bottom: 8, left: 12, right: 12),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final f = filters[index];
          final bool isSelected = _selectedFilter == f["id"];
          final bool isLateTab = f["id"] == "Retard";

          return GestureDetector(
            onTap: () {
              setState(() {
                _selectedFilter = f["id"]!;
              });
              _applyFilters();
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected
                    ? (isLateTab ? const Color(0xFFE11D48) : _primaryColor)
                    : Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: (isLateTab ? const Color(0xFFE11D48) : _primaryColor).withOpacity(0.3),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        )
                      ]
                    : [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.03),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        )
                      ],
                border: Border.all(
                  color: isSelected
                      ? Colors.transparent
                      : (isLateTab && _lateContractsCount > 0
                          ? const Color(0xFFFDA4AF)
                          : Colors.grey.shade200),
                ),
              ),
              child: Center(
                child: Text(
                  f["label"]!,
                  style: TextStyle(
                    color: isSelected
                        ? Colors.white
                        : (isLateTab && _lateContractsCount > 0 ? const Color(0xFFE11D48) : Colors.grey.shade800),
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatCard(String label, String value, List<Color> colors, IconData icon) {
    return Container(
      width: 155,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: colors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: colors[0].withOpacity(0.3),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -10,
            top: -10,
            child: Icon(
              icon,
              color: Colors.white.withOpacity(0.15),
              size: 55,
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    label.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                  Icon(icon, color: Colors.white, size: 14),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildContractCard(Contract c, AuthProvider auth) {
    final bool isLate = c.retards > 0 || c.moisImpayes.contains('m');
    
    // Status style matching web app
    Color statusBgColor;
    Color statusTextColor;
    Color statusDotColor;
    if (c.statut == "Actif") {
      statusBgColor = const Color(0xFFECFDF5);
      statusTextColor = const Color(0xFF047857);
      statusDotColor = const Color(0xFF10B981);
    } else if (c.statut == "Expiré") {
      statusBgColor = const Color(0xFFFEF3C7);
      statusTextColor = const Color(0xFFB45309);
      statusDotColor = const Color(0xFFF59E0B);
    } else {
      statusBgColor = const Color(0xFFFFF1F2);
      statusTextColor = const Color(0xFFBE123C);
      statusDotColor = const Color(0xFFF43F5E);
    }

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      color: isLate ? const Color(0xFF1E1015) : const Color(0xFF0F172A),
      elevation: 4,
      shadowColor: Colors.black38,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(
          color: isLate ? const Color(0xFFBE123C).withOpacity(0.3) : Colors.white.withOpacity(0.05),
          width: 1.5,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => _showOptions(c, auth),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row (Ref & Status)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    c.refLocataire,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF818CF8), // indigo-400
                      fontSize: 12,
                      letterSpacing: 0.5,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusBgColor,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: statusDotColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          c.statut.toUpperCase(),
                          style: TextStyle(
                            color: statusTextColor,
                            fontWeight: FontWeight.w900,
                            fontSize: 10,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Tenant Details Row (Avatar & Name/Bien)
              Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: Colors.white.withOpacity(0.08),
                    child: Text(
                      c.locataireNomComplet.isNotEmpty ? c.locataireNomComplet[0].toUpperCase() : "?",
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          c.locataireNomComplet,
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                            color: isLate ? const Color(0xFFFCA5A5) : Colors.white,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          c.bienLoueDetails,
                          style: const TextStyle(
                            color: Colors.white60,
                            fontSize: 12,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Divider
              Container(
                height: 1,
                color: Colors.white.withOpacity(0.05),
              ),
              const SizedBox(height: 14),

              // Footer Info (Loyer & Expected/Late status)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Rent Monthly Info
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "LOYER MENSUEL",
                        style: TextStyle(
                          color: Colors.white38,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "${_numberFormat.format(c.loyerMensuel)} F",
                        style: const TextStyle(
                          color: Color(0xFF34D399), // emerald-400
                          fontWeight: FontWeight.w900,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                  
                  // Payment Status Info
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      const Text(
                        "ÉTAT DE PAIEMENT",
                        style: TextStyle(
                          color: Colors.white38,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isLate 
                              ? const Color(0xFFEF4444).withOpacity(0.15) 
                              : const Color(0xFF10B981).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          isLate 
                              ? "RETARD: ${_numberFormat.format(c.retards)} F" 
                              : "À JOUR",
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: isLate ? const Color(0xFFF87171) : const Color(0xFF34D399),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              
              // Unpaid months detail
              if (isLate && c.moisImpayes.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444).withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: const Color(0xFFEF4444).withOpacity(0.15),
                      width: 1,
                    ),
                  ),
                  child: Text(
                    "Mois impayés: ${c.moisImpayes}",
                    style: const TextStyle(
                      color: Color(0xFFF87171),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _printGeneralReport() async {
    if (_allContracts.isEmpty) return;
    
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final api = ApiService();
      final companyInfoMap = await api.getCompanyInfo(
        Provider.of<AuthProvider>(context, listen: false).token!
      );
      final companyInfo = CompanyInfo.fromJson(companyInfoMap);

      if (mounted) Navigator.pop(context); // Close loader

      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => PdfPreviewScreen(
              invoiceRef: "BILAN-LOYERS",
              title: "Rapport Général des Loyers",
              buildPdf: (format) async {
                return PdfRentPaymentGenerator.generateRentReport(
                  company: companyInfo,
                  contracts: _displayContracts,
                  createdBy: Provider.of<AuthProvider>(context, listen: false).username ?? "Caissier",
                  pageFormat: format,
                );
              },
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) Navigator.pop(context); // Close loader
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Erreur de génération PDF: $e"), backgroundColor: Colors.red),
      );
    }
  }

  void _showOptions(Contract c, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (_) => SafeArea(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 15),
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(15),
                child: Text(
                  c.locataireNomComplet,
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white60, fontSize: 16),
                ),
              ),
              ListTile(
                leading: CircleAvatar(backgroundColor: _primaryColor, child: const Icon(Icons.dashboard, color: Colors.white)),
                title: const Text("Tableau de bord / Détails", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ContractDetailsScreen(contractId: c.id)),
                  ).then((_) => _fetchContracts());
                },
              ),
              if (c.statut == "Actif")
                ListTile(
                  leading: const CircleAvatar(backgroundColor: Color(0xFF10B981), child: Icon(Icons.add_card, color: Colors.white)),
                  title: const Text("Enregistrer un paiement", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  onTap: () {
                    Navigator.pop(context);
                    _showPaymentModal(c, auth);
                  },
                ),
              if (auth.isAdmin) ...[
                ListTile(
                  leading: const CircleAvatar(backgroundColor: Color(0xFFF59E0B), child: Icon(Icons.edit, color: Colors.white)),
                  title: const Text("Modifier le contrat", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                  onTap: () async {
                    Navigator.pop(context);
                    bool? result = await Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => AddContractScreen(contract: c)),
                    );
                    if (result == true) _fetchContracts();
                  },
                ),
                ListTile(
                  leading: const CircleAvatar(backgroundColor: Color(0xFFEF4444), child: Icon(Icons.delete, color: Colors.white)),
                  title: const Text("Supprimer le contrat", style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFFCA5A5))),
                  onTap: () {
                    Navigator.pop(context);
                    _confirmDeletion(c, auth);
                  },
                ),
              ],
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmDeletion(Contract c, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Supprimer le contrat"),
        content: Text("Voulez-vous vraiment supprimer le contrat de \"${c.locataireNomComplet}\" ? cette action est irréversible."),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Annuler")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (_) => const Center(child: CircularProgressIndicator()),
              );
              try {
                await Provider.of<RentProvider>(context, listen: false).deleteContract(auth, c.id);
                if (mounted) Navigator.pop(context); // Close loader
                _fetchContracts();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Contrat supprimé avec succès"), backgroundColor: Colors.green),
                  );
                }
              } catch (e) {
                if (mounted) Navigator.pop(context); // Close loader
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text("Erreur"),
                    content: Text("Une erreur est survenue lors de la suppression: $e"),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("OK")),
                    ],
                  ),
                );
              }
            },
            child: const Text("Supprimer", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showPaymentModal(Contract c, AuthProvider auth) {
    final amountController = TextEditingController(text: c.retards > 0 ? c.retards.toInt().toString() : c.loyerMensuel.toInt().toString());
    final descController = TextEditingController();
    final monthsQtyController = TextEditingController(text: "1");
    String method = "Espèces";
    
    DateTime startPeriod = DateTime.now();
    DateTime endPeriod = DateTime.now().add(const Duration(days: 30));
    final DateFormat formatter = DateFormat('dd/MM/yyyy');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Container(
            padding: const EdgeInsets.all(20),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Center(
                    child: Text(
                      "Paiement de Loyer",
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    "Locataire: ${c.locataireNomComplet}",
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.blueGrey),
                  ),
                  Text(
                    "Montant Loyer: ${_numberFormat.format(c.loyerMensuel)} F/Mois",
                    style: const TextStyle(fontSize: 13, color: Colors.grey),
                  ),
                  const SizedBox(height: 15),
                  TextField(
                    controller: amountController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: "Montant Versé (F CFA)",
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      prefixIcon: const Icon(Icons.money_rounded),
                    ),
                  ),
                  const SizedBox(height: 15),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: monthsQtyController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: "Nombre de mois",
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onChanged: (val) {
                            int? q = int.tryParse(val);
                            if (q != null && q > 0) {
                              setModalState(() {
                                amountController.text = (c.loyerMensuel * q).toInt().toString();
                                endPeriod = DateTime(startPeriod.year, startPeriod.month + q, startPeriod.day);
                              });
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 15),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: method,
                          items: ["Espèces", "Chèque", "Mobile Money", "Virement"]
                              .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                              .toList(),
                          onChanged: (v) => setModalState(() => method = v.toString()),
                          decoration: InputDecoration(
                            labelText: "Mode",
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 15),
                  const Text("Fériode d'occupation :", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: startPeriod,
                              firstDate: DateTime(2020),
                              lastDate: DateTime(2030),
                            );
                            if (picked != null) {
                              setModalState(() {
                                startPeriod = picked;
                                int q = int.tryParse(monthsQtyController.text) ?? 1;
                                endPeriod = DateTime(startPeriod.year, startPeriod.month + q, startPeriod.day);
                              });
                            }
                          },
                          icon: const Icon(Icons.date_range_rounded),
                          label: Text("Début: ${formatter.format(startPeriod)}"),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: endPeriod,
                              firstDate: startPeriod,
                              lastDate: DateTime(2030),
                            );
                            if (picked != null) {
                              setModalState(() => endPeriod = picked);
                            }
                          },
                          icon: const Icon(Icons.date_range_rounded),
                          label: Text("Fin: ${formatter.format(endPeriod)}"),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 15),
                  TextField(
                    controller: descController,
                    decoration: InputDecoration(
                      labelText: "Note / Commentaire (Optionnel)",
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 25),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () async {
                        double? amount = double.tryParse(amountController.text.trim());
                        if (amount == null || amount <= 0) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text("Veuillez saisir un montant valide"), backgroundColor: Colors.red),
                          );
                          return;
                        }

                        Navigator.pop(context); // Close bottom sheet
                        showDialog(
                          context: context,
                          barrierDismissible: false,
                          builder: (_) => const Center(child: CircularProgressIndicator()),
                        );

                        try {
                          final DateFormat apiFormatter = DateFormat('yyyy-MM-dd');
                          final payload = {
                            "montant": amount,
                            "mode_paiement": method,
                            "date_paiement": apiFormatter.format(DateTime.now()),
                            "qte_mois": int.tryParse(monthsQtyController.text) ?? 1,
                            "periode_debut": apiFormatter.format(startPeriod),
                            "periode_fin": apiFormatter.format(endPeriod),
                            "nom_de_mois": DateFormat('MMMM yyyy', 'fr_FR').format(startPeriod),
                            "description": descController.text.trim(),
                          };

                          await Provider.of<RentProvider>(context, listen: false).addPayment(auth, c.id, payload);
                          if (mounted) Navigator.pop(context); // Close loader
                          
                          _fetchContracts();
                          
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text("Paiement enregistré avec succès !"), backgroundColor: Colors.green),
                            );
                            _showReceiptOptions(c, amount, method, startPeriod, endPeriod, descController.text.trim(), auth);
                          }
                        } catch (e) {
                          if (mounted) Navigator.pop(context); // Close loader
                          showDialog(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: const Text("Erreur"),
                              content: Text("Une erreur est survenue lors de l'enregistrement du paiement: $e"),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("OK")),
                              ],
                            ),
                          );
                        }
                      },
                      child: const Text("VALIDER LE PAIEMENT", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showReceiptOptions(Contract contract, double amount, String method, DateTime start, DateTime end, String desc, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Paiement Réussi"),
        content: const Text("Voulez-vous imprimer ou partager la quittance de loyer correspondante ?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Fermer")),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (_) => const Center(child: CircularProgressIndicator()),
              );

              try {
                final api = ApiService();
                final companyInfoMap = await api.getCompanyInfo(auth.token!);
                final companyInfo = CompanyInfo.fromJson(companyInfoMap);
                
                // Get the newly created payment details if needed, or build a mock payload
                final mockPayment = RentPayment(
                  id: DateTime.now().millisecondsSinceEpoch ~/ 1000,
                  contratId: contract.id,
                  datePaiement: DateTime.now().toIso8601String().split('T')[0],
                  montant: amount,
                  modePaiement: method,
                  description: desc,
                  nomDeMois: DateFormat('MMMM yyyy', 'fr_FR').format(start),
                  qteMois: 1,
                  periodeDebut: start.toIso8601String().split('T')[0],
                  periodeFin: end.toIso8601String().split('T')[0],
                );

                if (mounted) Navigator.pop(context); // Close loader

                if (mounted) {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (context) => PdfPreviewScreen(
                        invoiceRef: "LOY-PAY-${mockPayment.id}",
                        buildPdf: (format) async {
                          return PdfRentPaymentGenerator.generateReceipt(
                            company: companyInfo,
                            contract: contract,
                            payment: mockPayment,
                            createdBy: auth.username ?? "Caissier",
                            pageFormat: format,
                          );
                        },
                      ),
                    ),
                  );
                }
              } catch (e) {
                if (mounted) Navigator.pop(context); // Close loader
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text("Erreur lors de la génération du PDF: $e"), backgroundColor: Colors.red),
                );
              }
            },
            child: const Text("Voir la Quittance", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
