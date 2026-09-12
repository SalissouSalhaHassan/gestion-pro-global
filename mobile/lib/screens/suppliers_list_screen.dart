import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/supplier_provider.dart';
import 'add_supplier_screen.dart';

class SuppliersListScreen extends StatefulWidget {
  const SuppliersListScreen({super.key});

  @override
  State<SuppliersListScreen> createState() => _SuppliersListScreenState();
}

class _SuppliersListScreenState extends State<SuppliersListScreen> {
  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF3F5F9);

  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final supplierProv = Provider.of<SupplierProvider>(context, listen: false);
    Future.microtask(() {
      if (!mounted) return;
      supplierProv.fetchSuppliers(auth);
    });
    
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showActionMenu(BuildContext context, dynamic supplier) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 5),
                height: 5,
                width: 50,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: Text(
                  supplier.name,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.edit, color: Colors.blue),
                title: const Text("Éditer"),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Édition: Bientôt disponible sur mobile.')),
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text("Corbeille (Supprimer)"),
                onTap: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Suppression gérée sur Desktop.')),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final supplierProvider = Provider.of<SupplierProvider>(context);

    final filteredSuppliers = supplierProvider.suppliers.where((supplier) {
      if (_searchQuery.isEmpty) return true;
      final ref = (supplier.reference ?? '').toLowerCase();
      final name = supplier.name.toLowerCase();
      final phone = (supplier.phone ?? '').toLowerCase();
      final gsm = (supplier.gsm ?? '').toLowerCase();
      return name.contains(_searchQuery) || 
             ref.contains(_searchQuery) ||
             phone.contains(_searchQuery) ||
             gsm.contains(_searchQuery);
    }).toList();

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
        title: const Text('Fournisseurs', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: () {
              supplierProvider.fetchSuppliers(
                Provider.of<AuthProvider>(context, listen: false),
                forceRefresh: true,
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(15),
            color: _backgroundColor,
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Recherche (Réf, Nom, Tél)...',
                hintStyle: TextStyle(color: Colors.grey.shade500),
                prefixIcon: Icon(Icons.search, color: _primaryColor),
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 20),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(30),
                  borderSide: BorderSide.none,
                ),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.grey),
                        onPressed: () {
                          _searchController.clear();
                          FocusScope.of(context).unfocus();
                        },
                      )
                    : null,
              ),
            ),
          ),
          
          Expanded(
            child: supplierProvider.isLoading
                ? Center(child: CircularProgressIndicator(color: _primaryColor))
                : filteredSuppliers.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.people_alt_outlined, size: 80, color: Colors.grey.shade300),
                            const SizedBox(height: 20),
                            Text(
                              _searchQuery.isNotEmpty ? 'Aucun résultat' : 'Aucun fournisseur trouvé',
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 18, fontWeight: FontWeight.w500),
                            ),
                            if (_searchQuery.isEmpty) ...[
                               const SizedBox(height: 10),
                               Text(
                                 'Appuyez sur + pour ajouter un fournisseur',
                                 style: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                               ),
                            ]
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: filteredSuppliers.length,
                        itemBuilder: (ctx, i) {
                          final supplier = filteredSuppliers[i];
                          return Container(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 8,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(16),
                              onTap: () => _showActionMenu(context, supplier),
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          supplier.name,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.black87),
                                        ),
                                        if (supplier.reference != null && supplier.reference!.isNotEmpty)
                                          Text(
                                            "Réf: ${supplier.reference}",
                                            style: TextStyle(fontWeight: FontWeight.bold, color: _primaryColor, fontSize: 13),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      children: [
                                        Icon(Icons.person_outline, size: 16, color: Colors.grey.shade600),
                                        const SizedBox(width: 4),
                                        Expanded(
                                          child: Text(
                                            supplier.contact?.isNotEmpty == true ? supplier.contact! : 'Aucun contact',
                                            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                          ),
                                        ),
                                        Icon(Icons.phone, size: 16, color: Colors.grey.shade600),
                                        const SizedBox(width: 4),
                                        Text(
                                          (supplier.phone?.isNotEmpty == true) ? supplier.phone! : ((supplier.gsm?.isNotEmpty == true) ? supplier.gsm! : '-'),
                                          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Row(
                                          children: [
                                            CircleAvatar(
                                              radius: 12,
                                              backgroundColor: _primaryColor.withValues(alpha: 0.1),
                                              child: Text(supplier.name[0].toUpperCase(), style: TextStyle(color: _primaryColor, fontSize: 12)),
                                            ),
                                          ],
                                        ),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.end,
                                          children: [
                                            const Text(
                                              'Crédit',
                                              style: TextStyle(fontSize: 11, color: Colors.grey),
                                            ),
                                            Text(
                                              "${supplier.balance.toStringAsFixed(2)} DA",
                                              style: TextStyle(
                                                color: supplier.balance > 0 ? Colors.red.shade700 : Colors.green.shade700,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ],
                                        )
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          final authProvider = Provider.of<AuthProvider>(context, listen: false);
          final supplierProvider = Provider.of<SupplierProvider>(context, listen: false);
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AddSupplierScreen()),
          ).then((_) {
            if (!mounted) return;
            supplierProvider.fetchSuppliers(
              authProvider,
              forceRefresh: true,
            );
          });
        },
        backgroundColor: _primaryColor,
        child: const Icon(Icons.add, color: Colors.white, size: 28),
      ),
    );
  }
}
