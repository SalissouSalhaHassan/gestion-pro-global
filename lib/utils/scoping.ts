import { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { CustomSession, isAdminOrManager, getAllowedDepots } from "@/lib/auth_helper";
import { createClient } from "@/lib/supabase/server";

/**
 * Applies data isolation filters to a Supabase query based on user session.
 * 
 * Rules:
 * - Admin/Manager: No filters (sees everything).
 * - Seller:
 *    - For 'factures': sees only their own sales (by user_id or vendeur name).
 *    - For 'stocks' or 'mouvements': sees only data for their allowed warehouses.
 */
export async function applyUserScope<T extends PostgrestFilterBuilder<any, any, any, any>>(
  query: T,
  session: CustomSession,
  entityType: 'factures' | 'mouvements' | 'stocks' | 'clients' | 'fournisseurs'
): Promise<T> {
  const isAdmin = await isAdminOrManager(session);
  if (isAdmin) return query; // Admins see everything

  const supabase = await createClient();

  // 1. SCoping by Warehouse (for Inventory/Stock related tables)
  if (['mouvements', 'stocks'].includes(entityType)) {
    // Fetch assigned warehouses for the user
    // Note: user_warehouses table might still have depot_id but it links to a name in the depots table
    const { data: allowed } = await supabase
      .from('user_warehouses')
      .select('depot_id') 
      .eq('user_id', session.id);

    const depotIds = allowed?.map((d: any) => d.depot_id).filter(Boolean) || [];
    
    // Resolve IDs to Names
    const { data: depotObjects } = await supabase
      .from('depots')
      .select('nom')
      .in('id', depotIds);

    const allowedDepotNames = depotObjects?.map((d: any) => d.nom) || [];
    
    // Fallback to session.emplacement if nothing in user_warehouses
    if (allowedDepotNames.length === 0 && session.emplacement) {
      allowedDepotNames.push(session.emplacement);
    }

    if (allowedDepotNames.length > 0) {
      // Apply filter: depot column in allowed list
      const column = entityType === 'stocks' ? 'depot_nom' : 'depot';
      return (query as any).in(column, allowedDepotNames);
    } else {
      // No warehouses assigned: force empty result for non-admins
      return (query as any).eq('id', -1); 
    }
  }

  // 2. Scoping by Ownership (for sales/invoices)
  if (entityType === 'factures') {
    // Sellers only see their own invoices or invoices in their allowed depots
    const allowedDepots = await getAllowedDepots(session);
    let filter = `user_id.eq.${session.id},vendeur.eq.${session.username}`;
    
    if (session.emplacement) {
      filter += `,emplacement.eq."${session.emplacement}"`;
    }
    
    if (allowedDepots.length > 0) {
      // Join with quotes for safety if they contain spaces
      const depotsList = allowedDepots.map(d => `"${d}"`).join(',');
      filter += `,emplacement.in.(${depotsList})`;
    }
    
    return (query as any).or(filter);
  }

  // 3. For Clients/Fournisseurs (Optional: can be limited by area if needed)
  // For now, allow reading all clients for reference, but restrict mutations in RLS
  
  return query;
}
