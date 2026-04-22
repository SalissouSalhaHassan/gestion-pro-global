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
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import InvoiceModal from "../invoices/InvoiceModal";

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
  credit_facture: number;
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
    fontFamily: "'Outfit', sans-serif",
    color: "#0f172a",
    background: "radial-gradient(at 0% 0%, rgba(240, 244, 255, 1) 0, transparent 50%), radial-gradient(at 100% 0%, rgba(245, 239, 255, 1) 0, transparent 50%), #f8fafc",
    overflow: "hidden",
    WebkitFontSmoothing: "antialiased" as const,
  },

  /* Customer Selector */
  customerBox: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    padding: "12px",
    background: "rgba(79, 70, 229, 0.03)",
    borderRadius: 16,
    border: "1px solid rgba(79, 70, 229, 0.1)",
  },
  customerSelect: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "2px solid #e2e8f0",
    background: "#fff",
    color: "#1e293b",
    fontWeight: 700,
    fontSize: 14,
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
    padding: "4px 10px",
    borderRadius: "20px",
    background: "#fee2e2",
    color: "#ef4444",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid #fecaca",
  },

  /* ── HEADER ── */
  header: {
    height: 60,
    background: "rgba(15, 23, 42, 0.95)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    zIndex: 20,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  headerStoreName: {
    fontWeight: 900,
    fontSize: 24,
    color: "#fff",
    letterSpacing: "-0.02em",
    background: "linear-gradient(to right, #fff, #94a3b8)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 32,
    color: "#94a3b8",
    fontWeight: 600,
    fontSize: 14,
  },
  headerInfoItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  headerCashier: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#fff",
    background: "rgba(255,255,255,0.1)",
    padding: "6px 14px",
    borderRadius: "12px",
    fontWeight: 700,
  },

  /* ── MAIN BODY ── */
  body: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    padding: 16,
    gap: 16,
  },

  /* ── SECTION PANEL ── */
  panel: {
    display: "flex",
    flexDirection: "column" as const,
    background: "rgba(255, 255, 255, 0.6)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.7)",
    borderRadius: 24,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
  },
  panelHeader: {
    background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    padding: "10px 0",
    textAlign: "center" as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
  },

  /* ── PRODUCTS COLUMN ── */
  searchBox: {
    display: "flex",
    alignItems: "center",
    border: "2px solid #e2e8f0",
    borderRadius: 16,
    background: "#fff",
    padding: "2px 4px",
    transition: "all 0.2s",
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    padding: "10px 12px",
    outline: "none",
    border: "none",
    fontWeight: 600,
    fontSize: 15,
    color: "#0f172a",
    background: "transparent",
  },
  productCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    background: "rgba(255, 255, 255, 0.8)",
    border: "1px solid rgba(255,255,255,1)",
    borderRadius: 18,
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
  },
  productImageBox: {
    height: 90,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    background: "#fff",
    transition: "transform 0.3s",
  },
  productLabel: {
    width: "100%",
    background: "rgba(248, 250, 252, 0.8)",
    padding: "8px 6px",
    textAlign: "center" as const,
  },
  productName: {
    fontWeight: 800,
    color: "#1e293b",
    fontSize: 12,
    lineHeight: 1.2,
    textTransform: "capitalize" as const,
    whiteSpace: "nowrap" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  productPrice: {
    fontWeight: 900,
    color: "#4f46e5",
    fontSize: 13,
    marginTop: 2,
  },

  /* ── BOTTOM PRODUCT BUTTONS ── */
  btnAjouterRapide: {
    flex: 1,
    background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    padding: "12px 0",
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "all 0.2s",
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
  },
  btnBarcode: (active: boolean) => ({
    width: 64,
    background: active
      ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
      : "rgba(15, 23, 42, 0.1)",
    color: active ? "#fff" : "#64748b",
    fontWeight: 700,
    padding: "12px 0",
    borderRadius: 14,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    boxShadow: active ? "0 4px 12px rgba(16, 185, 129, 0.3)" : "none",
  }),

  /* ── TICKET TABLE ── */
  ticketTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 14,
  },
  ticketTh: {
    padding: "12px 14px",
    textAlign: "left" as const,
    background: "rgba(0,0,0,0.02)",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "2px solid #f1f5f9",
  },
  ticketThLast: {
    padding: "12px 14px",
    textAlign: "right" as const,
    background: "rgba(0,0,0,0.02)",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "2px solid #f1f5f9",
  },
  ticketTd: {
    padding: "12px 14px",
    fontWeight: 700,
    borderBottom: "1px solid #f1f5f9",
    color: "#1e293b",
  },
  ticketTdLast: {
    padding: "12px 14px",
    fontWeight: 800,
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    textAlign: "right" as const,
  },
  ticketRowSelected: {
    background: "rgba(79, 70, 229, 0.08)",
  },

  /* ── TOTALS ── */
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 20px",
    borderBottom: "1px solid #f1f5f9",
  },
  totalLabel: {
    color: "#64748b",
    fontWeight: 600,
    fontSize: 14,
  },
  totalValue: {
    fontWeight: 800,
    color: "#1e293b",
    fontSize: 15,
  },
  totalTTCRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    background: "rgba(79, 70, 229, 0.05)",
  },
  totalTTCLabel: {
    fontWeight: 900,
    color: "#4f46e5",
    fontSize: 20,
  },
  totalTTCValue: {
    fontWeight: 900,
    color: "#4f46e5",
    fontSize: 32,
    letterSpacing: "-0.02em",
  },

  /* ── TICKET ACTIONS ── */
  btnAjouter: {
    flex: 1,
    background: "#10b981",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    padding: "10px 0",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.1s",
  },
  btnReduire: {
    flex: 1,
    background: "#3b82f6",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    padding: "10px 0",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.1s",
  },
  btnSupprimer: {
    flex: 1,
    background: "#ef4444",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    padding: "10px 0",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.1s",
  },

  /* ── PAIEMENT COLUMN ── */
  payTotalBox: {
    border: "2px solid #e2e8f0",
    background: "rgba(255,255,255,0.5)",
    padding: "20px",
    borderRadius: 20,
    textAlign: "center" as const,
  },
  payTotalLabel: {
    fontWeight: 800,
    fontSize: 18,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
  },
  payTotalAmount: {
    fontWeight: 900,
    fontSize: 36,
    color: "#0f172a",
    display: "block",
    marginTop: 4,
  },
  payInputRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "8px 0",
  },
  payInputLabel: {
    fontWeight: 800,
    fontSize: 16,
    color: "#1e293b",
  },
  payInput: {
    width: 160,
    padding: "12px 16px",
    border: "2px solid #cbd5e1",
    borderRadius: 14,
    textAlign: "right" as const,
    fontWeight: 900,
    fontSize: 22,
    color: "#0f172a",
    outline: "none",
    transition: "all 0.2s",
    background: "#fff",
  },
  payChangeBox: {
    width: 160,
    padding: "12px 16px",
    border: "2px solid #10b981",
    background: "#f0fdf4",
    borderRadius: 14,
    textAlign: "right" as const,
    fontWeight: 900,
    fontSize: 22,
    color: "#10b981",
  },
  btnPayment: (color: string, borderColor: string, active: boolean) => ({
    width: "100%",
    padding: "16px 0",
    borderRadius: 16,
    border: "none",
    background: active ? color : "rgba(15, 23, 42, 0.05)",
    color: active ? "#fff" : "#64748b",
    fontWeight: 800,
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    transition: "all 0.3s",
    boxShadow: active ? `0 8px 20px ${color}40` : "none",
    transform: active ? "scale(1.02)" : "scale(1)",
  }),

  /* ── FOOTER ── */
  footer: {
    height: 80,
    background: "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(12px)",
    borderTop: "1px solid rgba(0,0,0,0.05)",
    display: "flex",
    padding: "12px 16px",
    gap: 16,
    flexShrink: 0,
    zIndex: 30,
  },
  footerBtn: (bg: string, border: string) => ({
    flex: 1,
    background: bg,
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    borderRadius: 16,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    transition: "all 0.2s",
    boxShadow: `0 4px 12px ${bg}40`,
  }),
  footerBtnValidate: {
    flex: 2,
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 18,
    borderRadius: 16,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    transition: "all 0.2s",
    boxShadow: "0 8px 24px rgba(16, 185, 129, 0.4)",
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
    width: 90,
    padding: "4px 8px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontWeight: 800,
    fontSize: 14,
    color: "#4f46e5",
    textAlign: "right" as const,
    outline: "none",
    background: "rgba(255,255,255,0.9)",
    transition: "all 0.2s",
  },
  ticketQtyInput: {
    width: 60,
    padding: "4px 4px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    fontWeight: 800,
    fontSize: 14,
    color: "#0f172a",
    textAlign: "center" as const,
    outline: "none",
    background: "rgba(255,255,255,0.9)",
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
  const [parkedCarts, setParkedCarts] = useState<{
    id: string;
    time: string;
    cart: CartItem[];
    clientId: string | number;
    selectedDepot: string;
    invoiceId: string | number | null;
    priceChanges: PriceChangeLogEntry[];
    priceDrafts: Record<string, string>;
  }[]>([]);
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | number>(1);
  const [selectedDepot, setSelectedDepot] = useState<string>("");
  const [cashierName, setCashierName] = useState("Admin");
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmplacement, setUserEmplacement] = useState("");

  useEffect(() => {
    const getSessionData = () => {
      const session = readClientSession();
      if (!session) return;

      const admin = isAdminSession(session);
      const scopedDepots = splitDepotList(session.depots, session.emplacement);

      if (session.username) {
        setCashierName(session.username);
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
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ designation: "", price: "", quantity: "1" });
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSaving, setClientSaving] = useState(false);
  const [clientFormData, setClientFormData] = useState({ nom: "", tel: "", ref_client: "" });
  const [clientQuery, setClientQuery] = useState("");

  const [clientAdvances, setClientAdvances] = useState<any[]>([]);
  const [totalAdvanceBalance, setTotalAdvanceBalance] = useState(0);

  const searchParams = useSearchParams();
  const [editInvoiceId, setEditInvoiceId] = useState<string | number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

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

  /* ── Parked Carts Logic ── */
  const parkCurrentCart = () => {
    if (cart.length === 0) return;
    const newTab = {
      id: Math.random().toString(36).substring(7),
      time: new Date().toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'}),
      cart: [...cart],
      clientId: selectedClientId,
      selectedDepot,
      invoiceId: editInvoiceId,
      priceChanges: [...currentPriceChanges],
      priceDrafts: { ...priceDrafts },
    };
    setParkedCarts([...parkedCarts, newTab]);
    setCart([]);
    setCurrentPriceChanges([]);
    setPriceDrafts({});
    setPendingPriceChange(null);
    setPriceChangeReason("");
    setSelectedClientId(1);
    setEditInvoiceId(null);
  };

  const restoreParkedCart = (tabId: string) => {
    const tabToRestore = parkedCarts.find(t => t.id === tabId);
    if (!tabToRestore) return;

    const activeCartSnapshot = cart.length > 0
      ? {
          id: Math.random().toString(36).substring(7),
          time: new Date().toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'}),
          cart: [...cart],
          clientId: selectedClientId,
          selectedDepot,
          invoiceId: editInvoiceId,
          priceChanges: [...currentPriceChanges],
          priceDrafts: { ...priceDrafts },
        }
      : null;

    setParkedCarts((prev) => {
      const remaining = prev.filter((tab) => tab.id !== tabId);
      return activeCartSnapshot ? [...remaining, activeCartSnapshot] : remaining;
    });

    setCart(tabToRestore.cart);
    setSelectedClientId(tabToRestore.clientId);
    setSelectedDepot(tabToRestore.selectedDepot || "");
    setEditInvoiceId(tabToRestore.invoiceId ?? null);
    setCurrentPriceChanges(tabToRestore.priceChanges || []);
    setPriceDrafts(tabToRestore.priceDrafts || {});
    setPendingPriceChange(null);
    setPriceChangeReason("");
    setSelectedItemId(tabToRestore.cart[0]?.id ?? null);
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
        /* ── 1. Articles with aggregated stock ── */
        const { data: articlesRaw, error: artErr } = await supabase
          .from("articles")
          .select(`
            id, reference, code_barre, designation, nom,
            p_vente_ht, p_vente_ttc, taxe, image_path,
            is_deleted,
            stocks ( quantite, depot_nom )
          `)
          .eq("is_deleted", false)
          .order("designation", { ascending: true })
          .limit(500);

        if (artErr) {
          console.error("❌ Articles fetch error:", artErr.message, artErr.details);
        } else {
          console.log("✅ Articles fetched:", articlesRaw?.length || 0);
        }

        /* ── 2. Clients ── */
        const { data: clientsRaw, error: cliErr } = await supabase
          .from("clients")
          .select("id, ref_client, nom, tel, credit_facture, is_deleted")
          .eq("is_deleted", false)
          .order("nom", { ascending: true })
          .limit(500);

        /* ── 3. Depots ── */
        const { data: depotsRaw, error: depErr } = await supabase
          .from("depots")
          .select("id, nom, emplacement")
          .eq("is_deleted", false)
          .eq("is_active", true);

        /* ── 4. Company Info ── */
        const { data: companyRaw } = await supabase
          .from("informations_entreprise")
          .select("nom_entreprise, telephone")
          .eq("id", 1)
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

              if (isAdmin) {
                return !selectedDepotKey || depotKey === selectedDepotKey;
              }

              return scopedDepotKeys.includes(depotKey);
            });

            const stockTotal = visibleStocks.reduce(
              (sum: number, s: Record<string, unknown>) => sum + toNumber(s.quantite),
              0
            );
            return buildArticle({ ...r, stocks: visibleStocks, stock_total: stockTotal });
          }).filter((a) => !!a.id && a.id !== 0 && a.stock_total > 0); // Only show articles with stock in vendor's depot
          
          console.log(`✅ Articles fetched: ${mapped.length} (filtered for depot: ${userEmplacement})`);
          const fallbackDepot = findBestDepotMatch(resolvedSelectedDepot, allStockDepotNames) || allStockDepotNames[0] || "";

          console.log(`POS visible articles: ${mapped.length} for depot ${resolvedSelectedDepot || userEmplacement || "all"}`);
          setArticles(mapped);

          if (mapped.length === 0 && isAdmin && !editInvoiceId && fallbackDepot && fallbackDepot !== selectedDepot) {
            setSelectedDepot(fallbackDepot);
          }
        } else {
          setArticles([]);
          if (artErr) console.warn("Articles load error:", artErr.message);
        }

        // Process clients
        if (!cliErr && clientsRaw && clientsRaw.length > 0) {
          setClients(clientsRaw.map((r) => buildClient(r as Row)));
          if (!selectedClientId && clientsRaw.length > 0) {
            setSelectedClientId((clientsRaw[0] as Row).id as string | number);
          }
        }

        // Process depots
        if (!depErr && depotNames.length > 0) {
          setDepots(depotNames.map((name, i) => ({ id: i + 1, nom_depot: name })));
          
          if (!selectedDepot && depotNames.length > 0) {
             setSelectedDepot(depotNames[0]);
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
     CART LOGIC
     ═══════════════════════════════════════════════════════════════════ */

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
      return [...prev, { ...article, quantite: 1, original_price: article.p_vente_ttc, price_modified: false }];
    });
  }, [editInvoiceId, selectedDepot]);

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
        const available = getAvailableArticleStock(art, selectedDepot) + (editInvoiceId ? existingItem?.quantite || 0 : 0);
        if (qty > available) {
          setError(`⚠️ Limite de stock atteinte (${available} disponibles)`);
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

      clearCart();
      
      // TRIGGER PRINT PREVIEW - Direct state update (no setTimeout)
      let printId: string | number | null = null;
      
      if (payload.invoice_id) {
        printId = payload.invoice_id;
        console.log("✅ Using payload.invoice_id:", printId);
      } else if (payload.sale?.invoice_id) {
        printId = payload.sale.invoice_id;
        console.log("✅ Using payload.sale.invoice_id:", printId);
      } else if (payload.sale?.id) {
        printId = payload.sale.id;
        console.log("✅ Using payload.sale.id:", printId);
      } else if (editInvoiceId) {
        printId = editInvoiceId;
        console.log("✅ Using editInvoiceId (edit mode):", printId);
      } else {
        console.error("❌ NO invoice_id found anywhere in response:", payload);
        console.error("❌ Entire payload:", JSON.stringify(payload));
      }
      
      // Set print modal IMMEDIATELY (not in setTimeout)
      if (printId) {
        const numPrintId = typeof printId === 'string' ? Number(printId) : printId;
        console.log("🖨️ SETTING printInvoiceId NOW to:", numPrintId, "Type:", typeof numPrintId);
        setPrintInvoiceId(numPrintId);
        localStorage.setItem("last_invoice_id", String(numPrintId));
        console.log("✅ localStorage.last_invoice_id set to:", numPrintId);
      } else {
        console.error("❌ printId is null or empty, not setting print state");
      }
      
      setSuccess(
        `✅ Vente enregistrée${payload.sale?.numero ? ` — N° ${payload.sale.numero}` : ""}${printId ? " • Aperçu impression" : ""}`
      );
      if (payload.sale?.alerts && payload.sale.alerts.length > 0) {
        setStockAlerts(payload.sale.alerts);
      }

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
          is_deleted: false
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

  const handleFermerCaisse = () => {
    if (cart.length > 0) {
      if (!confirm("Il y a des articles dans le panier. Voulez-vous vraiment fermer la caisse ?")) {
        return;
      }
    }
    router.push("/dashboard");
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
            {/* Store Icon — blue shopping bag */}
            <svg width="36" height="36" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/>
            </svg>
            <span style={S.headerStoreName}>{storeName}</span>
          </div>

          <div style={S.headerRight}>
            <div style={S.headerInfoItem}>
              <Calendar size={18} />
              <span>{currentTime.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
            </div>
            <div style={S.headerInfoItem}>
              <Clock size={18} />
              <span>{currentTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            
            {/* Depot Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", padding: "4px 10px", borderRadius: "8px" }}>
              <PackageSearch size={16} color="#fff" />
              <select
                value={selectedDepot}
                onChange={(e) => isAdmin && !editInvoiceId && setSelectedDepot(e.target.value)}
                disabled={!isAdmin || !!editInvoiceId}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontWeight: 700,
                  outline: "none",
                  cursor: isAdmin && !editInvoiceId ? "pointer" : "not-allowed",
                  fontSize: 14,
                  opacity: !isAdmin || !!editInvoiceId ? 0.7 : 1,
                }}
                title={
                  editInvoiceId
                    ? `Dépôt verrouillé pour la facture #${editInvoiceId}`
                    : !isAdmin
                      ? `Dépôt spécialisé: ${userEmplacement}`
                      : "Sélectionner le dépôt"
                }
              >
                {!isAdmin && userEmplacement ? (
                  userEmplacement.split(",").map(dep => dep.trim()).map(dep => (
                    <option key={dep} value={dep} style={{ color: "#000" }}>{dep}</option>
                  ))
                ) : (
                  depots.map(d => (
                    <option key={d.id} value={d.nom_depot} style={{ color: "#000" }}>{d.nom_depot}</option>
                  ))
                )}
              </select>
            </div>

            <div style={S.headerCashier}>
              <UserRound size={18} />
              <span>Caissier: {cashierName}</span>
              {!isAdmin && userEmplacement && (
                <span style={{ marginLeft: "12px", fontSize: "12px", opacity: 0.8 }}>
                  • Dépôt: <strong>{userEmplacement}</strong> ({articles.length} articles)
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ════════════════════ TABS / PARKED CARTS ════════════════════ */}
        {parkedCarts.length > 0 && (
          <div style={{ padding: "10px 24px", display: "flex", gap: "10px", overflowX: "auto", background: "rgba(15, 23, 42, 0.04)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
             {parkedCarts.map((pCart, idx) => (
               <button 
                 key={pCart.id} 
                 onClick={() => restoreParkedCart(pCart.id)}
                 style={{ 
                   display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", 
                   background: "#fff", borderRadius: "12px", border: "1px solid #cbd5e1", 
                   color: "#334155", fontWeight: "bold", fontSize: "14px", cursor: "pointer",
                   boxShadow: "0 2px 4px rgba(0,0,0,0.05)", flexShrink: 0
                 }}
               >
                 <Clock size={16} className="text-indigo-500" />
                 Ticket en attente #{idx + 1} <span style={{color: "#94a3b8", fontSize: 12}}>({pCart.time})</span>
                 <span style={{background: "#e0e7ff", color: "#4338ca", padding: "2px 6px", borderRadius: 6, fontSize: 12, marginLeft: 4}}>
                   {pCart.cart.length} art.
                 </span>
               </button>
             ))}
          </div>
        )}

        {/* ════════════════════ MAIN 3 COLUMNS ════════════════════ */}
        <div style={S.body}>

          {/* ──────── COLUMN 1: PRODUITS ──────── */}
          <section style={{ ...S.panel, width: "35%" }}>
            <div style={S.panelHeader}>Produits</div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              {/* Search */}
              <div style={S.searchBox}>
                <Search size={16} style={{ marginLeft: 8, color: "#95a5a6" }} />
                <input
                  id="pos-search-input"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Recherche..."
                  style={S.searchInput}
                />
                <Mic size={16} style={{ marginRight: 8, color: "#95a5a6", cursor: "pointer" }} />
              </div>

              {/* Product Grid */}
              <div className="pos-scrollbar" style={{ flex: 1, overflowY: "auto", paddingRight: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, paddingBottom: 8 }}>
                  {filteredArticles.map((article) => {
                    const imgSrc = getProductImage(article.designation);
                    return (
                      <button
                        key={article.id}
                        onClick={() => addItem(article)}
                        className="pos-product-card"
                        style={S.productCard}
                      >
                        <div style={S.productImageBox}>
                          {imgSrc ? (
                            <Image src={imgSrc} alt={article.designation} width={58} height={58} style={{ objectFit: "contain" }} />
                          ) : (
                            <div style={{ color: "#dcdde1" }}><PackageSearch size={30} /></div>
                          )}
                        </div>
                        <div style={S.productLabel}>
                          <div style={S.productName}>{article.designation}</div>
                          <div style={S.productPrice}>{formatAmount(article.p_vente_ttc)} F CFA</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Buttons */}
              <div style={{ paddingTop: 8, borderTop: "1px solid #b2bec3", display: "flex", gap: 8 }}>
                <button 
                  className="pos-action-btn" 
                  onClick={() => setIsQuickAddOpen(true)}
                  style={S.btnAjouterRapide}
                >
                  <Plus size={16} strokeWidth={3} /> Ajouter Rapide
                </button>
                <button
                  className="pos-action-btn"
                  onClick={() => setBarcodeMode(!barcodeMode)}
                  style={S.btnBarcode(barcodeMode)}
                >
                  <Barcode size={22} />
                </button>
              </div>
            </div>
          </section>

          {/* ──────── COLUMN 2: TICKET DE CAISSE ──────── */}
          <section style={{ ...S.panel, width: "35%" }}>
            <div style={S.panelHeader}>Ticket de Caisse</div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              {/* Table */}
              <div className="pos-scrollbar" style={{ flex: 1, overflowY: "auto", border: "1px solid #b2bec3", borderRadius: 3, marginBottom: 8 }}>
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
                        className="pos-ticket-row"
                        style={{
                          cursor: "pointer",
                          ...(selectedItemId === item.id ? S.ticketRowSelected : {}),
                        }}
                      >
                        <td style={S.ticketTd}>{item.designation}</td>
                        <td style={{ ...S.ticketTd, textAlign: "center" }}>
                          <input
                            type="number"
                            className="pos-qty-input"
                            value={item.quantite}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                // Allow empty string temporarily while typing
                                updateQuantity(item.id, 0); 
                              } else {
                                updateQuantity(item.id, parseInt(val) || 1);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.target.select()}
                            style={{ ...S.ticketQtyInput, border: "2px solid #4f46e5" }}
                            min="1"
                          />
                        </td>
                        <td style={{ ...S.ticketTd, textAlign: "right" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
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
                                  width: 26,
                                  height: 26,
                                  borderRadius: 8,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  boxShadow: "0 4px 10px rgba(22,163,74,0.25)",
                                }}
                              >
                                <Save size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ ...S.ticketTdLast, fontWeight: 800 }}>{(item.p_vente_ttc * item.quantite).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ border: "1px solid #b2bec3", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                <div style={S.totalRow}>
                  <span style={S.totalLabel}>Total HT:</span>
                  <span style={S.totalValue}>{formatAmount(totalHT)} F CFA</span>
                </div>
                <div style={{ ...S.totalRow, background: "#f8f9fa" }}>
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
                  className="pos-action-btn"
                  onClick={() => { const item = cart.find(i => i.id === selectedItemId); if(item) updateQuantity(item.id, item.quantite+1); }}
                  style={S.btnAjouter}
                >
                  <Plus size={14} strokeWidth={4} /> Ajouter
                </button>
                <button
                  className="pos-action-btn"
                  onClick={() => { const item = cart.find(i => i.id === selectedItemId); if(item && item.quantite > 1) updateQuantity(item.id, item.quantite - 1); }}
                  style={S.btnReduire}
                >
                  <Minus size={14} strokeWidth={4} /> Réduire
                </button>
                <button
                  className="pos-action-btn"
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
            <div style={S.panelHeader}>Paiement</div>
            <div className="pos-scrollbar" style={{ padding: 16, display: "flex", flexDirection: "column", flex: 1, gap: 16, overflowY: "auto" }}>
              {/* Big Total */}
              <div style={S.payTotalBox}>
                <span style={S.payTotalLabel}>Total à Payer :</span>
                <span style={S.payTotalAmount}>{formatAmount(ticketTotal)} F CFA</span>
              </div>

              {/* Amount Inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
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
                  <div style={S.payChangeBox}>
                    {formatAmount(changeAmount)} F CFA
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: "#dce1e7", margin: "4px 0" }} />

              {/* Customer Selection */}
              <div style={S.customerBox}>
                <div style={S.customerInfo}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontWeight: 800, fontSize: 12, textTransform: "uppercase" }}>
                    <UserRound size={14} /> Client
                  </div>
                  {selectedClientId && clients.find(c => c.id === selectedClientId)?.credit_facture ? (
                    <div style={S.customerCreditBadge}>
                      Dette: {formatAmount(clients.find(c => c.id === selectedClientId)!.credit_facture)} F
                    </div>
                  ) : null}
                  {totalAdvanceBalance > 0 && (
                    <div style={{ ...S.customerCreditBadge, background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}>
                      Avance: {formatAmount(totalAdvanceBalance)} F
                    </div>
                  )}
                </div>
                {/* Client Search Input */}
                <div style={{ display: "flex", alignItems: "center", border: "2px solid #e2e8f0", borderRadius: 12, background: "#fff", padding: "2px 10px", marginBottom: 6, transition: "border-color 0.2s" }}
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
                      padding: "7px 8px",
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
                <div style={{ display: "flex", gap: 8 }}>
                  <select 
                    style={{ ...S.customerSelect, flex: 1 }}
                    value={selectedClientId}
                    onChange={(e) => { setSelectedClientId(e.target.value); setClientQuery(""); }}
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
                        {c.nom} {c.tel ? `(${c.tel})` : ""}
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
                      width: 42,
                      height: 42,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)",
                      flexShrink: 0
                    }}
                    title="Ajouter un nouveau client"
                  >
                    <UserPlus size={20} />
                  </button>
                </div>
              </div>

              <div style={{ height: 1, background: "#dce1e7", margin: "4px 0" }} />

              {/* Payment Method Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  className="pos-action-btn"
                  onClick={() => setPaymentMethod("Espece")}
                  style={S.btnPayment(
                    paymentMethod === "Espece"
                      ? "linear-gradient(180deg, #2ecc71 0%, #27ae60 100%)"
                      : "linear-gradient(180deg, #58d68d 0%, #2ecc71 100%)",
                    paymentMethod === "Espece" ? "#196f3d" : "#229954",
                    paymentMethod === "Espece"
                  )}
                >
                  <Banknote size={22} /> Cash
                </button>
                <button
                  className="pos-action-btn"
                  onClick={() => setPaymentMethod("Carte")}
                  style={S.btnPayment(
                    paymentMethod === "Carte"
                      ? "linear-gradient(180deg, #3498db 0%, #2980b9 100%)"
                      : "linear-gradient(180deg, #5dade2 0%, #3498db 100%)",
                    paymentMethod === "Carte" ? "#1a5276" : "#2471a3",
                    paymentMethod === "Carte"
                  )}
                >
                  <CreditCard size={22} /> Carte
                </button>
                <button
                  className="pos-action-btn"
                  onClick={() => setPaymentMethod("Mobile Money")}
                  style={S.btnPayment(
                    paymentMethod === "Mobile Money"
                      ? "linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)"
                      : "linear-gradient(180deg, #ec7063 0%, #e74c3c 100%)",
                    paymentMethod === "Mobile Money" ? "#922b21" : "#c0392b",
                    paymentMethod === "Mobile Money"
                  )}
                >
                  <Smartphone size={22} /> Mobile Money
                </button>
                <button
                  className="pos-action-btn"
                  onClick={() => setPaymentMethod("Crédit")}
                  style={S.btnPayment(
                    paymentMethod === "Crédit"
                      ? "linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)"
                      : "linear-gradient(180deg, #af7ac5 0%, #9b59b6 100%)",
                    paymentMethod === "Crédit" ? "#5b2c6f" : "#8e44ad",
                    paymentMethod === "Crédit"
                  )}
                >
                  <Clock size={22} /> Crédit
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button
                    className="pos-action-btn"
                    onClick={() => setPaymentMethod("Avance")}
                    disabled={totalAdvanceBalance <= 0}
                    style={{
                      ...S.btnPayment(
                        paymentMethod === "Avance"
                          ? "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)"
                          : "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)",
                        paymentMethod === "Avance" ? "#b45309" : "#d97706",
                        paymentMethod === "Avance"
                      ),
                      opacity: totalAdvanceBalance <= 0 ? 0.5 : 1,
                      cursor: totalAdvanceBalance <= 0 ? "not-allowed" : "pointer"
                    }}
                  >
                    <Banknote size={22} /> Dépôt/Avance
                  </button>
                  {paymentMethod === "Avance" && (
                    <p style={{ fontSize: 11, color: "#6366f1", marginTop: -6, marginLeft: 4 }}>
                      ℹ️ "Montant Reçu" sera traité comme un versement Cash partiel.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>

        {/* ════════════════════ FOOTER (5 Action Buttons) ════════════════════ */}
        <footer style={S.footer}>
          <button
            className="pos-footer-btn"
            onClick={clearCart}
            style={S.footerBtn(
              "linear-gradient(180deg, #f39c12 0%, #e67e22 100%)",
              "#ba4a00"
            )}
          >
            <ShoppingCart size={18} /> Nouveau Ticket
          </button>
          <button
            className="pos-footer-btn"
            onClick={parkCurrentCart}
            disabled={cart.length === 0}
            style={{...S.footerBtn(
              "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)",
              "#b45309"
            ), opacity: cart.length === 0 ? 0.5 : 1}}
          >
            <Clock size={18} /> Mettre en attente
          </button>
          <button
            className="pos-footer-btn"
            onClick={clearCart}
            style={S.footerBtn(
              "linear-gradient(180deg, #e74c3c 0%, #c0392b 100%)",
              "#922b21"
            )}
          >
            <Trash2 size={18} /> Supprimer Ticket
          </button>
          <button
            className="pos-footer-btn"
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            style={{
              ...S.footerBtnValidate,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <div style={{ width: 22, height: 22, border: "3px solid #fff", borderTop: "3px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            ) : (
              <><CheckCircle2 size={22} /> Valider Vente</>
            )}
          </button>
          <button
            className="pos-footer-btn"
            onClick={() => {
              // Open print for last success invoice ID if any
              const lastId = localStorage.getItem("last_invoice_id");
              if (lastId) setPrintInvoiceId(lastId);
              else setError("Aucune facture récente à imprimer.");
            }}
            style={S.footerBtn(
              "linear-gradient(180deg, #3498db 0%, #2980b9 100%)",
              "#1a5276"
            )}
          >
            <Printer size={18} /> Imprimer Facture
          </button>
          <button
            className="pos-footer-btn"
            onClick={handleFermerCaisse}
            style={S.footerBtn(
              "linear-gradient(180deg, #5d6d7e 0%, #4d5656 100%)",
              "#212f3d"
            )}
          >
            <Lock size={18} /> Fermer Caisse
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
