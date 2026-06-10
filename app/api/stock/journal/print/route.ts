import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || new Date().toISOString().split('T')[0];
    const depot = searchParams.get("depot") || "Tous";
    const search = searchParams.get("search");
    const categoryId = searchParams.get("categoryId");

    const supabase = await createClient();

    // 1. Fetch Company Info
    const { data: company } = await supabase.from('informations_entreprise').select('*').limit(1).single();

    // 2. Fetch Journal Data (Re-using the logic from the journal API)
    // First, get articles
    let articlesQuery = supabase
      .from("articles")
      .select("id, reference, designation, unite, categorie_id")
      .eq("is_deleted", false);

    if (search) {
      articlesQuery = articlesQuery.or(`reference.ilike.%${search}%,designation.ilike.%${search}%`);
    }
    if (categoryId) {
      articlesQuery = articlesQuery.eq("categorie_id", categoryId);
    }

    const { data: articles, error: artError } = await articlesQuery.order("designation");
    if (artError) throw artError;

    const startOfDay = `${dateStr}T00:00:00.000Z`;
    const endOfDay = `${dateStr}T23:59:59.999Z`;

    const results = await Promise.all(articles.map(async (art) => {
      let mvtQuery = supabase
        .from("mouvements")
        .select("quantite, stock_avant, stock_apres, date_mouvement")
        .eq("article_id", art.id)
        .gte("date_mouvement", startOfDay)
        .lte("date_mouvement", endOfDay)
        .order("date_mouvement", { ascending: false });

      if (depot && depot !== "Tous") {
        mvtQuery = mvtQuery.eq("depot", depot);
      }

      const { data: mvts } = await mvtQuery;

      let variation = 0;
      let apres = 0;
      let avant = 0;

      if (mvts && mvts.length > 0) {
        variation = mvts.reduce((sum, m) => sum + Number(m.quantite || 0), 0);
        apres = Number(mvts[0].stock_apres || 0);
        avant = apres - variation;
      } else {
        let lastMvtQuery = supabase
          .from("mouvements")
          .select("stock_apres")
          .eq("article_id", art.id)
          .lt("date_mouvement", startOfDay)
          .order("date_mouvement", { ascending: false })
          .limit(1);

        if (depot && depot !== "Tous") {
          lastMvtQuery = lastMvtQuery.eq("depot", depot);
        }

        const { data: lastMvts } = await lastMvtQuery;

        if (lastMvts && lastMvts.length > 0) {
          avant = Number(lastMvts[0].stock_apres || 0);
          apres = avant;
        } else {
            // Check first movement ever for stock_avant
            let firstMvtQuery = supabase
                .from("mouvements")
                .select("stock_avant")
                .eq("article_id", art.id)
                .order("date_mouvement", { ascending: true })
                .limit(1);
            if (depot && depot !== "Tous") firstMvtQuery = firstMvtQuery.eq("depot", depot);
            const { data: firstMvts } = await firstMvtQuery;
            if (firstMvts && firstMvts.length > 0) {
                avant = Number(firstMvts[0].stock_avant || 0);
                apres = avant;
            } else {
                avant = 0;
                apres = 0;
            }
        }
        variation = 0;
      }

      return { ...art, avant, variation, apres };
    }));

    // Only show items that had movements
    const filteredResults = results.filter(item => item.variation !== 0);

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    };

    const html = `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
    <meta charset="UTF-8">
    <title>Journal de Stock - ${dateStr}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
        body { background: white; padding: 20mm; color: #1e293b; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
        .company-info h1 { font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin-bottom: 5px; }
        .company-info p { font-size: 11px; color: #64748b; font-weight: 500; }
        .report-title { text-align: right; }
        .title-badge { background: #0f172a; color: white; padding: 5px 15px; font-weight: 900; font-size: 14px; margin-bottom: 10px; display: inline-block; }
        .report-date { font-size: 16px; font-weight: 800; color: #4f46e5; }
        
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
        .summary-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 10px; text-align: center; }
        .card-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 5px; }
        .card-value { font-size: 18px; font-weight: 900; color: #1e293b; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f8fafc; text-align: left; padding: 12px 15px; font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px 15px; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
        .ref-col { font-weight: 800; color: #64748b; font-size: 10px; }
        .name-col { font-weight: 700; color: #1e293b; }
        .num-col { font-weight: 800; text-align: center; }
        .var-col { font-weight: 900; text-align: center; }
        .pos { color: #10b981; }
        .neg { color: #ef4444; }
        .total-row { background: #0f172a; color: white; }
        .total-row td { border: none; font-weight: 900; font-size: 14px; }

        .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; font-weight: 600; }
        
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
            @page { margin: 15mm; }
        }
        
        .print-btn { position: fixed; top: 20px; right: 20px; background: #4f46e5; color: white; border: none; padding: 12px 25px; border-radius: 10px; font-weight: 700; cursor: pointer; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4); }
    </style>
</head>
<body>
    <button class="print-btn no-print" onclick="window.print()">Imprimer le Rapport</button>

    <div class="header">
        <div class="company-info">
            <h1>${company?.nom_entreprise || "GESTION PRO"}</h1>
            <p>${company?.adresse || ""}</p>
            <p>Tél: ${company?.telephone || ""} | NIF: ${company?.nif || ""}</p>
        </div>
        <div class="report-title">
            <div class="title-badge">JOURNAL QUOTIDIEN DE STOCK</div>
            <div class="report-date">${formatDate(dateStr)}</div>
            <p style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 5px;">Dépôt: ${depot}</p>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="card-label">Articles Concernés</div>
            <div class="card-value">${filteredResults.length}</div>
        </div>
        <div class="summary-card">
            <div class="card-label">Total Entrées</div>
            <div class="card-value pos">+${filteredResults.reduce((sum, i) => sum + (i.variation > 0 ? i.variation : 0), 0)}</div>
        </div>
        <div class="summary-card">
            <div class="card-label">Total Sorties</div>
            <div class="card-value neg">${filteredResults.reduce((sum, i) => sum + (i.variation < 0 ? i.variation : 0), 0)}</div>
        </div>
        <div class="summary-card">
            <div class="card-label">État Global</div>
            <div class="card-value">${filteredResults.reduce((sum, i) => sum + i.variation, 0)}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Référence</th>
                <th>Désignation</th>
                <th style="text-align: center;">Avant</th>
                <th style="text-align: center;">Variation</th>
                <th style="text-align: center;">Après</th>
                <th style="text-align: center;">Unité</th>
            </tr>
        </thead>
        <tbody>
            ${filteredResults.map(item => `
                <tr>
                    <td class="ref-col">${item.reference}</td>
                    <td class="name-col">${item.designation}</td>
                    <td class="num-col">${item.avant}</td>
                    <td class="var-col ${item.variation > 0 ? 'pos' : item.variation < 0 ? 'neg' : ''}">
                        ${item.variation > 0 ? '+' : ''}${item.variation}
                    </td>
                    <td class="num-col" style="color: #4f46e5; font-weight: 900;">${item.apres}</td>
                    <td style="text-align: center; font-size: 10px; font-weight: 700; color: #94a3b8;">${item.unite || 'PCS'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        <span>Généré par LOGICIEL EASY • Système de Gestion Pro</span>
        <span>Date d'édition: ${new Date().toLocaleString('fr-FR')}</span>
        <span>Page 1 / 1</span>
    </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
