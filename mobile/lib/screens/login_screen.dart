import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:local_auth/local_auth.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/auth_provider.dart';
import 'home_screen.dart';
import 'settings_screen.dart';
import '../utils/session_timer.dart';
import '../services/update_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final LocalAuthentication _localAuth = LocalAuthentication();

  static const String _supportEmail = "salissousalhahassan@gmail.com";
  static const String _supportPhoneDisplay = "+227 99 42 52 98";
  static const String _supportPhoneRaw = "+22799425298";
  static const String _supportWhatsappRaw = "22799425298";

  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _canCheckBiometrics = false; 

  final Color _primaryColor = const Color(0xFF4A00E0);
  final Color _secondaryColor = const Color(0xFF8E2DE2);

  @override
  void initState() {
    super.initState();
    _checkBiometrics();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      UpdateService.checkUpdate(context);
      _attemptAutoLogin();
    });
  }

  Future<void> _checkBiometrics() async {
    bool canCheckBiometrics;
    try {
      canCheckBiometrics =
          await _localAuth.canCheckBiometrics &&
          await _localAuth.isDeviceSupported();
    } on PlatformException catch (_) {
      canCheckBiometrics = false;
    }
    if (!mounted) return;
    setState(() {
      _canCheckBiometrics = canCheckBiometrics;
    });
  }

  Future<void> _attemptAutoLogin() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    await auth.tryAutoLogin();
    if (auth.isAuth && mounted) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (context) => const SessionTimer(child: HomeScreen()),
        ),
      );
    }
  }

  Future<void> _authenticate() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final isEnabled = await authProvider.getBiometricEnabled();

    if (!isEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Biométrie désactivée. Activez-la dans les paramètres."),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    try {
      final bool didAuthenticate = await _localAuth.authenticate(
        localizedReason: 'Scan d\'empreinte pour connexion rapide',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );

      if (didAuthenticate && mounted) {
        final credentials = await authProvider.getSavedCredentials();

        if (credentials != null) {
          _usernameController.text = credentials['username']!;
          _passwordController.text = credentials['password']!;
          _submit();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text("Aucun accès enregistré. Veuillez vous connecter une fois manuellement."),
              backgroundColor: Colors.orange,
            ),
          );
        }
      }
    } on PlatformException catch (e) {
      debugPrint("Auth error: $e");
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();

    setState(() => _isLoading = true);
    try {
      await Provider.of<AuthProvider>(
        context,
        listen: false,
      ).login(_usernameController.text.trim(), _passwordController.text.trim());

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (context) => const SessionTimer(child: HomeScreen()),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceAll("Exception:", "").trim()),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openExternalUri(Uri uri) async {
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Impossible d'ouvrir le lien. Veuillez réessayer."),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: const Color(0xFFF3F5F9),
      body: SingleChildScrollView(
        child: SizedBox(
          height: size.height + 220,
          child: Stack(
            children: [
              Container(
                height: size.height * 0.45,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [_primaryColor, _secondaryColor],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(50),
                    bottomRight: Radius.circular(50),
                  ),
                ),
                child: SafeArea(
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(15),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            shape: BoxShape.circle,
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(25),
                            child: Image.asset(
                              'assets/images/logo.png',
                              width: 80,
                              height: 80,
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stackTrace) => const Icon(
                                Icons.storefront_rounded,
                                size: 50,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        const Text(
                          "Gestion Pro",
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          "Connectez-vous à votre espace",
                          style: TextStyle(color: Colors.white.withOpacity(0.8)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              Positioned(
                top: 50,
                right: 20,
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.support_agent, color: Colors.white),
                      tooltip: 'Service client',
                      onPressed: _showSupportDialog,
                    ),
                    IconButton(
                      icon: const Icon(Icons.settings, color: Colors.white),
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const SettingsScreen()),
                      ),
                    ),
                  ],
                ),
              ),

              Positioned(
                top: size.height * 0.38,
                left: 20,
                right: 20,
                child: Container(
                  padding: const EdgeInsets.all(25),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black12,
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        const Text("Bienvenue", style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        const Text(
                          "Connectez-vous avec votre compte ou abonnement",
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                        const SizedBox(height: 20),
                        _buildInput(
                          controller: _usernameController,
                          label: "Nom d'utilisateur ou Email",
                          hintText: "ex: admin ou contact@entreprise.com",
                          icon: Icons.person_outline,
                        ),
                        const SizedBox(height: 15),
                        _buildInput(
                          controller: _passwordController,
                          label: "Mot de passe",
                          icon: Icons.lock_outline,
                          isPassword: true,
                          obscure: _obscurePassword,
                          toggle: () => setState(() => _obscurePassword = !_obscurePassword),
                        ),
                        const SizedBox(height: 30),

                        SizedBox(
                          width: double.infinity,
                          height: 55,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _primaryColor,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                              elevation: 5,
                            ),
                            onPressed: _isLoading ? null : _submit,
                            child: _isLoading
                                ? const CircularProgressIndicator(color: Colors.white)
                                : const Text(
                                    "SE CONNECTER",
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                                  ),
                          ),
                        ),

                        if (_canCheckBiometrics) ...[
                          const SizedBox(height: 20),
                          GestureDetector(
                            onTap: _authenticate,
                            child: Column(
                              children: [
                                Icon(Icons.fingerprint, size: 40, color: _primaryColor),
                                const SizedBox(height: 5),
                                Text(
                                  "Connexion biométrique",
                                  style: TextStyle(color: _primaryColor, fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ],

                        // service client moved to top-right help icon
                        // see _showSupportDialog()
                        const SizedBox(height: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String label,
    String? hintText,
    required IconData icon,
    bool isPassword = false,
    bool obscure = false,
    VoidCallback? toggle,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        hintText: hintText,
        prefixIcon: Icon(icon, color: _primaryColor),
        suffixIcon: isPassword
            ? IconButton(
                icon: Icon(obscure ? Icons.visibility_off : Icons.visibility),
                onPressed: toggle,
              )
            : null,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        filled: true,
        fillColor: Colors.grey[50],
      ),
      validator: (v) => v!.isEmpty ? "Champ requis" : null,
    );
  }

  Widget _buildSupportButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onPressed,
  }) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: 4,
        ),
        onPressed: onPressed,
        child: Row(
          children: [
            const SizedBox(width: 8),
            Icon(icon, color: Colors.white),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 28),
          ],
        ),
      ),
    );
  }

  void _showSupportDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text("Service client"),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildSupportButton(
              label: "Appeler $_supportPhoneDisplay",
              icon: Icons.phone,
              color: const Color(0xFF1E88E5),
              onPressed: () => _openExternalUri(
                Uri(scheme: 'tel', path: _supportPhoneRaw),
              ),
            ),
            const SizedBox(height: 12),
            _buildSupportButton(
              label: "WhatsApp $_supportPhoneDisplay",
              icon: Icons.chat_bubble,
              color: const Color(0xFF1EBE57),
              onPressed: () => _openExternalUri(
                Uri.https('wa.me', _supportWhatsappRaw),
              ),
            ),
            const SizedBox(height: 12),
            _buildSupportButton(
              label: "Email $_supportEmail",
              icon: Icons.email,
              color: const Color(0xFFFF6B6B),
              onPressed: () => _openExternalUri(
                Uri(scheme: 'mailto', path: _supportEmail),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Fermer"),
          ),
        ],
      ),
    );
  }
}
