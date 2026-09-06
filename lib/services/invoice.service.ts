import { SupabaseClient } from '@supabase/supabase-js';
import { applyUserScope } from '@/lib/utils/scoping';
import { getAllowedDepots } from '@/lib/auth_helper';

export type InvoiceItem = {
  id?: number;
  article_id: number;
  description: string;
  qte: number;
  pu_ht: number;
  remise_item_pourcentage?: number;
  taux_tva_item: number;
  total_item_ht: number;
  total_item_ttc: number;
};

export type Invoice = {
  id?: number;
  client_id: number;
  date_facture: string;
  date_echeance?: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  remise_globale_pourcentage?: number;
  statut: 'Non Payée' | 'Partiellement Payée' | 'Payée' | 'Annulée';
  montant_paye?: number;
  montant_restant?: number;
  notes?: string;
  user_id?: number;
  items?: InvoiceItem[];
};

export class InvoiceService {
  constructor(private supabase: SupabaseClient) {}

  private async getTenantInvoicePolicy(session: any): Promise<'shared' | 'personal' | 'depot'> {
    if (!session) return 'shared';
    if (session.invoice_visibility_policy) return session.invoice_visibility_policy;

    const orgId = session.organization_id;
    if (!orgId) return 'shared';

    try {
      const { data: comp } = await this.supabase
        .from('informations_entreprise')
        .select('*')
        .eq('organization_id', orgId)
        .maybeSingle();

      if (comp?.capital_social && comp.capital_social.startsWith('{')) {
        try {
          const parsed = JSON.parse(comp.capital_social);
          if (parsed.invoice_visibility_policy) {
            return parsed.invoice_visibility_policy as any;
          }
        } catch {}
      }
      if (comp?.invoice_visibility_policy) {
        return comp.invoice_visibility_policy as any;
      }
    } catch (err) {
      console.warn('Failed to load invoice_visibility_policy, defaulting to shared:', err);
    }

    return 'shared';
  }

  private async getDepotUsernames(session: any): Promise<string[]> {
    const allowedDepotNames = getAllowedDepots(session);
    if (allowedDepotNames.length === 0 && session.emplacement) {
      allowedDepotNames.push(session.emplacement);
    }

    if (allowedDepotNames.length === 0) return [];

    try {
      let uQ = this.supabase
        .from('users')
        .select('utilisateur')
        .in('emplacement', allowedDepotNames);

      if (session.organization_id) {
        uQ = uQ.eq('organization_id', session.organization_id);
      }

      const { data: uRows } = await uQ;
      return (uRows || []).map((u: any) => u.utilisateur).filter(Boolean);
    } catch (e) {
      console.warn('Could not query depot users:', e);
      return [];
    }
  }

  async getInvoices(session: any, filters?: { search?: string | null; vendeur?: string | null }) {
    let query = this.supabase
      .from('factures')
      .select('*, clients(nom)')
      .eq('is_deleted', false);

    if (filters?.vendeur) {
      query = query.eq('vendeur', filters.vendeur);
    }

    if (filters?.search) {
      query = query.ilike('bl_number', `%${filters.search}%`);
    }

    query = query
      .order('date_facture', { ascending: false })
      .order('id', { ascending: false })
      .limit(1000);

    const policy = await this.getTenantInvoicePolicy(session);

    const isAdmin = (session.admin === "Oui" || session.admin === "oui" || session.admin === "true" || (session as any).admin === true) || 
                    (session.role === 1 || session.role === "1" || session.role === "admin" || session.role === 2 || session.role === "2" || session.role === "manager");

    if (!isAdmin && policy === 'depot') {
      const depotUsernames = await this.getDepotUsernames(session);
      (session as any).depot_usernames = depotUsernames;
    }

    query = applyUserScope(query as any, session, 'factures', policy);

    let { data, error } = await query;
    if (error) throw new Error(error.message);

    // Enrich invoices with seller's actual depot/emplacement
    if (data && Array.isArray(data) && data.length > 0) {
      const uniqueVendors = [...new Set(data.map((inv: any) => inv.vendeur).filter(Boolean))];
      if (uniqueVendors.length > 0) {
        try {
          const { data: vUsers } = await this.supabase
            .from('users')
            .select('utilisateur, emplacement')
            .in('utilisateur', uniqueVendors);
          
          const vendorEmplacementMap = new Map<string, string>();
          (vUsers || []).forEach((u: any) => {
            if (u.utilisateur && u.emplacement) {
              vendorEmplacementMap.set(u.utilisateur, u.emplacement);
            }
          });

          data = data.map((inv: any) => ({
            ...inv,
            emplacement: inv.emplacement || vendorEmplacementMap.get(inv.vendeur) || 'BOUTIQUE',
          }));
        } catch (e) {}
      }
    }

    return data;
  }

