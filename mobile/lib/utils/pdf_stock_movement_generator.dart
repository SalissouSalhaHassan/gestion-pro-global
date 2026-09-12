import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';
import '../models/article_model.dart';

class PdfStockMovementGenerator {
  static Future<Uint8List> generateReceipt({
    required CompanyInfo company,
    required Article article,
    required double oldStock,
    required double adjustedQty,
    required double newStock,
    required String depotName,
    required String date,
    required String generatedBy,
    double? globalNewStock, // Optional: for "Total of all warehouses"
    PdfPageFormat pageFormat = PdfPageFormat.roll80,
  }) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat("#,##0.00", "fr_FR");

    bool isThermal = pageFormat.width < 300;

    pdf.addPage(
      pw.Page(
        pageFormat: pageFormat,
        margin: isThermal
            ? const pw.EdgeInsets.all(5)
            : const pw.EdgeInsets.all(20),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: isThermal
                ? pw.CrossAxisAlignment.center
                : pw.CrossAxisAlignment.start,
            children: [
              // 1. En-tête
              _buildHeader(company, isThermal, depotName, date: date),
              pw.SizedBox(height: 10),
              _buildDashedLine(isThermal),
              pw.SizedBox(height: 10),

              // 2. Titre (Thermal only)
              if (isThermal) ...[
                pw.Text(
                  "MOUVEMENT DE STOCK",
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                pw.Text("Date: $date", style: const pw.TextStyle(fontSize: 10)),
                pw.SizedBox(height: 10),
              ],

              // 3. Info Article
              pw.Container(
                width: double.infinity,
                padding: const pw.EdgeInsets.all(10),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(),
                  borderRadius: pw.BorderRadius.circular(5),
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(
                      "Article: ${article.designation}",
                      style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    pw.Text(
                      "Code: ${article.reference}",
                      style: const pw.TextStyle(fontSize: 10),
                    ),
                    pw.Text(
                      "Dépôt: $depotName",
                      style: const pw.TextStyle(fontSize: 10),
                    ),
                  ],
                ),
              ),

              pw.SizedBox(height: 15),

              // 4. Détails Mouvement
              _buildDetailRow(
                "Stock Ancien",
                numberFormat.format(oldStock),
                isThermal,
              ),
              pw.SizedBox(height: 5),
              _buildDetailRow(
                "Ajustement",
                "${adjustedQty > 0 ? '+' : ''}${numberFormat.format(adjustedQty)}",
                isThermal,
                isBold: true,
                valueColor: adjustedQty > 0
                    ? PdfColors.green900
                    : PdfColors.red900,
              ),
              pw.SizedBox(height: 5),
              pw.Divider(),
              pw.SizedBox(height: 5),
              _buildDetailRow(
                "Nouveau Stock",
                numberFormat.format(newStock),
                isThermal,
                isBold: true,
                fontSize: 16,
              ),

              if (globalNewStock != null) ...[
                pw.SizedBox(height: 5),
                pw.Divider(thickness: 0.5),
                _buildDetailRow(
                  "Stock Global (Total)",
                  numberFormat.format(globalNewStock),
                  isThermal,
                  isBold: true,
                  fontSize: 12,
                  valueColor: PdfColors.blue900,
                ),
              ],

              pw.SizedBox(height: 20),
              _buildDashedLine(isThermal),
              pw.SizedBox(height: 10),

              pw.Text(
                "Opérateur: $generatedBy",
                style: const pw.TextStyle(fontSize: 10),
              ),
              pw.SizedBox(height: 5),
              pw.BarcodeWidget(
                barcode: pw.Barcode.code128(),
                data: article.reference,
                width: 100,
                height: 40,
                drawText: false,
              ),
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  static Future<Uint8List> generateTransferReceipt({
    required CompanyInfo company,
    required Article article,
    required double quantity,
    required String sourceDepot,
    required String destinationDepot,
    required String date,
    required String generatedBy,
    double? sourceNewStock,
    double? destinationNewStock,
    PdfPageFormat pageFormat = PdfPageFormat.roll80,
  }) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat("#,##0.00", "fr_FR");
    final qtyStr = numberFormat.format(quantity);
    bool isThermal = pageFormat.width < 300;

    pdf.addPage(
      pw.Page(
        pageFormat: pageFormat,
        margin: isThermal
            ? const pw.EdgeInsets.all(5)
            : const pw.EdgeInsets.all(20),
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: isThermal
                ? pw.CrossAxisAlignment.center
                : pw.CrossAxisAlignment.start,
            children: [
              _buildHeader(company, isThermal, sourceDepot, title: "TRANSFERT DE STOCK", date: date),
              pw.SizedBox(height: 10),
              _buildDashedLine(isThermal),
              pw.SizedBox(height: 10),
              if (isThermal) ...[
                pw.Text(
                  "TRANSFERT DE STOCK",
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                pw.Text("Date: $date", style: const pw.TextStyle(fontSize: 10)),
                pw.SizedBox(height: 10),
              ],
              pw.Container(
                width: double.infinity,
                padding: const pw.EdgeInsets.all(10),
                decoration: pw.BoxDecoration(
                  border: pw.Border.all(),
                  borderRadius: pw.BorderRadius.circular(5),
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(
                      "Article: ${article.designation}",
                      style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    pw.Text(
                      "Code: ${article.reference}",
                      style: const pw.TextStyle(fontSize: 10),
                    ),
                    pw.Text(
                      "Source: $sourceDepot",
                      style: const pw.TextStyle(fontSize: 10),
                    ),
                    pw.Text(
                      "Destination: $destinationDepot",
                      style: const pw.TextStyle(fontSize: 10),
                    ),
                  ],
                ),
              ),
              pw.SizedBox(height: 15),
              _buildDetailRow(
                "Quantité transférée",
                qtyStr,
                isThermal,
                isBold: true,
              ),
              if (sourceNewStock != null) ...[
                pw.SizedBox(height: 5),
                _buildDetailRow(
                  "Stock source après",
                  numberFormat.format(sourceNewStock),
                  isThermal,
                ),
              ],
              if (destinationNewStock != null) ...[
                pw.SizedBox(height: 5),
                _buildDetailRow(
                  "Stock destination après",
                  numberFormat.format(destinationNewStock),
                  isThermal,
                ),
              ],
              pw.SizedBox(height: 20),
              _buildDashedLine(isThermal),
              pw.SizedBox(height: 10),
              pw.Text(
                "Opérateur: $generatedBy",
                style: const pw.TextStyle(fontSize: 10),
              ),
              pw.SizedBox(height: 5),
              pw.BarcodeWidget(
                barcode: pw.Barcode.code128(),
                data: article.reference,
                width: 100,
                height: 40,
                drawText: false,
              ),
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  static pw.Widget _buildHeader(CompanyInfo company, bool isThermal, String? location, {String title = "MOUVEMENT DE STOCK", String? date}) {
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
              pw.Text(title, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
              if (date != null) pw.Text("Date: $date", style: const pw.TextStyle(fontSize: 10)),
              if (location != null) pw.Text("Dépôt: $location", style: const pw.TextStyle(fontSize: 10)),
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

  static pw.Widget _buildDetailRow(
    String label,
    String value,
    bool isThermal, {
    bool isBold = false,
    double fontSize = 12,
    PdfColor? valueColor,
  }) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(label, style: const pw.TextStyle(fontSize: 10)),
        pw.Text(
          value,
          style: pw.TextStyle(
            fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal,
            fontSize: fontSize,
            color: valueColor,
          ),
        ),
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
