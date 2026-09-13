import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import 'package:provider/provider.dart';
import '../api/api_service.dart';
import '../providers/auth_provider.dart';
import '../models/client_model.dart';
import 'client_details_screen.dart';
import 'add_client_screen.dart';
import '../services/excel_export_service.dart';

class ClientsListScreen extends StatefulWidget {
  const ClientsListScreen({super.key});

  @override
  State<ClientsListScreen> createState() => _ClientsListScreenState();
}

class _ClientsListScreenState extends State<ClientsListScreen> {
  Future<List<dynamic>>? _clientsFuture;
  List<Client> _allClients = []; // لتخزين القائمة الكاملة
  List<Client> _filteredClients = []; // لتخزين نتائج البحث
  final TextEditingController _searchController = TextEditingController();

  // ألوان التصميم الحديث (نفس ثيم الشاشة الرئيسية)
  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);
  final Color _backgroundColor = const Color(0xFFF3F5F9);

  @override
  void initState() {
    super.initState();
    _loadClients();
  }

  void _loadClients({bool forceRefresh = false}) {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token != null) {
      setState(() {
        _clientsFuture = ApiService()
            .getClients(token, forceRefresh: forceRefresh)
            .then((data) {
              // تحويل البيانات وحفظها محلياً للبحث
              final clients = data.map((item) {
                Map<String, dynamic> m = {};
                if (item is Map) {
                  m = Map<String, dynamic>.from(item);
                } else if (item is String) {
                  try {
                    final decoded = jsonDecode(item);
                    if (decoded is Map) {
                      m = Map<String, dynamic>.from(decoded);
                    }
                  } catch (_) {}
                }
                return Client.fromJson(m);
              }).toList();
              setState(() {
                _allClients = clients;
                _filteredClients = clients;
              });
              return data;
            });
      });
    }
  }

  // دالة البحث
  void _filterClients(String query) {
    final lowerQuery = query.toLowerCase();
    setState(() {
      _filteredClients = _allClients.where((client) {
        final nameMatch = client.nom.toLowerCase().contains(lowerQuery);
        final phoneMatch = client.telephone.toLowerCase().contains(lowerQuery);
        return nameMatch || phoneMatch;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _backgroundColor,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "Liste des Clients",
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            tooltip: 'Recharger les clients',
            onPressed: () => _loadClients(forceRefresh: true),
          ),
          IconButton(
            icon: const Icon(Icons.file_download, color: Colors.white),
            tooltip: 'Exporter Excel',
            onPressed: () {
              if (_filteredClients.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text("Aucune donnée à exporter")),
                );
                return;
              }
              final data = _filteredClients
                  .map(
                    (c) => {
                      'nom': c.nom,
                      'telephone': c.telephone,
                      'adresse': c.adresse,
                      'solde': c.solde,
                    },
                  )
                  .toList();
              ExcelExportService.exportClients(data, context);
            },
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: _secondaryColor,
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const AddClientScreen()),
          );
          if (result == true) {
            _loadClients(forceRefresh: true); // Refresh list if client added
          }
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: Column(
        children: [
          // --- الجزء العلوي مع البحث ---
          _buildHeader(),

          // --- قائمة العملاء ---
          Expanded(
            child: FutureBuilder<List<dynamic>>(
              future: _clientsFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return Center(
                    child: CircularProgressIndicator(color: _primaryColor),
                  );
                } else if (snapshot.hasError) {
                  return _buildErrorState(snapshot.error.toString());
                } else if (snapshot.hasData) {
                  if (_allClients.isEmpty) {
                    return _buildEmptyState("Aucun client trouvé.");
                  }
                  if (_filteredClients.isEmpty) {
                    return _buildEmptyState(
                      "Aucun résultat pour cette recherche.",
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.only(
                      top: 10,
                      bottom: 20,
                      left: 15,
                      right: 15,
                    ),
                    physics: const BouncingScrollPhysics(),
                    itemCount: _filteredClients.length,
                    itemBuilder: (context, index) {
                      return _buildClientCard(_filteredClients[index]);
                    },
                  );
                }
                return const Center(child: Text("Pas de données"));
              },
            ),
          ),
        ],
      ),
    );
  }

  // تصميم الهيدر وشريط البحث
  Widget _buildHeader() {
    return Stack(
      children: [
        Container(
          height: 160,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_primaryColor, _secondaryColor],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(30),
              bottomRight: Radius.circular(30),
            ),
            boxShadow: [
              BoxShadow(
                color: _primaryColor.withValues(alpha: 0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
        ),
        Positioned(
          bottom: 20,
          left: 20,
          right: 20,
          child: Container(
            height: 50,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(15),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _filterClients,
              decoration: InputDecoration(
                hintText: "Rechercher (Nom, Téléphone)...",
                hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                prefixIcon: Icon(Icons.search, color: _primaryColor),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 15,
                ),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.grey),
                        onPressed: () {
                          _searchController.clear();
                          _filterClients('');
                        },
                      )
                    : null,
              ),
            ),
          ),
        ),
      ],
    );
  }

  // تصميم بطاقة العميل
  Widget _buildClientCard(Client client) {
    String initial = client.nom.isNotEmpty ? client.nom[0].toUpperCase() : "?";

    return Container(
      margin: const EdgeInsets.only(bottom: 15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => ClientDetailsScreen(client: client),
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(
              children: [
                // الأفاتار
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.blue.shade100, Colors.blue.shade50],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      initial,
                      style: TextStyle(
                        color: _primaryColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 15),

                // المعلومات
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        client.nom,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          Icon(
                            Icons.phone_android,
                            size: 14,
                            color: Colors.grey.shade500,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            client.telephone.isNotEmpty
                                ? client.telephone
                                : "Aucun numéro",
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // سهم التوجيه
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 16,
                    color: _primaryColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // حالة الخطأ
  Widget _buildErrorState(String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline_rounded,
              color: Colors.red.shade300,
              size: 60,
            ),
            const SizedBox(height: 15),
            Text(
              "Une erreur est survenue",
              style: TextStyle(
                color: Colors.grey.shade800,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              error,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () => _loadClients(forceRefresh: false),
              icon: const Icon(Icons.refresh),
              label: const Text("Réessayer"),
              style: ElevatedButton.styleFrom(
                backgroundColor: _primaryColor,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(30),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 25,
                  vertical: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // حالة القائمة الفارغة
  Widget _buildEmptyState(String message) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off_rounded, size: 80, color: Colors.grey.shade300),
          const SizedBox(height: 15),
          Text(
            message,
            style: TextStyle(color: Colors.grey.shade500, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
