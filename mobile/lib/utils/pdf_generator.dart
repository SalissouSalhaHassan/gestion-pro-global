import 'dart:typed_data';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/company_model.dart';

class PdfInvoiceGenerator {
  static Future<Uint8List> generateInvoice({
    required CompanyInfo company,
    required String clientName,
    required List<Map<String, dynamic>> items,
    required double totalAmount,
    required String invoiceRef,
    required String sellerName,
    double? paidAmount, 
    String? location,
    List<dynamic> payments = const [], // NEW
    PdfPageFormat pageFormat = PdfPageFormat.roll80,
  }) async {
    final pdf = pw.Document();
    final now = DateTime.now();
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');
    final numberFormat = NumberFormat("#,##0", "fr_FR");

    final double paid = paidAmount ?? totalAmount;
    final double remaining = totalAmount - paid;
    
    // Check if it's a roll format (Thermal)
    bool isThermal = pageFormat.width < 300; // Roll80 is usually around 226 points

    pdf.addPage(
      pw.Page(
        pageFormat: pageFormat,
        margin: isThermal 
            ? const pw.EdgeInsets.all(5) 
            : const pw.EdgeInsets.all(20), // More margin for A4/A5
        build: (pw.Context context) {
          return pw.Column(
            crossAxisAlignment: isThermal ? pw.CrossAxisAlignment.center : pw.CrossAxisAlignment.start,
            mainAxisSize: pw.MainAxisSize.min,
            children: [
              // --- HEADER ---
              if (!isThermal) ...[
                // A4/A5 Header
                pw.Row(
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
                         pw.Text("RECU DE VENTE", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 20)),
                         pw.Text("N°: $invoiceRef"),
                         pw.Text("Date: ${dateFormat.format(now)}"),
                       ],
                     )
                   ]
                 ),
                 pw.SizedBox(height: 20),
                 pw.Row(
                   mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                   children: [
                     pw.Text("Vendeur: $sellerName"),
                     pw.Container(
                       padding: const pw.EdgeInsets.all(5),
                       decoration: pw.BoxDecoration(border: pw.Border.all()),
                       child: pw.Text("Client: $clientName", style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
                     ),
                   ]
                 ),
                 pw.SizedBox(height: 20),
              ] else ...[
                // Thermal Header (Improved Design)
                pw.Text(company.nom.toUpperCase(), style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18), textAlign: pw.TextAlign.center),
                pw.SizedBox(height: 4),
                
                // Combined City and Site line (Thermal)
                pw.Text("MARADI NIGER ${location?.toUpperCase() ?? ''}".trim(), 
                    style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12), textAlign: pw.TextAlign.center),
                pw.SizedBox(height: 4),

                if (company.adresse.isNotEmpty && company.adresse.toUpperCase() != "MARADI NIGER") ...[
                   pw.Text(company.adresse, style: const pw.TextStyle(fontSize: 10), textAlign: pw.TextAlign.center),
                   pw.SizedBox(height: 2),
                ],
                
                pw.Text("Tél: ${company.tel}", style: const pw.TextStyle(fontSize: 10), textAlign: pw.TextAlign.center),
                
                pw.SizedBox(height: 10),
                _buildDashedLine(),
                pw.SizedBox(height: 5),
                
                _buildInfoRow("Date:", dateFormat.format(now)),
                _buildInfoRow("Vendeur:", sellerName),
                _buildInfoRow("Client:", clientName.toUpperCase(), isBold: true),
                pw.SizedBox(height: 5),
                
                pw.Container(
                  padding: const pw.EdgeInsets.symmetric(vertical: 4, horizontal: 10), // More padding
                  decoration: pw.BoxDecoration(border: pw.Border.all(width: 1)),
                  child: pw.Text("N° REC: $invoiceRef", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12)),
                ),
                pw.SizedBox(height: 8),
                _buildDashedLine(),
              ],

