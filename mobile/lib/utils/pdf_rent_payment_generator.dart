import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';
import '../models/contract_model.dart';
import '../models/rent_payment_model.dart';

class PdfRentPaymentGenerator {
  static Future<Uint8List> generateReceipt({
    required CompanyInfo company,
    required Contract contract,
    required RentPayment payment,
    required String createdBy,
    String? location,
    PdfPageFormat pageFormat = PdfPageFormat.a4,
  }) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat('#,##0.00', 'fr_FR');
    final dateFormat = DateFormat('dd/MM/yyyy');

    bool isThermal = pageFormat.width < 300;

    String formattedDate = payment.datePaiement;
    try {
      final parsed = DateTime.parse(payment.datePaiement);
      formattedDate = dateFormat.format(parsed);
    } catch (_) {}

    String formattedPeriod = "";
    if (payment.periodeDebut != null && payment.periodeFin != null) {
      try {
        final start = DateTime.parse(payment.periodeDebut!);
        final end = DateTime.parse(payment.periodeFin!);
        formattedPeriod = "${dateFormat.format(start)} au ${dateFormat.format(end)}";
      } catch (_) {
        formattedPeriod = "${payment.periodeDebut} au ${payment.periodeFin}";
      }
    }

    String amountInWords = _numberToWords(payment.montant);

