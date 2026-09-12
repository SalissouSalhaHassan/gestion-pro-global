import 'package:integration_test/integration_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:gestion_pro_mobile/services/offline_service.dart';
import 'package:gestion_pro_mobile/services/sync_runner.dart';
import 'package:gestion_pro_mobile/services/network_manager.dart';

// Integration test that simulates: offline invoice -> offline payment -> reconnect -> flush queue
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Offline invoice + payment then sync flush', (WidgetTester tester) async {
    final offline = OfflineService();
    await offline.init();

    // Ensure we start with no server configured to simulate OFFLINE
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('server_ip');
    await prefs.remove('server_port');

    // 1. Queue an invoice (temp local id will be negative in UI, here we just queue payload)
    final invoicePayload = {
      'id': -(DateTime.now().millisecondsSinceEpoch),
      'client_id': 1,
      'bl_number': 'TEST-OFF-1',
      'items': [
        {'article_id': 1, 'qte': 1, 'pu_ht': 100}
      ],
      'total_ttc': 100.0
    };

    await offline.queueRequest('invoice', invoicePayload);

    // 2. Queue a payment referencing the invoice temp id
    final payPayload = {
      'invoice_id': invoicePayload['id'],
      'amount': 100.0,
      'method': 'Espèce'
    };

    await offline.queueRequest('pay_invoice', payPayload);

    // Verify entries exist in queue now
    final before = await offline.getPendingRequests();
    expect(before.length >= 2, true);

    // 3. Simulate online: set server prefs (requires a reachable dev server for full run)
    // If you don't have server available, set correct dev server and run on device connected to that network.
    await prefs.setString('server_ip', '192.168.1.100');
    await prefs.setString('server_port', '8000');

    // Validate network manager sees server reachable (may be false if server not reachable)
    final nm = NetworkManager();
    final status = await nm.checkNetworkStatus();

    final syncRunner = SyncRunner();

    if (status == NetworkStatus.ONLINE) {
      // Run the flush once
      await syncRunner.flushQueueOnce();

      // After flush, verify queue is empty (or at least items processed)
      final after = await offline.getPendingRequests();
      expect(after.length < before.length, true);
    } else {
      // If server not reachable in test env, skip actual server verification
      // but ensure that queue still exists and our test environment is configured
      print('Server not reachable from test device/emulator; set correct server_ip/server_port to run full integration.');
    }
  });
}
