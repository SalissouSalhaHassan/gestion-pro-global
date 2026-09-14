import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import 'package:uuid/uuid.dart';
import 'network_manager.dart';

class PendingInvoice {
  final String localId;
  final String organizationId;
  final Map<String, dynamic> payload;
  final double? paymentAmount;
  final String? paymentMethod;
  final String? advanceClientId;
  final DateTime createdAt;
  final int retryCount;
  final String status;
  final String? errorMessage;

  PendingInvoice({
    required this.localId,
    required this.organizationId,
    required this.payload,
    this.paymentAmount,
    this.paymentMethod,
    this.advanceClientId,
    required this.createdAt,
    this.retryCount = 0,
    this.status = 'pending',
    this.errorMessage,
  });

  Map<String, dynamic> toMap() {
    return {
      'local_id': localId,
      'organization_id': organizationId,
      'payload': json.encode(payload),
      'payment_amount': paymentAmount,
      'payment_method': paymentMethod,
      'advance_client_id': advanceClientId,
      'created_at': createdAt.toIso8601String(),
      'retry_count': retryCount,
      'status': status,
      'error_message': errorMessage,
    };
  }

  factory PendingInvoice.fromMap(Map<String, dynamic> map) {
    return PendingInvoice(
      localId: map['local_id'],
      organizationId: map['organization_id'] ?? '',
      payload: json.decode(map['payload']),
      paymentAmount: (map['payment_amount'] as num?)?.toDouble(),
      paymentMethod: map['payment_method'],
      advanceClientId: map['advance_client_id'],
      createdAt: DateTime.tryParse(map['created_at'] ?? '') ?? DateTime.now(),
      retryCount: map['retry_count'] ?? 0,
      status: map['status'] ?? 'pending',
      errorMessage: map['error_message'],
    );
  }
}

typedef InvoiceSyncCallback = Future<dynamic> Function(
  Map<String, dynamic> data, {
  double? paymentAmount,
  String? paymentMethod,
  String? advanceClientId,
});

class OfflineQueueService {
  static final OfflineQueueService _instance = OfflineQueueService._internal();
  factory OfflineQueueService() => _instance;
  OfflineQueueService._internal();

  static InvoiceSyncCallback? defaultSyncHandler;

  Database? _db;
  bool _isSyncing = false;
  bool get isSyncing => _isSyncing;
  StreamSubscription? _netSub;

