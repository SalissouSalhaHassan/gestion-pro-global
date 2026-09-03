import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';
import { logAuditEvent } from '@/lib/services/audit.service';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // 1. Fetch BC with items
    const { data: bc, error: bcErr } = await supabase
      .from('bons_commande')
      .select('*, items:bon_commande_items(*)')
      .eq('id', id)
      .single();

    if (bcErr || !bc) {
      return NextResponse.json({ error: "Bon de commande introuvable" }, { status: 404 });
    }

    if (bc.statut === 'REÇU') {
      return NextResponse.json({ error: "Ce bon de commande a déjà été réceptionné." }, { status: 400 });
    }

    // Default depot if not specified
    let targetDepotId = bc.depot_id;
    if (!targetDepotId) {
      const { data: defaultDepot } = await supabase.from('depots').select('id').order('id').limit(1).single();
      targetDepotId = defaultDepot?.id || 1;
    }

    // 2. Update Stocks for all items
    for (const item of bc.items || []) {
      if (!item.article_id) continue;

      // Find existing stock in target depot
      const { data: existingStock } = await supabase
        .from('stocks')
        .select('id, quantite')
        .eq('article_id', item.article_id)
        .eq('depot_id', targetDepotId)
        .maybeSingle();

      const receivedQty = Number(item.quantite) || 0;

      if (existingStock) {
        await supabase
          .from('stocks')
          .update({
            quantite: Number(existingStock.quantite) + receivedQty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingStock.id);
      } else {
        await supabase
          .from('stocks')
          .insert({
            article_id: item.article_id,
            depot_id: targetDepotId,
            quantite: receivedQty,
          });
      }

      // Record Stock Movement
      await supabase.from('mouvements_stock').insert({
        article_id: item.article_id,
        depot_id: targetDepotId,
        type_mouvement: 'ENTREE',
        quantite: receivedQty,
        reference_mouvement: bc.numero_bc,
        description: `Réception Bon de Commande ${bc.numero_bc} - Fournisseur: ${bc.fournisseur_nom}`,
        date_mouvement: new Date().toISOString(),
      });
    }

    // 3. Mark BC as REÇU
    const { data: updatedBc, error: updateErr } = await supabase
      .from('bons_commande')
      .update({
        statut: 'REÇU',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 4. Log Audit Event
    await logAuditEvent({
      action_type: "STOCK_ADJUSTMENT",
      severity: "MEDIUM",
      module: "STOCKS",
      description: `Réception et entrée en stock du Bon de Commande #${bc.numero_bc} (${bc.fournisseur_nom}) par ${session.username}`,
      target_id: bc.numero_bc,
      user_id: Number(session.id),
      username: session.username,
    });

    return NextResponse.json({
      success: true,
      message: "Bon de commande réceptionné avec succès et stocks approvisionnés !",
      data: updatedBc,
    });
  } catch (error: any) {
    console.error("BC reception error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
