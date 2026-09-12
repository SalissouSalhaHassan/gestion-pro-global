Integration test: Offline invoice + payment → reconnect → flush

Goal
- Verify end-to-end offline flow in the mobile app: create invoice offline, create payment offline, reconnect, ensure queue flush remaps temp IDs and payments are sent to server.

Prerequisites
- A reachable dev server (PostgreSQL backend + API) running and accessible from emulator/device at IP/PORT.
- Set the server IP/PORT in app preferences or within the emulator: `server_ip` and `server_port`.
- Flutter SDK and emulator/device available.

Files added
- `integration_test/offline_sync_test.dart` — integration test that queues an invoice and a payment locally then triggers `SyncRunner.flushQueueOnce()`.

How to run (on your machine/emulator)
1. Open terminal at `gestion_pro_mobile` folder.
2. Ensure your emulator/device has network access to the dev server.
3. Run the integration test:

```bash
flutter test integration_test/offline_sync_test.dart
```

Or run as an integration_test on a device (recommended for plugin compatibility):

```bash
flutter drive --driver=test_driver/integration_driver.dart --target=integration_test/offline_sync_test.dart
```

(If you don't have `test_driver/integration_driver.dart`, create the minimal driver per the `integration_test` docs.)

Expected behaviour
- While server IP is not set or server unreachable: the test will queue invoice/payment and skip server flush step.
- When server is reachable and credentials/token are present (auth flow): `SyncRunner` should flush queue, invoice gets created on server (serverId), `OfflineService.updateQueueInvoiceId` replaces temp IDs in queued items, and queued payment is sent using the server invoiceId.
- After successful flush: `OfflineService.getPendingRequests()` should return fewer items (ideally zero).

Manual verification steps (if you prefer manual test):
1. Start app on device/emulator.
2. Turn off network or set server IP empty.
3. Create invoice in app (it shows locally with pending=true and id negative).
4. Create payment for that invoice.
5. Re-enable network and ensure device can reach server IP.
6. Wait up to 30s (SyncRunner periodic) or restart app to trigger immediate flush.
7. Check server API or DB to confirm invoice created and payment recorded.
8. Confirm local queue cleared.

Next steps
- If this test passes, I will add retry/backoff and detailed logging for failed queue items, plus a small dashboard showing queue size and errors in-app.
- If it fails, run `flutter run` with `--verbose` and capture logs, then share them so I can diagnose specific errors.
