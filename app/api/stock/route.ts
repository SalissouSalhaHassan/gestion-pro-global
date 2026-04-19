import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager, getAllowedDepots } from "@/lib/auth_helper";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const search = searchParams.get("search");
  const categoryId = searchParams.get("categoryId");
  const lowStockOnly = searchParams.get("lowStock") === "true";

  // 1. Get current Authenticated User from custom session
  const user = await getServerSession();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = await isAdminOrManager(user);
  const userDepots = await getAllowedDepots(user);
  const primaryDepot = user.emplacement || "Tous";

  // 2. Build Query
  let query = supabase
    .from("articles")
    .select(`
      id, reference, designation, qte_min, unite, image_path,
      stocks!left ( quantite, depot_nom )
    `)
    .eq("is_deleted", false);

  // Apply Scoping (Warehouse Access Control)
  const { applyUserScope } = await import("@/lib/utils/scoping");
  query = await applyUserScope(query as any, user, 'stocks');

  // Filter by requested depot if provided
  const requestedDepot = searchParams.get("depot");
  if (requestedDepot && requestedDepot !== "Tous") {
    query = query.filter("stocks.depot_nom", "ilike", requestedDepot);
  }

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

  // 3. Post-process
  let results = data.map((art: any) => {
    let quantite = 0;
    const targetDepot = requestedDepot || (isAdmin ? "Tous" : primaryDepot);
    
    if (targetDepot && targetDepot !== "Tous") {
      const stockRecord = art.stocks?.find((s: any) => 
        s.depot_nom?.toLowerCase() === targetDepot.toLowerCase()
      );
      quantite = stockRecord ? Number(stockRecord.quantite) : 0;
    } else {
      quantite = art.stocks?.reduce((sum: number, s: any) => sum + Number(s.quantite || 0), 0) || 0;
    }
    
    return {
      id: art.id,
      reference: art.reference,
      designation: art.designation,
      qte_min: Number(art.qte_min || 0),
      unite: art.unite,
      image_path: art.image_path,
      quantite: quantite,
      stocks: art.stocks || [],
      is_low: quantite <= Number(art.qte_min || 0) && quantite > 0,
      is_out: quantite <= 0
    };
  });

  if (lowStockOnly) {
    results = results.filter((r: any) => r.is_low || r.is_out);
  }

  return NextResponse.json({
    depot: requestedDepot || primaryDepot || "Tous",
    items: results
  });
}

