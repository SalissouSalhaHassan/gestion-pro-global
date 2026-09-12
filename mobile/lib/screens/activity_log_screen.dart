
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../api/api_service.dart';
import '../models/activity_log_model.dart';
import '../providers/auth_provider.dart';

class ActivityLogScreen extends StatefulWidget {
  const ActivityLogScreen({super.key});

  @override
  State<ActivityLogScreen> createState() => _ActivityLogScreenState();
}

class _ActivityLogScreenState extends State<ActivityLogScreen> {
  List<ActivityLog> _logs = [];
  bool _loading = true;
  
  // Filters
  final TextEditingController _startDateCtrl = TextEditingController();
  final TextEditingController _endDateCtrl = TextEditingController();
  String _selectedUser = "Tous";
  String _selectedModule = "Toutes";
  
  // Available filter options (loaded dynamically ideally, but hardcoded for now or fetched)
  List<String> _users = ["Tous"]; 
  List<String> _modules = ["Toutes"];

  @override
  void initState() {
    super.initState();
    _fetchLogs();
    _fetchFilterOptions(); // Optional: Fetch users/modules for filter dropdowns
  }

  Future<void> _fetchFilterOptions() async {
    // In a real app, you might fetch specific lists of users and modules here.
    // For now, we'll just keep the default "Tous" / "Toutes" and let the backend filter if needed.
    // If you have a getUsers endpoint, call it here to populate _users.
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
        final usersData = await ApiService().getUsers(auth.token!);
        if(mounted) {
            setState(() {
                _users = ["Tous"] + usersData.map((e) => e['username'].toString()).toList();
            });
        }
    } catch(e) {
        print("Error fetching users for filter: $e");
    }
  }

  Future<void> _fetchLogs() async {
    setState(() => _loading = true);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      final data = await ApiService().getActivityLogs(
        auth.token!,
        startDate: _startDateCtrl.text.isEmpty ? null : _startDateCtrl.text,
        endDate: _endDateCtrl.text.isEmpty ? null : _endDateCtrl.text,
        username: _selectedUser,
        module: _selectedModule,
      );

      setState(() {
        _logs = data.map((json) => ActivityLog.fromJson(json)).toList();
        
        // Extract unique modules from loaded logs if we want dynamic module list
        final loadedModules = _logs.map((e) => e.entityType).toSet().toList();
        if (_modules.length == 1) { // Only add if we haven't manually set strictly
            for(var m in loadedModules) {
                if(!_modules.contains(m)) _modules.add(m);
            }
        }
        
        _loading = false;
      });
    } catch (e) {
      if(mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Erreur: $e"), backgroundColor: Colors.red));
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _selectDate(TextEditingController ctrl) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      locale: const Locale("fr", "FR"),
    );
    if (picked != null) {
      setState(() {
        ctrl.text = DateFormat('yyyy-MM-dd').format(picked);
      });
      _fetchLogs();
    }
  }

  Color _getActionColor(String action) {
    switch (action.toUpperCase()) {
      case 'CREATE': return Colors.green;
      case 'UPDATE': return Colors.blue;
      case 'DELETE': return Colors.red;
      case 'CANCEL': return Colors.orange;
      case 'LOGIN': return Colors.grey;
      case 'LOGOUT': return Colors.grey;
      default: return Colors.black;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Journal d'Activité"),
        backgroundColor: const Color(0xFF1e40af), // Matches desktop header
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          // Filter Section
          Container(
            padding: const EdgeInsets.all(12),
            color: Colors.grey.shade200,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _startDateCtrl,
                        readOnly: true,
                        decoration: const InputDecoration(labelText: "Du", suffixIcon: Icon(Icons.calendar_today, size: 16)),
                        onTap: () => _selectDate(_startDateCtrl),
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: _endDateCtrl,
                        readOnly: true,
                        decoration: const InputDecoration(labelText: "Au", suffixIcon: Icon(Icons.calendar_today, size: 16)),
                        onTap: () => _selectDate(_endDateCtrl),
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                     Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _users.contains(_selectedUser) ? _selectedUser : "Tous",
                        items: _users.map((u) => DropdownMenuItem(value: u, child: Text(u, style: const TextStyle(fontSize: 13)))).toList(),
                        onChanged: (v) {
                            setState(() => _selectedUser = v!);
                            _fetchLogs();
                        },
                        decoration: const InputDecoration(labelText: "Utilisateur", contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _modules.contains(_selectedModule) ? _selectedModule : "Toutes",
                        items: _modules.map((m) => DropdownMenuItem(value: m, child: Text(m, style: const TextStyle(fontSize: 13)))).toList(),
                        onChanged: (v) {
                             setState(() => _selectedModule = v!);
                             _fetchLogs();
                        },
                         decoration: const InputDecoration(labelText: "Module", contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    TextButton(onPressed: () {
                        setState(() {
                            _startDateCtrl.clear();
                            _endDateCtrl.clear();
                            _selectedUser = "Tous";
                            _selectedModule = "Toutes";
                        });
                        _fetchLogs();
                    }, child: const Text("Effacer filtres"))
                ])
              ],
            ),
          ),
          
          Expanded(
            child: _loading 
                ? const Center(child: CircularProgressIndicator())
                : _logs.isEmpty 
                    ? const Center(child: Text("Aucun enregistrement trouvé."))
                    : ListView.separated(
                        itemCount: _logs.length,
                        separatorBuilder: (ctx, i) => const Divider(height: 1),
                        itemBuilder: (ctx, i) {
                          final log = _logs[i];
                          return ListTile(
                            leading: CircleAvatar(
                                backgroundColor: _getActionColor(log.actionType).withOpacity(0.1),
                                child: Icon(Icons.history, color: _getActionColor(log.actionType), size: 20),
                            ),
                            title: RichText(
                                text: TextSpan(
                                    style: const TextStyle(color: Colors.black, fontSize: 14),
                                    children: [
                                        TextSpan(text: "${log.username} ", style: const TextStyle(fontWeight: FontWeight.bold)),
                                        TextSpan(text: log.actionType, style: TextStyle(color: _getActionColor(log.actionType), fontWeight: FontWeight.bold)),
                                        TextSpan(text: " ${log.entityType} "),
                                        if(log.entityId != null) TextSpan(text: "#${log.entityId}", style: const TextStyle(color: Colors.grey)),
                                    ]
                                ),
                            ),
                            subtitle: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                    if(log.details != null && log.details!.isNotEmpty) Text(log.details!, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.grey.shade700, fontSize: 12)),
                                    const SizedBox(height: 4),
                                    Text(DateFormat('dd/MM/yyyy HH:mm').format(log.timestamp), style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                ],
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
