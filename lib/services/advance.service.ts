import { SupabaseClient } from '@supabase/supabase-js';

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

  async getAllAdvances() {
    const { data, error } = await this.supabase
      .from('avances_clients')
      .select('*, clients(nom)')
      .order('date_creation', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  }

  async createAdvance(advanceData: Omit<Advance, 'id' | 'statut' | 'montant_restant'>) {
    const payload = {
        ...advanceData,
        montant_restant: advanceData.montant_initial,
        statut: 'Disponible',
    };
    
    // Nullify empty reference_paiement to avoid UNIQUE constraint violations
    if (payload.reference_paiement === "") {
        payload.reference_paiement = null as any;
    }

    const { data, error } = await this.supabase
      .from('avances_clients')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async withdrawAdvance(advanceId: number, amount: number, notes?: string, username?: string) {
    // Transaction-like behavior
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
      .select()
      .single();

    if (updateError) throw new Error(updateError.message);

    // Optional: Log the withdrawal into a history or `paiements` table if needed
    // Example: insert into paiements table as an advance usage or withdrawal.

    return updatedAdvance;
  }

  async cancelAdvance(advanceId: number) {
    const { data, error } = await this.supabase
      .from('avances_clients')
      .update({ statut: 'Annulée' })
      .eq('id', advanceId)
      .eq('statut', 'Disponible') // Can only cancel available ones
      .select()
      .single();

    if (error) throw new Error("Cannot cancel advance, might already be used or an error occurred.");
    return data;
  }

  async updateAdvance(advanceId: number, updateData: Partial<Omit<Advance, 'id'>>) {
    // Note: If montant_initial changes, we might need to adjust montant_restant. 
    // To keep it simple, we assume edits are for metadata or fixing typos before it's used.
    if (updateData.reference_paiement === "") {
       updateData.reference_paiement = null as any;
    }
    const { data, error } = await this.supabase
      .from('avances_clients')
      .update(updateData)
      .eq('id', advanceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async deleteAdvance(advanceId: number) {
    const { error } = await this.supabase
      .from('avances_clients')
      .delete()
      .eq('id', advanceId);

    if (error) throw new Error(error.message);
    return true;
  }

  async getActiveAdvancesByClientId(clientId: number) {
    const { data, error } = await this.supabase
      .from('avances_clients')
      .select('*')
      .eq('client_id', clientId)
      .in('statut', ['Disponible', 'Partiellement utilisée'])
      .order('date_avance', { ascending: true }); // FIFO: oldest first

    if (error) throw new Error(error.message);
    return data;
  }
}

