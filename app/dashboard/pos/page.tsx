"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  Banknote,
  Barcode,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Lock,
  Mic,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  Save,
  Search,
  Smartphone,
  ShoppingCart,
  Trash2,
  UserRound,
  UserPlus,
  UserCircle2,
  X,
  Loader2,
  ArrowLeft,
  Info,
  Camera,
  PauseCircle,
  Layers,
  Tag,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { getClientSessionFromCookie, isAdminOrManagerSession, DEFAULT_CLIENT_ID } from "@/lib/client_helpers";
import InvoiceModal from "../invoices/InvoiceModal";
import PaymentModal from "../invoices/PaymentModal";
import OfflinePOSBar from "@/components/OfflinePOSBar";
import BarcodeCameraScanner from "@/components/BarcodeCameraScanner";
import { cacheArticlesOffline, getOfflineArticles, recordOfflineInvoice } from "@/lib/utils/offline-sync";
import CashClosureModal from "../reports/cash-balance/CashClosureModal";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

type Article = {
  id: string | number;
  reference: string;
  code_barre: string | null;
  designation: string;
  p_vente_ht: number;
  p_vente_ttc: number;
  prix_gros?: number | null;
  prix_special?: number | null;
  taxe: number;
  image_path: string | null;
  stock_total: number;
  depot_stocks?: Record<string, number>;
};

type CartItem = Article & {
  quantite: number;
  depot_origine?: string | null;
  original_price?: number;
  price_modified?: boolean;
};

type Client = {
  id: string | number;
  ref_client: string | null;
  nom: string;
  tel: string | null;
  type_client?: string | null;
  credit_facture: number;
  points_fidelite?: number;
  niveau_fidelite?: string;
  carte_fidelite_numero?: string;
};

type Depot = {
  id: string | number;
  nom_depot: string;
};

type CompanyInfo = {
  nom_entreprise: string | null;
  telephone: string | null;
};

type Row = Record<string, unknown>;

type SessionCookieData = {
  id?: string | number;
  username?: string;
  role?: string | number;
  admin?: string | boolean;
  emplacement?: string;
  depots?: string;
};

type PriceChangeLogEntry = {
  id: string;
  articleId: string | number;
  designation: string;
  oldPrice: number;
  newPrice: number;
  quantity: number;
  changedAt: string;
  changedBy: string;
  invoiceId?: string | number | null;
  reason?: string;
};

type PendingPriceChange = {
  itemId: string | number;
  designation: string;
  oldPrice: number;
  newPrice: number;
  quantity: number;
};

type ParkedCart = {
  id: string;
  time: string;
  timestamp?: number;
  note?: string;
  cart: CartItem[];
  clientId: string | number;
  clientNom?: string;
  totalAmount?: number;
  selectedDepot: string;
  pricingTier?: "Détail" | "Gros" | "Revendeur";
  invoiceId: string | number | null;
  priceChanges: PriceChangeLogEntry[];
  priceDrafts: Record<string, string>;
};

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

const supabase = createClient();

const PRODUCT_IMAGES: Record<string, string> = {
  "coca cola": "/products/coca_cola.png",
  "coca-cola": "/products/coca_cola.png",
  "chips": "/products/chips.png",
  "lait": "/products/lait.png",
  "pomme": "/products/pomme.png",
  "shampooing": "/products/shampooing.png",
  "shampoing": "/products/shampooing.png",
};

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeDepotName(v: string) {
  return normalizeText(v).trim().replace(/\s+/g, " ");
}

function splitDepotList(...values: Array<string | null | undefined>) {
  const depots = values
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(depots));
}

function uniqueNames(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function findBestDepotMatch(target: string, candidates: string[]) {
  const normalizedTarget = normalizeDepotName(target);
  const uniqueCandidates = uniqueNames(candidates).map((candidate) => ({
    raw: candidate,
    key: normalizeDepotName(candidate),
  }));

  if (!normalizedTarget || uniqueCandidates.length === 0) return null;

  const exact = uniqueCandidates.find((candidate) => candidate.key === normalizedTarget);
  if (exact) return exact.raw;

  const targetTokens = normalizedTarget
    .split(" ")
    .filter((token) => token.length > 2 && token !== "depot");

  let bestMatch: { raw: string; score: number } | null = null;

  for (const candidate of uniqueCandidates) {
    let score = 0;

    if (candidate.key.includes(normalizedTarget) || normalizedTarget.includes(candidate.key)) {
      score += 10;
    }

    for (const token of targetTokens) {
      if (candidate.key.includes(token)) {
        score += 3;
      }
    }

    if (normalizedTarget.includes("boutique") && candidate.key.includes("boutique")) score += 6;
    if (normalizedTarget.includes("principal") && candidate.key.includes("principal")) score += 6;
    if (normalizedTarget.includes("magasin") && candidate.key.includes("magasin")) score += 6;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { raw: candidate.raw, score };
    }
  }

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.raw;
  }

  return uniqueCandidates.length === 1 ? uniqueCandidates[0].raw : null;
}

function getAvailableArticleStock(article: Article, depotName: string) {
  const depotStocks = article.depot_stocks || {};
  const depotKeys = Object.keys(depotStocks);
  const matchedDepot = findBestDepotMatch(depotName, depotKeys);
  const lookupKey = normalizeDepotName(matchedDepot || depotName);
  return depotStocks[lookupKey] || 0;
}

function isAdminSession(session: SessionCookieData | null) {
  if (!session) return false;

  const adminValue = String(session.admin ?? "").toLowerCase();
  const roleValue = String(session.role ?? "").toLowerCase();

  return (
    session.admin === true ||
    adminValue === "oui" ||
    adminValue === "true" ||
    adminValue === "yes" ||
    roleValue === "1" ||
    roleValue === "admin"
  );
}

