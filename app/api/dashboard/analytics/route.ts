import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { applyUserScope } from "@/lib/utils/scoping";

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

    // ═══════════════════════════════════════════════════════════════
    // 1. TOP SELLING PRODUCTS (based on facture_items quantities)
    // ═══════════════════════════════════════════════════════════════
    let topProductsQuery = supabase
      .from("facture_items")
      .select("description, qte, factures!inner(is_deleted, date_facture, vendeur, emplacement)")
      .eq("factures.is_deleted", false)
      .gte("factures.date_facture", firstDayCurrentMonth)
      .lte("factures.date_facture", lastDayCurrentMonth);

    const { data: itemsRaw } = await topProductsQuery;

    // Aggregate by product name
    const productMap: Record<string, number> = {};
    (itemsRaw || []).forEach((item: any) => {
      const name = item.description || "Inconnu";
      productMap[name] = (productMap[name] || 0) + Number(item.qte || 0);
    });

    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, qty]) => ({ name: name.length > 18 ? name.substring(0, 18) + '…' : name, qty: Math.round(qty) }));

    // ═══════════════════════════════════════════════════════════════
    // 2. MOST PROFITABLE LOCATIONS (based on factures.emplacement)
    // ═══════════════════════════════════════════════════════════════
    let locQuery = supabase
      .from("factures")
      .select("emplacement, total_ttc")
      .eq("is_deleted", false)
      .gte("date_facture", firstDayCurrentMonth)
      .lte("date_facture", lastDayCurrentMonth);

    locQuery = applyUserScope(locQuery as any, user, 'factures');
    const { data: locRaw } = await locQuery;

    const locMap: Record<string, number> = {};
    (locRaw || []).forEach((f: any) => {
      const loc = f.emplacement || "Non défini";
      locMap[loc] = (locMap[loc] || 0) + Number(f.total_ttc || 0);
    });

    const topLocations = Object.entries(locMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, revenue]) => ({ name, revenue: Math.round(revenue) }));

    // ═══════════════════════════════════════════════════════════════
    // 3. MONTHLY COMPARISON (day-by-day current vs previous month)
    // ═══════════════════════════════════════════════════════════════
    
    // Current month daily sales
    let curMonthQuery = supabase
      .from("factures")
      .select("date_facture, total_ttc")
      .eq("is_deleted", false)
      .gte("date_facture", firstDayCurrentMonth)
      .lte("date_facture", lastDayCurrentMonth);
    curMonthQuery = applyUserScope(curMonthQuery as any, user, 'factures');
    const { data: curMonthRaw } = await curMonthQuery;

    // Previous month daily sales
    let prevMonthQuery = supabase
      .from("factures")
      .select("date_facture, total_ttc")
      .eq("is_deleted", false)
      .gte("date_facture", firstDayPrevMonth)
      .lte("date_facture", lastDayPrevMonth);
    prevMonthQuery = applyUserScope(prevMonthQuery as any, user, 'factures');
    const { data: prevMonthRaw } = await prevMonthQuery;

    // Aggregate by day-of-month for comparison
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    
    const monthlyComparison = [];
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      
      const curDayTotal = (curMonthRaw || [])
        .filter((f: any) => f.date_facture && f.date_facture.endsWith(`-${dayStr}`))
        .reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0);
      
      const prevDayTotal = (prevMonthRaw || [])
        .filter((f: any) => f.date_facture && f.date_facture.endsWith(`-${dayStr}`))
        .reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0);

      monthlyComparison.push({
        day: String(day),
        current: Math.round(curDayTotal),
        previous: Math.round(prevDayTotal),
      });
    }

    // Total summaries
    const currentMonthTotal = (curMonthRaw || []).reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0);
    const previousMonthTotal = (prevMonthRaw || []).reduce((sum: number, f: any) => sum + Number(f.total_ttc || 0), 0);
    const growthPercent = previousMonthTotal > 0 
      ? (((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100).toFixed(1) 
      : currentMonthTotal > 0 ? "100" : "0";

    return NextResponse.json({
      topProducts,
      topLocations,
      monthlyComparison,
      summary: {
        currentMonthTotal: Math.round(currentMonthTotal),
        previousMonthTotal: Math.round(previousMonthTotal),
        growthPercent: Number(growthPercent),
        currentMonthName: monthNames[currentMonth],
        previousMonthName: monthNames[currentMonth === 0 ? 11 : currentMonth - 1],
      }
    });

  } catch (error: any) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
