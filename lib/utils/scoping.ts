import { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { CustomSession, isAdminOrManager, getAllowedDepots } from "@/lib/auth_helper";

/**
 * Applies strict multi-tenant and user isolation filters to a Supabase query based on user session.
 * 
 * Rules:
 * 1. Multi-Tenant Isolation (Highest Priority):
 *    - Every organization only sees its own records (organization_id = session.organization_id).
 *    - An Admin of a tenant is ONLY an Admin within their own organization.
 * 2. Role / Staff Scoping (Within the Tenant):
 *    - Tenant Admin/Manager: Sees all records within their organization.
 *    - Seller / Cashier:
 *       - For 'factures': sees only their own sales.
 *       - For 'stocks' / 'mouvements': sees only data for their authorized depots.
 */
export function applyUserScope<T extends PostgrestFilterBuilder<any, any, any, any>>(
  query: T,
  session: CustomSession,
  entityType: 'factures' | 'mouvements' | 'stocks' | 'clients' | 'fournisseurs' | 'expenses' | 'articles' | 'loyers' | 'avances'
): T {
  if (!session) return query;

  // 1. Mandatory Organization Scope
  if (session.organization_id) {
    query = (query as any).eq('organization_id', session.organization_id);
  }

  // 2. Admin/Manager: sees everything within their organization
  const isAdmin = (session.admin === "Oui" || session.admin === "oui" || session.admin === "true" || (session as any).admin === true) || 
                  (session.role === 1 || session.role === "1" || session.role === "admin");
  
  if (isAdmin) return query;

  // 3. Scoping by Warehouse (for Inventory/Stock related tables)
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

  // 4. Scoping by Ownership (for sales/invoices)
  if (entityType === 'factures') {
    // Sellers only see their own invoices or invoices in their allowed depots
    let filter = `user_id.eq.${session.id}`;
    
    if (session.username) {
      filter += `,vendeur.eq."${session.username}"`;
    }
    
    return (query as any).or(filter);
  }

  if (entityType === 'avances') {
    return (query as any).eq('utilisateur', session.username);
  }

  return query;
}
