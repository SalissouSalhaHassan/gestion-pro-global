import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppConfig {
  // Supabase Configuration matching web project (.env.local)
  static const String defaultSupabaseUrl = 'https://mxairvfgklibhamkpeqq.supabase.co';
  static const String defaultSupabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14YWlydmZna2xpYmhhbWtwZXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTYyNzgsImV4cCI6MjEwMzgzMjI3OH0.Juzca1wdXt7wXTTEXvqzZd4qiMWsSKavukA1c-PDYck';

  // Production Web Backend URL
  static const String defaultProductionApiUrl = 'https://gestion-pro-global.vercel.app';
  
  // Local development fallback
  static const String localApiUrl = 'http://10.0.2.2:3000'; // Standard Android Emulator loopback

  static String _currentApiUrl = defaultProductionApiUrl;
  static String _currentSupabaseUrl = defaultSupabaseUrl;
  static String _currentSupabaseKey = defaultSupabaseAnonKey;

  static String get apiUrl => _currentApiUrl;
  static String get supabaseUrl => _currentSupabaseUrl;
  static String get supabaseAnonKey => _currentSupabaseKey;

  /// Load persisted configuration overrides from SharedPreferences
  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _currentApiUrl = prefs.getString('custom_api_url') ?? defaultProductionApiUrl;
      _currentSupabaseUrl = prefs.getString('supabase_url') ?? defaultSupabaseUrl;
      _currentSupabaseKey = prefs.getString('supabase_key') ?? defaultSupabaseAnonKey;

      debugPrint('AppConfig: Loaded API URL -> $_currentApiUrl');
      debugPrint('AppConfig: Loaded Supabase URL -> $_currentSupabaseUrl');
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
    _currentSupabaseUrl = defaultSupabaseUrl;
    _currentSupabaseKey = defaultSupabaseAnonKey;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('custom_api_url');
    await prefs.remove('supabase_url');
    await prefs.remove('supabase_key');
  }
}