function readClientSession(): SessionCookieData | null {
  try {
    const cookies = document.cookie.split("; ");
    const sessionCookie = cookies.find((cookie) => cookie.startsWith("gp_session="));

    if (!sessionCookie) return null;

    const decoded = decodeURIComponent(sessionCookie.split("=")[1]);
    return JSON.parse(decoded) as SessionCookieData;
  } catch (error) {
    console.error("Failed to read session data:", error);
    return null;
  }
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parsePersistedPriceChange(row: Row): PriceChangeLogEntry | null {
  const articleId = (row.article_id as string | number | undefined) ?? "";
  const rawDetails = String(row.fournisseur_client ?? "").trim();
  const segments = rawDetails
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  let designation = segments[0] || `Article ${articleId || "inconnu"}`;
  let oldPrice = toNumber(row.prix);
  let newPrice = toNumber(row.pv);
  let reason: string | undefined;

  const priceSegment = segments.find((segment) => /^prix\s+/i.test(segment));
  const priceMatch = priceSegment?.match(/prix\s+(-?\d+(?:[.,]\d+)?)\s*->\s*(-?\d+(?:[.,]\d+)?)/i);
  if (priceMatch) {
    oldPrice = Number(priceMatch[1].replace(",", "."));
    newPrice = Number(priceMatch[2].replace(",", "."));
  }

  const quantitySegment = segments.find((segment) => /^qt[ée]/i.test(segment));
  const quantityMatch = quantitySegment?.match(/(-?\d+(?:[.,]\d+)?)/);
  const quantity = quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : 0;

  const reasonSegment = segments.find((segment) => /^motif\s*:/i.test(segment));
  if (reasonSegment) {
    reason = reasonSegment.replace(/^motif\s*:/i, "").trim() || undefined;
  }

  const changedAt = String(row.date_mouvement ?? new Date().toISOString());
  const changedBy = String(row.utilisateur ?? "Système");
  const documentNumber = String(row.nr_doc ?? "");

  if (!designation && !documentNumber) return null;

  return {
    id: `${documentNumber || "audit"}-${articleId || "item"}-${changedAt}`,
    articleId,
    designation,
    oldPrice,
    newPrice,
    quantity,
    changedAt,
    changedBy,
    invoiceId: documentNumber || undefined,
    reason,
  };
}

function getProductImage(name: string): string | null {
  const lower = name.toLowerCase().trim();
  for (const [key, value] of Object.entries(PRODUCT_IMAGES)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

function buildArticle(row: Row): Article {
  const stocksArr = Array.isArray(row.stocks) ? row.stocks : [];
  const depotStocks: Record<string, number> = {};
  stocksArr.forEach((s: any) => {
    if (s.depot_nom) depotStocks[normalizeDepotName(String(s.depot_nom))] = toNumber(s.quantite);
  });

  return {
    id: row.id as string | number,
    reference: String(row.reference ?? ""),
    code_barre: row.code_barre ? String(row.code_barre) : null,
    designation: String(row.designation ?? row.nom ?? row.reference ?? ""),
    p_vente_ht: toNumber(row.p_vente_ht),
    p_vente_ttc: toNumber(row.p_vente_ttc ?? row.prix ?? row.price),
    prix_gros: row.prix_gros ? toNumber(row.prix_gros) : null,
    prix_special: row.prix_special ? toNumber(row.prix_special) : null,
    taxe: toNumber(row.taxe),
    image_path: row.image_path ? String(row.image_path) : null,
    stock_total: toNumber(row.stock_total),
    depot_stocks: depotStocks,
  };
}

function buildClient(row: Row): Client {
  return {
    id: row.id as string | number,
    ref_client: row.ref_client ? String(row.ref_client) : null,
    nom: String(row.nom ?? row.raison_sociale ?? `Client ${row.id}`),
    tel: row.tel ? String(row.tel) : null,
    type_client: row.type_client ? String(row.type_client) : (Number(row.prix_client) === 2 ? "Gros" : Number(row.prix_client) === 3 ? "Revendeur" : "Détail"),
    credit_facture: toNumber(row.credit_facture),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   INLINE STYLES — pixel-perfect match to the reference screenshot
   ═══════════════════════════════════════════════════════════════════ */

const S = {
  /* Root container */
  root: {
    height: "100vh",
    display: "flex",
    flexDirection: "column" as const,
    fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: "#0f172a",
    background: "linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #cbd5e1 100%)",
    overflow: "hidden",
    WebkitFontSmoothing: "antialiased" as const,
  },

  /* Customer Selector */
  customerBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: "12px",
    background: "#f8fafc",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
  },
  customerSelect: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 12,
    border: "2px solid #e2e8f0",
    background: "#fff",
    color: "#1e293b",
    fontWeight: 700,
    fontSize: 13,
    outline: "none",
    transition: "all 0.2s",
    cursor: "pointer",
  },
  customerInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 4px",
  },
  customerCreditBadge: {
    padding: "3px 8px",
    borderRadius: "20px",
    background: "#fee2e2",
    color: "#ef4444",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid #fecaca",
  },

  /* ── HEADER ── */
  header: {
    height: 64,
    background: "linear-gradient(135deg, #090d16 0%, #0f172a 60%, #1e1b4b 100%)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "0 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
    zIndex: 20,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  btnBack: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#e2e8f0",
    padding: "7px 14px",
    borderRadius: "10px",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.15s",
    textDecoration: "none",
  },
  headerStoreName: {
    fontWeight: 900,
    fontSize: 20,
    color: "#fff",
    letterSpacing: "-0.01em",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    color: "#94a3b8",
    fontWeight: 600,
    fontSize: 13,
  },
  headerInfoItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,0.06)",
    padding: "5px 10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: 700,
  },
  headerCashier: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#fff",
    background: "linear-gradient(135deg, rgba(79, 70, 229, 0.25) 0%, rgba(124, 58, 237, 0.25) 100%)",
    border: "1px solid rgba(99, 102, 241, 0.35)",
    padding: "6px 12px",
    borderRadius: "10px",
    fontWeight: 800,
    fontSize: 13,
  },

  /* ── MAIN BODY ── */
  body: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    padding: "12px 16px",
    gap: 12,
  },

  /* ── SECTION PANEL ── */
  panel: {
    display: "flex",
    flexDirection: "column" as const,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.05)",
  },
  panelHeader: {
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    letterSpacing: "0.04em",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  /* ── PRODUCTS COLUMN ── */
  searchBox: {
    display: "flex",
    alignItems: "center",
    border: "2px solid #e2e8f0",
    borderRadius: 12,
    background: "#f8fafc",
    padding: "2px 6px",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    padding: "8px 10px",
    outline: "none",
    border: "none",
    fontWeight: 600,
    fontSize: 14,
    color: "#0f172a",
    background: "transparent",
  },
  productCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
    boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
    position: "relative" as const,
  },
  productImageBox: {
    height: 76,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
    transition: "transform 0.2s",
  },
  productLabel: {
    width: "100%",
    background: "#ffffff",
    padding: "6px 8px 8px 8px",
    textAlign: "center" as const,
    borderTop: "1px solid #f1f5f9",
  },
  productName: {
    fontWeight: 800,
    color: "#1e293b",
    fontSize: 12,
    lineHeight: 1.25,
    textTransform: "capitalize" as const,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  productPrice: {
    fontWeight: 900,
    color: "#059669",
    fontSize: 13,
    marginTop: 2,
    fontFamily: "monospace",
  },

  /* ── BOTTOM PRODUCT BUTTONS ── */
  btnAjouterRapide: {
    flex: 1,
    background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 14,
    padding: "10px 0",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "all 0.15s",
    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
  },
  btnBarcode: (active: boolean) => ({
    width: 54,
    background: active
      ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
      : "#f1f5f9",
    color: active ? "#fff" : "#64748b",
    fontWeight: 700,
    padding: "10px 0",
    borderRadius: 12,
    border: active ? "none" : "1px solid #cbd5e1",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    boxShadow: active ? "0 4px 12px rgba(16, 185, 129, 0.25)" : "none",
  }),

  /* ── TICKET TABLE ── */
  ticketTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  },
  ticketTh: {
    padding: "8px 10px",
    textAlign: "left" as const,
    background: "#f8fafc",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid #e2e8f0",
  },
  ticketThLast: {
    padding: "8px 10px",
    textAlign: "right" as const,
    background: "#f8fafc",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid #e2e8f0",
  },
  ticketTd: {
    padding: "8px 10px",
    fontWeight: 700,
    borderBottom: "1px solid #f1f5f9",
    color: "#1e293b",
  },
  ticketTdLast: {
    padding: "8px 10px",
    fontWeight: 800,
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    textAlign: "right" as const,
    fontFamily: "monospace",
  },
  ticketRowSelected: {
    background: "rgba(79, 70, 229, 0.07)",
  },

  /* ── TOTALS ── */
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 14px",
    borderBottom: "1px solid #f1f5f9",
  },
  totalLabel: {
    color: "#64748b",
    fontWeight: 600,
    fontSize: 13,
  },
  totalValue: {
    fontWeight: 800,
    color: "#1e293b",
    fontSize: 14,
    fontFamily: "monospace",
  },
  totalTTCRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
    borderTop: "2px solid #c7d2fe",
  },
  totalTTCLabel: {
    fontWeight: 900,
    color: "#312e81",
    fontSize: 16,
  },
  totalTTCValue: {
    fontWeight: 900,
    color: "#3730a3",
    fontSize: 24,
    letterSpacing: "-0.02em",
    fontFamily: "monospace",
  },

  /* ── TICKET ACTIONS ── */
  btnAjouter: {
    flex: 1,
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    padding: "8px 0",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.1s",
    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)",
  },
  btnReduire: {
    flex: 1,
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    padding: "8px 0",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.1s",
    boxShadow: "0 2px 6px rgba(59, 130, 246, 0.2)",
  },
  btnSupprimer: {
    flex: 1,
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 12,
    padding: "8px 0",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.1s",
    boxShadow: "0 2px 6px rgba(239, 68, 68, 0.2)",
  },

  /* ── PAIEMENT COLUMN ── */
  payTotalBox: {
    background: "linear-gradient(135deg, #090d16 0%, #0f172a 60%, #1e1b4b 100%)",
    padding: "16px 20px",
    borderRadius: 16,
    textAlign: "center" as const,
    boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.35)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    position: "relative" as const,
    overflow: "hidden",
  },
  payTotalLabel: {
    fontWeight: 800,
    fontSize: 12,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.15em",
  },
  payTotalAmount: {
    fontWeight: 900,
    fontSize: 30,
    color: "#10b981",
    display: "block",
    marginTop: 4,
    fontFamily: "monospace",
    letterSpacing: "-0.02em",
  },
  payInputRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "6px 0",
  },
  payInputLabel: {
    fontWeight: 800,
    fontSize: 14,
    color: "#1e293b",
  },
  payInput: {
    width: 150,
    padding: "9px 12px",
    border: "2px solid #cbd5e1",
    borderRadius: 12,
    textAlign: "right" as const,
    fontWeight: 900,
    fontSize: 18,
    color: "#0f172a",
    outline: "none",
    transition: "all 0.2s",
    background: "#fff",
    fontFamily: "monospace",
  },
  payChangeBox: {
    width: 150,
    padding: "9px 12px",
    border: "2px solid #10b981",
    background: "#f0fdf4",
    borderRadius: 12,
    textAlign: "right" as const,
    fontWeight: 900,
    fontSize: 18,
    color: "#10b981",
    fontFamily: "monospace",
  },
  btnPayment: (color: string, borderColor: string, active: boolean) => ({
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: active ? "2px solid transparent" : "1px solid #e2e8f0",
    background: active ? color : "#ffffff",
    color: active ? "#fff" : "#334155",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    transition: "all 0.2s",
    boxShadow: active ? "0 4px 12px rgba(15, 23, 42, 0.15)" : "0 1px 3px rgba(0,0,0,0.02)",
    transform: active ? "scale(1.01)" : "scale(1)",
  }),

  /* ── FOOTER ── */
  footer: {
    height: 72,
    background: "linear-gradient(180deg, #0f172a 0%, #090d16 100%)",
    backdropFilter: "blur(16px)",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    padding: "10px 18px",
    gap: 12,
    flexShrink: 0,
    zIndex: 30,
    boxShadow: "0 -6px 20px rgba(0,0,0,0.25)",
  },
  footerBtn: (bg: string, border: string) => ({
    flex: 1,
    height: 48,
    background: bg,
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "all 0.2s",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  }),
  footerBtnValidate: {
    flex: 2,
    height: 50,
    background: "linear-gradient(135deg, #059669 0%, #10b981 50%, #047857 100%)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 16,
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    transition: "all 0.2s",
    boxShadow: "0 6px 20px rgba(16, 185, 129, 0.4)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },

  /* ── NOTIFICATIONS ── */
  notification: (bg: string) => ({
    position: "fixed" as const,
    top: 30,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 32px",
    background: "rgba(15, 23, 42, 0.95)",
    color: "#fff",
    fontWeight: 800,
    borderRadius: 20,
    backdropFilter: "blur(10px)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
    fontSize: 16,
    border: `1px solid ${bg}`,
  }),
  ticketPriceInput: {
    width: 84,
    padding: "4px 6px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontWeight: 800,
    fontSize: 13,
    color: "#4f46e5",
    textAlign: "right" as const,
    outline: "none",
    background: "#fff",
    fontFamily: "monospace",
    transition: "all 0.2s",
  },
  ticketQtyInput: {
    width: 44,
    padding: "4px 4px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontWeight: 800,
    fontSize: 13,
    color: "#0f172a",
    textAlign: "center" as const,
    outline: "none",
    background: "#fff",
    fontFamily: "monospace",
    transition: "all 0.2s",
  },
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

function PosPage() {
  const router = useRouter();
  /* ── State ── */
  const [articles, setArticles] = useState<Article[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [parkedCarts, setParkedCarts] = useState<ParkedCart[]>([]);
  const [isParkedCartsModalOpen, setIsParkedCartsModalOpen] = useState(false);
  const [parkNotePromptOpen, setParkNotePromptOpen] = useState(false);
  const [parkNoteInput, setParkNoteInput] = useState("");
  const [previewParkedCart, setPreviewParkedCart] = useState<ParkedCart | null>(null);

  // Load parked carts from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pos_parked_carts_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setParkedCarts(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load parked carts from localStorage", e);
    }
  }, []);

  // Save parked carts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pos_parked_carts_v2", JSON.stringify(parkedCarts));
    } catch (e) {
      console.error("Failed to sync parked carts to localStorage", e);
    }
  }, [parkedCarts]);

  const [query, setQuery] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | number>(1);
  const [pricingTier, setPricingTier] = useState<"Détail" | "Gros" | "Revendeur">("Détail");
  const [selectedDepot, setSelectedDepot] = useState<string>("");
  const [cashierName, setCashierName] = useState("Admin");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmplacement, setUserEmplacement] = useState("");

  useEffect(() => {
    const getSessionData = () => {
      const session = readClientSession();
      if (!session) return;

      const admin = isAdminSession(session);
      let scopedDepots = splitDepotList(session.depots, session.emplacement);

      if (session.username) {
        setCashierName(session.username);
        // SPECIFIC RULE: KADER cannot use 'BOUTIQUE' in POS
        if (session.username.toLowerCase() === "kader") {
          scopedDepots = scopedDepots.filter(d => d.toLowerCase() !== "boutique");
        }
      }

      setIsAdmin(admin);
      setUserEmplacement(scopedDepots.join(", "));

      if (scopedDepots.length > 0) {
        setSelectedDepot((current) => current || scopedDepots[0]);
      }
    };
    getSessionData();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pos_price_change_history");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setPriceChangeHistory(parsed);
      }
    } catch (error) {
      console.error("Failed to load POS price change history:", error);
    }
  }, []);

  const [paymentMethod, setPaymentMethod] = useState("Espece");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | number | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [pendingPriceChange, setPendingPriceChange] = useState<PendingPriceChange | null>(null);
  const [currentPriceChanges, setCurrentPriceChanges] = useState<PriceChangeLogEntry[]>([]);
  const [priceChangeHistory, setPriceChangeHistory] = useState<PriceChangeLogEntry[]>([]);
  const [serverPriceChangeHistory, setServerPriceChangeHistory] = useState<PriceChangeLogEntry[]>([]);
  const [priceChangeReason, setPriceChangeReason] = useState("");
  const [barcodeMode, setBarcodeMode] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stockAlerts, setStockAlerts] = useState<{ designation: string, stock_restant: number }[]>([]);
  const [printInvoiceId, setPrintInvoiceId] = useState<string | number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ designation: "", price: "", quantity: "1" });
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [isCashClosureOpen, setIsCashClosureOpen] = useState(false);
  const [cashClosureSummary, setCashClosureSummary] = useState<any>(null);
  const [cashClosureLoading, setCashClosureLoading] = useState(false);
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSaving, setClientSaving] = useState(false);
  const [clientFormData, setClientFormData] = useState({ nom: "", tel: "", ref_client: "" });
  const [clientQuery, setClientQuery] = useState("");

  const [clientAdvances, setClientAdvances] = useState<any[]>([]);
  const [totalAdvanceBalance, setTotalAdvanceBalance] = useState(0);

  const searchParams = useSearchParams();
  const [editInvoiceId, setEditInvoiceId] = useState<string | number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

  const allowedDepotsList = useMemo(() => {
    if (isAdmin) return depots.map(d => d.nom_depot);
    return splitDepotList(userEmplacement);
  }, [isAdmin, depots, userEmplacement]);

  const canChangeDepot = !editInvoiceId && (isAdmin || allowedDepotsList.length > 1);

  const loadPersistedPriceChanges = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("mouvements")
        .select("article_id, nr_doc, date_mouvement, fournisseur_client, pv, prix, utilisateur, type")
        .eq("type", "MODIF_PRIX_POS")
        .order("date_mouvement", { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setServerPriceChangeHistory(
        (data || [])
          .map((row) => parsePersistedPriceChange(row as Row))
          .filter((entry): entry is PriceChangeLogEntry => entry !== null)
      );
    } catch (error) {
      console.error("Failed to load persisted POS price change history:", error);
    }
  }, []);

  useEffect(() => {
    void loadPersistedPriceChanges();
  }, [loadPersistedPriceChanges]);

  // Monitor printInvoiceId changes
  useEffect(() => {
    console.log("📢 printInvoiceId state changed to:", printInvoiceId, "Type:", typeof printInvoiceId);
    if (printInvoiceId) {
      console.log("✅ InvoiceModal SHOULD BE VISIBLE NOW with ID:", printInvoiceId);
    }
  }, [printInvoiceId]);

  // Load Invoice Data if edit mode
  useEffect(() => {
    const invId = searchParams.get("invoiceId");
    if (invId) {
      setEditInvoiceId(invId);
      loadInvoiceForEdit(invId);
    }
  }, [searchParams]);

  const loadInvoiceForEdit = async (id: string | number) => {
    try {
      setIsInitialLoading(true);
      // 1. Fetch Invoice Header
      const { data: inv, error: invErr } = await supabase
        .from("factures")
        .select("*")
        .eq("id", id)
        .single();
      
      if (invErr) throw invErr;
      if (inv) {
        setSelectedClientId(inv.client_id || 1);
        setPaymentMethod(inv.mode_paiement || "Espece");
        // ... any other header fields
      }

      // 2. Fetch Invoice Items
      const { data: its, error: itsErr } = await supabase
        .from("facture_items")
        .select("*")
        .eq("facture_id", id);
      
      if (itsErr) throw itsErr;
      
      if (its) {
        const invoiceDepots = uniqueNames(
          its.map((item) => String(item.depot_origine ?? "").trim())
        );

        if (invoiceDepots.length > 1) {
          throw new Error("Cette facture utilise plusieurs dépôts. La modification POS ne supporte qu'un seul dépôt.");
        }

        if (invoiceDepots.length === 1) {
          setSelectedDepot(invoiceDepots[0]);
        }

        const cartItems: CartItem[] = its.map(it => ({
          id: it.article_id,
          reference: it.code_art || "",
          code_barre: it.code_art || null,
          designation: it.description || "",
          p_vente_ht: toNumber(it.pu_ht),
          p_vente_ttc: toNumber(it.pu_ttc),
          taxe: toNumber(it.taux_tva_item),
          image_path: null,
          stock_total: 9999, // Placeholder since we revert stock on save
          quantite: toNumber(it.qte),
          depot_origine: it.depot_origine || null,
          original_price: toNumber(it.pu_ttc),
          price_modified: false,
        }));
        setCart(cartItems);
        setCurrentPriceChanges([]);
        setPriceDrafts({});
      }
    } catch (err) {
      console.error("Error loading invoice for POS edit:", err);
      setError("Erreur lors du chargement de la facture.");
    } finally {
      setIsInitialLoading(false);
    }
  };

  const loadClientAdvances = useCallback(async (clientId: string | number) => {
    if (!clientId || clientId === 1) { // 1 is usually 'Passant'
      setClientAdvances([]);
      setTotalAdvanceBalance(0);
      return;
    }
    try {
      const res = await fetch(`/api/clients/${clientId}/advances`);
      if (res.ok) {
        const data = await res.json();
        setClientAdvances(data.advances || []);
        setTotalAdvanceBalance(Number(data.totalBalance || 0));
      }
    } catch (err) {
      console.error("Error loading client advances:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      loadClientAdvances(selectedClientId);
    }
  }, [selectedClientId, loadClientAdvances]);

  /* ── Clock ── */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── 4K Parked Carts / Multi-Tab Logic ── */
  const parkCurrentCart = (noteText?: string) => {
    if (cart.length === 0) return;
    const clientObj = clients.find(c => String(c.id) === String(selectedClientId));
    const clientName = clientObj?.nom || (String(selectedClientId) === "1" ? "Client Passant" : `Client #${selectedClientId}`);
    const currentTotal = cart.reduce((sum, it) => sum + (Number(it.p_vente_ttc) || 0) * (Number(it.quantite) || 1), 0);

    const finalNote = (noteText !== undefined ? noteText : parkNoteInput).trim();

    const newTab: ParkedCart = {
      id: "tab_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      timestamp: Date.now(),
      note: finalNote || undefined,
      cart: [...cart],
      clientId: selectedClientId,
      clientNom: clientName,
      totalAmount: currentTotal,
      selectedDepot,
      pricingTier,
      invoiceId: editInvoiceId,
      priceChanges: [...currentPriceChanges],
      priceDrafts: { ...priceDrafts },
    };

    setParkedCarts(prev => [newTab, ...prev]);
    setCart([]);
    setCurrentPriceChanges([]);
    setPriceDrafts({});
    setPendingPriceChange(null);
    setPriceChangeReason("");
    setSelectedClientId(1);
    setPricingTier("Détail");
    setEditInvoiceId(null);
    setParkNoteInput("");
    setParkNotePromptOpen(false);

    setSuccess(`✅ Panier "${clientName}" mis en attente (${newTab.cart.length} art. • ${formatAmount(currentTotal)} F CFA)`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const deleteParkedCart = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Voulez-vous vraiment supprimer ce ticket en attente ?")) return;
    setParkedCarts(prev => prev.filter(t => t.id !== tabId));
    if (previewParkedCart?.id === tabId) setPreviewParkedCart(null);
    setSuccess("Ticket supprimé avec succès.");
    setTimeout(() => setSuccess(null), 2000);
  };

  const restoreParkedCart = (tabId: string) => {
    const tabToRestore = parkedCarts.find(t => t.id === tabId);
    if (!tabToRestore) return;

    let activeCartSnapshot: ParkedCart | null = null;
    if (cart.length > 0) {
      const activeClient = clients.find(c => String(c.id) === String(selectedClientId));
      const activeTotal = cart.reduce((sum, it) => sum + (Number(it.p_vente_ttc) || 0) * (Number(it.quantite) || 1), 0);
      activeCartSnapshot = {
        id: "tab_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        timestamp: Date.now(),
        note: "Panier précédent mis en attente",
        cart: [...cart],
        clientId: selectedClientId,
        clientNom: activeClient?.nom || (String(selectedClientId) === "1" ? "Client Passant" : `Client #${selectedClientId}`),
        totalAmount: activeTotal,
        selectedDepot,
        pricingTier,
        invoiceId: editInvoiceId,
        priceChanges: [...currentPriceChanges],
        priceDrafts: { ...priceDrafts },
      };
    }

    setParkedCarts((prev) => {
      const remaining = prev.filter((tab) => tab.id !== tabId);
      return activeCartSnapshot ? [activeCartSnapshot, ...remaining] : remaining;
    });

    setCart(tabToRestore.cart);
    setSelectedClientId(tabToRestore.clientId);
    if (tabToRestore.pricingTier) setPricingTier(tabToRestore.pricingTier);
    if (tabToRestore.selectedDepot) setSelectedDepot(tabToRestore.selectedDepot);
    setEditInvoiceId(tabToRestore.invoiceId ?? null);
    setCurrentPriceChanges(tabToRestore.priceChanges || []);
    setPriceDrafts(tabToRestore.priceDrafts || {});
    setPendingPriceChange(null);
    setPriceChangeReason("");
    setSelectedItemId(tabToRestore.cart[0]?.id ?? null);
    setIsParkedCartsModalOpen(false);
    setPreviewParkedCart(null);

    setSuccess(`✅ Ticket "${tabToRestore.clientNom || 'En attente'}" rechargé (${formatAmount(tabToRestore.totalAmount || 0)} F CFA).`);
    setTimeout(() => setSuccess(null), 2500);
  };

  const printHoldingSlip = (tab: ParkedCart, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const printWindow = window.open("", "_blank", "width=380,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket d'attente #${tab.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 16px; font-size: 13px; color: #000; line-height: 1.4; }
            .center { text-align: center; }
            .bold { font-weight: 900; }
            .line { border-bottom: 1px dashed #555; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            td, th { padding: 4px 0; }
            .pill { display: inline-block; background: #eee; padding: 2px 8px; border-radius: 6px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px; letter-spacing: 1px;">TICKET EN ATTENTE (HOLD)</div>
          <div class="center" style="font-size: 11px; color: #555; margin-top: 2px;">Date: ${new Date(tab.timestamp || Date.now()).toLocaleString("fr-FR")}</div>
          <div class="line"></div>
          <div><strong>Client:</strong> ${tab.clientNom || "Client Passant"}</div>
          ${tab.note ? `<div style="margin-top: 3px;"><strong>Note / Repère:</strong> <span class="pill">${tab.note}</span></div>` : ""}
          <div style="margin-top: 3px;"><strong>Dépôt:</strong> ${tab.selectedDepot || "Principal"}</div>
          <div style="margin-top: 3px;"><strong>Articles:</strong> ${tab.cart.length} référence(s)</div>
          <div class="line"></div>
          <table>
            <thead>
              <tr style="border-bottom: 1px solid #ddd;">
                <th align="left">Article</th>
                <th align="center">Qté</th>
                <th align="right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${tab.cart.map(it => `
                <tr>
                  <td>${it.designation}</td>
                  <td align="center">${it.quantite}</td>
                  <td align="right">${(Number(it.p_vente_ttc) * Number(it.quantite)).toLocaleString("fr-FR")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div class="line"></div>
          <div style="font-size: 16px; display: flex; justify-content: space-between; margin: 8px 0;">
            <span class="bold">TOTAL TTC:</span>
            <span class="bold">${(Number(tab.totalAmount) || 0).toLocaleString("fr-FR")} F CFA</span>
          </div>
          <div class="line"></div>
          <div class="center" style="font-size: 10px; color: #666;">
            Conservez ce ticket pour reprendre votre commande à la caisse.<br/>
            <strong>Gestion Pro Global 4K POS</strong>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  /* ═══════════════════════════════════════════════════════════════════
     DATA LOADING FROM SUPABASE
     ═══════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    let alive = true;

    async function loadAll() {
      setLoading(true);
      setError(null);

      try {
        const posSession = getClientSessionFromCookie();
        const posOrgId = posSession?.organization_id;
        const posIsAdmin = isAdminOrManagerSession(posSession);

        /* ── 1. Articles with aggregated stock ── */
        let articlesQuery = supabase
          .from("articles")
          .select(`
            id, reference, code_barre, designation, nom,
            p_vente_ht, p_vente_ttc, taxe, image_path,
            is_deleted,
            stocks ( quantite, depot_nom )
          `)
          .eq("is_deleted", false);

        if (posOrgId) {
          articlesQuery = articlesQuery.eq("organization_id", posOrgId);
        }

        const { data: articlesRaw, error: artErr } = await articlesQuery
          .order("designation", { ascending: true })
          .limit(500);

        if (artErr) {
          console.error("❌ Articles fetch error:", artErr.message, artErr.details);
        } else {
          console.log("✅ Articles fetched:", articlesRaw?.length || 0);
        }

        /* ── 2. Clients ── */
        let clientQueryBuilder = supabase
          .from("clients")
          .select("id, ref_client, nom, tel, credit_facture, is_deleted, type_client, prix_client")
          .eq("is_deleted", false);

        if (posOrgId) {
          clientQueryBuilder = clientQueryBuilder.eq("organization_id", posOrgId);
        }

        clientQueryBuilder = clientQueryBuilder.order("nom", { ascending: true });
        
        let clientsRaw: any[] | null = null;
        let cliErr: any = null;

        if (!posIsAdmin && posSession?.id) {
          try {
            let isolatedQuery = supabase
              .from("clients")
              .select("id, ref_client, nom, tel, credit_facture, is_deleted, type_client, prix_client")
              .eq("is_deleted", false);
            if (posOrgId) isolatedQuery = isolatedQuery.eq("organization_id", posOrgId);
            const isolatedRes = await isolatedQuery
              .or(`created_by.eq.${posSession.id},id.eq.${DEFAULT_CLIENT_ID}`)
              .order("nom", { ascending: true })
              .limit(500);
            if (!isolatedRes.error && isolatedRes.data) {
              clientsRaw = isolatedRes.data;
            } else {
              // created_by column does not exist in clients table, fallback to standard query
              const fallbackRes = await clientQueryBuilder.limit(500);
              clientsRaw = fallbackRes.data;
              cliErr = fallbackRes.error;
            }
          } catch {
            const fallbackRes = await clientQueryBuilder.limit(500);
            clientsRaw = fallbackRes.data;
            cliErr = fallbackRes.error;
          }
        } else {
          const res = await clientQueryBuilder.limit(500);
          clientsRaw = res.data;
          cliErr = res.error;
        }

        if (cliErr) {
          console.error("❌ Clients fetch error:", cliErr.message, cliErr.details);
        } else {
          console.log("✅ Clients fetched:", clientsRaw?.length || 0);
        }

        /* ── 3. Depots ── */
        let depotsQuery = supabase
          .from("depots")
          .select("id, nom, emplacement")
          .eq("is_deleted", false)
          .eq("is_active", true);

        if (posOrgId) {
          depotsQuery = depotsQuery.eq("organization_id", posOrgId);
        }

        const { data: depotsRaw, error: depErr } = await depotsQuery;

        /* ── 4. Company Info ── */
        let companyQuery = supabase
          .from("informations_entreprise")
          .select("nom_entreprise, telephone");

        if (posOrgId) {
          companyQuery = companyQuery.eq("organization_id", posOrgId);
        }

        const { data: companyRaw } = await companyQuery
          .limit(1)
          .maybeSingle();

        if (!alive) return;

        const allStockDepotNames = uniqueNames(
          (articlesRaw || []).flatMap((row) => {
            const stocksArr = Array.isArray((row as Row).stocks) ? ((row as Row).stocks as Row[]) : [];
            return stocksArr.map((stock) => String(stock.depot_nom ?? "").trim());
          })
        );

        const depotNames = uniqueNames([
          ...(Array.isArray(depotsRaw)
            ? depotsRaw.flatMap((depot) => [
                String((depot as Row).nom ?? ""),
                String((depot as Row).emplacement ?? ""),
              ])
            : []),
          ...allStockDepotNames,
          ...splitDepotList(userEmplacement),
        ]);

        const resolvedSelectedDepot = findBestDepotMatch(selectedDepot, depotNames) || selectedDepot;
        const selectedDepotKey = normalizeDepotName(resolvedSelectedDepot);
        const scopedDepotKeys = uniqueNames(
          splitDepotList(userEmplacement).map((depot) => findBestDepotMatch(depot, depotNames) || depot)
        ).map(normalizeDepotName);

        // Process articles with the current depot scope.
        if (!artErr && articlesRaw && articlesRaw.length > 0) {
          const mapped = articlesRaw.map((row) => {
            const r = row as Row;
            const stocksArr = Array.isArray(r.stocks) ? r.stocks : [];
            
            const visibleStocks = stocksArr.filter((stock) => {
              const depotKey = normalizeDepotName(String(stock?.depot_nom || ""));

              if (!isAdmin && !scopedDepotKeys.includes(depotKey)) {
                return false;
              }

              return !selectedDepotKey || depotKey === selectedDepotKey;
            });

            const stockTotal = visibleStocks.reduce(
              (sum: number, s: Record<string, unknown>) => sum + toNumber(s.quantite),
              0
            );
            return buildArticle({ ...r, stocks: visibleStocks, stock_total: stockTotal });
          }).filter((a) => !!a.id && a.id !== 0 && a.stock_total > 0); // Only show articles with stock in vendor's depot
          
          // Check if non-admin vendor has selected BOUTIQUE
          const normalizedSelected = normalizeDepotName(selectedDepot);
          if (!isAdmin && normalizedSelected === "boutique") {
            const hasSonef = scopedDepotKeys.includes("boutique sonef");
            if (hasSonef) {
              const sonefRaw = uniqueNames(splitDepotList(userEmplacement)).find(
                (dep) => normalizeDepotName(dep) === "boutique sonef"
              ) || "BOUTIQUE SONEF";
              setArticles([]);
              setTimeout(() => {
                setSelectedDepot(sonefRaw);
                setError("Le dépôt BOUTIQUE ne contient aucun produit. Retour automatique à BOUTIQUE SONEF.");
                setTimeout(() => setError(null), 3000);
              }, 1500);
              return;
            }
          }

          console.log(`✅ Articles fetched: ${mapped.length} (filtered for depot: ${userEmplacement})`);
          setArticles(mapped);
          cacheArticlesOffline(mapped);

          const fallbackDepot = findBestDepotMatch(resolvedSelectedDepot, allStockDepotNames) || allStockDepotNames[0] || "";

          console.log(`POS visible articles: ${mapped.length} for depot ${resolvedSelectedDepot || userEmplacement || "all"}`);

          if (mapped.length === 0 && isAdmin && !editInvoiceId && fallbackDepot && fallbackDepot !== selectedDepot) {
            setSelectedDepot(fallbackDepot);
          }
        } else {
          setArticles([]);
          if (artErr) console.warn("Articles load error:", artErr.message);
        }

        // Process clients
        if (!cliErr && clientsRaw && clientsRaw.length > 0) {
          const mappedClients = clientsRaw.map((r) => buildClient(r as Row));
          setClients(mappedClients);
          if (!selectedClientId && mappedClients.length > 0) {
            const defaultCli = mappedClients.find(c => c.id === DEFAULT_CLIENT_ID || c.id === 1 || (c.ref_client && c.ref_client.toUpperCase().includes("COMPTOIR"))) || mappedClients[0];
            setSelectedClientId(defaultCli.id);
          }
        }

        // Process depots
        if (!depErr && depotNames.length > 0) {
          setDepots(depotNames.map((name, i) => ({ id: i + 1, nom_depot: name })));
          
          if (!selectedDepot && depotNames.length > 0) {
             const allowed = splitDepotList(userEmplacement);
             setSelectedDepot(isAdmin ? depotNames[0] : (allowed[0] || ""));
          } else if (resolvedSelectedDepot && resolvedSelectedDepot !== selectedDepot) {
             setSelectedDepot(resolvedSelectedDepot);
          }
        }

        // Company info
        if (companyRaw) {
          setCompanyInfo({
            nom_entreprise: (companyRaw as Row).nom_entreprise as string | null,
            telephone: (companyRaw as Row).telephone as string | null,
          });
        }
      } catch (err) {
        if (alive) {
          console.error("POS data load error:", err);
          setError("Erreur de chargement des données. Vérifiez la connexion.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadAll();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, selectedDepot, userEmplacement]);

  /* ═══════════════════════════════════════════════════════════════════
     CART LOGIC (MULTI-TIER PRICING AWARE)
     ═══════════════════════════════════════════════════════════════════ */

  const getEffectiveItemPrice = useCallback((article: Article, tier: "Détail" | "Gros" | "Revendeur") => {
    if (tier === "Gros" && article.prix_gros && article.prix_gros > 0) {
      return article.prix_gros;
    }
    if (tier === "Revendeur") {
      if (article.prix_special && article.prix_special > 0) return article.prix_special;
      if (article.prix_gros && article.prix_gros > 0) return article.prix_gros;
    }
    return article.p_vente_ttc;
  }, []);

  const handlePricingTierChange = useCallback((newTier: "Détail" | "Gros" | "Revendeur") => {
    setPricingTier(newTier);
    setCart((prev) =>
      prev.map((item) => {
        if (item.price_modified) return item;
        const newPrice = getEffectiveItemPrice(item, newTier);
        return {
          ...item,
          p_vente_ttc: newPrice,
          p_vente_ht: newPrice,
          original_price: newPrice,
        };
      })
    );
  }, [getEffectiveItemPrice]);

  const addItem = useCallback((article: Article) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === article.id);
      const baseAvailable = getAvailableArticleStock(article, selectedDepot);
      const available = baseAvailable + (editInvoiceId ? existing?.quantite || 0 : 0);
      const newQty = existing ? existing.quantite + 1 : 1;
      
      if (newQty > available) {
        setError(`⚠️ Stock insuffisant pour "${article.designation}" (Disponible: ${available})`);
        setTimeout(() => setError(null), 3000);
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item.id === article.id
            ? { ...item, quantite: newQty }
            : item
        );
      }
      const unitPrice = getEffectiveItemPrice(article, pricingTier);
      return [
        ...prev,
        {
          ...article,
          p_vente_ttc: unitPrice,
          p_vente_ht: unitPrice,
          quantite: 1,
          original_price: unitPrice,
          price_modified: false,
          depot_origine: selectedDepot || null,
        },
      ];
    });
  }, [editInvoiceId, selectedDepot, pricingTier, getEffectiveItemPrice]);

  const handleCameraBarcodeScanned = useCallback((scannedCode: string) => {
    const clean = scannedCode.trim().toLowerCase();
    const matched = articles.find(
      (a) =>
        a.code_barre?.toLowerCase() === clean ||
        a.reference?.toLowerCase() === clean ||
        String(a.id) === clean
    );

    if (matched) {
      addItem(matched);
      setSuccess(`✅ Article scanné: ${matched.designation}`);
      setTimeout(() => setSuccess(null), 3500);
    } else {
      setError(`⚠️ Aucun article trouvé pour le code scanné: ${scannedCode}`);
      setTimeout(() => setError(null), 4000);
    }
  }, [articles, addItem]);

  const removeItem = useCallback((id: string | number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
    setCurrentPriceChanges((prev) => prev.filter((entry) => entry.articleId !== id));
    setPriceDrafts((prev) => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
  }, []);

  const updateQuantity = useCallback((id: string | number, qty: number) => {
    const art = articles.find(a => a.id === id);
    const existingItem = cart.find((item) => item.id === id);
    if (art) {
        const itemDepot = existingItem?.depot_origine || selectedDepot;
        const available = getAvailableArticleStock(art, itemDepot) + (editInvoiceId ? existingItem?.quantite || 0 : 0);
        if (qty > available) {
          setError(`⚠️ Limite de stock atteinte (${available} disponibles dans ${itemDepot})`);
          setTimeout(() => setError(null), 3000);
          qty = available;
        }
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantite: Math.max(1, qty) } : item
      )
    );
    setCurrentPriceChanges((prev) =>
      prev.map((entry) =>
        entry.articleId === id ? { ...entry, quantity: Math.max(1, qty) } : entry
      )
    );
  }, [articles, cart, editInvoiceId, selectedDepot]);

  const persistPriceHistory = useCallback((entry: PriceChangeLogEntry) => {
    setPriceChangeHistory((prev) => {
      const next = [entry, ...prev].slice(0, 100);
      try {
        localStorage.setItem("pos_price_change_history", JSON.stringify(next));
      } catch (error) {
        console.error("Failed to persist POS price history:", error);
      }
      return next;
    });
  }, []);

  const updatePrice = useCallback((id: string | number, price: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const normalizedPrice = Math.max(0, price);
        const originalPrice = typeof item.original_price === "number" ? item.original_price : item.p_vente_ttc;
        return {
          ...item,
          p_vente_ttc: normalizedPrice,
          original_price: originalPrice,
          price_modified: Math.abs(normalizedPrice - originalPrice) > 0.0001,
        };
      })
    );
  }, []);

  const handlePriceDraftChange = useCallback((id: string | number, value: string) => {
    setPriceDrafts((prev) => ({ ...prev, [String(id)]: value }));
  }, []);

  const requestPriceChangeConfirmation = useCallback((item: CartItem) => {
    const draftValue = priceDrafts[String(item.id)];
    const parsedPrice = Number(draftValue);

    if (draftValue == null || draftValue === "") {
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[String(item.id)];
        return next;
      });
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError("Le nouveau prix doit être un nombre valide.");
      setTimeout(() => setError(null), 2500);
      return;
    }

    if (Math.abs(parsedPrice - item.p_vente_ttc) < 0.0001) {
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[String(item.id)];
        return next;
      });
      return;
    }

    setPendingPriceChange({
      itemId: item.id,
      designation: item.designation,
      oldPrice: item.p_vente_ttc,
      newPrice: parsedPrice,
      quantity: item.quantite,
    });
    setPriceChangeReason("");
  }, [priceDrafts]);

  const cancelPendingPriceChange = useCallback(() => {
    if (pendingPriceChange) {
      setPriceDrafts((prev) => ({
        ...prev,
        [String(pendingPriceChange.itemId)]: pendingPriceChange.oldPrice.toString(),
      }));
    }
    setPendingPriceChange(null);
    setPriceChangeReason("");
  }, [pendingPriceChange]);

  const confirmPendingPriceChange = useCallback(() => {
    if (!pendingPriceChange) return;

    updatePrice(pendingPriceChange.itemId, pendingPriceChange.newPrice);

    const entry: PriceChangeLogEntry = {
      id: `${pendingPriceChange.itemId}-${Date.now()}`,
      articleId: pendingPriceChange.itemId,
      designation: pendingPriceChange.designation,
      oldPrice: pendingPriceChange.oldPrice,
      newPrice: pendingPriceChange.newPrice,
      quantity: pendingPriceChange.quantity,
      changedAt: new Date().toISOString(),
      changedBy: cashierName,
      invoiceId: editInvoiceId,
      reason: priceChangeReason.trim() || undefined,
    };

    setCurrentPriceChanges((prev) => [entry, ...prev]);
    persistPriceHistory(entry);
    setPriceDrafts((prev) => ({
      ...prev,
      [String(pendingPriceChange.itemId)]: pendingPriceChange.newPrice.toString(),
    }));
    setPendingPriceChange(null);
    setPriceChangeReason("");
    setSuccess(`Prix mis à jour pour "${entry.designation}".`);
    setTimeout(() => setSuccess(null), 2500);
  }, [cashierName, editInvoiceId, pendingPriceChange, persistPriceHistory, priceChangeReason, updatePrice]);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedItemId(null);
    setReceivedAmount("");
    setPriceDrafts({});
    setCurrentPriceChanges([]);
    setPendingPriceChange(null);
    setPriceChangeReason("");
    setEditInvoiceId(null);
  }, []);

  const handleDepotChange = useCallback((newDepot: string) => {
    setSelectedDepot(newDepot);
    // Keep ticket items intact and preserve individual item depot selections
    setCart((prev) =>
      prev.map((it) => ({
        ...it,
        depot_origine: it.depot_origine || newDepot,
      }))
    );
    setSuccess(`📍 Dépôt actif : ${newDepot} (Ticket de caisse conservé)`);
    setTimeout(() => setSuccess(null), 3000);
  }, []);

  /* ── Computed ── */
  const filteredArticles = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return articles;
    return articles.filter((a) => {
      const haystack = normalizeText(`${a.designation} ${a.reference} ${a.code_barre ?? ""} ${a.id}`);
      return haystack.includes(q);
    });
  }, [articles, query]);

  const ticketTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.p_vente_ttc * item.quantite, 0),
    [cart]
  );

  // Calculate HT/TVA per item using actual taxe field
  const { totalHT, totalTVA } = useMemo(() => {
    let ht = 0;
    let tva = 0;
    for (const item of cart) {
      const lineTotal = item.p_vente_ttc * item.quantite;
      const rate = item.taxe > 0 ? item.taxe / 100 : 0;
      const lineHT = rate > 0 ? lineTotal / (1 + rate) : lineTotal;
      const lineTVA = lineTotal - lineHT;
      ht += lineHT;
      tva += lineTVA;
    }
    return { totalHT: ht, totalTVA: tva };
  }, [cart]);

  const changeAmount = Math.max(0, toNumber(receivedAmount) - ticketTotal);

  const storeName = companyInfo?.nom_entreprise || "My Store";

  /* ═══════════════════════════════════════════════════════════════════
     BARCODE SCAN HANDLER
     ═══════════════════════════════════════════════════════════════════ */

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && barcodeMode && query.trim()) {
        const found = articles.find(
          (a) =>
            a.code_barre === query.trim() ||
            a.reference.toLowerCase() === query.trim().toLowerCase()
        );
        if (found) {
          addItem(found);
          setQuery("");
        } else {
          setError(`Article non trouvé: ${query}`);
          setTimeout(() => setError(null), 3000);
        }
      }
    },
    [barcodeMode, query, articles, addItem]
  );

  /* ═══════════════════════════════════════════════════════════════════
     CHECKOUT → Supabase via API
     ═══════════════════════════════════════════════════════════════════ */

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("Le ticket est vide.");
      return;
    }

    if (pendingPriceChange) {
      setError("Validez ou annulez d'abord la modification de prix en cours.");
      return;
    }

    const unconfirmedPriceDraft = cart.find((item) => {
      const draftValue = priceDrafts[String(item.id)];
      if (draftValue == null || draftValue === "") return false;
      const parsedPrice = Number(draftValue);
      return Number.isFinite(parsedPrice) && Math.abs(parsedPrice - item.p_vente_ttc) > 0.0001;
    });

    if (unconfirmedPriceDraft) {
      setSelectedItemId(unconfirmedPriceDraft.id);
      setError(`Confirmez d'abord le nouveau prix pour "${unconfirmedPriceDraft.designation}".`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    // ── OFFLINE MODE INTERCEPTION ──
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      try {
        const offlineSale = recordOfflineInvoice({
          clientId: selectedClientId || 1,
          clientName: clients.find((c) => String(c.id) === String(selectedClientId))?.nom || "Client Passant",
          items: cart.map((it) => ({
            articleId: it.id,
            reference: it.reference,
            designation: it.designation,
            quantite: it.quantite,
            p_vente_ttc: it.p_vente_ttc,
            total: it.p_vente_ttc * it.quantite,
            depot_origine: selectedDepot || it.depot_origine,
          })),
          totalTTC: cart.reduce((acc, it) => acc + it.p_vente_ttc * it.quantite, 0),
          remise: 0,
          modePaiement: paymentMethod,
          montantRecu: Number(receivedAmount) || 0,
          monnaieRendue: Math.max(
            0,
            (Number(receivedAmount) || 0) - cart.reduce((acc, it) => acc + it.p_vente_ttc * it.quantite, 0)
          ),
        });

        // Update local stock immediately
        setArticles((prev) =>
          prev.map((article) => {
            const cartItem = cart.find((ci) => ci.id === article.id);
            if (cartItem) {
              return { ...article, stock_total: Math.max(0, article.stock_total - cartItem.quantite) };
            }
            return article;
          })
        );

        setSuccess(`⚡ Vente hors-ligne enregistrée #${offlineSale.offlineId} (Stock local mis à jour). Elle sera synchronisée dès le retour du réseau.`);
        clearCart();
        setTimeout(() => setSuccess(null), 8000);
      } catch (e: any) {
        setError("Erreur d'enregistrement hors-ligne.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      const response = await fetch("/api/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: editInvoiceId,
          clientId: selectedClientId || 1,
          depotName: selectedDepot || "",
          moyenReglement: paymentMethod,
          versement: Number(receivedAmount), // Added versement
          emplacement: selectedDepot || "Point de vente",
          items: cart.map((item) => ({
            id: item.id,
            quantite: item.quantite,
            prix: item.p_vente_ttc,
            depot_origine: item.depot_origine || selectedDepot || "",
          })),
          priceChanges: currentPriceChanges.map((entry) => ({
            articleId: entry.articleId,
            designation: entry.designation,
            oldPrice: entry.oldPrice,
            newPrice: entry.newPrice,
            quantity:
              cart.find((item) => item.id === entry.articleId)?.quantite ??
              entry.quantity,
            changedAt: entry.changedAt,
            changedBy: entry.changedBy,
            reason: entry.reason,
          })),
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        sale?: { 
          id?: string | number,
          invoice_id?: string | number,
          numero?: string, 
          alerts?: { designation: string, stock_restant: number }[] 
        };
        invoice_id?: string | number;
        debug?: any;
      };

      console.log("📊 API Response:", payload);
      console.log("📋 Response Status:", response.status, response.ok);
      console.log("🔍 invoice_id in payload:", payload.invoice_id, "Type:", typeof payload.invoice_id);
      console.log("🔍 sale object:", payload.sale);

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "L'encaissement a échoué.");
      }

      // Detailed debugging
      if (payload.debug) {
        console.table({
          "extractedId": payload.debug.extractedId,
          "result": JSON.stringify(payload.debug.result),
          "invoiceId": payload.debug.invoiceId,
          "final invoice_id": payload.invoice_id
        });
      }

      await loadPersistedPriceChanges();

      // Update local stock after successful sale
      setArticles((prev) =>
        prev.map((article) => {
          const cartItem = cart.find((ci) => ci.id === article.id);
          if (cartItem) {
            return { ...article, stock_total: Math.max(0, article.stock_total - cartItem.quantite) };
          }
          return article;
        })
      );

      // TRIGGER PAYMENT MODAL
      let printId: string | number | null = null;
      
      if (payload.invoice_id) {
        printId = payload.invoice_id;
      } else if (payload.sale?.invoice_id) {
        printId = payload.sale.invoice_id;
      } else if (payload.sale?.id) {
        printId = payload.sale.id;
      } else if (editInvoiceId) {
        printId = editInvoiceId;
      }

      if (printId) {
        const numPrintId = typeof printId === 'string' ? Number(printId) : printId;
        console.log("💳 Attempting to open Payment Modal for Invoice ID:", numPrintId);
        
        try {
          // Fetch fresh invoice data for the payment modal
          const { data: fullInvoice, error: fetchErr } = await supabase
            .from("factures")
            .select("*, clients(nom, adresse, tel, gsm, email)")
            .eq("id", numPrintId)
            .maybeSingle(); // Use maybeSingle to avoid errors if not found

          if (fetchErr) console.error("❌ Fetch error:", fetchErr);

          const clientRow = fullInvoice?.clients ? (Array.isArray(fullInvoice.clients) ? fullInvoice.clients[0] : fullInvoice.clients) : null;
          
          // Construct the invoice object with a robust fallback
          const invoiceForModal = {
            id: numPrintId,
            client_id: fullInvoice?.client_id || selectedClientId || 1,
            bl_number: fullInvoice?.bl_number || payload.sale?.numero || `FACT-${numPrintId}`,
            total_ttc: fullInvoice?.total_ttc || cart.reduce((acc, it) => acc + (it.p_vente_ttc * it.quantite), 0),
            montant_restant: fullInvoice?.montant_restant !== undefined 
              ? fullInvoice.montant_restant 
              : (cart.reduce((acc, it) => acc + (it.p_vente_ttc * it.quantite), 0) - Number(receivedAmount)),
            client_nom: clientRow?.nom || fullInvoice?.client_nom || clients.find(c => String(c.id) === String(fullInvoice?.client_id || selectedClientId))?.nom || "Client Divers",
            ...fullInvoice // Spread original fields if any
          };
          
          console.log("📦 Invoice object for modal:", invoiceForModal);
          setPaymentInvoice(invoiceForModal);
          setShowPaymentModal(true);
          localStorage.setItem("last_invoice_id", String(numPrintId));
        } catch (err) {
          console.error("❌ Error preparing payment modal:", err);
          // Last resort fallback
          setPrintInvoiceId(numPrintId);
        }
      }
      
      setSuccess(
        `✅ Vente enregistrée${payload.sale?.numero ? ` — N° ${payload.sale.numero}` : ""}`
      );
      if (payload.sale?.alerts && payload.sale.alerts.length > 0) {
        setStockAlerts(payload.sale.alerts);
      }

      clearCart();

      // If no printId was found, show a warning alert
      if (!printId) {
        console.error("❌ CRITICAL: No printId extracted. Full API response:", JSON.stringify(payload, null, 2));
        setTimeout(() => {
          setError("❌ ERREUR: Aucun ID de facture détecté. Vérifiez la console pour les détails.");
        }, 500);
      }

      setTimeout(() => setSuccess(null), 7000);
    } catch (err) {
      console.error("❌ Checkout exception:", err);
      setError(
        err instanceof Error ? err.message : "Erreur pendant l'encaissement."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaymentModalClose = () => {
    if (paymentInvoice?.id) {
      setPrintInvoiceId(paymentInvoice.id);
    }
    setShowPaymentModal(false);
    setPaymentInvoice(null);
  };

  const handleConfirmQuickAdd = () => {
    const { designation, price, quantity } = quickAddForm;
    if (!designation.trim() || !price) {
      setError("Désignation et prix requis pour l'ajout rapide.");
      return;
    }
    const tempArticle: Article = {
      id: `QA-${Date.now()}`,
      reference: "QUICK-ADD",
      code_barre: null,
      designation: designation.trim(),
      p_vente_ht: parseFloat(price) || 0,
      p_vente_ttc: parseFloat(price) || 0,
      taxe: 0,
      image_path: null,
      stock_total: 999,
      depot_stocks: { [normalizeDepotName(selectedDepot)]: 999 }
    };
    const qty = parseInt(quantity) || 1;
    for (let i = 0; i < qty; i++) {
        addItem(tempArticle);
    }
    setIsQuickAddOpen(false);
    setQuickAddForm({ designation: "", price: "", quantity: "1" });
    setSuccess("Article ajouté avec succès.");
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFormData.nom) return;
    setClientSaving(true);
    try {
      let finalRef = clientFormData.ref_client;
      if (!finalRef) {
        const year = new Date().getFullYear();
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        finalRef = `CL-${year}-${randomPart}`;
      }

      const { data, error } = await supabase
        .from("clients")
        .insert({
          nom: clientFormData.nom,
          tel: clientFormData.tel || null,
          ref_client: finalRef,
          credit_facture: 0,
          is_deleted: false,
        })
        .select()
        .single();
        
      if (error) throw error;
      
      if (data) {
        const newClient = buildClient(data);
        setClients(prev => [newClient, ...prev]);
        setSelectedClientId(newClient.id);
      }
      
      setSuccess("✅ Client ajouté avec succès !");
      setIsClientModalOpen(false);
      setClientFormData({ nom: "", tel: "", ref_client: "" });
    } catch (err) {
      console.error(err);
      setError("❌ Erreur lors de l'ajout du client.");
    } finally {
      setClientSaving(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
    }
  };

  const handleFermerCaisse = async () => {
    if (cart.length > 0) {
      if (!confirm("Il y a des articles dans le panier en cours. Voulez-vous vraiment fermer la caisse ?")) {
        return;
      }
    }
    setCashClosureLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const session = getClientSessionFromCookie();
      const cashierName = session?.username || "Tous";
      const q = new URLSearchParams({
        start: today,
        end: today,
        cashier: cashierName,
        type: "Tous",
      }).toString();

      const res = await fetch(`/api/reports/cash-balance?${q}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.summary) {
        setCashClosureSummary(json.summary);
      } else {
        setCashClosureSummary({
          totalIncome: 0,
          totalExpenses: 0,
          netBalance: 0,
        });
      }
      setIsCashClosureOpen(true);
    } catch (err) {
      console.error("Failed to load cash closure summary:", err);
      setCashClosureSummary({
        totalIncome: 0,
        totalExpenses: 0,
        netBalance: 0,
      });
      setIsCashClosureOpen(true);
    } finally {
      setCashClosureLoading(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */

  return (
    <>
      {/* Keyframe animation for notifications */}
      <style>{`
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
        }
        .pos-product-card:hover { border-color: #2c4a7c !important; box-shadow: 0 2px 8px rgba(44,74,124,0.18) !important; }
        .pos-product-card:active { transform: scale(0.97); }
        .pos-footer-btn:hover { filter: brightness(1.08); }
        .pos-footer-btn:active { border-bottom-width: 0px !important; margin-top: 4px; }
        .pos-action-btn:hover { filter: brightness(1.08); }
        .pos-action-btn:active { border-bottom-width: 0px !important; margin-top: 4px; }
        .pos-pay-input:focus { border-color: #2c4a7c !important; }
        .pos-ticket-row:hover { background: #f0f4f8; }
        .pos-scrollbar::-webkit-scrollbar { width: 6px; }
        .pos-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        .pos-scrollbar::-webkit-scrollbar-thumb { background: #b2bec3; border-radius: 3px; }
        .pos-scrollbar::-webkit-scrollbar-thumb:hover { background: #95a5a6; }
        .pos-price-input:focus { border-color: #4f46e5 !important; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1); }
        .pos-price-input::-webkit-inner-spin-button, .pos-price-input::-webkit-outer-spin-button { opacity: 1; }
      `}</style>

      <div style={S.root}>
        {/* ─── Notifications ─── */}
        {error && (
          <div style={S.notification("#c0392b")}>
            <AlertCircle size={18} />
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 6 }}>
              <X size={16} />
            </button>
          </div>
        )}
        {success && (
          <div style={S.notification("#27ae60")}>
            <CheckCircle2 size={18} />
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 6 }}>
              <X size={16} />
            </button>
          </div>
        )}

        {stockAlerts.length > 0 && (
          <div style={S.notification("#f39c12")}>
            <AlertCircle size={18} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontWeight: 800 }}>⚠️ Alerte Stock Faible:</span>
              {stockAlerts.map((alert, idx) => (
                <span key={idx} style={{ fontSize: 12 }}>
                  • {alert.designation}: {alert.stock_restant} restant(s)
                </span>
              ))}
            </div>
            <button onClick={() => setStockAlerts([])} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", marginLeft: 10 }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* ════════════════════ TOP HEADER ════════════════════ */}
        <header style={S.header}>
          <div style={S.headerLeft}>
            <button 
              onClick={() => router.push("/dashboard")}
              style={S.btnBack}
              className="hover:bg-white/20 transition-all active:scale-95"
              title="Retour au tableau de bord"
            >
              <ArrowLeft size={16} />
              <span>Tableau de bord</span>
            </button>
            
            {/* Store Brand Chip */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
                color: "#fff",
              }}>
                <ShoppingCart size={20} />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={S.headerStoreName}>{storeName || "GESTION PRO GLOBAL"}</span>
                  <span style={{
                    background: "rgba(99, 102, 241, 0.2)",
                    color: "#a5b4fc",
                    border: "1px solid rgba(99, 102, 241, 0.4)",
                    fontSize: 10,
                    fontWeight: 900,
                    padding: "2px 7px",
                    borderRadius: 6,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}>
                    POS Enterprise
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={S.headerRight}>
            {/* Live Cloud Sync Dot */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              padding: "4px 10px",
              borderRadius: "8px",
              fontSize: 12,
              fontWeight: 800,
              color: "#34d399",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} className="animate-pulse" />
              <span>En Ligne</span>
            </div>

            {/* Date & Time */}
            <div style={S.headerInfoItem}>
              <Calendar size={15} className="text-indigo-400" />
              <span>{currentTime.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
            </div>
            <div style={S.headerInfoItem}>
              <Clock size={15} className="text-indigo-400" />
              <span style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>
                {currentTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            
            {/* Depot Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", padding: "4px 10px", borderRadius: "10px" }}>
              <PackageSearch size={15} color="#cbd5e1" />
              <select
                value={selectedDepot}
                onChange={(e) => canChangeDepot && handleDepotChange(e.target.value)}
                disabled={!canChangeDepot}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontWeight: 700,
                  outline: "none",
                  cursor: canChangeDepot ? "pointer" : "not-allowed",
                  fontSize: 13,
                  opacity: !canChangeDepot ? 0.7 : 1,
                }}
                title={
                  editInvoiceId
                    ? `Dépôt verrouillé pour la facture #${editInvoiceId}`
                    : !canChangeDepot
                      ? `Dépôt unique ou verrouillé`
                      : "Sélectionner le dépôt"
                }
              >
                {!isAdmin ? (
                  allowedDepotsList.map(dep => (
                    <option key={dep} value={dep} style={{ color: "#000" }}>{dep}</option>
                  ))
                ) : (
                  depots.map(d => (
                    <option key={d.id} value={d.nom_depot} style={{ color: "#000" }}>{d.nom_depot}</option>
                  ))
                )}
              </select>
            </div>

            {/* Parked Carts Counter / Manager Button */}
            <button
              onClick={() => setIsParkedCartsModalOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: parkedCarts.length > 0 ? "rgba(245, 158, 11, 0.25)" : "rgba(255,255,255,0.06)",
                border: parkedCarts.length > 0 ? "1px solid rgba(245, 158, 11, 0.6)" : "1px solid rgba(255,255,255,0.12)",
                padding: "6px 12px",
                borderRadius: "10px",
                color: parkedCarts.length > 0 ? "#fef3c7" : "#cbd5e1",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 12,
                transition: "all 0.2s",
              }}
              className="hover:brightness-125"
              title="Voir et gérer tous les tickets en attente"
            >
              <PauseCircle size={16} className={parkedCarts.length > 0 ? "text-amber-400 animate-pulse" : "text-slate-400"} />
              <span>En attente</span>
              {parkedCarts.length > 0 && (
                <span style={{
                  background: "#f59e0b",
                  color: "#78350f",
                  fontWeight: 900,
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 8,
                }}>
                  {parkedCarts.length}
                </span>
              )}
            </button>

            {/* Cashier Chip */}
            <div style={S.headerCashier}>
              <UserRound size={16} />
              <span>{cashierName}</span>
              {!isAdmin && userEmplacement && (
                <span style={{ marginLeft: "6px", fontSize: "11px", opacity: 0.85 }}>
                  • {userEmplacement} ({articles.length})
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ════════════════════ OFFLINE POS STATUS & SYNC BAR ════════════════════ */}
        <div style={{ padding: "10px 24px 0 24px" }}>
          <OfflinePOSBar />
        </div>

        {/* ════════════════════ 4K MULTI-CART / PARKED TABS BAR ════════════════════ */}
        {(parkedCarts.length > 0 || cart.length > 0) && (
          <div style={{
            padding: "8px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "rgba(15, 23, 42, 0.03)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            overflowX: "auto"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflowX: "auto" }}>
              {/* Active Current Cart Pill */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 14px",
                background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                borderRadius: 12,
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)",
                flexShrink: 0
              }}>
                <ShoppingCart size={15} />
                <span>Panier Actif</span>
                <span style={{ background: "rgba(255,255,255,0.2)", padding: "1px 7px", borderRadius: 6, fontSize: 11 }}>
                  {cart.length} art. • {formatAmount(ticketTotal)} F
                </span>
              </div>

              {/* Parked Carts Tabs */}
              {parkedCarts.map((pCart, idx) => (
                <div
                  key={pCart.id}
                  onClick={() => restoreParkedCart(pCart.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid #cbd5e1",
                    color: "#1e293b",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                  className="hover:border-indigo-400 hover:shadow-md group"
                  title="Cliquer pour reprendre ce ticket"
                >
                  <Clock size={15} className="text-amber-500 flex-shrink-0" />
                  <span>#{idx + 1}</span>
                  <span style={{ color: "#475569", fontWeight: 800 }}>{pCart.clientNom || "Passant"}</span>
                  {pCart.note && (
                    <span style={{ background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 4, fontSize: 10, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pCart.note}
                    </span>
                  )}
                  <span style={{ background: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}>
                    {formatAmount(pCart.totalAmount || 0)} F
                  </span>
                  {/* Print Slip Fast Icon */}
                  <button
                    onClick={(e) => printHoldingSlip(pCart, e)}
                    style={{ background: "none", border: "none", color: "#94a3b8", padding: 2, cursor: "pointer" }}
                    className="hover:text-indigo-600"
                    title="Imprimer ticket d'attente"
                  >
                    <Printer size={13} />
                  </button>
                  {/* Delete Fast Icon */}
                  <button
                    onClick={(e) => deleteParkedCart(pCart.id, e)}
                    style={{ background: "none", border: "none", color: "#94a3b8", padding: 2, cursor: "pointer" }}
                    className="hover:text-rose-600"
                    title="Supprimer définitivement ce ticket"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Actions: Park current, or Manage all */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {cart.length > 0 && (
                <button
                  onClick={() => setParkNotePromptOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: "#fef3c7",
                    border: "1px solid #f59e0b",
                    borderRadius: 10,
                    color: "#92400e",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                  className="hover:bg-amber-100"
                  title="Mettre en attente avec note optionnelle"
                >
                  <PauseCircle size={14} />
                  <span>Mettre en attente</span>
                </button>
              )}

              {parkedCarts.length > 0 && (
                <button
                  onClick={() => setIsParkedCartsModalOpen(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    background: "#e0e7ff",
                    border: "1px solid #818cf8",
                    borderRadius: 10,
                    color: "#3730a3",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                  className="hover:bg-indigo-100"
                  title="Gestionnaire complet des tickets en attente"
                >
                  <Layers size={14} />
                  <span>Gérer ({parkedCarts.length})</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════ MAIN 3 COLUMNS ════════════════════ */}
        <div style={S.body}>

          {/* ──────── COLUMN 1: PRODUITS ──────── */}
          <section style={{ ...S.panel, width: "35%" }}>
            <div style={S.panelHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <PackageSearch size={17} className="text-indigo-400" />
                <span style={{ fontWeight: 900, textTransform: "uppercase" }}>Produits</span>
              </div>
              <span style={{
                background: "rgba(255,255,255,0.12)",
                color: "#e2e8f0",
                fontSize: 11,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 8,
                fontFamily: "monospace",
              }}>
                {filteredArticles.length} art.
              </span>
            </div>
            <div style={{ padding: 10, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              {/* Search */}
              <div style={S.searchBox}>
                <Search size={16} style={{ marginLeft: 8, color: "#95a5a6" }} />
                <input
                  id="pos-search-input"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Rechercher un produit... (Nom, Ref, Code-barres)"
                  style={S.searchInput}
                />
                <button
                  onClick={() => {
                    if (isListening) return;
                    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                    if (!SpeechRecognition) { alert("Votre navigateur ne supporte pas la reconnaissance vocale."); return; }
                    const recognition = new SpeechRecognition();
                    recognition.lang = "fr-FR";
                    recognition.interimResults = false;
                    recognition.maxAlternatives = 1;
                    setIsListening(true);
                    recognition.onresult = (event: any) => {
                      const transcript = event.results[0][0].transcript;
                      setQuery(transcript);
                      setIsListening(false);
                    };
                    recognition.onerror = () => setIsListening(false);
                    recognition.onend = () => setIsListening(false);
                    recognition.start();
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: 4, display: 'flex', alignItems: 'center' }}
                  title="Recherche vocale"
                >
                  <Mic size={16} style={{ color: isListening ? '#ef4444' : '#95a5a6', animation: isListening ? 'pulse 1s infinite' : 'none' }} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(true)}
                  style={{
                    background: '#4f46e5',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px',
                    cursor: 'pointer',
                    marginRight: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    boxShadow: '0 2px 4px rgba(79,70,229,0.3)',
                  }}
                  title="Scanner le code-barres avec la caméra"
                >
                  <Camera size={15} />
                </button>
              </div>

              {/* Camera Scanner Modal */}
              {showCameraScanner && (
                <BarcodeCameraScanner
                  onScan={handleCameraBarcodeScanned}
                  onClose={() => setShowCameraScanner(false)}
                />
              )}

              {/* Product Grid */}
              <div className="pos-scrollbar" style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, paddingBottom: 8 }}>
                  {filteredArticles.map((article) => {
                    const imgSrc = getProductImage(article.designation);
                    return (
                      <button
                        key={article.id}
                        onClick={() => addItem(article)}
                        className="pos-product-card group hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md active:scale-95 transition-all"
                        style={S.productCard}
                      >
                        {/* Stock pill */}
                        <div style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          fontSize: 9,
                          fontWeight: 800,
                          padding: "1px 5px",
                          borderRadius: 6,
                          background: article.stock_total > 0 ? "rgba(240, 253, 244, 0.95)" : "rgba(254, 242, 242, 0.95)",
                          color: article.stock_total > 0 ? "#15803d" : "#b91c1c",
                          border: `1px solid ${article.stock_total > 0 ? "#bbf7d0" : "#fecaca"}`,
                          zIndex: 1,
                        }}>
                          {article.stock_total > 0 ? `${article.stock_total}` : "0"}
                        </div>

                        <div style={S.productImageBox}>
                          {imgSrc ? (
                            <Image src={imgSrc} alt={article.designation} width={50} height={50} style={{ objectFit: "contain" }} />
                          ) : (
                            <div style={{ color: "#cbd5e1" }}><PackageSearch size={26} /></div>
                          )}
                        </div>
                        <div style={S.productLabel}>
                          <div style={S.productName} title={article.designation}>{article.designation}</div>
                          <div style={S.productPrice}>{formatAmount(article.p_vente_ttc)} F</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Buttons */}
              <div style={{ paddingTop: 8, borderTop: "1px solid #e2e8f0", display: "flex", gap: 8 }}>
                <button 
                  className="pos-action-btn active:scale-95" 
                  onClick={() => setIsQuickAddOpen(true)}
                  style={S.btnAjouterRapide}
                >
                  <Plus size={16} strokeWidth={3} /> Ajouter Rapide
                </button>
                <button
                  className="pos-action-btn active:scale-95"
                  onClick={() => setBarcodeMode(!barcodeMode)}
                  style={S.btnBarcode(barcodeMode)}
                  title={barcodeMode ? "Mode code-barres actif" : "Activer mode code-barres"}
                >
                  <Barcode size={22} />
                </button>
              </div>
            </div>
          </section>

          {/* ──────── COLUMN 2: TICKET DE CAISSE ──────── */}
          <section style={{ ...S.panel, width: "35%" }}>
            <div style={S.panelHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={17} className="text-indigo-400" />
                <span style={{ fontWeight: 900, textTransform: "uppercase" }}>Ticket de Caisse</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  background: "rgba(255,255,255,0.12)",
                  color: "#e2e8f0",
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: 8,
                  fontFamily: "monospace",
                }}>
                  {cart.length} ligne{cart.length > 1 ? "s" : ""}
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    style={{
                      background: "rgba(239, 68, 68, 0.2)",
                      border: "1px solid rgba(239, 68, 68, 0.4)",
                      color: "#fca5a5",
                      padding: "2px 7px",
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                    className="hover:bg-red-500 hover:text-white active:scale-95 transition-all"
                    title="Vider le panier en cours"
                  >
                    Vider
                  </button>
                )}
              </div>
            </div>
            <div style={{ padding: 10, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              {/* Table */}
              <div className="pos-scrollbar" style={{ flex: 1, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 8, background: "#fff" }}>
                <table style={S.ticketTable}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={S.ticketTh}>Produit</th>
                      <th style={{ ...S.ticketTh, textAlign: "center" }}>Quantité</th>
                      <th style={{ ...S.ticketTh, textAlign: "right" }}>Prix</th>
                      <th style={S.ticketThLast}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedItemId(item.id)}
                        className="pos-ticket-row hover:bg-slate-50 transition-colors"
                        style={{
                          cursor: "pointer",
                          ...(selectedItemId === item.id ? S.ticketRowSelected : {}),
                        }}
                      >
                        <td style={S.ticketTd}>
                          <div style={{ fontWeight: 800, color: "#1e293b" }}>{item.designation}</div>
                          {item.code_barre && (
                            <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{item.code_barre}</div>
                          )}
                          {allowedDepotsList.length > 1 && (
                            <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
                              <span style={{ fontSize: 11 }}>📦</span>
                              <select
                                value={item.depot_origine || selectedDepot}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newDep = e.target.value;
                                  setCart((prev) =>
                                    prev.map((ci) =>
                                      ci.id === item.id ? { ...ci, depot_origine: newDep } : ci
                                    )
                                  );
                                  setSuccess(`Article transféré vers : ${newDep}`);
                                  setTimeout(() => setSuccess(null), 2500);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: "#4338ca",
                                  background: "#eef2ff",
                                  border: "1px solid #c7d2fe",
                                  borderRadius: 5,
                                  padding: "1px 4px",
                                  cursor: "pointer",
                                  outline: "none",
                                }}
                                title="Changer le dépôt source pour cet article sans vider le panier"
                              >
                                {allowedDepotsList.map((depName) => {
                                  const curStock = getAvailableArticleStock(item, depName);
                                  return (
                                    <option key={depName} value={depName} style={{ color: "#000" }}>
                                      {depName} ({curStock} dispo)
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}
                        </td>
                        <td style={{ ...S.ticketTd, textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.quantite > 1) updateQuantity(item.id, item.quantite - 1);
                                else removeItem(item.id);
                              }}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                border: "1px solid #cbd5e1",
                                background: "#f1f5f9",
                                color: "#475569",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                              className="hover:bg-indigo-100 hover:text-indigo-600 transition-all active:scale-90"
                              title="Diminuer"
                            >
                              <Minus size={10} strokeWidth={3} />
                            </button>
                            <input
                              type="number"
                              className="pos-qty-input"
                              value={item.quantite}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "") {
                                  updateQuantity(item.id, 0); 
                                } else {
                                  updateQuantity(item.id, parseInt(val) || 1);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={(e) => e.target.select()}
                              style={S.ticketQtyInput}
                              min="1"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.id, item.quantite + 1);
                              }}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                border: "1px solid #cbd5e1",
                                background: "#f1f5f9",
                                color: "#475569",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                              className="hover:bg-indigo-100 hover:text-indigo-600 transition-all active:scale-90"
                              title="Augmenter"
                            >
                              <Plus size={10} strokeWidth={3} />
                            </button>
                          </div>
                        </td>
                        <td style={{ ...S.ticketTd, textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                            <input
                              type="number"
                              className="pos-price-input"
                              value={priceDrafts[String(item.id)] ?? item.p_vente_ttc}
                              onChange={(e) => handlePriceDraftChange(item.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  requestPriceChangeConfirmation(item);
                                }
                                if (e.key === "Escape") {
                                  setPriceDrafts((prev) => ({
                                    ...prev,
                                    [String(item.id)]: item.p_vente_ttc.toString(),
                                  }));
                                }
                              }}
                              style={{
                                ...S.ticketPriceInput,
                                border: item.price_modified ? "2px solid #f59e0b" : S.ticketPriceInput.border,
                                background: item.price_modified ? "#fff7ed" : S.ticketPriceInput.background,
                              }}
                              step="0.01"
                              min="0"
                            />
                            {(priceDrafts[String(item.id)] ?? item.p_vente_ttc.toString()) !== item.p_vente_ttc.toString() && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestPriceChangeConfirmation(item);
                                }}
                                title="Confirmer le nouveau prix"
                                style={{
                                  border: "none",
                                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                                  color: "#fff",
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  boxShadow: "0 2px 6px rgba(22,163,74,0.25)",
                                }}
                                className="active:scale-90"
                              >
                                <Save size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ ...S.ticketTdLast, fontWeight: 800 }}>{(item.p_vente_ttc * item.quantite).toFixed(2)}</td>
                      </tr>
                    ))}
                    {cart.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <ShoppingCart size={28} className="text-slate-300" />
                            <span style={{ fontSize: 13, fontWeight: 700 }}>Le panier est vide</span>
                            <span style={{ fontSize: 11 }}>Cliquez sur un article ou scannez un code-barres</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 8, background: "#fff" }}>
                <div style={S.totalRow}>
                  <span style={S.totalLabel}>Total HT:</span>
                  <span style={S.totalValue}>{formatAmount(totalHT)} F CFA</span>
                </div>
                <div style={{ ...S.totalRow, background: "#f8fafc" }}>
                  <span style={S.totalLabel}>TVA:</span>
                  <span style={S.totalValue}>{formatAmount(totalTVA)} F CFA</span>
                </div>
                <div style={S.totalTTCRow}>
                  <span style={S.totalTTCLabel}>Total TTC:</span>
                  <span style={S.totalTTCValue}>{formatAmount(ticketTotal)} F CFA</span>
                </div>
              </div>

              {/* Ticket Action Buttons */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button
                  className="pos-action-btn active:scale-95"
                  onClick={() => { const item = cart.find(i => i.id === selectedItemId); if(item) updateQuantity(item.id, item.quantite+1); }}
                  style={S.btnAjouter}
                >
                  <Plus size={14} strokeWidth={4} /> Ajouter
                </button>
                <button
                  className="pos-action-btn active:scale-95"
                  onClick={() => { const item = cart.find(i => i.id === selectedItemId); if(item && item.quantite > 1) updateQuantity(item.id, item.quantite - 1); }}
                  style={S.btnReduire}
                >
                  <Minus size={14} strokeWidth={4} /> Réduire
                </button>
                <button
                  className="pos-action-btn active:scale-95"
                  onClick={() => { if(selectedItemId) removeItem(selectedItemId); else clearCart(); }}
                  style={S.btnSupprimer}
                >
                  <X size={14} strokeWidth={4} /> Supprimer
                </button>
              </div>

              <div style={{ marginTop: 10, border: "1px solid #dbe4f0", borderRadius: 10, background: "#f8fafc", overflow: "hidden" }}>
                <div style={{ padding: "8px 10px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#eef2ff" }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#312e81", textTransform: "uppercase", letterSpacing: 0.4 }}>
                    Historique Prix En Cours
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#475569" }}>
                    {currentPriceChanges.length} modification(s)
                  </span>
                </div>
                <div className="pos-scrollbar" style={{ maxHeight: 110, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentPriceChanges.length > 0 ? currentPriceChanges.map((entry) => (
                    <div key={entry.id} style={{ background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0", padding: "8px 10px" }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>{entry.designation}</div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        {formatAmount(entry.oldPrice)} → {formatAmount(entry.newPrice)} F CFA • Qté {entry.quantity}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                        {formatDateTime(entry.changedAt)} • {entry.changedBy}
                      </div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textAlign: "center", padding: "8px 0" }}>
                      Aucun changement de prix validé pour cette vente.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 8, border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", padding: "8px 10px" }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#0f172a", textTransform: "uppercase", marginBottom: 6 }}>
                  Journal des Modifications Prix
                </div>
                <div className="pos-scrollbar" style={{ maxHeight: 84, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {(serverPriceChangeHistory.length > 0 ? serverPriceChangeHistory : priceChangeHistory).slice(0, 4).map((entry) => (
                    <div key={entry.id} style={{ fontSize: 11, color: "#475569", borderBottom: "1px dashed #e2e8f0", paddingBottom: 4 }}>
                      <strong style={{ color: "#0f172a" }}>{entry.designation}</strong> • {formatAmount(entry.oldPrice)} → {formatAmount(entry.newPrice)} • {entry.changedBy}
                      {entry.quantity > 0 && <span> • Qté {entry.quantity}</span>}
                      {entry.reason && <div style={{ color: "#64748b", marginTop: 2 }}>Motif: {entry.reason}</div>}
                      <div style={{ color: "#94a3b8", marginTop: 2 }}>{formatDateTime(entry.changedAt)}</div>
                    </div>
                  ))}
                  {serverPriceChangeHistory.length === 0 && priceChangeHistory.length === 0 && (
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                      Le journal des changements de prix apparaîtra ici après la première validation.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ──────── COLUMN 3: PAIEMENT ──────── */}
          <section style={{ ...S.panel, width: "30%" }}>
            <div style={S.panelHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CreditCard size={17} className="text-emerald-400" />
                <span style={{ fontWeight: 900, textTransform: "uppercase" }}>Paiement</span>
              </div>
              <span style={{
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#6ee7b7",
                fontSize: 11,
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 8,
              }}>
                {paymentMethod}
              </span>
            </div>
            <div className="pos-scrollbar" style={{ padding: 12, display: "flex", flexDirection: "column", flex: 1, gap: 12, overflowY: "auto" }}>
              {/* Big Total Terminal Card */}
              <div style={S.payTotalBox}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={S.payTotalLabel}>Total à Payer</span>
                  <span style={{ fontSize: 10, background: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", padding: "1px 6px", borderRadius: 4, fontWeight: 800, textTransform: "uppercase" }}>
                    TTC Net
                  </span>
                </div>
                <span style={S.payTotalAmount}>{formatAmount(ticketTotal)} F CFA</span>
              </div>

              {/* Quick Cash Suggestion Pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: -4 }}>
                <button
                  type="button"
                  onClick={() => setReceivedAmount(String(ticketTotal))}
                  disabled={ticketTotal <= 0}
                  style={{
                    flex: "1 1 auto",
                    padding: "5px 8px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#047857",
                    cursor: ticketTotal > 0 ? "pointer" : "not-allowed",
                  }}
                  className="hover:bg-emerald-200 active:scale-95 transition-all"
                  title="Remplir le montant exact"
                >
                  ✨ Exact
                </button>
                {[1000, 2000, 5000, 10000, 20000].map((bill) => (
                  <button
                    key={bill}
                    type="button"
                    onClick={() => {
                      const curr = Number(receivedAmount) || 0;
                      setReceivedAmount(String(curr + bill));
                    }}
                    style={{
                      flex: "1 1 auto",
                      padding: "5px 7px",
                      background: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#334155",
                      cursor: "pointer",
                    }}
                    className="hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 active:scale-95 transition-all"
                  >
                    +{bill >= 1000 ? `${bill / 1000}k` : bill}
                  </button>
                ))}
                {receivedAmount && (
                  <button
                    type="button"
                    onClick={() => setReceivedAmount("")}
                    style={{
                      padding: "5px 8px",
                      background: "#fee2e2",
                      border: "1px solid #fecaca",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#b91c1c",
                      cursor: "pointer",
                    }}
                    className="hover:bg-rose-200 active:scale-95 transition-all"
                    title="Effacer le montant saisi"
                  >
                    Effacer
                  </button>
                )}
              </div>

              {/* Amount Inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={S.payInputRow}>
                  <span style={S.payInputLabel}>Montant Reçu:</span>
                  <input
                    className="pos-pay-input"
                    type="text"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(e.target.value)}
                    style={S.payInput}
                    placeholder="0.00"
                  />
                </div>
                <div style={S.payInputRow}>
                  <span style={S.payInputLabel}>Monnaie:</span>
                  <div style={{
                    ...S.payChangeBox,
                    background: changeAmount > 0 ? "#f0fdf4" : "#f8fafc",
                    borderColor: changeAmount > 0 ? "#10b981" : "#cbd5e1",
                    color: changeAmount > 0 ? "#15803d" : "#64748b",
                  }}>
                    {formatAmount(changeAmount)} F CFA
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: "#e2e8f0", margin: "2px 0" }} />

              {/* Customer Selection */}
              <div style={S.customerBox}>
                <div style={S.customerInfo}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#475569", fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>
                    <UserRound size={14} className="text-indigo-600" /> Client
                  </div>
                  {selectedClientId && clients.find(c => String(c.id) === String(selectedClientId))?.credit_facture ? (
                    <div style={S.customerCreditBadge}>
                      Dette: {formatAmount(clients.find(c => String(c.id) === String(selectedClientId))!.credit_facture)} F
                    </div>
                  ) : null}
                  {totalAdvanceBalance > 0 && (
                    <div style={{ ...S.customerCreditBadge, background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}>
                      Avance: {formatAmount(totalAdvanceBalance)} F
                    </div>
                  )}
                </div>
                {/* Client Search Input */}
                <div style={{ display: "flex", alignItems: "center", border: "2px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: "2px 10px", marginBottom: 4, transition: "border-color 0.2s" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#4f46e5")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                >
                  <Search size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                  <input
                    id="pos-client-search"
                    type="text"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    placeholder="Rechercher un client..."
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      padding: "6px 8px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0f172a",
                      background: "transparent",
                    }}
                  />
                  {clientQuery && (
                    <button
                      onClick={() => setClientQuery("")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#94a3b8", display: "flex", alignItems: "center" }}
                      title="Effacer la recherche"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <select 
                    style={{ ...S.customerSelect, flex: 1 }}
                    value={selectedClientId}
                    onChange={(e) => {
                      const cId = e.target.value;
                      setSelectedClientId(cId);
                      setClientQuery("");
                      const selectedC = clients.find((c) => String(c.id) === String(cId));
                      if (selectedC?.type_client === "Gros") {
                        handlePricingTierChange("Gros");
                      } else if (selectedC?.type_client === "Revendeur") {
                        handlePricingTierChange("Revendeur");
                      } else if (selectedC?.type_client === "Détail") {
                        handlePricingTierChange("Détail");
                      }
                    }}
                    size={clientQuery ? Math.min(clients.filter(c => normalizeText(c.nom).includes(normalizeText(clientQuery)) || (c.tel ?? "").includes(clientQuery)).length + 1, 6) : 1}
                  >
                    <option value="">Sélectionner un client...</option>
                    {(clientQuery
                      ? clients.filter(c =>
                          normalizeText(c.nom).includes(normalizeText(clientQuery)) ||
                          (c.tel ?? "").includes(clientQuery)
                        )
                      : clients
                    ).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nom} {c.tel ? `(${c.tel})` : ""} {c.type_client && c.type_client !== "Détail" ? `[${c.type_client}]` : ""}
                      </option>
                    ))}
                  </select>
                  <button 
                    onClick={() => setIsClientModalOpen(true)}
                    style={{
                      background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 12,
                      width: 40,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 4px 10px rgba(79, 70, 229, 0.25)",
                      flexShrink: 0
                    }}
                    className="hover:brightness-110 active:scale-95 transition-all"
                    title="Ajouter un nouveau client"
                  >
                    <UserPlus size={18} />
                  </button>
                </div>

                {/* VIP Loyalty Badge if client has points */}
                {(() => {
                  const currentClient = clients.find((c) => String(c.id) === String(selectedClientId));
                  if (!currentClient || !(Number(currentClient.points_fidelite) > 0)) return null;
                  const pts = Number(currentClient.points_fidelite);
                  const valCFA = pts * 10;
                  const tier = currentClient.niveau_fidelite || "BRONZE";
                  return (
                    <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #fef3c7, #fde68a)", border: "1px solid #f59e0b", padding: "5px 8px", borderRadius: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#78350f", display: "flex", alignItems: "center", gap: 4 }}>
                        ⭐ VIP [{tier}]: {pts.toLocaleString()} pts ({valCFA.toLocaleString()} F CFA)
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#92400e", background: "#fff", padding: "2px 6px", borderRadius: 6 }}>
                        Cashback Actif
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Multi-Tier Pricing Mode Switcher */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px", background: "#f1f5f9", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <button
                  type="button"
                  onClick={() => handlePricingTierChange("Détail")}
                  style={{
                    flex: 1,
                    padding: "6px 4px",
                    fontSize: 11,
                    fontWeight: 800,
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: pricingTier === "Détail" ? "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)" : "transparent",
                    color: pricingTier === "Détail" ? "#fff" : "#64748b",
                    boxShadow: pricingTier === "Détail" ? "0 2px 6px rgba(79, 70, 229, 0.3)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  Détail
                </button>
                <button
                  type="button"
                  onClick={() => handlePricingTierChange("Gros")}
                  style={{
                    flex: 1,
                    padding: "6px 4px",
                    fontSize: 11,
                    fontWeight: 800,
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: pricingTier === "Gros" ? "linear-gradient(135deg, #059669 0%, #10b981 100%)" : "transparent",
                    color: pricingTier === "Gros" ? "#fff" : "#64748b",
                    boxShadow: pricingTier === "Gros" ? "0 2px 6px rgba(5, 150, 105, 0.3)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  Gros 🏷️
                </button>
                <button
                  type="button"
                  onClick={() => handlePricingTierChange("Revendeur")}
                  style={{
                    flex: 1,
                    padding: "6px 4px",
                    fontSize: 11,
                    fontWeight: 800,
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    background: pricingTier === "Revendeur" ? "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)" : "transparent",
                    color: pricingTier === "Revendeur" ? "#fff" : "#64748b",
                    boxShadow: pricingTier === "Revendeur" ? "0 2px 6px rgba(217, 119, 6, 0.3)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  Spécial ⭐
                </button>
              </div>

              {/* Payment Method Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  className="pos-action-btn active:scale-95"
                  onClick={() => setPaymentMethod("Espece")}
                  style={S.btnPayment(
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    "#047857",
                    paymentMethod === "Espece"
                  )}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Banknote size={18} /> Cash (Espèces)
                  </span>
                  {paymentMethod === "Espece" && <CheckCircle2 size={16} />}
                </button>
                <button
                  className="pos-action-btn active:scale-95"
                  onClick={() => setPaymentMethod("Carte")}
                  style={S.btnPayment(
                    "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    "#1d4ed8",
                    paymentMethod === "Carte"
                  )}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CreditCard size={18} /> Carte Bancaire
                  </span>
                  {paymentMethod === "Carte" && <CheckCircle2 size={16} />}
                </button>
                <button
                  className="pos-action-btn active:scale-95"
                  onClick={() => setPaymentMethod("Mobile Money")}
                  style={S.btnPayment(
                    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    "#b91c1c",
                    paymentMethod === "Mobile Money"
                  )}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Smartphone size={18} /> Mobile Money (Wave, Orange, Moov)
                  </span>
                  {paymentMethod === "Mobile Money" && <CheckCircle2 size={16} />}
                </button>
                <button
                  className="pos-action-btn active:scale-95"
                  onClick={() => setPaymentMethod("Crédit")}
                  style={S.btnPayment(
                    "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                    "#6d28d9",
                    paymentMethod === "Crédit"
                  )}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={18} /> À Crédit
                  </span>
                  {paymentMethod === "Crédit" && <CheckCircle2 size={16} />}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    className="pos-action-btn active:scale-95"
                    onClick={() => setPaymentMethod("Avance")}
                    disabled={totalAdvanceBalance <= 0}
                    style={{
                      ...S.btnPayment(
                        "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                        "#b45309",
                        paymentMethod === "Avance"
                      ),
                      opacity: totalAdvanceBalance <= 0 ? 0.45 : 1,
                      cursor: totalAdvanceBalance <= 0 ? "not-allowed" : "pointer"
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Banknote size={18} /> Dépôt / Avance ({formatAmount(totalAdvanceBalance)} F)
                    </span>
                    {paymentMethod === "Avance" && <CheckCircle2 size={16} />}
                  </button>
                  {paymentMethod === "Avance" && (
                    <p style={{ fontSize: 11, color: "#6366f1", margin: "2px 0 0 4px" }}>
                      ℹ️ Le montant reçu sera décompté de l'avance du client.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* ════════════════════ FOOTER (Ergonomic Executive Dock) ════════════════════ */}
        <footer style={S.footer}>
          <button
            className="pos-footer-btn hover:brightness-110 active:scale-95"
            onClick={clearCart}
            style={S.footerBtn(
              "linear-gradient(135deg, #475569 0%, #334155 100%)",
              "#1e293b"
            )}
            title="Créer un nouveau ticket"
          >
            <ShoppingCart size={17} /> Nouveau Ticket
          </button>
          <button
            className="pos-footer-btn hover:brightness-110 active:scale-95"
            onClick={() => setParkNotePromptOpen(true)}
            disabled={cart.length === 0}
            style={{
              ...S.footerBtn(
                "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                "#78350f"
              ),
              opacity: cart.length === 0 ? 0.5 : 1,
              cursor: cart.length === 0 ? "not-allowed" : "pointer",
            }}
            title="Mettre le ticket en attente"
          >
            <Clock size={17} /> En attente
          </button>
          <button
            className="pos-footer-btn hover:brightness-110 active:scale-95"
            onClick={clearCart}
            disabled={cart.length === 0}
            style={{
              ...S.footerBtn(
                "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                "#7f1d1d"
              ),
              opacity: cart.length === 0 ? 0.5 : 1,
              cursor: cart.length === 0 ? "not-allowed" : "pointer",
            }}
            title="Vider et supprimer le ticket"
          >
            <Trash2 size={17} /> Supprimer
          </button>

          {/* Primary CTA Hero Button */}
          <button
            className="pos-footer-btn hover:brightness-110 active:scale-[0.98] transition-all"
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            style={{
              ...S.footerBtnValidate,
              opacity: submitting ? 0.7 : cart.length === 0 ? 0.6 : 1,
              cursor: submitting || cart.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? (
              <div style={{ width: 22, height: 22, border: "3px solid #fff", borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <>
                <CheckCircle2 size={22} className="animate-pulse" />
                <span>Valider Vente</span>
                <span style={{
                  background: "rgba(255,255,255,0.25)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 900,
                  padding: "2px 7px",
                  borderRadius: 6,
                  marginLeft: 4,
                }}>
                  [ENTRÉE]
                </span>
              </>
            )}
          </button>

          <button
            className="pos-footer-btn hover:brightness-110 active:scale-95"
            onClick={() => {
              const lastId = localStorage.getItem("last_invoice_id");
              if (lastId) setPrintInvoiceId(lastId);
              else setError("Aucune facture récente à imprimer.");
            }}
            style={S.footerBtn(
              "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              "#075985"
            )}
            title="Réimprimer la dernière facture"
          >
            <Printer size={17} /> Imprimer
          </button>
          <button
            className="pos-footer-btn hover:brightness-110 active:scale-95"
            onClick={handleFermerCaisse}
            disabled={cashClosureLoading}
            style={{
              ...S.footerBtn(
                "linear-gradient(135deg, #334155 0%, #1e293b 100%)",
                "#0f172a"
              ),
              opacity: cashClosureLoading ? 0.6 : 1,
            }}
            title="Clôture et arrêt de caisse journalier"
          >
            {cashClosureLoading ? (
              <div style={{ width: 18, height: 18, border: "2px solid #fff", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <><Lock size={17} /> Clôture Caisse</>
            )}
          </button>
        </footer>
      </div>

      {pendingPriceChange && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={cancelPendingPriceChange}></div>
          <div style={{
            position: "relative",
            width: "100%",
            maxWidth: 520,
            background: "#fff",
            borderRadius: 24,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.30)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "20px 24px", background: "linear-gradient(135deg, #0f172a 0%, #312e81 100%)", color: "#fff" }}>
              <div style={{ fontSize: 22, fontWeight: 900 }}>Confirmer le nouveau prix</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
                La vente et la facture seront recalculées avec ce tarif.
              </div>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{pendingPriceChange.designation}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                  <div style={{ background: "#fff", borderRadius: 12, padding: 12, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Ancien Prix</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{formatAmount(pendingPriceChange.oldPrice)} F</div>
                  </div>
                  <div style={{ background: "#ecfdf5", borderRadius: 12, padding: 12, border: "1px solid #a7f3d0" }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: "#047857", textTransform: "uppercase" }}>Nouveau Prix</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#065f46", marginTop: 4 }}>{formatAmount(pendingPriceChange.newPrice)} F</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginTop: 10 }}>
                  Quantité: {pendingPriceChange.quantity} • Impact total: {formatAmount((pendingPriceChange.newPrice - pendingPriceChange.oldPrice) * pendingPriceChange.quantity)} F
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>
                  Motif de modification (optionnel)
                </label>
                <textarea
                  value={priceChangeReason}
                  onChange={(e) => setPriceChangeReason(e.target.value)}
                  rows={3}
                  placeholder="Ex: Remise exceptionnelle, accord client, correction de saisie..."
                  style={{ width: "100%", borderRadius: 14, border: "1px solid #cbd5e1", padding: "12px 14px", fontSize: 14, outline: "none", resize: "none", background: "#fff" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={cancelPendingPriceChange}
                  style={{ border: "none", background: "#e2e8f0", color: "#334155", padding: "12px 18px", borderRadius: 12, fontWeight: 800, cursor: "pointer" }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={confirmPendingPriceChange}
                  style={{ border: "none", background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)", color: "#fff", padding: "12px 18px", borderRadius: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 10px 20px rgba(21,128,61,0.22)" }}
                >
                  Confirmer et appliquer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printInvoiceId && (
        <InvoiceModal 
          key={`invoice-${printInvoiceId}`}
          invoiceId={printInvoiceId} 
          onClose={() => setPrintInvoiceId(null)} 
        />
      )}

      {showPaymentModal && paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={handlePaymentModalClose}
          onRefresh={() => {
            // Data is refreshed inside PaymentModal, but we could sync POS here if needed
          }}
        />
      )}

      {/* ── New Client Modal ── */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsClientModalOpen(false)}></div>
          <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="border-b border-slate-100 bg-[#F8FAFC] px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                <span className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <UserCircle2 size={24} strokeWidth={2.5} />
                </span>
                Nouveau Client
              </h2>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X size={20} className="stroke-2" />
              </button>
            </div>
            
            <form onSubmit={handleAddClient} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nom du Client <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={clientFormData.nom}
                  onChange={(e) => setClientFormData({...clientFormData, nom: e.target.value})}
                  className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  style={{ background: "#F9FAFB", borderRadius: "12px", padding: "14px 16px", border: "1px solid transparent" }}
                  placeholder="Ex: Entreprise ABC"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Téléphone</label>
                  <input
                    type="text"
                    value={clientFormData.tel}
                    onChange={(e) => setClientFormData({...clientFormData, tel: e.target.value})}
                    className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    style={{ background: "#F9FAFB", borderRadius: "12px", padding: "14px 16px", border: "1px solid transparent" }}
                    placeholder="Ex: 0555..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Référence</label>
                  <input
                    type="text"
                    value={clientFormData.ref_client}
                    onChange={(e) => setClientFormData({...clientFormData, ref_client: e.target.value})}
                    className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    style={{ background: "#F9FAFB", borderRadius: "12px", padding: "14px 16px", border: "1px solid transparent" }}
                    placeholder="Auto-générée si vide"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={clientSaving}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:-translate-y-0"
                  style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
                >
                  {clientSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />}
                  {clientSaving ? "Ajout..." : "Ajouter Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick Add Modal ── */}
      {isQuickAddOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div style={{
            background: "#fff", borderRadius: 24, padding: 32, width: "100%", maxWidth: 450,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            animation: "scaleUp 0.3s ease-out"
          }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: "#1e293b", marginBottom: 24, textAlign: "center" }}>
              🛒 Ajout Rapide d'Article
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Désignation</label>
                <input 
                  type="text" autoFocus
                  value={quickAddForm.designation}
                  onChange={(e) => setQuickAddForm({...quickAddForm, designation: e.target.value})}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e8f0", fontSize: 16 }}
                  placeholder="Ex: Sac Surprise"
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Prix (F CFA)</label>
                  <input 
                    type="number"
                    value={quickAddForm.price}
                    onChange={(e) => setQuickAddForm({...quickAddForm, price: e.target.value})}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e8f0", fontSize: 16 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 8 }}>Quantité</label>
                  <input 
                    type="number" min="1"
                    value={quickAddForm.quantity}
                    onChange={(e) => setQuickAddForm({...quickAddForm, quantity: e.target.value})}
                    style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e8f0", fontSize: 16 }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button 
                  onClick={() => setIsQuickAddOpen(false)}
                  style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "#f1f5f9", color: "#64748b", fontWeight: 700, cursor: "pointer" }}
                >
                  Annuler
                </button>
                <button 
                  onClick={handleConfirmQuickAdd}
                  style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)", color: "#fff", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(79, 70, 229, 0.4)" }}
                >
                  Confirmer l'Ajout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Closure & Rapport Z Modal */}
      {isCashClosureOpen && cashClosureSummary && (
        <CashClosureModal
          summary={cashClosureSummary}
          filters={{
            start: new Date().toISOString().split("T")[0],
            end: new Date().toISOString().split("T")[0],
            cashier: getClientSessionFromCookie()?.username || "Caisse",
          }}
          userSession={getClientSessionFromCookie()}
          onClose={() => setIsCashClosureOpen(false)}
          onFinish={() => {
            setIsCashClosureOpen(false);
            router.push("/dashboard");
          }}
        />
      )}

      {/* ─── Fast Parking Note Prompt Modal ─── */}
      {parkNotePromptOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setParkNotePromptOpen(false)}></div>
          <div style={{
            position: "relative",
            width: "100%",
            maxWidth: 480,
            background: "#fff",
            borderRadius: 24,
            padding: 28,
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.3)",
            animation: "scaleUp 0.25s ease-out"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "#fef3c7", padding: 10, borderRadius: 14, color: "#d97706" }}>
                  <PauseCircle size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Mettre le panier en attente</h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                    {cart.length} articles • {formatAmount(ticketTotal)} F CFA
                  </p>
                </div>
              </div>
              <button
                onClick={() => setParkNotePromptOpen(false)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6, textTransform: "uppercase" }}>
                  Note ou repère (Optionnel)
                </label>
                <input
                  type="text"
                  autoFocus
                  value={parkNoteInput}
                  onChange={(e) => setParkNoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") parkCurrentCart();
                  }}
                  placeholder="Ex: Client parti chercher son sac, Table 3, M. Oumarou..."
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 14,
                    border: "2px solid #e2e8f0",
                    fontSize: 14,
                    fontWeight: 600,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 14, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569" }}>
                Client sélectionné : <strong>{clients.find(c => String(c.id) === String(selectedClientId))?.nom || "Client Passant"}</strong>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => parkCurrentCart()}
                  style={{
                    padding: "13px",
                    borderRadius: 14,
                    border: "none",
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(217, 119, 6, 0.3)"
                  }}
                >
                  Confirmer et mettre en attente
                </button>
                <button
                  type="button"
                  onClick={() => parkCurrentCart("")}
                  style={{
                    padding: "10px",
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer"
                  }}
                >
                  Mettre en attente directement (Sans note)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4K Parked Carts Manager Modal ─── */}
      {isParkedCartsModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-xs" onClick={() => setIsParkedCartsModalOpen(false)}></div>
          <div style={{
            position: "relative",
            width: "100%",
            maxWidth: 820,
            maxHeight: "88vh",
            background: "#fff",
            borderRadius: 28,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 60px -15px rgba(0,0,0,0.4)",
            animation: "scaleUp 0.25s ease-out"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "rgba(245, 158, 11, 0.2)", border: "1px solid rgba(245, 158, 11, 0.4)", padding: 10, borderRadius: 14, color: "#fbbf24" }}>
                  <Layers size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0 }}>
                    Gestionnaire des Tickets en Attente
                  </h2>
                  <p style={{ fontSize: 12, color: "#cbd5e1", margin: "2px 0 0 0" }}>
                    {parkedCarts.length} ticket(s) en attente • Cumul: {formatAmount(parkedCarts.reduce((sum, t) => sum + (t.totalAmount || 0), 0))} F CFA
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsParkedCartsModalOpen(false)}
                style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: 12, padding: 8, cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="pos-scrollbar" style={{ padding: 24, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {parkedCarts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 16px", color: "#94a3b8" }}>
                  <PauseCircle size={48} style={{ margin: "0 auto 12px auto", opacity: 0.3 }} />
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#64748b" }}>Aucun ticket en attente</p>
                  <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                    Les paniers que vous mettez en attente depuis la caisse s'afficheront ici pour reprise immédiate.
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
                  {parkedCarts.map((pCart, idx) => (
                    <div
                      key={pCart.id}
                      style={{
                        background: "#fff",
                        borderRadius: 18,
                        border: "1px solid #e2e8f0",
                        padding: 16,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        transition: "all 0.2s"
                      }}
                      className="hover:border-indigo-300"
                    >
                      {/* Ticket Top Info */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ background: "#fef3c7", color: "#92400e", fontWeight: 900, fontSize: 12, padding: "3px 8px", borderRadius: 8 }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>
                            {pCart.clientNom || "Client Passant"}
                          </span>
                          {pCart.note && (
                            <span style={{ background: "#eff6ff", color: "#1e40af", fontWeight: 700, fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid #dbeafe" }}>
                              🏷️ {pCart.note}
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={14} /> {pCart.time}
                          </span>
                          <span style={{ fontSize: 11, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                            {pCart.selectedDepot || "Principal"}
                          </span>
                        </div>
                      </div>

                      {/* Items Preview Table */}
                      <div style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #e2e8f0", color: "#64748b", textTransform: "uppercase", fontSize: 10, fontWeight: 800 }}>
                              <th style={{ padding: "6px 12px", textAlign: "left" }}>Article</th>
                              <th style={{ padding: "6px 12px", textAlign: "center" }}>Qté</th>
                              <th style={{ padding: "6px 12px", textAlign: "right" }}>P.U</th>
                              <th style={{ padding: "6px 12px", textAlign: "right" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pCart.cart.slice(0, 4).map((it, iIdx) => (
                              <tr key={iIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "6px 12px", fontWeight: 700, color: "#1e293b" }}>{it.designation}</td>
                                <td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 800, color: "#475569" }}>{it.quantite}</td>
                                <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", color: "#64748b" }}>
                                  {formatAmount(it.p_vente_ttc)} F
                                </td>
                                <td style={{ padding: "6px 12px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#0f172a" }}>
                                  {formatAmount(it.p_vente_ttc * it.quantite)} F
                                </td>
                              </tr>
                            ))}
                            {pCart.cart.length > 4 && (
                              <tr>
                                <td colSpan={4} style={{ padding: "6px 12px", textAlign: "center", color: "#94a3b8", fontSize: 11, fontStyle: "italic" }}>
                                  + {pCart.cart.length - 4} autre(s) article(s)...
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Card Bottom Row: Total & Actions */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                        <div>
                          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Total du ticket :</span>
                          <span style={{ fontSize: 18, fontWeight: 900, color: "#4f46e5", marginLeft: 8, fontFamily: "monospace" }}>
                            {formatAmount(pCart.totalAmount || 0)} F CFA
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={(e) => printHoldingSlip(pCart, e)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "7px 12px",
                              background: "#f1f5f9",
                              border: "1px solid #cbd5e1",
                              borderRadius: 10,
                              color: "#334155",
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer"
                            }}
                            className="hover:bg-slate-200"
                            title="Imprimer un ticket thermique d'attente"
                          >
                            <Printer size={14} />
                            <span>Imprimer Fiche</span>
                          </button>

                          <button
                            onClick={(e) => deleteParkedCart(pCart.id, e)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "7px 12px",
                              background: "#fee2e2",
                              border: "1px solid #fecaca",
                              borderRadius: 10,
                              color: "#ef4444",
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer"
                            }}
                            className="hover:bg-rose-200"
                            title="Supprimer ce ticket"
                          >
                            <Trash2 size={14} />
                            <span>Supprimer</span>
                          </button>

                          <button
                            onClick={() => restoreParkedCart(pCart.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "7px 16px",
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              border: "none",
                              borderRadius: 10,
                              color: "#fff",
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: "pointer",
                              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)"
                            }}
                            className="hover:brightness-110"
                          >
                            <CheckCircle2 size={15} />
                            <span>Reprendre en Caisse</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: "14px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setIsParkedCartsModalOpen(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#475569",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); rotate: 1deg; }
          to { opacity: 1; transform: scale(1); rotate: 0deg; }
        }
      `}</style>
    </>
  );
}

export default function POSPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
        <p className="ml-4 text-slate-600 font-bold">Chargement du point de vente...</p>
      </div>
    }>
      <PosPage />
    </Suspense>
  );
}
