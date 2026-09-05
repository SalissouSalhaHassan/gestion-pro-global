import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager, getAllowedDepots } from "@/lib/auth_helper";

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
    const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";

    // 2. Build Query (Strictly filtered by organization_id)
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
        depot,
        utilisateur, 
        user_id,
        article_id,
        articles ( reference, designation, p_achat_ht, p_vente_ttc )
      `)
      .eq("organization_id", orgId)
      .order("date_mouvement", { ascending: false })
      .range(offset, offset + limit - 1);

    const allowedDepots = getAllowedDepots(user);

    // Security: Sellers only see movements in their allowed depots.
    if (!isAdmin) {
      const depotsToFilter = allowedDepots.length > 0 ? allowedDepots : (userDepot ? [userDepot] : []);
      if (depotsToFilter.length > 0) {
        query = query.in("depot", depotsToFilter);
      }
    } 
    
    if (depotName && depotName !== "Tous") {
      if (!isAdmin) {
        const isAuthorized = allowedDepots.some(d => d.toLowerCase() === depotName.toLowerCase()) || 
                            (userDepot && userDepot.toLowerCase() === depotName.toLowerCase());
        if (!isAuthorized) {
          return NextResponse.json({ error: "Non autorisé pour ce dépôt" }, { status: 403 });
        }
      }
      query = query.eq("depot", depotName);
    } else if (depotId && depotId !== "Tous") {
      if (!isAdmin) {
        const isAuthorized = allowedDepots.some(d => d.toLowerCase() === String(depotId).toLowerCase()) || 
                            (userDepot && userDepot.toLowerCase() === String(depotId).toLowerCase());
        if (!isAuthorized) {
          return NextResponse.json({ error: "Non autorisé pour ce dépôt" }, { status: 403 });
        }
      }
      query = query.eq("depot", depotId);
    }

    // Date Filters
    if (startDate) query = query.gte("date_mouvement", `${startDate}T00:00:00`);
    if (endDate) query = query.lte("date_mouvement", `${endDate}T23:59:59`);

    // Article Filter
    if (articleId) query = query.eq("article_id", articleId);

    // Search
    if (search) {
      const { data: matchedArticles } = await supabase
        .from("articles")
        .select("id")
        .eq("organization_id", orgId)
        .or(`designation.ilike.%${search}%,reference.ilike.%${search}%`);
      
      const matchedIds = matchedArticles?.map((a: any) => a.id) || [];
      
      if (matchedIds.length > 0) {
        query = query.or(`nr_doc.ilike.%${search}%,fournisseur_client.ilike.%${search}%,article_id.in.(${matchedIds.join(",")})`);
      } else {
        query = query.or(`nr_doc.ilike.%${search}%,fournisseur_client.ilike.%${search}%`);
      }
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
