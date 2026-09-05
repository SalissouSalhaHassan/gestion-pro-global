import { SupabaseClient } from '@supabase/supabase-js';
import { applyUserScope } from '../utils/scoping';
import { CustomSession } from '../auth_helper';

export type Advance = {
  id: number;
  client_id: number;
  date_avance: string;
  montant_initial: number;
  montant_restant: number;
  moyen_paiement: string;
  reference_paiement?: string;
  notes?: string;
  utilisateur?: string;
  statut: 'Disponible' | 'Partiellement utilisée' | 'Utilisée' | 'Annulée';
  emplacement?: string;
};

export class AdvanceService {
  constructor(private supabase: SupabaseClient) {}

  async getAllAdvances(session?: CustomSession) {
    let query = this.supabase
      .from('avances_clients')
      .select('*, clients!inner(id, nom, tel, ref_client, adresse, organization_id)')
      .order('date_creation', { ascending: false });

    if (session) {
        query = applyUserScope(query as any, session, 'avances');
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data;
  }

  async createAdvance(advanceData: Omit<Advance, 'id' | 'statut' | 'montant_restant'>, session?: CustomSession) {
    const payload = {
        ...advanceData,
        montant_restant: advanceData.montant_initial,
        statut: 'Disponible',
        utilisateur: session?.username || advanceData.utilisateur,
        emplacement: session?.emplacement || advanceData.emplacement
    };
    
    if (payload.reference_paiement === "") {
        payload.reference_paiement = null as any;
    }

    const { data, error } = await this.supabase
      .from('avances_clients')
      .insert(payload)
      .select('*, clients(id, nom, tel, ref_client, adresse)')
      .single();

    if (error) throw new Error(error.message);
    
    await this.logAction(data.id, 'CREATE', data.montant_initial, session?.username, "Création du dépôt initial");

    return data;
  }

  async withdrawAdvance(advanceId: number, amount: number, notes?: string, username?: string) {
    const { data: advance, error: fetchError } = await this.supabase
      .from('avances_clients')
      .select('*')
      .eq('id', advanceId)
      .single();

    if (fetchError) throw new Error(fetchError.message);
    if (!advance) throw new Error("Advance not found.");
    if (advance.montant_restant < amount) throw new Error("Insufficient remaining amount.");

    const newRestant = advance.montant_restant - amount;
    let newStatus = advance.statut;
    if (newRestant === 0) {
      newStatus = 'Utilisée';
    } else if (newRestant < advance.montant_initial) {
      newStatus = 'Partiellement utilisée';
    }

    const { data: updatedAdvance, error: updateError } = await this.supabase
      .from('avances_clients')
      .update({
        montant_restant: newRestant,
        statut: newStatus
      })
      .eq('id', advanceId)
      .select('*, clients(id, nom, tel, ref_client, adresse)')
      .single();

    if (updateError) throw new Error(updateError.message);

    await this.logAction(advanceId, 'WITHDRAW', amount, username, notes || "Retrait de fonds");

    return updatedAdvance;
  }

  async cancelAdvance(advanceId: number, username?: string) {
    const { data, error } = await this.supabase
      .from('avances_clients')
      .update({ statut: 'Annulée' })
      .eq('id', advanceId)
      .eq('statut', 'Disponible')
      .select('*, clients(id, nom, tel, ref_client, adresse)')
      .single();

    if (error) throw new Error("Cannot cancel advance, might already be used or an error occurred.");
    
    await this.logAction(advanceId, 'CANCEL', data.montant_initial, username, "Annulation du dépôt");
    
    return data;
  }

  async updateAdvance(advanceId: number, updateData: Partial<Omit<Advance, 'id'>>, username?: string) {
    if (updateData.reference_paiement === "") {
       updateData.reference_paiement = null as any;
    }
    const { data, error } = await this.supabase
      .from('avances_clients')
      .update(updateData)
      .eq('id', advanceId)
      .select('*, clients(id, nom, tel, ref_client, adresse)')
      .single();

    if (error) throw new Error(error.message);
    
    await this.logAction(advanceId, 'UPDATE', 0, username, "Mise à jour des informations");

    return data;
  }

  async getAdvanceHistory(advanceId: number) {
    const { data, error } = await this.supabase
        .from('avances_history')
        .select('*')
        .eq('advance_id', advanceId)
        .order('date_action', { ascending: false });
    
    if (error) return [];
    return data;
  }

  private async logAction(advanceId: number, action: string, amount: number, user?: string, notes?: string) {
    try {
        await this.supabase.from('avances_history').insert({
            advance_id: advanceId,
            action,
            amount,
            utilisateur: user,
            notes,
            date_action: new Date().toISOString()
        });
    } catch (e) {
        console.error("Audit log failed:", e);
    }
  }

  async deleteAdvance(advanceId: number) {
    const { error } = await this.supabase
      .from('avances_clients')
      .delete()
      .eq('id', advanceId);

    if (error) throw new Error(error.message);
    return true;
  }

  async getActiveAdvancesByClientId(clientId: number, session?: CustomSession) {
    let query = this.supabase
      .from('avances_clients')
      .select('*, clients!inner(id, organization_id)')
      .eq('client_id', clientId)
      .in('statut', ['Disponible', 'Partiellement utilisée'])
      .gt('montant_restant', 0)
      .order('date_avance', { ascending: true });

    if (session) {
      query = applyUserScope(query as any, session, 'avances');
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data || [];
  }
}
