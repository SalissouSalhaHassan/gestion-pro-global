import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';

import '../providers/auth_provider.dart';
import '../providers/ciment_provider.dart';
import '../models/ciment_model.dart';
import '../models/client_model.dart';
import '../api/api_service.dart';

class AddCimentScreen extends StatefulWidget {
  final CimentShipment? shipment; // Null for create, not null for edit
  const AddCimentScreen({super.key, this.shipment});

  @override
  State<AddCimentScreen> createState() => _AddCimentScreenState();
}

class _AddCimentScreenState extends State<AddCimentScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _clientTelController;
  late TextEditingController _camionNoController;
  late TextEditingController _destinationController;
  late TextEditingController _tonnageController;
  late TextEditingController _puController;
  late TextEditingController _fraisCimentController;
  late TextEditingController _fraisTransportController;
  
  late TextEditingController _chauffeurController;
  late TextEditingController _chauffeurTelController;
  late TextEditingController _transporteurController;
  late TextEditingController _bonsController;
  late TextEditingController _arrivageController;

  String? _selectedTypeCiment = "CPJ 45";
  final List<String> _cementTypes = ["CPJ 45", "CPJ 35", "Ciment Blanc", "Autre"];
  final TextEditingController _customTypeCimentController = TextEditingController();

  double _tvaPourcentage = 19.0;
  double _bicPourcentage = 2.0;

  // Real-time calculation values
  double _baseHT = 0.0;
  double _tva = 0.0;
  double _bic = 0.0;
  double _totalTTC = 0.0;

  bool _isLoadingClients = false;
  List<Client> _clients = [];
  bool _isSaving = false;

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);

  @override
  void initState() {
    super.initState();
    final isEditing = widget.shipment != null;

    _clientTelController = TextEditingController(text: isEditing ? widget.shipment!.clientTel : "");
    _camionNoController = TextEditingController(text: isEditing ? widget.shipment!.camionNo : "");
    _destinationController = TextEditingController(text: isEditing ? widget.shipment!.destination : "");
    _tonnageController = TextEditingController(text: isEditing ? widget.shipment!.tonnage.toString() : "");
    _puController = TextEditingController(text: isEditing ? widget.shipment!.pu.toInt().toString() : "");
    
    _fraisCimentController = TextEditingController(text: isEditing ? widget.shipment!.fraisCiment.toInt().toString() : "0");
    _fraisTransportController = TextEditingController(text: isEditing ? widget.shipment!.fraisTransport.toInt().toString() : "0");

    _chauffeurController = TextEditingController(text: isEditing ? widget.shipment!.chauffeur ?? "" : "");
    _chauffeurTelController = TextEditingController(text: isEditing ? widget.shipment!.chauffeurTel ?? "" : "");
    _transporteurController = TextEditingController(text: isEditing ? widget.shipment!.transporteur ?? "" : "");
    _bonsController = TextEditingController(text: isEditing ? widget.shipment!.bons ?? "" : "");
    _arrivageController = TextEditingController(text: isEditing ? widget.shipment!.arrivage ?? "" : "");

    if (isEditing) {
      _tvaPourcentage = widget.shipment!.tvaPourcentage;
      _bicPourcentage = widget.shipment!.bicPourcentage;
      final type = widget.shipment!.typeCiment ?? "";
      if (_cementTypes.contains(type)) {
        _selectedTypeCiment = type;
      } else {
        _selectedTypeCiment = "Autre";
        _customTypeCimentController.text = type;
      }
    }

    _tonnageController.addListener(_recalculate);
    _puController.addListener(_recalculate);
    _fraisCimentController.addListener(_recalculate);
    _fraisTransportController.addListener(_recalculate);

    _loadClients();
    _recalculate();
  }

  @override
  void dispose() {
    _clientTelController.dispose();
    _camionNoController.dispose();
    _destinationController.dispose();
    _tonnageController.dispose();
    _puController.dispose();
    _fraisCimentController.dispose();
    _fraisTransportController.dispose();
    _chauffeurController.dispose();
    _chauffeurTelController.dispose();
    _transporteurController.dispose();
    _bonsController.dispose();
    _arrivageController.dispose();
    _customTypeCimentController.dispose();
    super.dispose();
  }

  void _recalculate() {
    final ton = double.tryParse(_tonnageController.text) ?? 0.0;
    final price = double.tryParse(_puController.text) ?? 0.0;
    final fCiment = double.tryParse(_fraisCimentController.text) ?? 0.0;
    final fTransport = double.tryParse(_fraisTransportController.text) ?? 0.0;

    setState(() {
      _baseHT = (ton * price) + fCiment + fTransport;
      _tva = _baseHT * (_tvaPourcentage / 100.0);
      _bic = _baseHT * (_bicPourcentage / 100.0);
      _totalTTC = _baseHT + _tva + _bic;
    });
  }

  Future<void> _loadClients() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _isLoadingClients = true);
    try {
      final data = await ApiService().getClients(auth.token!);
      setState(() {
        _clients = data.map((x) => Client.fromJson(x)).toList();
      });
    } catch (e) {
      debugPrint("Error loading clients in ciment form: $e");
    } finally {
      setState(() => _isLoadingClients = false);
    }
  }

  void _showClientSelector() {
    showDialog(
      context: context,
      builder: (ctx) {
        List<Client> filtered = List.from(_clients);
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: const Color(0xFF1E293B),
              title: const Text("Sélectionner un Client", style: TextStyle(color: Colors.white)),
              content: SizedBox(
                width: double.maxFinite,
                height: 350,
                child: Column(
                  children: [
                    TextField(
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        hintText: "Rechercher par nom ou téléphone...",
                        hintStyle: const TextStyle(color: Colors.white30),
                        prefixIcon: const Icon(Icons.search, color: Colors.white70),
                        filled: true,
                        fillColor: Colors.white.withOpacity(0.05),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                      ),
                      onChanged: (val) {
                        setDialogState(() {
                          filtered = _clients.where((c) =>
                              c.nom.toLowerCase().contains(val.toLowerCase()) ||
                              c.telephone.contains(val)
                          ).toList();
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: _isLoadingClients
                          ? const Center(child: CircularProgressIndicator())
                          : filtered.isEmpty
                              ? const Center(child: Text("Aucun client trouvé", style: TextStyle(color: Colors.white70)))
                              : ListView.builder(
                                  itemCount: filtered.length,
                                  itemBuilder: (context, index) {
                                    final c = filtered[index];
                                    return ListTile(
                                      title: Text(c.nom, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                      subtitle: Text(c.telephone, style: const TextStyle(color: Colors.white60)),
                                      onTap: () {
                                        _clientTelController.text = c.telephone;
                                        Navigator.pop(ctx);
                                      },
                                    );
                                  },
                                ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text("Fermer", style: TextStyle(color: Colors.grey)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final cimentProvider = Provider.of<CimentProvider>(context, listen: false);
    final isEditing = widget.shipment != null;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFF),
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
          isEditing ? "Modifier le Chargement" : "Nouveau Chargement",
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.white),
        ),
        centerTitle: true,
        leading: const BackButton(color: Colors.white),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle("Logistique & Log", Icons.local_shipping_rounded),
              _buildLogisticsFields(),
              const SizedBox(height: 20),
              _buildSectionTitle("Détails Chargement & Tarifs", Icons.calculate_rounded),
              _buildTariffFields(),
              const SizedBox(height: 20),
              _buildSectionTitle("Informations Complémentaires", Icons.more_horiz_rounded),
              _buildComplementaryFields(),
              const SizedBox(height: 20),
              _buildCalculationsSummary(),
              const SizedBox(height: 30),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _primaryColor,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 3,
                  ),
                  onPressed: _isSaving ? null : () => _saveForm(auth, cimentProvider),
                  child: _isSaving
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          isEditing ? "SAUVEGARDER LES MODIFICATIONS" : "ENREGISTRER LE CHARGEMENT",
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                ),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, top: 4),
      child: Row(
        children: [
          Icon(icon, color: _primaryColor, size: 20),
          const SizedBox(width: 8),
          Text(
            title.toUpperCase(),
            style: TextStyle(color: Colors.grey.shade700, fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.0),
          ),
        ],
      ),
    );
  }

  Widget _buildLogisticsFields() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10)],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _clientTelController,
                  decoration: const InputDecoration(
                    labelText: "Téléphone du Client *",
                    prefixIcon: Icon(Icons.phone),
                  ),
                  keyboardType: TextInputType.phone,
                  validator: (v) => v == null || v.trim().isEmpty ? "Téléphone requis" : null,
                ),
              ),
              const SizedBox(width: 10),
              IconButton(
                style: IconButton.styleFrom(
                  backgroundColor: _primaryColor.withOpacity(0.1),
                  foregroundColor: _primaryColor,
                  padding: const EdgeInsets.all(12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.search_rounded),
                onPressed: _showClientSelector,
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _camionNoController,
            decoration: const InputDecoration(labelText: "Numéro de Camion *", prefixIcon: Icon(Icons.directions_car)),
            validator: (v) => v == null || v.trim().isEmpty ? "Numéro requis" : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _destinationController,
            decoration: const InputDecoration(labelText: "Destination *", prefixIcon: Icon(Icons.navigation)),
            validator: (v) => v == null || v.trim().isEmpty ? "Destination requise" : null,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _selectedTypeCiment,
            decoration: const InputDecoration(labelText: "Type de Ciment", prefixIcon: Icon(Icons.layers_rounded)),
            items: _cementTypes.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
            onChanged: (val) {
              setState(() {
                _selectedTypeCiment = val;
              });
            },
          ),
          if (_selectedTypeCiment == "Autre") ...[
            const SizedBox(height: 12),
            TextFormField(
              controller: _customTypeCimentController,
              decoration: const InputDecoration(labelText: "Spécifier le Type de Ciment *", prefixIcon: Icon(Icons.edit)),
              validator: (v) => _selectedTypeCiment == "Autre" && (v == null || v.trim().isEmpty) ? "Type requis" : null,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTariffFields() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10)],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _tonnageController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: "Tonnage (Tonnes) *", prefixIcon: Icon(Icons.scale)),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return "Tonnage requis";
                    if (double.tryParse(v) == null) return "Nombre invalide";
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _puController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: "Prix Unitaire (HT) *", prefixIcon: Icon(Icons.attach_money)),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return "P.U requis";
                    if (double.tryParse(v) == null) return "Nombre invalide";
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _fraisCimentController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: "Frais Ciment Additionnels", prefixIcon: Icon(Icons.add_circle_outline)),
                  validator: (v) {
                    if (v != null && v.isNotEmpty && double.tryParse(v) == null) return "Invalide";
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _fraisTransportController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: "Frais Transport", prefixIcon: Icon(Icons.airport_shuttle)),
                  validator: (v) {
                    if (v != null && v.isNotEmpty && double.tryParse(v) == null) return "Invalide";
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<double>(
                  value: _tvaPourcentage,
                  decoration: const InputDecoration(labelText: "TVA (%)", prefixIcon: Icon(Icons.percent)),
                  items: const [
                    DropdownMenuItem(value: 0.0, child: Text("Exonéré (0%)")),
                    DropdownMenuItem(value: 19.0, child: Text("Normal (19%)")),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _tvaPourcentage = val;
                      });
                      _recalculate();
                    }
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<double>(
                  value: _bicPourcentage,
                  decoration: const InputDecoration(labelText: "BIC (%)", prefixIcon: Icon(Icons.pie_chart)),
                  items: const [
                    DropdownMenuItem(value: 0.0, child: Text("Exonéré (0%)")),
                    DropdownMenuItem(value: 2.0, child: Text("BIC (2%)")),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _bicPourcentage = val;
                      });
                      _recalculate();
                    }
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildComplementaryFields() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10)],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _chauffeurController,
                  decoration: const InputDecoration(labelText: "Chauffeur", prefixIcon: Icon(Icons.person_pin)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _chauffeurTelController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: "Tél Chauffeur", prefixIcon: Icon(Icons.phone_iphone)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _transporteurController,
            decoration: const InputDecoration(labelText: "Société de Transport", prefixIcon: Icon(Icons.business_rounded)),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _bonsController,
                  decoration: const InputDecoration(labelText: "Numéros des Bons", prefixIcon: Icon(Icons.notes)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextFormField(
                  controller: _arrivageController,
                  decoration: const InputDecoration(labelText: "Arrivage ID / N°", prefixIcon: Icon(Icons.flight_land)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCalculationsSummary() {
    final format = NumberFormat("#,##0", "fr_FR");
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A), // Premium Dark Slate
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.05), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("CALCULS EN DIRECT", style: TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.8)),
              Icon(Icons.refresh, color: _secondaryColor, size: 14),
            ],
          ),
          const SizedBox(height: 12),
          _summaryRow("Base HT (Tonnage × PU + Frais)", "${format.format(_baseHT)} FCFA"),
          const Divider(color: Colors.white10),
          _summaryRow("TVA ($_tvaPourcentage%)", "${format.format(_tva)} FCFA"),
          const Divider(color: Colors.white10),
          _summaryRow("BIC ($_bicPourcentage%)", "${format.format(_bic)} FCFA"),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8.0),
            child: Divider(color: Colors.white24, thickness: 1),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("TOTAL TTC :", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              Text(
                "${format.format(_totalTTC)} FCFA",
                style: TextStyle(color: _secondaryColor, fontWeight: FontWeight.w900, fontSize: 18),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 12)),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }

  void _saveForm(AuthProvider auth, CimentProvider cimentProvider) async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      final String cementType = _selectedTypeCiment == "Autre"
          ? _customTypeCimentController.text.trim()
          : _selectedTypeCiment ?? "CPJ 45";

      final payload = {
        "client_tel": _clientTelController.text.trim(),
        "camion_no": _camionNoController.text.trim().toUpperCase(),
        "destination": _destinationController.text.trim(),
        "type_ciment": cementType,
        "tonnage": double.parse(_tonnageController.text),
        "pu": double.parse(_puController.text),
        "frais_ciment": double.tryParse(_fraisCimentController.text) ?? 0.0,
        "frais_transport": double.tryParse(_fraisTransportController.text) ?? 0.0,
        "tva_pourcentage": _tvaPourcentage,
        "bic_pourcentage": _bicPourcentage,
        "chauffeur": _chauffeurController.text.trim().isEmpty ? null : _chauffeurController.text.trim(),
        "chauffeur_tel": _chauffeurTelController.text.trim().isEmpty ? null : _chauffeurTelController.text.trim(),
        "transporteur": _transporteurController.text.trim().isEmpty ? null : _transporteurController.text.trim(),
        "bons": _bonsController.text.trim().isEmpty ? null : _bonsController.text.trim(),
        "arrivage": _arrivageController.text.trim().isEmpty ? null : _arrivageController.text.trim(),
      };

      if (widget.shipment == null) {
        await cimentProvider.addShipment(auth, payload);
      } else {
        await cimentProvider.updateShipment(auth, widget.shipment!.id, payload);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(widget.shipment == null ? "Chargement enregistré !" : "Chargement mis à jour !"),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: const Color(0xFF1E293B),
            title: const Text("Erreur", style: TextStyle(color: Colors.white)),
            content: Text("Une erreur est survenue: $e", style: const TextStyle(color: Colors.white70)),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("OK")),
            ],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }
}
