"use client";

import { useEffect, useMemo, useState } from "react";
import { 
  FileText, 
  Search, 
  Plus, 
  ArrowUpDown, 
  Banknote, 
  Calendar, 
  BadgeCheck, 
  Loader2, 
  Eye, 
  Printer as PrintIcon, 
  Edit3, 
  Trash2, 
  CreditCard, 
  BarChart3, 
  MapPin, 
  Info,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  List,
  CheckCircle2,
  Clock,
  AlertCircle,
  Share2,
  User,
  Filter,
  ArrowUpRight,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Store,
  CloudOff
} from "lucide-react";
import { useRouter } from "next/navigation";
import InvoiceModal from "./InvoiceModal";
import EditInvoiceModal from "./EditInvoiceModal";
import PaymentModal from "./PaymentModal";
import WhatsAppShareModal from "@/components/WhatsAppShareModal";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { getPendingOfflineInvoices, syncOfflineInvoicesToServer, removeSyncedOfflineInvoice } from "@/lib/utils/offline-sync";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string | number;
  bl_number: string;
  date_facture: string;
  client_nom: string;
  client_tel?: string;
  total_ttc: number;
  montant_paye: number;
  moyen_reglement: string | null;
  montant_restant: number;
  client_id?: number | string | null;
  vendeur?: string;
  emplacement?: string;
  statut?: string;
};

