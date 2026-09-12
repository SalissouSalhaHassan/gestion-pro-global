import 'dart:io';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../models/article_model.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    const AndroidInitializationSettings androidInit =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const InitializationSettings initSettings =
        InitializationSettings(android: androidInit);
    await _plugin.initialize(initSettings);
    if (Platform.isAndroid) {
      final android =
          _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      await android?.requestNotificationsPermission();
      const AndroidNotificationChannel channel = AndroidNotificationChannel(
        'low_stock_channel',
        'Low Stock',
        description: 'Low stock alerts',
        importance: Importance.high,
      );
      await android?.createNotificationChannel(channel);
    }
  }

  Future<void> showLowStock(
    String article,
    String depot,
    int qty,
  ) async {
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      'low_stock_channel',
      'Low Stock',
      importance: Importance.high,
      priority: Priority.high,
    );
    const NotificationDetails details =
        NotificationDetails(android: androidDetails);
    await _plugin.show(
      article.hashCode ^ depot.hashCode,
      'Stock faible',
      '$article ($depot): $qty',
      details,
    );
  }

  Future<void> checkLowStock(
    List<Article> articles, {
    int threshold = 5,
  }) async {
    for (final a in articles) {
      for (final entry in a.depotStocks.entries) {
        final q = entry.value.toInt();
        if (q <= threshold) {
          await showLowStock(a.designation, entry.key, q);
        }
      }
    }
  }

  Future<void> showNotification({
    required String title,
    required String body,
    String? channelId,
  }) async {
    final AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
      channelId ?? 'default_channel',
      'Alerts',
      importance: Importance.high,
      priority: Priority.high,
    );
    final NotificationDetails details =
        NotificationDetails(android: androidDetails);
    await _plugin.show(
      DateTime.now().millisecondsSinceEpoch % 100000,
      title,
      body,
      details,
    );
  }
}
