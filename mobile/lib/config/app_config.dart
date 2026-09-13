import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppConfig {
  // Supabase Configuration matching web project (.env.local)
  static const String defaultSupabaseUrl = 'https://mxairvfgklibhamkpeqq.supabase.co';
  static const String defaultSupabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YWlydmZna2xpYmhhbWtwZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTYyNzgsImV4cCI6MjEwMzgzMjI3OH0.Juzca1wdXt7wXTTEXvqzZd4qiMWsSKavukA1c-PDYck';

  // Production Web Backend URL
  static const String defaultProductionApiUrl = 'https://gestion-pro-global-tege.vercel.app';
  
  // Database Pooler Configuration (matching Supabase project mxairvfgklibhamkpeqq)
  static const String defaultDbHost = 'aws-0-eu-central-1.pooler.supabase.com';
  static const String defaultDbPort = '6543';
  static const String defaultDbName = 'postgres';
  static const String defaultDbUser = 'postgres.mxairvfgklibhamkpeqq';

  // Local development fallback
  static const String localApiUrl = 'http://10.0.2.2:3000'; // Standard Android Emulator loopback

  static String _currentApiUrl = defaultProductionApiUrl;
  static const String _currentSupabaseUrl = defaultSupabaseUrl;
  static const String _currentSupabaseKey = defaultSupabaseAnonKey;

  static String get apiUrl => _currentApiUrl;
  static String get supabaseUrl => defaultSupabaseUrl;
  static String get supabaseAnonKey => defaultSupabaseAnonKey;

  /// Load persisted configuration overrides from SharedPreferences
  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      
      // Auto-heal and enforce production API URL
      final savedApiUrl = prefs.getString('custom_api_url');
      if (savedApiUrl == null || !savedApiUrl.contains('-tege')) {
        _currentApiUrl = defaultProductionApiUrl;
        await prefs.setString('custom_api_url', defaultProductionApiUrl);
      } else {
        _currentApiUrl = savedApiUrl;
      }
      
      // FROZEN: Always enforce official GESTION PRO GLOBAL Supabase credentials
      // Overwrite any legacy or incorrect values in SharedPreferences
      await prefs.setString('supabase_url', defaultSupabaseUrl);
      await prefs.setString('supabase_key', defaultSupabaseAnonKey);
      await prefs.setString('db_host', defaultDbHost);
      await prefs.setString('db_port', defaultDbPort);
      await prefs.setString('db_name', defaultDbName);
      await prefs.setString('db_user', defaultDbUser);

      debugPrint('AppConfig: Loaded API URL -> $_currentApiUrl');
      debugPrint('AppConfig: Enforced Frozen Supabase URL -> $defaultSupabaseUrl');
    } catch (e) {
      debugPrint('AppConfig init error: $e');
    }
  }

  /// Save custom API base URL (e.g. for testing with local server)
  static Future<void> setCustomApiUrl(String url) async {
    final cleanUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    _currentApiUrl = cleanUrl.isNotEmpty ? cleanUrl : defaultProductionApiUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('custom_api_url', _currentApiUrl);
  }

  /// Reset to default production server
  static Future<void> resetToDefaults() async {
    _currentApiUrl = defaultProductionApiUrl;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('custom_api_url');
    await prefs.setString('supabase_url', defaultSupabaseUrl);
    await prefs.setString('supabase_key', defaultSupabaseAnonKey);
    await prefs.setString('db_host', defaultDbHost);
    await prefs.setString('db_port', defaultDbPort);
    await prefs.setString('db_name', defaultDbName);
    await prefs.setString('db_user', defaultDbUser);
  }
}
