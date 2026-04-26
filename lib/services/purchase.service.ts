import { SupabaseClient } from '@supabase/supabase-js';
import { applyUserScope } from '@/lib/utils/scoping';

export type PurchaseItem = {
  id?: number;
  article_id: number;
  designation: string;
  unite?: string;
  quantite: number;
  prix_unitaire_ht: number;
  montant_ligne: number;
};

export type Purchase = {
  id?: number;
  fournisseur_id: number;
  fournisseur_nom: string;
  numero_facture: string;
  date_achat: string;
  sous_total: number;
  remise: number;
  taxe: number;
  transport: number;
  montant_total: number;
  montant_paye: number;
  statut: string;
  notes?: string;
  depot_nom: string;
  items?: PurchaseItem[];
};

export class PurchaseService {
  constructor(private supabase: SupabaseClient) {}

  async getPurchases(session: any, filters?: any) {
    let query = this.supabase
      .from('achats')
      .select('*')
      .order('date_achat', { ascending: false })
      .order('id', { ascending: false });

    query = applyUserScope(query as any, session, 'achats' as any);

    if (filters) {
      if (filters.ref) query = query.ilike('numero_facture', `%${filters.ref}%`);
      if (filters.supplier) query = query.ilike('fournisseur_nom', `%${filters.supplier}%`);
      if (filters.start_date) query = query.gte('date_achat', filters.start_date);
      if (filters.end_date) query = query.lte('date_achat', filters.end_date);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async getPurchaseById(id: number, session: any) {
    let query = this.supabase
      .from('achats')
      .select('*, achat_items(*), paiements(*)')
      .eq('id', id);

    query = applyUserScope(query as any, session, 'achats' as any);

    const { data, error } = await query.single();
    if (error) return null;
    return data;
  }

  async createPurchase(purchaseData: Purchase, userId?: number, username?: string) {
    const { items, ...purchaseRow } = purchaseData;

    // 1. Insert Purchase
    const { data: newPurchase, error: purchaseError } = await this.supabase
      .from('achats')
      .insert({
        ...purchaseRow,
        user_id: userId,
        created_by: username
      })
      .select()
      .single();

    if (purchaseError) throw new Error(purchaseError.message);

    // 2. Insert Items and Update Stock/PMP
    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        ...item,
        achat_id: newPurchase.id
      }));

      const { error: itemsError } = await this.supabase
        .from('achat_items')
        .insert(itemsToInsert);

      if (itemsError) throw new Error(itemsError.message);

