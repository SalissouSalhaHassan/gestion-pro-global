import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_service.dart';
import 'notification_service.dart';

class NotificationRunner {
  static final NotificationRunner _instance = NotificationRunner._internal();
  factory NotificationRunner() => _instance;
  NotificationRunner._internal();

  final ApiService _apiService = ApiService();
  final NotificationService _notificationService = NotificationService();
  Timer? _timer;
  bool _isRunning = false;

  void startPolling({int intervalSeconds = 60}) {
    _timer?.cancel();
    _timer = Timer.periodic(Duration(seconds: intervalSeconds), (timer) {
      _fetchNotifications();
    });
    // Initial fetch
    _fetchNotifications();
  }

  void stopPolling() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _fetchNotifications() async {
    if (_isRunning) return;
    _isRunning = true;

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      if (token == null || token.isEmpty) {
        _isRunning = false;
        return;
      }

      final notifications = await _apiService.getNotifications(token);
      if (notifications.isEmpty) {
         _isRunning = false;
         return;
      }

      for (final n in notifications) {
         final String id = n['id'];
         final String title = n['title'];
         final String message = n['message'];
         
         // Show local notification
         await _showLocalUI(id, title, message);
         
         // Mark as read immediately on server so it doesn't poll again
         await _apiService.markNotificationAsRead(id, token);
      }
    } catch (e) {
      debugPrint('[NOTIFICATION RUNNER] Error: $e');
    } finally {
      _isRunning = false;
    }
  }

  Future<void> _showLocalUI(String id, String title, String message) async {
      await _notificationService.showNotification(
        title: title,
        body: message,
        channelId: 'admin_alerts',
      );
  }
  
  // Internal helper to get service
  NotificationService _notificationServiceInstance() => NotificationService();
}