              // --- TABLE ---
              pw.SizedBox(height: 10),
              pw.Table(
                columnWidths: isThermal 
                    ? {
                        0: const pw.FlexColumnWidth(3.5),
                        1: const pw.FlexColumnWidth(1),
                        2: const pw.FlexColumnWidth(1.5),
                        3: const pw.FlexColumnWidth(1.8),
                      }
                    : {
                        0: const pw.FlexColumnWidth(4),
                        1: const pw.FlexColumnWidth(1),
                        2: const pw.FlexColumnWidth(2),
                        3: const pw.FlexColumnWidth(2),
                      },
                border: !isThermal ? pw.TableBorder.all() : null, // Border for A4/A5
                children: [
                  pw.TableRow(
                    decoration: isThermal ? const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 0.5))) : const pw.BoxDecoration(color: PdfColors.grey300),
                    children: [
                      _buildCell("Désignation", isBold: true, align: pw.TextAlign.left, padding: !isThermal),
                      _buildCell("Qte", isBold: true, align: pw.TextAlign.center, padding: !isThermal),
                      _buildCell("Prix", isBold: true, align: pw.TextAlign.right, padding: !isThermal),
                      _buildCell("Total", isBold: true, align: pw.TextAlign.right, padding: !isThermal),
                    ],
                  ),
                  ...items.map((item) {
                    final double price = (item['price'] as num?)?.toDouble() ?? 0;
                    final int qty = (item['quantity'] as num?)?.toInt() ?? 1;
                    final double totalItem = price * qty;
                    return pw.TableRow(
                      children: [
                         _buildCell(item['name'], align: pw.TextAlign.left, padding: !isThermal),
                         _buildCell("$qty", align: pw.TextAlign.center, padding: !isThermal),
                         _buildCell(numberFormat.format(price), align: pw.TextAlign.right, padding: !isThermal),
                         _buildCell(numberFormat.format(totalItem), align: pw.TextAlign.right, padding: !isThermal),
                      ],
                    );
                  }).toList(),
                ],
              ),
              
              pw.SizedBox(height: 10),
              // --- TOTALS ---
              if (!isThermal) ...[
                 pw.Row(
                   mainAxisAlignment: pw.MainAxisAlignment.end,
                   children: [
                     pw.Container(
                       width: 200,
                       child: pw.Table(
                         border: pw.TableBorder.all(),
                         children: [
                           pw.TableRow(children: [pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text("TOTAL GÉNÉRAL", style: pw.TextStyle(fontWeight: pw.FontWeight.bold))), pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text("${numberFormat.format(totalAmount)} CFA", textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)))]),
                           pw.TableRow(children: [pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text("Montant Payé")), pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text("${numberFormat.format(paid)} CFA", textAlign: pw.TextAlign.right))]),
                           pw.TableRow(children: [pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text("Reste à Payer", style: pw.TextStyle(fontWeight: pw.FontWeight.bold))), pw.Padding(padding: const pw.EdgeInsets.all(5), child: pw.Text("${numberFormat.format(remaining)} CFA", textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold)))]),
                         ]
                       )
                     )
                   ]
                 ),

                 // --- HISTORY TABLE (A4/A5) ---
                  if (payments.isNotEmpty) ...[
                    pw.SizedBox(height: 20),
                    pw.Text("Historique des Versements", 
                      style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12, decoration: pw.TextDecoration.underline)),
                    pw.SizedBox(height: 8),
                    pw.Table(
                        border: pw.TableBorder.all(width: 0.5, color: PdfColors.grey400),
                        columnWidths: {
                            0: const pw.FlexColumnWidth(2),
                            1: const pw.FlexColumnWidth(2),
                            2: const pw.FlexColumnWidth(1.2),
                        },
                        children: [
                            pw.TableRow(
                                decoration: const pw.BoxDecoration(color: PdfColors.grey100),
                                children: [
                                    pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text("Date", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10))),
                                    pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text("Mode", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10))),
                                    pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text("Montant", textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10))),
                                ]
                            ),
                            ...payments.map((p) => pw.TableRow(
                                children: [
                                    pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(p['date'] ?? '', style: const pw.TextStyle(fontSize: 9))),
                                    pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text(p['method'] ?? '', style: const pw.TextStyle(fontSize: 9))),
                                    pw.Padding(padding: const pw.EdgeInsets.all(6), child: pw.Text("${numberFormat.format((p['amount'] as num?)?.toDouble() ?? 0)}", textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9))),
                                ]
                            ))
                        ]
                    )
                  ],

                 pw.Spacer(),
                 pw.Divider(), 
                 pw.Text("Merci de votre visite !", style: pw.TextStyle(fontStyle: pw.FontStyle.italic), textAlign: pw.TextAlign.center),
                 pw.Text("Software by GestionPro", style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey), textAlign: pw.TextAlign.center),
              ] else ...[
                 // Thermal Totals (Existing)
                 _buildDashedLine(),
                 pw.SizedBox(height: 5),
                 pw.Container(
                    width: double.infinity,
                    padding: const pw.EdgeInsets.all(5),
                    decoration: pw.BoxDecoration(border: pw.Border.all(width: 0.5), color: PdfColors.grey100),
                    child: pw.Column(children: [
                        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [pw.Text("TOTAL GÉNÉRAL:", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)), pw.Text("${numberFormat.format(totalAmount)} CFA", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 12))]),
                        pw.SizedBox(height: 2),
                        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [pw.Text("Montant Payé:", style: const pw.TextStyle(fontSize: 10)), pw.Text("${numberFormat.format(paid)} CFA", style: const pw.TextStyle(fontSize: 10))]),
                        pw.SizedBox(height: 2),
                        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [pw.Text("Reste à Payer:", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10)), pw.Text("${numberFormat.format(remaining)} CFA", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10))]),
                    ])
                 ),
                 
                 // --- HISTORY FOR THERMAL (Improved Design) ---
                 if (payments.isNotEmpty) ...[
                    pw.SizedBox(height: 12),
                    pw.Text("HISTORIQUE PAIEMENTS", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9, decoration: pw.TextDecoration.underline)),
                    pw.SizedBox(height: 4),
                    pw.Table(
                      columnWidths: {
                        0: const pw.FlexColumnWidth(2.5),
                        1: const pw.FlexColumnWidth(1.2),
                      },
                      children: [
                        pw.TableRow(
                          decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(width: 0.5, style: pw.BorderStyle.dashed))),
                          children: [
                            pw.Padding(padding: const pw.EdgeInsets.symmetric(vertical: 2), child: pw.Text("Date / Mode", style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
                            pw.Padding(padding: const pw.EdgeInsets.symmetric(vertical: 2), child: pw.Text("Montant", textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
                          ]
                        ),
                        ...payments.map((p) => pw.TableRow(
                          children: [
                            pw.Padding(padding: const pw.EdgeInsets.symmetric(vertical: 2), child: pw.Text("${p['date']} - ${p['method']}", style: const pw.TextStyle(fontSize: 8))),
                            pw.Padding(padding: const pw.EdgeInsets.symmetric(vertical: 2), child: pw.Text("${numberFormat.format((p['amount'] as num?)?.toDouble() ?? 0)}", textAlign: pw.TextAlign.right, style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 8))),
                          ]
                        )).toList(),
                      ]
                    ),
                 ],

                 pw.SizedBox(height: 5),
                 pw.Text("${items.length} Article(s)", style: const pw.TextStyle(fontSize: 9)),
                 pw.SizedBox(height: 10),
                 pw.Divider(thickness: 1),
                 pw.Text("Merci de votre visite !", style: pw.TextStyle(fontStyle: pw.FontStyle.italic, fontSize: 10)),
                 pw.SizedBox(height: 8),
                 pw.BarcodeWidget(barcode: pw.Barcode.code128(), data: invoiceRef, width: 150, height: 40, drawText: false),
                 pw.SizedBox(height: 2),
                 pw.Text("Software by GestionPro", style: const pw.TextStyle(fontSize: 6)),
              ]
            ],
          );
        },
      ),
    );

    return pdf.save();
  }

  static pw.Widget _buildCell(String text, {bool isBold = false, pw.TextAlign align = pw.TextAlign.left, bool padding = false}) {
    return pw.Padding(
      padding: padding ? const pw.EdgeInsets.all(5) : const pw.EdgeInsets.symmetric(vertical: 2),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: padding ? 10 : 8,
          fontWeight: isBold ? pw.FontWeight.bold : null,
        ),
        textAlign: align,
      ),
    );
  }

  // Helper لرسم سطر معلومات
  static pw.Widget _buildInfoRow(
    String label,
    String value, {
    bool isBold = false,
  }) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(
          label,
          style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold),
        ),
        pw.Text(
          value,
          style: pw.TextStyle(
            fontSize: 9,
            fontWeight: isBold ? pw.FontWeight.bold : null,
          ),
        ),
      ],
    );
  }

  // Helper لرسم خط متقطع
  static pw.Widget _buildDashedLine() {
    return pw.Row(
      children: List.generate(
        25,
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
