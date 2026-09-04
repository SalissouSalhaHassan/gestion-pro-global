import { SupabaseClient } from '@supabase/supabase-js';
import { applyUserScope } from '@/lib/utils/scoping';

export type Supplier = {
  id?: number;
  ref_fournisseur: string;
  nom: string;
  contact?: string;
  tel?: string;
  gsm?: string;
  adresse?: string;
  email?: string;
  site?: string;
  credit?: number;
  is_deleted?: boolean;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
};

export class SupplierService {
  constructor(private supabase: SupabaseClient) {}

  async getSuppliers(session: any) {
    let query = this.supabase
      .from('fournisseurs')
      .select('*')
      .eq('is_deleted', false)
      .order('nom', { ascending: true });

    query = applyUserScope(query as any, session, 'fournisseurs');

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }

  async getSupplierById(id: number, session: any) {
    let query = this.supabase
      .from('fournisseurs')
      .select('*')
      .eq('id', id);
    
    query = applyUserScope(query as any, session, 'fournisseurs');

    const { data, error } = await query.single();
    if (error) return null;
    return data;
  }

  async createSupplier(supplierData: Supplier, session?: any) {
    const orgId = supplierData.organization_id || session?.organization_id || '00000000-0000-0000-0000-000000000001';
    const { data, error } = await this.supabase
      .from('fournisseurs')
      .insert({
        ...supplierData,
        organization_id: orgId,
        is_deleted: false,
        credit: supplierData.credit || 0
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async updateSupplier(id: number, supplierData: Partial<Supplier>, session?: any) {
    let query = this.supabase
      .from('fournisseurs')
      .update({
        ...supplierData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (session?.organization_id) {
      query = query.eq('organization_id', session.organization_id);
    }

    const { data, error } = await query
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async deleteSupplier(id: number, session?: any) {
    let query = this.supabase
      .from('fournisseurs')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', id);

    if (session?.organization_id) {
      query = query.eq('organization_id', session.organization_id);
    }

    const { error } = await query;

    if (error) throw new Error(error.message);
    return true;
  }
}
