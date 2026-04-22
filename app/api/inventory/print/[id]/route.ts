import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invId = parseInt(id, 10);

    if (isNaN(invId)) {
      return NextResponse.json({ error: 'ID d\'inventaire invalide' }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch Inventory Session
    const { data: inv, error: invError } = await supabase
      .from('inventaires')
      .select('*')
      .eq('id', invId)
      .single();

    if (invError || !inv) {
      return NextResponse.json({ error: 'Session d\'inventaire introuvable' }, { status: 404 });
    }

    // Fetch Inventory Items
    const { data: items, error: itemsError } = await supabase
      .from('inventaire_items')
      .select('*')
      .eq('inventaire_id', invId);

    if (itemsError) throw itemsError;

    // Fetch Company Info
    const { data: company } = await supabase.from('informations_entreprise').select('*').limit(1).single();

    const formatDate = (value: string | null | undefined) => {
      if (!value) return '—';
      try {
        return new Date(value).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return String(value);
      }
    };

    const html = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Procès-Verbal d'Inventaire - ${inv.depot_nom}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 0; padding: 0; background: #f1f5f9; }
            .receipt-container { background: white; width: 210mm; min-height: 297mm; margin: 20px auto; padding: 20mm; box-sizing: border-box; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .company-info { font-size: 10px; color: #64748b; font-weight: 700; margin-top: 5px; }
            .document-title { text-align: center; border: 4px solid #0f172a; padding: 15px; margin-bottom: 40px; background: #f8fafc; }
            .document-title h2 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.2em; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .info-section h3 { font-size: 11px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #0f172a; padding-bottom: 5px; margin-bottom: 12px; }
            .info-item { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px; }
            .info-label { font-weight: 700; color: #64748b; font-size: 9px; text-transform: uppercase; }
            .info-value { font-weight: 700; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { background: #f1f5f9; border: 2px solid #0f172a; padding: 10px; font-size: 10px; font-weight: 900; text-transform: uppercase; text-align: left; }
            td { border: 2px solid #0f172a; padding: 10px; font-size: 11px; font-weight: 700; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .summary-box { display: grid; grid-template-cols: repeat(3, 1fr); border: 2px solid #0f172a; margin-bottom: 40px; }
            .summary-item { padding: 15px; text-align: center; border-right: 2px solid #0f172a; }
            .summary-item:last-child { border-right: none; }
            .summary-label { font-size: 9px; font-weight: 900; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
            .summary-value { font-size: 16px; font-weight: 900; color: #0f172a; }
            .diff-positive { color: #10b981; }
            .diff-negative { color: #e11d48; }
            .signature-section { display: grid; grid-template-cols: 1fr 1fr; gap: 80px; margin-top: 60px; }
            .signature-box { text-align: center; }
            .signature-line { border-top: 2px solid #0f172a; margin-bottom: 10px; padding-top: 10px; font-size: 11px; font-weight: 900; text-transform: uppercase; }
            .footer { margin-top: auto; padding-top: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; font-size: 9px; font-weight: 700; color: #94a3b8; }
            @media print {
                body { background: white; }
                .receipt-container { margin: 0; padding: 10mm; box-shadow: none; width: 100%; }
                @page { size: A4; margin: 0; }
            }
        </style>
    </head>
    <body>
        <div class="receipt-container">
            <div class="header">
                <div>
                    <h1 class="company-name">${company?.nom_entreprise || "LOGICIEL EASY"}</h1>
                    <div class="company-info">
                        ${company?.adresse || "MARADI-NIGER"}<br>
                        Tél: ${company?.telephone || "—"} | NIF: ${company?.nif || "—"} | RC: ${company?.rc || "—"}
                    </div>
                </div>
            </div>

            <div class="document-title">
                <h2>Procès-Verbal d'Inventaire</h2>
            </div>

            <div class="info-grid">
                <div class="info-section">
                    <h3>Détails de la Session</h3>
                    <div class="info-item">
                        <span class="info-label">Session N°:</span>
                        <span class="info-value">INV-${invId.toString().padStart(6, '0')}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Dépôt:</span>
                        <span class="info-value">${inv.depot_nom}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Date:</span>
                        <span class="info-value">${formatDate(inv.date_inventaire)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Statut:</span>
                        <span class="info-value" style="color: #10b981;">${inv.statut}</span>
                    </div>
                </div>
                <div class="info-section">
                    <h3>Notes / Observations</h3>
                    <div style="font-size: 11px; font-weight: 700; color: #475569; line-height: 1.6;">
                        ${inv.notes || "Aucune note particulière."}
                    </div>
                </div>
            </div>

            <div class="summary-box">
                <div class="summary-item">
                    <div class="summary-label">Valeur Avant</div>
                    <div class="summary-value">${Number(inv.valeur_stock_avant).toLocaleString('fr-FR')} F</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Valeur Après</div>
                    <div class="summary-value">${Number(inv.valeur_stock_apres).toLocaleString('fr-FR')} F</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Écart de Valeur</div>
                    <div class="summary-value ${inv.difference_valeur >= 0 ? 'diff-positive' : 'diff-negative'}">
                        ${inv.difference_valeur >= 0 ? '+' : ''}${Number(inv.difference_valeur).toLocaleString('fr-FR')} F
                    </div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 15%;">Référence</th>
                        <th style="width: 45%;">Désignation</th>
                        <th style="width: 13%;" class="text-center">Théorique</th>
                        <th style="width: 13%;" class="text-center">Physique</th>
                        <th style="width: 14%;" class="text-right">Écart</th>
                    </tr>
                </thead>
                <tbody>
                    ${(items || []).map(item => {
                        const diff = Number(item.difference_qte);
                        return `
                            <tr>
                                <td style="font-family: monospace; font-size: 9px;">${item.code_article}</td>
                                <td>${item.description}</td>
                                <td class="text-center">${item.quantite_avant}</td>
                                <td class="text-center">${item.quantite_apres}</td>
                                <td class="text-right ${diff > 0 ? 'diff-positive' : (diff < 0 ? 'diff-negative' : '')}">
                                    ${diff > 0 ? '+' : ''}${diff === 0 ? '—' : diff}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-line">Le Gestionnaire de Dépôt</div>
                </div>
                <div class="signature-box">
                    <div class="signature-line">La Direction Générale</div>
                </div>
            </div>

            <div class="footer">
                <span>Généré le ${new Date().toLocaleDateString('fr-FR')}</span>
                <span>GestionPro - Système de Gestion Intégré</span>
                <span>Page 1 / 1</span>
            </div>
        </div>
        <script>
            window.onload = function() {
                // window.print();
            };
        </script>
    </body>
    </html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Print Inventory Error:', error);
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'impression' }, { status: 500 });
  }
}
