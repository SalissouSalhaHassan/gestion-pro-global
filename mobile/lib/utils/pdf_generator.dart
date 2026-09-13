import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';

class PdfInvoiceGenerator {
  /// Converts a numeric amount to words in French (e.g. 15000 -> "Quinze mille")
  static String numberToWordsFr(double amount) {
    final int total = amount.floor();
    if (total == 0) return "zéro";

    const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

    String convert(int n) {
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 70) {
        final t = n ~/ 10;
        final r = n % 10;
        return tens[t] + (r == 1 ? ' et ' : (r > 0 ? '-' : '')) + ones[r];
      }
      if (n < 80) return "soixante-${convert(n - 60)}";
      if (n < 100) {
        final t = n ~/ 10;
        final r = n % 10;
        return (t == 8 ? "quatre-vingt" : "quatre-vingt-") + (r > 0 ? (t == 8 ? "-" : "") + convert(r) : "");
      }
      if (n < 1000) {
        final c = n ~/ 100;
        final r = n % 100;
        return (c == 1 ? "cent" : "${ones[c]} cent") + (r > 0 ? " ${convert(r)}" : "");
      }
      if (n < 1000000) {
        final m = n ~/ 1000;
        final r = n % 1000;
        return (m == 1 ? "mille" : "${convert(m)} mille") + (r > 0 ? " ${convert(r)}" : "");
      }
      final mill = n ~/ 1000000;
      final r = n % 1000000;
      return (mill == 1 ? "un million" : "${convert(mill)} millions") + (r > 0 ? " ${convert(r)}" : "");
    }

