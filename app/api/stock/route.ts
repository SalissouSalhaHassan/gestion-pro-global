import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager, getAllowedDepots } from "@/lib/auth_helper";

// Disable caching for the stock API to ensure fresh data
export const revalidate = 0;

type StockRow = {
  quantite?: number | string | null;
  depot_nom?: string | null;
};

type ArticleRow = {
  id: number;
  reference: string;
  designation: string;
  qte_min: number | string | null;
  unite: string | null;
  image_path: string | null;
  stocks?: StockRow[] | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search");
  const categoryId = searchParams.get("categoryId");
  const lowStockOnly = searchParams.get("lowStock") === "true";
  const requestedDepot = searchParams.get("depot");

  const user = await getServerSession();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = await isAdminOrManager(user);
  const userDepots = await getAllowedDepots(user);
  const primaryDepot = user.emplacement || "Tous";
  const scopeDepots = isAdmin
    ? []
    : userDepots.length > 0
      ? userDepots
      : primaryDepot && primaryDepot !== "Tous"
        ? [primaryDepot]
        : [];

  if (
    requestedDepot &&
    requestedDepot !== "Tous" &&
    !isAdmin &&
    scopeDepots.length > 0 &&
    !scopeDepots.some((depot) => depot.toLowerCase() === requestedDepot.toLowerCase())
  ) {
    return NextResponse.json({ error: "Non autorise pour ce depot" }, { status: 403 });
  }

  // Fetch articles
  let articlesQuery = supabase
    .from("articles")
    .select(`id, reference, designation, qte_min, unite, image_path`)
    .eq("is_deleted", false);

  if (search) {
    articlesQuery = articlesQuery.or(`reference.ilike.%${search}%,designation.ilike.%${search}%`);
  }
  if (categoryId) {
    articlesQuery = articlesQuery.eq("categorie_id", categoryId);
  }

  const { data: articlesData, error: articlesErr } = await articlesQuery.order("designation");
  if (articlesErr) {
    return NextResponse.json({ error: articlesErr.message }, { status: 500 });
  }

  const articles = Array.isArray(articlesData) ? articlesData : [];
  const articleIds = articles.map(a => a.id);

  // Fetch stocks for these articles
  let stocksQuery = supabase
    .from("stocks")
    .select("article_id, quantite, depot_nom")
    .in("article_id", articleIds);

  const { data: stocksData, error: stocksErr } = await stocksQuery;
  if (stocksErr) {
     console.error("Stocks fetch error:", stocksErr);
     // If stocks table is the problem, we still want to show articles with 0 stock
  }

  const stocks = Array.isArray(stocksData) ? stocksData : [];

  const results = articles.map((art) => {
    // Filter stocks for this article based on user scope and requested depot
    let articleStocks = stocks.filter(s => s.article_id === art.id);

    let visibleStocks = articleStocks;
    
    if (requestedDepot && requestedDepot !== "Tous") {
      visibleStocks = articleStocks.filter((stock) => {
        const stockDepot = String(stock.depot_nom || "").toLowerCase();
        const reqDepot = requestedDepot.toLowerCase();
        return stockDepot === reqDepot;
      });
    } else if (!isAdmin && scopeDepots.length > 0) {
      visibleStocks = articleStocks.filter((stock) => {
        const stockDepot = String(stock.depot_nom || "").toLowerCase();
        return scopeDepots.some(sd => sd.toLowerCase() === stockDepot);
      });
    }

    const quantite = visibleStocks.reduce(
      (sum, stock) => sum + Number(stock.quantite || 0),
      0
    );

    return {
      id: art.id,
      reference: art.reference,
      designation: art.designation,
      qte_min: Number(art.qte_min || 0),
      unite: art.unite,
      image_path: art.image_path,
      quantite,
      stocks: visibleStocks,
      is_low: quantite <= Number(art.qte_min || 0) && quantite > 0,
      is_out: quantite <= 0,
    };
  });

  let filteredResults = results;
  if (lowStockOnly) {
    filteredResults = results.filter((row) => row.is_low || row.is_out);
  }

  return NextResponse.json({
    depot_nom: requestedDepot || (scopeDepots[0] || primaryDepot) || "Tous",
    items: filteredResults,
  });
}
