import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';
import '../models/purchase_invoice_model.dart';

class PdfPurchaseGenerator {
  static Future<Uint8List> generatePdf(CompanyInfo company, PurchaseInvoice purchase) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat("#,##0.00", "fr_FR");
    final dateFormat = DateFormat('dd/MM/yyyy');

    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              // --- Company Header ---
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
                        pw.Text(company.adresse.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                        pw.Text(
                          'Tél: ${company.tel}${company.email.isNotEmpty ? " | Email: ${company.email}" : ""}',
                          style: const pw.TextStyle(fontSize: 9),
                        ),
                        pw.Text(
                          'NIF: ${company.nif}${company.rc.isNotEmpty ? " | RC: ${company.rc}" : ""}',
                          style: const pw.TextStyle(fontSize: 9),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 5),
              pw.Divider(thickness: 1),
              pw.SizedBox(height: 5),

              // --- Document Title ---
              pw.Container(
                width: double.infinity,
                padding: const pw.EdgeInsets.symmetric(vertical: 8),
                decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF0F0F0)),
                child: pw.Center(
                  child: pw.Text(
                    'BON D\'ACHAT',
                    style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16),
                  ),
                ),
              ),
              pw.SizedBox(height: 15),

              // --- Info Blocks (Details / Fournisseur) ---
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  // Left: Details
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Container(
                          width: double.infinity,
                          decoration: pw.BoxDecoration(border: const pw.Border(bottom: pw.BorderSide(width: 1))),
                          padding: const pw.EdgeInsets.only(bottom: 2),
                          child: pw.Text("Détails du Bon", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                        ),
                        pw.SizedBox(height: 8),
                        _buildInfoLine("Bon N°:", purchase.invoiceNumber ?? "-"),
                        _buildInfoLine("Date Achat:", dateFormat.format(purchase.date)),
                      ],
                    ),
                  ),
                  pw.SizedBox(width: 30),
                  // Right: Supplier
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Container(
                          width: double.infinity,
                          decoration: pw.BoxDecoration(border: const pw.Border(bottom: pw.BorderSide(width: 1))),
                          padding: const pw.EdgeInsets.only(bottom: 2),
                          child: pw.Text("Fournisseur", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                        ),
                        pw.SizedBox(height: 8),
                        pw.Text(purchase.supplierName ?? "Inconnu", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
                      ],
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 20),

              // --- Items Table ---
              pw.Table(
                border: pw.TableBorder.all(width: 0.5),
                columnWidths: {
                  0: const pw.FlexColumnWidth(5.0),
                  1: const pw.FlexColumnWidth(1.0),
                  2: const pw.FlexColumnWidth(1.0),
                  3: const pw.FlexColumnWidth(1.5),
                  4: const pw.FlexColumnWidth(1.5),
                },
                children: [
                  pw.TableRow(
                    decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFDCDCDC)),
                    children: [
                      _tableHeaderCell('Désignation'),
                      _tableHeaderCell('Unité'),
                      _tableHeaderCell('Qté'),
                      _tableHeaderCell('P.U. HT'),
                      _tableHeaderCell('Montant HT'),
                    ],
                  ),
                  // --- Items Table Data ---
                  if (purchase.items.isEmpty)
                    pw.TableRow(
                      children: [
                        pw.Container(
                          padding: const pw.EdgeInsets.all(10),
                          alignment: pw.Alignment.center,
                          child: pw.Text("Aucun article trouvé pour ce bon", style: pw.TextStyle(fontStyle: pw.FontStyle.italic, fontSize: 9)),
                        ),
                        pw.SizedBox(),
                        pw.SizedBox(),
                        pw.SizedBox(),
                        pw.SizedBox(),
                      ],
                    ),
                  ...purchase.items.map((item) => pw.TableRow(
                        children: [
                          _tableDataCell(item.productName, align: pw.TextAlign.left),
                          _tableDataCell(item.unite ?? "", align: pw.TextAlign.center),
                          _tableDataCell(numberFormat.format(item.quantity), align: pw.TextAlign.right),
                          _tableDataCell(numberFormat.format(item.purchasePrice), align: pw.TextAlign.right),
                          _tableDataCell(numberFormat.format(item.total), align: pw.TextAlign.right),
                        ],
                      )),
                ],
              ),
              pw.SizedBox(height: 10),

              // --- Totals Bar ---
              pw.Row(
                children: [
                  pw.Expanded(flex: 3, child: _totalBox("Sous-Total HT", numberFormat.format(purchase.sousTotal))),
                  pw.Expanded(flex: 1, child: _totalBox("Remise", numberFormat.format(purchase.remise))),
                  pw.Expanded(flex: 1, child: _totalBox("Taxe", numberFormat.format(purchase.taxe))),
                  pw.Expanded(flex: 1, child: _totalBox("Transport", numberFormat.format(purchase.transport))),
                  pw.Expanded(flex: 1, child: _totalBox("Payé", numberFormat.format(purchase.paidAmount))),
                  pw.Expanded(flex: 1, child: _totalBox("Reste", numberFormat.format(purchase.totalAmount - purchase.paidAmount))),
                  pw.Expanded(
                    flex: 3,
                    child: pw.Column(
                      children: [
                        pw.Container(
                          width: double.infinity,
                          padding: const pw.EdgeInsets.all(4),
                          decoration: pw.BoxDecoration(
                            color: const PdfColor.fromInt(0xFF3498DB),
                            border: pw.Border.all(width: 0.5),
                          ),
                          child: pw.Center(
                            child: pw.Text("TOTAL À PAYER", style: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 8)),
                          ),
                        ),
                        pw.Container(
                          width: double.infinity,
                          padding: const pw.EdgeInsets.all(4),
                          decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5)),
                          child: pw.Center(
                            child: pw.Text(numberFormat.format(purchase.totalAmount), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 10),
              _drawPaymentsHistory(purchase, numberFormat),
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  static pw.Widget _drawPaymentsHistory(PurchaseInvoice purchase, NumberFormat numberFormat) {
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.SizedBox(height: 15),
        pw.Text("Historique des Règlements", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
        pw.SizedBox(height: 8),
        if (purchase.payments.isEmpty)
           pw.Padding(
             padding: const pw.EdgeInsets.only(left: 10, top: 5),
             child: pw.Text("Aucun règlement enregistré", style: pw.TextStyle(fontStyle: pw.FontStyle.italic, fontSize: 9)),
           )
        else
        pw.Table(
          border: pw.TableBorder.all(width: 0.5),
          columnWidths: {
            0: const pw.FlexColumnWidth(1.5),
            1: const pw.FlexColumnWidth(2.0),
            2: const pw.FlexColumnWidth(4.0),
            3: const pw.FlexColumnWidth(2.5),
          },
          children: [
            pw.TableRow(
              decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFDCDCDC)),
              children: [
                _tableHeaderCell('Date'),
                _tableHeaderCell('Moyen'),
                _tableHeaderCell('Référence'),
                _tableHeaderCell('Versement'),
              ],
            ),
            ...purchase.payments.map((p) => pw.TableRow(
                  children: [
                    _tableDataCell(p.date, align: pw.TextAlign.center),
                    _tableDataCell(p.method, align: pw.TextAlign.left),
                    _tableDataCell(p.reference, align: pw.TextAlign.left),
                    _tableDataCell(numberFormat.format(p.amount), align: pw.TextAlign.right),
                  ],
                )),
          ],
        ),
      ],
    );
  }

  static pw.Widget _buildInfoLine(String label, String value) {
    return pw.Row(
      children: [
        pw.SizedBox(width: 80, child: pw.Text(label, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10))),
        pw.Expanded(child: pw.Text(value, style: const pw.TextStyle(fontSize: 10))),
      ],
    );
  }

  static pw.Widget _tableHeaderCell(String text) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(5),
      child: pw.Text(text, textAlign: pw.TextAlign.center, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
    );
  }

  static pw.Widget _tableDataCell(String text, {pw.TextAlign align = pw.TextAlign.left}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(5),
      child: pw.Text(text, textAlign: align, style: const pw.TextStyle(fontSize: 8.5)),
    );
  }

  static pw.Widget _totalBox(String label, String value) {
    return pw.Column(
      children: [
        pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.all(4),
          decoration: pw.BoxDecoration(
            color: const PdfColor.fromInt(0xFFE6E6E6),
            border: pw.Border.all(width: 0.5),
          ),
          child: pw.Center(
            child: pw.Text(label, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7)),
          ),
        ),
        pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.all(4),
          decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5)),
          child: pw.Center(
            child: pw.Text(value, style: const pw.TextStyle(fontSize: 8)),
          ),
        ),
      ],
    );
  }
}
