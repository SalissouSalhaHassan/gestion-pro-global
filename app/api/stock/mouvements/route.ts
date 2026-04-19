import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const articleId = searchParams.get("articleId");
  const search = searchParams.get("search");

  // 1. Auth check
  const user = await getServerSession();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = await isAdminOrManager(user);
  const userDepot = user.emplacement;

  // 2. Build Query
  let query = supabase
    .from("mouvements")
    .select(`
      id, nr_doc, date_mouvement, fournisseur_client, stock_avant, entree, sortie, stock_apres, type, depot, utilisateur, user_id,
      articles ( reference, designation )
    `)
    .order("date_mouvement", { ascending: true })
    .order("id", { ascending: true });

  // Security: Sellers only see movements in their depot.
  if (!isAdmin) {
    if (userDepot) {
      query = query.eq("depot", userDepot);
    }
  } else if (searchParams.get("depot") && searchParams.get("depot") !== "Tous") {
    // Admin can filter by any depot
    query = query.eq("depot", searchParams.get("depot"));
  }

  // Date Filters — append end of day to endDate to include full day transactions
  if (startDate) query = query.gte("date_mouvement", `${startDate}T00:00:00`);
  if (endDate) query = query.lte("date_mouvement", `${endDate}T23:59:59`);

  // Article Filter
  if (articleId) query = query.eq("article_id", articleId);

  // Search
  if (search) {
    query = query.or(`nr_doc.ilike.%${search}%,fournisseur_client.ilike.%${search}%`);
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

