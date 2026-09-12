import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../providers/auth_provider.dart';
import '../providers/rent_provider.dart';
import '../models/rent_payment_model.dart';
import '../models/contract_model.dart';
import '../api/api_service.dart';
import '../models/company_model.dart';
import '../utils/pdf_rent_payment_generator.dart';
import 'pdf_preview_screen.dart';

class RentPaymentsListScreen extends StatefulWidget {
  const RentPaymentsListScreen({super.key});

  @override
  State<RentPaymentsListScreen> createState() => _RentPaymentsListScreenState();
}

class _RentPaymentsListScreenState extends State<RentPaymentsListScreen> {
  final TextEditingController _locataireController = TextEditingController();
  final TextEditingController _moisController = TextEditingController();
  final NumberFormat _numberFormat = NumberFormat("#,##0", "fr_FR");
  final DateFormat _dateFormat = DateFormat("dd/MM/yyyy");

  String _selectedMode = "Tous";
  DateTime? _startDate;
  DateTime? _endDate;
  List<RentPayment> _payments = [];
  bool _isLoading = true;

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF8FAFF);

  @override
  void initState() {
    super.initState();
    _fetchPayments();
  }

  @override
  void dispose() {
    _locataireController.dispose();
    _moisController.dispose();
    super.dispose();
  }

  Future<void> _fetchPayments() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final rentProvider = Provider.of<RentProvider>(context, listen: false);
    setState(() => _isLoading = true);

    try {
      final DateFormat apiFormat = DateFormat('yyyy-MM-dd');
      final filters = {
        if (_locataireController.text.trim().isNotEmpty) "locataire": _locataireController.text.trim(),
        if (_moisController.text.trim().isNotEmpty) "mois": _moisController.text.trim(),
        if (_selectedMode != "Tous") "mode": _selectedMode,
        if (_startDate != null) "start_date": apiFormat.format(_startDate!),
        if (_endDate != null) "end_date": apiFormat.format(_endDate!),
      };

      await rentProvider.fetchPayments(auth, forceRefresh: true, filters: filters);
      if (mounted) {
        setState(() {
          _payments = rentProvider.payments;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint("Error fetching rent payments: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _clearFilters() {
    setState(() {
      _locataireController.clear();
      _moisController.clear();
      _selectedMode = "Tous";
      _startDate = null;
      _endDate = null;
    });
    _fetchPayments();
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
          "Paiements Loyers",
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _fetchPayments,
          ),
        ],
      ),
      body: Column(
        children: [
          _buildFilterPanel(),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : _payments.isEmpty
                    ? Center(
                        child: Text(
                          "Aucun paiement trouvé",
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        itemCount: _payments.length,
                        itemBuilder: (context, index) {
                          return _buildPaymentCard(_payments[index], auth);
                        },
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterPanel() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
        border: Border.all(color: const Color(0xFFE2E8F0)), // Slate border
      ),
      child: ExpansionTile(
        title: const Text(
          "Filtres de recherche",
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF1E293B)),
        ),
        leading: Icon(Icons.filter_alt_rounded, color: _primaryColor, size: 20),
        dense: true,
        collapsedIconColor: const Color(0xFF64748B),
        iconColor: _primaryColor,
        shape: const Border(), // remove line separator of ExpansionTile
        collapsedShape: const Border(),
        childrenPadding: const EdgeInsets.only(bottom: 12, left: 4, right: 4),
        children: [
          TextField(
            controller: _locataireController,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              labelText: "Nom Locataire",
              labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
              prefixIcon: Icon(Icons.person, size: 18, color: _primaryColor),
              filled: true,
              fillColor: const Color(0xFFF8FAFF),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 8),
            ),
            onSubmitted: (_) => _fetchPayments(),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _moisController,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                  decoration: InputDecoration(
                    labelText: "Mois (ex: Mai)",
                    labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                    prefixIcon: Icon(Icons.date_range, size: 18, color: _primaryColor),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFF),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  onSubmitted: (_) => _fetchPayments(),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _selectedMode,
                  style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B), fontWeight: FontWeight.w500),
                  items: ["Tous", "Espèces", "Chèque", "Mobile Money", "Virement"]
                      .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                      .toList(),
                  onChanged: (v) => setState(() => _selectedMode = v.toString()),
                  decoration: InputDecoration(
                    labelText: "Mode",
                    labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFF),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _startDate ?? DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) setState(() => _startDate = picked);
                  },
                  icon: Icon(Icons.calendar_today_rounded, size: 14, color: _primaryColor),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  label: Text(
                    _startDate != null ? _dateFormat.format(_startDate!) : "Date Début",
                    style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B), fontWeight: FontWeight.bold),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _endDate ?? DateTime.now(),
                      firstDate: _startDate ?? DateTime(2020),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) setState(() => _endDate = picked);
                  },
                  icon: Icon(Icons.calendar_today_rounded, size: 14, color: _primaryColor),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    side: const BorderSide(color: Color(0xFFCBD5E1)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  label: Text(
                    _endDate != null ? _dateFormat.format(_endDate!) : "Date Fin",
                    style: const TextStyle(fontSize: 12, color: Color(0xFF1E293B), fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: _clearFilters,
                child: const Text("Réinitialiser", style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 10),
              ElevatedButton.icon(
                onPressed: _fetchPayments,
                icon: const Icon(Icons.search, size: 16, color: Colors.white),
                label: const Text("Filtrer", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _primaryColor,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentCard(RentPayment p, AuthProvider auth) {
    String formattedDate = p.datePaiement;
    try {
      formattedDate = _dateFormat.format(DateTime.parse(p.datePaiement));
    } catch (_) {}

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      color: const Color(0xFF0F172A), // Premium dark slate card background
      elevation: 4,
      shadowColor: Colors.black38,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(
          color: Colors.white.withOpacity(0.05),
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header Row (Ref & Date)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  p.refLocataire ?? "PAY-${p.id}",
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF818CF8), // indigo-400
                    fontSize: 12,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  formattedDate,
                  style: const TextStyle(
                    color: Colors.white60,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Locataire Name & Avatar
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: Colors.white.withOpacity(0.08),
                  child: Text(
                    p.locataireNomComplet != null && p.locataireNomComplet!.isNotEmpty
                        ? p.locataireNomComplet![0].toUpperCase()
                        : "?",
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.locataireNomComplet ?? "Locataire Inconnu",
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 15,
                          color: Colors.white,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        p.bienLoueDetails ?? "-",
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
            
            if (p.nomDeMois != null && p.nomDeMois!.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF4A00E0).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  "Période: ${p.nomDeMois}",
                  style: const TextStyle(
                    color: Color(0xFFC084FC), // light purple
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],

            const Padding(
              padding: EdgeInsets.symmetric(vertical: 14),
              child: Divider(height: 1, thickness: 0.6, color: Colors.white12),
            ),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "MODE PAIEMENT",
                      style: TextStyle(
                        fontSize: 8,
                        color: Colors.white38,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      p.modePaiement.toUpperCase(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 12,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      "MONTANT VERSÉ",
                      style: TextStyle(
                        fontSize: 8,
                        color: Colors.white38,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      "${_numberFormat.format(p.montant)} F",
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                        color: Color(0xFF34D399), // emerald-400
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                ElevatedButton.icon(
                  onPressed: () => _printReceipt(p, auth),
                  icon: const Icon(Icons.print_rounded, size: 14, color: Colors.white),
                  label: const Text(
                    "Imprimer reçu",
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF4F46E5), // Indigo
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _printReceipt(RentPayment p, AuthProvider auth) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final api = ApiService();
      final companyInfoMap = await api.getCompanyInfo(auth.token!);
      final companyInfo = CompanyInfo.fromJson(companyInfoMap);
      
      // Let's fetch details of the contract so we can populate PDF exactly
      final contractMap = await api.getContractDetails(p.contratId, auth.token!);
      if (contractMap == null) throw Exception("Impossible de charger les données du contrat.");
      
      final contract = Contract.fromJson(contractMap);

      if (mounted) Navigator.pop(context); // Close loader

      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => PdfPreviewScreen(
              invoiceRef: "LOY-PAY-${p.id}",
              buildPdf: (format) async {
                return PdfRentPaymentGenerator.generateReceipt(
                  company: companyInfo,
                  contract: contract,
                  payment: p,
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
        SnackBar(content: Text("Erreur de génération PDF: $e"), backgroundColor: Colors.red),
      );
    }
  }
}
