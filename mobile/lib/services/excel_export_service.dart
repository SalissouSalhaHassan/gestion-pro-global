import 'dart:io';
import 'package:excel/excel.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter/material.dart';

class ExcelExportService {
  /// Export products list to Excel
  static Future<void> exportProducts(
    List<Map<String, dynamic>> products,
    BuildContext context,
  ) async {
    try {
      var excel = Excel.createExcel();
      Sheet sheet = excel['Produits'];

      // Header row
      sheet.appendRow([
        TextCellValue('Référence'),
        TextCellValue('Désignation'),
        TextCellValue('Prix Achat'),
        TextCellValue('Prix Vente'),
        TextCellValue('Quantité'),
      ]);

      // Style header
      for (int i = 0; i < 5; i++) {
        sheet
            .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0))
            .cellStyle = CellStyle(
          bold: true,
          backgroundColorHex: ExcelColor.fromHexString('#4A00E0'),
          fontColorHex: ExcelColor.white,
        );
      }

      // Data rows
      for (var product in products) {
        sheet.appendRow([
          TextCellValue(product['reference']?.toString() ?? ''),
          TextCellValue(product['designation']?.toString() ?? ''),
          DoubleCellValue((product['prix_achat'] ?? 0).toDouble()),
          DoubleCellValue((product['prix_vente'] ?? 0).toDouble()),
          IntCellValue((product['quantite'] ?? 0).toInt()),
        ]);
      }

