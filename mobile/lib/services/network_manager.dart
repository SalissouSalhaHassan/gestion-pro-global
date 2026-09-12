import 'dart:io';
import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_service.dart';

class NetworkStatus {
  static const String ONLINE = 'ONLINE';     // متصل وسريع
  static const String SLOW = 'SLOW';         // متصل لكن بطيء
  static const String OFFLINE = 'OFFLINE';   // غير متصل تماماً
}

class NetworkManager {
  static final NetworkManager _instance = NetworkManager._internal();
  
  factory NetworkManager() {
    return _instance;
  }
  
  NetworkManager._internal() {
    _initConnectivityListener();
  }

  String _currentStatus = NetworkStatus.OFFLINE;
  DateTime? _lastCheckTime;
  
  // Stream controller for network status changes
  final StreamController<String> _statusChangeController = 
      StreamController<String>.broadcast();
  
  /// Stream that emits network status changes
  Stream<String> get onStatusChange => _statusChangeController.stream;
  
  StreamSubscription? _connectivitySubscription;
  
  String get currentStatus => _currentStatus;

  /// فحص حالة الاتصال الشامل:
  /// - OFFLINE: لا توجد واجهة شبكة على الجهاز
  /// - SLOW: توجد واجهة (Wi-Fi/Mobile) لكن الوصول للخادم الخارجي بطيء أو فشل
  /// - ONLINE: متصل وسريع
  Future<String> checkNetworkStatus({
    Duration fastTimeout = const Duration(seconds: 2),
    Duration slowThreshold = const Duration(seconds: 10),
  }) async {
    try {
      final now = DateTime.now();
      if (_lastCheckTime != null && now.difference(_lastCheckTime!).inSeconds < 5) {
        return _currentStatus;
      }

      // 1. فحص الواجهات المتاحة
      final connectivity = Connectivity();
      final dynamic result = await connectivity.checkConnectivity();
      
      bool hasLocalInterface = false;
      if (result is List) {
        hasLocalInterface = result.isNotEmpty && 
            result.any((r) => r != ConnectivityResult.none && r != ConnectivityResult.bluetooth);
      } else {
        hasLocalInterface = (result != ConnectivityResult.none && result != ConnectivityResult.bluetooth);
      }

      if (!hasLocalInterface) {
        _currentStatus = NetworkStatus.OFFLINE;
        _lastCheckTime = DateTime.now();
        return NetworkStatus.OFFLINE;
      }

      // 2. إذا كانت هناك واجهة، حاول الوصول للإنترنت الخارجي
      final stopwatch = Stopwatch()..start();
      try {
        // محاولة الاتصال بـ Google DNS (سريعة إذا كان هناك إنترنت)
        final socket = await Socket.connect('8.8.8.8', 53, timeout: fastTimeout);
        socket.destroy();
        stopwatch.stop();

        // تحقق من السرعة
        if (stopwatch.elapsed >= slowThreshold) {
          _currentStatus = NetworkStatus.SLOW;
        } else {
          _currentStatus = NetworkStatus.ONLINE;
        }
      } catch (e) {
        // فشل الاتصال بالإنترنت الخارجي لكن الواجهة المحلية موجودة
        // → تعتبر SLOW (متصل لكن بدون إنترنت)
        debugPrint('[NETWORK] External connection failed but local interface exists: $e');
        _currentStatus = NetworkStatus.SLOW;
      }

      _lastCheckTime = DateTime.now();
      return _currentStatus;
    } catch (e) {
      debugPrint('[NETWORK] checkNetworkStatus error: $e');
      return NetworkStatus.OFFLINE;
    }
  }

  /// هل الجهاز غير متصل تماماً؟
  /// استخدم هذا قبل قرار حفظ HORS LIGNE
  Future<bool> isTrulyOffline() async {
    final status = await checkNetworkStatus();
    return status == NetworkStatus.OFFLINE;
  }

  /// هل الاتصال سريع وموثوق؟
  Future<bool> isOnlineFast() async {
    final status = await checkNetworkStatus();
    return status == NetworkStatus.ONLINE;
  }

  /// هل الاتصال بطيء؟
  Future<bool> isConnectionSlow() async {
    final status = await checkNetworkStatus();
    return status == NetworkStatus.SLOW;
  }

  /// الحصول على نص وصف الحالة
  String getStatusString() {
    switch (_currentStatus) {
      case NetworkStatus.ONLINE:
        return '✅ متصل وسريع';
      case NetworkStatus.SLOW:
        return '⚠️ الاتصال بطيء';
      case NetworkStatus.OFFLINE:
        return '❌ غير متصل';
      default:
        return '?';
    }
  }
  
  /// Initialize connectivity listener
  void _initConnectivityListener() {
    final connectivity = Connectivity();
    
    // Listen to connectivity changes
    _connectivitySubscription = connectivity.onConnectivityChanged.listen((dynamic result) {
      debugPrint('[NETWORK] Connectivity changed: $result');
      
      // Trigger status check on connectivity change
      checkNetworkStatus().then((newStatus) {
        // Only emit if status actually changed
        if (newStatus != _currentStatus) {
          final oldStatus = _currentStatus;
          _currentStatus = newStatus;
          
          debugPrint('[NETWORK] Status changed: $oldStatus → $newStatus');
          _statusChangeController.add(newStatus);
          
          // Special notification for OFFLINE → ONLINE transition
          if (oldStatus == NetworkStatus.OFFLINE && 
              (newStatus == NetworkStatus.ONLINE || newStatus == NetworkStatus.SLOW)) {
            debugPrint('🌐 [NETWORK] Network reconnected! Triggering sync...');
          }
        }
      });
    });
  }
  
  /// Clean up resources
  void dispose() {
    _connectivitySubscription?.cancel();
    _statusChangeController.close();
  }
}