  final StreamController<int> _pendingCountController = StreamController<int>.broadcast();
  Stream<int> get onPendingCountChanged => _pendingCountController.stream;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDb();
    _startNetworkListener();
    _notifyCount();
    return _db!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, 'gestion_pro_offline.db');

    return await openDatabase(
      path,
      version: 2,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS pending_invoices (
            local_id TEXT PRIMARY KEY,
            organization_id TEXT,
            payload TEXT,
            payment_amount REAL,
            payment_method TEXT,
            advance_client_id TEXT,
            created_at TEXT,
            retry_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            error_message TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE IF NOT EXISTS cached_articles (
            id TEXT PRIMARY KEY,
            reference TEXT,
            designation TEXT,
            code_barre TEXT,
            payload TEXT,
            updated_at TEXT
          )
        ''');
        await db.execute('''
          CREATE TABLE IF NOT EXISTS cached_clients (
            id TEXT PRIMARY KEY,
            nom TEXT,
            telephone TEXT,
            payload TEXT,
            updated_at TEXT
          )
        ''');
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await db.execute('''
            CREATE TABLE IF NOT EXISTS cached_articles (
              id TEXT PRIMARY KEY,
              reference TEXT,
              designation TEXT,
              code_barre TEXT,
              payload TEXT,
              updated_at TEXT
            )
          ''');
          await db.execute('''
            CREATE TABLE IF NOT EXISTS cached_clients (
              id TEXT PRIMARY KEY,
              nom TEXT,
              telephone TEXT,
              payload TEXT,
              updated_at TEXT
            )
          ''');
        }
      },
    );
  }

  void _startNetworkListener() {
    _netSub?.cancel();
    _netSub = NetworkManager().onStatusChange.listen((status) {
      if (status == NetworkStatus.ONLINE) {
        debugPrint('[OFFLINE_QUEUE] Network is ONLINE. Checking for pending syncs...');
        syncPendingInvoices();
      }
    });
  }

  /// Enqueue an invoice to be created offline
  Future<String> enqueueInvoice({
    required Map<String, dynamic> data,
    required String organizationId,
    double? paymentAmount,
    String? paymentMethod,
    String? advanceClientId,
  }) async {
    final db = await database;
    final localId = 'OFF-${const Uuid().v4()}';

    // Tag the bl_number with offline prefix if not already present
    final payload = Map<String, dynamic>.from(data);
    if (payload['bl_number'] == null || (payload['bl_number'] as String).isEmpty) {
      payload['bl_number'] = localId;
    }

    final invoice = PendingInvoice(
      localId: localId,
      organizationId: organizationId,
      payload: payload,
      paymentAmount: paymentAmount,
      paymentMethod: paymentMethod,
      advanceClientId: advanceClientId,
      createdAt: DateTime.now(),
    );

    await db.insert('pending_invoices', invoice.toMap(), conflictAlgorithm: ConflictAlgorithm.replace);
    debugPrint('[OFFLINE_QUEUE] Invoice enqueued locally with ID: $localId');
    _notifyCount();
    return localId;
  }

  /// Fetch all pending invoices
  Future<List<PendingInvoice>> getPendingInvoices() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'pending_invoices',
      where: 'status IN (?, ?)',
      whereArgs: ['pending', 'failed'],
      orderBy: 'created_at ASC',
    );
    return maps.map((m) => PendingInvoice.fromMap(m)).toList();
  }

  /// Count pending invoices
  Future<int> getPendingCount() async {
    final db = await database;
    final count = Sqflite.firstIntValue(
      await db.rawQuery("SELECT COUNT(*) FROM pending_invoices WHERE status IN ('pending', 'failed')"),
    );
    return count ?? 0;
  }

  Future<void> _notifyCount() async {
    final count = await getPendingCount();
    _pendingCountController.add(count);
  }

  /// Process the queue and sync with the backend
  Future<Map<String, dynamic>> syncPendingInvoices({InvoiceSyncCallback? customSyncHandler}) async {
    if (_isSyncing) {
      debugPrint('[OFFLINE_QUEUE] Sync already in progress, skipping...');
      return {'success': false, 'message': 'Sync already in progress'};
    }

    final netStatus = await NetworkManager().checkNetworkStatus();
    if (netStatus == NetworkStatus.OFFLINE) {
      return {'success': false, 'message': 'Device is currently offline'};
    }

    final handler = customSyncHandler ?? defaultSyncHandler;
    if (handler == null) {
      debugPrint('[OFFLINE_QUEUE] No sync handler registered, skipping sync');
      return {'success': false, 'message': 'No sync handler available'};
    }

    _isSyncing = true;
    int syncedCount = 0;
    int failedCount = 0;

    try {
      final db = await database;
      final pendingList = await getPendingInvoices();
      debugPrint('[OFFLINE_QUEUE] Syncing ${pendingList.length} pending invoices...');

      for (final invoice in pendingList) {
        await db.update(
          'pending_invoices',
          {'status': 'syncing'},
          where: 'local_id = ?',
          whereArgs: [invoice.localId],
        );

        try {
          await handler(
            invoice.payload,
            paymentAmount: invoice.paymentAmount,
            paymentMethod: invoice.paymentMethod,
            advanceClientId: invoice.advanceClientId,
          );

          // Mark as synced and delete from pending queue
          await db.delete('pending_invoices', where: 'local_id = ?', whereArgs: [invoice.localId]);
          syncedCount++;
          debugPrint('[OFFLINE_QUEUE] Successfully synced invoice: ${invoice.localId}');
        } catch (e) {
          failedCount++;
          debugPrint('[OFFLINE_QUEUE] Failed syncing invoice ${invoice.localId}: $e');
          await db.update(
            'pending_invoices',
            {
              'status': 'failed',
              'retry_count': invoice.retryCount + 1,
              'error_message': e.toString(),
            },
            where: 'local_id = ?',
            whereArgs: [invoice.localId],
          );
        }
      }
    } finally {
      _isSyncing = false;
      await _notifyCount();
    }

    return {
      'success': true,
      'synced': syncedCount,
      'failed': failedCount,
    };
  }

  /// Delete a specific pending invoice
  Future<void> deleteInvoice(String localId) async {
    final db = await database;
    await db.delete('pending_invoices', where: 'local_id = ?', whereArgs: [localId]);
    await _notifyCount();
  }

  /// Clear all synced or failed records manually if needed
  Future<void> clearQueue() async {
    final db = await database;
    await db.delete('pending_invoices');
    await _notifyCount();
  }

  /// Cache articles into SQLite
  Future<void> cacheArticles(List<dynamic> items) async {
    if (items.isEmpty) return;
    try {
      final db = await database;
      final batch = db.batch();
      final now = DateTime.now().toIso8601String();
      for (final item in items) {
        if (item is Map) {
          final id = item['id']?.toString() ?? '';
          if (id.isEmpty) continue;
          final ref = item['reference']?.toString() ?? '';
          final desig = item['designation']?.toString() ?? '';
          final barcode = item['code_barre']?.toString() ?? item['codeBarre']?.toString() ?? '';
          batch.insert(
            'cached_articles',
            {
              'id': id,
              'reference': ref,
              'designation': desig,
              'code_barre': barcode,
              'payload': jsonEncode(item),
              'updated_at': now,
            },
            conflictAlgorithm: ConflictAlgorithm.replace,
          );
        }
      }
      await batch.commit(noResult: true);
      debugPrint('[LOCAL_CACHE] Cached ${items.length} articles locally');
    } catch (e) {
      debugPrint('[LOCAL_CACHE] Error caching articles: $e');
    }
  }

  /// Get cached articles from SQLite
  Future<List<dynamic>> getCachedArticles({String? search}) async {
    try {
      final db = await database;
      String? whereClause;
      List<dynamic>? whereArgs;
      if (search != null && search.trim().isNotEmpty) {
        final query = '%${search.trim()}%';
        whereClause = 'designation LIKE ? OR reference LIKE ? OR code_barre LIKE ?';
        whereArgs = [query, query, query];
      }
      final rows = await db.query(
        'cached_articles',
        where: whereClause,
        whereArgs: whereArgs,
        orderBy: 'designation ASC',
      );
      return rows.map((r) => jsonDecode(r['payload'] as String)).toList();
    } catch (e) {
      debugPrint('[LOCAL_CACHE] Error retrieving cached articles: $e');
      return [];
    }
  }

  /// Cache clients into SQLite
  Future<void> cacheClients(List<dynamic> items) async {
    if (items.isEmpty) return;
    try {
      final db = await database;
      final batch = db.batch();
      final now = DateTime.now().toIso8601String();
      for (final item in items) {
        if (item is Map) {
          final id = item['id']?.toString() ?? '';
          if (id.isEmpty) continue;
          final nom = item['nom']?.toString() ?? '';
          final tel = item['telephone']?.toString() ?? '';
          batch.insert(
            'cached_clients',
            {
              'id': id,
              'nom': nom,
              'telephone': tel,
              'payload': jsonEncode(item),
              'updated_at': now,
            },
            conflictAlgorithm: ConflictAlgorithm.replace,
          );
        }
      }
      await batch.commit(noResult: true);
      debugPrint('[LOCAL_CACHE] Cached ${items.length} clients locally');
    } catch (e) {
      debugPrint('[LOCAL_CACHE] Error caching clients: $e');
    }
  }

  /// Get cached clients from SQLite
  Future<List<dynamic>> getCachedClients({String? search}) async {
    try {
      final db = await database;
      String? whereClause;
      List<dynamic>? whereArgs;
      if (search != null && search.trim().isNotEmpty) {
        final query = '%${search.trim()}%';
        whereClause = 'nom LIKE ? OR telephone LIKE ?';
        whereArgs = [query, query];
      }
      final rows = await db.query(
        'cached_clients',
        where: whereClause,
        whereArgs: whereArgs,
        orderBy: 'nom ASC',
      );
      return rows.map((r) => jsonDecode(r['payload'] as String)).toList();
    } catch (e) {
      debugPrint('[LOCAL_CACHE] Error retrieving cached clients: $e');
      return [];
    }
  }
}
