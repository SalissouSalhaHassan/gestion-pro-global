import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

// Use the Edge runtime for high-performance reporting and scalability
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 1000);
    const offset = Number(searchParams.get("offset") || 0);
    const articleId = searchParams.get("articleId");
    const depotId = searchParams.get("depotId");

    // Build query for large movement reports
    let query = supabase
      .from("mouvements")
      .select(`
        id, 
        nr_doc, 
        date_mouvement, 
        fournisseur_client, 
        stock_avant, 
        quantite, 
        stock_apres, 
        type, 
        utilisateur,
        articles ( designation, reference ),
        depots ( nom )
      `)
      .order("date_mouvement", { ascending: false })
      .range(offset, offset + limit - 1);

    if (articleId) query = query.eq("article_id", articleId);
    if (depotId) query = query.eq("depot_id", depotId);

    const { data, error } = await query;

    if (error) {
      console.error("Movements report error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process large data chunks efficiently on the Edge
    const processedData = (data || []).map(m => ({
      ...m,
      designation: m.articles?.designation,
      reference: m.articles?.reference,
      depot: m.depots?.nom
    }));

    return NextResponse.json({
      ok: true,
      count: processedData.length,
      data: processedData,
      pagination: {
        limit,
        offset,
        next_offset: offset + limit
      }
    });
  } catch (err: any) {
    console.error("Edge Report Error:", err);
    return NextResponse.json({ error: "Erreur serveur Edge" }, { status: 500 });
  }
}
