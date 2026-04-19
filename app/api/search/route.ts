import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.length < 2) {
      return NextResponse.json({ articles: [], clients: [], invoices: [] });
    }

    const supabase = await createClient();
    const user = await getServerSession();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // 1. Search Articles
    const { data: articles } = await supabase
      .from("articles")
      .select("id, reference, designation, p_vente_ttc")
      .or(`designation.ilike.%${query}%,reference.ilike.%${query}%,code_barre.ilike.%${query}%`)
      .eq("is_deleted", false)
      .limit(5);

    // 2. Search Clients
    const { data: clients } = await supabase
      .from("clients")
      .select("id, nom, ref_client, tel")
      .or(`nom.ilike.%${query}%,ref_client.ilike.%${query}%`)
      .eq("is_deleted", false)
      .limit(5);

    // 3. Search Invoices (Using bl_number as reference)
    const { data: invoices } = await supabase
      .from("factures")
      .select("id, bl_number, total_ttc, date_facture")
      .ilike("bl_number", `%${query}%`)
      .eq("is_deleted", false)
      .limit(5);

    return NextResponse.json({
      articles: articles || [],
      clients: clients || [],
      invoices: invoices || []
    });

  } catch (error: any) {
    console.error("Global Search API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
