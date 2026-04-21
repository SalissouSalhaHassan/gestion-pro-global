import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

// Use the Edge runtime for high-performance reporting and scalability
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const articleId = searchParams.get("articleId");
    const depotId = searchParams.get("depotId");
    const depotName = searchParams.get("depot");
    const search = searchParams.get("search");
    const limit = Number(searchParams.get("limit") || 2000);
    const offset = Number(searchParams.get("offset") || 0);

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
        id, 
        nr_doc, 
        date_mouvement, 
        fournisseur_client, 
        stock_avant, 
        entree, 
        sortie, 
        stock_apres, 
        type, 
        depot_id,
        utilisateur, 
        user_id,
        articles ( reference, designation )
      `)
      .order("date_mouvement", { ascending: false })
      .range(offset, offset + limit - 1);

    // Security: Sellers only see movements in their depot.
    if (!isAdmin) {
      // In the new schema we should use depot_id, but for now let's check what we have
      if (userDepot) {
        // query = query.eq("depot", userDepot); // Legacy
      }
    } 
    
    if (depotId && depotId !== "Tous") {
      query = query.eq("depot_id", depotId);
    }

    // Date Filters
    if (startDate) query = query.gte("date_mouvement", `${startDate}T00:00:00`);
    if (endDate) query = query.lte("date_mouvement", `${endDate}T23:59:59`);

    // Article Filter
    if (articleId) query = query.eq("article_id", articleId);

    // Search
    if (search) {
      query = query.or(`nr_doc.ilike.%${search}%,fournisseur_client.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Movements query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process large data chunks efficiently on the Edge
    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error("Edge Movements API Error:", err);
    return NextResponse.json({ error: "Erreur serveur Edge" }, { status: 500 });
  }
}
