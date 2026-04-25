import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";
import { applyUserScope } from "@/lib/utils/scoping";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // 1. Fetch Low Stock Articles
    let stockQuery = supabase
      .from("articles")
      .select(`
        id, designation, reference, qte_min,
        stocks ( quantite )
      `)
      .eq("is_deleted", false);
    
    stockQuery = applyUserScope(stockQuery as any, user, 'articles');
    const { data: stockData } = await stockQuery;

    const lowStock = (stockData || [])
      .map(art => {
        const current = art.stocks?.reduce((sum: number, s: any) => sum + Number(s.quantite || 0), 0) || 0;
        return { ...art, current };
      })
      .filter(art => art.current < (art.qte_min || 0))
      .map(art => ({
        id: `stock-${art.id}`,
        type: "stock",
        title: "Stock Faible",
        message: `${art.designation} (${art.current} restants / min ${art.qte_min})`,
        link: "/dashboard/stock"
      }));

    // 2. Fetch Late Rent Payments
    let rentQuery = supabase
      .from("loyers")
      .select("id, locataire_nom_complet, retards, mois_impayes")
      .or("retards.gt.0,mois_impayes.ilike.%m%")
      .eq("statut", "Actif");
    
    rentQuery = applyUserScope(rentQuery as any, user, 'loyers');
    const { data: rentData } = await rentQuery;

    const lateRents = (rentData || []).map(r => ({
      id: `rent-${r.id}`,
      type: "rent",
      title: "Loyer Impayé",
      message: `${r.locataire_nom_complet} (${r.mois_impayes})`,
      link: `/dashboard/loyers/${r.id}`
    }));

    return NextResponse.json([...lowStock, ...lateRents]);

  } catch (error: any) {
    console.error("Notifications API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
