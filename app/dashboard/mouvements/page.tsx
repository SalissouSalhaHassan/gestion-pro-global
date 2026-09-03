"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Search,
  Printer,
  ArrowRightLeft,
  TrendingUp,
  Activity,
  ArrowUpRight,
  RefreshCw,
  ArrowUpDown,
  Package,
  CalendarIcon,
  MapPin,
  Filter,
  Sparkles,
  CheckCircle2,
  X,
  FileText,
  ShieldCheck,
  History,
  AlertCircle,
  Layers,
  List,
  LayoutGrid,
  ChevronDown
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import StockTransferModal from "./StockTransferModal";
import StockJournalModal from "./StockJournalModal";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

type MouvementRecord = {
  id: string | number;
  date_mouvement: string;
  article_id?: string | number;
  type: string;
  nr_doc: string;
  fournisseur_client: string;
  depot_id: number | null;
  depot?: string; // For display
  utilisateur: string;
  stock_avant: number;
  quantite: number;
  stock_apres: number;
  entree?: number;
  sortie?: number;
  articles?: {
    reference: string;
    designation: string;
    p_achat_ht?: number;
    p_vente_ttc?: number;
  } | null;
};

type StockValuationSummary = {
  total_valeur_achat?: number;
  total_valeur_vente?: number;
};

const supabase = createClient();

