import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { data: runs, error } = await supabase
      .from('tournees_livraison')
      .select('*, colis:colis_livraison(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ runs: runs || [] });
  } catch (e: any) {
    console.error("Deliveries GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { chauffeur_nom, chauffeur_tel, vehicule_matricule, zone_livraison, notes, colis } = body;

    if (!chauffeur_nom) {
      return NextResponse.json({ error: "Nom du chauffeur requis" }, { status: 400 });
    }

    // Generate unique reference RUN-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const reference = `RUN-${dateStr}-${randomSuffix}`;

    const items = Array.isArray(colis) ? colis : [];
    const totalMontantCOD = items.reduce((sum: number, c: any) => sum + (Number(c.montant_a_encaisser) || 0), 0);

    // 1. Create run
    const { data: run, error: runErr } = await supabase
      .from('tournees_livraison')
      .insert({
        reference,
        chauffeur_nom,
        chauffeur_tel: chauffeur_tel || null,
        vehicule_matricule: vehicule_matricule || null,
        zone_livraison: zone_livraison || null,
        notes: notes || null,
        total_colis: items.length,
        total_montant_a_encaisser: totalMontantCOD,
        created_by: session.username || "Admin",
      })
      .select()
      .single();

    if (runErr) throw runErr;

    // 2. Insert packages
    if (items.length > 0) {
      const packageRows = items.map((c: any) => ({
        tournee_id: run.id,
        facture_id: c.facture_id ? Number(c.facture_id) : null,
        client_nom: c.client_nom || "Client",
        client_tel: c.client_tel || null,
        adresse_livraison: c.adresse_livraison || "À préciser",
        montant_a_encaisser: Number(c.montant_a_encaisser) || 0,
        statut_livraison: 'EN_ATTENTE',
      }));

      const { error: itemsErr } = await supabase
        .from('colis_livraison')
        .insert(packageRows);

      if (itemsErr) throw itemsErr;
    }

    return NextResponse.json({ success: true, run });
  } catch (e: any) {
    console.error("Deliveries POST error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
