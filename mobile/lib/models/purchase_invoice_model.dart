import 'package:intl/intl.dart';

class PurchaseInvoiceItem {
  final String? productId;
  final String productName;
  final String? unite;
  final double quantity;
  final double purchasePrice; // Prix d'achat unitaire

  PurchaseInvoiceItem({
    this.productId,
    required this.productName,
    this.unite,
    required this.quantity,
    required this.purchasePrice,
  });

  double get total => quantity * purchasePrice;

  factory PurchaseInvoiceItem.fromJson(Map<String, dynamic> json) {
    return PurchaseInvoiceItem(
      productId: json['article_id']?.toString() ?? json['product_id']?.toString(),
      productName: json['designation'] ?? json['product_name'] ?? 'Produit',
      unite: json['unite']?.toString(),
      quantity: double.tryParse(json['quantite']?.toString() ?? json['quantity']?.toString() ?? '1') ?? 1.0,
      purchasePrice: double.tryParse(json['prix_unitaire_ht']?.toString() ?? json['purchase_price']?.toString() ?? '0') ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'article_id': productId,
      'designation': productName,
      'unite': unite,
      'quantite': quantity,
      'prix_unitaire_ht': purchasePrice,
      'montant_ligne': total,
    };
  }
}

class PurchasePayment {
  final String date;
  final String method;
  final String reference;
  final double amount;

  PurchasePayment({
    required this.date,
    required this.method,
    required this.reference,
    required this.amount,
  });

  factory PurchasePayment.fromJson(Map<String, dynamic> json) {
    return PurchasePayment(
      date: json['date_operation']?.toString() ?? '',
      method: json['moyen_reglement']?.toString() ?? 'N/A',
      reference: json['reference_paiement']?.toString() ?? '',
      amount: double.tryParse(json['montant_regle']?.toString() ?? '0') ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'date_operation': date,
      'moyen_reglement': method,
      'reference_paiement': reference,
      'montant_regle': amount,
    };
  }
}

class PurchaseInvoice {
  final String? id;
  final String? invoiceNumber;
  final String supplierId;
  final String? supplierName;
  final DateTime date;
  final double sousTotal;
  final double remise;
  final double taxe;
  final double transport;
  final double totalAmount;
  final double paidAmount;
  final String status; // 'Payée', 'Partiellement Payée', 'Non Payée'
  final List<PurchaseInvoiceItem> items;
  final List<PurchasePayment> payments;
  final String? notes;
  final String? depotNom;

  PurchaseInvoice({
    this.id,
    this.invoiceNumber,
    required this.supplierId,
    this.supplierName,
    required this.date,
    this.sousTotal = 0.0,
    this.remise = 0.0,
    this.taxe = 0.0,
    this.transport = 0.0,
    required this.totalAmount,
    this.paidAmount = 0.0,
    this.status = 'Non Payée',
    required this.items,
    this.payments = const [],
    this.notes,
    this.depotNom,
  });

  factory PurchaseInvoice.fromJson(Map<String, dynamic> json) {
    String? suppName = json['fournisseur_nom'] ?? json['supplier_name'];
    if (suppName == null || suppName.trim().isEmpty) {
      final fData = json['fournisseurs'];
      if (fData != null) {
        if (fData is Map) {
          suppName = fData['nom'];
        } else if (fData is List && fData.isNotEmpty) {
          suppName = fData[0]['nom'];
        }
      }
    }

    final itemsRaw = json['items'] ?? json['achat_items'];
    final paymentsRaw = json['payments'] ?? json['paiements'];

    String? invNum = json['numero_facture']?.toString() ?? json['invoice_number']?.toString();
    if (invNum != null && invNum.trim().isEmpty) invNum = null;

    return PurchaseInvoice(
      id: json['id']?.toString(),
      invoiceNumber: invNum,
      supplierId: json['fournisseur_id']?.toString() ?? json['supplier_id']?.toString() ?? "",
      supplierName: suppName,
      date: json['date_achat'] != null
          ? DateTime.tryParse(json['date_achat'].toString()) ?? DateTime.now()
          : (json['date'] != null ? DateTime.tryParse(json['date'].toString()) ?? DateTime.now() : DateTime.now()),
      sousTotal: double.tryParse(json['sous_total']?.toString() ?? '0') ?? 0.0,
      remise: double.tryParse(json['remise']?.toString() ?? '0') ?? 0.0,
      taxe: double.tryParse(json['taxe']?.toString() ?? '0') ?? 0.0,
      transport: double.tryParse(json['transport']?.toString() ?? '0') ?? 0.0,
      totalAmount: double.tryParse(json['montant_total']?.toString() ?? json['total_amount']?.toString() ?? '0') ?? 0.0,
      paidAmount: double.tryParse(json['montant_paye']?.toString() ?? json['paid_amount']?.toString() ?? '0') ?? 0.0,
      status: json['statut'] ?? json['status'] ?? 'Non Payée',
      depotNom: json['depot_nom']?.toString(),
      items: (itemsRaw as List<dynamic>?)
              ?.map((item) => PurchaseInvoiceItem.fromJson(item))
              .toList() ??
          [],
      payments: (paymentsRaw as List<dynamic>?)
              ?.map((p) => PurchasePayment.fromJson(p))
              .toList() ??
          [],
      notes: json['notes'],
    );
  }

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'id': id,
      'fournisseur_id': supplierId,
      'fournisseur_nom': supplierName,
      'depot_nom': depotNom,
      'date_achat': DateFormat('yyyy-MM-dd').format(date),
      'sous_total': sousTotal,
      'remise': remise,
      'taxe': taxe,
      'transport': transport,
      'montant_total': totalAmount,
      'montant_paye': paidAmount,
      'statut': status,
      'items': items.map((e) => e.toJson()).toList(),
      'payments': payments.map((e) => e.toJson()).toList(),
      'notes': notes,
    };
    if (invoiceNumber != null) {
      map['numero_facture'] = invoiceNumber;
    }
    return map;
  }
}
