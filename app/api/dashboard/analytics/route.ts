import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { applyUserScope } from "@/lib/utils/scoping";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(user);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // ── Date helpers ──
    const firstDayCurrentMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
    const lastDayCurrentMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];
    const firstDayPrevMonth = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
    const lastDayPrevMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";

    // ═══════════════════════════════════════════════════════════════
    // 1. TOP SELLING PRODUCTS (based on facture_items)
    // ═══════════════════════════════════════════════════════════════
    let topProductsQuery = supabase
      .from("facture_items")
      .select("article_id, qte, articles(designation), factures!inner(is_deleted, date_facture, vendeur, organization_id)")
      .eq("factures.is_deleted", false)
      .eq("factures.organization_id", orgId)
      .gte("factures.date_facture", firstDayCurrentMonth)
      .lte("factures.date_facture", lastDayCurrentMonth);

    const { data: itemsRaw } = await topProductsQuery;

    // Aggregate by product name
    const productMap: Record<string, number> = {};
    (itemsRaw || []).forEach((item: any) => {
      const artObj = Array.isArray(item.articles) ? item.articles[0] : item.articles;
      const name = artObj?.designation || `Article #${item.article_id}`;
      productMap[name] = (productMap[name] || 0) + Number(item.qte || 0);
    });

    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, qty]) => ({ 
        name: name.length > 20 ? name.substring(0, 20) + '…' : name, 
        qty: Math.round(qty) 
      }));

    // ═══════════════════════════════════════════════════════════════
    // 2. TOP PERFORMING SELLERS / CASHIERS
    // ═══════════════════════════════════════════════════════════════
    let sellerQuery = supabase
      .from("factures")
      .select("vendeur, total_ttc")
      .eq("is_deleted", false)
      .gte("date_facture", firstDayCurrentMonth)
      .lte("date_facture", lastDayCurrentMonth);

    sellerQuery = applyUserScope(sellerQuery as any, user, 'factures');
    const { data: sellerRaw } = await sellerQuery;

    const sellerMap: Record<string, number> = {};
    (sellerRaw || []).forEach((f: any) => {
      const seller = f.vendeur || "Caisse Principale";
      sellerMap[seller] = (sellerMap[seller] || 0) + Number(f.total_ttc || 0);
    });

    const topLocations = Object.entries(sellerMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }));

    // ═══════════════════════════════════════════════════════════════
    // 3. MONTHLY COMPARISON (day-by-day current vs previous month)
    // ═══════════════════════════════════════════════════════════════
    let curMonthQuery = supabase
      .from("factures")
      .select("date_facture, total_ttc")
      .eq("is_deleted", false)
      .gte("date_facture", firstDayCurrentMonth)
      .lte("date_facture", lastDayCurrentMonth);
    curMonthQuery = applyUserScope(curMonthQuery as any, user, 'factures');
    const { data: curMonthRaw } = await curMonthQuery;

    let prevMonthQuery = supabase
      .from("factures")
      .select("date_facture, total_ttc")
      .eq("is_deleted", false)
      .gte("date_facture", firstDayPrevMonth)
      .lte("date_facture", lastDayPrevMonth);
    prevMonthQuery = applyUserScope(prevMonthQuery as any, user, 'factures');
    const { data: prevMonthRaw } = await prevMonthQuery;

    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    
    const monthlyComparison = [];
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const curDateStr = `${firstDayCurrentMonth.slice(0, 8)}${dayStr}`;
      const prevDateStr = `${firstDayPrevMonth.slice(0, 8)}${dayStr}`;

      const currentDayTotal = (curMonthRaw || [])
        .filter((f: any) => f.date_facture === curDateStr)
        .reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0);

      const prevDayTotal = (prevMonthRaw || [])
        .filter((f: any) => f.date_facture === prevDateStr)
        .reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0);

      monthlyComparison.push({
        day,
        current: currentDayTotal,
        previous: prevDayTotal,
      });
    }

    const currentMonthTotal = (curMonthRaw || []).reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0);
    const previousMonthTotal = (prevMonthRaw || []).reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0);

    let growthPercent = 0;
    if (previousMonthTotal > 0) {
      growthPercent = Math.round(((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100);
    } else if (currentMonthTotal > 0) {
      growthPercent = 100;
    }

    return NextResponse.json({
      topProducts,
      topLocations,
      monthlyComparison,
      summary: {
        currentMonthTotal,
        previousMonthTotal,
        growthPercent,
        currentMonthName: monthNames[currentMonth],
        previousMonthName: monthNames[(currentMonth + 11) % 12],
      }
    });

  } catch (error: any) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
