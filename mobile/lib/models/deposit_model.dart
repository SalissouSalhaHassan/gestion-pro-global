class DepositMovement {
  final String date;
  final String type;
  final String reference;
  final double amount;

  DepositMovement({
    required this.date,
    required this.type,
    required this.reference,
    required this.amount,
  });

  factory DepositMovement.fromJson(Map<String, dynamic> json) {
    // Si c'est un paiement réel de Supabase
    if (json.containsKey('date_operation')) {
      double rawAmount = (json['montant_regle'] as num?)?.toDouble() ?? 0.0;
      bool isUsage = json['facture_id'] != null;
      
      return DepositMovement(
        date: json['date_operation'] ?? "",
        type: isUsage ? "Utilisation Facture" : (rawAmount < 0 ? "Retrait" : "Paiement"),
        reference: json['reference_paiement'] ?? "-",
        amount: isUsage ? -rawAmount : rawAmount,
      );
    }
    
    // Fallback pour l'ancien format ou synthèse
    return DepositMovement(
      date: json['date'] ?? "",
      type: json['type'] ?? "",
      reference: json['reference'] ?? "-",
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class Deposit {
  final String id;
  final String clientId; // Added
  final String clientName;
  final String date;
  final double initialAmount;
  final double remainingAmount;
  final String paymentMethod;
  final String reference;
  final String status;
  final String vendeur; // Champ du vendeur
  final String emplacement; 
  final bool pending;
  final List<DepositMovement> movements; // Liste des mouvements

  Deposit({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.date,
    required this.initialAmount,
    required this.remainingAmount,
    required this.paymentMethod,
    required this.reference,
    required this.status,
    required this.vendeur,
    required this.emplacement,
    this.pending = false,
    this.movements = const [],
  });

  Deposit copyWith({
    String? id,
    String? clientId,
    String? clientName,
    String? date,
    double? initialAmount,
    double? remainingAmount,
    String? paymentMethod,
    String? reference,
    String? status,
    String? vendeur,
    String? emplacement,
    bool? pending,
    List<DepositMovement>? movements,
  }) {
    return Deposit(
      id: id ?? this.id,
      clientId: clientId ?? this.clientId,
      clientName: clientName ?? this.clientName,
      date: date ?? this.date,
      initialAmount: initialAmount ?? this.initialAmount,
      remainingAmount: remainingAmount ?? this.remainingAmount,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      reference: reference ?? this.reference,
      status: status ?? this.status,
      vendeur: vendeur ?? this.vendeur,
      emplacement: emplacement ?? this.emplacement,
      pending: pending ?? this.pending,
      movements: movements ?? this.movements,
    );
  }

  factory Deposit.fromJson(Map<String, dynamic> json) {
    return Deposit(
      id: json['id']?.toString() ?? "",
      clientId: (json['client_id'] ?? "0").toString(),
      clientName: () {
        final c = json['client_name'] ?? json['clients'];
        if (c == null) return "Inconnu";
        if (c is Map) return c['nom']?.toString() ?? "Inconnu";
        if (c is List && c.isNotEmpty) {
          final first = c[0];
          if (first is Map) return first['nom']?.toString() ?? "Inconnu";
        }
        return c.toString();
      }(),
      date: json['date_avance']?.toString() ?? DateTime.now().toIso8601String().split('T')[0],
      initialAmount: double.tryParse(json['montant_initial']?.toString() ?? '0') ?? 0.0,
      remainingAmount: double.tryParse(json['montant_restant']?.toString() ?? '0') ?? 0.0,
      paymentMethod: json['moyen_paiement'] ?? "Espèce",
      reference: json['reference_paiement'] ?? "-",
      status: json['statut'] ?? "Disponible",
      vendeur: json['utilisateur'] ?? "-",
      emplacement: json['emplacement'] ?? "",
      pending: json['pending'] ?? false,
      movements: const [], // Loaded on-demand in _printReceipt
    );
  }
}
