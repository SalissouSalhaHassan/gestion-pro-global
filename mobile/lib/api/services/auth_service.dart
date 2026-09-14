import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:api_flutter/api_flutter.dart';
import '../supabase_service.dart';
import '../../config/app_config.dart';

class AuthService {
  final SupabaseService _supabaseService = SupabaseService();
  late final GestionProApiClient _nextApiClient;

  AuthService() {
    _nextApiClient = GestionProApiClient(
      baseUrl: AppConfig.apiUrl,
      getToken: () async {
        try {
          const storage = FlutterSecureStorage();
          String? token = await storage.read(key: 'auth_token');
          if (token == null || token.isEmpty) {
            final prefs = await SharedPreferences.getInstance();
            token = prefs.getString('auth_token');
          }
          return token;
        } catch (_) {
          return null;
        }
      },
      getOrganizationId: () async {
        try {
          const storage = FlutterSecureStorage();
          String? orgId = await storage.read(key: 'auth_organization_id');
          if (orgId == null || orgId.isEmpty) {
            final prefs = await SharedPreferences.getInstance();
            orgId = prefs.getString('auth_organizationId');
          }
          return orgId;
        } catch (_) {
          return null;
        }
      },
    );
  }

  Future<bool> _ensureSupabaseReady() async {
    if (!_supabaseService.isInitialized) await _supabaseService.init();
    return _supabaseService.isInitialized && _supabaseService.client != null;
  }

  /// Perform authentication via Unified Next.js API with fallback to Supabase direct
  Future<Map<String, dynamic>> login(String username, String password) async {
    // 1. Try Unified API (Next.js) first
    try {
      debugPrint('🔑 AuthService: Attempting login via Unified API (Next.js)...');
      final res = await _nextApiClient.login(username, password);
      debugPrint('✅ AuthService: Login successful via Unified API');
      return res;
    } catch (e) {
      debugPrint('⚠️ AuthService: Unified API login failed: $e');

      // 2. Fallback to direct Supabase login
      if (!await _ensureSupabaseReady()) {
        throw Exception("Connexion impossible: Serveur Next.js indisponible ($e) et Cloud non configuré.");
      }

      try {
        final res = await _supabaseService.loginDirect(username, password);
        if (res != null) return res;
      } catch (err) {
        final errStr = err.toString();
        if (errStr.contains('42501') || errStr.contains('permission denied')) {
          throw Exception("Identifiant ou mot de passe incorrect.");
        }
        rethrow;
      }
    }
    throw Exception("Échec de l'authentification");
  }

  /// Retrieve current authenticated user context and permissions
  Future<Map<String, dynamic>> getAuthContext({bool refresh = false}) async {
    final prefs = await SharedPreferences.getInstance();
    final role = prefs.getString('auth_role') ?? 'vendeur';
    final isAdmin = (role.toLowerCase() == 'admin' || role.toLowerCase() == 'administrateur');
    final userId = prefs.getString('auth_userId');
    final username = prefs.getString('auth_username');
    List<String> depots = prefs.getStringList('auth_depots') ?? [];
    if (!isAdmin) {
      final last = prefs.getInt('auth_depots_ts') ?? 0;
      final now = DateTime.now().millisecondsSinceEpoch;
      final isStale = (now - last) > 5 * 60 * 1000;
      if (refresh || depots.isEmpty || isStale) {
        depots = await refreshUserDepots(force: refresh);
      }
    }
    final orgId = prefs.getString('auth_organizationId') ?? await _supabaseService.getOrganizationId();
    return {
      'isAdmin': isAdmin,
      'userId': userId,
      'username': username,
      'allowedDepots': depots,
      'organizationId': orgId,
    };
  }

  /// Refresh assigned depots for current user
  Future<List<String>> refreshUserDepots({bool force = false}) async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('auth_userId');
    if (userId == null || userId.isEmpty) return [];

    if (!await _ensureSupabaseReady()) return prefs.getStringList('auth_depots') ?? [];

    try {
      final client = _supabaseService.client!;
      final orgId = prefs.getString('auth_organizationId') ?? await _supabaseService.getOrganizationId();

      var q = client
          .from('user_depots')
          .select('depots(nom, is_active, is_deleted)')
          .eq('user_id', userId);
      if (orgId != null && orgId.isNotEmpty) {
        q = q.eq('organization_id', orgId);
      }

      final res = await q;
      final names = <String>[];
      for (final r in (res as List)) {
        final d = r['depots'];
        if (d != null) {
          final isDel = d['is_deleted'];
          final isAct = d['is_active'];
          if (isDel == true || isAct == false) continue;
          final name = d['nom']?.toString().trim();
          if (name != null && name.isNotEmpty) names.add(name);
        }
      }

      final uniqueNames = names.toSet().toList();
      await prefs.setStringList('auth_depots', uniqueNames);
      await prefs.setInt('auth_depots_ts', DateTime.now().millisecondsSinceEpoch);
      return uniqueNames;
    } catch (e) {
      debugPrint('AuthService: refreshUserDepots error: $e');
      return prefs.getStringList('auth_depots') ?? [];
    }
  }

  /// Ensure active user has administrator privileges
  Future<void> requireAdmin() async {
    final authCtx = await getAuthContext();
    if (!(authCtx['isAdmin'] as bool)) {
      throw Exception("Accès refusé: action réservée aux administrateurs.");
    }
  }

  /// Retrieve effective auth token with storage fallback
  Future<String> getEffectiveToken(String token) async {
    if (token.isNotEmpty) return token;
    const storage = FlutterSecureStorage();
    String? secureToken = await storage.read(key: 'auth_token');
    if (secureToken == null || secureToken.isEmpty) {
      final prefs = await SharedPreferences.getInstance();
      secureToken = prefs.getString('auth_token');
    }
    return secureToken ?? '';
  }
}
