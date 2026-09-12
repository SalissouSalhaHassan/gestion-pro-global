class ActivityLog {
  final String id;
  final DateTime timestamp;
  final String username;
  final String actionType;
  final String entityType;
  final String? entityId;
  final String? details;

  ActivityLog({
    required this.id,
    required this.timestamp,
    required this.username,
    required this.actionType,
    required this.entityType,
    this.entityId,
    this.details,
  });

  factory ActivityLog.fromJson(Map<String, dynamic> json) {
    final rawDate = json['timestamp'] ?? json['created_at'] ?? DateTime.now().toIso8601String();
    return ActivityLog(
      id: json['id'].toString(),
      timestamp: DateTime.parse(rawDate),
      username: json['username'] ?? 'Système',
      actionType: json['action_type'] ?? '',
      entityType: json['entity_type'] ?? '',
      entityId: json['entity_id'],
      details: json['details'],
    );
  }
}
