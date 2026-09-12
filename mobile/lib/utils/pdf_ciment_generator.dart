import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';
import '../models/ciment_model.dart';

class PdfCimentGenerator {
  static Future<Uint8List> generateInvoice({
    required CompanyInfo company,
    required CimentShipment shipment,
    required List<CimentPayment> payments,
    required String createdBy,
    PdfPageFormat pageFormat = PdfPageFormat.a4,
  }) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat('#,##0', 'fr_FR');
    final dateFormat = DateFormat('dd/MM/yyyy');

    bool isThermal = pageFormat.width < 300;

    String formattedDate = shipment.createdAt;
    try {
      final parsed = DateTime.parse(shipment.createdAt);
      formattedDate = dateFormat.format(parsed);
    } catch (_) {}

    String amountInWords = _numberToWords(shipment.total);
    double remaining = (shipment.total - shipment.montantPaye).clamp(0.0, 999999999.0);

    if (isThermal) {
      // ===== THERMAL 80MM LAYOUT =====
      pdf.addPage(pw.Page(
        pageFormat: pageFormat,
        margin: const pw.EdgeInsets.all(5),
        build: (ctx) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 13), textAlign: pw.TextAlign.center),
            pw.SizedBox(height: 2),
            if (company.adresse.isNotEmpty) ...[
              pw.Text(company.adresse, style: const pw.TextStyle(fontSize: 8), textAlign: pw.TextAlign.center),
              pw.SizedBox(height: 1),
            ],
            pw.Text('Tél: ${company.tel}', style: const pw.TextStyle(fontSize: 8), textAlign: pw.TextAlign.center),
            pw.SizedBox(height: 3),
            _dashedLine(),
            pw.SizedBox(height: 3),
            pw.Text('FACTURE DE CHARGEMENT', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)),
            pw.Text('Réf: CIM-${shipment.id.substring(0, 8).toUpperCase()}', style: const pw.TextStyle(fontSize: 7)),
            pw.SizedBox(height: 5),
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(4),
              decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5)),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  _infoRow('Date:', formattedDate),
                  _infoRow('Client:', shipment.clientTel, bold: true),
                  _infoRow('Camion:', shipment.camionNo),
                  _infoRow('Transport:', shipment.transporteur ?? "-"),
                  _infoRow('Sourd:', shipment.typeCiment ?? "-"),
                  _infoRow('Dest:', shipment.destination),
                  _infoRow('Tonnage:', "${shipment.tonnage.toStringAsFixed(2)} t"),
                  _infoRow('P.U:', "${numberFormat.format(shipment.pu)} F"),
                ],
              ),
            ),
            pw.SizedBox(height: 4),
            pw.Text('RÉCAPITULATIF FINANCIER', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
            pw.SizedBox(height: 2),
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(4),
              decoration: const pw.BoxDecoration(color: PdfColors.grey200),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  _infoRow('TOTAL TTC:', '${numberFormat.format(shipment.total)} F', bold: true),
                  _infoRow('Payé:', '${numberFormat.format(shipment.montantPaye)} F'),
                  _infoRow('Reste à Payer:', '${numberFormat.format(remaining)} F', bold: remaining > 0),
                ],
              ),
            ),
            pw.SizedBox(height: 6),
            _dashedLine(),
            pw.SizedBox(height: 4),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('Signature Client', style: const pw.TextStyle(fontSize: 6)),
                pw.Text('Signature Caissier', style: const pw.TextStyle(fontSize: 6)),
              ],
            ),
            pw.SizedBox(height: 10),
            pw.BarcodeWidget(barcode: pw.Barcode.qrCode(), data: "CIM-${shipment.id}-${shipment.clientTel}", width: 35, height: 35),
            pw.SizedBox(height: 2),
            pw.Text('MERCI DE VOTRE CONFIANCE', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 6), textAlign: pw.TextAlign.center),
          ],
        ),
      ));
    } else {
      // ===== A4 / A5 LAYOUT =====
      pdf.addPage(pw.MultiPage(
        pageFormat: pageFormat,
        margin: const pw.EdgeInsets.all(25),
        build: (ctx) => [
          // Header
          pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 15)),
              pw.SizedBox(height: 2),
              pw.Text(company.adresse.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
              pw.Text('Tél: ${company.tel}${company.email.isNotEmpty ? '  |  Email: ${company.email}' : ''}', style: const pw.TextStyle(fontSize: 8)),
              pw.Text('NIF: ${company.nif}  |  RC: ${company.rc}', style: const pw.TextStyle(fontSize: 8)),
            ],
          ),
          pw.Divider(thickness: 1),
          pw.SizedBox(height: 5),

          // Title
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text('FACTURE DE CHARGEMENT CIMENT', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Date : $formattedDate', style: const pw.TextStyle(fontSize: 8)),
                  pw.Text('Facture N° : CIM-${shipment.id.substring(0, 8).toUpperCase()}', style: const pw.TextStyle(fontSize: 8)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 10),

          // Client and Logistics
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Container(
                  padding: const pw.EdgeInsets.all(8),
                  decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5, color: PdfColors.grey400), borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6))),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('DÉTAILS LOGISTIQUES', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.indigo700)),
                      pw.SizedBox(height: 4),
                      pw.Text('Camion: ${shipment.camionNo}', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
                      pw.Text('Transporteur: ${shipment.transporteur ?? "-"}', style: const pw.TextStyle(fontSize: 8)),
                      pw.Text('Chauffeur: ${shipment.chauffeur ?? "-"} ${shipment.chauffeurTel != null ? "(${shipment.chauffeurTel})" : ""}', style: const pw.TextStyle(fontSize: 8)),
                    ],
                  ),
                ),
              ),
              pw.SizedBox(width: 15),
              pw.Expanded(
                child: pw.Container(
                  padding: const pw.EdgeInsets.all(8),
                  decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5, color: PdfColors.grey400), borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6))),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('CLIENT', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: PdfColors.indigo700)),
                      pw.SizedBox(height: 4),
                      pw.Text(shipment.clientTel, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                      pw.Text('Destination: ${shipment.destination}', style: const pw.TextStyle(fontSize: 8)),
                      if (shipment.bons != null && shipment.bons!.isNotEmpty) pw.Text('Bons: ${shipment.bons}', style: const pw.TextStyle(fontSize: 8)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 10),

          // Items Table
          pw.Table(
            border: pw.TableBorder.all(width: 0.5, color: PdfColors.grey400),
            columnWidths: const {
              0: pw.FlexColumnWidth(3),
              1: pw.FixedColumnWidth(60),
              2: pw.FixedColumnWidth(80),
              3: pw.FixedColumnWidth(90),
            },
            children: [
              // Header
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                children: [
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("Désignation", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Center(child: pw.Text("Tonnage", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text("P.U (HT)", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text("Montant (HT)", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                ],
              ),
              // Main row
              pw.TableRow(
                children: [
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text(shipment.typeCiment ?? "Ciment", style: const pw.TextStyle(fontSize: 8))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Center(child: pw.Text("${shipment.tonnage.toStringAsFixed(2)} t", style: const pw.TextStyle(fontSize: 8)))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text(numberFormat.format(shipment.pu), style: const pw.TextStyle(fontSize: 8)))),
                  pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text(numberFormat.format(shipment.tonnage * shipment.pu), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                ],
              ),
              // Frais Ciment if present
              if (shipment.fraisCiment > 0)
                pw.TableRow(
                  children: [
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("Frais Ciment Additionnels", style: const pw.TextStyle(fontSize: 8))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Center(child: pw.Text("-", style: const pw.TextStyle(fontSize: 8)))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text("-", style: const pw.TextStyle(fontSize: 8)))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text(numberFormat.format(shipment.fraisCiment), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                  ],
                ),
              // Frais Transport if present
              if (shipment.fraisTransport > 0)
                pw.TableRow(
                  children: [
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("Frais de Transport", style: const pw.TextStyle(fontSize: 8))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Center(child: pw.Text("-", style: const pw.TextStyle(fontSize: 8)))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text("-", style: const pw.TextStyle(fontSize: 8)))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text(numberFormat.format(shipment.fraisTransport), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                  ],
                ),
            ],
          ),
          pw.SizedBox(height: 10),

          // Total Box
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Container(
              width: 200,
              decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5, color: PdfColors.grey400)),
              child: pw.Column(
                children: [
                  _a4AmountRow('TOTAL TTC:', '${numberFormat.format(shipment.total)} FCFA', isBold: true, bgColor: PdfColors.grey100),
                  _a4AmountRow('MONTANT PAYÉ:', '${numberFormat.format(shipment.montantPaye)} FCFA'),
                  _a4AmountRow('RESTE À PAYER:', '${numberFormat.format(remaining)} FCFA', valueColor: remaining > 0 ? PdfColors.red800 : PdfColors.green800, isBold: remaining > 0),
                ],
              ),
            ),
          ),
          pw.SizedBox(height: 8),

          // Total in letters
          pw.Text(
            'Arrêtée la présente facture à la somme de : $amountInWords.',
            style: pw.TextStyle(fontSize: 8, fontStyle: pw.FontStyle.italic),
          ),
          pw.SizedBox(height: 10),

          // Payments History
          pw.Text('HISTORIQUE DES RÈGLEMENTS', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, decoration: pw.TextDecoration.underline)),
          pw.SizedBox(height: 4),
          pw.Table(
            border: pw.TableBorder.all(width: 0.5, color: PdfColors.grey400),
            columnWidths: const {
              0: pw.FixedColumnWidth(80),
              1: pw.FlexColumnWidth(),
              2: pw.FixedColumnWidth(80),
              3: pw.FixedColumnWidth(95),
            },
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: PdfColors.grey100),
                children: [
                  pw.Padding(padding: const pw.EdgeInsets.all(3), child: pw.Text("Date", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
                  pw.Padding(padding: const pw.EdgeInsets.all(3), child: pw.Text("Mode de Paiement", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
                  pw.Padding(padding: const pw.EdgeInsets.all(3), child: pw.Text("Référence", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
                  pw.Padding(padding: const pw.EdgeInsets.all(3), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text("Montant (F)", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                ],
              ),
              if (payments.isEmpty)
                pw.TableRow(
                  children: [
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("-", style: const pw.TextStyle(fontSize: 8))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("Aucun paiement enregistré", style: pw.TextStyle(fontSize: 8, fontStyle: pw.FontStyle.italic))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("-", style: const pw.TextStyle(fontSize: 8))),
                    pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text("0", style: const pw.TextStyle(fontSize: 8)))),
                  ],
                )
              else
                ...payments.map((p) {
                  String pDate = p.datePaiement;
                  try {
                    pDate = dateFormat.format(DateTime.parse(p.datePaiement));
                  } catch (_) {}
                  return pw.TableRow(
                    children: [
                      pw.Padding(padding: const pw.EdgeInsets.all(3), child: pw.Text(pDate, style: const pw.TextStyle(fontSize: 8))),
                      pw.Padding(padding: const pw.EdgeInsets.all(3), child: pw.Text(p.moyenPaiement, style: const pw.TextStyle(fontSize: 8))),
                      pw.Padding(padding: const pw.EdgeInsets.all(3), child: pw.Text(p.reference ?? "-", style: const pw.TextStyle(fontSize: 8))),
                      pw.Padding(padding: const pw.EdgeInsets.all(3), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text(numberFormat.format(p.montant), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                    ],
                  );
                }),
            ],
          ),
          pw.SizedBox(height: 25),

          // Signatures
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text('Le Responsable (Facturation)', style: const pw.TextStyle(fontSize: 8, decoration: pw.TextDecoration.underline)),
                  pw.SizedBox(height: 40),
                  pw.Container(width: 120, height: 0.5, color: PdfColors.black),
                  pw.Text(createdBy, style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Signature du Client (Reçu en bon état)', style: const pw.TextStyle(fontSize: 8, decoration: pw.TextDecoration.underline)),
                  pw.SizedBox(height: 40),
                  pw.Container(width: 120, height: 0.5, color: PdfColors.black),
                  pw.Text(shipment.clientTel, style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
                ],
              ),
            ],
          ),
        ],
      ));
    }

    return pdf.save();
  }

  // Helpers
  static pw.Widget _infoRow(String label, String value, {bool bold = false}) => pw.Row(
    crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      pw.SizedBox(width: 60, child: pw.Text(label, style: const pw.TextStyle(fontSize: 7.5))),
      pw.Expanded(child: pw.Text(value, style: pw.TextStyle(fontSize: 7.5, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal))),
    ],
  );

  static pw.Widget _dashedLine() => pw.Row(
    children: List.generate(40, (i) => pw.Expanded(
      child: pw.Container(color: i % 2 == 0 ? PdfColors.black : PdfColors.white, height: 0.5),
    )),
  );

  static pw.Widget _a4AmountRow(String label, String value, {
    bool isBold = false,
    PdfColor? bgColor,
    PdfColor? valueColor,
  }) {
    return pw.Container(
      decoration: pw.BoxDecoration(
        color: bgColor,
        border: const pw.Border(bottom: pw.BorderSide(width: 0.3, color: PdfColors.grey300)),
      ),
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: const pw.TextStyle(fontSize: 8)),
          pw.Text(value, style: pw.TextStyle(fontSize: 8, fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal, color: valueColor)),
        ],
      ),
    );
  }

  // French Number to words translation logic
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
        if (num ~/ 100 == 1) {
          res += 'cent ';
        } else {
          res += '${ones[num ~/ 100]} cent ';
        }
        num = num % 100;
      }
      if (num >= 20) {
        int t = num ~/ 10;
        int o = num % 10;
        if (t == 7 || t == 9) {
          res += '${tens[t]}-';
          res += ones[10 + o];
        } else if (t == 8 && o == 0) {
          res += 'quatre-vingts';
        } else {
          res += tens[t];
          if (o > 0) res += '-${ones[o]}';
        }
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

    result = result.trim();
    if (result.isNotEmpty) {
      result = result[0].toUpperCase() + result.substring(1);
    }
    return '$result franc${n > 1 ? "s" : ""} CFA';
  }
}
