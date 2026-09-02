/**
 * Offline POS Synchronization Engine
 * Handles local caching, offline sales recording, and automatic background sync
 */

export interface OfflineInvoice {
  offlineId: string;
  timestamp: number;
  clientId: number | string;
  clientName: string;
  items: Array<{
    articleId: string | number;
    reference: string;
    designation: string;
    quantite: number;
    p_vente_ttc: number;
    total: number;
    depot_origine?: string | null;
  }>;
  totalTTC: number;
  remise: number;
  modePaiement: string;
  montantRecu: number;
  monnaieRendue: number;
  organizationId?: string;
  synced: boolean;
}

const STORAGE_KEYS = {
  ARTICLES_CACHE: "gp_offline_articles",
  CLIENTS_CACHE: "gp_offline_clients",
  PENDING_INVOICES: "gp_offline_pending_invoices",
  LAST_SYNC: "gp_offline_last_sync",
};

/**
 * Cache articles for offline searching and sales
 */
export function cacheArticlesOffline(articles: any[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.ARTICLES_CACHE, JSON.stringify(articles));
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  } catch (e) {
    console.warn("Failed to cache articles offline:", e);
  }
}

/**
 * Retrieve cached articles from local storage
 */
export function getOfflineArticles(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ARTICLES_CACHE);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Save an invoice locally when network is offline
 */
export function recordOfflineInvoice(invoice: Omit<OfflineInvoice, "offlineId" | "timestamp" | "synced">): OfflineInvoice {
  if (typeof window === "undefined") throw new Error("Window not available");

  const newOfflineInvoice: OfflineInvoice = {
    ...invoice,
    offlineId: `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    timestamp: Date.now(),
    synced: false,
  };

  try {
    const pending = getPendingOfflineInvoices();
    pending.unshift(newOfflineInvoice);
    localStorage.setItem(STORAGE_KEYS.PENDING_INVOICES, JSON.stringify(pending));
  } catch (e) {
    console.error("Failed to store offline invoice:", e);
  }

  return newOfflineInvoice;
}

/**
 * Get list of pending offline invoices
 */
export function getPendingOfflineInvoices(): OfflineInvoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PENDING_INVOICES);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Remove or mark an offline invoice as synced
 */
export function removeSyncedOfflineInvoice(offlineId: string) {
  if (typeof window === "undefined") return;
  try {
    const pending = getPendingOfflineInvoices().filter((inv) => inv.offlineId !== offlineId);
    localStorage.setItem(STORAGE_KEYS.PENDING_INVOICES, JSON.stringify(pending));
  } catch (e) {
    console.error("Failed to update pending invoices:", e);
  }
}

/**
 * Synchronize all pending offline invoices to Supabase server
 */
export async function syncOfflineInvoicesToServer(
  createInvoiceFunction: (inv: any) => Promise<any>
): Promise<{ successCount: number; failedCount: number }> {
  const pending = getPendingOfflineInvoices();
  if (pending.length === 0) return { successCount: 0, failedCount: 0 };

  let successCount = 0;
  let failedCount = 0;

  for (const inv of pending) {
    try {
      await createInvoiceFunction(inv);
      removeSyncedOfflineInvoice(inv.offlineId);
      successCount++;
    } catch (err) {
      console.error(`Failed to sync offline invoice ${inv.offlineId}:`, err);
      failedCount++;
    }
  }

  return { successCount, failedCount };
}
