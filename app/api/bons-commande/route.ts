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

    const { searchParams } = new URL(request.url);
    const statut = searchParams.get('statut');
    const search = searchParams.get('search');

    let query = supabase
      .from('bons_commande')
      .select('*, items:bon_commande_items(*)')
      .order('created_at', { ascending: false });

    if (session.organization_id) {
      query = query.eq('organization_id', session.organization_id);
    }

    if (statut && statut !== 'ALL') {
      query = query.eq('statut', statut);
    }
    if (search) {
      query = query.or(`numero_bc.ilike.%${search}%,fournisseur_nom.ilike.%${search}%`);
    }

    const { data: bcs, error } = await query;
    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('bons_commande') || error.message?.includes('schema cache')) {
        console.warn("Table bons_commande not yet created in Supabase. Returning empty array.");
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(bcs || []);
  } catch (error: any) {
    console.error("Bons de commande GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { fournisseur_id, fournisseur_nom, date_livraison_prevue, notes, depot_id, items } = body;

    if (!fournisseur_nom || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Fournisseur et articles requis" }, { status: 400 });
    }

    // Auto-generate BC number (e.g., BC-2026-0001)
    const year = new Date().getFullYear();
    let countQuery = supabase
      .from('bons_commande')
      .select('*', { count: 'exact', head: true });
    if (session.organization_id) {
      countQuery = countQuery.eq('organization_id', session.organization_id);
    }
    const { count } = await countQuery;

    const nextSeq = (count || 0) + 1;
    const numero_bc = `BC-${year}-${String(nextSeq).padStart(4, '0')}`;

    const total_ht = items.reduce((sum: number, it: any) => sum + (Number(it.quantite) * Number(it.prix_achat_unitaire) || 0), 0);
    const total_ttc = total_ht; // Standard HT / TTC

    // Insert Header
    const { data: newBc, error: headerErr } = await supabase
      .from('bons_commande')
      .insert({
        numero_bc,
        date_commande: new Date().toISOString().split('T')[0],
        date_livraison_prevue: date_livraison_prevue || null,
        fournisseur_id: fournisseur_id || null,
        fournisseur_nom,
        statut: 'BROUILLON',
        total_ht,
        total_ttc,
        notes: notes || '',
        depot_id: depot_id || null,
        created_by: session.username || 'Admin',
        organization_id: session.organization_id || '00000000-0000-0000-0000-000000000001',
      })
      .select()
      .single();

    if (headerErr) {
      if (headerErr.code === 'PGRST204' || headerErr.message?.includes('bons_commande') || headerErr.message?.includes('schema cache')) {
        return NextResponse.json({
          error: "La table 'bons_commande' n'est pas encore initialisée dans Supabase. Veuillez exécuter le script SQL dans l'éditeur Supabase SQL Editor pour activer ce module.",
          migrationRequired: true
        }, { status: 400 });
      }
      throw headerErr;
    }

    // Insert Items
    const itemsToInsert = items.map((it: any) => ({
      bon_commande_id: newBc.id,
      article_id: it.article_id || null,
      reference: it.reference || null,
      designation: it.designation,
      quantite: Number(it.quantite) || 1,
      prix_achat_unitaire: Number(it.prix_achat_unitaire) || 0,
      total_ligne: (Number(it.quantite) || 1) * (Number(it.prix_achat_unitaire) || 0),
      organization_id: session.organization_id || '00000000-0000-0000-0000-000000000001',
    }));

    const { error: itemsErr } = await supabase
      .from('bon_commande_items')
      .insert(itemsToInsert);

    if (itemsErr) throw itemsErr;

    return NextResponse.json({ success: true, data: newBc }, { status: 201 });
  } catch (error: any) {
    console.error("Bons de commande POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
