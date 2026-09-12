import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';
import '../models/article_model.dart';

class PdfStockReportGenerator {
  static Future<Uint8List> generateReport({
    required CompanyInfo company,
    required String depotName,
    required List<Article> articles,
    required String generatedBy,
    PdfPageFormat pageFormat = PdfPageFormat.a4,
  }) async {
    final pdf = pw.Document();
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');
    final dateStr = dateFormat.format(DateTime.now());

    bool isThermal = pageFormat.width < 300;

    pdf.addPage(
      pw.MultiPage(
        pageFormat: pageFormat,
        margin: isThermal
            ? const pw.EdgeInsets.all(5)
            : const pw.EdgeInsets.all(20),
        build: (pw.Context context) {
          return [
            // 1. En-tête
            _buildHeader(company, isThermal, depotName),
            pw.SizedBox(height: 10),
            _buildDashedLine(isThermal),
            pw.SizedBox(height: 10),

            if (isThermal) ...[
               pw.Center(
                child: pw.Text(
                  "ÉTAT DE STOCK",
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
              pw.Center(
                child: pw.Text(
                  "Dépôt: $depotName",
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
              pw.Center(
                child: pw.Text(
                  "Date: $dateStr",
                  style: const pw.TextStyle(fontSize: 10),
                ),
              ),
            ],
            pw.SizedBox(height: 15),

            // 3. Tableau
            _buildStockTable(articles, depotName, isThermal),

            pw.SizedBox(height: 20),
            _buildDashedLine(isThermal),
            pw.Text(
              "Généré par: $generatedBy",
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700),
            ),
            pw.Text(
              "Total Articles: ${articles.length}",
              style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold),
            ),
          ];
        },
      ),
    );

    return pdf.save();
  }

  static pw.Widget _buildHeader(CompanyInfo company, bool isThermal, String? location) {
    if (!isThermal) {
      return pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
              pw.SizedBox(height: 2),
              pw.Text(company.adresse.toUpperCase(), style: const pw.TextStyle(fontSize: 10)),
              if (company.tel.isNotEmpty)
                pw.Text("Tél: ${company.tel}", style: const pw.TextStyle(fontSize: 9)),
              if (company.email.isNotEmpty)
                pw.Text("Email: ${company.email}", style: const pw.TextStyle(fontSize: 9)),
              pw.Text("NIF: ${company.nif} | RC: ${company.rc}", style: const pw.TextStyle(fontSize: 9)),
            ],
          ),
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text("ÉTAT DE STOCK", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
              pw.Text("Dépôt: $location", style: const pw.TextStyle(fontSize: 10)),
              pw.Text("Date: ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}", style: const pw.TextStyle(fontSize: 10)),
            ],
          ),
        ],
      );
    }
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Text(
          company.nom.toUpperCase(),
          style: pw.TextStyle(
            fontWeight: pw.FontWeight.bold,
            fontSize: 18,
          ),
        ),
        pw.SizedBox(height: 4),
        pw.Text(
          "MARADI NIGER ${location?.toUpperCase() ?? ''}".trim(),
          style: pw.TextStyle(
            fontWeight: pw.FontWeight.bold,
            fontSize: 13,
          ),
        ),
        pw.SizedBox(height: 4),
        if (company.adresse.isNotEmpty && company.adresse.toUpperCase() != "MARADI NIGER") ...[
          pw.Text(company.adresse, style: const pw.TextStyle(fontSize: 10)),
          pw.SizedBox(height: 2),
        ],
        if (company.tel.isNotEmpty)
          pw.Text(
            "Tél: ${company.tel}",
            style: const pw.TextStyle(fontSize: 10),
          ),
      ],
    );
  }

  static pw.Widget _buildStockTable(
    List<Article> articles,
    String depotName,
    bool isThermal,
  ) {
    if (articles.isEmpty) {
      return pw.Text(
        "- Aucun article -",
        style: const pw.TextStyle(fontSize: 10),
      );
    }

    return pw.Table(
      border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
      columnWidths: isThermal
          ? {
              0: const pw.FlexColumnWidth(2), // Désignation
              1: const pw.FixedColumnWidth(40), // Qté
            }
          : {
              0: const pw.FixedColumnWidth(80), // Code
              1: const pw.FlexColumnWidth(3), // Désignation
              2: const pw.FixedColumnWidth(60), // Qté
            },
      children: [
        // Header Row
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: PdfColors.grey200),
          children: isThermal
              ? [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(2),
                    child: pw.Text(
                      "Désignation",
                      style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 8,
                      ),
                    ),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(2),
                    child: pw.Text(
                      "Qté",
                      textAlign: pw.TextAlign.center,
                      style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 8,
                      ),
                    ),
                  ),
                ]
              : [
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(4),
                    child: pw.Text(
                      "Code",
                      style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 10,
                      ),
                    ),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(4),
                    child: pw.Text(
                      "Désignation",
                      style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 10,
                      ),
                    ),
                  ),
                  pw.Padding(
                    padding: const pw.EdgeInsets.all(4),
                    child: pw.Text(
                      "Qté",
                      textAlign: pw.TextAlign.center,
                      style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 10,
                      ),
                    ),
                  ),
                ],
        ),
        // Data Rows
        ...articles.map((item) {
          final qty = item.depotStocks[depotName] ?? 0.0;
          return pw.TableRow(
            children: isThermal
                ? [
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(2),
                      child: pw.Text(
                        item.designation,
                        style: const pw.TextStyle(fontSize: 8),
                      ),
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(2),
                      child: pw.Text(
                        qty.toStringAsFixed(0),
                        textAlign: pw.TextAlign.center,
                        style: pw.TextStyle(
                          fontSize: 8,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                  ]
                : [
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(4),
                      child: pw.Text(
                        item.reference,
                        style: const pw.TextStyle(fontSize: 9),
                      ),
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(4),
                      child: pw.Text(
                        item.designation,
                        style: const pw.TextStyle(fontSize: 9),
                      ),
                    ),
                    pw.Padding(
                      padding: const pw.EdgeInsets.all(4),
                      child: pw.Text(
                        qty.toStringAsFixed(2),
                        textAlign: pw.TextAlign.center,
                        style: pw.TextStyle(
                          fontSize: 9,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
          );
        }).toList(),
      ],
    );
  }

  static pw.Widget _buildDashedLine(bool isThermal) {
    return pw.Row(
      children: List.generate(
        isThermal ? 20 : 50,
        (index) => pw.Expanded(
          child: pw.Container(
            color: index % 2 == 0 ? PdfColors.grey : PdfColors.white,
            height: 1,
          ),
        ),
      ),
    );
  }
}