      // Apply Stock and PMP for each item
      for (const item of items) {
        await this.applyStockAndPMP(item, newPurchase.id, newPurchase.numero_facture, newPurchase.fournisseur_nom, newPurchase.depot_nom, newPurchase.date_achat);
      }
    }

    // 3. Log Activity
    await this.supabase.from('activity_log').insert({
      user_id: userId,
      username: username,
      action: 'CREATE',
      entity_type: 'Achat',
      entity_id: newPurchase.id,
      details: `L'achat N°${newPurchase.numero_facture} a été créé. Fournisseur: ${newPurchase.fournisseur_nom}, Montant: ${newPurchase.montant_total}`
    });

    return newPurchase;
  }

  private async applyStockAndPMP(item: PurchaseItem, purchaseId: number, ref: string, supplier: string, depot: string, date: string) {
    const { article_id, quantite: qte_entree, prix_unitaire_ht: nouveau_pu_achat_ht } = item;
    const purchaseRef = `ACH-${purchaseId}`;

    // Get current stock in depot
    const { data: stockInDepot } = await this.supabase
      .from('stocks')
      .select('quantite')
      .eq('article_id', article_id)
      .eq('depot_nom', depot)
      .single();

    const stockAvant = stockInDepot?.quantite || 0;

    // Update/Insert stock in depot
    const { error: stockError } = await this.supabase
      .from('stocks')
      .upsert({
        article_id,
        depot_nom: depot,
        quantite: stockAvant + qte_entree
      }, { onConflict: 'article_id,depot_nom' });

    if (stockError) throw new Error(stockError.message);

    // Get global stock and current PMP
    const { data: articleData } = await this.supabase
      .from('articles')
      .select('pmp_ht, stocks(quantite)')
      .eq('id', article_id)
      .single();

    const pmp_avant = articleData?.pmp_ht || 0;
    const total_stock_apres = (articleData?.stocks as any[])?.reduce((acc, s) => acc + s.quantite, 0) || qte_entree;
    const total_stock_avant = total_stock_apres - qte_entree;

    let nouveau_pmp_ht = nouveau_pu_achat_ht;
    if (total_stock_apres > 0) {
      nouveau_pmp_ht = ((total_stock_avant * pmp_avant) + (qte_entree * nouveau_pu_achat_ht)) / total_stock_apres;
    }

    // Update Article
    await this.supabase
      .from('articles')
      .update({
        p_achat_ht: nouveau_pu_achat_ht,
        pmp_ht: nouveau_pmp_ht
      })
      .eq('id', article_id);

    // Log Movement
    await this.supabase.from('mouvements').insert({
      article_id,
      type: 'achat',
      nr_doc: purchaseRef,
      date_mouvement: date,
      fournisseur_client: supplier,
      quantite: qte_entree,
      entree: qte_entree,
      stock_avant: stockAvant,
      stock_apres: stockAvant + qte_entree,
      depot: depot
    });
  }

  async deletePurchase(id: number, userId?: number, username?: string) {
    // 1. Get purchase info
    const { data: purchase, error: getError } = await this.supabase
      .from('achats')
      .select('*, achat_items(*)')
      .eq('id', id)
      .single();

    if (getError) throw new Error(getError.message);

    // 2. Revert Stock and PMP
    await this.revertStockAndPMP(purchase);

    // 3. Delete (or Soft Delete)
    const { error: deleteError } = await this.supabase
      .from('achats')
      .delete() // or update is_deleted = true
      .eq('id', id);

    if (deleteError) throw new Error(deleteError.message);

    // 4. Log Activity
    await this.supabase.from('activity_log').insert({
      user_id: userId,
      username: username,
      action: 'DELETE',
      entity_type: 'Achat',
      entity_id: id,
      details: `L'achat N°${purchase.numero_facture} a été supprimé.`
    });

    return true;
  }

  private async revertStockAndPMP(purchase: any) {
    const { id: purchaseId, depot_nom: depot, achat_items: items } = purchase;
    const purchaseRef = `ACH-${purchaseId}`;

    for (const item of items) {
      const { article_id, quantite: qte_a_retirer, prix_unitaire_ht: pu_achat_original } = item;

      // Get current state
      const { data: articleData } = await this.supabase
        .from('articles')
        .select('pmp_ht, stocks(quantite, depot_nom)')
        .eq('id', article_id)
        .single();

      const pmp_actuel = articleData?.pmp_ht || 0;
      const total_stock_actuel = (articleData?.stocks as any[])?.reduce((acc, s) => acc + s.quantite, 0) || 0;
      
      const stockInDepot = (articleData?.stocks as any[])?.find(s => s.depot_nom === depot);
      const stockAvantReversion = stockInDepot?.quantite || 0;

      // Revert Stock in depot
      await this.supabase
        .from('stocks')
        .update({ quantite: stockAvantReversion - qte_a_retirer })
        .eq('article_id', article_id)
        .eq('depot_nom', depot);

      // Revert PMP
      const total_stock_avant_achat = total_stock_actuel - qte_a_retirer;
      let pmp_precedent = 0;

      if (total_stock_avant_achat > 0.001) {
        const valeur_stock_actuel = total_stock_actuel * pmp_actuel;
        const valeur_achat_original = qte_a_retirer * pu_achat_original;
        const valeur_stock_precedent = valeur_stock_actuel - valeur_achat_original;
        pmp_precedent = valeur_stock_precedent / total_stock_avant_achat;
      }
      
      if (pmp_precedent < 0) pmp_precedent = 0;

      await this.supabase
        .from('articles')
        .update({ pmp_ht: pmp_precedent })
        .eq('id', article_id);

      // Delete Movement
      await this.supabase
        .from('mouvements')
        .delete()
        .eq('type', 'achat')
        .eq('nr_doc', purchaseRef)
        .eq('article_id', article_id);
    }
  }

  async addPayment(purchaseId: number, amount: number, method: string, reference: string, userId?: number, username?: string) {
    // 1. Insert Payment
    const { data: payment, error: paymentError } = await this.supabase
      .from('paiements')
      .insert({
        achat_id: purchaseId,
        date_operation: new Date().toISOString().split('T')[0],
        montant_regle: amount,
        moyen_reglement: method,
        reference_paiement: reference,
        utilisateur: username
      })
      .select()
      .single();

    if (paymentError) throw new Error(paymentError.message);

    // 2. Update Purchase Balance
    const { data: purchase } = await this.supabase
      .from('achats')
      .select('montant_total, montant_paye')
      .eq('id', purchaseId)
      .single();

    const newTotalPaid = (purchase?.montant_paye || 0) + amount;
    const total = purchase?.montant_total || 0;
    
    let statut = "Non Payée";
    if (newTotalPaid > 0.001) {
      statut = Math.abs(total - newTotalPaid) < 0.01 ? "Payée" : "Partiellement Payée";
    }

    await this.supabase
      .from('achats')
      .update({
        montant_paye: newTotalPaid,
        statut: statut
      })
      .eq('id', purchaseId);

    return payment;
  }
}
