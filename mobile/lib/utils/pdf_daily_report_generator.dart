import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';

class PdfDailyReportGenerator {
  static Future<Uint8List> generateReport({
    required CompanyInfo company,
    required DateTime date,
    required DateTime startDate,
    required DateTime endDate,
    required double solde,
    required double totalRecettes,
    required double totalDepenses,
    required List<Map<String, dynamic>> recettes,
    required List<Map<String, dynamic>> depenses,
    required String generatedBy,
    String cashier = "Tous",
    required PdfPageFormat pageFormat,
  }) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat("#,##0.00", "fr_FR");
    final dateFormat = DateFormat('dd/MM/yyyy');
    final dateStr = dateFormat.format(date);
    final startDateStr = dateFormat.format(startDate);
    final endDateStr = dateFormat.format(endDate);

    pdf.addPage(
      pw.MultiPage(
        pageFormat: pageFormat,
        margin: const pw.EdgeInsets.all(30),
        build: (pw.Context context) {
          return [
            // --- HEADER ---
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(company.nom.toUpperCase(), 
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
                    pw.SizedBox(height: 2),
                    pw.Text(company.adresse.toUpperCase(), style: const pw.TextStyle(fontSize: 10)),
                    if (company.tel.isNotEmpty)
                      pw.Text("Tél: ${company.tel}", style: const pw.TextStyle(fontSize: 9)),
                    if (company.email.isNotEmpty)
                      pw.Text("Email: ${company.email}", style: const pw.TextStyle(fontSize: 9)),
                    pw.Text("NIF: ${company.nif} | RC: ${company.rc}", style: const pw.TextStyle(fontSize: 9)),
                  ],
                ),
              ],
            ),
            pw.Divider(thickness: 1),
            pw.SizedBox(height: 10),

            // --- TITLE ---
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.symmetric(vertical: 8),
              decoration: const pw.BoxDecoration(color: PdfColors.grey200),
              child: pw.Center(
                child: pw.Text("BILAN DE CAISSE", 
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16)),
              ),
            ),
            pw.SizedBox(height: 15),

            // --- CRITERIA ---
            pw.Text("Critères du Rapport", 
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11, decoration: pw.TextDecoration.underline)),
            pw.SizedBox(height: 5),
            pw.Row(
              children: [
                pw.Expanded(child: _buildCriteriaRow("Période :", "$startDateStr → $endDateStr")),
              ],
            ),
            pw.Row(
              children: [
                pw.Expanded(child: _buildCriteriaRow("Caissier :", cashier.isNotEmpty ? cashier : "Tous")),
                pw.Expanded(child: _buildCriteriaRow("Type de Bilan :", "Total / Complet")),
              ],
            ),
            pw.SizedBox(height: 20),

            // --- RECEIPTS TABLE ---
            pw.Text("Détail des Recettes & Mouvements (Factures, Dépôts, Loyers)", 
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
            pw.SizedBox(height: 5),
            pw.Table(
              border: pw.TableBorder.all(width: 0.5),
              columnWidths: {
                0: const pw.FixedColumnWidth(60), // Date
                1: const pw.FlexColumnWidth(2),   // Type
                2: const pw.FlexColumnWidth(1.5), // Ref
                3: const pw.FlexColumnWidth(2.5), // Client
                4: const pw.FixedColumnWidth(60), // Total Doc
                5: const pw.FixedColumnWidth(60), // Montant
                6: const pw.FixedColumnWidth(50), // Reste
                7: const pw.FixedColumnWidth(50), // Caissier
              },
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                  children: [
                    _buildCell("Date", isBold: true),
                    _buildCell("Type", isBold: true),
                    _buildCell("Réf. Doc", isBold: true),
                    _buildCell("Client / Tiers", isBold: true),
                    _buildCell("Total Doc", isBold: true, align: pw.TextAlign.right),
                    _buildCell("Montant", isBold: true, align: pw.TextAlign.right),
                    _buildCell("Reste", isBold: true, align: pw.TextAlign.right),
                    _buildCell("Caissier", isBold: true),
                  ],
                ),
                ...recettes.map((r) {
                  final info = r['info'] ?? '';
                  final refRaw = (r['ref'] ?? '').toString();
                  final ref = refRaw.isNotEmpty
                      ? refRaw
                      : (info.toString().contains('|') ? info.toString().split('|')[0].trim() : info.toString());
                  final amount = (r['montant'] as num?)?.toDouble() ?? 0;
                  final totalDoc = (r['total_doc'] as num?)?.toDouble() ?? 0;
                  final reste = (r['reste'] as num?)?.toDouble() ?? 0;
                  final totalDocText = totalDoc > 0 ? numberFormat.format(totalDoc) : "-";
                  final resteText = reste > 0 ? numberFormat.format(reste) : "-";
                  
                  final itemDateStr = (r['date'] != null && r['date'].toString().isNotEmpty)
                      ? dateFormat.format(DateTime.parse(r['date'].toString()))
                      : dateStr;
                  return pw.TableRow(
                    children: [
                      _buildCell(itemDateStr, fontSize: 8),
                      _buildCell(r['type'] ?? '', fontSize: 8),
                      _buildCell(ref, fontSize: 8),
                      _buildCell(r['client'] ?? '', fontSize: 8),
                      _buildCell(totalDocText, fontSize: 8, align: pw.TextAlign.right),
                      _buildCell(numberFormat.format(amount), fontSize: 8, align: pw.TextAlign.right, isBold: amount != 0),
                      _buildCell(resteText, fontSize: 8, align: pw.TextAlign.right),
                      _buildCell(
                        (r['user'] ?? '').toString().isNotEmpty
                            ? (r['user'] ?? '').toString()
                            : generatedBy,
                        fontSize: 8,
                      ),
                    ],
                  );
                }).toList(),
              ],
            ),
            pw.SizedBox(height: 20),

            // --- EXPENSES TABLE ---
            pw.Text("Détail des Dépenses", 
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
            pw.SizedBox(height: 5),
            pw.Table(
              border: pw.TableBorder.all(width: 0.5),
              columnWidths: {
                0: const pw.FixedColumnWidth(60), // Date
                1: const pw.FixedColumnWidth(60), // N Caisse
                2: const pw.FlexColumnWidth(4),   // Libelle
                3: const pw.FlexColumnWidth(1.5), // Operateur
                4: const pw.FixedColumnWidth(80), // Montant
              },
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey300),
                  children: [
                    _buildCell("Date", isBold: true),
                    _buildCell("N° Caisse", isBold: true),
                    _buildCell("Libellé", isBold: true),
                    _buildCell("Opérateur", isBold: true),
                    _buildCell("Montant", isBold: true, align: pw.TextAlign.right),
                  ],
                ),
                ...depenses.map((e) {
                  double amount = (e['montant'] as num?)?.toDouble() ?? 0;
                  final itemDateStr = (e['date'] != null && e['date'].toString().isNotEmpty)
                      ? dateFormat.format(DateTime.parse(e['date'].toString()))
                      : dateStr;
                  return pw.TableRow(
                    children: [
                      _buildCell(itemDateStr, fontSize: 8),
                      _buildCell("1", fontSize: 8),
                      _buildCell(e['libelle'] ?? '', fontSize: 8),
                      _buildCell(e['operateur'] ?? '', fontSize: 8),
                      _buildCell(numberFormat.format(amount), fontSize: 8, align: pw.TextAlign.right),
                    ],
                  );
                }).toList(),
              ],
            ),
            pw.SizedBox(height: 15),

            // --- SUMMARY TOTALS ---
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.end,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    _buildSummaryRow("TOTAL ENCAISSÉ (CFA) :", numberFormat.format(totalRecettes)),
                    _buildSummaryRow("TOTAL DÉPENSES (CFA) :", numberFormat.format(totalDepenses)),
                    _buildSummaryRow("SOLDE DE CAISSE (CFA) :", numberFormat.format(solde), 
                        isSolde: true, bgColor: PdfColors.green100),
                  ],
                ),
              ],
            ),
            
            pw.SizedBox(height: 50),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.end,
              children: [
                pw.Column(
                  children: [
                    pw.Container(
                      width: 200,
                      decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 1))),
                    ),
                    pw.SizedBox(height: 5),
                    pw.Text("Cachet et Signature", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
                  ],
                ),
              ],
            ),
          ];
        },
      ),
    );

    return pdf.save();
  }

  static pw.Widget _buildCriteriaRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Row(
        children: [
          pw.Text(label, style: const pw.TextStyle(fontSize: 10)),
          pw.SizedBox(width: 10),
          pw.Text(value, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
        ],
      ),
    );
  }

  static pw.Widget _buildCell(String text, {bool isBold = false, pw.TextAlign align = pw.TextAlign.left, double fontSize = 9}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(5),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: fontSize,
          fontWeight: isBold ? pw.FontWeight.bold : null,
        ),
        textAlign: align,
      ),
    );
  }

  static pw.Widget _buildSummaryRow(String label, String value, {bool isSolde = false, PdfColor? bgColor}) {
    return pw.Row(
      mainAxisSize: pw.MainAxisSize.min,
      children: [
        pw.Container(
          width: 180,
          padding: const pw.EdgeInsets.only(right: 10, top: 5, bottom: 5),
          child: pw.Text(label, 
            textAlign: pw.TextAlign.right,
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12)),
        ),
        pw.Container(
          width: 120,
          padding: const pw.EdgeInsets.all(5),
          decoration: pw.BoxDecoration(
            border: pw.Border.all(width: 0.5),
            color: bgColor,
          ),
          child: pw.Text(value, 
            textAlign: pw.TextAlign.right,
            style: pw.TextStyle(
              fontWeight: pw.FontWeight.bold, 
              fontSize: 12,
              color: isSolde ? PdfColors.green800 : PdfColors.black,
            )),
        ),
      ],
    );
  }
}
