import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const url = new URL(request.url);
    const typeOp = url.searchParams.get("type"); // 'A_ENCAISSER' or 'EMIS'
    const status = url.searchParams.get("status");

    let query = supabase
      .from('cheques_effets')
      .select('*, client:clients(nom, tel), fournisseur:fournisseurs(nom, tel)')
      .order('date_echeance', { ascending: true });

    if (typeOp && typeOp !== 'ALL') {
      query = query.eq('type_operation', typeOp);
    }
    if (status && status !== 'ALL') {
      query = query.eq('statut', status);
    }

    const { data: cheques, error } = await query;
    if (error) throw error;

    const list = cheques || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const in7DaysStr = in7Days.toISOString().slice(0, 10);

    const enPortefeuille = list.filter((c) => c.statut === 'EN_PORTEFEUILLE' || c.statut === 'DEPOSE_BANQUE');
    const totalEnPortefeuille = enPortefeuille.reduce((sum, c) => sum + (Number(c.montant) || 0), 0);

    const echusRetard = list.filter((c) => (c.statut === 'EN_PORTEFEUILLE' || c.statut === 'DEPOSE_BANQUE') && c.date_echeance < todayStr);
    const totalEchusRetard = echusRetard.reduce((sum, c) => sum + (Number(c.montant) || 0), 0);

    const echeanceSemaine = list.filter((c) => (c.statut === 'EN_PORTEFEUILLE' || c.statut === 'DEPOSE_BANQUE') && c.date_echeance >= todayStr && c.date_echeance <= in7DaysStr);
    const totalEcheanceSemaine = echeanceSemaine.reduce((sum, c) => sum + (Number(c.montant) || 0), 0);

    const encaisses = list.filter((c) => c.statut === 'ENCAISSE');
    const totalEncaisses = encaisses.reduce((sum, c) => sum + (Number(c.montant) || 0), 0);

    return NextResponse.json({
      cheques: list,
      kpis: {
        totalEnPortefeuille,
        countEnPortefeuille: enPortefeuille.length,
        totalEchusRetard,
        countEchusRetard: echusRetard.length,
        totalEcheanceSemaine,
        countEcheanceSemaine: echeanceSemaine.length,
        totalEncaisses,
        countEncaisses: encaisses.length,
      },
    });
  } catch (error: any) {
    console.error("Cheques GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const {
      type_operation,
      type_titre,
      numero_piece,
      banque_emetteur,
      emetteur_nom,
      beneficiaire_nom,
      montant,
      date_emission,
      date_echeance,
      client_id,
      fournisseur_id,
      facture_id,
      notes,
    } = body;

    if (!numero_piece || !banque_emetteur || !montant || !date_echeance) {
      return NextResponse.json({ error: "N° pièce, banque, montant et date d'échéance obligatoires" }, { status: 400 });
    }

    const { data: newCheque, error } = await supabase
      .from('cheques_effets')
      .insert({
        type_operation: type_operation || 'A_ENCAISSER',
        type_titre: type_titre || 'CHEQUE',
        numero_piece: numero_piece.trim(),
        banque_emetteur: banque_emetteur.trim(),
        emetteur_nom: emetteur_nom?.trim() || "Client",
        beneficiaire_nom: beneficiaire_nom?.trim() || "Entreprise",
        montant: Number(montant) || 0,
        date_emission: date_emission || new Date().toISOString().slice(0, 10),
        date_echeance,
        statut: 'EN_PORTEFEUILLE',
        client_id: client_id ? Number(client_id) : null,
        fournisseur_id: fournisseur_id ? Number(fournisseur_id) : null,
        facture_id: facture_id ? Number(facture_id) : null,
        notes: notes || null,
        created_by: session.username || "Admin",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, cheque: newCheque });
  } catch (error: any) {
    console.error("Cheques POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