    if (isThermal) {
      // ===== THERMAL LAYOUT =====
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
            pw.Text('REÇU DE LOYER', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 13)),
            pw.Text('Réf: LOY-PAY-${payment.id}', style: const pw.TextStyle(fontSize: 8)),
            pw.SizedBox(height: 6),
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(5),
              decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5)),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  _infoRow('Date Payé:', formattedDate),
                  pw.SizedBox(height: 2),
                  _infoRow('Locataire:', contract.locataireNomComplet, bold: true),
                  pw.SizedBox(height: 2),
                  _infoRow('Bien Loué:', contract.bienLoueDetails),
                  pw.SizedBox(height: 2),
                  _infoRow('Période:', formattedPeriod.isNotEmpty ? formattedPeriod : (payment.nomDeMois ?? "-")),
                  pw.SizedBox(height: 2),
                  _infoRow('Mode:', payment.modePaiement),
                  pw.SizedBox(height: 2),
                  _infoRow('Reçu par:', createdBy),
                ],
              ),
            ),
            pw.SizedBox(height: 6),
            pw.Text('MONTANT ENCAISSÉ', style: const pw.TextStyle(fontSize: 8)),
            pw.Text('${numberFormat.format(payment.montant)} FCFA', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
            pw.SizedBox(height: 6),
            _dashedLine(),
            pw.SizedBox(height: 4),
            pw.Container(
              width: double.infinity,
              padding: const pw.EdgeInsets.all(5),
              decoration: const pw.BoxDecoration(color: PdfColors.grey200),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  _infoRow('Loyer Mensuel:', '${numberFormat.format(contract.loyerMensuel)} FCFA'),
                  pw.SizedBox(height: 1),
                  _infoRow('Total Versé:', '${numberFormat.format(contract.totalPaye)} FCFA'),
                  pw.SizedBox(height: 1),
                  _infoRow('Dette Restante:', '${numberFormat.format(contract.retards)} FCFA', bold: contract.retards > 0),
                  pw.SizedBox(height: 1),
                  _infoRow('Échéance:', contract.echeance),
                ],
              ),
            ),
            pw.SizedBox(height: 10),
            _dashedLine(),
            pw.SizedBox(height: 6),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('Signature Locataire', style: const pw.TextStyle(fontSize: 7)),
                pw.Text('Signature Caissier', style: const pw.TextStyle(fontSize: 7)),
              ],
            ),
            pw.SizedBox(height: 12),
            pw.BarcodeWidget(barcode: pw.Barcode.qrCode(), data: "LOY-PAY-${payment.id}-${contract.id}", width: 40, height: 40),
            pw.SizedBox(height: 4),
            pw.Text('MERCI DE VOTRE CONFIANCE', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7), textAlign: pw.TextAlign.center),
          ],
        ),
      ));
    } else {
      // ===== A4 LAYOUT =====
      pdf.addPage(pw.MultiPage(
        pageFormat: pageFormat,
        margin: const pw.EdgeInsets.symmetric(horizontal: 25, vertical: 25),
        build: (ctx) => [
          // Header
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

          // Title
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            crossAxisAlignment: pw.CrossAxisAlignment.end,
            children: [
              pw.Text('QUITTANCE DE LOYER / REÇU DE PAIEMENT', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 16)),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Date : $formattedDate', style: const pw.TextStyle(fontSize: 9)),
                  pw.Text('Reçu N° : LOY-PAY-${payment.id}', style: const pw.TextStyle(fontSize: 9)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 14),

          // Contract and Tenant details
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Container(
                  padding: const pw.EdgeInsets.all(10),
                  decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5, color: PdfColors.grey400), borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6))),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('BAILLEUR / AGENCE', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.indigo700)),
                      pw.SizedBox(height: 4),
                      pw.Text(company.nom, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                      pw.Text(company.adresse, style: const pw.TextStyle(fontSize: 9)),
                      pw.Text('Tél: ${company.tel}', style: const pw.TextStyle(fontSize: 9)),
                    ],
                  ),
                ),
              ),
              pw.SizedBox(width: 15),
              pw.Expanded(
                child: pw.Container(
                  padding: const pw.EdgeInsets.all(10),
                  decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5, color: PdfColors.grey400), borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6))),
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('LOCATAIRE', style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.indigo700)),
                      pw.SizedBox(height: 4),
                      pw.Text(contract.locataireNomComplet, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
                      pw.Text('Réf: ${contract.refLocataire}', style: const pw.TextStyle(fontSize: 9)),
                      if (contract.locataireTelephone != null) pw.Text('Tél: ${contract.locataireTelephone}', style: const pw.TextStyle(fontSize: 9)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 14),

          // Receipt details
          pw.Container(
            width: double.infinity,
            padding: const pw.EdgeInsets.all(10),
            decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5, color: PdfColors.grey400)),
            child: pw.Column(
              children: [
                _a4Row('Bien Loué :', contract.bienLoueDetails),
                _a4Row('Quartier / Localisation :', contract.quartier ?? "-"),
                _a4Row('Période d\'occupation correspondante :', formattedPeriod.isNotEmpty ? formattedPeriod : (payment.nomDeMois ?? "-"), isBold: true),
                _a4Row('Mode de règlement :', payment.modePaiement),
                _a4Row('Commentaire / Note :', payment.description ?? "-"),
              ],
            ),
          ),
          pw.SizedBox(height: 14),

          // Amounts Box
          pw.Container(
            width: double.infinity,
            decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5, color: PdfColors.grey400)),
            child: pw.Column(
              children: [
                _a4AmountRow('Montant Encaissé (Loyer payé):', '${numberFormat.format(payment.montant)} FCFA', isBold: true, isHeader: true, bgColor: PdfColors.grey100),
                _a4AmountRow('Loyer Mensuel Contractuel:', '${numberFormat.format(contract.loyerMensuel)} FCFA'),
                _a4AmountRow('Total Cumulé Payé à ce jour:', '${numberFormat.format(contract.totalPaye)} FCFA'),
                _a4AmountRow('Retards / Dette restante du locataire:', '${numberFormat.format(contract.retards)} FCFA', valueColor: contract.retards > 0 ? PdfColors.red800 : PdfColors.green800),
                _a4AmountRow('Prochaine Échéance de paiement:', contract.echeance, isBold: true),
              ],
            ),
          ),
          pw.SizedBox(height: 12),

          // Arrêté à la somme de
          pw.Text(
            'Arrêté le présent reçu à la somme de : $amountInWords.',
            style: pw.TextStyle(fontSize: 9, fontStyle: pw.FontStyle.italic),
          ),
          pw.SizedBox(height: 30),

          // Signatures
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text('Signature du Billeteur / Caissier', style: const pw.TextStyle(fontSize: 9, decoration: pw.TextDecoration.underline)),
                  pw.SizedBox(height: 50),
                  pw.Container(width: 140, height: 0.5, color: PdfColors.black),
                  pw.Text(createdBy, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Signature du Locataire', style: const pw.TextStyle(fontSize: 9, decoration: pw.TextDecoration.underline)),
                  pw.SizedBox(height: 50),
                  pw.Container(width: 140, height: 0.5, color: PdfColors.black),
                  pw.Text(contract.locataireNomComplet, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
                ],
              ),
            ],
          ),
        ],
      ));
    }

    return pdf.save();
  }

  // Info Row for Thermal
  static pw.Widget _infoRow(String label, String value, {bool bold = false}) => pw.Row(
    crossAxisAlignment: pw.CrossAxisAlignment.start,
    children: [
      pw.SizedBox(width: 65, child: pw.Text(label, style: const pw.TextStyle(fontSize: 9))),
      pw.Expanded(child: pw.Text(value, style: pw.TextStyle(fontSize: 9, fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal))),
    ],
  );

  // Dashed line for Thermal
  static pw.Widget _dashedLine() => pw.Row(
    children: List.generate(30, (i) => pw.Expanded(
      child: pw.Container(color: i % 2 == 0 ? PdfColors.black : PdfColors.white, height: 0.5),
    )),
  );

  // A4 Row
  static pw.Widget _a4Row(String label, String value, {bool isBold = false}) => pw.Padding(
    padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    child: pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.SizedBox(width: 180, child: pw.Text(label, style: const pw.TextStyle(fontSize: 9))),
        pw.Expanded(child: pw.Text(value, style: pw.TextStyle(fontSize: 9, fontWeight: isBold ? pw.FontWeight.bold : pw.FontWeight.normal))),
      ],
    ),
  );

  // A4 Amount Row
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

  // Simple number to words in French
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

    result = result.trim();
    if (result.isNotEmpty) result = result[0].toUpperCase() + result.substring(1);
    return '$result franc${n > 1 ? "s" : ""} CFA';
  }

  static Future<Uint8List> generateRentReport({
    required CompanyInfo company,
    required List<Contract> contracts,
    required String createdBy,
    PdfPageFormat pageFormat = PdfPageFormat.a4,
  }) async {
    final pdf = pw.Document();
    final numberFormat = NumberFormat('#,##0', 'fr_FR');
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    // Group contracts by bienLoueDetails
    final Map<String, List<Contract>> grouped = {};
    for (var c in contracts) {
      final key = c.bienLoueDetails.trim().isEmpty ? "Autre" : c.bienLoueDetails.trim();
      grouped.putIfAbsent(key, () => []).add(c);
    }

    final double totalMonthly = contracts.fold(0.0, (sum, c) => sum + c.loyerMensuel);
    final double totalUnpaid = contracts.fold(0.0, (sum, c) => sum + c.retards);

    pdf.addPage(pw.MultiPage(
      pageFormat: pageFormat,
      margin: const pw.EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      build: (ctx) => [
        // Company and date header
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
                if (company.adresse.isNotEmpty) pw.Text(company.adresse, style: const pw.TextStyle(fontSize: 8)),
                pw.Text('Tél: ${company.tel}', style: const pw.TextStyle(fontSize: 8)),
              ],
            ),
            pw.Text(
              "Imprimé le ${dateFormat.format(DateTime.now())}",
              style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600),
            ),
          ],
        ),
        pw.Divider(thickness: 1),
        pw.SizedBox(height: 6),

        // Report Title
        pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.all(8),
          decoration: pw.BoxDecoration(
            border: pw.Border.all(width: 1),
            color: PdfColors.grey200,
          ),
          child: pw.Center(
            child: pw.Text(
              "ÉTAT DES LOCATAIRES — LISTE GÉNÉRALE",
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12, letterSpacing: 1.5),
            ),
          ),
        ),
        pw.SizedBox(height: 12),

        // Grouped tables
        ...grouped.entries.map((entry) {
          final bienName = entry.key;
          final list = entry.value;
          final double subtotal = list.fold(0.0, (sum, c) => sum + c.loyerMensuel);
          final int unpaidCount = list.where((c) => c.retards > 0).length;

          return pw.Container(
            margin: const pw.EdgeInsets.only(bottom: 15),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(
                  "Liste de ${list[0].typeBien ?? 'biens'}s — $bienName ${list[0].quartier != null ? '(${list[0].quartier})' : ''}",
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10, decoration: pw.TextDecoration.underline),
                ),
                pw.SizedBox(height: 4),
                pw.Table(
                  border: pw.TableBorder.all(width: 0.5, color: PdfColors.black),
                  columnWidths: const {
                    0: pw.FixedColumnWidth(25),
                    1: pw.FlexColumnWidth(),
                    2: pw.FixedColumnWidth(90),
                    3: pw.FixedColumnWidth(90),
                  },
                  children: [
                    // Table Header
                    pw.TableRow(
                      decoration: const pw.BoxDecoration(color: PdfColors.blue100),
                      children: [
                        pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Center(child: pw.Text("N°", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                        pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Text("Noms", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
                        pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text("Prix (F)", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                        pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Center(child: pw.Text("Contacts", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)))),
                      ],
                    ),
                    // Table Rows
                    ...List.generate(list.length, (idx) {
                      final c = list[idx];
                      final isLate = c.retards > 0;
                      return pw.TableRow(
                        children: [
                          pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Center(child: pw.Text("${idx + 1}", style: pw.TextStyle(fontSize: 8)))),
                          pw.Padding(
                            padding: const pw.EdgeInsets.all(4),
                            child: pw.Text(
                              c.locataireNomComplet + (c.statut == "Expiré" ? " [EXPIRÉ]" : ""),
                              style: pw.TextStyle(
                                fontSize: 8,
                                fontWeight: pw.FontWeight.bold,
                                color: isLate ? PdfColors.red800 : PdfColors.black,
                              ),
                            ),
                          ),
                          pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Align(alignment: pw.Alignment.centerRight, child: pw.Text(numberFormat.format(c.loyerMensuel), style: pw.TextStyle(fontSize: 8, color: isLate ? PdfColors.red800 : PdfColors.black)))),
                          pw.Padding(padding: const pw.EdgeInsets.all(4), child: pw.Center(child: pw.Text(c.locataireTelephone ?? "", style: pw.TextStyle(fontSize: 8)))),
                        ],
                      );
                    }),
                    // Subtotal
                    pw.TableRow(
                      decoration: const pw.BoxDecoration(color: PdfColors.grey100),
                      children: [
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(4),
                          child: pw.Container(),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(4),
                          child: pw.Align(
                            alignment: pw.Alignment.centerRight,
                            child: pw.Text("Sous-total (${list.length} locataire${list.length > 1 ? 's' : ''})", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
                          ),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(4),
                          child: pw.Align(
                            alignment: pw.Alignment.centerRight,
                            child: pw.Text(numberFormat.format(subtotal), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
                          ),
                        ),
                        pw.Padding(
                          padding: const pw.EdgeInsets.all(4),
                          child: pw.Center(
                            child: pw.Text(
                              unpaidCount > 0 ? "$unpaidCount impayé(s)" : "✓ À jour",
                              style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 7, color: unpaidCount > 0 ? PdfColors.red800 : PdfColors.green800),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          );
        }),
        pw.SizedBox(height: 10),

        // Global summary
        pw.Container(
          decoration: pw.BoxDecoration(border: pw.Border.all(width: 1)),
          child: pw.Column(
            children: [
              pw.Container(
                width: double.infinity,
                padding: const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                color: PdfColors.grey200,
                child: pw.Text("RÉCAPITULATIF GÉNÉRAL", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8)),
              ),
              pw.Row(
                children: [
                  pw.Expanded(
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(8),
                      child: pw.Column(
                        children: [
                          pw.Text("Total Locataires", style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey600)),
                          pw.SizedBox(height: 2),
                          pw.Text("${contracts.length}", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
                  pw.Container(width: 0.5, height: 35, color: PdfColors.black),
                  pw.Expanded(
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(8),
                      child: pw.Column(
                        children: [
                          pw.Text("Total Loyers / Mois", style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey600)),
                          pw.SizedBox(height: 2),
                          pw.Text("${numberFormat.format(totalMonthly)} F", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12)),
                        ],
                      ),
                    ),
                  ),
                  pw.Container(width: 0.5, height: 35, color: PdfColors.black),
                  pw.Expanded(
                    child: pw.Container(
                      padding: const pw.EdgeInsets.all(8),
                      child: pw.Column(
                        children: [
                          pw.Text("Total Impayés", style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey600)),
                          pw.SizedBox(height: 2),
                          pw.Text(
                            "${numberFormat.format(totalUnpaid)} F",
                            style: pw.TextStyle(
                              fontWeight: pw.FontWeight.bold,
                              fontSize: 12,
                              color: totalUnpaid > 0 ? PdfColors.red800 : PdfColors.green800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 15),

        // Footer
        pw.Center(
          child: pw.Text(
            "Document de Gestion Interne • Généré par Caissier",
            style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey500),
          ),
        ),
      ],
    ));

    return pdf.save();
  }
}
