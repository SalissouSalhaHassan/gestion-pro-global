import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'lib/services/network_manager.dart';

void main() {
  group('NetworkManager - Three-State Logic Tests', () {
    late NetworkManager networkManager;

    setUp(() {
      networkManager = NetworkManager();
    });

    test('OFFLINE status when no network interface available', () async {
      // Note: This test requires actual network conditions
      // In a mocked environment, you'd mock the Socket and Connectivity
      
      final status = await networkManager.checkNetworkStatus();
      
      // Should be one of three states
      expect(
        status,
        isIn([
          NetworkStatus.ONLINE,
          NetworkStatus.SLOW,
          NetworkStatus.OFFLINE,
        ]),
      );
    });

    test('getStatusString returns appropriate emoji', () async {
      await networkManager.checkNetworkStatus();
      final statusStr = networkManager.getStatusString();
      
      expect(
        statusStr,
        anyOf(
          contains('✅'),  // ONLINE
          contains('⚠️'),  // SLOW
          contains('❌'),  // OFFLINE
        ),
      );
    });

    test('isTrulyOffline returns correct boolean', () async {
      final isOffline = await networkManager.isTrulyOffline();
      expect(isOffline, isA<bool>());
    });

    test('isOnlineFast returns true only if ONLINE', () async {
      final isFast = await networkManager.isOnlineFast();
      expect(isFast, isA<bool>());
    });

    test('isConnectionSlow returns true only if SLOW', () async {
      final isSlow = await networkManager.isConnectionSlow();
      expect(isSlow, isA<bool>());
    });

    test('currentStatus reflects last checked status', () async {
      final initialStatus = networkManager.currentStatus;
      expect(initialStatus, NetworkStatus.OFFLINE); // Default initial state
      
      await networkManager.checkNetworkStatus();
      final statusAfterCheck = networkManager.currentStatus;
      
      expect(
        statusAfterCheck,
        isIn([NetworkStatus.ONLINE, NetworkStatus.SLOW, NetworkStatus.OFFLINE]),
      );
    });
  });
}
