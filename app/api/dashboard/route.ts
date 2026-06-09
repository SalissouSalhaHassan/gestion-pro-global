import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";
import { applyUserScope } from "@/lib/utils/scoping";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Ventes du jour & Factures émises (Scoped)
    let invoicesQuery = supabase
      .from("factures")
      .select("total_ttc")
      .eq("date_facture", today)
      .eq("is_deleted", false);
    
    invoicesQuery = applyUserScope(invoicesQuery as any, user, 'factures');
    const { data: salesData, error: salesError } = await invoicesQuery;

    if (salesError) throw salesError;

    const todaySales = salesData?.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0) || 0;
    const todayInvoices = salesData?.length || 0;

    // 2. Stock Faible (Scoped)
    let stockQuery = supabase
      .from("articles")
      .select(`
        id, qte_min,
        stocks ( quantite, depot_nom )
      `)
      .eq("is_deleted", false);
    
    stockQuery = applyUserScope(stockQuery as any, user, 'articles');
    const { data: stockData, error: stockError } = await stockQuery;

    if (stockError) throw stockError;

    const lowStockCount = stockData?.filter(art => {
      const totalStock = art.stocks?.reduce((sum: number, s: any) => sum + Number(s.quantite || 0), 0) || 0;
      return totalStock < (art.qte_min || 0);
    }).length || 0;

    // 3. Activité Récente (Scoped)
    let activityQuery = supabase
      .from("mouvements")
      .select(`
        id, type, quantite, date_mouvement,
        articles ( designation )
      `)
      .order("id", { ascending: false })
      .limit(5);

    activityQuery = applyUserScope(activityQuery as any, user, 'mouvements');
    const { data: recentActivity, error: activityError } = await activityQuery;

    if (activityError) throw activityError;

    const mappedActivity = recentActivity?.map(act => {
      const artObj = Array.isArray(act.articles) ? act.articles[0] : act.articles;
      return {
        id: act.id,
        type: act.type,
        quantite: act.quantite,
        designation: artObj?.designation || "Inconnu",
        date: act.date_mouvement
      }
    }) || [];

    // 4. Performance du Stock (Sales over last 7 days) (Scoped)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const earliestDate = last7Days[0]; // the oldest day since it was reversed
    
    let performanceQuery = supabase
      .from("mouvements")
      .select("date_mouvement, sortie")
      .gte("date_mouvement", earliestDate)
      .filter("type", "ilike", "VENTE%");

    performanceQuery = applyUserScope(performanceQuery as any, user, 'mouvements');
    const { data: performanceRes, error: perfError } = await performanceQuery;

    if (perfError) throw perfError;

    const chartData = last7Days.map(date => {
       const dailyVolume = performanceRes?.filter(m => m.date_mouvement && m.date_mouvement.startsWith(date))
                                     .reduce((sum, m) => sum + Number(m.sortie || 0), 0) || 0;
       return dailyVolume;
    });

    return NextResponse.json({
      todaySales,
      todayInvoices,
      lowStockCount,
      recentActivity: mappedActivity,
      chartData
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
