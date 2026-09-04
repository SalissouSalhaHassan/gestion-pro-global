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
