import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { DEFAULT_CLIENT_ID } from "@/lib/client_helpers";

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

    const isAdmin = await isAdminOrManager(user);
    const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";

    // 1. Search Articles (Scoped by organization)
    const { data: articles } = await supabase
      .from("articles")
      .select("id, reference, designation, p_vente_ttc")
      .eq("organization_id", orgId)
      .or(`designation.ilike.%${query}%,reference.ilike.%${query}%,code_barre.ilike.%${query}%`)
      .eq("is_deleted", false)
      .limit(5);

    // 2. Search Clients (Scoped by organization, with isolation for Dépôt users)
    let clientQuery = supabase
      .from("clients")
      .select("id, nom, ref_client, tel")
      .eq("organization_id", orgId)
      .or(`nom.ilike.%${query}%,ref_client.ilike.%${query}%`)
      .eq("is_deleted", false);

    // ── CLIENT ISOLATION: Dépôt users only see their own clients + default client ──
    if (!isAdmin) {
      clientQuery = clientQuery.or(`created_by.eq.${user.id},id.eq.${DEFAULT_CLIENT_ID}`);
    }

    const { data: clients } = await clientQuery.limit(5);

    // 3. Search Invoices (Scoped by organization)
    const { data: invoices } = await supabase
      .from("factures")
      .select("id, bl_number, total_ttc, date_facture")
      .eq("organization_id", orgId)
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
