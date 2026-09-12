import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/purchase_invoice_model.dart';

class PurchaseDetailsScreen extends StatelessWidget {
  final PurchaseInvoice invoice;
  const PurchaseDetailsScreen({super.key, required this.invoice});

  @override
  Widget build(BuildContext context) {
    final numberFormat = NumberFormat("#,##0.00", "fr_FR");
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Scaffold(
      appBar: AppBar(
        title: Text('Détails Achat N° ${invoice.invoiceNumber ?? "-"}'),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF4A00E0), Color(0xFF8E2DE2)],
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildInfoCard(context, invoice),
            const SizedBox(height: 20),
            const Text(
              'Articles',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(height: 10),
            ...invoice.items.map((item) => _buildItemTile(item, numberFormat)),
            const SizedBox(height: 20),
            _buildTotalSection(invoice, numberFormat),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard(BuildContext context, PurchaseInvoice inv) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            _buildInfoRow('Fournisseur', inv.supplierName ?? 'Inconnu'),
            const Divider(),
            _buildInfoRow('Date', DateFormat('dd/MM/yyyy').format(inv.date)),
            const Divider(),
            _buildInfoRow('Référence', inv.invoiceNumber ?? '-'),
            const Divider(),
            _buildInfoRow('Statut', inv.status, color: _getStatusColor(inv.status)),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }

  Widget _buildItemTile(PurchaseInvoiceItem item, NumberFormat fmt) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        title: Text(item.productName, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text(
          '${item.quantity} ${item.unite ?? ""} x ${fmt.format(item.purchasePrice)} DA',
        ),
        trailing: Text(
          '${fmt.format(item.total)} DA',
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue),
        ),
      ),
    );
  }

  Widget _buildTotalSection(PurchaseInvoice inv, NumberFormat fmt) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.grey.withOpacity(0.2), blurRadius: 10)],
      ),
      child: Column(
        children: [
          _buildTotalRow('Sous-Total HT', fmt.format(inv.sousTotal)),
          if (inv.remise > 0) ...[
            const Divider(),
            _buildTotalRow('Remise', '-${fmt.format(inv.remise)}', color: Colors.red),
          ],
          if (inv.taxe > 0) ...[
            const Divider(),
            _buildTotalRow('Taxe', fmt.format(inv.taxe)),
          ],
          if (inv.transport > 0) ...[
            const Divider(),
            _buildTotalRow('Transport', fmt.format(inv.transport)),
          ],
          const Divider(),
          _buildTotalRow('TOTAL À PAYER', fmt.format(inv.totalAmount), isBold: true),
          const Divider(),
          _buildTotalRow('Montant Versé', fmt.format(inv.paidAmount), color: Colors.green),
          const Divider(),
          _buildTotalRow(
            'Reste à Payer',
            fmt.format(inv.totalAmount - inv.paidAmount),
            color: Colors.red,
            isBold: true,
          ),
        ],
      ),
    );
  }

  Widget _buildTotalRow(String label, String value, {Color? color, bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontWeight: isBold ? FontWeight.bold : FontWeight.normal)),
        Text(
          value,
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: color,
            fontSize: isBold ? 18 : 14,
          ),
        ),
      ],
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'payée':
        return Colors.green;
      case 'non payée':
      case 'impayee':
        return Colors.red;
      case 'partiellement payée':
      case 'partiel':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }
}
