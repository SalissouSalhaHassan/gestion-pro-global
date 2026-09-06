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
  entityType: 'factures' | 'mouvements' | 'stocks' | 'clients' | 'fournisseurs' | 'expenses' | 'articles' | 'loyers' | 'avances',
  policy?: 'shared' | 'personal' | 'depot' | string
): T {
  if (!session) return query;

  // 1. Mandatory Organization Scope
  if (session.organization_id) {
    if (entityType === 'avances') {
      // avances_clients is linked to the tenant organization through its client
      query = (query as any).eq('clients.organization_id', session.organization_id);
    } else {
      query = (query as any).eq('organization_id', session.organization_id);
    }
  }

  // 2. Admin/Manager: sees everything within their organization regardless of policy
  const isAdmin = (session.admin === "Oui" || session.admin === "oui" || session.admin === "true" || (session as any).admin === true) || 
                  (session.role === 1 || session.role === "1" || session.role === "admin" || session.role === 2 || session.role === "2" || session.role === "manager");
  
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

  // 4. Scoping for sales/invoices (Configurable by Admin via invoice_visibility_policy)
  if (entityType === 'factures') {
    const effectivePolicy = policy || (session as any).invoice_visibility_policy || 'shared';

    // Option A: Isolation per Cashier/Seller ('personal')
    // Each cashier or seller strictly sees only their own sales
    if (effectivePolicy === 'personal') {
      let filter = `user_id.eq.${session.id},created_by.eq.${session.id}`;
      if (session.username) {
        filter += `,vendeur.eq."${session.username}"`;
      }
      return (query as any).or(filter);
    }

    // Option B: Isolation per Depot/Caisse/Store ('depot')
    // Cashiers only see sales originating from their assigned depot
    if (effectivePolicy === 'depot') {
      const allowedDepotNames = getAllowedDepots(session);
      if (allowedDepotNames.length === 0 && session.emplacement) {
        allowedDepotNames.push(session.emplacement);
      }
      if (allowedDepotNames.length > 0) {
        return (query as any).in('emplacement', allowedDepotNames);
      } else {
        return (query as any).eq('id', -1);
      }
    }

    // Option C: Shared Company-Wide ('shared' - default)
    // Cashiers & Finance staff see all company invoices to allow smooth cashing/collection
    const perms = Array.isArray(session.permissions) ? session.permissions : [];
    const isCaissierOrFinance = session.role === 4 || session.role === "4" || session.role === 5 || session.role === "5" ||
                               perms.includes('sale.invoices_view') || perms.includes('pos.access') || perms.includes('report.finance') || perms.includes('expense.cash_balance');

    if (isCaissierOrFinance) {
      return query;
    }

    // Individual field sellers without cashier rights only see their own
    let filter = `user_id.eq.${session.id},created_by.eq.${session.id}`;
    if (session.username) {
      filter += `,vendeur.eq."${session.username}"`;
    }
    return (query as any).or(filter);
  }

  // 5. Scoping for advances
  if (entityType === 'avances') {
    const allowedDepotNames = getAllowedDepots(session);
    if (allowedDepotNames.length === 0 && session.emplacement) {
      allowedDepotNames.push(session.emplacement);
    }
    if (allowedDepotNames.length > 0) {
      return (query as any).in('emplacement', allowedDepotNames);
    }
    return query;
  }

  return query;
}