    final res = convert(total).trim();
    if (res.isEmpty) return "Zéro";
    return res[0].toUpperCase() + res.substring(1);
  }

  static Future<Uint8List> generateInvoice({
    required CompanyInfo company,
    required String clientName,
    String? clientAddress,
    String? clientTel,
    required List<Map<String, dynamic>> items,
    required double totalAmount,
    required String invoiceRef,
    required String sellerName,
    double? paidAmount,
    String? location,
    List<dynamic> payments = const [],
    PdfPageFormat pageFormat = PdfPageFormat.roll80,
    String mode = 'Invoice', // 'Invoice' or 'BL'
    DateTime? invoiceDate,
    String? invoiceId,
  }) async {
    final pdf = pw.Document();
    final now = invoiceDate ?? DateTime.now();
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');
    final dateOnlyFormat = DateFormat('dd/MM/yyyy');
    final numberFormat = NumberFormat("#,##0.00", "fr_FR");

    final double paid = paidAmount ?? totalAmount;
    final double remaining = (totalAmount - paid) > 0 ? (totalAmount - paid) : 0.0;
    final bool isThermal = pageFormat.width < 300;
    final bool isBL = mode.toUpperCase() == 'BL';

    // Normalized items
    final List<Map<String, dynamic>> parsedItems = items.map((item) {
      final String codeArt = (item['code_art'] ?? item['reference'] ?? item['code'] ?? '-').toString();
      final String name = (item['name'] ?? item['designation'] ?? item['description'] ?? 'Article').toString();
      final String depot = (item['depot'] ?? item['depot_origine'] ?? location ?? 'Boutique').toString();
      final num rawQty = (item['quantity'] ?? item['qte'] ?? 1) as num;
      final double qty = rawQty.toDouble();
      final double price = ((item['price'] ?? item['pu_ttc'] ?? item['pu_ht'] ?? 0) as num).toDouble();
      final double total = ((item['total'] ?? item['total_item_ttc'] ?? (price * qty)) as num).toDouble();

      return {
        'code_art': codeArt,
        'name': name,
        'depot': depot,
        'qty': qty,
        'price': price,
        'total': total,
      };
    }).toList();

    // Normalized payments
    final List<Map<String, dynamic>> parsedPayments = payments.map((p) {
      if (p is Map) {
        final dateStr = (p['date'] ?? p['date_operation'] ?? '').toString();
        final methodStr = (p['method'] ?? p['moyen_reglement'] ?? 'Espèce').toString();
        final num amt = (p['amount'] ?? p['montant_regle'] ?? 0) as num;
        return {
          'date': dateStr,
          'method': methodStr,
          'amount': amt.toDouble(),
        };
      }
      return {'date': '', 'method': '', 'amount': 0.0};
    }).toList();

    final String verificationUrl = "https://gestionpro.app/invoice/${invoiceId ?? invoiceRef}";

    if (isThermal) {
      // ==========================================
      // THERMAL (ROLL 80MM)
      // ==========================================
      pdf.addPage(
        pw.Page(
          pageFormat: pageFormat,
          margin: const pw.EdgeInsets.all(6),
          build: (pw.Context context) {
            return pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              mainAxisSize: pw.MainAxisSize.min,
              children: [
                // Company Name
                pw.Text(
                  company.nom.toUpperCase(),
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14),
                  textAlign: pw.TextAlign.center,
                ),
                pw.SizedBox(height: 2),

                // Location / City
                if (location != null && location.isNotEmpty) ...[
                  pw.Text(
                    location.toUpperCase(),
                    style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 2),
                ],

                if (company.adresse.isNotEmpty) ...[
                  pw.Text(
                    company.adresse,
                    style: const pw.TextStyle(fontSize: 8.5),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 1),
                ],

                if (company.tel.isNotEmpty) ...[
                  pw.Text(
                    "Tél: ${company.tel}",
                    style: const pw.TextStyle(fontSize: 8.5),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 1),
                ],

                if (company.nif.isNotEmpty || company.rc.isNotEmpty) ...[
                  pw.Text(
                    "NIF: ${company.nif} | RC: ${company.rc}",
                    style: const pw.TextStyle(fontSize: 7.5),
                    textAlign: pw.TextAlign.center,
                  ),
                  pw.SizedBox(height: 2),
                ],

                _buildDashedLine(),
                pw.SizedBox(height: 4),

                // Subtitle Box
                pw.Container(
                  width: double.infinity,
                  padding: const pw.EdgeInsets.symmetric(vertical: 3),
                  decoration: pw.BoxDecoration(
                    color: PdfColor.fromHex('EBEBEB'),
                    border: pw.Border.all(color: PdfColors.black, width: 0.8),
                  ),
                  child: pw.Center(
                    child: pw.Text(
                      isBL ? 'BON DE LIVRAISON' : 'RECU DE VENTE',
                      style: pw.TextStyle(
                        fontWeight: pw.FontWeight.bold,
                        fontSize: 10,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ),
                pw.SizedBox(height: 4),

                // Meta Rows
                _buildInfoRow(isBL ? "N° BL:" : "Reçu N°:", invoiceRef, isBold: true),
                _buildInfoRow("Date:", dateFormat.format(now)),
                _buildInfoRow("Vendeur:", sellerName),
                _buildInfoRow("Client:", clientName.toUpperCase(), isBold: true),
                if (clientAddress != null && clientAddress.isNotEmpty)
                  _buildInfoRow("Adresse:", clientAddress),

                pw.SizedBox(height: 4),
                _buildDashedLine(),
                pw.SizedBox(height: 4),

                // Table
                if (!isBL) ...[
                  // Facture Table
                  pw.Table(
                    columnWidths: {
                      0: const pw.FlexColumnWidth(3.6),
                      1: const pw.FlexColumnWidth(1.0),
                      2: const pw.FlexColumnWidth(1.6),
                      3: const pw.FlexColumnWidth(1.8),
                    },
                    children: [
                      pw.TableRow(
                        decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 0.5))),
                        children: [
                          _buildCell("Désignation", isBold: true, align: pw.TextAlign.left),
                          _buildCell("Qté", isBold: true, align: pw.TextAlign.center),
                          _buildCell("PU", isBold: true, align: pw.TextAlign.right),
                          _buildCell("Total", isBold: true, align: pw.TextAlign.right),
                        ],
                      ),
                      ...parsedItems.map((item) => pw.TableRow(
                        children: [
                          _buildCell(item['name'], align: pw.TextAlign.left),
                          _buildCell(item['qty'].toStringAsFixed(item['qty'] % 1 == 0 ? 0 : 2), align: pw.TextAlign.center),
                          _buildCell(numberFormat.format(item['price']), align: pw.TextAlign.right),
                          _buildCell(numberFormat.format(item['total']), align: pw.TextAlign.right),
                        ],
                      )),
                    ],
                  ),
                  pw.SizedBox(height: 4),
                  _buildDashedLine(),
                  pw.SizedBox(height: 4),

                  // Financial Totals
                  pw.Container(
                    width: double.infinity,
                    padding: const pw.EdgeInsets.all(4),
                    decoration: pw.BoxDecoration(
                      border: pw.Border.all(width: 0.5),
                      color: PdfColor.fromHex('F9F9F9'),
                    ),
                    child: pw.Column(
                      children: [
                        pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Text("TOTAL:", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9.5)),
                            pw.Text("${numberFormat.format(totalAmount)} CFA", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                          ],
                        ),
                        pw.SizedBox(height: 2),
                        pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Text("Payé:", style: const pw.TextStyle(fontSize: 9)),
                            pw.Text("${numberFormat.format(paid)} CFA", style: const pw.TextStyle(fontSize: 9)),
                          ],
                        ),
                        pw.SizedBox(height: 2),
                        pw.Row(
                          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                          children: [
                            pw.Text("Reste à Payer:", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
                            pw.Text("${numberFormat.format(remaining)} CFA", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9.5)),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Payments history (if any)
                  if (parsedPayments.isNotEmpty) ...[
                    pw.SizedBox(height: 6),
                    pw.Text(
                      "HISTORIQUE DES VERSEMENTS",
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8, decoration: pw.TextDecoration.underline),
                    ),
                    pw.SizedBox(height: 2),
                    ...parsedPayments.map((p) => pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        pw.Text("${p['date']} (${p['method']})", style: const pw.TextStyle(fontSize: 7.5)),
                        pw.Text("${numberFormat.format(p['amount'])} CFA", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7.5)),
                      ],
                    )),
                  ],
                ] else ...[
                  // BL Table (No monetary amounts)
                  pw.Table(
                    columnWidths: {
                      0: const pw.FlexColumnWidth(1.6),
                      1: const pw.FlexColumnWidth(3.8),
                      2: const pw.FlexColumnWidth(1.4),
                      3: const pw.FlexColumnWidth(1.2),
                    },
                    children: [
                      pw.TableRow(
                        decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 0.5))),
                        children: [
                          _buildCell("Code", isBold: true, align: pw.TextAlign.center),
                          _buildCell("Désignation", isBold: true, align: pw.TextAlign.left),
                          _buildCell("Dépôt", isBold: true, align: pw.TextAlign.center),
                          _buildCell("Qté", isBold: true, align: pw.TextAlign.center),
                        ],
                      ),
                      ...parsedItems.map((item) => pw.TableRow(
                        children: [
                          _buildCell(item['code_art'], align: pw.TextAlign.center),
                          _buildCell(item['name'], align: pw.TextAlign.left),
                          _buildCell(item['depot'], align: pw.TextAlign.center),
                          _buildCell(item['qty'].toStringAsFixed(item['qty'] % 1 == 0 ? 0 : 2), align: pw.TextAlign.center),
                        ],
                      )),
                    ],
                  ),
                  pw.SizedBox(height: 6),
                  pw.Text(
                    "Total Articles: ${parsedItems.length}",
                    style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8.5),
                  ),
                ],

                pw.SizedBox(height: 6),
                _buildDashedLine(),
                pw.SizedBox(height: 6),

                // SSL QR Code & Barcode
                pw.BarcodeWidget(
                  barcode: pw.Barcode.qrCode(),
                  data: verificationUrl,
                  width: 45,
                  height: 45,
                ),
                pw.SizedBox(height: 2),
                pw.Text(
                  "Vérifié SSL",
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7),
                ),
                pw.SizedBox(height: 4),

                pw.BarcodeWidget(
                  barcode: pw.Barcode.code128(),
                  data: invoiceRef,
                  width: 140,
                  height: 30,
                  drawText: false,
                ),
                pw.SizedBox(height: 4),

                pw.Text(
                  company.notesPiedFacture ?? "Merci pour votre confiance !",
                  style: pw.TextStyle(fontStyle: pw.FontStyle.italic, fontSize: 7.5),
                  textAlign: pw.TextAlign.center,
                ),
                pw.SizedBox(height: 2),
                pw.Text(
                  "Software by GestionPro",
                  style: const pw.TextStyle(fontSize: 6, color: PdfColors.grey700),
                  textAlign: pw.TextAlign.center,
                ),
              ],
            );
          },
        ),
      );
    } else {
      // ==========================================
      // A4 / A5 FORMAT (EXACT REPLICA OF WEB MODAL)
      // ==========================================
      pdf.addPage(
        pw.MultiPage(
          pageFormat: pageFormat,
          margin: const pw.EdgeInsets.symmetric(horizontal: 22, vertical: 20),
          build: (pw.Context context) {
            return [
              // --- 1. TOP LOGO / INFO ---
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    company.nom.toUpperCase(),
                    style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16, letterSpacing: 0.5),
                  ),
                  if (company.adresse.isNotEmpty) ...[
                    pw.SizedBox(height: 2),
                    pw.Text(
                      company.adresse.toUpperCase(),
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9.5),
                    ),
                  ],
                  pw.SizedBox(height: 2),
                  pw.Text(
                    "Tél: ${company.tel}${company.nif.isNotEmpty ? ' | NIF: ${company.nif}' : ''}${company.rc.isNotEmpty ? ' | RC: ${company.rc}' : ''}",
                    style: const pw.TextStyle(fontSize: 8.5),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Container(width: double.infinity, height: 1.5, color: PdfColors.black),
                ],
              ),

              // --- 2. SUBTITLE BOX (RECU DE VENTE / BON DE LIVRAISON) ---
              pw.Container(
                width: double.infinity,
                margin: const pw.EdgeInsets.symmetric(vertical: 8),
                padding: const pw.EdgeInsets.symmetric(vertical: 5),
                decoration: pw.BoxDecoration(
                  color: PdfColor.fromHex('EBEBEB'),
                  border: pw.Border.all(color: PdfColors.black, width: 1),
                ),
                child: pw.Center(
                  child: pw.Text(
                    isBL ? 'BON DE LIVRAISON' : 'RECU DE VENTE',
                    style: pw.TextStyle(
                      fontWeight: pw.FontWeight.bold,
                      fontSize: 14,
                      letterSpacing: 2.0,
                    ),
                  ),
                ),
              ),

              // --- 3. TWO COLUMN DETAILS ---
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  // Left: Sale / BL Details
                  pw.Expanded(
                    child: pw.Padding(
                      padding: const pw.EdgeInsets.only(right: 12),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Container(
                            width: double.infinity,
                            padding: const pw.EdgeInsets.only(bottom: 2),
                            decoration: const pw.BoxDecoration(
                              border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                            ),
                            child: pw.Text(
                              isBL ? 'Détails du Bon' : 'Détails de la Vente',
                              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11),
                            ),
                          ),
                          pw.SizedBox(height: 4),
                          _buildFieldRow(isBL ? "BL N°:" : "Reçu N°:", invoiceRef),
                          _buildFieldRow(isBL ? "Date BL:" : "Date:", dateOnlyFormat.format(now)),
                          _buildFieldRow("Vendeur:", sellerName),
                          if (!isBL)
                            _buildFieldRow("Point de Vente:", location ?? "Boutique"),
                        ],
                      ),
                    ),
                  ),

                  // Right: Client Details
                  pw.Expanded(
                    child: pw.Padding(
                      padding: const pw.EdgeInsets.only(left: 12),
                      child: pw.Column(
                        crossAxisAlignment: pw.CrossAxisAlignment.start,
                        children: [
                          pw.Container(
                            width: double.infinity,
                            padding: const pw.EdgeInsets.only(bottom: 2),
                            decoration: const pw.BoxDecoration(
                              border: pw.Border(bottom: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                            ),
                            child: pw.Text(
                              'Client',
                              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11),
                            ),
                          ),
                          pw.SizedBox(height: 4),
                          pw.Text(
                            clientName.isNotEmpty ? clientName : "Client Divers",
                            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11.5),
                          ),
                          if (clientAddress != null && clientAddress.isNotEmpty) ...[
                            pw.SizedBox(height: 2),
                            pw.Text(clientAddress, style: const pw.TextStyle(fontSize: 9)),
                          ],
                          if (clientTel != null && clientTel.isNotEmpty) ...[
                            pw.SizedBox(height: 1),
                            pw.Text("Tél: $clientTel", style: const pw.TextStyle(fontSize: 8.5)),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              pw.SizedBox(height: 12),

              // --- 4. ITEMS TABLE ---
              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.black, width: 0.8),
                columnWidths: isBL
                    ? {
                        0: const pw.FlexColumnWidth(1.8), // Code Art.
                        1: const pw.FlexColumnWidth(5.2), // Désignation
                        2: const pw.FlexColumnWidth(1.5), // Dépôt
                        3: const pw.FlexColumnWidth(1.5), // Qté
                      }
                    : {
                        0: const pw.FlexColumnWidth(5.5), // Description
                        1: const pw.FlexColumnWidth(1.5), // Qté
                        2: const pw.FlexColumnWidth(1.5), // PU
                        3: const pw.FlexColumnWidth(1.5), // Total
                      },
                children: [
                  // Table Header
                  pw.TableRow(
                    decoration: pw.BoxDecoration(color: PdfColor.fromHex('EBEBEB')),
                    children: isBL
                        ? [
                            _buildTableHeadCell("Code Art.", align: pw.TextAlign.center),
                            _buildTableHeadCell("Désignation", align: pw.TextAlign.left),
                            _buildTableHeadCell("Dépôt", align: pw.TextAlign.center),
                            _buildTableHeadCell("Qté", align: pw.TextAlign.center),
                          ]
                        : [
                            _buildTableHeadCell("Description", align: pw.TextAlign.left),
                            _buildTableHeadCell("Qté", align: pw.TextAlign.center),
                            _buildTableHeadCell("PU", align: pw.TextAlign.right),
                            _buildTableHeadCell("Total", align: pw.TextAlign.right),
                          ],
                  ),

                  // Table Body
                  ...parsedItems.map((item) {
                    final String qtyStr = item['qty'] % 1 == 0
                        ? item['qty'].toInt().toString()
                        : item['qty'].toStringAsFixed(2);

                    if (isBL) {
                      return pw.TableRow(
                        children: [
                          _buildTableCell(item['code_art'], align: pw.TextAlign.center, fontSize: 8.5),
                          _buildTableCell(item['name'], align: pw.TextAlign.left),
                          _buildTableCell(item['depot'], align: pw.TextAlign.center, fontSize: 8.5),
                          _buildTableCell(qtyStr, align: pw.TextAlign.center, isBold: true),
                        ],
                      );
                    } else {
                      return pw.TableRow(
                        children: [
                          _buildTableCell(item['name'], align: pw.TextAlign.left),
                          _buildTableCell(qtyStr, align: pw.TextAlign.center, isBold: true),
                          _buildTableCell(numberFormat.format(item['price']), align: pw.TextAlign.right),
                          _buildTableCell(numberFormat.format(item['total']), align: pw.TextAlign.right, isBold: true),
                        ],
                      );
                    }
                  }),
                ],
              ),
              pw.SizedBox(height: 10),

              // --- 5. FACTURE SPECIFICS (Words, Summary, Payments) ---
              if (!isBL) ...[
                // Sum in French Words
                pw.Text(
                  "Arrêtée à la somme de : ${numberToWordsFr(totalAmount)} francs CFA.",
                  style: pw.TextStyle(fontStyle: pw.FontStyle.italic, fontSize: 9.5, fontWeight: pw.FontWeight.bold),
                ),
                pw.SizedBox(height: 10),

                // 3-Box Financial Summary Row
                pw.Container(
                  decoration: pw.BoxDecoration(
                    border: pw.Border.all(color: PdfColors.black, width: 1),
                  ),
                  child: pw.Row(
                    children: [
                      // TOTAL
                      pw.Expanded(
                        child: pw.Container(
                          padding: const pw.EdgeInsets.symmetric(vertical: 4),
                          color: PdfColor.fromHex('EBEBEB'),
                          child: pw.Column(
                            children: [
                              pw.Text("TOTAL", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
                              pw.SizedBox(height: 1),
                              pw.Text(numberFormat.format(totalAmount), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
                      pw.Container(width: 1, height: 32, color: PdfColors.black),

                      // MONTANT PAYÉ
                      pw.Expanded(
                        child: pw.Container(
                          padding: const pw.EdgeInsets.symmetric(vertical: 4),
                          color: PdfColor.fromHex('F9F9F9'),
                          child: pw.Column(
                            children: [
                              pw.Text("MONTANT PAYÉ", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
                              pw.SizedBox(height: 1),
                              pw.Text(numberFormat.format(paid), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
                      pw.Container(width: 1, height: 32, color: PdfColors.black),

                      // RESTE À PAYER
                      pw.Expanded(
                        child: pw.Container(
                          padding: const pw.EdgeInsets.symmetric(vertical: 4),
                          color: PdfColors.white,
                          child: pw.Column(
                            children: [
                              pw.Text("RESTE À PAYER", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
                              pw.SizedBox(height: 1),
                              pw.Text(numberFormat.format(remaining), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                pw.SizedBox(height: 12),

                // Payments History Table
                pw.Text(
                  "Historique des Versements",
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10, decoration: pw.TextDecoration.underline),
                ),
                pw.SizedBox(height: 4),
                pw.Table(
                  border: pw.TableBorder.all(color: PdfColors.black, width: 0.8),
                  columnWidths: {
                    0: const pw.FlexColumnWidth(3.0),
                    1: const pw.FlexColumnWidth(4.0),
                    2: const pw.FlexColumnWidth(3.0),
                  },
                  children: [
                    pw.TableRow(
                      decoration: pw.BoxDecoration(color: PdfColor.fromHex('EBEBEB')),
                      children: [
                        _buildTableHeadCell("Date", align: pw.TextAlign.center),
                        _buildTableHeadCell("Moyen", align: pw.TextAlign.center),
                        _buildTableHeadCell("Versement", align: pw.TextAlign.right),
                      ],
                    ),
                    if (parsedPayments.isEmpty)
                      pw.TableRow(
                        children: [
                          pw.Padding(
                            padding: const pw.EdgeInsets.all(4),
                            child: pw.Text("Aucun versement", style: const pw.TextStyle(fontSize: 8.5, fontStyle: pw.FontStyle.italic)),
                          ),
                          pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("-")),
                          pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("-", textAlign: pw.TextAlign.right)),
                        ],
                      )
                    else
                      ...parsedPayments.map((p) => pw.TableRow(
                        children: [
                          _buildTableCell(p['date'], align: pw.TextAlign.center, fontSize: 8.5),
                          _buildTableCell(p['method'], align: pw.TextAlign.center, fontSize: 8.5),
                          _buildTableCell(numberFormat.format(p['amount']), align: pw.TextAlign.right, fontSize: 8.5, isBold: true),
                        ],
                      )),
                  ],
                ),
                pw.SizedBox(height: 20),

                // Signatures & Stamps Area (Facture)
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    // Client Signature
                    pw.Container(
                      width: 140,
                      decoration: const pw.BoxDecoration(
                        border: pw.Border(top: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                      ),
                      padding: const pw.EdgeInsets.only(top: 4),
                      child: pw.Center(
                        child: pw.Text("Signature du Client", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
                      ),
                    ),

                    // SSL QR Code Verification
                    if (company.showQrCode)
                      pw.Container(
                        padding: const pw.EdgeInsets.all(4),
                        decoration: pw.BoxDecoration(
                          border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
                          borderRadius: pw.BorderRadius.circular(4),
                        ),
                        child: pw.Column(
                          children: [
                            pw.BarcodeWidget(
                              barcode: pw.Barcode.qrCode(),
                              data: verificationUrl,
                              width: 50,
                              height: 50,
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              "Vérifié SSL",
                              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7, color: PdfColors.grey700),
                            ),
                          ],
                        ),
                      ),

                    // Direction Stamp & Signature
                    pw.Container(
                      width: 170,
                      child: pw.Column(
                        children: [
                          if (company.showStamp)
                            pw.Container(
                              width: 110,
                              height: 45,
                              margin: const pw.EdgeInsets.only(bottom: 4),
                              decoration: pw.BoxDecoration(
                                border: pw.Border.all(color: PdfColor.fromHex('4338CA'), width: 1.5, style: pw.BorderStyle.dashed),
                                borderRadius: pw.BorderRadius.circular(4),
                              ),
                              child: pw.Center(
                                child: pw.Column(
                                  mainAxisAlignment: pw.MainAxisAlignment.center,
                                  children: [
                                    pw.Text(
                                      company.nom.length > 18 ? company.nom.substring(0, 18) : company.nom,
                                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7, color: PdfColor.fromHex('4338CA')),
                                    ),
                                    pw.Text("CACHET OFFICIEL", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6.5, color: PdfColor.fromHex('4338CA'))),
                                    pw.Text("DIRECTION", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6, color: PdfColor.fromHex('4338CA'))),
                                  ],
                                ),
                              ),
                            ),
                          pw.Container(
                            width: double.infinity,
                            decoration: const pw.BoxDecoration(
                              border: pw.Border(top: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                            ),
                            padding: const pw.EdgeInsets.only(top: 4),
                            child: pw.Center(
                              child: pw.Text("Cachet & Direction Générale", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ] else ...[
                // --- 6. BON DE LIVRAISON SPECIFICS (Signatures & Verification) ---
                pw.SizedBox(height: 25),
                pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    // Livreur Signature
                    pw.Container(
                      width: 140,
                      decoration: const pw.BoxDecoration(
                        border: pw.Border(top: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                      ),
                      padding: const pw.EdgeInsets.only(top: 4),
                      child: pw.Center(
                        child: pw.Text("Signature du Livreur", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
                      ),
                    ),

                    // SSL QR Code Verification
                    if (company.showQrCode)
                      pw.Container(
                        padding: const pw.EdgeInsets.all(4),
                        decoration: pw.BoxDecoration(
                          border: pw.Border.all(color: PdfColors.grey400, width: 0.5),
                          borderRadius: pw.BorderRadius.circular(4),
                        ),
                        child: pw.Column(
                          children: [
                            pw.BarcodeWidget(
                              barcode: pw.Barcode.qrCode(),
                              data: verificationUrl,
                              width: 50,
                              height: 50,
                            ),
                            pw.SizedBox(height: 2),
                            pw.Text(
                              "Vérifié SSL",
                              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7, color: PdfColors.grey700),
                            ),
                          ],
                        ),
                      ),

                    // Client Receipt Stamp & Signature
                    pw.Container(
                      width: 180,
                      decoration: const pw.BoxDecoration(
                        border: pw.Border(top: pw.BorderSide(color: PdfColors.black, width: 0.8)),
                      ),
                      padding: const pw.EdgeInsets.only(top: 4),
                      child: pw.Column(
                        children: [
                          pw.Text("Cachet et Signature du Client", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
                          pw.SizedBox(height: 1),
                          pw.Text("(Reçu en bon état)", style: pw.TextStyle(fontStyle: pw.FontStyle.italic, fontWeight: pw.FontWeight.bold, fontSize: 8)),
                        ],
                      ),
                    ),
                  ],
                ),
              ],

              pw.SizedBox(height: 25),

              // --- 7. FOOTER & PAGINATION ---
              pw.Container(
                decoration: const pw.BoxDecoration(
                  border: pw.Border(top: pw.BorderSide(color: PdfColors.grey300, width: 0.8)),
                ),
                padding: const pw.EdgeInsets.only(top: 4),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Expanded(
                      child: pw.Text(
                        company.notesPiedFacture ?? "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 48h.",
                        style: pw.TextStyle(fontSize: 8, fontStyle: pw.FontStyle.italic, color: PdfColors.grey700),
                      ),
                    ),
                    pw.Text("Page 1/1", style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
                  ],
                ),
              ),
            ];
          },
        ),
      );
    }

    return pdf.save();
  }

  // Helper methods
  static pw.Widget _buildFieldRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 1),
      child: pw.Row(
        children: [
          pw.SizedBox(
            width: 70,
            child: pw.Text(label, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
          ),
          pw.Expanded(
            child: pw.Text(value, style: const pw.TextStyle(fontSize: 9)),
          ),
        ],
      ),
    );
  }

  static pw.Widget _buildTableHeadCell(String text, {required pw.TextAlign align}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 3.5),
      child: pw.Text(
        text,
        style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9.5),
        textAlign: align,
      ),
    );
  }

  static pw.Widget _buildTableCell(
    String text, {
    required pw.TextAlign align,
    bool isBold = false,
    double fontSize = 9.0,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 3.5),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontWeight: isBold ? pw.FontWeight.bold : null,
          fontSize: fontSize,
        ),
        textAlign: align,
      ),
    );
  }

  static pw.Widget _buildCell(String text, {bool isBold = false, pw.TextAlign align = pw.TextAlign.left}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 2, horizontal: 1),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: 7.5,
          fontWeight: isBold ? pw.FontWeight.bold : null,
        ),
        textAlign: align,
      ),
    );
  }

  static pw.Widget _buildInfoRow(
    String label,
    String value, {
    bool isBold = false,
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 1),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(
            label,
            style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold),
          ),
          pw.Text(
            value,
            style: pw.TextStyle(
              fontSize: 8.5,
              fontWeight: isBold ? pw.FontWeight.bold : null,
            ),
          ),
        ],
      ),
    );
  }

  static pw.Widget _buildDashedLine() {
    return pw.Row(
      children: List.generate(
        30,
        (index) => pw.Expanded(
          child: pw.Container(
            color: index % 2 == 0 ? PdfColors.black : PdfColors.white,
            height: 0.5,
          ),
        ),
      ),
    );
  }
}
