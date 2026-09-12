import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import '../models/client_model.dart';
import 'edit_client_screen.dart'; // Importer le nouvel écran
// import 'package:url_launcher/url_launcher.dart'; // Il est préférable d'ajouter cette bibliothèque pour les vrais appels
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../models/company_model.dart';
import '../utils/pdf_generator.dart';
import 'pdf_preview_screen.dart';

class ClientDetailsScreen extends StatefulWidget {
  final Client client;
  const ClientDetailsScreen({super.key, required this.client});

  @override
  State<ClientDetailsScreen> createState() => _ClientDetailsScreenState();
}

class _ClientDetailsScreenState extends State<ClientDetailsScreen> {
  late Client _client;
  List<Map<String, dynamic>> _invoices = [];
  List<Map<String, dynamic>> _payments = [];
  bool _loadingHistory = false;
  bool _addingPayment = false;

  @override
  void initState() {
    super.initState();
    _client = widget.client;
    _fetchHistory();
  }

  // Couleurs du thème
  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF3F5F9);

  // La fonction d'appel a été supprimée car elle n'est pas utilisée actuellement

  Future<void> _fetchHistory() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _loadingHistory = true);
    try {
      final api = ApiService();
      final inv = await api.getClientInvoices(_client.id, auth.token!);
      final pay = await api.getClientPayments(_client.id, auth.token!);
      setState(() {
        _invoices = inv;
        _payments = pay;
      });
    } catch (_) {
      setState(() {
        _invoices = [];
        _payments = [];
      });
    } finally {
      setState(() => _loadingHistory = false);
    }
  }

  Future<void> _previewInvoice(Map<String, dynamic> inv) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final api = ApiService();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const Center(child: CircularProgressIndicator()),
    );
    try {
      final companyMap = await api.getCompanyInfo(auth.token!);
      final company = CompanyInfo.fromJson(companyMap);
      final itemsData = await api.getInvoiceItems(
        (inv['id'] ?? '').toString(),
        auth.token!,
      );
      List<Map<String, dynamic>> pdfItems = itemsData.map((item) {
        return {
          "name": item['designation'] ?? "",
          "quantity": item['quantity'] ?? 1,
          "price": item['price'] ?? 0.0,
          "total": item['total'] ?? 0.0,
        };
      }).toList();
      if (pdfItems.isEmpty) {
        pdfItems = [
          {
            "name": "Détails indisponibles",
            "quantity": 1,
            "price": (inv['total_ttc'] as num?)?.toDouble() ?? 0.0,
            "total": (inv['total_ttc'] as num?)?.toDouble() ?? 0.0,
          },
        ];
      }
      if (mounted) {
        Navigator.pop(context);
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => PdfPreviewScreen(
              invoiceRef: (inv['bl_number'] ?? '').toString(),
              buildPdf: (format) async {
                return PdfInvoiceGenerator.generateInvoice(
                  company: company,
                  clientName: _client.nom,
                  items: pdfItems,
                  totalAmount: (inv['total_ttc'] as num?)?.toDouble() ?? 0.0,
                  invoiceRef: (inv['bl_number'] ?? '').toString(),
                  sellerName: auth.username ?? "Utilisateur",
                  paidAmount: (inv['montant_paye'] as num?)?.toDouble() ?? 0.0,
                  location: (inv['emplacement'] ?? '').toString(), // NEW
                  pageFormat: format,
                );
              },
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Erreur PDF: $e")));
      }
    }
  }

  Future<void> _addPaymentDialog() async {
    final amountCtrl = TextEditingController();
    String method = "Espèce";
    bool allocateToInvoices = true;
    await showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setLocalState) {
            return AlertDialog(
              title: const Text("Ajouter un paiement"),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(labelText: "Montant"),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: method,
                    items: const [
                      DropdownMenuItem(value: "Espèce", child: Text("Espèce")),
                      DropdownMenuItem(value: "Chèque", child: Text("Chèque")),
                      DropdownMenuItem(
                        value: "Virement",
                        child: Text("Virement"),
                      ),
                    ],
                    onChanged: (v) => method = v ?? "Espèce",
                    decoration: const InputDecoration(
                      labelText: "Moyen de paiement",
                    ),
                  ),
                  const SizedBox(height: 10),
                  SwitchListTile(
                    value: allocateToInvoices,
                    onChanged: (v) =>
                        setLocalState(() => allocateToInvoices = v),
                    title: const Text(
                      "Distribution automatique sur les factures",
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text("Annuler"),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final v = double.tryParse(amountCtrl.text.trim()) ?? 0.0;
                    if (v <= 0) return;
                    Navigator.pop(ctx);
                    if (allocateToInvoices) {
                      await _bulkPayClient(v, method);
                    } else {
                      await _createClientDeposit(v, method);
                    }
                  },
                  child: const Text("Enregistrer"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _bulkPayClient(double amount, String method) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _addingPayment = true);
    try {
      await ApiService().payClientBulk(_client.id, amount, method, auth.token!);
      await _fetchHistory();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text("Paiement distribué")));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Erreur: $e")));
      }
    } finally {
      setState(() => _addingPayment = false);
    }
  }

  Future<void> _createClientDeposit(double amount, String method) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    setState(() => _addingPayment = true);
    try {
      await ApiService().createDeposit({
        "client_id": _client.id,
        "montant_initial": amount,
        "moyen_paiement": method,
        "date_avance": DateFormat('yyyy-MM-dd').format(DateTime.now()),
      }, auth.token!);
      await _fetchHistory();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text("Paiement enregistré")));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text("Erreur: $e")));
      }
    } finally {
      setState(() => _addingPayment = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Déterminer le statut du solde (débiteur ou non)
    final bool isDebtor = _client.solde > 0;
    final String initial = _client.nom.isNotEmpty
        ? _client.nom[0].toUpperCase()
        : "?";

    return Scaffold(
      backgroundColor: _backgroundColor,
      extendBodyBehindAppBar:
          true, // Étendre le design derrière la barre d'applications
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        leading: IconButton(
          icon: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.arrow_back_ios_new,
              size: 18,
              color: Colors.white,
            ),
          ),
          onPressed: () => Navigator.pop(
            context,
            _client,
          ), // Retourner le client potentiellement mis à jour
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Colors.white),
            onSelected: (value) async {
              // Rendre la fonction async
              if (value == 'edit') {
                // Naviguer vers l'écran de modification et attendre un résultat
                final updatedClient = await Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EditClientScreen(client: _client),
                  ),
                );

                // Si un client mis à jour est retourné, rafraîchir l'état
                if (updatedClient != null) {
                  setState(() {
                    _client = updatedClient;
                  });
                }
              } else if (value == 'delete') {
                // Afficher une boîte de dialogue de confirmation avant de supprimer
                showDialog(
                  context: context,
                  builder: (BuildContext dialogContext) {
                    return AlertDialog(
                      title: const Text('Confirmer la suppression'),
                      content: Text(
                        'Êtes-vous sûr de vouloir supprimer ${_client.nom} ?',
                      ),
                      actions: <Widget>[
                        TextButton(
                          child: const Text('Annuler'),
                          onPressed: () {
                            Navigator.of(
                              dialogContext,
                            ).pop(); // Fermer la dialogue
                          },
                        ),
                        TextButton(
                          style: TextButton.styleFrom(
                            foregroundColor: Colors.red,
                          ),
                          child: const Text('Supprimer'),
                          onPressed: () {
                            // Mettez ici votre logique de suppression
                            debugPrint("Client ${_client.id} supprimé");
                            Navigator.of(
                              dialogContext,
                            ).pop(); // Fermer la dialogue
                            Navigator.of(context).pop(
                              true,
                            ); // Revenir à l'écran précédent avec un indicateur de suppression
                          },
                        ),
                      ],
                    );
                  },
                );
              }
            },
            itemBuilder: (BuildContext context) => <PopupMenuEntry<String>>[
              const PopupMenuItem<String>(
                value: 'edit',
                child: Row(
                  children: [
                    Icon(Icons.edit_outlined, color: Colors.black87),
                    SizedBox(width: 10),
                    Text('Modifier'),
                  ],
                ),
              ),
              const PopupMenuItem<String>(
                value: 'delete',
                child: Row(
                  children: [
                    Icon(Icons.delete_outline, color: Colors.red),
                    SizedBox(width: 10),
                    Text('Supprimer', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Column(
          children: [
            // --- 1. En-tête et photo de profil ---
            Stack(
              alignment: Alignment.bottomCenter,
              clipBehavior: Clip.none,
              children: [
                // Arrière-plan dégradé
                Container(
                  height: 240,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_primaryColor, _secondaryColor],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(40),
                      bottomRight: Radius.circular(40),
                    ),
                  ),
                ),
                // Photo de profil flottante
                Positioned(
                  bottom: -50,
                  child: Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color:
                          _backgroundColor, // Couleur de fond autour de l'avatar
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: CircleAvatar(
                      radius: 55,
                      backgroundColor: Colors.grey.shade200,
                      child: Text(
                        initial,
                        style: TextStyle(
                          fontSize: 40,
                          fontWeight: FontWeight.bold,
                          color: _primaryColor,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 60), // Espace pour l'avatar
            // --- 2. Nom et informations ---
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  Text(
                    _client.nom,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: _primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      "Client ID: #${_client.id}",
                      style: TextStyle(
                        color: _primaryColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 30),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.grey.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    ListTile(
                      title: const Text(
                        "Historique des factures",
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.refresh),
                        onPressed: _fetchHistory,
                      ),
                    ),
                    if (_loadingHistory)
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: CircularProgressIndicator(),
                      )
                    else
                      Column(
                        children: _invoices.map((inv) {
                          final statut = (inv['statut'] ?? '').toString();
                          final isCancelled = statut.toLowerCase().contains(
                            'annul',
                          );
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: isCancelled
                                  ? Colors.red
                                  : Colors.blue,
                              child: const Icon(
                                Icons.receipt_long,
                                color: Colors.white,
                              ),
                            ),
                            title: Text((inv['bl_number'] ?? '').toString()),
                            subtitle: Text(
                              (inv['date_facture'] ?? '').toString(),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.print),
                              onPressed: () => _previewInvoice(inv),
                            ),
                          );
                        }).toList(),
                      ),
                    const Divider(height: 1),
                    ListTile(
                      title: const Text(
                        "Paiements du client",
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      trailing: ElevatedButton.icon(
                        onPressed: _addingPayment ? null : _addPaymentDialog,
                        icon: const Icon(Icons.add),
                        label: const Text("Ajouter"),
                      ),
                    ),
                    Column(
                      children: _payments.map((p) {
                        return ListTile(
                          leading: const CircleAvatar(
                            backgroundColor: Colors.green,
                            child: Icon(Icons.payments, color: Colors.white),
                          ),
                          title: Text(
                            "${(p['amount'] as num?)?.toDouble().toString() ?? '0'}",
                          ),
                          subtitle: Text(
                            "${p['date'] ?? ''} • ${p['method'] ?? ''}${(p['type'] ?? '') == 'Dépôt' ? ' • Dépôt' : ''}",
                          ),
                          trailing: Text((p['bl_number'] ?? '').toString()),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              ),
            ),

            // --- 3. Carte de solde ---
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: (isDebtor ? Colors.red : Colors.green).withOpacity(
                        0.1,
                      ),
                      blurRadius: 15,
                      offset: const Offset(0, 5),
                    ),
                  ],
                  border: Border.all(
                    color: (isDebtor ? Colors.red : Colors.green).withOpacity(
                      0.2,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: isDebtor
                                ? Colors.red.shade50
                                : Colors.green.shade50,
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.account_balance_wallet_rounded,
                            color: isDebtor ? Colors.red : Colors.green,
                          ),
                        ),
                        const SizedBox(width: 15),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Solde Actuel",
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey.shade600,
                              ),
                            ),
                            Text(
                              isDebtor ? "Crédit (Dette)" : "Payé / Avance",
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: isDebtor ? Colors.red : Colors.green,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Text(
                      "${_client.solde.toStringAsFixed(0)} CFA",
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: isDebtor
                            ? Colors.red.shade700
                            : Colors.green.shade700,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 25),

            // --- 4. Coordonnées ---
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.grey.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    _buildInfoTile(
                      icon: Icons.phone_rounded,
                      title: "Téléphone",
                      value: _client.telephone.isNotEmpty
                          ? _client.telephone
                          : "Non renseigné",
                      iconColor: Colors.orange,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Divider(height: 1, color: Colors.grey.shade100),
                    ),
                    _buildInfoTile(
                      icon: Icons.email_rounded,
                      title: "Email",
                      value: _client.email.isNotEmpty
                          ? _client.email
                          : "Non renseigné",
                      iconColor: Colors.purple,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Divider(height: 1, color: Colors.grey.shade100),
                    ),
                    _buildInfoTile(
                      icon: Icons.location_on_rounded,
                      title: "Adresse",
                      value: _client.adresse.isNotEmpty
                          ? _client.adresse
                          : "Non renseignée",
                      iconColor: Colors.blue,
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 40),

            // --- 5. Bouton d'action (Appel) ---
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Container(
                width: double.infinity,
                height: 55,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [
                      Color(0xFF11998e),
                      Color(0xFF38ef7d),
                    ], // Un joli dégradé de vert pour l'appel
                  ),
                  borderRadius: BorderRadius.circular(15),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF38ef7d).withOpacity(0.4),
                      blurRadius: 10,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(15),
                    onTap: () {
                      if (_client.telephone.isNotEmpty) {
                        // _makePhoneCall(_client.telephone); // Décommentez si vous ajoutez la bibliothèque url_launcher
                        debugPrint("Appeler ${_client.telephone}");
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("Pas de numéro de téléphone"),
                          ),
                        );
                      }
                    },
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.call, color: Colors.white),
                        SizedBox(width: 10),
                        Text(
                          "Appeler le Client",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  // Widget personnalisé pour afficher une ligne d'information
  Widget _buildInfoTile({
    required IconData icon,
    required String title,
    required String value,
    required Color iconColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 15),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade500),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
