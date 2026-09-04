import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const purchaseId = parseInt(id, 10);
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'A4'; // A4 or A5

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: 'Invalid purchase ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const orgId = session.organization_id || '00000000-0000-0000-0000-000000000001';

    // Fetch purchase details
    let purQuery = supabase
      .from('achats')
      .select(`
        *,
        achat_items(*)
      `)
      .eq('id', purchaseId);

    if (orgId) purQuery = purQuery.eq('organization_id', orgId);
    const { data: purchase, error: purError } = await purQuery.single();

    if (purError || !purchase) {
      return NextResponse.json(
        { error: 'Purchase not found' },
        { status: 404 }
      );
    }

    // Fetch Company Info
    let compQuery = supabase.from('informations_entreprise').select('*');
    if (orgId) compQuery = compQuery.eq('organization_id', orgId);
    const { data: company } = await compQuery.maybeSingle();

    // Extract financial details metadata JSON if present in notes or purchase object
    let meta: any = {};
    let cleanNotes = purchase.notes || '';
    if (cleanNotes.includes('[FINANCIAL_DETAILS]')) {
      const parts = cleanNotes.split('[FINANCIAL_DETAILS]');
      cleanNotes = parts[0].trim();
      const jsonStr = parts[1]?.split('[/FINANCIAL_DETAILS]')[0];
      try { meta = JSON.parse(jsonStr || '{}'); } catch (e) {}
    } else if (purchase.frais_details) {
      meta = purchase.frais_details;
    }

    const deviseSymbol = meta.devise || purchase.devise || 'FCFA';
    const netHT = Math.max(0, (purchase.sous_total || 0) - (purchase.remise || 0));
    const landedRatio = netHT > 0 ? (purchase.montant_total || 0) / netHT : 1;

    const formatDate = (value: string | null | undefined) => {
      if (!value) return '—';
      try {
        return new Date(value).toLocaleDateString('fr-FR');
      } catch {
        return String(value);
      }
    };

    const isA5 = format.toUpperCase() === 'A5';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bon de Réception #${purchase.numero_facture}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #f1f5f9;
            padding: 40px 20px;
            color: #0f172a;
            line-height: 1.4;
        }
        .receipt {
            width: 100%;
            max-width: ${isA5 ? '148mm' : '210mm'};
            min-height: ${isA5 ? '210mm' : '297mm'};
            margin: 0 auto;
            background: white;
            padding: ${isA5 ? '30px' : '50px'};
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .company-info h1 {
            font-size: ${isA5 ? '20px' : '24px'};
            font-weight: 900;
            text-transform: uppercase;
            color: #0f172a;
        }
        .company-info p {
            font-size: ${isA5 ? '10px' : '12px'};
            color: #475569;
            margin-top: 4px;
        }
        .title-box {
            text-align: center;
            border: 2px solid #0f172a;
            padding: 10px;
            margin-bottom: 30px;
            background: #f8fafc;
        }
        .title-box h2 {
            font-size: ${isA5 ? '14px' : '18px'};
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
            font-size: ${isA5 ? '10px' : '12px'};
        }
        .info-block h3 {
            font-size: ${isA5 ? '11px' : '13px'};
            font-weight: 900;
            text-transform: uppercase;
            border-bottom: 2px solid #0f172a;
            margin-bottom: 10px;
            padding-bottom: 5px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        .info-label { font-weight: 700; color: #64748b; }
        .info-value { font-weight: 900; }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: ${isA5 ? '10px' : '12px'};
        }
        th {
            background: #f1f5f9;
            border: 1px solid #0f172a;
            padding: 8px;
            font-weight: 900;
            text-align: left;
            text-transform: uppercase;
        }
        td {
            border: 1px solid #0f172a;
            padding: 8px;
        }
        .totals {
            margin-left: auto;
            width: ${isA5 ? '100%' : '60%'};
            font-size: ${isA5 ? '11px' : '12px'};
        }
        .total-section-title {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            color: #64748b;
            margin-top: 8px;
            margin-bottom: 2px;
            border-bottom: 1px dashed #cbd5e1;
            padding-bottom: 2px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px border-slate-100;
        }
        .total-row.final {
            border-bottom: none;
            font-weight: 900;
            font-size: ${isA5 ? '14px' : '17px'};
            color: #4f46e5;
            padding-top: 10px;
            border-top: 2px solid #0f172a;
        }
        .footer {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
        }
        .signature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 40px;
            text-align: center;
        }
        .signature-line {
            border-top: 1px solid #0f172a;
            margin-top: 40px;
            padding-top: 8px;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
        }
        @media print {
            body { background: white; padding: 0; }
            .receipt { box-shadow: none; padding: 10mm; }
            .print-btn { display: none; }
        }
        .print-btn {
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4f46e5;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 12px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
            z-index: 100;
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">Imprimer en ${format.toUpperCase()}</button>

    <div class="receipt">
        <div class="header">
            <div class="company-info">
                <h1>${company?.nom_entreprise || "GESTION PRO"}</h1>
                <p>${company?.adresse || ""}</p>
                <p>Tél: ${company?.telephone || ""} | NIF: ${company?.nif || ""}</p>
            </div>
            <div style="text-align: right;">
                <p style="font-weight: 900; font-size: 14px;">BON DE RÉCEPTION</p>
                <p style="font-weight: 700; color: #4f46e5;"># ${purchase.numero_facture}</p>
            </div>
        </div>

        <div class="title-box">
            <h2>DÉTAILS DE LA RÉCEPTION</h2>
        </div>

        <div class="info-grid">
            <div class="info-block">
                <h3>Fournisseur</h3>
                <p style="font-weight: 900; font-size: 14px; margin-bottom: 5px;">${purchase.fournisseur_nom}</p>
                <div class="info-row">
                    <span class="info-label">ID Fournisseur:</span>
                    <span class="info-value">#${purchase.fournisseur_id}</span>
                </div>
            </div>
            <div class="info-block">
                <h3>Réception</h3>
                <div class="info-row">
                    <span class="info-label">Date:</span>
                    <span class="info-value">${formatDate(purchase.date_achat)}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Dépôt:</span>
                    <span class="info-value">${purchase.depot_nom}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Devise:</span>
                    <span class="info-value">${deviseSymbol}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Statut:</span>
                    <span class="info-value" style="color: ${purchase.statut === 'Payée' ? '#10b981' : '#f59e0b'};">${purchase.statut}</span>
                </div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Désignation</th>
                    <th style="text-align: center;">Qté</th>
                    <th style="text-align: center;">Unité</th>
                    <th style="text-align: right;">P.U HT (${deviseSymbol})</th>
                    <th style="text-align: right; color: #b45309; background: #fffbeb;">Prix d'Arrivée (${deviseSymbol})</th>
                    <th style="text-align: right;">Total HT (${deviseSymbol})</th>
                </tr>
            </thead>
            <tbody>
                ${purchase.achat_items.map((item: any) => {
                    const pu = item.prix_unitaire_ht || 0;
                    const remPct = item.remise_percent || 0;
                    const puNet = pu * (1 - remPct / 100);
                    const landedUnitPrice = Number((puNet * landedRatio).toFixed(2));
                    return `
                    <tr>
                        <td style="font-weight: 700;">${item.designation}</td>
                        <td style="text-align: center;">${item.quantite}</td>
                        <td style="text-align: center;">${item.unite || ''}</td>
                        <td style="text-align: right;">${Number(item.prix_unitaire_ht).toLocaleString('fr-FR')}</td>
                        <td style="text-align: right; font-weight: 900; color: #b45309; background: #fffbeb;">${Number(landedUnitPrice).toLocaleString('fr-FR')}</td>
                        <td style="text-align: right; font-weight: 700;">${Number(item.montant_ligne).toLocaleString('fr-FR')}</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>

        <div class="totals">
            <div class="total-row" style="font-weight: 700;">
                <span>Sous-Total HT</span>
                <span>${Number(purchase.sous_total || 0).toLocaleString('fr-FR')} ${deviseSymbol}</span>
            </div>
            ${purchase.remise > 0 ? `
                <div class="total-row">
                    <span>Remise globale</span>
                    <span style="color: #dc2626;">- ${Number(purchase.remise).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            <div class="total-row" style="font-weight: 700; color: #4f46e5;">
                <span>Net HT</span>
                <span>${Number(netHT).toLocaleString('fr-FR')} ${deviseSymbol}</span>
            </div>

            <!-- Frais Logistique & Approvisionnement Breakdown -->
            <div class="total-section-title">Frais d'approvisionnement & Logistique</div>
            ${(meta.transport || purchase.transport) > 0 ? `
                <div class="total-row">
                    <span>Frais de Transport</span>
                    <span>+ ${Number(meta.transport || purchase.transport).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.bateau > 0 ? `
                <div class="total-row">
                    <span>Bateau</span>
                    <span>+ ${Number(meta.bateau).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.commission > 0 ? `
                <div class="total-row">
                    <span>Commission</span>
                    <span>+ ${Number(meta.commission).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.chargementDechargement > 0 ? `
                <div class="total-row">
                    <span>Chargement & Déchargement</span>
                    <span>+ ${Number(meta.chargementDechargement).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.fraisDeRoute > 0 ? `
                <div class="total-row">
                    <span>Frais de Route</span>
                    <span>+ ${Number(meta.fraisDeRoute).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.fraisDeDouane > 0 ? `
                <div class="total-row">
                    <span>Frais de Douane</span>
                    <span>+ ${Number(meta.fraisDeDouane).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.controleDouanier > 0 ? `
                <div class="total-row">
                    <span>Contrôle Douanier</span>
                    <span>+ ${Number(meta.controleDouanier).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.transite1 > 0 ? `
                <div class="total-row">
                    <span>Transite 1er</span>
                    <span>+ ${Number(meta.transite1).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.transite2 > 0 ? `
                <div class="total-row">
                    <span>Transite 2ème</span>
                    <span>+ ${Number(meta.transite2).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.transite3 > 0 ? `
                <div class="total-row">
                    <span>Transite 3ème</span>
                    <span>+ ${Number(meta.transite3).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}
            ${meta.autresFrais > 0 ? `
                <div class="total-row">
                    <span>Autres Frais</span>
                    <span>+ ${Number(meta.autresFrais).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}

            <!-- Taxes & Impôts Breakdown -->
            ${purchase.taxe > 0 ? `
                <div class="total-section-title">Taxes & Impôts</div>
                <div class="total-row">
                    <span>BIC (${meta.bicPercent || 2}%)</span>
                    <span>+ ${Number(purchase.taxe).toLocaleString('fr-FR')} ${deviseSymbol}</span>
                </div>
            ` : ''}

            <div class="total-row final">
                <span>TOTAL TTC (NET À PAYER)</span>
                <span>${Number(purchase.montant_total).toLocaleString('fr-FR')} ${deviseSymbol}</span>
            </div>
            <div class="total-row" style="margin-top: 10px; border-top: 2px solid #0f172a; padding-top: 10px;">
                <span style="font-weight: 700;">Acompte versé</span>
                <span style="font-weight: 900; color: #10b981;">${Number(purchase.montant_paye).toLocaleString('fr-FR')} ${deviseSymbol}</span>
            </div>
            <div class="total-row">
                <span style="font-weight: 700;">Reste à payer</span>
                <span style="font-weight: 900; color: #ef4444;">${Number(purchase.montant_total - purchase.montant_paye).toLocaleString('fr-FR')} ${deviseSymbol}</span>
            </div>
        </div>

        ${cleanNotes ? `
            <div style="margin-top: 30px; font-size: 11px; border: 1px dashed #cbd5e1; padding: 10px;">
                <p style="font-weight: 900; margin-bottom: 4px; text-transform: uppercase;">Notes:</p>
                <p>${cleanNotes}</p>
            </div>
        ` : ''}

        <div class="signature-grid">
            <div>
                <p class="signature-line">Le Magasinier</p>
            </div>
            <div>
                <p class="signature-line">Le Fournisseur</p>
            </div>
        </div>

        <div class="footer">
            <span>Généré par LOGICIEL EASY</span>
            <span>Date d'impression: ${new Date().toLocaleString('fr-FR')}</span>
            <span>Page 1/1</span>
        </div>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="reception_${purchase.numero_facture}.html"`,
      },
    });
  } catch (error: any) {
    console.error('Print purchase error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate receipt' },
      { status: 500 }
    );
  }
}
