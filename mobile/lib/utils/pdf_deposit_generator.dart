import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';
import '../models/deposit_model.dart';

class PdfDepositGenerator {
  static Future<Uint8List> generateReceipt({
    required CompanyInfo company,
    required String clientName,
    required double amount,         // Montant Initial
    required double remainingAmount, // Montant Restant
    required String reference,
    required String date,
    required String createdBy,
    String? location,
    List<DepositMovement> movements = const [],
    PdfPageFormat pageFormat = PdfPageFormat.a4,
  }) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat('#,##0.00', 'fr_FR');
    final dateFormat = DateFormat('dd/MM/yyyy');

    bool isThermal = pageFormat.width < 300;

    // Format date for display
    String formattedDate = date;
    try {
      final parsed = DateTime.parse(date);
      formattedDate = dateFormat.format(parsed);
    } catch (_) {}

    // Determine status label and color
    PdfColor statusColor;
    String statusLabel;
    if (remainingAmount <= 0) {
      statusLabel = 'Utilisée';
      statusColor = PdfColors.grey700;
    } else if (remainingAmount < amount) {
      statusLabel = 'Partiellement utilisée';
      statusColor = PdfColors.orange800;
    } else {
      statusLabel = 'Disponible';
      statusColor = PdfColors.green800;
    }

    // Amount in words (simplified)
    String amountInWords = _numberToWords(amount);

