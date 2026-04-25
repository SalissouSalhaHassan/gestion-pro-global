import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const requestedDepot = searchParams.get("depot");
    const categoryId = searchParams.get("categoryId");

    const user = await getServerSession();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const isAdmin = await isAdminOrManager(user);
    const userEmplacement = user.emplacement || "Tous";

    // 1. Fetch articles with categories
    let articlesQuery = supabase
      .from("articles")
      .select(`
        id, 
        reference, 
        designation, 
        p_achat_ht, 
        p_vente_ttc, 
        unite, 
        categorie_id,
        categories (nom)
      `)
      .eq("is_deleted", false);

    if (categoryId && categoryId !== "all") {
      articlesQuery = articlesQuery.eq("categorie_id", categoryId);
    }

    const { data: articlesData, error: articlesErr } = await articlesQuery;
    if (articlesErr) throw articlesErr;

    const articles = articlesData || [];
    const articleIds = articles.map(a => a.id);

    // 2. Fetch stocks
    let stocksQuery = supabase
      .from("stocks")
      .select("article_id, quantite, depot_nom")
      .in("article_id", articleIds);

    const { data: stocksData, error: stocksErr } = await stocksQuery;
    if (stocksErr) throw stocksErr;

    const stocks = stocksData || [];

    // 3. Process data
    const valuationItems = articles.map(art => {
      let articleStocks = stocks.filter(s => s.article_id === art.id);
      
      // Filter by depot if requested
      if (requestedDepot && requestedDepot !== "Tous") {
        articleStocks = articleStocks.filter(s => s.depot_nom === requestedDepot);
      } else if (!isAdmin && userEmplacement !== "Tous") {
        articleStocks = articleStocks.filter(s => s.depot_nom === userEmplacement);
      }

      const totalQty = articleStocks.reduce((sum, s) => sum + Number(s.quantite || 0), 0);
      const valAchat = totalQty * Number(art.p_achat_ht || 0);
      const valVente = totalQty * Number(art.p_vente_ttc || 0);

      return {
        id: art.id,
        reference: art.reference,
        designation: art.designation,
        p_achat_ht: Number(art.p_achat_ht || 0),
        p_vente_ttc: Number(art.p_vente_ttc || 0),
        unite: art.unite,
        famille: art.categories?.nom || "Non classé",
        quantite: totalQty,
        total_valeur_achat: valAchat,
        total_valeur_vente: valVente
      };
    }).filter(item => item.quantite !== 0); // Only show items with stock if needed, or all? Python script shows all. 
    // Actually, Python script usually shows items with stock or just all filtered.

    const summary = {
      total_items: valuationItems.length,
      total_qte: valuationItems.reduce((sum, i) => sum + i.quantite, 0),
      total_valeur_achat: valuationItems.reduce((sum, i) => sum + i.total_valeur_achat, 0),
      total_valeur_vente: valuationItems.reduce((sum, i) => sum + i.total_valeur_vente, 0)
    };

    return NextResponse.json({
      items: valuationItems,
      summary
    });

  } catch (error: any) {
    console.error("Valuation API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
