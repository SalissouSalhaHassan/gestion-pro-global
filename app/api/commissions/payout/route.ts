import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { user_id, mois_annee, montant_paye, moyen_paiement, notes } = body;

    if (!user_id || !mois_annee || !montant_paye || Number(montant_paye) <= 0) {
      return NextResponse.json({ error: "Vendeur, mois et montant valide requis" }, { status: 400 });
    }

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";

    // Verify user belongs to same organization
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', Number(user_id))
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: "Vendeur introuvable dans votre organisation" }, { status: 403 });
    }

    const refRecu = `COM-PAY-${mois_annee.replace('-', '')}-${user_id}-${Math.floor(100 + Math.random() * 900)}`;

    const { data, error } = await supabase
      .from('commissions_versements')
      .insert({
        user_id: Number(user_id),
        mois_annee,
        montant_paye: Number(montant_paye),
        moyen_paiement: moyen_paiement || "Espèces",
        reference_recu: refRecu,
        paye_par: session.username || "Direction",
        organization_id: orgId,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, payout: data });
  } catch (error: any) {
    console.error("Commission payout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
