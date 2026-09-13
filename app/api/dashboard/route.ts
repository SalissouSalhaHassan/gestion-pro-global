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
      .select("total_ttc, date_facture, statut")
      .gte("date_facture", today)
      .lte("date_facture", `${today}T23:59:59.999Z`)
      .neq("statut", "Annulée")
      .or("is_deleted.eq.false,is_deleted.is.null");
    
    invoicesQuery = applyUserScope(invoicesQuery as any, user, 'factures');
    const { data: salesData, error: salesError } = await invoicesQuery;

    if (salesError) throw salesError;

    const todaySales = salesData?.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0) || 0;
    const todayInvoices = salesData?.length || 0;

    // 2. Total Articles & Clients (Multi-Tenant Scoped)
    let articlesCountQuery = supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .or("is_deleted.eq.false,is_deleted.is.null");
    articlesCountQuery = applyUserScope(articlesCountQuery as any, user, "articles");
    const { count: totalProductsCount } = await articlesCountQuery;

    let clientsCountQuery = supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .or("is_deleted.eq.false,is_deleted.is.null");
    clientsCountQuery = applyUserScope(clientsCountQuery as any, user, "clients");
    const { count: totalClientsCount } = await clientsCountQuery;

    // 3. Stock Faible (Fast Server-Side Aggregation)
    let lowStockCount = 0;
    try {
      const { data: countData, error: countError } = await supabase.rpc("get_low_stock_count", {
        p_org_id: user.organization_id || null,
      });

      if (!countError && typeof countData === "number") {
        lowStockCount = countData;
      } else {
        // Fallback: bounded lightweight query if RPC not yet created in remote DB
        let stockQuery = supabase
          .from("articles")
          .select(`id, qte_min, stocks(quantite)`)
          .or("is_deleted.eq.false,is_deleted.is.null")
          .limit(250);

        stockQuery = applyUserScope(stockQuery as any, user, "articles");
        const { data: stockData } = await stockQuery;

        lowStockCount = (stockData || []).filter((art: any) => {
          const totalStock = art.stocks?.reduce((sum: number, s: any) => sum + Number(s.quantite || 0), 0) || 0;
          return totalStock < (art.qte_min || 0);
        }).length;
      }
    } catch (e) {
      console.warn("Fast low stock count error, defaulting to 0:", e);
    }

    // 4. Activité Récente (Scoped)
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

    // 5. Performance du Stock (Sales over last 7 days) (Scoped)
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
      totalProducts: totalProductsCount ?? 0,
      totalClients: totalClientsCount ?? 0,
      recentActivity: mappedActivity,
      chartData
    });

  } catch (error: any) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