export default function MouvementsPage() {
  const { locale, dir } = useLanguage();
  const [data, setData] = useState<MouvementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockValuation, setStockValuation] = useState<number | null>(null);
  const [stockValuationLoading, setStockValuationLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [printTransferRef, setPrintTransferRef] = useState<string | null>(null);
  const [showPrintJournal, setShowPrintJournal] = useState(false);
  const [groupByProduct, setGroupByProduct] = useState(false);

  // Advanced Filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDepotName, setSelectedDepotName] = useState<string>("");
  const [depots, setDepots] = useState<{ id: number; nom: string }[]>([]);
  const [typeFilter, setTypeFilter] = useState("Tous");
  const [generalSearch, setGeneralSearch] = useState("");
  const [hasMounted, setHasMounted] = useState(false);

  const [companyInfo, setCompanyInfo] = useState<any>(null);

  useEffect(() => {
    setHasMounted(true);
    fetchDepots();
  }, []);

  const fetchDepots = async () => {
    try {
      const res = await fetch("/api/stock/depots");
      const data = await res.json();
      if (Array.isArray(data)) setDepots(data);
    } catch (err) {
      console.warn("Failed to fetch depots:", err);
    }
  };

  const fetchStockValuation = useCallback(async () => {
    setStockValuationLoading(true);
    try {
      const query = new URLSearchParams({
        depot: selectedDepotName || "Tous",
        categoryId: "all",
      });

      const res = await fetch(`/api/stock/valuation?${query.toString()}`);
      const valuationData = await res.json();

      if (!res.ok) {
        throw new Error(valuationData?.error || "Erreur de valorisation stock");
      }

      const summary = valuationData?.summary as StockValuationSummary | undefined;
      setStockValuation(Number(summary?.total_valeur_vente || 0));
    } catch (err) {
      console.error("Failed to fetch stock valuation:", err);
      setStockValuation(null);
    } finally {
      setStockValuationLoading(false);
    }
  }, [selectedDepotName]);

  useEffect(() => {
    const getCompany = async () => {
      try {
        const { data: ci } = await supabase.from("informations_entreprise").select("*").limit(1).single();
        if (ci) setCompanyInfo(ci);
      } catch (e) {
        console.error("Error fetching company info:", e);
      }
    };
    getCompany();
  }, []);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const url = new URL("/api/stock/mouvements", window.location.origin);
      if (startDate) url.searchParams.set("startDate", startDate);
      if (endDate) url.searchParams.set("endDate", endDate);
      if (selectedDepotName) url.searchParams.set("depot", selectedDepotName);
      if (generalSearch) url.searchParams.set("search", generalSearch);

      const res = await fetch(url.toString());
      const records = await res.json();

      if (records && !Array.isArray(records)) {
        throw new Error(records.error || "Erreur de format API");
      }

      setData(records || []);
    } catch (err: any) {
      console.error("Failed to fetch movements:", err);
      setError(err?.message || "Échec de connexion au serveur.");
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [startDate, endDate, selectedDepotName, generalSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchStockValuation();
  }, [fetchStockValuation]);

  // ─── RUNNING BALANCE & FILTERING LOGIC ───
  const { filteredData, stats, groupedData } = useMemo(() => {
    // 1. Initial filter
    let raw = Array.isArray(data) ? [...data] : [];

    if (typeFilter !== "Tous") {
      raw = raw.filter((item) => item.type === typeFilter);
    }

    // 2. Sort for running balance calculation (Earliest first)
    raw.sort((a, b) => {
      const dateA = new Date(a.date_mouvement).getTime();
      const dateB = new Date(b.date_mouvement).getTime();
      if (dateA !== dateB) return dateA - dateB;

      // Priority to ENTRÉE INITIALE and achat if timestamps are same
      const getPriority = (t: string) => {
        if (t === "ENTRÉE INITIALE") return 1;
        if (t.toLowerCase().includes("achat")) return 2;
        if (t.toLowerCase().includes("vente")) return 10;
        return 5;
      };

      const prioA = getPriority(a.type);
      const prioB = getPriority(b.type);
      if (prioA !== prioB) return prioA - prioB;

      return Number(a.id) - Number(b.id);
    });

    // 3. Use Database Stock Balance directly
    const contextMap: Record<string, number> = {};
    const processed = raw.map((m) => {
      const key = `${m.article_id}-${m.depot || "default"}`;

      const refined = {
        ...m,
        stock_avant: Number(m.stock_avant || 0),
        stock_apres: Number(m.stock_apres || 0),
      };

      contextMap[key] = refined.stock_apres;
      return refined;
    });

    // 4. Calculate Stats (Sync with filtered UI View)
    const totalIn = processed.reduce((s, m) => s + Number(m.entree || 0), 0);
    const totalOut = processed.reduce((s, m) => s + Number(m.sortie || 0), 0);

    // Estimate selling value of filtered stock
    const articlesMap: Record<string, number> = {};
    processed.forEach((m) => {
      const key = `${m.article_id}`;
      articlesMap[key] = Number(m.articles?.p_vente_ttc || 0);
    });

    const valuationVal = Object.entries(contextMap).reduce((sum, [key, stock]) => {
      const artId = key.split("-")[0];
      return sum + stock * (articlesMap[artId] || 0);
    }, 0);

    // 5. Final Display Order (Latest First for the Table)
    const visualOrder = [...processed].reverse();

    // 6. Optional Grouping
    const groups: Record<string, { items: MouvementRecord[]; in: number; out: number; current: number }> = {};
    if (groupByProduct) {
      processed.forEach((m) => {
        const name = m.articles?.designation || (locale === "ar" ? "صنف غير محدد" : "Inconnu");
        if (!groups[name]) groups[name] = { items: [], in: 0, out: 0, current: 0 };
        groups[name].items.unshift(m); // Latest first in each group
        groups[name].in += Number(m.entree || 0);
        groups[name].out += Number(m.sortie || 0);
        groups[name].current = (m as any).stock_apres; // Last processed is current
      });
    }

    return {
      filteredData: visualOrder,
      stats: { stockIn: totalIn, stockOut: totalOut, balance: totalIn - totalOut, valuation: valuationVal },
      groupedData: groups,
    };
  }, [data, typeFilter, groupByProduct, locale]);

  const handleRefresh = () => {
    fetchData();
    fetchStockValuation();
  };

  const handlePrint = () => setShowPrintJournal(true);

  const isFiltered = !!(startDate || endDate || generalSearch || typeFilter !== "Tous" || selectedDepotName);
  const stockValuationValue = isFiltered ? stats.valuation : (stockValuation ?? stats.valuation);
  const formattedStockValuation = stockValuationLoading && stockValuation === null && !isFiltered
    ? "..."
    : formatCurrencyAmount(stockValuationValue);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-10" dir={dir}>
      {/* ── 1. Hero Header Banner (Exact Design of Catalogue & Gestion des Articles) ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Activity size={14} />
                {locale === "ar" ? "نظام تدقيق وتتبع حركة المخزون" : "ENTERPRISE STOCK AUDITOR"}
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <ShieldCheck size={13} className="text-emerald-400" />
                {locale === "ar" ? "سجل الحركات المعتمد" : "JOURNAL MAÎTRE DES FLUX"}
              </span>
              <span className="text-xs font-bold text-slate-300 bg-white/10 px-3 py-1 rounded-xl border border-white/10">
                {filteredData.length} {locale === "ar" ? "حركة مسجلة" : "Mouvements"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "مدقق حركة المخزون والتدفقات" : "Auditeur de Stock & Flux Logistiques"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "تتبع لحظي دقيق لكافة حركات الدخول، الخروج، المبيعات، والتحويلات مع التقييم المالي الشامل"
                : "Journal d'audit temps réel des entrées, sorties, ventes, transferts et valorisation financière"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setGroupByProduct(!groupByProduct)}
              className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm ${
                groupByProduct
                  ? "bg-indigo-500 text-white shadow-indigo-500/30"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
            >
              <Layers size={15} />
              <span>
                {groupByProduct
                  ? (locale === "ar" ? "عرض القائمة العادية" : "Vue Liste Standard")
                  : (locale === "ar" ? "تجميع حسب الصنف" : "Grouper par Produit")}
              </span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title={locale === "ar" ? "تحديث البيانات" : "Actualiser"}
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin text-indigo-400" : ""} />
              <span className="hidden sm:inline">{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-xl shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>{locale === "ar" ? "تقرير تدقيق المخزون" : "Générer Rapport d'Audit"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Executive KPI Cards (Exact Style of Catalogue & Gestion des Articles) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 print:hidden">
        {/* Card 1: Entrées */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الواردات (دخول)" : "Volume Entrant (Entrées)"}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">
            +{stats.stockIn.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 font-bold mt-1.5 flex items-center gap-1">
            <span>{locale === "ar" ? "مشتريات، تسويات إيجابية واستلامات" : "Achats, retours & réceptions"}</span>
          </div>
        </div>

        {/* Card 2: Sorties */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الصادرات (خروج)" : "Volume Sortant (Sorties)"}
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingUp size={18} className="rotate-180" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">
            -{stats.stockOut.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 font-bold mt-1.5 flex items-center gap-1">
            <span>{locale === "ar" ? "مبيعات نقدية وفواتير وسحوبات" : "Ventes comptoir, factures & sorties"}</span>
          </div>
        </div>

        {/* Card 3: Variation Nette */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "صافي التغير اللوجستي" : "Variation Nette (Flux)"}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ArrowUpDown size={18} />
            </div>
          </div>
          <div className={`text-2xl font-black ${stats.balance >= 0 ? "text-indigo-600" : "text-amber-600"}`}>
            {(stats.balance >= 0 ? "+" : "") + stats.balance.toFixed(2)}
          </div>
          <div className="text-xs text-slate-500 font-bold mt-1.5">
            {locale === "ar" ? "الفارق الصافي لحركة الفترة" : "Solde logistique net de la sélection"}
          </div>
        </div>

        {/* Card 4: Valeur Stock */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "القيمة المالية للمخزون" : "Valeur Totale du Stock"}
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {formattedStockValuation}
          </div>
          <div className="text-xs text-slate-500 font-bold mt-1.5 flex items-center gap-1">
            <span>{locale === "ar" ? "تقييم مالي فوري للمستودعات" : "Valorisation marchande d'inventaire"}</span>
          </div>
        </div>
      </div>

      {/* ── 3. Toolbar: Search, Filter Toggle, and Quick Options ── */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                locale === "ar"
                  ? "بحث برقم الوثيقة، اسم الصنف، الكود المرجعي، اسم العميل أو المورد..."
                  : "Rechercher par document (BL, FA), article, référence, client, fournisseur..."
              }
              value={generalSearch}
              onChange={(e) => setGeneralSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-2xl border text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
                showFilters || isFiltered
                  ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Filter size={15} />
              <span>{locale === "ar" ? "تصفية متقدمة" : "Affiner la recherche"}</span>
              {isFiltered && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              )}
            </button>

            <div className="text-xs font-extrabold text-slate-500 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200/80">
              Total : <span className="text-indigo-600">{filteredData.length}</span> {locale === "ar" ? "حركة" : "lignes"}
            </div>
          </div>
        </div>

        {/* Expandable Advanced Filters Drawer */}
        {showFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-300">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">
                {locale === "ar" ? "تاريخ البداية" : "Date de Début"}
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                <CalendarIcon size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent outline-none w-full text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">
                {locale === "ar" ? "تاريخ النهاية" : "Date de Fin"}
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                <CalendarIcon size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent outline-none w-full text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">
                {locale === "ar" ? "نوع الحركة" : "Type de Mouvement"}
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                <Activity size={14} className="text-slate-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-transparent outline-none w-full text-xs font-bold cursor-pointer"
                >
                  <option value="Tous">{locale === "ar" ? "جميع الحركات" : "Tous Types"}</option>
                  <option value="VENTE">Ventes / Sorties</option>
                  <option value="achat">Achats / Réceptions</option>
                  <option value="ENTRÉE INITIALE">Entrée Initiale</option>
                  <option value="transfert_entree">Transferts (Entrée)</option>
                  <option value="transfert_sortie">Transferts (Sortie)</option>
                  <option value="ajustement_entree">Ajustements (+)</option>
                  <option value="ajustement_sortie">Ajustements (-)</option>
                  <option value="retour">Retours Marchandises</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">
                {locale === "ar" ? "المستودع / النقطة" : "Dépôt & Emplacement"}
              </label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
                <MapPin size={14} className="text-slate-400" />
                <select
                  value={selectedDepotName}
                  onChange={(e) => setSelectedDepotName(e.target.value)}
                  className="bg-transparent outline-none w-full text-xs font-bold cursor-pointer"
                >
                  <option value="">{locale === "ar" ? "جميع المستودعات" : "Tous les Dépôts"}</option>
                  {depots.map((d) => (
                    <option key={d.id} value={d.nom}>
                      {d.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Main Ledger Content (Table View or Grouped Cards) ── */}
      {groupByProduct ? (
        <div className="space-y-6">
          {Object.entries(groupedData).map(([product, g]) => (
            <div
              key={product}
              className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-md">
                    <Package size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">{product}</h3>
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {g.items[0]?.articles?.reference || "REF-ARTICLE"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                    <span className="block text-[9px] font-black text-slate-400 uppercase">
                      {locale === "ar" ? "الوارد" : "Entrées"}
                    </span>
                    <span className="text-xs font-black text-emerald-600 font-mono">
                      +{g.in.toFixed(2)}
                    </span>
                  </div>
                  <div className="px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                    <span className="block text-[9px] font-black text-slate-400 uppercase">
                      {locale === "ar" ? "المنصرف" : "Sorties"}
                    </span>
                    <span className="text-xs font-black text-rose-600 font-mono">
                      -{g.out.toFixed(2)}
                    </span>
                  </div>
                  <div className="px-4 py-1.5 bg-slate-900 rounded-xl text-center min-w-[90px] shadow-sm">
                    <span className="block text-[9px] font-black text-slate-300 uppercase">
                      {locale === "ar" ? "الرصيد الفعلي" : "Stock Actuel"}
                    </span>
                    <span className="text-xs font-black text-white font-mono">
                      {g.current?.toFixed(2) || "0.00"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                <AuditTableView
                  items={g.items}
                  locale={locale}
                  onPrintTransfer={setPrintTransferRef}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <AuditTableView
              items={filteredData}
              loading={loading}
              locale={locale}
              onRetry={fetchData}
              onPrintTransfer={setPrintTransferRef}
            />
          </div>

          {/* Footer certification badge */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-bold text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-500" />
              <span>
                {locale === "ar"
                  ? "سجل محاسبي معتمد وتدقيق تلقائي للمخزون"
                  : "Journal Maître certifié et intégrité comptable du stock"}
              </span>
            </div>
            <div className="text-slate-500">
              {filteredData.length} {locale === "ar" ? "سطر تدقيق معروض" : "lignes d'audit enregistrées"}
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {printTransferRef && (
        <StockTransferModal
          transferRef={printTransferRef}
          onClose={() => setPrintTransferRef(null)}
        />
      )}
      {showPrintJournal && (
        <StockJournalModal
          filters={{
            search: generalSearch,
            startDate,
            endDate,
            depot: selectedDepotName || "",
            type: typeFilter,
          }}
          onClose={() => setShowPrintJournal(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TABLE VIEW COMPONENT (Exact Design of Catalogue & Gestion des Articles)
   ═══════════════════════════════════════════════════════════════════ */

function AuditTableView({ items, loading, locale, onRetry, onPrintTransfer }: any) {
  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <RefreshCw size={32} className="animate-spin mx-auto text-indigo-600 mb-3" />
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">
          {locale === "ar" ? "جاري تدقيق وفحص حركات المخزون..." : "Vérification de l'intégrité des mouvements..."}
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-slate-400">
        <Package size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-sm font-black text-slate-700">
          {locale === "ar" ? "لا توجد حركات مخزون مطابقة" : "Aucun mouvement trouvé"}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {locale === "ar" ? "جرب تعديل شروط البحث أو التصفية" : "Modifiez vos filtres de recherche pour afficher les données."}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-indigo-600 transition-all cursor-pointer shadow-sm"
          >
            {locale === "ar" ? "إعادة تعيين" : "Réinitialiser les filtres"}
          </button>
        )}
      </div>
    );
  }

  return (
    <table className="w-full text-left border-collapse min-w-[700px]">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
          <th className="py-3.5 px-4">{locale === "ar" ? "التاريخ / المدقق" : "Audit Info"}</th>
          <th className="py-3.5 px-4">{locale === "ar" ? "الصنف / المرجع" : "Produit / Réf"}</th>
          <th className="py-3.5 px-4 text-center">{locale === "ar" ? "نوع الحركة" : "Nature"}</th>
          <th className="py-3.5 px-4">{locale === "ar" ? "الوثيقة / الطرف" : "Document & Tiers"}</th>
          <th className="py-3.5 px-4 text-right">{locale === "ar" ? "الرصيد السابق" : "Avant"}</th>
          <th className="py-3.5 px-4 text-right">{locale === "ar" ? "التغيير" : "Variation"}</th>
          <th className="py-3.5 px-4 text-right">{locale === "ar" ? "الرصيد بعد" : "Après"}</th>
          <th className="py-3.5 px-3 text-right">{locale === "ar" ? "إجراءات" : "Actions"}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
        {items.map((item: any) => {
          const delta = Number(item.stock_apres) - Number(item.stock_avant);
          const isIncoming = delta >= 0;
          const isTransfer = item.type?.toLowerCase().includes("transfert");
          const isNegative = Number(item.stock_apres) < 0;

          // Nature badge formatting
          let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
          const tLower = (item.type || "").toLowerCase();
          if (tLower.includes("vente")) {
            badgeColor = "bg-rose-50 text-rose-700 border-rose-200";
          } else if (tLower.includes("achat") || tLower.includes("initiale")) {
            badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
          } else if (tLower.includes("transfert")) {
            badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-200";
          } else if (tLower.includes("ajustement")) {
            badgeColor = isIncoming
              ? "bg-teal-50 text-teal-700 border-teal-200"
              : "bg-amber-50 text-amber-700 border-amber-200";
          }

          return (
            <tr
              key={item.id}
              className={`hover:bg-slate-50/80 transition-colors ${
                isNegative ? "bg-rose-50/30" : ""
              }`}
            >
              {/* Date & User */}
              <td className="py-3.5 px-4">
                <div className="font-mono text-xs font-black text-slate-900">
                  {new Date(item.date_mouvement).toLocaleDateString("fr-FR")}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mt-0.5">
                  <span className="text-indigo-600 font-black">
                    @{item.utilisateur?.[0] || "A"}
                  </span>
                  <span>{item.utilisateur || "Admin"}</span>
                </div>
              </td>

              {/* Product & Reference */}
              <td className="py-3.5 px-4">
                <div className="font-black text-slate-900 text-xs">
                  {item.articles?.designation || "Article"}
                </div>
                <div className="font-mono text-[10px] text-indigo-600 font-bold mt-0.5">
                  {item.articles?.reference || `REF-${item.article_id}`}
                </div>
              </td>

              {/* Nature / Type Badge */}
              <td className="py-3.5 px-4 text-center">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}
                >
                  {isIncoming ? (
                    <ArrowUpRight size={12} className="text-emerald-600" />
                  ) : (
                    <TrendingUp size={12} className="text-rose-600 rotate-180" />
                  )}
                  {item.type}
                </span>
              </td>

              {/* Document & Third-Party */}
              <td className="py-3.5 px-4">
                <span className="font-mono text-xs font-black text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block">
                  {item.nr_doc || "—"}
                </span>
                {item.fournisseur_client && (
                  <span className="block text-[10px] text-slate-400 font-bold mt-0.5 truncate max-w-[130px]">
                    {item.fournisseur_client}
                  </span>
                )}
              </td>

              {/* Stock Avant */}
              <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400 font-bold">
                {Number(item.stock_avant).toFixed(2)}
              </td>

              {/* Variation */}
              <td className="py-3.5 px-4 text-right">
                <span
                  className={`font-mono text-xs font-black ${
                    isIncoming ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {isIncoming ? "+" : ""}
                  {delta.toFixed(2)}
                </span>
              </td>

              {/* Stock Après */}
              <td className="py-3.5 px-4 text-right">
                <span
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black font-mono shadow-xs ${
                    isNegative
                      ? "bg-rose-600 text-white shadow-rose-200"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  {isNegative && <AlertCircle size={12} className="animate-pulse" />}
                  {Number(item.stock_apres).toFixed(2)}
                </span>
              </td>

              {/* Actions */}
              <td className="py-3.5 px-3 text-right">
                {isTransfer ? (
                  <button
                    onClick={() => onPrintTransfer(item.nr_doc)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                    title={locale === "ar" ? "طباعة سند التحويل" : "Imprimer bordereau transfert"}
                  >
                    <Printer size={15} />
                  </button>
                ) : (
                  <span className="text-slate-300 text-xs">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
