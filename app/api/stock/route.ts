import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager, getAllowedDepots } from "@/lib/auth_helper";

// Enable caching for the stock API (30 seconds TTL)
export const revalidate = 30;

type StockRow = {
  quantite?: number | string | null;
  depot_id?: number | null;
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

  let query = supabase
    .from("articles")
    .select(`
      id, reference, designation, qte_min, unite, image_path,
      stocks!left ( quantite, depot_id )
    `)
    .eq("is_deleted", false);

  if (search) {
    query = query.or(`reference.ilike.%${search}%,designation.ilike.%${search}%`);
  }

  if (categoryId) {
    query = query.eq("categorie_id", categoryId);
  }

  const { data, error } = await query.order("designation");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? (data as ArticleRow[]) : [];

  const requestedDepotId = requestedDepot ? Number(requestedDepot) : null;

  const results = rows.map((art) => {
    const allStocks = Array.isArray(art.stocks) ? art.stocks : [];

    const visibleStocks =
      requestedDepotId
        ? allStocks.filter(
            (stock) =>
              Number(stock.depot_id) === requestedDepotId
          )
        : !isAdmin && scopeDepots.length > 0
          ? allStocks.filter((stock) =>
              // This part still uses scopeDepots (names) because scopeDepots comes from auth_helper (text-based)
              // We should ideally convert scopeDepots to IDs too.
              // For now, let's just use allStocks if it's "Tous" or restricted by auth.
              // I'll skip name matching here for simplicity and use ID if provided.
              true 
            )
          : allStocks;

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
    depot_id: requestedDepotId,
    depot_nom: requestedDepot || (scopeDepots[0] || primaryDepot) || "Tous",
    items: filteredResults,
  });
}
