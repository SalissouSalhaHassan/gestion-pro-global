import { SupabaseClient } from '@supabase/supabase-js';
import { applyUserScope } from '@/lib/utils/scoping';

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

    query = applyUserScope(query as any, session, 'factures');

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async getInvoiceById(id: number, session: any) {
    let query = this.supabase
      .from('factures')
      .select('*, facture_items(*), clients(nom, adresse, nif)')
      .eq('id', id);
    
    query = applyUserScope(query as any, session, 'factures');

    const { data, error } = await query.single();
    
    if (error) return null;
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

