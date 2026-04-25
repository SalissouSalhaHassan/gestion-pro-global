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
            .container { background: white; width: 210mm; min-height: 297mm; margin: 20px auto; padding: 20mm; box-sizing: border-box; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .company-info { font-size: 10px; color: #64748b; font-weight: 700; margin-top: 5px; }
            .document-title { text-align: center; border: 4px solid #0f172a; padding: 15px; margin-bottom: 40px; background: #f8fafc; }
            .document-title h2 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.2em; text-transform: uppercase; }
            .filter-info { font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 20px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { background: #f1f5f9; border: 2px solid #0f172a; padding: 10px; font-size: 9px; font-weight: 900; text-transform: uppercase; text-align: left; }
            td { border: 2px solid #0f172a; padding: 8px 10px; font-size: 10px; font-weight: 700; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .summary-box { display: grid; grid-template-cols: repeat(4, 1fr); border: 2px solid #0f172a; margin-bottom: 40px; background: #f8fafc; }
            .summary-item { padding: 15px; text-align: center; border-right: 2px solid #0f172a; }
            .summary-item:last-child { border-right: none; }
            .summary-label { font-size: 8px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
            .summary-value { font-size: 14px; font-weight: 900; color: #0f172a; }
            .footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: #94a3b8; }
            @media print {
                body { background: white; }
                .container { margin: 0; padding: 10mm; box-shadow: none; width: 100%; }
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
                        Tél: ${company?.telephone || "—"} | NIF: ${company?.nif || "—"}
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 12px; font-weight: 900;">DATE: ${new Date().toLocaleDateString('fr-FR')}</div>
                    <div style="font-size: 10px; font-weight: 700; color: #64748b;">DEPOT: ${depot}</div>
                </div>
            </div>

            <div class="document-title">
                <h2>État et Valorisation du Stock</h2>
            </div>

            <div class="summary-box">
                <div class="summary-item">
                    <div class="summary-label">Articles</div>
                    <div class="summary-value">${summary.total_items}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Quantité Totale</div>
                    <div class="summary-value">${summary.total_qte.toLocaleString('fr-FR')}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Valeur Achat HT</div>
                    <div class="summary-value">${summary.total_valeur_achat.toLocaleString('fr-FR')} F</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Valeur Vente TTC</div>
                    <div class="summary-value">${summary.total_valeur_vente.toLocaleString('fr-FR')} F</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 10%;">Référence</th>
                        <th style="width: 35%;">Désignation</th>
                        <th style="width: 15%;">Famille</th>
                        <th style="width: 10%;" class="text-center">Quantité</th>
                        <th style="width: 15%;" class="text-right">P. Achat HT</th>
                        <th style="width: 15%;" class="text-right">Total Achat</th>
                    </tr>
                </thead>
                <tbody>
                    ${(items || []).map((item: any) => `
                        <tr>
                            <td style="font-family: monospace; font-size: 9px;">${item.reference}</td>
                            <td>${item.designation}</td>
                            <td>${item.famille}</td>
                            <td class="text-center">${item.quantite} ${item.unite}</td>
                            <td class="text-right">${item.p_achat_ht.toLocaleString('fr-FR')}</td>
                            <td class="text-right">${item.total_valeur_achat.toLocaleString('fr-FR')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="footer">
                <span>Imprimé le ${new Date().toLocaleString('fr-FR')}</span>
                <span>GestionPro - Valorisation du Stock</span>
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