  async getInvoiceById(id: number, session: any) {
    let query = this.supabase
      .from('factures')
      .select('*, facture_items(*, depots:depot_id(id, nom)), clients(nom, adresse, nif)')
      .eq('id', id);
    
    const policy = await this.getTenantInvoicePolicy(session);

    const isAdmin = (session.admin === "Oui" || session.admin === "oui" || session.admin === "true" || (session as any).admin === true) || 
                    (session.role === 1 || session.role === "1" || session.role === "admin" || session.role === 2 || session.role === "2" || session.role === "manager");

    if (!isAdmin && policy === 'depot') {
      const depotUsernames = await this.getDepotUsernames(session);
      (session as any).depot_usernames = depotUsernames;
    }

    query = applyUserScope(query as any, session, 'factures', policy);

    const { data, error } = await query.single();
    
    if (error || !data) return null;

    // Fallback: If any facture_items is missing description, fetch from articles, and resolve depot_origine
    if (data.facture_items && Array.isArray(data.facture_items)) {
      // Fetch movements for this invoice to accurately resolve originating depot per item
      const movementsMap = new Map<number, string>();
      if (data.bl_number) {
        try {
          const { data: mvts } = await this.supabase
            .from('mouvements')
            .select('article_id, depot')
            .eq('nr_doc', data.bl_number);
          if (mvts) {
            mvts.forEach((m: any) => {
              if (m.article_id && m.depot && !movementsMap.has(Number(m.article_id))) {
                movementsMap.set(Number(m.article_id), m.depot);
              }
            });
          }
        } catch (mvtErr) {
          console.warn('Could not fetch movements for invoice depot resolution:', mvtErr);
        }
      }

      let fallbackDepot = data.emplacement || '';
      if (!fallbackDepot && data.vendeur) {
        try {
          const { data: sellerUser } = await this.supabase
            .from('users')
            .select('emplacement')
            .eq('utilisateur', data.vendeur)
            .maybeSingle();
          if (sellerUser?.emplacement) {
            fallbackDepot = sellerUser.emplacement;
          }
        } catch (userErr) {
          console.warn('Could not fetch seller user emplacement:', userErr);
        }
      }

      const missingIds = data.facture_items
        .filter((it: any) => !it.description && it.article_id)
        .map((it: any) => it.article_id);

      let artMap = new Map<number, any>();
      if (missingIds.length > 0) {
        const { data: arts } = await this.supabase
          .from('articles')
          .select('id, designation, nom, reference')
          .in('id', missingIds);

        artMap = new Map<number, any>((arts || []).map((a: any) => [a.id, a]));
      }

      data.facture_items = data.facture_items.map((it: any) => {
        const a = artMap.get(it.article_id);
        const depotNom =
          it.depot_origine ||
          it.depots?.nom ||
          it.depot?.nom ||
          movementsMap.get(Number(it.article_id)) ||
          fallbackDepot ||
          '';

        return {
          ...it,
          description: it.description || a?.designation || a?.nom || 'Article',
          code_art: it.code_art || a?.reference || it.code_art,
          depot_origine: depotNom,
        };
      });
    }

    return data;
  }

  async createInvoice(invoiceData: Invoice, userId?: number) {
    const { items, client_nom, ...invoiceRow } = invoiceData as any;
    
    // Insert the main invoice
    const { data: newInvoice, error: invoiceError } = await this.supabase
      .from('factures')
      .insert({
        ...invoiceRow,
        user_id: userId || invoiceRow.user_id,
        montant_paye: invoiceRow.montant_paye || 0,
        montant_restant: invoiceRow.total_ttc - (invoiceRow.montant_paye || 0),
        statut: invoiceRow.montant_paye === invoiceRow.total_ttc ? 'Payée' : 'Non Payée'
      })
      .select()
      .single();

    if (invoiceError) throw new Error(invoiceError.message);

    // Insert items
    if (items && items.length > 0) {
      const itemsToInsert = items.map((item: any) => ({
        ...item,
        facture_id: newInvoice.id
      }));

      const { error: itemsError } = await this.supabase
        .from('facture_items')
        .insert(itemsToInsert);

      if (itemsError) throw new Error(itemsError.message);
    }

    return newInvoice;
  }

  async payInvoice(invoiceId: number, amount: number, paymentMethod: string, sessionOrId: any, advanceId?: number) {
    const session = typeof sessionOrId === 'object' ? sessionOrId : { id: sessionOrId };
    const invoice = await this.getInvoiceById(invoiceId, session);
    if (!invoice) throw new Error('Invoice not found or access denied');

    const newMontantPaye = Number(invoice.montant_paye) + amount;
    const newMontantRestant = Number(invoice.total_ttc) - newMontantPaye;
    
    let newStatus = invoice.statut;
    if (newMontantRestant <= 0) {
        newStatus = 'Payée';
    } else if (newMontantPaye > 0) {
        newStatus = 'Partiellement Payée';
    }

    const { data, error } = await this.supabase
      .from('factures')
      .update({
          montant_paye: newMontantPaye,
          montant_restant: newMontantRestant,
          statut: newStatus
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Log the payment in paiements table
    await this.supabase.from('paiements').insert({
      facture_id: invoiceId,
      date_operation: new Date().toISOString().split('T')[0],
      montant_regle: amount,
      moyen_reglement: paymentMethod,
      avance_client_id: advanceId,
      created_by: session.id
    });

    return data;
  }
}

