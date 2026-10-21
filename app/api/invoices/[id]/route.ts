import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { InvoiceService } from '@/lib/services/invoice.service';
import { getServerSession, isAdminOrManager } from '@/lib/auth_helper';
import { applyUserScope } from '@/lib/utils/scoping';
import { logAuditEvent } from '@/lib/services/audit.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();

    // 1. If unauthenticated, allow secure public SSL verification (e.g. scanning QR Code on invoice)
    if (!session) {
      const { data: inv, error: invErr } = await supabase
        .from('factures')
        .select(`
          id, bl_number, date_facture, total_ht, total_tva, total_ttc,
          montant_paye, montant_restant, statut, mode_paiement, created_at,
          organization_id, clients(nom, adresse, tel, nif)
        `)
        .eq('id', Number(id))
        .eq('is_deleted', false)
        .maybeSingle();

      if (invErr || !inv) {
        return NextResponse.json({ error: "Facture introuvable ou invalide" }, { status: 404 });
      }

      // Fetch company branding for public verification view
      let companyInfo: any = null;
      if (inv.organization_id) {
        const { data: comp } = await supabase
          .from("informations_entreprise")
          .select("nom_entreprise, adresse, telephone, email, rc, nif, cachet_url, brand_color, slogan, show_qr_code, show_stamp, capital_social")
          .eq("organization_id", inv.organization_id)
          .maybeSingle();

        if (comp) {
          companyInfo = comp;
          if (comp.capital_social && comp.capital_social.startsWith("{")) {
            try {
              const parsed = JSON.parse(comp.capital_social);
              companyInfo = { ...companyInfo, ...parsed };
            } catch (e) {}
          }
        }
      }

      return NextResponse.json({
        ...inv,
        company: companyInfo,
        company_name: companyInfo?.nom_entreprise || "GESTION PRO GLOBAL",
        is_verified_ssl: true,
      });
    }

    const isAdmin = await isAdminOrManager(session);
    const invoiceService = new InvoiceService(supabase);
    const orgId = session.organization_id;

    // Concurrently fetch invoice and payments directly on server
    const [invoice, paysRes, compRes] = await Promise.all([
      invoiceService.getInvoiceById(Number(id), session),
      supabase
        .from('paiements')
        .select('*')
        .eq('facture_id', Number(id))
        .order('date_operation', { ascending: true }),
      orgId
        ? supabase
            .from('informations_entreprise')
            .select('*')
            .eq('organization_id', orgId)
            .maybeSingle()
        : Promise.resolve({ data: null })
    ]);
    
    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable ou accès refusé" }, { status: 404 });
    }

    // Attach company branding info
    let companyInfo: any = compRes?.data || null;
    if (companyInfo && companyInfo.capital_social && companyInfo.capital_social.startsWith("{")) {
      try {
        const parsed = JSON.parse(companyInfo.capital_social);
        companyInfo = { ...companyInfo, ...parsed };
      } catch (e) {}
    }

    return NextResponse.json({
      ...invoice,
      paiements: paysRes?.data || [],
      company: companyInfo,
    });
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

    const isAdmin = await isAdminOrManager(session);
    const body = await request.json();
    
    // Ownership check using centralized scoping
    if (!isAdmin) {
      let query = supabase.from("factures").select("id").eq("id", id);
      query = applyUserScope(query as any, session, 'factures');
      const { data: inv } = await query.single();
      if (!inv) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('factures')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
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

    const isNumeric = !isNaN(Number(id));
    const numericId = isNumeric ? Number(id) : null;

    // Use Admin Client directly to guarantee 100% reliable execution and bypass any RLS or missing RPC issues
    const adminClient = getAdminClient();

    // 1. Fetch invoice and invoice_items before marking as deleted
    let query = adminClient
      .from("factures")
      .select("id, bl_number, emplacement, organization_id, client_id, montant_restant, is_deleted");

    if (numericId !== null) {
      query = query.or(`id.eq.${numericId},bl_number.eq.${id}`);
    } else {
      query = query.or(`bl_number.eq.${id}`);
    }

    const { data: invoiceData, error: invFetchErr } = await query.maybeSingle();

    if (invFetchErr || !invoiceData) {
      console.warn("DELETE invoice not found in DB for id/bl:", id);
      return NextResponse.json({ error: "Facture introuvable ou déjà synchronisée" }, { status: 404 });
    }

    // If the invoice was already deleted in a prior failed attempt, continue restoring stock so user can recover stock

    const orgId = invoiceData.organization_id || session.organization_id || "00000000-0000-0000-0000-000000000001";
    const fallbackDepot = invoiceData.emplacement || session.emplacement || "Boutique";

    // 2. Fetch all items of this invoice using exact matched invoice id
    let { data: items, error: itemsErr } = await adminClient
      .from("facture_items")
      .select("article_id, qte, pu_ht, depot_origine, depot_id")
      .eq("facture_id", invoiceData.id);

    if (!items || items.length === 0) {
      const { data: fallbackItems } = await adminClient
        .from("facture_items")
        .select("article_id, qte, pu_ht, depot_origine, depot_id")
        .eq("facture_id", id);
      if (fallbackItems && fallbackItems.length > 0) {
        items = fallbackItems;
      }
    }

    // Safety fallback: If facture_items is empty, fetch items from mouvements where nr_doc = invoice.bl_number
    if ((!items || items.length === 0) && invoiceData.bl_number) {
      const { data: mvts } = await adminClient
        .from("mouvements")
        .select("article_id, quantite, sortie, entree, pv, depot, warehouse_id")
        .eq("nr_doc", invoiceData.bl_number);

      if (mvts && mvts.length > 0) {
        items = mvts.map((m: any) => ({
          article_id: m.article_id,
          qte: Number(m.sortie || m.quantite || 0),
          pu_ht: Number(m.pv || 0),
          depot_origine: m.depot,
          depot_id: m.warehouse_id,
        })).filter((i: any) => i.qte > 0);
      }
    }

    // Direct JS execution below guarantees accurate stock restoration and movement creation

    // Fetch active depots for resolving depot_id <-> depot_nom
    const { data: allDepots } = await adminClient
      .from("depots")
      .select("id, nom, organization_id")
      .eq("is_deleted", false);

    const depotList = (allDepots || []) as Array<{ id: number; nom: string; organization_id?: string }>;

    // Helper to resolve depot name and id
    function resolveDepot(rawName?: string | null, rawId?: number | string | null) {
      let dNom = String(rawName || fallbackDepot || "Boutique").trim();
      let dId: number | null = rawId ? Number(rawId) : null;

      if (!dId && dNom) {
        const found = depotList.find((d) => d.nom.trim().toLowerCase() === dNom.toLowerCase());
        if (found) {
          dId = Number(found.id);
          dNom = found.nom;
        }
      } else if (dId && (!dNom || dNom === "Boutique")) {
        const found = depotList.find((d) => Number(d.id) === dId);
        if (found) dNom = found.nom;
      }
      return { depotNom: dNom, depotId: dId };
    }

    if (items && items.length > 0) {
      for (const item of items) {
        const artId = Number(item.article_id);
        const qte = Number(item.qte || 0);
        if (!artId || qte <= 0) continue;

        const { depotNom, depotId } = resolveDepot(item.depot_origine, item.depot_id);

        // Query stocks for this article
        const { data: stockRows } = await adminClient
          .from("stocks")
          .select("id, quantite, depot_nom, warehouse_id, organization_id")
          .eq("article_id", artId);

        // Find matching stock row by warehouse_id OR normalized depot name
        const matchedStock = (stockRows || []).find((s: any) => {
          if (depotId && s.warehouse_id && Number(s.warehouse_id) === Number(depotId)) return true;
          const sDepot = String(s.depot_nom || "").trim().toLowerCase();
          return sDepot === depotNom.toLowerCase();
        }) || (stockRows || [])[0];

        const oldQty = matchedStock ? Number(matchedStock.quantite || 0) : 0;
        const newQty = oldQty + qte;

        if (matchedStock?.id) {
          await adminClient
            .from("stocks")
            .update({ 
              quantite: newQty,
              depot_nom: matchedStock.depot_nom || depotNom,
              warehouse_id: matchedStock.warehouse_id || depotId || null
            })
            .eq("id", matchedStock.id);
        } else {
          await adminClient
            .from("stocks")
            .insert({
              article_id: artId,
              depot_nom: depotNom,
              warehouse_id: depotId || null,
              quantite: newQty,
              organization_id: orgId
            });
        }

        // Record compensating inventory movement (ENTREE - Cancellation)
        await adminClient.from("mouvements").insert({
          article_id: artId,
          nr_doc: `ANN-${invoiceData.bl_number || id}`,
          date_mouvement: new Date().toISOString(),
          fournisseur_client: `Annulation Facture #${invoiceData.bl_number || id}`,
          entree: qte,
          sortie: 0,
          quantite: qte,
          pv: Number(item.pu_ht || 0),
          stock_avant: oldQty,
          stock_apres: newQty,
          type: "ENTREE_ANNULATION",
          depot: depotNom,
          warehouse_id: depotId || null,
          utilisateur: session.username || "System",
          organization_id: orgId
        });
      }
    }

    // 3. Adjust client credit if debt was remaining on this invoice
    if (invoiceData.client_id && Number(invoiceData.montant_restant || 0) > 0) {
      const { data: clientRow } = await adminClient
        .from("clients")
        .select("credit_facture")
        .eq("id", invoiceData.client_id)
        .maybeSingle();

      if (clientRow) {
        const currentCredit = Number(clientRow.credit_facture || 0);
        const newCredit = Math.max(0, currentCredit - Number(invoiceData.montant_restant));
        await adminClient
          .from("clients")
          .update({ credit_facture: newCredit })
          .eq("id", invoiceData.client_id);
      }
    }

    // 4. Soft delete & mark as cancelled
    const { error: updateErr, data: updatedRow } = await adminClient
      .from("factures")
      .update({ 
        is_deleted: true, 
        statut: "Annulée",
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .or(`id.eq.${invoiceData.id}${invoiceData.bl_number ? `,bl_number.eq.${invoiceData.bl_number}` : ''}`)
      .select('id, is_deleted, statut');

    if (updateErr) {
      console.error("[DELETE_INVOICE] Failed to update facture is_deleted:", updateErr);
      throw new Error(`Erreur lors de la mise à jour de la facture: ${updateErr.message}`);
    }

    await logAuditEvent({
      action_type: "DELETE_INVOICE",
      severity: "CRITICAL",
      module: "VENTES",
      description: `Suppression définitive / Annulation de la facture #${id} par ${session.username}`,
      target_id: id,
      user_id: Number(session.id),
      username: session.username,
      metadata: { invoice_id: id },
    });

    console.log(`[DELETE_INVOICE] Facture #${invoiceData.id} (${invoiceData.bl_number}) supprimée avec succès. Articles restaurés: ${items?.length || 0}`);

    return NextResponse.json({ 
      ok: true, 
      message: "Facture supprimée et stock réajusté avec succès",
      itemsRestored: items?.length || 0,
      invoiceId: invoiceData.id
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