    if (isThermal) {
      // ===== THERMAL LAYOUT (unchanged) =====
      pdf.addPage(pw.Page(
        pageFormat: pageFormat,
        margin: const pw.EdgeInsets.all(5),
        build: (ctx) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16), textAlign: pw.TextAlign.center),
            pw.SizedBox(height: 3),
            pw.Text('MARADI NIGER ${location?.toUpperCase() ?? ''}'.trim(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11), textAlign: pw.TextAlign.center),
            pw.SizedBox(height: 3),
            if (company.adresse.isNotEmpty && company.adresse.toUpperCase() != 'MARADI NIGER') ...[
              pw.Text(company.adresse, style: const pw.TextStyle(fontSize: 9), textAlign: pw.TextAlign.center),
              pw.SizedBox(height: 2),
            ],
            pw.Text('Tél: ${company.tel}', style: const pw.TextStyle(fontSize: 9), textAlign: pw.TextAlign.center),
            pw.SizedBox(height: 5),
            _dashedLine(),
            pw.SizedBox(height: 5),
            pw.Text('REÇU DE DÉPÔT', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 13)),
            pw.Text('Réf: $reference', style: const pw.TextStyle(fontSize: 8)),
            pw.SizedBox(height: 6),
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(5),
              decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5)),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  _infoRow('Date:', formattedDate),
                  pw.SizedBox(height: 2),
                  _infoRow('Client:', clientName, bold: true),
                  pw.SizedBox(height: 2),
                  _infoRow('Caissier:', createdBy),
                ],
              ),
            ),
            pw.SizedBox(height: 6),
            pw.Text('CUMUL DES DÉPÔTS', style: const pw.TextStyle(fontSize: 8)),
            pw.Text('${numberFormat.format(amount)} FCFA', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
            pw.SizedBox(height: 6),
            // Historique
            if (movements.isNotEmpty) ...[
              _dashedLine(),
              pw.SizedBox(height: 4),
              pw.Text('HISTORIQUE DES MOUVEMENTS', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
              pw.SizedBox(height: 4),
              _buildThermalMovementsTable(movements, numberFormat),
              pw.SizedBox(height: 4),
              _infoRow('Solde actuel:', '${numberFormat.format(remainingAmount)} FCFA', bold: true),
              pw.SizedBox(height: 4),
              _dashedLine(),
              pw.SizedBox(height: 4),
            ],
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: const pw.BoxDecoration(color: PdfColors.black),
              child: pw.Column(
                children: [
                  pw.Text('SOLDE RESTANT DISPONIBLE', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.white), textAlign: pw.TextAlign.center),
                  pw.Text('${numberFormat.format(remainingAmount)} FCFA', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 13, color: PdfColors.white), textAlign: pw.TextAlign.center),
                ],
              ),
            ),
            pw.SizedBox(height: 10),
            _dashedLine(),
            pw.SizedBox(height: 6),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('Signature Client', style: const pw.TextStyle(fontSize: 7)),
                pw.Text('Signature Caissier', style: const pw.TextStyle(fontSize: 7)),
              ],
            ),
            pw.SizedBox(height: 12),
            pw.BarcodeWidget(barcode: pw.Barcode.qrCode(), data: reference, width: 40, height: 40),
            pw.SizedBox(height: 4),
            pw.Text('MERCI DE VOTRE CONFIANCE', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7), textAlign: pw.TextAlign.center),
          ],
        ),
      ));
    } else {
      // ===== A4/A5 LAYOUT — Matching Desktop =====
      pdf.addPage(pw.MultiPage(
        pageFormat: pageFormat,
        margin: const pw.EdgeInsets.symmetric(horizontal: 25, vertical: 25),
        build: (ctx) => [
          // ── HEADER ──
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16)),
              pw.SizedBox(height: 2),
              pw.Text(company.adresse.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
              pw.Text('Tél: ${company.tel}${company.email.isNotEmpty ? '  |  Email: ${company.email}' : ''}', style: const pw.TextStyle(fontSize: 9)),
              pw.Text('NIF: ${company.nif}  |  RC: ${company.rc}', style: const pw.TextStyle(fontSize: 9)),
            ],
          ),
          pw.Divider(thickness: 1),
          pw.SizedBox(height: 8),

          // ── TITLE + REF/DATE ──
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text('REÇU DE DÉPÔT', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Date : $formattedDate', style: const pw.TextStyle(fontSize: 9)),
                  pw.Text('N° : $reference', style: const pw.TextStyle(fontSize: 9)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 14),

          // ── REÇU DE row ──
          pw.Row(
            children: [
              pw.Text('Reçu de :  ', style: const pw.TextStyle(fontSize: 10)),
              pw.Text('M./Mme/Ste. ${clientName.toUpperCase()}', style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
            ],
          ),
          pw.Divider(thickness: 0.5, color: PdfColors.grey500),
          pw.SizedBox(height: 10),

          // ── AMOUNTS BOX ──
          pw.Container(
            width: double.infinity,
            decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5, color: PdfColors.grey400)),
            child: pw.Column(
              children: [
                _a4AmountRow('Montant Initial:', '${numberFormat.format(amount)} FCFA', isBold: true, isHeader: true, bgColor: PdfColors.grey100),
                _a4AmountRow('Montant Restant:', '${numberFormat.format(remainingAmount)} FCFA'),
                _a4AmountRow('Statut:', statusLabel, valueColor: statusColor),
              ],
            ),
          ),
          pw.SizedBox(height: 12),

          // ── LETTRE ──
          pw.Text(
            'Arrêté le présent reçu à la somme de : $amountInWords.',
            style: pw.TextStyle(fontSize: 9, fontStyle: pw.FontStyle.italic),
          ),
          pw.SizedBox(height: 8),

          // ── MODE PAIEMENT ──
          pw.Row(
            children: [
              pw.Text('Mode de paiement :  ', style: const pw.TextStyle(fontSize: 10)),
              pw.Text('Espèce', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
            ],
          ),
          pw.SizedBox(height: 14),

          // ── HISTORIQUE TABLE ──
          pw.Text('Historique des Mouvements du Dépôt', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
          pw.SizedBox(height: 6),
          _buildA4MovementsTable(movements, numberFormat, remainingAmount),

          pw.SizedBox(height: 20),

          // ── SIGNATURE ──
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text('Signature du Caissier', style: const pw.TextStyle(fontSize: 9)),
                  pw.SizedBox(height: 40),
                  pw.Container(width: 120, height: 0.5, color: PdfColors.black),
                  pw.Text(createdBy, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Signature du Client', style: const pw.TextStyle(fontSize: 9)),
                  pw.SizedBox(height: 40),
                  pw.Container(width: 120, height: 0.5, color: PdfColors.black),
                  pw.Text(clientName, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                ],
              ),
            ],
          ),
        ],
      ));
    }

    return pdf.save();
  }

  // ── A4 Amounts Row ──
  static pw.Widget _a4AmountRow(String label, String value, {
    bool isBold = false,
    bool isHeader = false,
    PdfColor? bgColor,
    PdfColor? valueColor,
  }) {
    return pw.Container(
      decoration: pw.BoxDecoration(
        color: bgColor,
        border: const pw.Border(bottom: pw.BorderSide(width: 0.3, color: PdfColors.grey300)),
      ),
      padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: pw.TextStyle(fontSize: 10, fontWeight: isHeader ? pw.FontWeight.bold : pw.FontWeight.normal)),
          pw.Text(value, style: pw.TextStyle(fontSize: 10, fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal, color: valueColor)),
        ],
      ),
    );
  }

  // ── A4 Movements Table (matches desktop exactly) ──
  static pw.Widget _buildA4MovementsTable(List<DepositMovement> movements, NumberFormat fmt, double solde) {
    final dateFormat = DateFormat('dd/MM/yyyy');

    pw.Widget headerCell(String text) => pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      child: pw.Text(text, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
    );

    pw.Widget dataCell(String text, {pw.TextAlign align = pw.TextAlign.left, PdfColor? color}) => pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: pw.Text(text, textAlign: align, style: pw.TextStyle(fontSize: 9, color: color)),
    );

    List<pw.TableRow> rows = [
      // Header
      pw.TableRow(
        decoration: const pw.BoxDecoration(color: PdfColors.grey200),
        children: [
          headerCell('Date'),
          headerCell('Opération'),
          headerCell('Référence'),
          headerCell('Montant'),
        ],
      ),
    ];

    // Data rows
    for (final m in movements) {
      String fDate = m.date;
      try {
        fDate = dateFormat.format(DateTime.parse(m.date));
      } catch (_) {}

      final bool isNegative = m.amount < 0;
      final PdfColor amtColor = isNegative ? PdfColors.red800 : PdfColors.black;
      final String amtText = '${isNegative ? "" : ""}${fmt.format(m.amount)}';
      // Truncate reference if too long
      final String shortRef = m.reference.length > 16 ? '${m.reference.substring(0, 16)}...' : m.reference;

      rows.add(pw.TableRow(
        decoration: const pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(width: 0.3, color: PdfColors.grey300)),
        ),
        children: [
          dataCell(fDate),
          dataCell(m.type),
          dataCell(shortRef),
          dataCell(amtText, align: pw.TextAlign.right, color: amtColor),
        ],
      ));
    }

    // Total row
    rows.add(pw.TableRow(
      decoration: const pw.BoxDecoration(color: PdfColors.grey200),
      children: [
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
          child: pw.SizedBox(),
        ),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
          child: pw.SizedBox(),
        ),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
          child: pw.Text('Cumul des Mouvements (Solde Actuel)', textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
        ),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
          child: pw.Text('${NumberFormat('#,##0.00', 'fr_FR').format(solde)} FCFA', textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
        ),
      ],
    ));

    return pw.Table(
      border: pw.TableBorder.all(width: 0.5, color: PdfColors.grey400),
      columnWidths: {
        0: const pw.FixedColumnWidth(70),  // Date
        1: const pw.FlexColumnWidth(2),    // Opération
        2: const pw.FlexColumnWidth(2.5),  // Référence
        3: const pw.FixedColumnWidth(90),  // Montant
      },
      children: rows,
    );
  }

  // ── Thermal Movements Table ──
  static pw.Widget _buildThermalMovementsTable(List<DepositMovement> movements, NumberFormat fmt) {
    final dateFormat = DateFormat('dd/MM/yy');

    List<pw.TableRow> rows = [
      pw.TableRow(
        decoration: const pw.BoxDecoration(color: PdfColors.grey200),
        children: [
          _th('Date'), _th('Type'), _th('Montant'),
        ],
      ),
    ];

    for (final m in movements) {
      String fDate = m.date;
      try {
        fDate = dateFormat.format(DateTime.parse(m.date));
      } catch (_) {}
      rows.add(pw.TableRow(
        children: [
          _td(fDate),
          _td(m.type.length > 12 ? '${m.type.substring(0, 11)}.' : m.type),
          _td(fmt.format(m.amount), align: pw.TextAlign.right, color: m.amount < 0 ? PdfColors.red800 : null),
        ],
      ));
    }

    return pw.Table(
      border: pw.TableBorder.all(width: 0.5, color: PdfColors.grey),
      columnWidths: {
        0: const pw.FixedColumnWidth(40),
        1: const pw.FlexColumnWidth(2),
        2: const pw.FixedColumnWidth(55),
      },
      children: rows,
    );
  }

  static pw.Widget _th(String text) => pw.Padding(
    padding: const pw.EdgeInsets.all(2),
    child: pw.Text(text, style: pw.TextStyle(fontSize: 7, fontWeight: pw.FontWeight.bold)),
  );

  static pw.Widget _td(String text, {pw.TextAlign align = pw.TextAlign.left, PdfColor? color}) => pw.Padding(
    padding: const pw.EdgeInsets.all(2),
    child: pw.Text(text, textAlign: align, style: pw.TextStyle(fontSize: 7, color: color)),
  );

  static pw.Widget _infoRow(String label, String value, {bool bold = false}) => pw.Row(
    crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      pw.SizedBox(width: 55, child: pw.Text(label, style: const pw.TextStyle(fontSize: 9))),
      pw.Expanded(child: pw.Text(value, style: pw.TextStyle(fontSize: 9, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal))),
    ],
  );

  static pw.Widget _dashedLine() => pw.Row(
    children: List.generate(30, (i) => pw.Expanded(
      child: pw.Container(color: i % 2 == 0 ? PdfColors.black : PdfColors.white, height: 0.5),
    )),
  );

  // ── Simple number to words (French) ──
  static String _numberToWords(double amount) {
    final int n = amount.round();
    if (n == 0) return 'Zéro franc CFA';

    final ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
                  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
                  'dix-sept', 'dix-huit', 'dix-neuf'];
    final tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

    String threeDigits(int num) {
      if (num == 0) return '';
      String res = '';
      if (num >= 100) {
        if (num ~/ 100 == 1) res += 'cent '; else res += '${ones[num ~/ 100]} cent ';
        num = num % 100;
      }
      if (num >= 20) {
        int t = num ~/ 10;
        int o = num % 10;
        if (t == 7 || t == 9) { res += '${tens[t]}-'; res += ones[10 + o]; }
        else if (t == 8 && o == 0) { res += 'quatre-vingts'; }
        else { res += tens[t]; if (o > 0) res += '-${ones[o]}'; }
      } else if (num > 0) {
        res += ones[num];
      }
      return res.trim();
    }

    String result = '';
    if (n >= 1000000) {
      final m = n ~/ 1000000;
      result += '${threeDigits(m)} million${m > 1 ? "s" : ""} ';
    }
    if (n % 1000000 >= 1000) {
      final k = (n % 1000000) ~/ 1000;
      result += k == 1 ? 'mille ' : '${threeDigits(k)} mille ';
    }
    final rem = n % 1000;
    if (rem > 0) result += threeDigits(rem);

    // Capitalize first letter
    result = result.trim();
    if (result.isNotEmpty) result = result[0].toUpperCase() + result.substring(1);
    return '$result franc${n > 1 ? "s" : ""} CFA';
  }
}