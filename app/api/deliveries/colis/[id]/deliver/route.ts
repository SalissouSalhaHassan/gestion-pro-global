import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { nom_receptionnaire, commentaire, montant_encaisse } = body;

    // 1. Fetch package
    const { data: colis, error: colisErr } = await supabase
      .from('colis_livraison')
      .select('*, tournee:tournees_livraison(*)')
      .eq('id', id)
      .single();

    if (colisErr || !colis) return NextResponse.json({ error: "Colis introuvable" }, { status: 404 });

    // 2. Mark as LIVRE
    const { data: updatedColis, error: updErr } = await supabase
      .from('colis_livraison')
      .update({
        statut_livraison: 'LIVRE',
        heure_livraison: new Date().toISOString(),
        nom_receptionnaire: nom_receptionnaire || colis.client_nom,
        commentaire: commentaire || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw updErr;

    // 3. Update total_encaisse on parent run
    const collectedAmount = Number(montant_encaisse ?? colis.montant_a_encaisser) || 0;
    if (collectedAmount > 0) {
      const currentEncaisse = Number(colis.tournee?.total_encaisse) || 0;
      await supabase
        .from('tournees_livraison')
        .update({
          total_encaisse: currentEncaisse + collectedAmount,
        })
        .eq('id', colis.tournee_id);
    }

    return NextResponse.json({ success: true, colis: updatedColis });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
