import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'dart:typed_data';
import 'dart:async'; // for FutureOr
import 'dart:io';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';

class PdfPreviewScreen extends StatelessWidget {
  final FutureOr<Uint8List> Function(PdfPageFormat) buildPdf;
  final String invoiceRef;

  final PdfPageFormat? initialFormat;
  final String? title;

  const PdfPreviewScreen({
    super.key,
    required this.buildPdf,
    required this.invoiceRef,
    this.initialFormat,
    this.title,
  });

  Future<void> _shareViaWhatsApp(BuildContext context) async {
    try {
      final bytes = await buildPdf(PdfPageFormat.a4);
      final dir = await getTemporaryDirectory();
      final filePath = "${dir.path}/Facture_$invoiceRef.pdf";
      final file = File(filePath);
      await file.writeAsBytes(bytes, flush: true);
      await Share.shareXFiles(
        [XFile(filePath)],
        text: "Facture $invoiceRef",
        subject: "Facture $invoiceRef",
      );
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Erreur partage: $e")));
    }
  }

  Future<void> _exportPdf(
    BuildContext context,
    PdfPageFormat format,
    String label,
  ) async {
    try {
      final bytes = await buildPdf(format);
      final dir = await getTemporaryDirectory();
      final filePath = "${dir.path}/Facture_${invoiceRef}_$label.pdf";
      final file = File(filePath);
      await file.writeAsBytes(bytes, flush: true);
      await Share.shareXFiles([
        XFile(filePath),
      ], subject: "Facture $invoiceRef ($label)");
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Erreur export: $e")));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title ?? (invoiceRef.startsWith("BILAN") ? "Aperçu Rapport" : "Aperçu Facture")),
        backgroundColor: const Color(0xFF4A00E0),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: "Partager via WhatsApp",
            icon: const Icon(Icons.share),
            onPressed: () => _shareViaWhatsApp(context),
          ),
          PopupMenuButton<String>(
            tooltip: "Exporter PDF",
            onSelected: (value) async {
              if (value == "A4") {
                await _exportPdf(context, PdfPageFormat.a4, "A4");
              } else if (value == "A5") {
                await _exportPdf(context, PdfPageFormat.a5, "A5");
              } else if (value == "Ticket") {
                await _exportPdf(context, PdfPageFormat.roll80, "Ticket");
              }
            },
            itemBuilder: (ctx) => const [
              PopupMenuItem(value: "A4", child: Text("A4")),
              PopupMenuItem(value: "A5", child: Text("A5")),
              PopupMenuItem(value: "Ticket", child: Text("Ticket (80mm)")),
            ],
            icon: const Icon(Icons.download),
          ),
        ],
      ),
      body: PdfPreview(
        build: buildPdf,
        allowPrinting: true,
        allowSharing: true,
        canChangePageFormat: true,
        initialPageFormat: initialFormat ?? (invoiceRef.startsWith("BILAN") ? PdfPageFormat.a4 : PdfPageFormat.roll80),
        pdfFileName: "${invoiceRef.startsWith("BILAN") ? "Report" : "Facture"}_$invoiceRef.pdf",
        pageFormats: const {
          "Ticket (80mm)": PdfPageFormat.roll80,
          "A5": PdfPageFormat.a5,
          "A4": PdfPageFormat.a4,
        },
      ),
    );
  }
}
