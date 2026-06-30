import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession, isAdminOrManager, getAllowedDepots } from '@/lib/auth_helper';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sourceDepotId = searchParams.get('source_depot_id');
    const destDepotId = searchParams.get('dest_depot_id');

    const isAdmin = await isAdminOrManager(session);
    const allowedDepots = getAllowedDepots(session);
    const userDepot = session.emplacement || "";

    let query = supabase
      .from('transferts_stock')
      .select('*, depot_depart:depot_depart_id(nom), depot_arrivee:depot_arrivee_id(nom), transferts_etapes(*), users:created_by(utilisateur)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      const depotsToFilter = allowedDepots.length > 0 ? allowedDepots : (userDepot ? [userDepot] : []);
      if (depotsToFilter.length === 0) {
        return NextResponse.json([]);
      }
      
      const { data: userDeps } = await supabase
        .from("depots")
        .select("id")
        .in("nom", depotsToFilter);
      const allowedIds = userDeps?.map(d => d.id) || [];
      
      if (allowedIds.length === 0) {
        return NextResponse.json([]);
      }
      
      query = query.or(`depot_depart_id.in.(${allowedIds.join(",")}),depot_arrivee_id.in.(${allowedIds.join(",")})`);
    }

    if (status) {
      query = query.eq('statut', status);
    }
    if (sourceDepotId) {
      query = query.eq('depot_depart_id', Number(sourceDepotId));
    }
    if (destDepotId) {
      query = query.eq('depot_arrivee_id', Number(destDepotId));
    }

    const { data: transfers, error } = await query;
    if (error) throw error;

    return NextResponse.json(transfers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { depot_depart_id, depot_arrivee_id, items, notes } = body;

    const isAdmin = await isAdminOrManager(session);
    const allowedDepots = getAllowedDepots(session);
    const userDepot = session.emplacement || "";

    if (!isAdmin) {
      const depotsToFilter = allowedDepots.length > 0 ? allowedDepots : (userDepot ? [userDepot] : []);
      const { data: userDeps } = await supabase
        .from("depots")
        .select("id")
        .in("nom", depotsToFilter);
      const allowedIds = userDeps?.map(d => d.id) || [];
      
      if (!allowedIds.includes(Number(depot_depart_id))) {
        return NextResponse.json({ error: "Permission refusée pour le dépôt de départ" }, { status: 403 });
      }
    }

    if (!depot_depart_id || !depot_arrivee_id || !items || items.length === 0) {
      return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 });
    }

    if (Number(depot_depart_id) === Number(depot_arrivee_id)) {
      return NextResponse.json({ error: 'Le dépôt de départ et d\'arrivée doivent être différents.' }, { status: 400 });
    }

    // Generate unique reference
    const uniqueRef = `TRF-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Insert transfer header
    const { data: transfer, error: headerErr } = await supabase
      .from('transferts_stock')
      .insert({
        reference: uniqueRef,
        depot_depart_id: Number(depot_depart_id),
        depot_arrivee_id: Number(depot_arrivee_id),
        statut: 'Demande',
        created_by: Number(session.id)
      })
      .select()
      .single();

    if (headerErr) throw headerErr;

    // 2. Insert items
    const itemsToInsert = items.map((item: any) => ({
      transfert_id: transfer.id,
      article_id: Number(item.article_id),
      quantite: Number(item.quantite)
    }));

    const { error: itemsErr } = await supabase
      .from('transfert_items')
      .insert(itemsToInsert);

    if (itemsErr) {
      // Rollback header
      await supabase.from('transferts_stock').delete().eq('id', transfer.id);
      throw itemsErr;
    }

    // 3. Log initial step
    await supabase.from('transferts_etapes').insert({
      transfert_id: transfer.id,
      statut: 'Demande',
      utilisateur: session.username || 'Système',
      remarque: notes || 'Création de la demande de transfert.'
    });

    return NextResponse.json(transfer, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