      await _saveAndShare(
        excel,
        'produits_${DateTime.now().millisecondsSinceEpoch}.xlsx',
        context,
      );
    } catch (e) {
      if (!context.mounted) return;
      _showError(context, e.toString());
    }
  }

  /// Export invoices list to Excel
  static Future<void> exportInvoices(
    List<Map<String, dynamic>> invoices,
    BuildContext context,
  ) async {
    try {
      var excel = Excel.createExcel();
      Sheet sheet = excel['Factures'];

      // Header row
      sheet.appendRow([
        TextCellValue('N° Facture'),
        TextCellValue('Date'),
        TextCellValue('Client'),
        TextCellValue('Total'),
        TextCellValue('Statut'),
      ]);

      // Style header
      for (int i = 0; i < 5; i++) {
        sheet
            .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0))
            .cellStyle = CellStyle(
          bold: true,
          backgroundColorHex: ExcelColor.fromHexString('#4A00E0'),
          fontColorHex: ExcelColor.white,
        );
      }

      // Data rows
      for (var invoice in invoices) {
        sheet.appendRow([
          TextCellValue(invoice['numero']?.toString() ?? ''),
          TextCellValue(invoice['date']?.toString() ?? ''),
          TextCellValue(invoice['client_nom']?.toString() ?? ''),
          DoubleCellValue((invoice['total'] ?? 0).toDouble()),
          TextCellValue(invoice['statut']?.toString() ?? ''),
        ]);
      }

      await _saveAndShare(
        excel,
        'factures_${DateTime.now().millisecondsSinceEpoch}.xlsx',
        context,
      );
    } catch (e) {
      if (!context.mounted) return;
      _showError(context, e.toString());
    }
  }

  /// Export clients list to Excel
  static Future<void> exportClients(
    List<Map<String, dynamic>> clients,
    BuildContext context,
  ) async {
    try {
      var excel = Excel.createExcel();
      Sheet sheet = excel['Clients'];

      // Header row
      sheet.appendRow([
        TextCellValue('Nom'),
        TextCellValue('Téléphone'),
        TextCellValue('Adresse'),
        TextCellValue('Solde'),
      ]);

      // Style header
      for (int i = 0; i < 4; i++) {
        sheet
            .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0))
            .cellStyle = CellStyle(
          bold: true,
          backgroundColorHex: ExcelColor.fromHexString('#4A00E0'),
          fontColorHex: ExcelColor.white,
        );
      }

      // Data rows
      for (var client in clients) {
        sheet.appendRow([
          TextCellValue(client['nom']?.toString() ?? ''),
          TextCellValue(client['telephone']?.toString() ?? ''),
          TextCellValue(client['adresse']?.toString() ?? ''),
          DoubleCellValue((client['solde'] ?? 0).toDouble()),
        ]);
      }

      await _saveAndShare(
        excel,
        'clients_${DateTime.now().millisecondsSinceEpoch}.xlsx',
        context,
      );
    } catch (e) {
      if (!context.mounted) return;
      _showError(context, e.toString());
    }
  }

  /// Export users list to Excel
  static Future<void> exportUsers(
    List<Map<String, dynamic>> users,
    BuildContext context,
  ) async {
    try {
      var excel = Excel.createExcel();
      Sheet sheet = excel['Utilisateurs'];
      sheet.appendRow([
        TextCellValue('Nom d’utilisateur'),
        TextCellValue('Rôle'),
      ]);
      for (int i = 0; i < 2; i++) {
        sheet
            .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0))
            .cellStyle = CellStyle(
          bold: true,
          backgroundColorHex: ExcelColor.fromHexString('#4A00E0'),
          fontColorHex: ExcelColor.white,
        );
      }
      for (var u in users) {
        sheet.appendRow([
          TextCellValue(u['username']?.toString() ?? ''),
          TextCellValue(u['role']?.toString() ?? ''),
        ]);
      }
      await _saveAndShare(
        excel,
        'utilisateurs_${DateTime.now().millisecondsSinceEpoch}.xlsx',
        context,
      );
    } catch (e) {
      if (!context.mounted) return;
      _showError(context, e.toString());
    }
  }

  /// Export cash report to Excel
  static Future<void> exportCashReport(
    Map<String, dynamic> report,
    BuildContext context, {
    String title = 'Bilan',
  }) async {
    try {
      var excel = Excel.createExcel();
      Sheet resume = excel['Résumé'];
      resume.appendRow([
        TextCellValue('Titre'),
        TextCellValue('Total Recettes'),
        TextCellValue('Total Dépenses'),
        TextCellValue('Solde'),
      ]);
      for (int i = 0; i < 4; i++) {
        resume
            .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0))
            .cellStyle = CellStyle(
          bold: true,
          backgroundColorHex: ExcelColor.fromHexString('#4A00E0'),
          fontColorHex: ExcelColor.white,
        );
      }
      resume.appendRow([
        TextCellValue(title),
        DoubleCellValue((report['total_recettes'] ?? 0).toDouble()),
        DoubleCellValue((report['total_depenses'] ?? 0).toDouble()),
        DoubleCellValue((report['solde'] ?? 0).toDouble()),
      ]);

      Sheet recSheet = excel['Recettes'];
      recSheet.appendRow([
        TextCellValue('Date'),
        TextCellValue('Type'),
        TextCellValue('Montant'),
        TextCellValue('Client'),
        TextCellValue('Utilisateur'),
      ]);
      for (int i = 0; i < 5; i++) {
        recSheet
            .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0))
            .cellStyle = CellStyle(
          bold: true,
          backgroundColorHex: ExcelColor.fromHexString('#4A00E0'),
          fontColorHex: ExcelColor.white,
        );
      }
      final recettes = List<Map<String, dynamic>>.from(
        report['recettes_list'] ?? [],
      );
      for (final r in recettes) {
        recSheet.appendRow([
          TextCellValue(r['date']?.toString() ?? ''),
          TextCellValue(r['type']?.toString() ?? ''),
          DoubleCellValue((r['montant'] ?? 0).toDouble()),
          TextCellValue(r['client']?.toString() ?? ''),
          TextCellValue(r['user']?.toString() ?? ''),
        ]);
      }

      Sheet depSheet = excel['Dépenses'];
      depSheet.appendRow([
        TextCellValue('Date'),
        TextCellValue('Libellé'),
        TextCellValue('Montant'),
        TextCellValue('Opérateur'),
        TextCellValue('Autorisé par'),
      ]);
      for (int i = 0; i < 5; i++) {
        depSheet
            .cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0))
            .cellStyle = CellStyle(
          bold: true,
          backgroundColorHex: ExcelColor.fromHexString('#4A00E0'),
          fontColorHex: ExcelColor.white,
        );
      }
      final depenses = List<Map<String, dynamic>>.from(
        report['depenses_list'] ?? [],
      );
      for (final d in depenses) {
        depSheet.appendRow([
          TextCellValue(d['date_depense']?.toString() ?? ''),
          TextCellValue(d['libelle']?.toString() ?? ''),
          DoubleCellValue((d['montant'] ?? 0).toDouble()),
          TextCellValue(d['operateur']?.toString() ?? ''),
          TextCellValue(d['autorise_par']?.toString() ?? ''),
        ]);
      }

      await _saveAndShare(
        excel,
        'bilan_${DateTime.now().millisecondsSinceEpoch}.xlsx',
        context,
      );
    } catch (e) {
      if (!context.mounted) return;
      _showError(context, e.toString());
    }
  }

  /// Save and share the Excel file
  static Future<void> _saveAndShare(
    Excel excel,
    String fileName,
    BuildContext context,
  ) async {
    final directory = await getApplicationDocumentsDirectory();
    final filePath = '${directory.path}/$fileName';

    final fileBytes = excel.save();
    if (fileBytes != null) {
      File(filePath)
        ..createSync(recursive: true)
        ..writeAsBytesSync(fileBytes);

      // Share the file
      await Share.shareXFiles([
        XFile(filePath),
      ], text: 'Export Excel - Gestion Pro');

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('✅ Fichier Excel exporté avec succès!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    }
  }

  static void _showError(BuildContext context, String error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('❌ Erreur export: $error'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }
}
