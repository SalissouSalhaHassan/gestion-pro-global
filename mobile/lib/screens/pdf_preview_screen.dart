import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:pdf/pdf.dart';
import 'dart:typed_data';
import 'dart:async'; // for FutureOr
import 'dart:io';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';

class PdfPreviewScreen extends StatefulWidget {
  final FutureOr<Uint8List> Function(PdfPageFormat)? buildPdf;
  final FutureOr<Uint8List> Function(PdfPageFormat, String mode)? buildPdfWithMode;
  final String invoiceRef;
  final PdfPageFormat? initialFormat;
  final String? title;
  final String initialMode; // 'Invoice' or 'BL'
  final bool enableModeToggle;

  const PdfPreviewScreen({
    super.key,
    this.buildPdf,
    this.buildPdfWithMode,
    required this.invoiceRef,
    this.initialFormat,
    this.title,
    this.initialMode = 'Invoice',
    this.enableModeToggle = false,
  }) : assert(buildPdf != null || buildPdfWithMode != null, 'Either buildPdf or buildPdfWithMode must be provided');

  @override
  State<PdfPreviewScreen> createState() => _PdfPreviewScreenState();
}

class _PdfPreviewScreenState extends State<PdfPreviewScreen> {
  late String _currentMode;

  @override
  void initState() {
    super.initState();
    _currentMode = widget.initialMode;
  }

  bool get _hasToggle => widget.enableModeToggle || widget.buildPdfWithMode != null;

  Future<Uint8List> _generatePdf(PdfPageFormat format) async {
    if (widget.buildPdfWithMode != null) {
      return await widget.buildPdfWithMode!(format, _currentMode);
    }
    return await widget.buildPdf!(format);
  }

  Future<void> _shareViaWhatsApp(BuildContext context) async {
    try {
      final bytes = await _generatePdf(PdfPageFormat.a4);
      final dir = await getTemporaryDirectory();
      final docLabel = _currentMode == 'BL' ? 'BL' : 'Facture';
      final filePath = "${dir.path}/${docLabel}_${widget.invoiceRef}.pdf";
      final file = File(filePath);
      await file.writeAsBytes(bytes, flush: true);

      final subject = _currentMode == 'BL'
          ? "Bon de Livraison ${widget.invoiceRef}"
          : "Facture ${widget.invoiceRef}";

      await Share.shareXFiles(
        [XFile(filePath)],
        text: subject,
        subject: subject,
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Erreur partage: $e")),
        );
      }
    }
  }

  Future<void> _exportPdf(
    BuildContext context,
    PdfPageFormat format,
    String label,
  ) async {
    try {
      final bytes = await _generatePdf(format);
      final dir = await getTemporaryDirectory();
      final docLabel = _currentMode == 'BL' ? 'BL' : 'Facture';
      final filePath = "${dir.path}/${docLabel}_${widget.invoiceRef}_$label.pdf";
      final file = File(filePath);
      await file.writeAsBytes(bytes, flush: true);

      final subject = _currentMode == 'BL'
          ? "Bon de Livraison ${widget.invoiceRef} ($label)"
          : "Facture ${widget.invoiceRef} ($label)";

      await Share.shareXFiles([XFile(filePath)], subject: subject);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Erreur export: $e")),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final String docTitle = widget.title ??
        (widget.invoiceRef.startsWith("BILAN")
            ? "Aperçu Rapport"
            : _currentMode == 'BL'
                ? "Bon de Livraison"
                : "Aperçu Facture");

    return Scaffold(
      appBar: AppBar(
        title: Text(
          "$docTitle - ${widget.invoiceRef}",
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        backgroundColor: const Color(0xFF4A00E0),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: "Partager",
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
      body: Column(
        children: [
          // MODE SWITCHER BANNER (Identical to Web Mode Selector)
          if (_hasToggle)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        if (_currentMode != 'Invoice') {
                          setState(() => _currentMode = 'Invoice');
                        }
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _currentMode == 'Invoice'
                              ? const Color(0xFF059669) // Emerald-600
                              : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: _currentMode == 'Invoice'
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFF059669).withOpacity(0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  )
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.receipt_long,
                              size: 18,
                              color: _currentMode == 'Invoice' ? Colors.white : Colors.slateGrey,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              "Facture de Vente",
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: _currentMode == 'Invoice' ? Colors.white : Colors.blueGrey.shade800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        if (_currentMode != 'BL') {
                          setState(() => _currentMode = 'BL');
                        }
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: _currentMode == 'BL'
                              ? const Color(0xFFEA580C) // Orange-600
                              : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: _currentMode == 'BL'
                              ? [
                                  BoxShadow(
                                    color: const Color(0xFFEA580C).withOpacity(0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 3),
                                  )
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.local_shipping_outlined,
                              size: 18,
                              color: _currentMode == 'BL' ? Colors.white : Colors.slateGrey,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              "Bon de Livraison",
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                                color: _currentMode == 'BL' ? Colors.white : Colors.blueGrey.shade800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // PDF PREVIEW
          Expanded(
            child: KeyedSubtree(
              key: ValueKey(_currentMode),
              child: PdfPreview(
                build: _generatePdf,
                allowPrinting: true,
                allowSharing: true,
                canChangePageFormat: true,
                initialPageFormat: widget.initialFormat ??
                    (widget.invoiceRef.startsWith("BILAN") ? PdfPageFormat.a4 : PdfPageFormat.a4),
                pdfFileName: "${_currentMode == 'BL' ? 'BL' : 'Facture'}_${widget.invoiceRef}.pdf",
                pageFormats: const {
                  "A4": PdfPageFormat.a4,
                  "A5": PdfPageFormat.a5,
                  "Ticket (80mm)": PdfPageFormat.roll80,
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

extension on Colors {
  static const Color slateGrey = Color(0xFF64748B);
}
