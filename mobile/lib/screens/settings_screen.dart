import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart';
import '../providers/theme_provider.dart';
import '../providers/auth_provider.dart';
import '../api/supabase_service.dart';
import '../config/app_config.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'printer_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _supabaseUrlController = TextEditingController();
  final _supabaseKeyController = TextEditingController();
  
  // PostgreSQL Direct Fields
  final _dbHostController = TextEditingController();
  final _dbPortController = TextEditingController();
  final _dbNameController = TextEditingController();
  final _dbUserController = TextEditingController();
  final _dbPassController = TextEditingController();

  bool _isLoading = false;
  bool _biometricEnabled = false;

  final Color _bgColor = const Color(0xFF0F111A);
  final Color _cardColor = const Color(0xFF1A1D29);
  final Color _accentColor = const Color(0xFF3D5AFE);
  final Color _textColor = Colors.white;
  final Color _subTextColor = Colors.white70;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final bioEnabled = await auth.getBiometricEnabled();
    
    // Always enforce and sync official GESTION PRO GLOBAL credentials
    await prefs.setString('supabase_url', AppConfig.defaultSupabaseUrl);
    await prefs.setString('supabase_key', AppConfig.defaultSupabaseAnonKey);
    await prefs.setString('db_host', AppConfig.defaultDbHost);
    await prefs.setString('db_port', AppConfig.defaultDbPort);
    await prefs.setString('db_name', AppConfig.defaultDbName);
    await prefs.setString('db_user', AppConfig.defaultDbUser);

    if (mounted) {
      setState(() {
        _supabaseUrlController.text = AppConfig.defaultSupabaseUrl;
        _supabaseKeyController.text = AppConfig.defaultSupabaseAnonKey;
        
        _dbHostController.text = AppConfig.defaultDbHost;
        _dbPortController.text = AppConfig.defaultDbPort;
        _dbNameController.text = AppConfig.defaultDbName;
        _dbUserController.text = AppConfig.defaultDbUser;
        _dbPassController.text = '••••••••••••••••••••';

        _biometricEnabled = bioEnabled;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final themeProvider = Provider.of<ThemeProvider>(context);

    return Scaffold(
      backgroundColor: _bgColor,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Center(
                child: Text(
                  "Paramètres de Connexion Unifiés",
                  style: TextStyle(
                    color: _textColor,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 15),

            _buildSection(
              title: "API Supabase (GESTION PRO GLOBAL)",
              icon: Icons.cloud_done_rounded,
              accentColor: const Color(0xFF2ECC71),
              children: [
                Container(
                  margin: const EdgeInsets.only(bottom: 15),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF27AE60).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF27AE60).withOpacity(0.35)),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.verified_user_rounded, color: Color(0xFF2ECC71), size: 18),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          "Base de données officielle GESTION PRO GLOBAL verrouillée",
                          style: TextStyle(color: Color(0xFF2ECC71), fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
                _buildModernTextField(
                  controller: _supabaseUrlController,
                  label: "Supabase URL",
                  hint: "https://mxairvfgklibhamkpeqq.supabase.co",
                  icon: Icons.link_outlined,
                  readOnly: true,
                ),
                const SizedBox(height: 15),
                _buildModernTextField(
                  controller: _supabaseKeyController,
                  label: "Supabase Key (anon)",
                  hint: "eyJhbG...",
                  icon: Icons.vpn_key_outlined,
                  isPassword: true,
                  readOnly: true,
                ),
              ],
            ),
            const SizedBox(height: 20),

            _buildSection(
              title: "Base de Données (PostgreSQL / Pooler)",
              icon: Icons.storage_rounded,
              accentColor: const Color(0xFFF39C12),
              children: [
                _buildModernTextField(
                  controller: _dbHostController,
                  label: "Adresse IP (Host)",
                  hint: "aws-0-eu-central-1.pooler.supabase.com",
                  icon: Icons.dns_outlined,
                  readOnly: true,
                ),
                const SizedBox(height: 15),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: _buildModernTextField(
                        controller: _dbPortController,
                        label: "Port",
                        hint: "6543",
                        icon: Icons.tag,
                        readOnly: true,
                      ),
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      flex: 3,
                      child: _buildModernTextField(
                        controller: _dbNameController,
                        label: "Nom de la Base",
                        hint: "postgres",
                        icon: Icons.storage,
                        readOnly: true,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 15),
                _buildModernTextField(
                  controller: _dbUserController,
                  label: "Utilisateur",
                  hint: "postgres.mxairvfgklibhamkpeqq",
                  icon: Icons.person_outline,
                  readOnly: true,
                ),
              ],
            ),
            const SizedBox(height: 25),

            _buildActionBtn(
              text: "Tester la Connexion Cloud",
              icon: Icons.check_circle_outline,
              color: const Color(0xFF2ECC71),
              onPressed: _testConnection,
            ),
            const SizedBox(height: 12),

            _buildActionBtn(
              text: "Synchroniser & Verrouiller la Connexion",
              icon: Icons.lock_reset,
              color: const Color(0xFF3D5AFE),
              onPressed: _isLoading ? null : _saveConfig,
              isLoading: _isLoading,
            ),
            const SizedBox(height: 12),

            _buildActionBtn(
              text: "Aide Diagnostic",
              icon: Icons.build_circle_outlined,
              color: const Color(0xFF3498DB),
              onPressed: _showDiagnostic,
            ),
            const SizedBox(height: 25),

            _buildSection(
              title: "Sécurité & Affichage",
              icon: Icons.security_outlined,
              children: [
                _buildBiometricToggle(authProvider),
                const Divider(color: Colors.white10),
                _buildSwitchTile(
                  title: "Mode Sombre",
                  icon: themeProvider.isDarkMode ? Icons.dark_mode : Icons.light_mode,
                  value: themeProvider.isDarkMode,
                  onChanged: (val) => themeProvider.toggleTheme(),
                ),
                const Divider(color: Colors.white10),
                _buildNavTile(
                  title: "Paramètres Imprimante",
                  icon: Icons.print_outlined,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PrinterScreen()),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 30),

            _buildActionBtn(
              text: "Déconnexion",
              icon: Icons.logout,
              color: Colors.redAccent.withOpacity(0.8),
              onPressed: () => _confirmLogout(context, authProvider),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeader(AuthProvider auth) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: _accentColor.withOpacity(0.2),
            child: Icon(Icons.person, color: _accentColor, size: 30),
          ),
          const SizedBox(width: 15),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(auth.username ?? "Utilisateur", style: TextStyle(color: _textColor, fontSize: 18, fontWeight: FontWeight.bold)),
                Text((auth.role ?? "vendeur").toUpperCase(), style: TextStyle(color: _accentColor, fontSize: 12, letterSpacing: 1.2, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
            child: const Text("Mode Cloud", style: TextStyle(color: Colors.green, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildSection({required String title, required IconData icon, required List<Widget> children, Color? accentColor}) {
    final titleColor = accentColor ?? _accentColor;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 8, bottom: 10),
          child: Row(
            children: [
              Icon(icon, color: titleColor, size: 18),
              const SizedBox(width: 8),
              Text(title.toUpperCase(), style: TextStyle(color: titleColor, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1)),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: _cardColor, borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white.withOpacity(0.05))),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _buildModernTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    bool isPassword = false,
    bool readOnly = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: const TextStyle(color: Colors.white54, fontSize: 12)),
            if (readOnly) ...[
              const SizedBox(width: 6),
              const Icon(Icons.lock_rounded, size: 12, color: Color(0xFF2ECC71)),
              const SizedBox(width: 4),
              const Text(
                "Verrouillé",
                style: TextStyle(color: Color(0xFF2ECC71), fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ],
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: isPassword,
          readOnly: readOnly,
          style: TextStyle(color: readOnly ? Colors.white70 : _textColor, fontSize: 13),
          decoration: InputDecoration(
            filled: true,
            fillColor: readOnly ? Colors.white.withOpacity(0.04) : _bgColor.withOpacity(0.5),
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.white24, fontSize: 13),
            prefixIcon: Icon(icon, color: readOnly ? const Color(0xFF2ECC71) : _subTextColor, size: 18),
            suffixIcon: readOnly ? const Icon(Icons.lock_outline, color: Colors.white24, size: 16) : null,
            contentPadding: const EdgeInsets.all(15),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: readOnly ? Colors.white12 : _accentColor, width: 1)),
          ),
        ),
      ],
    );
  }

  Widget _buildActionBtn({required String text, required IconData icon, required Color color, required VoidCallback? onPressed, bool isLoading = false}) {
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      onPressed: onPressed,
      child: isLoading
          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 18),
                const SizedBox(width: 8),
                Text(text, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              ],
            ),
    );
  }

  Widget _buildSwitchTile({required String title, required IconData icon, required bool value, required Function(bool) onChanged}) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      secondary: Icon(icon, color: _textColor),
      title: Text(title, style: TextStyle(color: _textColor, fontSize: 14)),
      value: value,
      activeColor: _accentColor,
      onChanged: onChanged,
    );
  }

  Widget _buildNavTile({required String title, required IconData icon, required VoidCallback onTap}) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      onTap: onTap,
      leading: Icon(icon, color: _textColor),
      title: Text(title, style: TextStyle(color: _textColor, fontSize: 14)),
      trailing: const Icon(Icons.chevron_right, color: Colors.white24),
    );
  }

  Widget _buildBiometricToggle(AuthProvider auth) {
    return _buildSwitchTile(
      title: "Connexion biométrique",
      icon: Icons.fingerprint,
      value: _biometricEnabled,
      onChanged: (val) async {
        await auth.setBiometricEnabled(val);
        setState(() => _biometricEnabled = val);
        if (val) {
          _showSnackBar("Biométrie activée. Connectez-vous une fois pour enregistrer vos accès.", Colors.blue);
        } else {
          _showSnackBar("Biométrie désactivée.", Colors.orange);
        }
      },
    );
  }

  Future<void> _testConnection() async {
    setState(() => _isLoading = true);
    try {
      final testClient = SupabaseClient(AppConfig.defaultSupabaseUrl, AppConfig.defaultSupabaseAnonKey);
      await testClient.from('organizations').select('id').limit(1);
      _showSnackBar("✅ Connexion Cloud GESTION PRO GLOBAL réussie !", Colors.green);
    } catch (e) {
      try {
        final testClient = SupabaseClient(AppConfig.defaultSupabaseUrl, AppConfig.defaultSupabaseAnonKey);
        await testClient.from('users').select('id').limit(1);
        _showSnackBar("✅ Connexion Cloud GESTION PRO GLOBAL réussie !", Colors.green);
      } catch (e2) {
        _showSnackBar("❌ Échec de connexion : $e2", Colors.red);
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showDiagnostic() {
     showDialog(
       context: context,
       builder: (ctx) => AlertDialog(
         backgroundColor: _cardColor,
         title: const Text("Diagnostic Connexion", style: TextStyle(color: Colors.white)),
         content: SingleChildScrollView(
           child: Column(
             crossAxisAlignment: CrossAxisAlignment.start,
             mainAxisSize: MainAxisSize.min,
             children: [
               _diagItem("Supabase URL", AppConfig.defaultSupabaseUrl),
               _diagItem("Host IP", AppConfig.defaultDbHost),
               _diagItem("Port", AppConfig.defaultDbPort),
               _diagItem("DB Name", AppConfig.defaultDbName),
               _diagItem("User", AppConfig.defaultDbUser),
               const Divider(color: Colors.white10),
               const Text("Status: Configuration officielle GESTION PRO GLOBAL gelée et active.", 
                 style: TextStyle(color: Colors.white54, fontSize: 11)),
             ],
           ),
         ),
         actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text("Fermer")),
         ],
       ),
    );
  }

  Widget _diagItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text("$label: ${value.isEmpty ? 'VIDE' : value}", 
        style: const TextStyle(color: Colors.white70, fontSize: 13)),
    );
  }

  Future<void> _saveConfig() async {
    setState(() => _isLoading = true);
    try {
      await AppConfig.resetToDefaults();
      await SupabaseService().init();
      await _loadConfig();

      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackBar("✅ Configuration Cloud GESTION PRO GLOBAL synchronisée et verrouillée !", Colors.green);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showSnackBar("Erreur de synchronisation : $e", Colors.red);
      }
    }
  }

  void _showSnackBar(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  void _confirmLogout(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: _cardColor,
        title: Text("Déconnexion", style: TextStyle(color: _textColor)),
        content: Text("Voulez-vous vraiment vous déconnecter ?", style: TextStyle(color: _subTextColor)),
        actions: [
          TextButton(child: const Text("Annuler", style: TextStyle(color: Colors.white54)), onPressed: () => Navigator.pop(context)),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () { auth.logout(); Navigator.pop(context); },
            child: const Text("Déconnexion", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
