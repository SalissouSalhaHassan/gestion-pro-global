import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";

    const { data, error } = await supabase
      .from("types")
      .select("*")
      .eq("organization_id", orgId)
      .order("nom");
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";

    const { nom } = await request.json();
    if (!nom) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

    const { data, error } = await supabase
      .from("types")
      .insert({ nom, organization_id: orgId })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const { error } = await supabase
      .from("types")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
