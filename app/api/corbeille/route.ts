import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getServerSession, isAdminOrManager } from '@/lib/auth_helper';
import { applyUserScope } from '@/lib/utils/scoping';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/corbeille - Get deleted invoices, products, clients
export async function GET(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const adminClient = getAdminClient();
    const orgId = session.organization_id;

    // 1. Fetch deleted invoices
    let invQuery = adminClient
      .from('factures')
      .select('id, bl_number, date_facture, total_ttc, statut, deleted_at, updated_at, vendeur, emplacement, clients(nom)')
      .eq('is_deleted', true)
      .order('deleted_at', { ascending: false })
      .limit(100);

    if (orgId) {
      invQuery = invQuery.eq('organization_id', orgId);
    }

    const { data: invoices, error: invError } = await invQuery;
    if (invError) throw invError;

    // 2. Fetch deleted products
    let artQuery = adminClient
      .from('articles')
      .select('id, reference, designation, p_vente_ttc, updated_at')
      .eq('is_deleted', true)
      .limit(100);

    if (orgId) {
      artQuery = artQuery.eq('organization_id', orgId);
    }

    const { data: articles } = await artQuery;

    // 3. Fetch deleted clients
    let cltQuery = adminClient
      .from('clients')
      .select('id, nom, tel, adresse, updated_at')
      .eq('is_deleted', true)
      .limit(100);

    if (orgId) {
      cltQuery = cltQuery.eq('organization_id', orgId);
    }

    const { data: clients } = await cltQuery;

    return NextResponse.json({
      invoices: invoices || [],
      articles: articles || [],
      clients: clients || [],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/corbeille - Restore deleted item
export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    if (!isAdmin) {
      return NextResponse.json({ error: "Seuls les administrateurs peuvent restaurer des éléments" }, { status: 403 });
    }

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json({ error: "Paramètres manquants (type, id)" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    if (type === 'facture') {
      // 1. Fetch invoice and its items to deduct stock back (since it was restored on delete)
      const { data: invoice } = await adminClient
        .from('factures')
        .select('*')
        .eq('id', Number(id))
        .single();

      if (!invoice) {
        return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
      }

      // Re-deduct stock for items
      const { data: items } = await adminClient
        .from('facture_items')
        .select('*')
        .eq('facture_id', Number(id));

      if (items && items.length > 0) {
        for (const item of items) {
          const artId = Number(item.article_id);
          const qte = Number(item.qte || 0);
          if (!artId || qte <= 0) continue;

          const depotNom = item.depot_origine || invoice.emplacement || 'Boutique';

          const { data: stockRows } = await adminClient
            .from('stocks')
            .select('id, quantite, depot_nom')
            .eq('article_id', artId);

          const matched = (stockRows || []).find((s: any) =>
            String(s.depot_nom || '').trim().toLowerCase() === depotNom.toLowerCase()
          ) || (stockRows || [])[0];

          if (matched) {
            await adminClient
              .from('stocks')
              .update({ quantite: Math.max(0, Number(matched.quantite || 0) - qte) })
              .eq('id', matched.id);
          }

          // Movement for restoration
          await adminClient.from('mouvements').insert({
            article_id: artId,
            nr_doc: `REST-${invoice.bl_number || id}`,
            date_mouvement: new Date().toISOString(),
            fournisseur_client: `Restauration Facture #${invoice.bl_number || id}`,
            entree: 0,
            sortie: qte,
            quantite: -qte,
            type: 'SORTIE',
            depot: depotNom,
            utilisateur: session.username || 'System',
            organization_id: invoice.organization_id,
          });
        }
      }

      // Update invoice to active
      await adminClient
        .from('factures')
        .update({
          is_deleted: false,
          statut: invoice.montant_paye >= invoice.total_ttc ? 'Payée' : invoice.montant_paye > 0 ? 'Partielle' : 'Non Payée',
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', Number(id));

      return NextResponse.json({ ok: true, message: "Facture restaurée avec succès" });
    } else if (type === 'article') {
      await adminClient
        .from('articles')
        .update({ is_deleted: false, updated_at: new Date().toISOString() })
        .eq('id', Number(id));

      return NextResponse.json({ ok: true, message: "Article restauré avec succès" });
    } else if (type === 'client') {
      await adminClient
        .from('clients')
        .update({ is_deleted: false, updated_at: new Date().toISOString() })
        .eq('id', Number(id));

      return NextResponse.json({ ok: true, message: "Client restauré avec succès" });
    }

    return NextResponse.json({ error: "Type inconnu" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
