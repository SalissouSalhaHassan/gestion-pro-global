import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { data: run, error } = await supabase
      .from('tournees_livraison')
      .select('*, colis:colis_livraison(*)')
      .eq('id', id)
      .single();

    if (error || !run) return NextResponse.json({ error: "Tournée introuvable" }, { status: 404 });

    return NextResponse.json({ run });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { statut } = body;

    const updates: any = {};
    if (statut) {
      updates.statut = statut;
      if (statut === 'EN_ROUTE') updates.date_depart = new Date().toISOString();
      if (statut === 'TERMINEE') updates.date_retour = new Date().toISOString();
    }

    const { data: run, error } = await supabase
      .from('tournees_livraison')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, run });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
