import { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type Contract = {
  id: number;
  locataire_nom_complet: string;
  ref_locataire: string;
  locataire_telephone?: string;
  locataire_email?: string;
  locataire_cni?: string;
  date_naissance?: string;
  adresse_complete?: string;
  profession?: string;
  piece_jointe?: string;
  type_bien?: string;
  bien_loue_details: string;
  quartier?: string;
  loyer_mensuel: number;
  caution?: number;
  annee_debut?: number;
  mois_debut?: number;
  statut: 'Actif' | 'Expiré' | 'Annulé';
  is_deleted?: boolean;
  created_at?: string;
  updated_at?: string;
  total_paye?: number;
  retards?: number;
  mois_impayes?: string;
  echeance?: string;
};

export type ContractFormData = Omit<Contract, 'id' | 'is_deleted' | 'created_at' | 'updated_at' | 'total_paye'>;

export type Payment = {
  id: number;
  contrat_id: number;
  date_paiement: string;
  montant: number;
  mode_paiement: string;
  description?: string;
  nom_de_mois?: string;
  qte_mois?: number;
  periode_debut?: string;
  periode_fin?: string;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  locataire_nom_complet?: string;
  bien_loue_details?: string;
  ref_locataire?: string;
};

export type PaymentFormData = {
  contrat_id: number;
  date_paiement: string;
  montant: number;
  mode_paiement: string;
  description?: string;
  nom_de_mois?: string;
  qte_mois?: number;
  periode_debut?: string;
  periode_fin?: string;
};

export type PaymentFilters = {
  locataire?: string;
  mois?: string;
  mode?: string;
  start_date?: string;
  end_date?: string;
};

// ─── Service ────────────────────────────────────────────────────────────────────

export class ContractService {
  constructor(private supabase: SupabaseClient) {}

  // ── Contracts ──

  async loadContracts(): Promise<Contract[]> {
    // First get all active contracts
    const { data: contracts, error } = await this.supabase
      .from('contrats')
      .select('*')
      .eq('is_deleted', false)
      .order('id', { ascending: false });

    if (error) throw new Error(error.message);
    if (!contracts || contracts.length === 0) return [];

    // Get total payments for each contract
    const contractIds = contracts.map(c => c.id);
    const { data: payments, error: payError } = await this.supabase
      .from('contrat_paiements')
      .select('contrat_id, montant')
      .in('contrat_id', contractIds);

    if (payError) {
      console.error('Error loading payment totals:', payError.message);
    }

    // Calculate totals and find latest payment dates
    const totals: Record<number, number> = {};
    const latestPaymentDates: Record<number, Date> = {};

    if (payments) {
      for (const p of payments) {
        totals[p.contrat_id] = (totals[p.contrat_id] || 0) + (p.montant || 0);
        
        // Use either periode_fin or date_paiement to find latest
        const pDate = p.periode_fin ? new Date(p.periode_fin) : new Date(p.date_paiement);
        if (!latestPaymentDates[p.contrat_id] || pDate > latestPaymentDates[p.contrat_id]) {
          latestPaymentDates[p.contrat_id] = pDate;
        }
      }
    }

    return contracts.map(c => {
      const paid = totals[c.id] || 0;
      const today = new Date();
      const currentYearReal = today.getFullYear();
      const currentMonthReal = today.getMonth() + 1; // 1-12
      
      const startYear = c.annee_debut || 2024;
      const startMonth = c.mois_debut || 1;
      
      // 1. Calculate total expected months from start to current date
      const totalMonthsExpected = (currentYearReal - startYear) * 12 + (currentMonthReal - startMonth + 1);
      
      // 2. Calculate months paid based on total amount
      const monthsPaid = Math.floor(paid / (c.loyer_mensuel || 1));
      
      // 3. Calculate delays
      const unpaidMonthsCount = Math.max(0, totalMonthsExpected - monthsPaid);
      const retards = unpaidMonthsCount * (c.loyer_mensuel || 0);
      
      // 4. Format Mois Impayés with multi-year detail
      let moisImpayes = "À jour";
      if (unpaidMonthsCount > 0) {
        const unpaidYears: Record<number, number> = {};
        let currentYearIter = startYear;
        let currentMonthIter = startMonth;
        let monthsToSkip = monthsPaid;
        let remainingToCount = unpaidMonthsCount;

        // Iterate through all months from start until we've counted all unpaid months
        while (remainingToCount > 0) {
          if (monthsToSkip > 0) {
            monthsToSkip--;
          } else {
            unpaidYears[currentYearIter] = (unpaidYears[currentYearIter] || 0) + 1;
            remainingToCount--;
          }
          
          currentMonthIter++;
          if (currentMonthIter > 12) {
            currentMonthIter = 1;
            currentYearIter++;
          }
          
          if (currentYearIter > currentYearReal + 5) break; // Safety
        }
        
        moisImpayes = Object.entries(unpaidYears)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([year, count]) => `${year}: ${count}m`)
          .join(", ");
      }

      // 5. Calculate Échéance: Next month after the latest payment
      let echeance = "N/A";
      const lastPayDate = latestPaymentDates[c.id];
      if (lastPayDate) {
        const nextMonth = new Date(lastPayDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1); // Usually due on the 1st of the next month
        echeance = nextMonth.toLocaleDateString('fr-FR');
      } else {
        // If no payments, due on start month
        const start = new Date(startYear, startMonth - 1, 1);
        echeance = start.toLocaleDateString('fr-FR');
      }

      return {
        ...c,
        total_paye: paid,
        retards: retards,
        mois_impayes: moisImpayes,
        echeance: echeance
      };
    });
  }

  async getContractDetails(id: number): Promise<Contract | null> {
    const { data, error } = await this.supabase
      .from('contrats')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async saveContract(formData: ContractFormData, contractId?: number): Promise<boolean> {
    const payload: Record<string, any> = { ...formData };

    // Convert date_naissance from dd/mm/yyyy to yyyy-mm-dd if present
    if (payload.date_naissance) {
      const parts = payload.date_naissance.split('/');
      if (parts.length === 3) {
        payload.date_naissance = `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else {
        payload.date_naissance = null;
      }
    }

    // REMOVE MISSING COLUMNS (annee_debut, mois_debut) to prevent "column not found" error
    // These should be added to the DB schema via SQL later
    delete payload.annee_debut;
    delete payload.mois_debut;

    // Ensure numeric fields
    payload.loyer_mensuel = parseFloat(payload.loyer_mensuel) || 0;
    payload.caution = parseFloat(payload.caution) || 0;

    if (contractId) {
      payload.updated_at = new Date().toISOString();
      const { error } = await this.supabase
        .from('contrats')
        .update(payload)
        .eq('id', contractId);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await this.supabase
        .from('contrats')
        .insert(payload);

      if (error) throw new Error(error.message);
    }

    return true;
  }

  async deleteContract(id: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('contrats')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  async getLatestContractByTenantName(name: string): Promise<Contract | null> {
    const { data, error } = await this.supabase
      .from('contrats')
      .select('*')
      .eq('locataire_nom_complet', name)
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data;
  }

  async getAllTenantNames(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('contrats')
      .select('locataire_nom_complet')
      .not('locataire_nom_complet', 'is', null)
      .neq('locataire_nom_complet', '')
      .order('locataire_nom_complet');

    if (error) throw new Error(error.message);
    const names = [...new Set((data || []).map(r => r.locataire_nom_complet))];
    return names;
  }

  async updateContractStatus(id: number, status: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('contrats')
      .update({ statut: status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return true;
  }

  // ── Payments ──

  async loadPayments(filters?: PaymentFilters): Promise<Payment[]> {
    let query = this.supabase
      .from('contrat_paiements')
      .select(`
        id, date_paiement, montant, mode_paiement, nom_de_mois,
        qte_mois, periode_debut, periode_fin, description,
        contrat_id,
        contrats!inner (
          locataire_nom_complet,
          bien_loue_details,
          ref_locataire
        )
      `)
      .order('id', { ascending: false });

    if (filters) {
      if (filters.locataire) {
        query = query.ilike('contrats.locataire_nom_complet', `%${filters.locataire}%`);
      }
      if (filters.mois) {
        query = query.ilike('nom_de_mois', `%${filters.mois}%`);
      }
      if (filters.mode && filters.mode !== 'Tous les modes') {
        query = query.eq('mode_paiement', filters.mode);
      }
      if (filters.start_date) {
        query = query.gte('date_paiement', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('date_paiement', filters.end_date);
      }
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    // Flatten the joined data
    return (data || []).map((row: any) => ({
      id: row.id,
      contrat_id: row.contrat_id,
      date_paiement: row.date_paiement,
      montant: row.montant,
      mode_paiement: row.mode_paiement,
      nom_de_mois: row.nom_de_mois,
      qte_mois: row.qte_mois,
      periode_debut: row.periode_debut,
      periode_fin: row.periode_fin,
      description: row.description,
      locataire_nom_complet: row.contrats?.locataire_nom_complet,
      bien_loue_details: row.contrats?.bien_loue_details,
      ref_locataire: row.contrats?.ref_locataire,
    }));
  }

  async loadPaymentsForContract(contractId: number): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('contrat_paiements')
      .select('*')
      .eq('contrat_id', contractId)
      .order('id', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  }

  async getPaymentDetails(paymentId: number): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('contrat_paiements')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async savePayment(formData: PaymentFormData): Promise<boolean> {
    const payload: Record<string, any> = { ...formData };

    // Convert dates from dd/mm/yyyy to yyyy-mm-dd
    for (const key of ['date_paiement', 'periode_debut', 'periode_fin'] as const) {
      if (payload[key]) {
        const parts = payload[key].split('/');
        if (parts.length === 3) {
          payload[key] = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          payload[key] = null;
        }
      }
    }

    const { error } = await this.supabase
      .from('contrat_paiements')
      .insert(payload);

    if (error) throw new Error(error.message);
    return true;
  }

  async updatePayment(paymentId: number, data: Partial<PaymentFormData>): Promise<boolean> {
    const payload: Record<string, any> = { ...data };

    // Convert dates from dd/mm/yyyy to yyyy-mm-dd
    for (const key of ['date_paiement', 'periode_debut', 'periode_fin'] as const) {
      if (payload[key]) {
        const parts = payload[key].split('/');
        if (parts.length === 3) {
          payload[key] = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          payload[key] = null;
        }
      }
    }

    payload.updated_at = new Date().toISOString();

    const { error } = await this.supabase
      .from('contrat_paiements')
      .update(payload)
      .eq('id', paymentId);

    if (error) throw new Error(error.message);
    return true;
  }

  async deletePayment(paymentId: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('contrat_paiements')
      .delete()
      .eq('id', paymentId);

    if (error) throw new Error(error.message);
    return true;
  }

  async getLastPaymentEndDate(contractId: number): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('contrat_paiements')
      .select('periode_fin')
      .eq('contrat_id', contractId)
      .not('periode_fin', 'is', null)
      .order('periode_fin', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (!data?.periode_fin) return null;

    // Convert from yyyy-mm-dd to dd/mm/yyyy
    const d = new Date(data.periode_fin);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
}
