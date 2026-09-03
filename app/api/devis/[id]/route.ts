import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const devisId = parseInt(rawId);
    if (isNaN(devisId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { data: devis, error } = await supabase
      .from("devis")
      .select("*, devis_items(*), clients(*)")
      .eq("id", devisId)
      .single();

    if (error || !devis) return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });

    const { data: company } = await supabase.from("informations_entreprise").select("*").maybeSingle();

    return NextResponse.json({ devis, company });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const devisId = parseInt(rawId);
    if (isNaN(devisId)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { error } = await supabase.from("devis").delete().eq("id", devisId);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
