import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { data: cheque, error } = await supabase
      .from('cheques_effets')
      .select('*, client:clients(nom, tel, adresse), fournisseur:fournisseurs(nom, tel)')
      .eq('id', id)
      .single();

    if (error || !cheque) {
      return NextResponse.json({ error: "Chèque non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ cheque });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { action, bordereau_remise, motif_rejet, date_action, ...fields } = body;

    let updateData: Record<string, any> = {};

    if (action === 'DEPOSE_BANQUE') {
      updateData = {
        statut: 'DEPOSE_BANQUE',
        date_depot: date_action || new Date().toISOString(),
        bordereau_remise: bordereau_remise?.trim() || null,
      };
    } else if (action === 'ENCAISSE') {
      updateData = {
        statut: 'ENCAISSE',
        date_encaissement: date_action || new Date().toISOString(),
      };
    } else if (action === 'REJETE') {
      updateData = {
        statut: 'REJETE',
        motif_rejet: motif_rejet?.trim() || "Chèque sans provision / contesté",
      };
    } else if (action === 'ANNULE') {
      updateData = {
        statut: 'ANNULE',
      };
    } else if (action === 'REMETTRE_EN_PORTEFEUILLE') {
      updateData = {
        statut: 'EN_PORTEFEUILLE',
        motif_rejet: null,
      };
    } else {
      // General direct update
      if (fields.numero_piece) updateData.numero_piece = fields.numero_piece;
      if (fields.banque_emetteur) updateData.banque_emetteur = fields.banque_emetteur;
      if (fields.montant !== undefined) updateData.montant = Number(fields.montant);
      if (fields.date_echeance) updateData.date_echeance = fields.date_echeance;
      if (fields.date_emission) updateData.date_emission = fields.date_emission;
      if (fields.notes !== undefined) updateData.notes = fields.notes;
      if (fields.emetteur_nom) updateData.emetteur_nom = fields.emetteur_nom;
      if (fields.beneficiaire_nom) updateData.beneficiaire_nom = fields.beneficiaire_nom;
      if (fields.type_titre) updateData.type_titre = fields.type_titre;
      if (fields.statut) updateData.statut = fields.statut;
    }

    const { data: updated, error } = await supabase
      .from('cheques_effets')
      .update(updateData)
      .eq('id', id)
      .select('*, client:clients(nom, tel), fournisseur:fournisseurs(nom, tel)')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, cheque: updated });
  } catch (error: any) {
    console.error("Cheque PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { error } = await supabase
      .from('cheques_effets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
