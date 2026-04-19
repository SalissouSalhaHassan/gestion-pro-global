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
  Search,
  Smartphone,
  ShoppingCart,
  Trash2,
  UserRound,
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

type CartItem = Article & { quantite: number };

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

function formatAmount(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
    if (s.depot_nom) depotStocks[s.depot_nom] = toNumber(s.quantite);
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
  const [parkedCarts, setParkedCarts] = useState<{id: string, time: string, cart: CartItem[], clientId: string | number}[]>([]);
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | number>(1);
  const [selectedDepot, setSelectedDepot] = useState<string>("Boutique");

  useEffect(() => {
    // Attempt to read emplacement from session cookie
    const getSessionDepot = () => {
      try {
        const cookies = document.cookie.split("; ");
        const session = cookies.find(c => c.startsWith("gp_session="));
        if (session) {
          const decoded = decodeURIComponent(session.split("=")[1]);
          const data = JSON.parse(decoded);
          if (data.emplacement) {
            setSelectedDepot(data.emplacement);
          }
        }
      } catch (e) {
        console.error("Failed to read session depot:", e);
      }
    };
    getSessionDepot();
  }, []);

  const [paymentMethod, setPaymentMethod] = useState("Espece");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | number | null>(null);
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
  const [clientAdvances, setClientAdvances] = useState<any[]>([]);
  const [totalAdvanceBalance, setTotalAdvanceBalance] = useState(0);

  const searchParams = useSearchParams();
  const [editInvoiceId, setEditInvoiceId] = useState<string | number | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);

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
          quantite: toNumber(it.qte)
        }));
        setCart(cartItems);
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
      clientId: selectedClientId
    };
    setParkedCarts([...parkedCarts, newTab]);
    setCart([]);
    setSelectedClientId(1);
  };

  const restoreParkedCart = (tabId: string) => {
    if (cart.length > 0) {
      // Park the active one before restoring 
      const newTab = {
        id: Math.random().toString(36).substring(7),
        time: new Date().toLocaleTimeString("fr-FR", {hour: '2-digit', minute:'2-digit'}),
        cart: [...cart],
        clientId: selectedClientId
      };
      setParkedCarts(prev => [...prev.filter(t => t.id !== tabId), newTab]);
    }
    const tabToRestore = parkedCarts.find(t => t.id === tabId);
    if (tabToRestore) {
      setCart(tabToRestore.cart);
      setSelectedClientId(tabToRestore.clientId);
      if (cart.length === 0) {
         setParkedCarts(parkedCarts.filter(t => t.id !== tabId));
      }
    }
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
            stocks ( quantite )
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

        /* ── 3. Depots (from the stocks table distinct depot_nom) ── */
        const { data: depotsRaw, error: depErr } = await supabase
          .from("stocks")
          .select("depot_nom")
          .limit(100);

        /* ── 4. Company Info ── */
        const { data: companyRaw } = await supabase
          .from("informations_entreprise")
          .select("nom_entreprise, telephone")
          .eq("id", 1)
          .maybeSingle();

        if (!alive) return;

        // Process articles
        if (!artErr && articlesRaw && articlesRaw.length > 0) {
          const mapped = articlesRaw.map((row) => {
            const r = row as Row;
            const stocksArr = Array.isArray(r.stocks) ? r.stocks : [];
            const stockTotal = stocksArr.reduce(
              (sum: number, s: Record<string, unknown>) => sum + toNumber(s.quantite),
              0
            );
            return buildArticle({ ...r, stocks: stocksArr, stock_total: stockTotal });
          }).filter((a) => !!a.id && a.id !== 0);
          setArticles(mapped);
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

        // Process depots (unique names from stocks)
        if (!depErr && depotsRaw && depotsRaw.length > 0) {
          const uniqueNames = [...new Set(depotsRaw.map((d) => String((d as Row).depot_nom)))].filter(Boolean);
          setDepots(uniqueNames.map((name, i) => ({ id: i + 1, nom_depot: name })));
          if (uniqueNames.length > 0 && !selectedDepot) {
            setSelectedDepot(uniqueNames[0]);
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
  }, []);

  /* ═══════════════════════════════════════════════════════════════════
     CART LOGIC
     ═══════════════════════════════════════════════════════════════════ */

  const addItem = useCallback((article: Article) => {
    // Inventory Guard Check
    const available = article.depot_stocks?.[selectedDepot] || 0;
    
    setCart((prev) => {
      const existing = prev.find((item) => item.id === article.id);
      const newQty = existing ? existing.quantite + 1 : 1;
      
      if (newQty > available) {
        setError(`⚠️ Stock insuffisant pour "${article.designation}" (Disponible: ${available})`);
        setTimeout(() => setError(null), 3000);
      }

      if (existing) {
        return prev.map((item) =>
          item.id === article.id
            ? { ...item, quantite: newQty }
            : item
        );
      }
      return [...prev, { ...article, quantite: 1 }];
    });
  }, [selectedDepot]);

  const removeItem = useCallback((id: string | number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string | number, qty: number) => {
    const art = articles.find(a => a.id === id);
    if (art) {
        const available = art.depot_stocks?.[selectedDepot] || 0;
        if (qty > available) {
          setError(`⚠️ Limite de stock atteinte (${available} disponibles)`);
          setTimeout(() => setError(null), 3000);
        }
    }
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantite: Math.max(1, qty) } : item
      )
    );
  }, [articles, selectedDepot]);

  const updatePrice = useCallback((id: string | number, price: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, p_vente_ttc: Math.max(0, price) } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedItemId(null);
    setReceivedAmount("");
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
          depotName: selectedDepot || "Boutique",
          moyenReglement: paymentMethod,
          emplacement: editInvoiceId ? "Modification POS" : "Point de vente",
          items: cart.map((item) => ({
            id: item.id,
            quantite: item.quantite,
            prix: item.p_vente_ttc,
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
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "L'encaissement a échoué.");
      }

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
      setSuccess(
        `✅ Vente enregistrée${payload.sale?.numero ? ` — N° ${payload.sale.numero}` : ""}`
      );
      if (payload.sale?.alerts && payload.sale.alerts.length > 0) {
        setStockAlerts(payload.sale.alerts);
      }
      
      // TRIGGER PRINT PREVIEW
      if (payload.sale?.invoice_id || payload.sale?.id) {
        const invId = payload.sale.invoice_id || payload.sale.id;
        setPrintInvoiceId(invId ?? null);
        localStorage.setItem("last_invoice_id", String(invId));
      } else if (editInvoiceId) {
        setPrintInvoiceId(editInvoiceId);
        localStorage.setItem("last_invoice_id", String(editInvoiceId));
      }

      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
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
      depot_stocks: { [selectedDepot]: 999 }
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
            <div style={S.headerCashier}>
              <UserRound size={18} />
              <span>Caissier: Admin</span>
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
                        <td style={{ ...S.ticketTd, textAlign: "center" }}>{item.quantite}</td>
                        <td style={{ ...S.ticketTd, textAlign: "right" }}>
                          <input
                            type="number"
                            className="pos-price-input"
                            value={item.p_vente_ttc}
                            onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                            onClick={(e) => e.stopPropagation()}
                            style={S.ticketPriceInput}
                            step="0.01"
                            min="0"
                          />
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
                <select 
                  style={S.customerSelect}
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">Sélectionner un client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nom} {c.tel ? `(${c.tel})` : ""}
                    </option>
                  ))}
                </select>
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

      {printInvoiceId && (
        <InvoiceModal 
          invoiceId={printInvoiceId} 
          onClose={() => setPrintInvoiceId(null)} 
        />
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
