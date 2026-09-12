import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models.dart';

class GestionProApiClient {
  String baseUrl;
  final Future<String?> Function() getToken;
  final Future<String?> Function()? getOrganizationId;

  GestionProApiClient({
    required this.baseUrl,
    required this.getToken,
    this.getOrganizationId,
  });

  Future<Map<String, String>> _getHeaders() async {
    final token = await getToken();
    final orgId = getOrganizationId != null ? await getOrganizationId!() : null;
    final headers = {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
      if (orgId != null && orgId.isNotEmpty) 'x-organization-id': orgId,
    };
    return headers;
  }

  Future<dynamic> _get(String endpoint) async {
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$baseUrl$endpoint'), headers: headers);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    } else {
      throw Exception('HTTP error! status: ${response.statusCode}, body: ${response.body}');
    }
  }

  Future<dynamic> _post(String endpoint, Map<String, dynamic> body) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: headers,
      body: json.encode(body),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    } else {
      String errorMessage;
      try {
        final decoded = json.decode(response.body);
        errorMessage = decoded['error'] ?? 'Erreur serveur (${response.statusCode})';
      } catch (_) {
        errorMessage = 'Erreur HTTP ${response.statusCode}: ${response.body}';
      }
      throw Exception(errorMessage);
    }
  }

  Future<Map<String, dynamic>> ping() async {
    final result = await _get('/api/ping');
    return result as Map<String, dynamic>;
  }

  Future<List<Article>> getArticles() async {
    final result = await _get('/api/articles');
    if (result['items'] != null) {
      return (result['items'] as List).map((e) => Article.fromJson(e)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'username': username, 'password': password}),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return json.decode(response.body);
    } else {
      String error = 'Échec de l\'authentification';
      try {
        final decoded = json.decode(response.body);
        error = decoded['error'] ?? error;
      } catch (_) {}
      throw Exception(error);
    }
  }

  /// Process sale with atomic stock deduction via web backend
  Future<Map<String, dynamic>> checkout(Map<String, dynamic> checkoutData) async {
    final result = await _post('/api/pos/checkout', checkoutData);
    return result as Map<String, dynamic>;
  }
}