export default function InvoicesPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Invoice>("date_facture");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | number | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | number | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<any | null>(null);
  const [selectedWhatsAppInvoice, setSelectedWhatsAppInvoice] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [showReports, setShowReports] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  const handleSyncOffline = async () => {
    setIsSyncingOffline(true);
    try {
      const res = await syncOfflineInvoicesToServer(async (inv) => {
        const payload = {
          clientId: inv.clientId || 1,
          depotName: "BOUTIQUE",
          moyenReglement: inv.modePaiement || "Espece",
          versement: inv.montantRecu || 0,
          items: inv.items.map((it: any) => ({
            id: it.articleId,
            quantite: it.quantite,
            prix: it.p_vente_ttc,
            depot_origine: it.depot_origine || "BOUTIQUE",
          })),
        };
        const r = await fetch("/api/pos/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("Sync failed");
      });
      alert(`Synchronisation terminée : ${res.successCount} réussie(s), ${res.failedCount} échouée(s).`);
      loadInvoices(false);
    } catch (e) {
      console.error("Sync offline failed", e);
    } finally {
      setIsSyncingOffline(false);
    }
  };

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterVendor, setFilterVendor] = useState<string | null>(null);
  const [filterDepot, setFilterDepot] = useState<string | null>(null);
  const [filterDateStart, setFilterDateStart] = useState<string>("");
  const [filterDateEnd, setFilterDateEnd] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [vendorsList, setVendorsList] = useState<string[]>([]);
  const [depotsList, setDepotsList] = useState<string[]>([]);

  // Load session data to get current user
  useEffect(() => {
    try {
      const cookies = document.cookie.split("; ");
      const session = cookies.find(c => c.startsWith("gp_session="));
      if (session) {
        const decoded = decodeURIComponent(session.split("=")[1]);
        const data = JSON.parse(decoded);
        setCurrentUsername(data.username || null);
        setCurrentUserId(Number(data.id) || null);
        
        const isPrivileged = data.admin === 'Oui' || data.admin === 'oui' || data.admin === true || 
                            data.role === 1 || data.role === '1' || data.role === 'admin';
        setIsAdmin(isPrivileged);
      }
    } catch (e) {
      console.error("Failed to read session data:", e);
    }
  }, []);

  useEffect(() => {
    if (currentUsername !== null && typeof currentUsername !== 'undefined') {
      loadInvoices(false);

      // 1. Supabase Realtime channel for instant invoice feed
      const supabase = createClient();
      const channel = supabase
        .channel("invoices_realtime_feed")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "factures" },
          () => {
            loadInvoices(true);
          }
        )
        .subscribe();

      // 2. Offline queue reactive sync across tabs
      const updateOfflineState = () => {
        setOfflineCount(getPendingOfflineInvoices().length);
      };
      window.addEventListener("gp:offline-invoices-changed", updateOfflineState);

      let bc: BroadcastChannel | null = null;
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("gp_offline_channel");
        bc.onmessage = () => {
          updateOfflineState();
          loadInvoices(true);
        };
      }

      // Auto-refresh interval fallback
      const intervalId = setInterval(() => {
        loadInvoices(true);
      }, 30000); 

      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener("gp:offline-invoices-changed", updateOfflineState);
        if (bc) bc.close();
        clearInterval(intervalId);
      };
    }
  }, [refreshKey, currentUsername, currentUserId, isAdmin]);

  const loadInvoices = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await fetch(`/api/invoices?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Erreur lors du chargement des factures');
      
      const data = await response.json();

      if (data) {
        const mapped: Invoice[] = data.map((r: any) => ({
          id: r.id,
          bl_number: r.bl_number || `FA-${r.id}`,
          date_facture: r.date_facture,
          client_nom: r.clients?.nom || "Client Divers",
          client_tel: r.clients?.tel || "",
          total_ttc: Number(r.total_ttc) || 0,
          montant_paye: Number(r.montant_paye) || 0,
          moyen_reglement: r.moyen_reglement || r.mode_paiement || "Espèces",
          montant_restant: Math.max(0, (Number(r.total_ttc) || 0) - (Number(r.montant_paye) || 0)),
          client_id: r.client_id,
          vendeur: r.vendeur || "Admin",
          emplacement: r.emplacement || "BOUTIQUE",
          statut: r.statut || (Number(r.montant_paye) >= Number(r.total_ttc) ? "Payée" : Number(r.montant_paye) > 0 ? "Partielle" : "Non Payée")
        }));

        const offlinePending = getPendingOfflineInvoices();
        setOfflineCount(offlinePending.length);
        const mappedOffline: Invoice[] = offlinePending.map((inv) => ({
          id: inv.offlineId,
          bl_number: inv.offlineId,
          date_facture: new Date(inv.timestamp).toISOString(),
          client_nom: inv.clientName || "Client Divers",
          client_tel: "",
          total_ttc: Number(inv.totalTTC) || 0,
          montant_paye: Number(inv.montantRecu) || 0,
          moyen_reglement: inv.modePaiement || "Espèces",
          montant_restant: Math.max(0, (Number(inv.totalTTC) || 0) - (Number(inv.montantRecu) || 0)),
          client_id: inv.clientId,
          vendeur: currentUsername || "Vendeur",
          emplacement: "POS Web",
          statut: "En attente Sync",
        }));

        setInvoices([...mappedOffline, ...mapped]);
        
        const vendors = [...new Set(mapped.map(inv => inv.vendeur).filter(Boolean))] as string[];
        const depots = [...new Set(mapped.map(inv => inv.emplacement).filter(Boolean))] as string[];
        setVendorsList(vendors);
        setDepotsList(depots);
      }
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string | number) => {
    if (!confirm(locale === "ar" ? "هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إعادة الكميات إلى المخزون تلقائياً." : "🚨 Supprimer cette facture réajustera le stock. Continuer ?")) return;
    
    try {
      setLoading(true);

      // Check if it's a pending offline invoice
      const offlinePending = getPendingOfflineInvoices();
      const isOffline = offlinePending.some(inv => inv.offlineId === invoiceId || (inv as any).bl_number === invoiceId);

      if (isOffline) {
        removeSyncedOfflineInvoice(String(invoiceId));
        setRefreshKey(prev => prev + 1);
        alert(locale === "ar" ? "تم حذف الفاتورة المحلية بنجاح." : "Facture locale supprimée avec succès.");
        return;
      }

      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || (locale === "ar" ? "فشل حذف الفاتورة" : "Erreur lors de la suppression"));
      }
      
      const resData = await response.json();
      
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId && inv.bl_number !== invoiceId));
      setRefreshKey(prev => prev + 1);
      await loadInvoices(true);
      
      const count = resData.itemsRestored ?? 0;
      const successMsg = locale === "ar"
        ? `تم حذف الفاتورة بنجاح ✅ (تم إرجاع ${count} صنف إلى المخزون)`
        : `Facture supprimée avec succès ✅ (${count} article(s) réintégré(s) au stock)`;
      alert(successMsg);
    } catch (err: any) {
      console.error("Error deleting invoice:", err);
      alert(err.message || (locale === "ar" ? "حدث خطأ أثناء محاولة الحذف." : "Erreur lors de la suppression."));
    } finally {
      setLoading(false);
    }
  };

  const { filteredInvoices, totalRevenue, totalPaidRevenue, pendingRevenue } = useMemo(() => {
    let filtered = invoices;
    
    if (query) {
      const q = query.toLowerCase();
      filtered = invoices.filter(
        (i) =>
          i.bl_number.toLowerCase().includes(q) ||
          i.client_nom.toLowerCase().includes(q) ||
          (i.vendeur && i.vendeur.toLowerCase().includes(q)) ||
          (i.moyen_reglement && i.moyen_reglement.toLowerCase().includes(q))
      );
    }
    
    if (filterVendor) {
      filtered = filtered.filter(i => i.vendeur === filterVendor);
    }
    if (filterDepot) {
      filtered = filtered.filter(i => i.emplacement === filterDepot);
    }
    if (filterDateStart) {
      const startDate = new Date(filterDateStart);
      filtered = filtered.filter(i => new Date(i.date_facture) >= startDate);
    }
    if (filterDateEnd) {
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(i => new Date(i.date_facture) <= endDate);
    }

    if (filterStatus && filterStatus !== "all") {
      filtered = filtered.filter(i => {
        const restant = Number(i.montant_restant) || 0;
        const total = Number(i.total_ttc) || 0;
        if (filterStatus === "soldee") return restant <= 0;
        if (filterStatus === "partielle") return restant > 0 && restant < total;
        if (filterStatus === "impayee") return restant >= total && total > 0;
        return true;
      });
    }

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === "date_facture") {
        const da = new Date(aVal as string).getTime();
        const db = new Date(bVal as string).getTime();
        return sortAsc ? da - db : db - da;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    const total = filtered.reduce((acc, curr) => acc + (Number(curr.total_ttc) || 0), 0);
    const paid = filtered.reduce((acc, curr) => acc + (Number(curr.montant_paye) || 0), 0);
    const pending = filtered.reduce((acc, curr) => acc + (Number(curr.montant_restant) || 0), 0);

    return { 
      filteredInvoices: filtered, 
      totalRevenue: total, 
      totalPaidRevenue: paid, 
      pendingRevenue: pending 
    };
  }, [invoices, query, sortField, sortAsc, filterVendor, filterDepot, filterDateStart, filterDateEnd, filterStatus]);

  const toggleSort = (field: keyof Invoice) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const recoveryRate = totalRevenue > 0 ? ((totalPaidRevenue / totalRevenue) * 100).toFixed(1) : "100";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ── 4K EXECUTIVE HERO HEADER ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <FileText size={14} />
                GLOBAL BILLING ENGINE 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                {invoices.length} {locale === "ar" ? "فاتورة صادرة" : "Factures au total"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "إدارة فواتير المبيعات ونقاط البيع" : "Gestion des Factures & Ventes"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "سجل وتتبع فواتير المبيعات، ومتابعة التحصيل الفوري، ومشاركة إيصالات الدفع عبر واتساب"
                : "Suivi centralisé des factures, règlements clients, recouvrement et partage instantané WhatsApp"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => loadInvoices(false)}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Actualiser"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowReports(!showReports)}
                className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-white/10"
              >
                <BarChart3 size={15} className="text-indigo-400" />
                <span>{showReports ? (locale === "ar" ? "إخفاء التقارير" : "Masquer Rapports") : (locale === "ar" ? "تقارير البائعين" : "Rapports d'Activité")}</span>
                {showReports ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}

            <button
              onClick={() => router.push("/dashboard/corbeille")}
              className="px-4 py-3 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-rose-500/30"
              title="Corbeille"
            >
              <Trash2 size={15} className="text-rose-400" />
              <span>{locale === "ar" ? "سلة المحذوفات" : "Corbeille"}</span>
            </button>

            <button 
              onClick={() => router.push("/dashboard/pos")}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{locale === "ar" ? "+ فاتورة مبيعات جديدة" : "+ Nouvelle Facture POS"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── OFFLINE QUEUE ALERT BANNER ── */}
      {offlineCount > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 border border-amber-500/30 flex flex-wrap items-center justify-between gap-4 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/30">
              <CloudOff size={20} />
            </div>
            <div>
              <div className="text-sm font-black text-amber-950 flex items-center gap-2">
                <span>{offlineCount} {locale === "ar" ? "فاتورة مسجلة دون اتصال في المتصفح" : "facture(s) hors-ligne en attente"}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black">Local Cache</span>
              </div>
              <div className="text-xs text-amber-800 font-medium mt-0.5">
                {locale === "ar"
                  ? "تم حفظ هذه المبيعات محلياً عند انقطاع الشبكة، ويمكنك مزامنتها مع الخادم الآن."
                  : "Ces ventes sont stockées dans votre navigateur et peuvent être envoyées au serveur dès maintenant."}
              </div>
            </div>
          </div>
          <button
            onClick={handleSyncOffline}
            disabled={isSyncingOffline}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSyncingOffline ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>{locale === "ar" ? "مزامنة الفواتير الآن" : "Synchroniser Maintenant"}</span>
          </button>
        </div>
      )}

      {/* ── 4 EXECUTIVE FINANCIAL KPIS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Invoices */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الفواتير" : "Total Factures"}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <FileText size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {invoices.length}
          </div>
          <div className="text-[11px] text-slate-400 font-bold mt-1.5">
            {filteredInvoices.length} {locale === "ar" ? "معروضة حسب الفلترة" : "affichées"}
          </div>
        </div>

        {/* Chiffre d'Affaires Total */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي رقم المعاملات (CA)" : "Chiffre d'Affaires"}
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            {formatCurrencyAmount(totalRevenue)}
          </div>
          <div className="text-[11px] text-amber-600 font-bold mt-1.5 flex items-center gap-1">
            <ArrowUpRight size={13} />
            <span>{locale === "ar" ? "المبيعات الفاتورية المسجلة" : "Montant facturé global"}</span>
          </div>
        </div>

        {/* Total Collecté (Encaissé) */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "المبالغ المحصلة (المقبوضة)" : "Total Encaissé"}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {formatCurrencyAmount(totalPaidRevenue)}
          </div>
          <div className="text-[11px] text-emerald-600 font-bold mt-1.5">
            {recoveryRate}% {locale === "ar" ? "نسبة التحصيل" : "recouvert"}
          </div>
        </div>

        {/* Montants en Attente (Créances) */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "المستحقات المعلقة (الديون)" : "Reste à Recouvrer"}
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            {formatCurrencyAmount(pendingRevenue)}
          </div>
          <div className="text-[11px] text-rose-500 font-bold mt-1.5">
            {pendingRevenue === 0 ? (locale === "ar" ? "جميع الفواتير مسددة بالكامل" : "Toutes factures soldées") : (locale === "ar" ? "مستحقات واجبة التحصيل" : "En attente de paiement")}
          </div>
        </div>
      </div>

      {/* ── CONSOLIDATED VENDOR & DEPOT REPORTS (COLLAPSIBLE) ── */}
      {isAdmin && showReports && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* Vendor Report */}
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-purple-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-50 text-purple-600">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {locale === "ar" ? "أداء المبيعات حسب البائع" : "Rapport par Vendeur"}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase">
                  {locale === "ar" ? "معدل التحصيل والمبيعات لكل كاشير" : "Performance commerciale"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black">
                  <tr>
                    <th className="py-2.5 px-3">Vendeur</th>
                    <th className="py-2.5 px-3 text-center">Factures</th>
                    <th className="py-2.5 px-3 text-right">CA Total</th>
                    <th className="py-2.5 px-3 text-right">Encaissé</th>
                    <th className="py-2.5 px-3 text-center">Taux</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {vendorsList.map(vendor => {
                    const vendorInvoices = invoices.filter(inv => inv.vendeur === vendor);
                    const vendorTotal = vendorInvoices.reduce((sum, inv) => sum + inv.total_ttc, 0);
                    const vendorPaid = vendorInvoices.reduce((sum, inv) => sum + inv.montant_paye, 0);
                    const rate = vendorTotal > 0 ? ((vendorPaid / vendorTotal) * 100).toFixed(0) : "100";

                    return (
                      <tr key={vendor} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-black text-slate-800">{vendor}</td>
                        <td className="py-2.5 px-3 text-center text-indigo-600 font-black">{vendorInvoices.length}</td>
                        <td className="py-2.5 px-3 text-right text-slate-800">{formatCurrencyAmount(vendorTotal)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-black">{formatCurrencyAmount(vendorPaid)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            Number(rate) >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Depot Report */}
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-blue-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600">
                <MapPin size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {locale === "ar" ? "أداء المبيعات حسب الدكان / الفرع" : "Rapport par Dépôt"}
                </h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase">
                  {locale === "ar" ? "نشاط نقاط البيع المختلفة" : "Activité par point de vente"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black">
                  <tr>
                    <th className="py-2.5 px-3">Dépôt</th>
                    <th className="py-2.5 px-3 text-center">Factures</th>
                    <th className="py-2.5 px-3 text-right">CA Total</th>
                    <th className="py-2.5 px-3 text-right">Encaissé</th>
                    <th className="py-2.5 px-3 text-center">Taux</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {depotsList.map(depot => {
                    const depotInvoices = invoices.filter(inv => inv.emplacement === depot);
                    const depotTotal = depotInvoices.reduce((sum, inv) => sum + inv.total_ttc, 0);
                    const depotPaid = depotInvoices.reduce((sum, inv) => sum + inv.montant_paye, 0);
                    const rate = depotTotal > 0 ? ((depotPaid / depotTotal) * 100).toFixed(0) : "100";

                    return (
                      <tr key={depot} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-black text-slate-800">{depot}</td>
                        <td className="py-2.5 px-3 text-center text-blue-600 font-black">{depotInvoices.length}</td>
                        <td className="py-2.5 px-3 text-right text-slate-800">{formatCurrencyAmount(depotTotal)}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-black">{formatCurrencyAmount(depotPaid)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            Number(rate) >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TOOLBAR: SEARCH, STATUS QUICK CHIPS & VIEW SWITCHER ── */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={locale === "ar" ? "بحث برقم الفاتورة، اسم العميل، البائع، طريقة الدفع..." : "Rechercher N° Facture, Client, Vendeur..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Quick Actions & Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                showAdvancedFilters ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>{locale === "ar" ? "فلاتر متقدمة" : "Filtres"}</span>
            </button>

            {/* View Mode Toggle */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === "table" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Vue Tableau"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-xl transition-all ${
                  viewMode === "grid" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                }`}
                title="Vue Grille 4K"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {[
            { id: "all", label: locale === "ar" ? "الكل" : "Tous", count: invoices.length },
            { id: "soldee", label: locale === "ar" ? "✅ مسددة بالكامل" : "✅ Soldée (Payée)", count: invoices.filter(i => i.montant_restant <= 0).length },
            { id: "partielle", label: locale === "ar" ? "🟡 مدفوعة جزئياً" : "🟡 Paiement Partiel", count: invoices.filter(i => i.montant_restant > 0 && i.montant_paye > 0).length },
            { id: "impayee", label: locale === "ar" ? "🔴 آجلة / غير مسددة" : "🔴 Non Payée (Crédit)", count: invoices.filter(i => i.montant_paye <= 0).length },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setFilterStatus(chip.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterStatus === chip.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <span>{chip.label}</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${
                filterStatus === chip.id ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-700"
              }`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>

        {/* Quick Depot Filter Chips */}
        {depotsList.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-black text-slate-400 uppercase flex items-center gap-1">
              <Store size={13} className="text-indigo-600" /> {locale === "ar" ? "نقطة البيع / المستودع:" : "Point de Vente:"}
            </span>
            <button
              onClick={() => setFilterDepot(null)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !filterDepot ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {locale === "ar" ? "جميع نقاط البيع" : "Toutes les caisses"}
            </button>
            {depotsList.map((depot) => (
              <button
                key={depot}
                onClick={() => setFilterDepot(filterDepot === depot ? null : depot)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterDepot === depot ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {depot}
              </button>
            ))}
          </div>
        )}

        {/* Advanced Filters Expandable Drawer */}
        {showAdvancedFilters && (
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-in fade-in duration-200">
            {isAdmin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Vendeur</label>
                <select
                  value={filterVendor || ""}
                  onChange={(e) => setFilterVendor(e.target.value || null)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="">Tous les vendeurs</option>
                  {vendorsList.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date Début</label>
              <input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Date Fin</label>
              <input
                type="date"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-800 outline-none"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterVendor(null);
                  setFilterDepot(null);
                  setFilterDateStart("");
                  setFilterDateEnd("");
                  setFilterStatus("all");
                  setQuery("");
                }}
                className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                {locale === "ar" ? "إلغاء الفلاتر" : "Réinitialiser"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT: DENSE TABLE OR 4K CARDS GRID ── */}
      {viewMode === "table" ? (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                  <th 
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort("bl_number")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>N° Facture</span>
                      <ArrowUpDown size={13} className="text-slate-400" />
                    </div>
                  </th>
                  <th 
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort("date_facture")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date</span>
                      <ArrowUpDown size={13} className="text-slate-400" />
                    </div>
                  </th>
                  <th 
                    className="py-3.5 px-4 cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort("client_nom")}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Client</span>
                      <ArrowUpDown size={13} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Mode / Caisse</th>
                  <th 
                    className="py-3.5 px-4 text-right cursor-pointer hover:bg-slate-100"
                    onClick={() => toggleSort("total_ttc")}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Total TTC</span>
                      <ArrowUpDown size={13} className="text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right">Payé / Reste</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <Loader2 size={32} className="animate-spin mx-auto text-indigo-600 mb-2" />
                      <span>{locale === "ar" ? "جاري تحميل الفواتير..." : "Chargement des factures..."}</span>
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                      <span>{locale === "ar" ? "لا توجد فواتير مطابقة للبحث." : "Aucune facture trouvée."}</span>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isFullyPaid = inv.montant_restant <= 0;
                    const isPartiallyPaid = inv.montant_restant > 0 && inv.montant_paye > 0;

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            {inv.statut === "En attente Sync" && (
                              <CloudOff size={13} className="text-amber-600 shrink-0" />
                            )}
                            <div className="font-mono font-black text-indigo-600 text-xs">{inv.bl_number}</div>
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold">Vendeur: {inv.vendeur}</div>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-mono font-bold text-slate-500">
                          {new Date(inv.date_facture).toLocaleDateString('fr-FR')}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-black text-slate-800 text-xs">{inv.client_nom}</div>
                          {inv.client_tel && (
                            <div className="text-[10px] text-slate-400 font-bold">{inv.client_tel}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                            {inv.moyen_reglement}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-slate-900 text-sm">
                          {formatCurrencyAmount(inv.total_ttc)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="text-xs font-black text-emerald-600">
                            {formatCurrencyAmount(inv.montant_paye)}
                          </div>
                          {inv.montant_restant > 0 && (
                            <div className="text-[10px] font-bold text-rose-500">
                              Reste: {formatCurrencyAmount(inv.montant_restant)}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-block ${
                            inv.statut === "En attente Sync"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : isFullyPaid 
                              ? "bg-emerald-100 text-emerald-700" 
                              : isPartiallyPaid 
                              ? "bg-amber-100 text-amber-700" 
                              : "bg-rose-100 text-rose-700"
                          }`}>
                            {inv.statut === "En attente Sync" ? (locale === "ar" ? "📦 في الانتظار" : "📦 Hors-Ligne") : isFullyPaid ? "Payée" : isPartiallyPaid ? "Partielle" : "Non Payée"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv);
                                setSelectedInvoiceId(inv.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                              title="Aperçu / Imprimer Facture"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              onClick={() => setSelectedWhatsAppInvoice({
                                id: inv.id,
                                reference: inv.bl_number,
                                client: inv.client_nom,
                                clientTel: inv.client_tel,
                                totalTTC: inv.total_ttc,
                                montantPaye: inv.montant_paye,
                                reste: inv.montant_restant,
                              })}
                              className="p-1.5 rounded-lg text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-all cursor-pointer"
                              title="Partager par WhatsApp"
                            >
                              <Share2 size={16} />
                            </button>

                            <button
                              onClick={() => setEditInvoiceId(inv.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                              title={locale === "ar" ? "تعديل الفاتورة" : "Modifier la Facture"}
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              onClick={() => setPaymentInvoice(inv)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer"
                              title="Encaisser un règlement"
                            >
                              <CreditCard size={16} />
                            </button>

                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── 4K INVOICE CARDS GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              <Loader2 size={32} className="animate-spin mx-auto text-indigo-600 mb-2" />
              <span>{locale === "ar" ? "جاري تحميل الفواتير..." : "Chargement des factures..."}</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-3xl p-8 border border-slate-200/80">
              <FileText size={36} className="mx-auto text-slate-300 mb-2" />
              <span>{locale === "ar" ? "لا توجد فواتير مطابقة للبحث." : "Aucune facture trouvée."}</span>
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const isFullyPaid = inv.montant_restant <= 0;
              const isPartiallyPaid = inv.montant_restant > 0 && inv.montant_paye > 0;
              const payPercentage = inv.total_ttc > 0 ? Math.min(100, Math.round((inv.montant_paye / inv.total_ttc) * 100)) : 100;

              return (
                <div key={inv.id} className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-indigo-600 text-xs bg-indigo-50 px-2.5 py-1 rounded-xl">
                      {inv.bl_number}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                      isFullyPaid 
                        ? "bg-emerald-100 text-emerald-700" 
                        : isPartiallyPaid 
                        ? "bg-amber-100 text-amber-700" 
                        : "bg-rose-100 text-rose-700"
                    }`}>
                      {isFullyPaid ? "Payée" : isPartiallyPaid ? "Partielle" : "Non Payée"}
                    </span>
                  </div>

                  {/* Client & Date */}
                  <div>
                    <h3 className="font-black text-slate-900 text-base line-clamp-1">{inv.client_nom}</h3>
                    <div className="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center justify-between">
                      <span>{new Date(inv.date_facture).toLocaleDateString('fr-FR')}</span>
                      <span>Vendeur: {inv.vendeur}</span>
                    </div>
                  </div>

                  {/* Payment Progress Bar */}
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-500">Payé: {formatCurrencyAmount(inv.montant_paye)}</span>
                      <span className="font-black text-slate-900">{formatCurrencyAmount(inv.total_ttc)}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          isFullyPaid ? "bg-emerald-500" : isPartiallyPaid ? "bg-amber-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${payPercentage}%` }}
                      />
                    </div>
                    {inv.montant_restant > 0 && (
                      <div className="text-[11px] font-bold text-rose-500 text-right">
                        Reste dû: {formatCurrencyAmount(inv.montant_restant)}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setSelectedInvoiceId(inv.id);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye size={14} />
                      <span>Facture</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedWhatsAppInvoice({
                          id: inv.id,
                          reference: inv.bl_number,
                          client: inv.client_nom,
                          clientTel: inv.client_tel,
                          totalTTC: inv.total_ttc,
                          montantPaye: inv.montant_paye,
                          reste: inv.montant_restant,
                        })}
                        className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                        title="WhatsApp"
                      >
                        <Share2 size={16} />
                      </button>

                      <button
                        onClick={() => setEditInvoiceId(inv.id)}
                        className="p-2 rounded-xl text-amber-500 hover:bg-amber-50 transition-all cursor-pointer"
                        title={locale === "ar" ? "تعديل" : "Modifier"}
                      >
                        <Edit3 size={16} />
                      </button>

                      <button
                        onClick={() => setPaymentInvoice(inv)}
                        className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                        title="Règlement"
                      >
                        <CreditCard size={16} />
                      </button>

                      <button
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-all cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── MODALS ── */}
      {selectedInvoiceId && (
        <InvoiceModal 
          invoiceId={selectedInvoiceId} 
          initialInvoice={selectedInvoice}
          onClose={() => {
            setSelectedInvoiceId(null);
            setSelectedInvoice(null);
          }} 
        />
      )}

      {editInvoiceId && (
        <EditInvoiceModal
          invoiceId={editInvoiceId}
          onClose={() => setEditInvoiceId(null)}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
      )}

      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
      )}

      {selectedWhatsAppInvoice && (
        <WhatsAppShareModal
          details={{
            companyName: "GESTION PRO GLOBAL",
            invoiceNumber: selectedWhatsAppInvoice.reference,
            clientName: selectedWhatsAppInvoice.client,
            totalTTC: selectedWhatsAppInvoice.totalTTC,
            montantPaye: selectedWhatsAppInvoice.montantPaye,
            resteAPayer: selectedWhatsAppInvoice.reste,
            currency: "FCFA",
            invoiceUrl: `https://gestion-pro-global-tege.vercel.app/invoice/${selectedWhatsAppInvoice.id}`,
            locale,
          }}
          initialPhone={selectedWhatsAppInvoice.clientTel}
          onClose={() => setSelectedWhatsAppInvoice(null)}
        />
      )}
    </div>
  );
}
