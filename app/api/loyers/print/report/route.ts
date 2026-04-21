import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContractService } from '@/lib/services/loyer.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      locataire: searchParams.get('locataire') || undefined,
      mois: searchParams.get('mois') || undefined,
      mode: searchParams.get('mode') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
    };

    const supabase = await createClient();
    const service = new ContractService(supabase);
    const payments = await service.loadPayments(filters);

    const today = new Date();
    
    // Calculate total
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.montant || 0), 0);

    // Format currency
    const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(n);

    // Format date
    const formatDate = (d: string | null | undefined) => {
      if (!d) return '—';
      try {
        return new Date(d).toLocaleDateString('fr-FR');
      } catch {
        return String(d);
      }
    };

    // Build the rows
    const rowsHtml = payments.map((payment) => `
      <tr>
        <td><strong>#${payment.id}</strong></td>
        <td>${formatDate(payment.date_paiement)}</td>
        <td><strong>${payment.contrats?.locataire_nom_complet || '—'}</strong></td>
        <td>${payment.periode_debut ? `${formatDate(payment.periode_debut)} au ${formatDate(payment.periode_fin)}` : '—'}</td>
        <td class="text-center">${payment.qte_mois ? `${payment.qte_mois}` : '—'}</td>
        <td class="text-right"><strong>${fmt(payment.montant)}</strong></td>
        <td>${payment.mode_paiement}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport des Paiements - Gestion des Loyers</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            color: #333;
        }
        .report {
            width: 100%;
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            page-break-after: always;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #4f46e5;
            font-size: 28px;
            margin-bottom: 5px;
        }
        .header p {
            color: #666;
            font-size: 14px;
        }
        .filters-section {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 30px;
            font-size: 13px;
        }
        .filters-title {
            font-weight: bold;
            color: #4f46e5;
            margin-bottom: 10px;
            text-transform: uppercase;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 13px;
        }
        .details-table thead {
            background: #f8f8f8;
            border-top: 2px solid #4f46e5;
            border-bottom: 2px solid #4f46e5;
        }
        .details-table th {
            padding: 12px;
            text-align: left;
            font-weight: bold;
            color: #333;
            font-size: 12px;
            text-transform: uppercase;
        }
        .details-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
        }
        .text-right {
            text-align: right !important;
        }
        .text-center {
            text-align: center !important;
        }
        .summary {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
        }
        .summary-table {
            width: 100%;
            max-width: 400px;
            border-collapse: collapse;
            font-size: 14px;
        }
        .summary-table tr td {
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
        }
        .summary-table tr.total {
            background: #eef2ff;
            border-top: 2px solid #4f46e5;
            border-bottom: 2px solid #4f46e5;
            font-weight: bold;
            font-size: 18px;
            color: #4f46e5;
        }
        .summary-table tr.total td {
            padding: 15px 12px;
            border: none;
        }
        .footer {
            text-align: center;
            color: #999;
            font-size: 11px;
            border-top: 1px solid #eee;
            padding-top: 20px;
            margin-top: 30px;
        }
        @media print {
            body { background: white; padding: 0; }
            .report { box-shadow: none; max-width: 100%; padding: 0; }
            .no-print { display: none; }
        }
        .print-btn {
            display: block;
            margin: 20px auto;
            padding: 12px 30px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        }
        .print-btn:hover {
            background: #4338ca;
        }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimer le Rapport</button>
    
    <div class="report">
        <div class="header">
            <h1>RAPPORT DES PAIEMENTS DE LOYER</h1>
            <p>GestionPro - Gestion des Loyers</p>
        </div>

        <div class="filters-section">
            <div class="filters-title">Critères du Rapport</div>
            <div>
                <strong>Période:</strong> ${filters.start_date || 'Début'} au ${filters.end_date || 'Fin'} &nbsp;|&nbsp; 
                <strong>Mode:</strong> ${filters.mode || 'Tous'} &nbsp;|&nbsp; 
                <strong>Locataire:</strong> ${filters.locataire || 'Tous'} &nbsp;|&nbsp;
                <strong>Imprimé le:</strong> ${today.toLocaleDateString('fr-FR')} à ${today.toLocaleTimeString('fr-FR')}
            </div>
        </div>

        <table class="details-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Date</th>
                    <th>Locataire</th>
                    <th>Période Couverte</th>
                    <th class="text-center">Qté Mois</th>
                    <th class="text-right">Montant</th>
                    <th>Mode</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="7" class="text-center">Aucun paiement trouvé pour ces critères.</td></tr>'}
            </tbody>
        </table>

        <div class="summary">
            <table class="summary-table">
                <tr>
                    <td><strong>Nombre de transactions</strong></td>
                    <td class="text-right"><strong>${payments.length}</strong></td>
                </tr>
                <tr class="total">
                    <td>TOTAL REÇU</td>
                    <td class="text-right">${fmt(totalAmount)}</td>
                </tr>
            </table>
        </div>

        <div class="footer">
            <p>GestionPro © ${today.getFullYear()} | Ce rapport est généré automatiquement par le système.</p>
        </div>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': \`inline; filename="rapport_paiements_loyers_${today.getTime()}.html"\`,
      },
    });
  } catch (error: any) {
    console.error('Print report error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
