import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../providers/auth_provider.dart';
import '../providers/rent_provider.dart';
import '../models/contract_model.dart';
import '../models/rent_payment_model.dart';
import '../api/api_service.dart';
import '../models/company_model.dart';
import '../utils/pdf_rent_payment_generator.dart';
import 'pdf_preview_screen.dart';

class ContractDetailsScreen extends StatefulWidget {
  final int contractId;
  const ContractDetailsScreen({super.key, required this.contractId});

  @override
  State<ContractDetailsScreen> createState() => _ContractDetailsScreenState();
}

class _ContractDetailsScreenState extends State<ContractDetailsScreen> {
  final NumberFormat _numberFormat = NumberFormat("#,##0", "fr_FR");
  final DateFormat _dateFormat = DateFormat("dd/MM/yyyy");

  Contract? _contract;
  List<RentPayment> _payments = [];
  bool _isLoading = true;

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF8FAFF);

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final rentProvider = Provider.of<RentProvider>(context, listen: false);
    setState(() => _isLoading = true);

    try {
      // Fetch details from API/Supabase
      final dataMap = await ApiService().getContractDetails(widget.contractId, auth.token!);
      if (dataMap != null) {
        _contract = Contract.fromJson(dataMap);
        _payments = await rentProvider.fetchPaymentsForContract(auth, widget.contractId);
      }
    } catch (e) {
      debugPrint("Error loading contract details: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
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
        title: Text(
          _contract != null ? "Contrat: ${_contract!.refLocataire}" : "Chargement...",
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _loadData,
          )
        ],
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: _primaryColor))
          : _contract == null
              ? const Center(child: Text("Contrat introuvable"))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLocataireProfile(),
                      const SizedBox(height: 16),
                      _buildFinancialSummary(),
                      const SizedBox(height: 16),
                      _buildPropertyDetails(),
                      const SizedBox(height: 20),
                      _buildPaymentsHistoryHeader(auth),
                      const SizedBox(height: 10),
                      _buildPaymentsList(auth),
                    ],
                  ),
                ),
    );
  }

  Widget _buildLocataireProfile() {
    // Status style matching web app
    Color statusBgColor;
    Color statusTextColor;
    Color statusDotColor;
    if (_contract!.statut == "Actif") {
      statusBgColor = const Color(0xFFECFDF5);
      statusTextColor = const Color(0xFF047857);
      statusDotColor = const Color(0xFF10B981);
    } else if (_contract!.statut == "Expiré") {
      statusBgColor = const Color(0xFFFEF3C7);
      statusTextColor = const Color(0xFFB45309);
      statusDotColor = const Color(0xFFF59E0B);
    } else {
      statusBgColor = const Color(0xFFFFF1F2);
      statusTextColor = const Color(0xFFBE123C);
      statusDotColor = const Color(0xFFF43F5E);
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A), // Premium dark slate background
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: Colors.white.withOpacity(0.08),
            child: Text(
              _contract!.locataireNomComplet.isNotEmpty ? _contract!.locataireNomComplet[0].toUpperCase() : "?",
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 24),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _contract!.locataireNomComplet,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
                ),
                if (_contract!.locataireTelephone != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.phone, size: 14, color: Colors.white60),
                      const SizedBox(width: 6),
                      Text(
                        _contract!.locataireTelephone!,
                        style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ],
                if (_contract!.locataireEmail != null) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      const Icon(Icons.email, size: 14, color: Colors.white60),
                      const SizedBox(width: 6),
                      Text(
                        _contract!.locataireEmail!,
                        style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBgColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(color: statusDotColor, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _contract!.statut.toUpperCase(),
                        style: TextStyle(color: statusTextColor, fontWeight: FontWeight.w900, fontSize: 10, letterSpacing: 0.5),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFinancialSummary() {
    final bool isLate = _contract!.retards > 0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A), // Premium dark slate background
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "RÉSUMÉ FINANCIER",
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10, color: Colors.white38, letterSpacing: 0.8),
          ),
          const SizedBox(height: 14),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildFinanceColumn("Loyer mensuel", "${_numberFormat.format(_contract!.loyerMensuel)} F", const Color(0xFF34D399)),
              _buildFinanceColumn("Total payé", "${_numberFormat.format(_contract!.totalPaye)} F", const Color(0xFF34D399)),
              _buildFinanceColumn("Caution", "${_numberFormat.format(_contract!.caution)} F", const Color(0xFF818CF8)),
            ],
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Divider(thickness: 0.8, color: Colors.white.withOpacity(0.05)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Solde Retards",
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white38, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    "${_numberFormat.format(_contract!.retards)} F",
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: isLate ? const Color(0xFFF87171) : const Color(0xFF34D399),
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    "Prochaine Échéance",
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white38, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _contract!.echeance,
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: isLate ? const Color(0xFFF87171) : const Color(0xFF818CF8),
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (isLate && _contract!.moisImpayes.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(8),
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withOpacity(0.08),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.15)),
              ),
              child: Text(
                "Mois impayés : ${_contract!.moisImpayes}",
                style: const TextStyle(color: Color(0xFFF87171), fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFinanceColumn(String label, String value, Color valueColor) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(color: valueColor, fontSize: 15, fontWeight: FontWeight.w900)),
      ],
    );
  }

  Widget _buildPropertyDetails() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A), // Premium dark slate background
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "DÉTAILS DU BIEN",
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10, color: Colors.white38, letterSpacing: 0.8),
          ),
          const SizedBox(height: 12),
          _buildDetailRow(Icons.business_center_rounded, "Type de bien", _contract!.typeBien ?? "Non spécifié"),
          _buildDetailRow(Icons.info_outline, "Description", _contract!.bienLoueDetails),
          _buildDetailRow(Icons.map_rounded, "Quartier", _contract!.quartier ?? "Non spécifié"),
          _buildDetailRow(
            Icons.date_range_rounded,
            "Date début de contrat",
            _contract!.moisDebut != null && _contract!.anneeDebut != null
                ? "${_getMonthName(_contract!.moisDebut!)} ${_contract!.anneeDebut}"
                : "Non spécifié",
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF818CF8)),
          const SizedBox(width: 8),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("$label: ", style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.white60)),
                Expanded(
                  child: Text(
                    value,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentsHistoryHeader(AuthProvider auth) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          "Historique des paiements",
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
        ),
        if (_contract!.statut == "Actif")
          TextButton.icon(
            onPressed: () => _showPaymentModal(_contract!, auth),
            icon: const Icon(Icons.add, size: 16),
            label: const Text("Enregistrer", style: TextStyle(fontWeight: FontWeight.bold)),
            style: TextButton.styleFrom(
              foregroundColor: Colors.green,
            ),
          )
      ],
    );
  }

  Widget _buildPaymentsList(AuthProvider auth) {
    if (_payments.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 30),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Center(
          child: Text(
            "Aucun paiement enregistré pour ce contrat.",
            style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold),
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _payments.length,
      itemBuilder: (context, index) {
        final p = _payments[index];
        
        String formattedDate = p.datePaiement;
        try {
          formattedDate = _dateFormat.format(DateTime.parse(p.datePaiement));
        } catch (_) {}

        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: Colors.green.withOpacity(0.1),
              child: const Icon(Icons.check, color: Colors.green, size: 20),
            ),
            title: Text(
              "${_numberFormat.format(p.montant)} F CFA",
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            subtitle: Text(
              "$formattedDate - ${p.modePaiement}\n${p.nomDeMois ?? ''}",
              style: const TextStyle(fontSize: 12),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: const Icon(Icons.print_rounded, color: Colors.blueGrey),
                  onPressed: () => _printPaymentReceipt(p, auth),
                ),
                if (auth.isAdmin)
                  IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                    onPressed: () => _confirmPaymentDeletion(p, auth),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _printPaymentReceipt(RentPayment p, AuthProvider auth) async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    try {
      final api = ApiService();
      final companyInfoMap = await api.getCompanyInfo(auth.token!);
      final companyInfo = CompanyInfo.fromJson(companyInfoMap);

      if (mounted) Navigator.pop(context); // Close loader

      if (mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => PdfPreviewScreen(
              invoiceRef: "LOY-PAY-${p.id}",
              buildPdf: (format) async {
                return PdfRentPaymentGenerator.generateReceipt(
                  company: companyInfo,
                  contract: _contract!,
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
        SnackBar(content: Text("Erreur PDF: $e"), backgroundColor: Colors.red),
      );
    }
  }

  void _confirmPaymentDeletion(RentPayment p, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Supprimer le paiement"),
        content: Text("Voulez-vous vraiment supprimer ce paiement de ${_numberFormat.format(p.montant)} F ?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Non")),
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
                await Provider.of<RentProvider>(context, listen: false).deletePayment(auth, p.id, widget.contractId);
                if (mounted) Navigator.pop(context); // Close loader
                _loadData();
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("Paiement supprimé"), backgroundColor: Colors.green),
                  );
                }
              } catch (e) {
                if (mounted) Navigator.pop(context); // Close loader
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text("Erreur: $e"), backgroundColor: Colors.red),
                );
              }
            },
            child: const Text("Supprimer", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  String _getMonthName(int m) {
    final list = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ];
    if (m >= 1 && m <= 12) return list[m - 1];
    return "";
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
                  const Text("Période d'occupation :", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.grey)),
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
                          
                          _loadData(); // Reload details page
                          
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
