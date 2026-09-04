import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    // 1. Fetch Company Information
    let compQuery = supabase
      .from("informations_entreprise")
      .select("*");
    if (session.organization_id) compQuery = compQuery.eq("organization_id", session.organization_id);
    const { data: company } = await compQuery.maybeSingle();

    // 2. Fetch Invoices in the period (excluding deleted and cancelled)
    let invQuery = supabase
      .from("factures")
      .select(`
        id, bl_number, date_facture, total_ht, total_tva, total_ttc, montant_paye, montant_restant, statut,
        facture_items (
          id, article_id, description, qte, pu_ht, total_item_ht, total_item_ttc
        )
      `)
      .neq("statut", "Annulée")
      .eq("is_deleted", false);

    if (session.organization_id) invQuery = invQuery.eq("organization_id", session.organization_id);
    if (start) invQuery = invQuery.gte("date_facture", start);
    if (end) invQuery = invQuery.lte("date_facture", `${end}T23:59:59.999Z`);

    const { data: invoices, error: invErr } = await invQuery;
    if (invErr) throw new Error(invErr.message);

    // 3. Fetch Articles Purchase Costs (P_ACHAT_HT)
    let artQuery = supabase
      .from("articles")
      .select("id, reference, designation, p_achat_ht, p_vente_ht")
      .eq("is_deleted", false);
    if (session.organization_id) artQuery = artQuery.eq("organization_id", session.organization_id);
    const { data: articles } = await artQuery;

    const articleMap = new Map<number, any>();
    (articles || []).forEach((art: any) => {
      articleMap.set(Number(art.id), art);
    });

    // 4. Fetch Expenses (Dépenses) in the period
    let depQuery = supabase.from("depenses").select("*");
    if (session.organization_id) depQuery = depQuery.eq("organization_id", session.organization_id);
    if (start) depQuery = depQuery.gte("date_depense", start);
    if (end) depQuery = depQuery.lte("date_depense", `${end}T23:59:59.999Z`);

    const { data: depenses, error: depErr } = await depQuery;
    if (depErr) throw new Error(depErr.message);

    // 5. Calculate Revenue, COGS, and Margins
    let totalRevenueHT = 0;
    let totalRevenueTTC = 0;
    let totalCOGS = 0; // Coût des Marchandises Vendues

    const productPerformance = new Map<number, {
      id: number;
      reference: string;
      designation: string;
      quantiteVendue: number;
      chiffreAffairesHT: number;
      coutAchatTotal: number;
      margeBrute: number;
    }>();

    (invoices || []).forEach((inv: any) => {
      totalRevenueHT += Number(inv.total_ht || 0);
      totalRevenueTTC += Number(inv.total_ttc || 0);

      const items = Array.isArray(inv.facture_items) ? inv.facture_items : [];
      items.forEach((item: any) => {
        const artId = Number(item.article_id);
        const art = articleMap.get(artId);
        const costPrice = Number(art?.p_achat_ht || 0);
        const qte = Number(item.qte || 0);
        const lineCA = Number(item.total_item_ht || item.pu_ht * qte || 0);
        const lineCOGS = costPrice * qte;

        totalCOGS += lineCOGS;

        if (artId) {
          const current = productPerformance.get(artId) || {
            id: artId,
            reference: art?.reference || `ART-${artId}`,
            designation: item.description || art?.designation || "Article",
            quantiteVendue: 0,
            chiffreAffairesHT: 0,
            coutAchatTotal: 0,
            margeBrute: 0,
          };

          current.quantiteVendue += qte;
          current.chiffreAffairesHT += lineCA;
          current.coutAchatTotal += lineCOGS;
          current.margeBrute += (lineCA - lineCOGS);

          productPerformance.set(artId, current);
        }
      });
    });

    // Gross Profit (Marge Brute)
    const grossProfit = totalRevenueHT - totalCOGS;
    const grossMarginRate = totalRevenueHT > 0 ? (grossProfit / totalRevenueHT) * 100 : 0;

    // 6. Operating Expenses Analysis
    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};

    (depenses || []).forEach((d: any) => {
      const amount = Number(d.montant || 0);
      totalExpenses += amount;
      const cat = d.categorie || "Autres Frais";
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amount;
    });

    const expensesList = Object.entries(expensesByCategory).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);

    // 7. Net Profit / Loss (Résultat Net)
    const netResult = grossProfit - totalExpenses;
    const netMarginRate = totalRevenueHT > 0 ? (netResult / totalRevenueHT) * 100 : 0;

    // Top Profitable Products
    const topProducts = Array.from(productPerformance.values())
      .sort((a, b) => b.margeBrute - a.margeBrute)
      .slice(0, 10);

    return NextResponse.json({
      company,
      period: { start: start || "Début", end: end || "Aujourd'hui" },
      summary: {
        chiffreAffairesHT: totalRevenueHT,
        chiffreAffairesTTC: totalRevenueTTC,
        coutMarchandisesVendues: totalCOGS,
        margeBrute: grossProfit,
        tauxMargeBrute: Number(grossMarginRate.toFixed(1)),
        totalDepenses: totalExpenses,
        resultatNet: netResult,
        tauxMargeNette: Number(netMarginRate.toFixed(1)),
        isBenefice: netResult >= 0,
        nombreFactures: (invoices || []).length,
      },
      expensesList,
      topProducts,
    });
  } catch (error: any) {
    console.error("Profit & Loss report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
