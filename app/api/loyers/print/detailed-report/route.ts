import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const statusFilter = searchParams.get('status') || 'All';

    const supabase = await createClient();
    
    // Fetch data (similar logic to the detailed API)
    const { data: contracts, error: contractError } = await supabase
      .from('contrats')
      .select('*')
      .eq('is_deleted', false);

    if (contractError) throw contractError;

    const { data: payments, error: payError } = await supabase
      .from('contrat_paiements')
      .select('contrat_id, montant, date_paiement');

    if (payError) throw payError;

    const { data: company } = await supabase.from('informations_entreprise').select('*').limit(1).single();

    const reports = contracts.map(c => {
      const startYear = c.annee_debut || 2024;
      const startMonth = c.mois_debut || 1;
      const totalMonthsElapsed = (year - startYear) * 12 + (month - startMonth + 1);
      const monthsToCalculate = Math.max(0, totalMonthsElapsed);
      const expectedAmount = monthsToCalculate * (c.loyer_mensuel || 0);
      
      const totalPaid = payments
        .filter(p => {
          if (p.contrat_id !== c.id) return false;
          const pDate = new Date(p.date_paiement);
          const pYear = pDate.getFullYear();
          const pMonth = pDate.getMonth() + 1;
          return (pYear < year) || (pYear === year && pMonth <= month);
        })
        .reduce((sum, p) => sum + (p.montant || 0), 0);

      const retards = Math.max(0, expectedAmount - totalPaid);
      const unpaidMonthsCount = Math.floor(retards / (c.loyer_mensuel || 1));
      
      let moisImpayesText = "À jour";
      if (unpaidMonthsCount > 0) {
        const unpaidYears: Record<number, number> = {};
        let currentYearIter = startYear;
        let currentMonthIter = startMonth;
        let monthsToSkip = Math.floor(totalPaid / (c.loyer_mensuel || 1));
        let remainingToCount = unpaidMonthsCount;

        while (remainingToCount > 0) {
          if (monthsToSkip > 0) {
            monthsToSkip--;
          } else {
            unpaidYears[currentYearIter] = (unpaidYears[currentYearIter] || 0) + 1;
            remainingToCount--;
          }
          currentMonthIter++;
          if (currentMonthIter > 12) {
            currentMonthIter = 1;
            currentYearIter++;
          }
          if (currentYearIter > year + 5) break;
        }
        
        moisImpayesText = Object.entries(unpaidYears)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([y, count]) => `${y}: ${count}m`)
          .join(", ");
      }
      
      return {
        locataire: c.locataire_nom_complet,
        ref: c.ref_locataire,
        loyer: c.loyer_mensuel,
        total_paye: totalPaid,
        retards: retards,
        mois_impayes: moisImpayesText,
        statut_contrat: c.statut
      };
    });

    let filtered = reports;
    if (statusFilter === 'Paid') filtered = reports.filter(r => r.retards <= 0);
    else if (statusFilter === 'Unpaid') filtered = reports.filter(r => r.retards > 0);

    const monthName = new Date(year, month - 1).toLocaleString('fr-FR', { month: 'long' });
    const today = new Date();

    const rowsHtml = filtered.map((row) => `
      <tr>
        <td class="font-black">${row.locataire} <br><small>${row.ref}</small></td>
        <td class="text-right">${Number(row.loyer).toLocaleString('fr-FR')} F</td>
        <td class="text-right text-emerald-600 font-bold">${Number(row.total_paye).toLocaleString('fr-FR')} F</td>
        <td class="text-right font-black text-rose-600">${Number(row.retards).toLocaleString('fr-FR')} F</td>
        <td class="text-center font-black ${row.mois_impayes !== 'À jour' ? 'text-rose-600' : 'text-slate-300'}">
          ${row.mois_impayes}
        </td>
        <td class="text-center text-xs uppercase font-bold">${row.statut_contrat}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Rapport Détaillé des Impayés - ${monthName} ${year}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background: #f1f5f9; padding: 15px; color: #0f172a; }
        .report { background: white; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); width: 100%; max-width: 210mm; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .company h1 { font-size: 18px; font-weight: 900; }
        .divider { height: 1.5px; background: #0f172a; margin: 10px 0; }
        .title { border: 2px solid #0f172a; padding: 8px; text-align: center; margin-bottom: 15px; }
        .title h2 { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; }
        .meta { background: #f8fafc; border-left: 4px solid #0f172a; padding: 8px 12px; font-size: 11px; margin-bottom: 15px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { background: #f8fafc; border: 2px solid #0f172a; padding: 8px; font-size: 9px; font-weight: 900; text-transform: uppercase; text-align: left; }
        td { border-bottom: 1px solid #e2e8f0; padding: 8px; font-size: 10px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .text-rose-600 { color: #e11d48; }
        .text-emerald-600 { color: #059669; }
        .font-black { font-weight: 900; }
        .font-bold { font-weight: 700; }
        .print-btn { position: fixed; top: 15px; right: 15px; background: #0f172a; color: white; padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-weight: 700; }
        @media print { .print-btn { display: none; } body { padding: 0; background: white; } .report { box-shadow: none; padding: 5mm; max-width: 100%; } }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">IMPRIMER LE RAPPORT</button>
    <div class="report">
        <div class="header">
            <div class="company">
                <h1>${company?.nom_entreprise || "GESTION PRO"}</h1>
                <p style="font-size: 10px; font-weight: 700; color: #64748b;">${company?.adresse || ""}</p>
            </div>
            <div style="text-align: right; font-size: 9px; font-weight: 700; color: #94a3b8;">
                Généré le ${today.toLocaleDateString('fr-FR')}
            </div>
        </div>
        <div class="divider"></div>
        <div class="title">
            <h2>RAPPORT DÉTAILLÉ DES IMPAYÉS</h2>
            <p style="font-size: 11px; font-weight: 700; margin-top: 5px;">PÉRIODE : ${monthName.toUpperCase()} ${year}</p>
        </div>
        <div class="meta">
            Filtre appliqué : ${statusFilter === 'All' ? 'Tous les locataires' : statusFilter === 'Paid' ? 'Locataires à jour' : 'Locataires avec impayés'}
        </div>
        <table>
            <thead>
                <tr>
                    <th>LOCATAIRE / RÉF</th>
                    <th class="text-right">LOYER</th>
                    <th class="text-right">TOTAL PAYÉ</th>
                    <th class="text-right">RETARDS (F)</th>
                    <th class="text-center">MOIS IMPAYÉS</th>
                    <th class="text-center">CONTRAT</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="6" class="text-center">Aucune donnée trouvée.</td></tr>'}
            </tbody>
        </table>
        <div style="margin-top: 50px; text-align: center; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #94a3b8; letter-spacing: 2px;">
            Document de Gestion Interne • ${company?.nom_entreprise || "GESTION PRO"}
        </div>
    </div>
</body>
</html>`;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

  } catch (error: any) {
    console.error('Detailed Print error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
