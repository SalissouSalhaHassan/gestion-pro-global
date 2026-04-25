import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const depot = searchParams.get('depot') || "Tous";
    const categoryId = searchParams.get('categoryId');

    if (type !== 'valuation') {
      return NextResponse.json({ error: 'Type de rapport invalide' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch Valuation Data (Reuse logic from API)
    const valuationRes = await fetch(`${request.nextUrl.origin}/api/stock/valuation?depot=${depot}&categoryId=${categoryId}`, {
        headers: {
            cookie: request.headers.get('cookie') || ""
        }
    });
    const { items, summary } = await valuationRes.json();

    // Fetch Company Info
    const { data: company } = await supabase.from('informations_entreprise').select('*').limit(1).single();

    const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>État et Valorisation du Stock - ${depot}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 0; padding: 0; background: #f1f5f9; }
            .container { background: white; width: 297mm; min-height: 210mm; margin: 10px auto; padding: 15mm; box-sizing: border-box; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); }
            .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 15px; }
            .company-name { font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .company-info { font-size: 9px; color: #64748b; font-weight: 700; margin-top: 3px; }
            .document-title { text-align: center; border: 3px solid #0f172a; padding: 10px; margin-bottom: 25px; background: #f8fafc; }
            .document-title h2 { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
            
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f1f5f9; border: 1.5px solid #0f172a; padding: 8px; font-size: 8px; font-weight: 900; text-transform: uppercase; text-align: left; }
            td { border: 1.5px solid #0f172a; padding: 6px 8px; font-size: 9px; font-weight: 700; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bg-moyen { background-color: #f5f3ff; }
            
            .summary-cards { display: grid; grid-template-cols: repeat(5, 1fr); gap: 10px; margin-bottom: 25px; }
            .summary-card { padding: 10px; text-align: center; border: 1.5px solid #0f172a; background: #fff; }
            .summary-label { font-size: 7px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
            .summary-value { font-size: 11px; font-weight: 900; color: #0f172a; }
            
            .footer { margin-top: auto; padding-top: 15px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 8px; font-weight: 700; color: #94a3b8; }
            @media print {
                body { background: white; }
                .container { margin: 0; padding: 5mm; box-shadow: none; width: 100%; }
                @page { size: A4 landscape; margin: 0; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div>
                    <h1 class="company-name">${company?.nom_entreprise || "LOGICIEL EASY"}</h1>
                    <div class="company-info">
                        ${company?.adresse || "MARADI-NIGER"}<br>
                        Tél: ${company?.telephone || "—"}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; font-weight: 900;">RAPPORT DE VALORISATION</div>
                    <div style="font-size: 9px; font-weight: 700; color: #64748b;">DATE: ${new Date().toLocaleString('fr-FR')}</div>
                    <div style="font-size: 9px; font-weight: 700; color: #64748b;">DEPOT: ${depot}</div>
                </div>
            </div>

            <div class="document-title">
                <h2>État et Valorisation du Stock</h2>
            </div>

            <div class="summary-cards">
                <div class="summary-card">
                    <div class="summary-label">Quantité Totale</div>
                    <div class="summary-value">${summary.total_qte.toLocaleString('fr-FR')}</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Valeur Achat</div>
                    <div class="summary-value">${summary.total_valeur_achat.toLocaleString('fr-FR')} F</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Valeur Moyenne</div>
                    <div class="summary-value">${summary.total_valeur_moyenne.toLocaleString('fr-FR')} F</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Valeur Vente</div>
                    <div class="summary-value">${summary.total_valeur_vente.toLocaleString('fr-FR')} F</div>
                </div>
                <div class="summary-card">
                    <div class="summary-label">Marge Latente</div>
                    <div class="summary-value">${summary.marge_latente.toLocaleString('fr-FR')} F</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 10%;">Réf Stock</th>
                        <th style="width: 20%;">Désignation</th>
                        <th style="width: 8%;" class="text-center">Qté En Stock</th>
                        <th style="width: 10%;" class="text-right">P. Achat</th>
                        <th style="width: 10%;" class="text-right">P. Moyen</th>
                        <th style="width: 10%;" class="text-right">P. Vente</th>
                        <th style="width: 11%;" class="text-right">Total Achat</th>
                        <th style="width: 11%;" class="text-right">Total Moyen</th>
                        <th style="width: 10%;" class="text-right">Total Vente</th>
                    </tr>
                </thead>
                <tbody>
                    ${(items || []).map((item: any) => `
                        <tr>
                            <td style="font-family: monospace; font-size: 8px;">${item.reference}</td>
                            <td>${item.designation}</td>
                            <td class="text-center">${item.quantite.toLocaleString('fr-FR')}</td>
                            <td class="text-right">${item.p_achat_ht.toLocaleString('fr-FR')}</td>
                            <td class="text-right bg-moyen">${item.p_moyen.toLocaleString('fr-FR')}</td>
                            <td class="text-right">${item.p_vente_ttc.toLocaleString('fr-FR')}</td>
                            <td class="text-right">${item.total_valeur_achat.toLocaleString('fr-FR')}</td>
                            <td class="text-right bg-moyen">${item.total_valeur_moyenne.toLocaleString('fr-FR')}</td>
                            <td class="text-right">${item.total_valeur_vente.toLocaleString('fr-FR')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="footer">
                <span>Document généré automatiquement par GestionPro</span>
                <span>Date d'impression: ${new Date().toLocaleString('fr-FR')}</span>
                <span>Page 1 / 1</span>
            </div>
        </div>
        <script>
            window.onload = function() {
                window.print();
            };
        </script>
    </body>
    </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Print Valuation Error:', error);
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'impression' }, { status: 500 });
  }
}
