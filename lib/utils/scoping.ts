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
/**
 * Applies data isolation filters to a Supabase query based on user session.
 */
export function applyUserScope<T extends PostgrestFilterBuilder<any, any, any, any>>(
  query: T,
  session: CustomSession,
  entityType: 'factures' | 'mouvements' | 'stocks' | 'clients' | 'fournisseurs' | 'expenses'
): T {
  // 1. Admin/Manager: No filters (sees everything).
  const isAdmin = (session.admin === "Oui" || session.admin === "oui" || session.admin === "true" || (session as any).admin === true) || 
                  (session.role === 1 || session.role === "1" || session.role === "admin");
  
  if (isAdmin) return query;

  // 2. Scoping by Warehouse (for Inventory/Stock related tables)
  if (['mouvements', 'stocks', 'expenses'].includes(entityType)) {
    const allowedDepotNames = getAllowedDepots(session);
    
    // Fallback to session.emplacement if nothing in depots list
    if (allowedDepotNames.length === 0 && session.emplacement) {
      allowedDepotNames.push(session.emplacement);
    }

    if (allowedDepotNames.length > 0) {
      const column = entityType === 'stocks' ? 'depot_nom' : 'depot';
      return (query as any).in(column, allowedDepotNames);
    } else {
      // No warehouses assigned: force empty result for non-admins
      return (query as any).eq('id', -1); 
    }
  }

  // 3. Scoping by Ownership (for sales/invoices)
  if (entityType === 'factures') {
    // Sellers only see their own invoices or invoices in their allowed depots
    const allowedDepots = getAllowedDepots(session);
    let filter = `user_id.eq.${session.id}`;
    
    if (session.username) {
      filter += `,vendeur.eq."${session.username}"`;
    }
    
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

  return query;
}
