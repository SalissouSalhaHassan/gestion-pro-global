import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../api/supabase_service.dart';

class CorbeilleScreen extends StatefulWidget {
  const CorbeilleScreen({super.key});

  @override
  State<CorbeilleScreen> createState() => _CorbeilleScreenState();
}

class _CorbeilleScreenState extends State<CorbeilleScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isLoading = true;
  String? _restoringId;

  List<Map<String, dynamic>> _deletedInvoices = [];
  List<Map<String, dynamic>> _deletedArticles = [];
  List<Map<String, dynamic>> _deletedClients = [];

  final _currencyFormat = NumberFormat("#,##0", "fr_FR");

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadDeletedItems();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadDeletedItems() async {
    setState(() => _isLoading = true);
    final supabase = SupabaseService.instance;
    await supabase.init();
    final client = supabase.client;

    if (client == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final orgId = auth.organizationId;

      // 1. Fetch deleted invoices
      var invQuery = client
          .from('factures')
          .select('id, bl_number, date_facture, total_ttc, deleted_at, vendeur, emplacement, clients(nom)')
          .eq('is_deleted', true)
          .order('deleted_at', {ascending: false})
          .limit(100);

      if (orgId.isNotEmpty) {
        invQuery = invQuery.eq('organization_id', orgId);
      }
      final invRes = await invQuery;

      // 2. Fetch deleted articles
      var artQuery = client
          .from('articles')
          .select('id, reference, designation, p_vente_ttc, updated_at')
          .eq('is_deleted', true)
          .limit(100);

      if (orgId.isNotEmpty) {
        artQuery = artQuery.eq('organization_id', orgId);
      }
      final artRes = await artQuery;

      // 3. Fetch deleted clients
      var cltQuery = client
          .from('clients')
          .select('id, nom, tel, adresse, updated_at')
          .eq('is_deleted', true)
          .limit(100);

      if (orgId.isNotEmpty) {
        cltQuery = cltQuery.eq('organization_id', orgId);
      }
      final cltRes = await cltQuery;

      if (mounted) {
        setState(() {
          _deletedInvoices = List<Map<String, dynamic>>.from(invRes);
          _deletedArticles = List<Map<String, dynamic>>.from(artRes);
          _deletedClients = List<Map<String, dynamic>>.from(cltRes);
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint("Error loading corbeille: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _restoreInvoice(Map<String, dynamic> inv) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Restaurer la Facture ?"),
        content: Text("Voulez-vous restaurer la facture #${inv['bl_number'] ?? inv['id']} et réajuster les stocks ?"),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Annuler")),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Restaurer", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final id = inv['id'];
    setState(() => _restoringId = id.toString());

    try {
      final supabase = SupabaseService.instance;
      final client = supabase.client!;

      // Deduct stock back when restoring a previously deleted sale
      final items = await client.from('facture_items').select('*').eq('facture_id', id);
      final String fallbackDepot = inv['emplacement'] ?? 'Boutique';

      for (var item in (items as List<dynamic>)) {
        final int? artId = int.tryParse(item['article_id']?.toString() ?? '');
        final double qte = ((item['qte'] ?? 0) as num).toDouble();
        if (artId == null || qte <= 0) continue;

        final String depot = (item['depot_origine'] ?? fallbackDepot).toString().trim();
        final stockRows = await client.from('stocks').select().eq('article_id', artId);
        final match = (stockRows as List<dynamic>).firstWhere(
          (s) => (s['depot_nom'] ?? '').toString().toLowerCase() == depot.toLowerCase(),
          orElse: () => stockRows.isNotEmpty ? stockRows.first : null,
        );

        if (match != null) {
          final double currentQty = ((match['quantite'] ?? 0) as num).toDouble();
          await client.from('stocks').update({'quantite': (currentQty - qte) > 0 ? (currentQty - qte) : 0}).eq('id', match['id']);
        }

        await client.from('mouvements').insert({
          'article_id': artId,
          'nr_doc': 'REST-${inv['bl_number'] ?? id}',
          'date_mouvement': DateTime.now().toIso8601String(),
          'fournisseur_client': 'Restauration Facture #${inv['bl_number'] ?? id}',
          'entree': 0,
          'sortie': qte,
          'quantite': -qte,
          'type': 'SORTIE',
          'depot': depot,
          'utilisateur': 'MobileApp',
        });
      }

      await client.from('factures').update({
        'is_deleted': false,
        'statut': 'Non Payée',
        'deleted_at': null,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', id);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Facture restaurée avec succès ✅"), backgroundColor: Colors.green),
      );
      _loadDeletedItems();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Erreur: $e"), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _restoringId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Corbeille (سلة المحذوفات)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF13002D),
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: Colors.roseAccent,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: [
            Tab(icon: const Icon(Icons.receipt_long), text: "Factures (${_deletedInvoices.length})"),
            Tab(icon: const Icon(Icons.inventory_2), text: "Articles (${_deletedArticles.length})"),
            Tab(icon: const Icon(Icons.people), text: "Clients (${_deletedClients.length})"),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildInvoicesTab(),
                _buildArticlesTab(),
                _buildClientsTab(),
              ],
            ),
    );
  }

  Widget _buildInvoicesTab() {
    if (_deletedInvoices.isEmpty) {
      return const Center(child: Text("Aucune facture dans la corbeille", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)));
    }
    return RefreshIndicator(
      onRefresh: _loadDeletedItems,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _deletedInvoices.length,
        itemBuilder: (ctx, i) {
          final inv = _deletedInvoices[i];
          final isBusy = _restoringId == inv['id']?.toString();
          return Card(
            elevation: 2,
            margin: const EdgeInsets.only(bottom: 10),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: ListTile(
              leading: const CircleAvatar(
                backgroundColor: Color(0xFFFFEBEE),
                child: Icon(Icons.delete_outline, color: Colors.red),
              ),
              title: Text(
                inv['bl_number'] ?? 'FA-${inv['id']}',
                style: const TextStyle(fontWeight: FontWeight.black, fontSize: 15),
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Client: ${inv['clients']?['nom'] ?? 'Client Divers'} • Total: ${_currencyFormat.format(inv['total_ttc'] ?? 0)} FCFA"),
                  if (inv['deleted_at'] != null)
                    Text("Supprimé le: ${inv['deleted_at'].toString().split('T')[0]}", style: const TextStyle(fontSize: 11, color: Colors.grey)),
                ],
              ),
              trailing: isBusy
                  ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                  : ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      ),
                      onPressed: () => _restoreInvoice(inv),
                      icon: const Icon(Icons.restore, size: 16),
                      label: const Text("Restaurer", style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildArticlesTab() {
    if (_deletedArticles.isEmpty) {
      return const Center(child: Text("Aucun article dans la corbeille", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _deletedArticles.length,
      itemBuilder: (ctx, i) {
        final art = _deletedArticles[i];
        return Card(
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ListTile(
            leading: const Icon(Icons.inventory_2_outlined, color: Colors.orange),
            title: Text(art['designation'] ?? 'Article', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text("Ref: ${art['reference'] ?? '—'} • Prix: ${_currencyFormat.format(art['p_vente_ttc'] ?? 0)} FCFA"),
          ),
        );
      },
    );
  }

  Widget _buildClientsTab() {
    if (_deletedClients.isEmpty) {
      return const Center(child: Text("Aucun client dans la corbeille", style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)));
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: _deletedClients.length,
      itemBuilder: (ctx, i) {
        final clt = _deletedClients[i];
        return Card(
          elevation: 1,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: ListTile(
            leading: const Icon(Icons.person_outline, color: Colors.indigo),
            title: Text(clt['nom'] ?? 'Client', style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text("Tél: ${clt['tel'] ?? '—'}"),
          ),
        );
      },
    );
  }
}
