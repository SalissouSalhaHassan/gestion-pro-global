import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;
    const transferId = Number(id);
    const body = await request.json();
    const { action, remarque } = body; // action: 'validate' | 'prepare' | 'ship' | 'receive' | 'confirm'

    if (!action) {
      return NextResponse.json({ error: 'Action requise.' }, { status: 400 });
    }

    // 1. Fetch current transfer status and details
    const { data: transfer, error: fetchErr } = await supabase
      .from('transferts_stock')
      .select('*, depot_depart:depot_depart_id(nom), depot_arrivee:depot_arrivee_id(nom)')
      .eq('id', transferId)
      .single();

    if (fetchErr || !transfer) {
      return NextResponse.json({ error: 'Transfert introuvable.' }, { status: 404 });
    }

    // 2. Fetch items for this transfer
    const { data: items, error: itemsErr } = await supabase
      .from('transfert_items')
      .select('*, articles(reference, designation, unite)')
      .eq('transfert_id', transferId);

    if (itemsErr || !items || items.length === 0) {
      return NextResponse.json({ error: 'Articles du transfert introuvables.' }, { status: 404 });
    }

    let nextStatus = '';
    let notes = remarque || '';

    // State machine transitions
    if (action === 'validate') {
      if (transfer.statut !== 'Demande') return NextResponse.json({ error: 'Transition invalide.' }, { status: 400 });
      nextStatus = 'Valide';
      notes = notes || 'Validation de la demande de transfert.';
    } else if (action === 'prepare') {
      if (transfer.statut !== 'Valide') return NextResponse.json({ error: 'Transition invalide.' }, { status: 400 });
      nextStatus = 'Prepare';
      notes = notes || 'Préparation des articles terminée.';
    } else if (action === 'ship') {
      if (transfer.statut !== 'Prepare') return NextResponse.json({ error: 'Transition invalide.' }, { status: 400 });
      nextStatus = 'Expedie';
      notes = notes || 'Articles expédiés (déduction du stock source).';

      // --- Deduct Stock from Source Depot ---
      for (const item of items) {
        // Fetch current stock
        const { data: stockRow } = await supabase
          .from('stocks')
          .select('quantite')
          .eq('article_id', item.article_id)
          .eq('warehouse_id', transfer.depot_depart_id)
          .maybeSingle();

        const currentQty = stockRow ? Number(stockRow.quantite || 0) : 0;
        const newQty = currentQty - Number(item.quantite);

        // Upsert stock row
        await supabase
          .from('stocks')
          .upsert({
            article_id: item.article_id,
            warehouse_id: transfer.depot_depart_id,
            quantite: newQty
          }, { onConflict: 'article_id,depot_nom' });

        // Add mouvement record
        await supabase.from('mouvements').insert({
          article_id: item.article_id,
          type: 'transfert_sortie',
          nr_doc: transfer.reference,
          date_mouvement: new Date().toISOString(),
          fournisseur_client: `Transfert vers ${transfer.depot_arrivee?.nom || 'Autre dépôt'}`,
          quantite: item.quantite,
          sortie: item.quantite,
          stock_avant: currentQty,
          stock_apres: newQty,
          warehouse_id: transfer.depot_depart_id,
          user_id: Number(session.id),
          utilisateur: session.username || 'Système'
        });
      }

      // Legacy stock_transits write for backward compatibility
      const legacyDetails = items.map(item => ({
        article_id: item.article_id,
        qty: item.quantite,
        designation: item.articles?.designation || `Article #${item.article_id}`
      }));
      await supabase.from("stock_transits").insert({
        reference: transfer.reference,
        source_depot: transfer.depot_depart?.nom || `Dépôt #${transfer.depot_depart_id}`,
        dest_depot: transfer.depot_arrivee?.nom || `Dépôt #${transfer.depot_arrivee_id}`,
        details: legacyDetails,
        notes: notes,
        created_by: session.username || 'Système',
        status: 'En Transit'
      });

    } else if (action === 'receive') {
      if (transfer.statut !== 'Expedie') return NextResponse.json({ error: 'Transition invalid.' }, { status: 400 });
      nextStatus = 'Recu';
      notes = notes || 'Articles reçus (ajout au stock destination).';

      // --- Add Stock to Destination Depot ---
      for (const item of items) {
        const { data: stockRow } = await supabase
          .from('stocks')
          .select('quantite')
          .eq('article_id', item.article_id)
          .eq('warehouse_id', transfer.depot_arrivee_id)
          .maybeSingle();

        const currentQty = stockRow ? Number(stockRow.quantite || 0) : 0;
        const newQty = currentQty + Number(item.quantite);

        // Upsert stock row
        await supabase
          .from('stocks')
          .upsert({
            article_id: item.article_id,
            warehouse_id: transfer.depot_arrivee_id,
            quantite: newQty
          }, { onConflict: 'article_id,depot_nom' });

        // Add mouvement record
        await supabase.from('mouvements').insert({
          article_id: item.article_id,
          type: 'transfert_entree',
          nr_doc: transfer.reference,
          date_mouvement: new Date().toISOString(),
          fournisseur_client: `Transfert depuis ${transfer.depot_depart?.nom || 'Autre dépôt'}`,
          quantite: item.quantite,
          entree: item.quantite,
          stock_avant: currentQty,
          stock_apres: newQty,
          warehouse_id: transfer.depot_arrivee_id,
          user_id: Number(session.id),
          utilisateur: session.username || 'Système'
        });
      }

      // Update legacy stock_transits status
      await supabase
        .from("stock_transits")
        .update({
          status: "Reçu",
          date_reception: new Date().toISOString(),
          received_by: session.username || 'Système'
        })
        .eq("reference", transfer.reference);

    } else if (action === 'confirm') {
      if (transfer.statut !== 'Recu') return NextResponse.json({ error: 'Transition invalide.' }, { status: 400 });
      nextStatus = 'Confirme';
      notes = notes || 'Confirmation finale et clôture du transfert.';
    } else {
      return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
    }

    // 3. Update transfer status
    const { error: updateErr } = await supabase
      .from('transferts_stock')
      .update({
        statut: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', transferId);

    if (updateErr) throw updateErr;

    // 4. Log step in etapes table
    await supabase.from('transferts_etapes').insert({
      transfert_id: transferId,
      statut: nextStatus,
      utilisateur: session.username || 'Système',
      remarque: notes
    });

    return NextResponse.json({ ok: true, statut: nextStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
