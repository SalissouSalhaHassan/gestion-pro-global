import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/offline_queue_service.dart';

/// A reactive AppBar button that shows pending offline sync count
class OfflineSyncBadgeButton extends StatefulWidget {
  final Color? iconColor;
  final bool showIfZero;

  const OfflineSyncBadgeButton({
    super.key,
    this.iconColor,
    this.showIfZero = false,
  });

  @override
  State<OfflineSyncBadgeButton> createState() => _OfflineSyncBadgeButtonState();
}

class _OfflineSyncBadgeButtonState extends State<OfflineSyncBadgeButton> {
  int _pendingCount = 0;
  dynamic _sub;

  @override
  void initState() {
    super.initState();
    _initCount();
    _sub = OfflineQueueService().onPendingCountChanged.listen((count) {
      if (mounted) setState(() => _pendingCount = count);
    });
  }

  Future<void> _initCount() async {
    final count = await OfflineQueueService().getPendingCount();
    if (mounted) setState(() => _pendingCount = count);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_pendingCount == 0 && !widget.showIfZero) {
      return const SizedBox.shrink();
    }

    return Stack(
      alignment: Alignment.center,
      children: [
        IconButton(
          icon: Icon(
            _pendingCount > 0 ? Icons.cloud_upload_rounded : Icons.cloud_done_rounded,
            color: _pendingCount > 0 ? Colors.amberAccent : (widget.iconColor ?? Colors.white70),
            size: 26,
          ),
          tooltip: _pendingCount > 0
              ? '$_pendingCount vente(s) en attente de synchronisation'
              : 'Synchronisé',
          onPressed: () => showOfflineSyncModal(context),
        ),
        if (_pendingCount > 0)
          Positioned(
            right: 6,
            top: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.redAccent,
                borderRadius: BorderRadius.circular(10),
                boxShadow: const [
                  BoxShadow(
                    color: Colors.black26,
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              child: Text(
                '$_pendingCount',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }
}

/// Helper function to display the offline sync bottom sheet
void showOfflineSyncModal(BuildContext context) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => const OfflineSyncModal(),
  );
}

class OfflineSyncModal extends StatefulWidget {
  const OfflineSyncModal({super.key});

  @override
  State<OfflineSyncModal> createState() => _OfflineSyncModalState();
}

class _OfflineSyncModalState extends State<OfflineSyncModal> {
  List<PendingInvoice> _pendingInvoices = [];
  bool _isLoading = true;
  bool _isSyncing = false;
  final _numberFormat = NumberFormat('#,##0', 'fr_FR');

  @override
  void initState() {
    super.initState();
    _loadPending();
  }

  Future<void> _loadPending() async {
    setState(() => _isLoading = true);
    final items = await OfflineQueueService().getPendingInvoices();
    if (mounted) {
      setState(() {
        _pendingInvoices = items;
        _isLoading = false;
      });
    }
  }

  Future<void> _syncNow() async {
    setState(() => _isSyncing = true);
    final res = await OfflineQueueService().syncPendingInvoices();
    if (mounted) {
      setState(() => _isSyncing = false);
      await _loadPending();

      final synced = res['synced'] ?? 0;
      final failed = res['failed'] ?? 0;
      final message = res['message'];

      if (synced > 0 && failed == 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ $synced facture(s) synchronisée(s) avec succès !'),
            backgroundColor: const Color(0xFF059669),
          ),
        );
        Navigator.pop(context);
      } else if (synced > 0 && failed > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('⚠️ $synced synchronisée(s), mais $failed en échec.'),
            backgroundColor: Colors.orange,
          ),
        );
      } else if (message != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('ℹ️ $message'),
            backgroundColor: Colors.blueGrey,
          ),
        );
      }
    }
  }

  Future<void> _confirmClearQueue() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Vider la file ?'),
        content: const Text(
          'Attention : Les ventes en attente qui n\'ont pas encore été synchronisées avec le serveur seront supprimées définitivement.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Supprimer', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await OfflineQueueService().clearQueue();
      await _loadPending();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('File d\'attente vidée.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF4A00E0).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.cloud_sync_rounded, color: Color(0xFF4A00E0), size: 28),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'File d\'attente Hors-Ligne',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${_pendingInvoices.length} vente(s) à synchroniser',
                        style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Content
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _pendingInvoices.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.cloud_done_rounded, size: 64, color: Colors.green.shade400),
                            const SizedBox(height: 16),
                            const Text(
                              'Toutes les ventes sont synchronisées !',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Aucune facture en attente dans la file locale.',
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _pendingInvoices.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, index) {
                          final item = _pendingInvoices[index];
                          final clientName = item.payload['client'] ?? 'Client Divers';
                          final totalAmount = (item.payload['total_ttc'] as num?)?.toDouble() ?? 0.0;
                          final dateStr = DateFormat('dd/MM/yyyy HH:mm').format(item.createdAt);
                          final isFailed = item.status == 'failed';
                          final isSyncingItem = item.status == 'syncing';

                          return Card(
                            elevation: 1.5,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                              side: BorderSide(
                                color: isFailed
                                    ? Colors.red.shade200
                                    : Colors.grey.shade200,
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: isFailed
                                              ? Colors.red.shade50
                                              : (isSyncingItem ? Colors.blue.shade50 : Colors.amber.shade50),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(
                                              isFailed
                                                  ? Icons.error_outline
                                                  : (isSyncingItem ? Icons.sync : Icons.schedule),
                                              size: 14,
                                              color: isFailed
                                                  ? Colors.red
                                                  : (isSyncingItem ? Colors.blue : Colors.amber.shade900),
                                            ),
                                            const SizedBox(width: 4),
                                            Text(
                                              isFailed
                                                  ? 'Échec (${item.retryCount})'
                                                  : (isSyncingItem ? 'En cours...' : 'En attente'),
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.bold,
                                                color: isFailed
                                                    ? Colors.red
                                                    : (isSyncingItem ? Colors.blue : Colors.amber.shade900),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Spacer(),
                                      Text(
                                        '${_numberFormat.format(totalAmount)} FCFA',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 15,
                                          color: Color(0xFF13002D),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    clientName,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      Icon(Icons.calendar_today_outlined, size: 12, color: Colors.grey.shade600),
                                      const SizedBox(width: 4),
                                      Text(dateStr, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                                      const SizedBox(width: 12),
                                      Icon(Icons.tag, size: 12, color: Colors.grey.shade600),
                                      const SizedBox(width: 2),
                                      Expanded(
                                        child: Text(
                                          item.localId,
                                          style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                                        padding: EdgeInsets.zero,
                                        constraints: const BoxConstraints(),
                                        tooltip: 'Supprimer',
                                        onPressed: () async {
                                          await OfflineQueueService().deleteInvoice(item.localId);
                                          _loadPending();
                                        },
                                      ),
                                    ],
                                  ),
                                  if (item.errorMessage != null && item.errorMessage!.isNotEmpty) ...[
                                    const SizedBox(height: 6),
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: Colors.red.shade50,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        item.errorMessage!,
                                        style: TextStyle(color: Colors.red.shade800, fontSize: 11),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),

          // Bottom actions
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -3),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  if (_pendingInvoices.isNotEmpty) ...[
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.redAccent,
                        side: const BorderSide(color: Colors.redAccent),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                      ),
                      onPressed: _isSyncing ? null : _confirmClearQueue,
                      child: const Icon(Icons.delete_sweep_rounded, size: 22),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF4A00E0),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        elevation: 2,
                      ),
                      icon: _isSyncing
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Icon(Icons.sync_rounded),
                      label: Text(
                        _isSyncing
                            ? 'Synchronisation en cours...'
                            : (_pendingInvoices.isEmpty ? 'Actualiser la file' : 'Synchroniser maintenant (${_pendingInvoices.length})'),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      onPressed: _isSyncing
                          ? null
                          : (_pendingInvoices.isEmpty ? _loadPending : _syncNow),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
