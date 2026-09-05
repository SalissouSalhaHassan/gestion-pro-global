import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";

    // 1. Fetch Depots strictly scoped by organization_id
    const { data: depots, error: depotsError } = await supabase
      .from("depots")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_deleted", false)
      .order("nom");

    if (depotsError) throw depotsError;

    // 2. Fetch Users for responsible selection (scoped by organization)
    const { data: users } = await supabase
      .from("users")
      .select("utilisateur, nom_prenom")
      .eq("organization_id", orgId)
      .order("utilisateur");

    // 3. Fetch Stock summaries for these depots (scoped by organization)
    const { data: stockData } = await supabase
      .from("stocks")
      .select("depot_nom, quantite, articles(prix_achat)")
      .eq("organization_id", orgId);

    const stockMap: Record<string, { count: number; value: number }> = {};
    if (stockData) {
      stockData.forEach((st: any) => {
        const dNom = st.depot_nom || "BOUTIQUE";
        if (!stockMap[dNom]) stockMap[dNom] = { count: 0, value: 0 };
        const qty = Number(st.quantite) || 0;
        const cost = Number(st.articles?.prix_achat) || 0;
        stockMap[dNom].count += 1;
        stockMap[dNom].value += qty * cost;
      });
    }

    const enrichedDepots = (depots || []).map((d: any) => ({
      ...d,
      articles_count: stockMap[d.nom]?.count || 0,
      total_value: stockMap[d.nom]?.value || 0,
    }));

    return NextResponse.json({
      depots: enrichedDepots,
      users: (users || []).map((u: any) => u.nom_prenom || u.utilisateur),
      currentOrgId: orgId,
    });
  } catch (error: any) {
    console.error("Depots GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { id, nom, code_depot, emplacement, responsable, is_active = true } = body;

    if (!nom || !nom.trim()) {
      return NextResponse.json({ error: "Le nom du dépôt est requis" }, { status: 400 });
    }

    const payload: any = {
      nom: nom.trim(),
      code_depot: code_depot ? code_depot.trim().toUpperCase() : null,
      emplacement: emplacement ? emplacement.trim() : nom.trim(),
      responsable: responsable ? responsable.trim() : null,
      is_active: Boolean(is_active),
      organization_id: orgId,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      // Update existing depot (ensure it belongs to this org)
      const { data, error } = await supabase
        .from("depots")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Insert new depot
      payload.created_at = new Date().toISOString();
      payload.is_deleted = false;
      const { data, error } = await supabase
        .from("depots")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }
  } catch (error: any) {
    console.error("Depots POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    // Soft delete
    const { error } = await supabase
      .from("depots")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Depots DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
