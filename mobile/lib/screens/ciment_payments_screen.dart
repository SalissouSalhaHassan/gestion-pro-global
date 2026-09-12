import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../providers/auth_provider.dart';
import '../providers/ciment_provider.dart';
import '../models/ciment_model.dart';

class CimentPaymentsScreen extends StatefulWidget {
  final CimentShipment shipment;
  const CimentPaymentsScreen({super.key, required this.shipment});

  @override
  State<CimentPaymentsScreen> createState() => _CimentPaymentsScreenState();
}

class _CimentPaymentsScreenState extends State<CimentPaymentsScreen> {
  final NumberFormat _numberFormat = NumberFormat("#,##0", "fr_FR");
  final DateFormat _dateFormat = DateFormat('dd/MM/yyyy');

  List<CimentPayment> _payments = [];
  bool _isLoading = true;
  double _montantPayeActuel = 0.0;

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF8FAFF);

  @override
  void initState() {
    super.initState();
    _fetchPayments();
  }

  Future<void> _fetchPayments() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final cimentProvider = Provider.of<CimentProvider>(context, listen: false);
    setState(() => _isLoading = true);

    try {
      final list = await cimentProvider.fetchPayments(auth, widget.shipment.id);
      double totalPaid = 0.0;
      for (var p in list) {
        totalPaid += p.montant;
      }
      if (mounted) {
        setState(() {
          _payments = list;
          _montantPayeActuel = totalPaid;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint("Error fetching payments: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  double get _resteAPayer {
    // We use the local totalPaid count or fallback to shipment if local loading isn't done.
    final double paid = _isLoading ? widget.shipment.montantPaye : _montantPayeActuel;
    return (widget.shipment.total - paid).clamp(0.0, 999999999.0);
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
          "Règlements CIM-${widget.shipment.id.substring(0, 8).toUpperCase()}",
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
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
          _buildShipmentSummaryCard(),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                Icon(Icons.history_rounded, size: 16, color: Colors.black54),
                SizedBox(width: 6),
                Text(
                  "HISTORIQUE DES ENCAISSEMENTS",
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: Colors.black54, letterSpacing: 0.5),
                ),
              ],
            ),
          ),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : _payments.isEmpty
                    ? const Center(
                        child: Text(
                          "Aucun paiement enregistré pour ce chargement",
                          style: TextStyle(color: Colors.grey, fontSize: 14),
                          textAlign: TextAlign.center,
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemCount: _payments.length,
                        itemBuilder: (context, index) {
                          return _buildPaymentRow(_payments[index], auth);
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: _resteAPayer > 0
          ? FloatingActionButton.extended(
              onPressed: () => _showAddPaymentDialog(auth),
              backgroundColor: _primaryColor,
              icon: const Icon(Icons.add_card_rounded, color: Colors.white),
              label: const Text("Encaisser un règlement", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            )
          : null,
    );
  }

  Widget _buildShipmentSummaryCard() {
    final double paid = _isLoading ? widget.shipment.montantPaye : _montantPayeActuel;
    final double reste = _resteAPayer;

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A), // Dark Slate
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.15),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "CAMION : ${widget.shipment.camionNo.toUpperCase()}",
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
              ),
              Text(
                "Client: ${widget.shipment.clientTel}",
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _summaryTextRow("Destination :", widget.shipment.destination),
          _summaryTextRow("Tonnage :", "${widget.shipment.tonnage.toStringAsFixed(2)} Tonnes"),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8.0),
            child: Divider(color: Colors.white10),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("TOTAL TTC", style: TextStyle(color: Colors.white38, fontSize: 9, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text("${_numberFormat.format(widget.shipment.total)} F", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  const Text("DÉJÀ ENCAISSÉ", style: TextStyle(color: Colors.white38, fontSize: 9, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text("${_numberFormat.format(paid)} F", style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text("RESTE A PAYER", style: TextStyle(color: Colors.white38, fontSize: 9, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text(
                    "${_numberFormat.format(reste)} F",
                    style: TextStyle(
                      color: reste > 0 ? const Color(0xFFF43F5E) : const Color(0xFF10B981),
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryTextRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12)),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildPaymentRow(CimentPayment p, AuthProvider auth) {
    DateTime? parsed = DateTime.tryParse(p.datePaiement);
    String formattedDate = parsed != null ? _dateFormat.format(parsed) : p.datePaiement;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: _primaryColor.withOpacity(0.08),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.monetization_on_rounded, color: _primaryColor, size: 20),
        ),
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              "${_numberFormat.format(p.montant)} FCFA",
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
            ),
            Text(
              p.moyenPaiement.toUpperCase(),
              style: TextStyle(
                color: p.moyenPaiement == "Avance Client" ? Colors.blue.shade700 : Colors.green.shade700,
                fontWeight: FontWeight.w900,
                fontSize: 10,
              ),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(
              "Réf: ${p.reference ?? '-'}",
              style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Encaissé par: ${p.utilisateur ?? 'Collaborateur'}", style: TextStyle(color: Colors.grey.shade500, fontSize: 9)),
                Text(formattedDate, style: TextStyle(color: Colors.grey.shade500, fontSize: 9)),
              ],
            ),
          ],
        ),
        trailing: auth.isAdmin
            ? IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                onPressed: () => _confirmDeletePayment(p),
              )
            : null,
      ),
    );
  }

  void _showAddPaymentDialog(AuthProvider auth) {
    final formKey = GlobalKey<FormState>();
    final amountController = TextEditingController(text: _resteAPayer.toInt().toString());
    final refController = TextEditingController();
    String selectedMoyen = "Espèces";

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              title: const Text("Encaisser Règlement", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              content: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Reste à payer : ${_numberFormat.format(_resteAPayer)} FCFA",
                        style: const TextStyle(color: Colors.white60, fontSize: 12),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: amountController,
                        style: const TextStyle(color: Colors.white),
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: "Montant *",
                          labelStyle: const TextStyle(color: Colors.white70),
                          filled: true,
                          fillColor: Colors.white.withOpacity(0.05),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return "Montant requis";
                          final val = double.tryParse(v);
                          if (val == null || val <= 0) return "Montant invalide";
                          if (val > _resteAPayer + 0.1) {
                            return "Le montant dépasse le reste (${_resteAPayer.toInt()} F)";
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        dropdownColor: const Color(0xFF1E293B),
                        value: selectedMoyen,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          labelText: "Moyen de Paiement *",
                          labelStyle: const TextStyle(color: Colors.white70),
                          filled: true,
                          fillColor: Colors.white.withOpacity(0.05),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                        items: const [
                          DropdownMenuItem(value: "Espèces", child: Text("Espèces")),
                          DropdownMenuItem(value: "Chèque", child: Text("Chèque")),
                          DropdownMenuItem(value: "Virement", child: Text("Virement")),
                          DropdownMenuItem(value: "Avance Client", child: Text("Avance Client")),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setDialogState(() => selectedMoyen = val);
                          }
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: refController,
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          labelText: "Référence / Détails",
                          labelStyle: const TextStyle(color: Colors.white70),
                          filled: true,
                          fillColor: Colors.white.withOpacity(0.05),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text("Annuler", style: TextStyle(color: Colors.grey)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: _primaryColor),
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    Navigator.pop(ctx); // Dismiss dialog
                    
                    // Show loading indicator
                    showDialog(
                      context: context,
                      barrierDismissible: false,
                      builder: (_) => const Center(child: CircularProgressIndicator()),
                    );

                    final navigator = Navigator.of(context);
                    final scaffoldMessenger = ScaffoldMessenger.of(context);

                    try {
                      final provider = Provider.of<CimentProvider>(context, listen: false);
                      await provider.addPayment(
                        auth,
                        widget.shipment.id,
                        {
                          "montant": double.parse(amountController.text.trim()),
                          "moyen": selectedMoyen,
                          "reference": refController.text.trim().isEmpty ? null : refController.text.trim(),
                        },
                      );
                      
                      navigator.pop(); // Dismiss loading
                      scaffoldMessenger.showSnackBar(
                        const SnackBar(content: Text("Paiement enregistré avec succès !", style: TextStyle(color: Colors.white)), backgroundColor: Colors.green),
                      );
                      _fetchPayments();
                    } catch (e) {
                      navigator.pop(); // Dismiss loading
                      if (mounted) {
                        showDialog(
                          context: context,
                          builder: (c) => AlertDialog(
                            backgroundColor: const Color(0xFF1E293B),
                            title: const Text("Erreur lors du paiement", style: TextStyle(color: Colors.white)),
                            content: Text(
                              e.toString().replaceAll("Exception: ", ""),
                              style: const TextStyle(color: Colors.white70),
                            ),
                            actions: [
                              TextButton(onPressed: () => Navigator.pop(c), child: const Text("OK")),
                            ],
                          ),
                        );
                      }
                    }
                  },
                  child: const Text("Valider", style: TextStyle(color: Colors.white)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _confirmDeletePayment(CimentPayment p) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: const Text("Supprimer Paiement", style: TextStyle(color: Colors.white)),
        content: Text("Voulez-vous vraiment supprimer ce règlement de ${_numberFormat.format(p.montant)} FCFA ? Si le règlement a été effectué par Avance Client, l'avance sera créditée automatiquement.", style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Annuler", style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              
              showDialog(
                context: context,
                barrierDismissible: false,
                builder: (_) => const Center(child: CircularProgressIndicator()),
              );

              final navigator = Navigator.of(context);
              final scaffoldMessenger = ScaffoldMessenger.of(context);

              try {
                final auth = Provider.of<AuthProvider>(context, listen: false);
                final provider = Provider.of<CimentProvider>(context, listen: false);
                await provider.deletePayment(auth, p.id, widget.shipment.id);
                
                navigator.pop(); // Dismiss loading
                scaffoldMessenger.showSnackBar(
                  const SnackBar(content: Text("Règlement supprimé")),
                );
                _fetchPayments();
              } catch (e) {
                navigator.pop(); // Dismiss loading
                scaffoldMessenger.showSnackBar(
                  SnackBar(content: Text("Erreur: $e")),
                );
              }
            },
            child: const Text("Supprimer", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
