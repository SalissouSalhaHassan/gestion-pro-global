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

    // Fetch Company Info
    const { data: company } = await supabase.from('informations_entreprise').select('*').limit(1).single();

    // Build the rows
    const rowsHtml = payments.map((payment) => `
      <tr>
        <td class="font-bold">#${payment.id.toString().padStart(6, '0')}</td>
        <td>${formatDate(payment.date_paiement)}</td>
        <td class="font-bold">${(payment as any).contrats?.locataire_nom_complet || '—'}</td>
        <td class="text-slate-500">${payment.periode_debut ? `${formatDate(payment.periode_debut)} au ${formatDate(payment.periode_fin)}` : (payment.nom_de_mois || '—')}</td>
        <td class="text-center font-bold">${payment.qte_mois || 1}</td>
        <td class="text-right font-black text-slate-900">${Number(payment.montant).toLocaleString('fr-FR')} F</td>
        <td class="text-xs uppercase font-bold text-slate-400">${payment.mode_paiement}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport des Paiements - Gestion des Loyers</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #f1f5f9;
            padding: 20px 10px;
            color: #0f172a;
        }
        .report {
            width: 100%;
            max-width: 297mm;
            margin: 0 auto;
            background: white;
            padding: 30px;
            box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 25px;
        }
        .company-info h1 {
            font-size: 24px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -1px;
        }
        .company-info p {
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            margin-top: 4px;
        }
        .divider {
            height: 2px;
            background: #0f172a;
            width: 100%;
            margin-bottom: 25px;
        }
        .title-box {
            border: 2px solid #0f172a;
            background: #f8fafc;
            padding: 15px;
            text-align: center;
            margin-bottom: 30px;
        }
        .title-box h2 {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3em;
        }
        .filters-section {
            background: #f1f5f9;
            padding: 15px;
            margin-bottom: 30px;
            border-left: 4px solid #0f172a;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
        }
        .filters-title {
            font-weight: 900;
            color: #0f172a;
            text-transform: uppercase;
            margin-bottom: 5px;
            font-size: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
        }
        th {
            background: #f8fafc;
            border: 2px solid #0f172a;
            padding: 10px;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            text-align: left;
        }
        td {
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 10px;
            font-size: 11px;
            color: #1e293b;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .font-black { font-weight: 900; }
        .summary-container {
            display: flex;
            justify-content: flex-end;
        }
        .summary-box {
            width: 350px;
            border: 2px solid #0f172a;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            font-size: 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        .summary-row:last-child { border-bottom: none; }
        .summary-row.total {
            background: #0f172a;
            color: white;
            font-weight: 900;
            font-size: 16px;
        }
        .footer {
            margin-top: 20px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
        }
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #0f172a;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            cursor: pointer;
            z-index: 100;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        @media print {
            @page {
                size: A4 landscape;
                margin: 5mm;
            }
            body {
                background: white;
                padding: 0;
            }
            .report {
                box-shadow: none;
                max-width: 100% !important;
                width: 100% !important;
                padding: 0mm;
            }
            .print-btn {
                display: none;
            }
            td, th {
                padding: 6px 8px !important;
                font-size: 10px !important;
            }
            .header, .title-box, .filters-section, table, .summary-container {
                margin-bottom: 12px !important;
            }
            .title-box {
                padding: 8px !important;
            }
            .divider {
                margin-bottom: 12px !important;
            }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">IMPRIMER LE RAPPORT</button>
    
    <div class="report">
        <div class="header">
            <div class="company-info">
                <h1>${company?.nom_entreprise || "GESTION PRO"}</h1>
                <p>${company?.adresse || "ADRESSE NON CONFIGURÉE"}</p>
            </div>
            <div style="text-align: right; font-size: 10px; font-weight: 700; color: #94a3b8;">
                Généré le ${today.toLocaleDateString('fr-FR')}<br>
                à ${today.toLocaleTimeString('fr-FR')}
            </div>
        </div>

        <div class="divider"></div>

        <div class="title-box">
            <h2>RAPPORT DES PAIEMENTS DE LOYER</h2>
        </div>

        <div class="filters-section">
            <div class="filters-title">Critères de filtrage</div>
            <div>
                Période: ${filters.start_date ? formatDate(filters.start_date) : 'Début'} au ${filters.end_date ? formatDate(filters.end_date) : 'Fin'} &nbsp; | &nbsp;
                Mode: ${filters.mode || 'Tous'} &nbsp; | &nbsp;
                Locataire: ${filters.locataire || 'Tous'}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 80px;">N° REÇU</th>
                    <th style="width: 100px;">DATE</th>
                    <th>LOCATAIRE</th>
                    <th>PÉRIODE</th>
                    <th class="text-center" style="width: 60px;">MOIS</th>
                    <th class="text-right" style="width: 120px;">MONTANT</th>
                    <th style="width: 100px;">MODE</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="7" class="text-center">Aucun paiement trouvé.</td></tr>'}
            </tbody>
        </table>

        <div class="summary-container">
            <div class="summary-box">
                <div class="summary-row">
                    <span class="font-bold">Nombre de transactions</span>
                    <span class="font-black">${payments.length}</span>
                </div>
                <div class="summary-row total">
                    <span>TOTAL REÇU</span>
                    <span>${Number(totalAmount).toLocaleString('fr-FR')} F</span>
                </div>
            </div>
        </div>

        <div class="footer">
            <span>GestionPro - Système de Gestion Immobilière</span>
            <span style="letter-spacing: 2px;">Rapport de Gestion des Loyers</span>
        </div>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="rapport_paiements_loyers_${today.getTime()}.html"`,
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
