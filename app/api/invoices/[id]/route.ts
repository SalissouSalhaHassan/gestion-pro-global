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

    const isAdmin = await isAdminOrManager(session);
    
    // Ownership check using centralized scoping
    if (!isAdmin) {
      let query = supabase.from("factures").select("id").eq("id", id);
      query = applyUserScope(query as any, session, 'factures');
      const { data: inv } = await query.single();
      if (!inv) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Use the safe delete RPC to handle stock adjustment
    let rpcSuccess = false;
    try {
      const { data: result, error: rpcError } = await supabase.rpc('delete_invoice_safe', { 
        p_invoice_id: Number(id),
        p_user_id: Number(session.id),
        p_username: session.username || 'System'
      });

      if (!rpcError && result && result.ok !== false) {
        rpcSuccess = true;
      }
    } catch (e) {
      console.warn("delete_invoice_safe RPC call failed, falling back to direct server logic:", e);
    }

    // Direct robust fallback: restore stock & record compensation movements in DB
    if (!rpcSuccess) {
      // Use Admin Client to bypass RLS and guarantee stock updates succeed regardless of session permissions
      const adminClient = getAdminClient();

      // 1. Fetch invoice and invoice_items
      const { data: invoiceData } = await adminClient
        .from("factures")
        .select("id, bl_number, emplacement, organization_id, client_id, montant_restant, is_deleted")
        .eq("id", id)
        .single();

      if (invoiceData && !invoiceData.is_deleted) {
        const orgId = invoiceData.organization_id || session.organization_id || "00000000-0000-0000-0000-000000000001";
        const fallbackDepot = invoiceData.emplacement || session.emplacement || "Boutique";

        const { data: items } = await adminClient
          .from("facture_items")
          .select("article_id, qte, pu_ht, depot_origine, depot_id")
          .eq("facture_id", id);

        if (items && items.length > 0) {
          for (const item of items) {
            const artId = Number(item.article_id);
            const qte = Number(item.qte || 0);
            const rawDepotNom = String(item.depot_origine || fallbackDepot).trim();

            // Fetch all current stock rows for this article in the organization
            const { data: stockRows } = await adminClient
              .from("stocks")
              .select("id, quantite, depot_nom")
              .eq("article_id", artId)
              .eq("organization_id", orgId);

            // Match depot case-insensitively
            const matchedStock = (stockRows || []).find(
              (s: any) => String(s.depot_nom || "").trim().toLowerCase() === rawDepotNom.toLowerCase()
            );

            const oldQty = matchedStock ? Number(matchedStock.quantite || 0) : 0;
            const newQty = oldQty + qte;

            if (matchedStock?.id) {
              await adminClient
                .from("stocks")
                .update({ quantite: newQty })
                .eq("id", matchedStock.id);
            } else {
              await adminClient
                .from("stocks")
                .insert({
                  article_id: artId,
                  depot_nom: rawDepotNom,
                  quantite: newQty,
                  organization_id: orgId
                });
            }

            // Record compensating inventory movement (ENTREE)
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
              depot: rawDepotNom,
              utilisateur: session.username || "System",
              organization_id: orgId
            });
          }
        }

        // Adjust client credit if debt remaining
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

        // Soft delete & mark as cancelled
        await adminClient
          .from("factures")
          .update({ 
            is_deleted: true, 
            statut: "Annulée",
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("id", id);
      }
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

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
