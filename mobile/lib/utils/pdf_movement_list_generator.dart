import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';

class PdfMovementListGenerator {
  static Future<Uint8List> generateReport({
    required CompanyInfo company,
    required List<Map<String, dynamic>> movements,
    required String generatedBy,
    required String date,
    required String depotFilter,
    PdfPageFormat pageFormat = PdfPageFormat.a4,
  }) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat("#,##0.00", "fr_FR");

    bool isThermal = pageFormat.width < 300;

    pdf.addPage(
      pw.MultiPage(
        pageFormat: pageFormat,
        orientation: pw.PageOrientation.landscape, // Landscape for more columns
        margin: isThermal ? const pw.EdgeInsets.all(5) : const pw.EdgeInsets.all(20),
        build: (pw.Context context) {
          return [
            // 1. En-tête
            _buildHeader(company, isThermal),
            pw.SizedBox(height: 10),
            _buildDashedLine(isThermal),
            pw.SizedBox(height: 10),

            // 2. Titre
            if (isThermal) ...[
              pw.Center(child: pw.Text("RAPPORT DES MOUVEMENTS DE STOCK", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14))),
              pw.Center(child: pw.Text("Date: $date", style: const pw.TextStyle(fontSize: 10))),
              if (depotFilter != "Tous") pw.Center(child: pw.Text("Dépôt: $depotFilter", style: const pw.TextStyle(fontSize: 10))),
            ] else ...[
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text("Date: $date", style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                  if (depotFilter != "Tous") pw.Text("Dépôt Filter: $depotFilter", style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                ]
              )
            ],
            
            pw.SizedBox(height: 15),

            // 3. Tableau
            _buildTable(movements, numberFormat, isThermal),

            pw.SizedBox(height: 20),
            _buildDashedLine(isThermal),
            pw.Text("Généré par: $generatedBy", style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
          ];
        },
      ),
    );

    return pdf.save();
  }

  static pw.Widget _buildTable(List<Map<String, dynamic>> movements, NumberFormat fmt, bool isThermal) {
    if (movements.isEmpty) return pw.Text("- Aucun mouvement -", style: const pw.TextStyle(fontSize: 10));

    return pw.Table(
      border: pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
      columnWidths: isThermal 
          ? {
              0: const pw.FlexColumnWidth(2), // Art
              1: const pw.FixedColumnWidth(30), // In
              2: const pw.FixedColumnWidth(30), // Out
            }
          : {
              0: const pw.FixedColumnWidth(60), // Code
              1: const pw.FlexColumnWidth(3),   // Désignation
              2: const pw.FixedColumnWidth(70), // Dépôt
              3: const pw.FixedColumnWidth(50), // Avant
              4: const pw.FixedColumnWidth(50), // Entrée
              5: const pw.FixedColumnWidth(50), // Sortie
              6: const pw.FixedColumnWidth(50), // Après
            },
      children: [
        // Header
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: PdfColors.grey200),
          children: isThermal
             ? [
                 _th("Article"), _th("In"), _th("Out")
               ]
             : [
                 _th("Code"), _th("Désignation"), _th("Dépôt"), _th("Avant"), _th("Entrée"), _th("Sortie"), _th("Après")
               ]
        ),
        // Rows
        ...movements.map((m) {
           final designation = m['designation'] ?? "";
           final code = m['code'] ?? "";
           final depot = m['depot'] ?? "";
           final avant = (m['stock_avant'] as num).toDouble();
           final entree = (m['entree'] as num).toDouble();
           final sortie = (m['sortie'] as num).toDouble();
           final apres = (m['stock_apres'] as num).toDouble();

           if (isThermal) {
               return pw.TableRow(
                   children: [
                       pw.Padding(padding: const pw.EdgeInsets.all(2), child: pw.Text(designation, maxLines: 2, style: const pw.TextStyle(fontSize: 8))),
                       pw.Padding(padding: const pw.EdgeInsets.all(2), child: pw.Text(fmt.format(entree), style: const pw.TextStyle(fontSize: 8, color: PdfColors.green900))),
                       pw.Padding(padding: const pw.EdgeInsets.all(2), child: pw.Text(fmt.format(sortie), style: const pw.TextStyle(fontSize: 8, color: PdfColors.red900))),
                   ]
               );
           } else {
               return pw.TableRow(
                   children: [
                       _td(code),
                       _td(designation),
                       _td(depot),
                       _td(fmt.format(avant)),
                       _td(fmt.format(entree), color: entree > 0 ? PdfColors.green900 : null, bold: entree > 0),
                       _td(fmt.format(sortie), color: sortie > 0 ? PdfColors.red900 : null, bold: sortie > 0),
                       _td(fmt.format(apres), bold: true),
                   ]
               );
           }
        }).toList()
      ]
    );
  }

  static pw.Widget _th(String text) {
      return pw.Padding(
          padding: const pw.EdgeInsets.all(4),
          child: pw.Text(text, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9), textAlign: pw.TextAlign.center)
      );
  }

  static pw.Widget _td(String text, {PdfColor? color, bool bold = false}) {
      return pw.Padding(
          padding: const pw.EdgeInsets.all(4),
          child: pw.Text(text, style: pw.TextStyle(fontSize: 9, color: color, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal), textAlign: pw.TextAlign.center)
      );
  }

  static pw.Widget _buildHeader(CompanyInfo company, bool isThermal) {
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
              pw.Text("LISTE DES MOUVEMENTS", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
            ],
          ),
        ],
      );
    }
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
        if (company.adresse.isNotEmpty) pw.Text(company.adresse, style: const pw.TextStyle(fontSize: 10)),
      ],
    );
  }

  static pw.Widget _buildDashedLine(bool isThermal) {
    return pw.Row(
      children: List.generate(isThermal ? 20 : 50, (index) => pw.Expanded(
        child: pw.Container(
          color: index % 2 == 0 ? PdfColors.grey : PdfColors.white,
          height: 1,
        ),
      )),
    );
  }
}
