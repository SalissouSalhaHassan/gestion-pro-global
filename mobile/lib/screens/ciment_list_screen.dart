import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../providers/auth_provider.dart';
import '../providers/ciment_provider.dart';
import '../models/ciment_model.dart';
import '../models/company_model.dart';
import '../api/api_service.dart';
import '../utils/pdf_ciment_generator.dart';
import 'pdf_preview_screen.dart';
import 'add_ciment_screen.dart';
import 'ciment_payments_screen.dart';

class CimentListScreen extends StatefulWidget {
  const CimentListScreen({super.key});

  @override
  State<CimentListScreen> createState() => _CimentListScreenState();
}

class _CimentListScreenState extends State<CimentListScreen> {
  final TextEditingController _searchController = TextEditingController();
  final NumberFormat _numberFormat = NumberFormat("#,##0", "fr_FR");
  final DateFormat _dateFormat = DateFormat('dd/MM/yyyy HH:mm');

  bool _isLoading = true;
  String? _selectedCamion;
  String? _selectedStatut;
  DateTimeRange? _dateRange;

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF8FAFF);

  @override
  void initState() {
    super.initState();
    _fetchShipments();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    setState(() {}); // Trigger rebuild to apply local search filter
  }

  Future<void> _fetchShipments() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final cimentProvider = Provider.of<CimentProvider>(context, listen: false);
    setState(() => _isLoading = true);

    try {
      Map<String, String> filters = {};
      if (_dateRange != null) {
        filters['startDate'] = _dateRange!.start.toIso8601String().split('T')[0];
        filters['endDate'] = _dateRange!.end.toIso8601String().split('T')[0];
      }
      
      await cimentProvider.fetchShipments(auth, filters: filters);
    } catch (e) {
      debugPrint("Error fetching shipments: $e");
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  List<CimentShipment> _getFilteredShipments(List<CimentShipment> list) {
    final query = _searchController.text.toLowerCase().trim();
    return list.where((s) {
      // 1. Search Query (Client Tel, Camion, Destination, Type)
      final matchQuery = query.isEmpty ||
          s.clientTel.toLowerCase().contains(query) ||
          s.camionNo.toLowerCase().contains(query) ||
          s.destination.toLowerCase().contains(query) ||
          (s.typeCiment?.toLowerCase().contains(query) ?? false);

      // 2. Camion Filter
      final matchCamion = _selectedCamion == null ||
          s.camionNo.toLowerCase() == _selectedCamion!.toLowerCase();

      // 3. Statut Filter
      bool matchStatut = true;
      if (_selectedStatut != null) {
        if (_selectedStatut == "Payé") {
          matchStatut = s.statutPaiement.toLowerCase() == "payé" || s.statutPaiement.toLowerCase() == "paye";
        } else if (_selectedStatut == "Non Payé") {
          matchStatut = s.statutPaiement.toLowerCase() == "non payé" || s.statutPaiement.toLowerCase() == "non paye" || s.statutPaiement.isEmpty;
        } else if (_selectedStatut == "Partiel") {
          matchStatut = s.statutPaiement.toLowerCase() == "partiel" || s.statutPaiement.toLowerCase() == "partiellement payé";
        }
      }

      return matchQuery && matchCamion && matchStatut;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final cimentProvider = Provider.of<CimentProvider>(context);

    final allShipments = cimentProvider.shipments;
    final filteredShipments = _getFilteredShipments(allShipments);

    // Dynamic stats based on filtered shipments
    double currentTonnage = 0.0;
    double currentFacture = 0.0;
    double currentEncaisse = 0.0;
    for (var s in filteredShipments) {
      currentTonnage += s.tonnage;
      currentFacture += s.total;
      currentEncaisse += s.montantPaye;
    }
    double currentReste = currentFacture - currentEncaisse;

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
          "Gestion Ciment",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20, color: Colors.white),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list_rounded, color: Colors.white),
            onPressed: () => _showFilterDialog(allShipments),
            tooltip: "Filtrer la liste",
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _fetchShipments,
            tooltip: "Rafraîchir",
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          _buildStatsCards(currentTonnage, currentFacture, currentEncaisse, currentReste),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : filteredShipments.isEmpty
                    ? Center(
                        child: Text(
                          _searchController.text.isEmpty && _selectedCamion == null && _selectedStatut == null && _dateRange == null
                              ? "Aucun chargement enregistré"
                              : "Aucun résultat pour vos filtres",
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                        itemCount: filteredShipments.length,
                        itemBuilder: (context, index) {
                          return _buildShipmentCard(filteredShipments[index], auth);
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          bool? result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AddCimentScreen()),
          );
          if (result == true) _fetchShipments();
        },
        backgroundColor: _primaryColor,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text("Nouveau Chargement", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
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
          hintText: "Rechercher par client, camion, destination...",
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
          prefixIcon: Icon(Icons.search_rounded, color: _primaryColor, size: 24),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.cancel_rounded, color: Colors.grey),
                  onPressed: () {
                    _searchController.clear();
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

  Widget _buildStatsCards(double tonnage, double facture, double encaisse, double reste) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
      height: 110,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          _buildStatCard(
            "Tonnage Total",
            "${tonnage.toStringAsFixed(2)} T",
            [const Color(0xFF4F46E5), const Color(0xFF6366F1)],
            Icons.precision_manufacturing_rounded,
          ),
          _buildStatCard(
            "Total Facturé",
            "${_numberFormat.format(facture)} F",
            [const Color(0xFF0F172A), const Color(0xFF1E293B)],
            Icons.receipt_long_rounded,
          ),
          _buildStatCard(
            "Total Encaissé",
            "${_numberFormat.format(encaisse)} F",
            [const Color(0xFF059669), const Color(0xFF10B981)],
            Icons.account_balance_wallet_rounded,
          ),
          _buildStatCard(
            "Reste à Payer",
            "${_numberFormat.format(reste)} F",
            reste > 0
                ? [const Color(0xFFDC2626), const Color(0xFFEF4444)]
                : [const Color(0xFF2563EB), const Color(0xFF3B82F6)],
            Icons.money_off_rounded,
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, List<Color> colors, IconData icon) {
    return Container(
      width: 160,
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
            color: colors[0].withOpacity(0.25),
            blurRadius: 8,
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
              color: Colors.white.withOpacity(0.12),
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

  Widget _buildShipmentCard(CimentShipment s, AuthProvider auth) {
    final double reste = s.total - s.montantPaye;
    final bool isUnpaid = s.statutPaiement.toLowerCase().contains("non") || s.statutPaiement.isEmpty;
    final bool isPaid = s.statutPaiement.toLowerCase() == "payé" || s.statutPaiement.toLowerCase() == "paye";

    Color statusBgColor;
    Color statusTextColor;
    Color statusDotColor;

    if (isPaid) {
      statusBgColor = const Color(0xFFECFDF5);
      statusTextColor = const Color(0xFF047857);
      statusDotColor = const Color(0xFF10B981);
    } else if (isUnpaid) {
      statusBgColor = const Color(0xFFFFF1F2);
      statusTextColor = const Color(0xFFBE123C);
      statusDotColor = const Color(0xFFF43F5E);
    } else {
      // Partiel
      statusBgColor = const Color(0xFFFEF3C7);
      statusTextColor = const Color(0xFFB45309);
      statusDotColor = const Color(0xFFF59E0B);
    }

    DateTime? dateParsed = DateTime.tryParse(s.createdAt);
    String formattedDate = dateParsed != null ? _dateFormat.format(dateParsed) : s.createdAt;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      color: const Color(0xFF0F172A), // Dark slate
      elevation: 4,
      shadowColor: Colors.black38,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(
          color: Colors.white.withOpacity(0.05),
          width: 1.5,
        ),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => _showOptions(s, auth),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "RÉF: CIM-${s.id.substring(0, 8).toUpperCase()}",
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF818CF8),
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
                          s.statutPaiement.toUpperCase(),
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
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Divider(color: Colors.white12, height: 1),
              ),

              // Details
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildInfoLabel("CLIENT"),
                        Text(s.clientTel, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        const SizedBox(height: 10),
                        _buildInfoLabel("DESTINATION"),
                        Text(s.destination, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                        const SizedBox(height: 10),
                        _buildInfoLabel("TYPE CIMENT"),
                        Text(s.typeCiment ?? "Standard", style: const TextStyle(color: Colors.white70, fontSize: 13)),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildInfoLabel("CAMION"),
                        Text(s.camionNo.toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        const SizedBox(height: 10),
                        _buildInfoLabel("LOGISTIQUE"),
                        Text("Tonnage: ${s.tonnage.toStringAsFixed(2)} T\nP.U: ${_numberFormat.format(s.pu)} F", style: const TextStyle(color: Colors.white70, fontSize: 13)),
                      ],
                    ),
                  ),
                ],
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Divider(color: Colors.white12, height: 1),
              ),

              // Financial Summaries
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildInfoLabel("TOTAL FACTURÉ"),
                      Text("${_numberFormat.format(s.total)} F", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 15)),
                    ],
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      _buildInfoLabel("RESTE À PAYER"),
                      Text(
                        "${_numberFormat.format(reste)} F",
                        style: TextStyle(
                          color: reste > 0 ? const Color(0xFFF43F5E) : const Color(0xFF10B981),
                          fontWeight: FontWeight.w900,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    "Par: ${s.utilisateur ?? 'N/A'}",
                    style: const TextStyle(color: Colors.white30, fontSize: 10),
                  ),
                  Text(
                    formattedDate,
                    style: const TextStyle(color: Colors.white30, fontSize: 10),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoLabel(String text) {
    return Text(
      text,
      style: const TextStyle(color: Colors.white38, fontSize: 9, fontWeight: FontWeight.bold, letterSpacing: 0.5),
    );
  }

  void _showOptions(CimentShipment s, AuthProvider auth) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: Text(
                  "OPTIONS CHARGEMENT - CIM-${s.id.substring(0, 8).toUpperCase()}",
                  style: const TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
              ),
              const Divider(color: Colors.white12),
              ListTile(
                leading: const Icon(Icons.payment_rounded, color: Colors.green),
                title: const Text("Règlements & Paiements", style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => CimentPaymentsScreen(shipment: s),
                    ),
                  ).then((_) => _fetchShipments());
                },
              ),
              ListTile(
                leading: const Icon(Icons.print_rounded, color: Colors.blue),
                title: const Text("Facturation (Imprimer / Partager)", style: TextStyle(color: Colors.white)),
                onTap: () async {
                  Navigator.pop(ctx);
                  _generateAndPreviewInvoice(s);
                },
              ),
              ListTile(
                leading: const Icon(Icons.edit_rounded, color: Colors.orange),
                title: const Text("Modifier le chargement", style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(ctx);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => AddCimentScreen(shipment: s),
                    ),
                  ).then((value) {
                    if (value == true) _fetchShipments();
                  });
                },
              ),
              if (auth.isAdmin)
                ListTile(
                  leading: const Icon(Icons.delete_forever_rounded, color: Colors.red),
                  title: const Text("Supprimer le chargement", style: TextStyle(color: Colors.white)),
                  onTap: () {
                    Navigator.pop(ctx);
                    _confirmDelete(s);
                  },
                ),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  Future<void> _generateAndPreviewInvoice(CimentShipment s) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final cimentProvider = Provider.of<CimentProvider>(context, listen: false);

    // Show loading
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final api = ApiService();
      final companyInfoMap = await api.getCompanyInfo(auth.token!);
      final company = CompanyInfo.fromJson(companyInfoMap);

      final payments = await cimentProvider.fetchPayments(auth, s.id);

      if (mounted) Navigator.pop(context); // Dismiss loading

      if (mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => PdfPreviewScreen(
              invoiceRef: "CIM-${s.id.substring(0, 8).toUpperCase()}",
              buildPdf: (format) => PdfCimentGenerator.generateInvoice(
                company: company,
                shipment: s,
                payments: payments,
                createdBy: auth.username ?? "Caissier",
                pageFormat: format,
              ),
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) Navigator.pop(context); // Dismiss loading
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Erreur génération facture: $e")),
      );
    }
  }

  void _confirmDelete(CimentShipment s) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text("Supprimer Chargement", style: TextStyle(color: Colors.white)),
        content: Text("Voulez-vous vraiment supprimer le chargement CIM-${s.id.substring(0, 8).toUpperCase()} ainsi que tous ses règlements ? Cette action est irréversible.", style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Annuler", style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              final auth = Provider.of<AuthProvider>(context, listen: false);
              final provider = Provider.of<CimentProvider>(context, listen: false);
              
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (_) => const Center(child: CircularProgressIndicator()),
              );

              try {
                await provider.deleteShipment(auth, s.id);
                if (mounted) {
                  Navigator.pop(context); // Dismiss loading indicator
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Chargement supprimé avec succès")),
                  );
                  _fetchShipments();
                }
              } catch (e) {
                if (mounted) {
                  Navigator.pop(context); // Dismiss loading indicator
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text("Erreur lors de la suppression: $e")),
                  );
                }
              }
            },
            child: const Text("Supprimer", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showFilterDialog(List<CimentShipment> list) {
    // Collect unique truck numbers
    final camions = list.map((s) => s.camionNo.trim()).where((c) => c.isNotEmpty).toSet().toList();
    camions.sort();

    showDialog(
      context: context,
      builder: (ctx) {
        String? tempCamion = _selectedCamion;
        String? tempStatut = _selectedStatut;
        DateTimeRange? tempRange = _dateRange;

        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              title: const Text("Filtrer la liste", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("Camion", style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      dropdownColor: const Color(0xFF1E293B),
                      value: tempCamion,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.05),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                      items: [
                        const DropdownMenuItem(value: null, child: Text("Tous les camions")),
                        ...camions.map((c) => DropdownMenuItem(value: c, child: Text(c.toUpperCase()))),
                      ],
                      onChanged: (val) => setDialogState(() => tempCamion = val),
                    ),
                    const SizedBox(height: 16),
                    const Text("Statut de Paiement", style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      dropdownColor: const Color(0xFF1E293B),
                      value: tempStatut,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.05),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                      items: const [
                        DropdownMenuItem(value: null, child: Text("Tous les statuts")),
                        DropdownMenuItem(value: "Payé", child: Text("Payé")),
                        DropdownMenuItem(value: "Partiel", child: Text("Partiellement Payé")),
                        DropdownMenuItem(value: "Non Payé", child: Text("Non Payé")),
                      ],
                      onChanged: (val) => setDialogState(() => tempStatut = val),
                    ),
                    const SizedBox(height: 16),
                    const Text("Période", style: TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 8),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white.withOpacity(0.05),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        alignment: Alignment.centerLeft,
                      ),
                      onPressed: () async {
                        final range = await showDateRangePicker(
                          context: context,
                          initialDateRange: tempRange,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                          builder: (context, child) {
                            return Theme(
                              data: Theme.of(context).copyWith(
                                colorScheme: ColorScheme.dark(
                                  primary: _primaryColor,
                                  onPrimary: Colors.white,
                                  surface: const Color(0xFF1E293B),
                                  onSurface: Colors.white,
                                ),
                              ),
                              child: child!,
                            );
                          },
                        );
                        if (range != null) {
                          setDialogState(() => tempRange = range);
                        }
                      },
                      icon: const Icon(Icons.date_range),
                      label: Text(
                        tempRange == null
                            ? "Toutes les dates"
                            : "${DateFormat('dd/MM/yy').format(tempRange!.start)} - ${DateFormat('dd/MM/yy').format(tempRange!.end)}",
                      ),
                    ),
                    if (tempRange != null)
                      TextButton(
                        onPressed: () => setDialogState(() => tempRange = null),
                        child: const Text("Réinitialiser les dates", style: TextStyle(color: Colors.redAccent)),
                      ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text("Annuler", style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: _primaryColor),
                  onPressed: () {
                    setState(() {
                      _selectedCamion = tempCamion;
                      _selectedStatut = tempStatut;
                      _dateRange = tempRange;
                    });
                    Navigator.pop(ctx);
                    _fetchShipments(); // reload with range filters if needed
                  },
                  child: const Text("Appliquer", style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
