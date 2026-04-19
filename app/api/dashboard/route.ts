import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Ventes du jour & Factures émises
    const { data: salesData, error: salesError } = await supabase
      .from("factures")
      .select("total_ttc")
      .eq("date_facture", today)
      .eq("is_deleted", false);

    if (salesError) throw salesError;

    const todaySales = salesData?.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0) || 0;
    const todayInvoices = salesData?.length || 0;

    // 2. Stock Faible
    // We join articles with their stock sum across all depots
    // This is easier via a RPC or manual aggregation due to Supabase query limits on complex joins
    const { data: stockData, error: stockError } = await supabase
      .from("articles")
      .select(`
        id, qte_min,
        stocks ( quantite )
      `)
      .eq("is_deleted", false);

    if (stockError) throw stockError;

    const lowStockCount = stockData?.filter(art => {
      const totalStock = art.stocks?.reduce((sum: number, s: any) => sum + Number(s.quantite || 0), 0) || 0;
      return totalStock < (art.qte_min || 0);
    }).length || 0;

    // 3. Activité Récente (Last 5 movements)
    const { data: recentActivity, error: activityError } = await supabase
      .from("mouvements")
      .select(`
        id, type, quantite, date_mouvement,
        articles ( designation )
      `)
      .order("id", { ascending: false })
      .limit(5);

    if (activityError) throw activityError;

    const mappedActivity = recentActivity?.map(act => ({
      id: act.id,
      type: act.type,
      quantite: act.quantite,
      designation: act.articles?.designation || "Inconnu",
      date: act.date_mouvement
    })) || [];

    // 4. Performance du Stock (Sales over last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const { data: performanceRes, error: perfError } = await supabase
      .from("mouvements")
      .select("date_mouvement, sortie")
      .in("date_mouvement", last7Days)
      .filter("type", "ilike", "VENTE%"); // Assuming sales are logged as VENTE in POS

    if (perfError) throw perfError;

    const chartData = last7Days.map(date => {
       const dailyVolume = performanceRes?.filter(m => m.date_mouvement === date)
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
