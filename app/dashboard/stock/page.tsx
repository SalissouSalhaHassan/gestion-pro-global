"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Package, 
  Search, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRightLeft, 
  History, 
  Plus, 
  ChevronDown,
  LayoutGrid,
  List as ListIcon,
  ShoppingBag,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Box,
  ClipboardCheck,
  ClipboardList,
  Layers,
  Ruler,
  AlertCircle,
  Building2,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  FileSpreadsheet,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { AdjustmentModal, TransferModal, AddArticleModal } from "./StockModals";
import StockTransferModal from "../mouvements/StockTransferModal";

type StockItem = {
  id: number;
  reference: string;
  designation: string;
  qte_min: number;
  unite: string;
  image_path: string | null;
  quantite: number;
  is_low: boolean;
  is_out: boolean;
  p_vente_ttc?: number;
  p_achat_ht?: number;
  stocks?: { quantite: number; depot_id: number; depot_nom: string }[];
};

export default function StockDashboard() {
  const { t, locale } = useLanguage();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDepotId, setActiveDepotId] = useState<number | null>(null);
  const [activeDepotNom, setActiveDepotNom] = useState("Tous");
  const [selectedFilterDepot, setSelectedFilterDepot] = useState("Tous");
  const [allowedDepots, setAllowedDepots] = useState<string[]>([]);
  const [userRole, setUserRole] = useState("vendeur");
  const [stockStatusFilter, setStockStatusFilter] = useState<"ALL" | "OK" | "LOW" | "OUT">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Modal States
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [printTransferRef, setPrintTransferRef] = useState<string | null>(null);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set("search", searchTerm);
      if (selectedFilterDepot && selectedFilterDepot !== "Tous") {
        queryParams.set("depot", selectedFilterDepot);
      }
      const res = await fetch(`/api/stock?${queryParams.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Erreur de chargement du stock.");
      }
      if (Array.isArray(data.items)) {
        setItems(data.items);
        setActiveDepotId(data.depot_id || null);
        setActiveDepotNom(data.depot_nom || "Tous");
        
        if (data.allowedDepots) setAllowedDepots(data.allowedDepots);
        if (data.role) setUserRole(data.role);
      }
    } catch (error) {
      console.error("Error fetching stock:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchStock(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedFilterDepot]);

  const handleAdjust = (item: StockItem) => {
    setSelectedItem(item);
    setIsAdjustOpen(true);
  };

  const handleTransfer = (item: StockItem) => {
    setSelectedItem(item);
    setIsTransferOpen(true);
  };

  const handleTransferSuccess = (transferRef?: string) => {
    fetchStock();
    if (transferRef) {
      setPrintTransferRef(transferRef);
    }
  };

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (stockStatusFilter === "LOW" && !item.is_low) return false;
      if (stockStatusFilter === "OUT" && !item.is_out) return false;
      if (stockStatusFilter === "OK" && (item.is_low || item.is_out)) return false;
      return true;
    });
  }, [items, stockStatusFilter]);

  // Executive KPI Calculations
  const totalArticlesCount = items.length;
  const totalPhysicalUnits = items.reduce((sum, item) => sum + (Number(item.quantite) || 0), 0);
  const lowStockCount = items.filter((i) => i.is_low && !i.is_out).length;
  const outOfStockCount = items.filter((i) => i.is_out).length;
  const totalValuation = items.reduce((sum, item) => {
    const unitPrice = item.p_achat_ht || (item.p_vente_ttc ? item.p_vente_ttc * 0.75 : 0);
    return sum + (Number(item.quantite) || 0) * unitPrice;
  }, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ── 4K EXECUTIVE HERO HEADER ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Package size={14} />
                REAL-TIME STOCK HUB 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                {locale === "ar" ? "المستودع النشط:" : "Dépôt Actif:"} <strong className="text-white">{activeDepotNom}</strong>
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "إدارة ومراقبة المخزون اللحظي" : "Gestion & Suivi du Stock en Temps Réel"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "تتبع دقيق لحركة البضائع، الجرد الدوري الذكي، التنبيهات المبكرة للنفاذ، وإدارة التحويلات"
                : "Suivi physique, valorisation, gestion des transferts inter-dépôts et rapprochement de jerd"}
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/dashboard/stock/reconciliation"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/25 transition-all border border-indigo-400/30"
            >
              <ClipboardCheck size={15} />
              <span>{locale === "ar" ? "الجرد الدوري (Jerd)" : "Jerd الدوري"}</span>
            </Link>

            <Link
              href="/dashboard/stock/journal"
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/25 transition-all border border-emerald-400/30"
            >
              <ClipboardList size={15} />
              <span>{locale === "ar" ? "اليومية وسجل الحركات" : "Journal Quotidien"}</span>
            </Link>

            <Link
              href="/dashboard/stock/categories"
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all"
            >
              <Layers size={14} className="text-indigo-400" />
              <span>{locale === "ar" ? "الفئات" : "Catégories"}</span>
            </Link>

            <Link
              href="/dashboard/stock/units"
              className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all"
            >
              <Ruler size={14} className="text-emerald-400" />
              <span>{locale === "ar" ? "الوحدات" : "Unités"}</span>
            </Link>

            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-950 hover:bg-slate-100 rounded-2xl text-xs font-black shadow-xl transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>{locale === "ar" ? "إضافة صنف" : "Nouvel Article"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 EXECUTIVE FINANCIAL & STOCK KPIS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الأصناف والقطع" : "Total Articles & Unités"}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Box size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{totalArticlesCount}</div>
          <div className="text-xs text-indigo-600 font-bold mt-1.5 flex items-center gap-1">
            <Layers size={13} />
            <span>{totalPhysicalUnits} {locale === "ar" ? "وحدة فعلية متوفرة" : "unités physiques en stock"}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "تنبيه اقتراب النفاذ" : "Alerte Stock Bas"}
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">{lowStockCount}</div>
          <div className="text-xs text-slate-500 font-bold mt-1.5">
            {locale === "ar" ? "أصناف تتطلب إعادة التموين" : "articles proches du seuil minimal"}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "أصناف نفدت بالكامل" : "Rupture de Stock"}
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">{outOfStockCount}</div>
          <div className="text-xs text-slate-500 font-bold mt-1.5">
            {locale === "ar" ? "أصناف رصيدها صفر 0" : "articles en rupture totale"}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "التقييم المالي التقديري" : "Valeur Estimée"}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">{formatCurrencyAmount(totalValuation)}</div>
          <div className="text-xs text-slate-500 font-bold mt-1.5">
            {locale === "ar" ? "قيمة المخزون الحالي" : "Valorisation globale du stock"}
          </div>
        </div>
      </div>

      {/* ── TOOLBAR & FILTERS ── */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              locale === "ar"
                ? "بحث برقم المرجع، الاسم، أو الباركود..."
                : "Rechercher par référence, désignation, code-barres..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1 overflow-x-auto">
          <button
            onClick={() => setStockStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              stockStatusFilter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {locale === "ar" ? "الكل" : "Tous"} ({items.length})
          </button>
          <button
            onClick={() => setStockStatusFilter("OK")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              stockStatusFilter === "OK" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {locale === "ar" ? "متوفر" : "En Stock"}
          </button>
          <button
            onClick={() => setStockStatusFilter("LOW")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              stockStatusFilter === "LOW" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {locale === "ar" ? "منخفض" : "Stock Bas"} ({lowStockCount})
          </button>
          <button
            onClick={() => setStockStatusFilter("OUT")}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              stockStatusFilter === "OUT" ? "bg-white text-rose-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {locale === "ar" ? "نافد" : "Rupture"} ({outOfStockCount})
          </button>
        </div>

        {/* Depot Selector & View Toggle */}
        <div className="flex items-center gap-3">
          {(userRole === "admin" || allowedDepots.length > 1) && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
              <Building2 size={14} className="text-slate-400" />
              <select
                value={selectedFilterDepot}
                onChange={(e) => setSelectedFilterDepot(e.target.value)}
                className="bg-transparent border-none text-slate-800 font-bold focus:outline-none text-xs cursor-pointer"
              >
                <option value="Tous">Tous les dépôts</option>
                {allowedDepots.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vue Grille 4K"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                viewMode === "table" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vue Tableau Détaillé"
            >
              <ListIcon size={16} />
            </button>
          </div>

          <button
            onClick={fetchStock}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Actualiser"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT: 4K GRID OR DETAILED TABLE ── */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {loading ? (
            [...Array(8)].map((_, i) => (
              <div key={i} className="h-72 bg-slate-100 rounded-3xl animate-pulse" />
            ))
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-200/80 p-8">
              <Package size={48} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-black text-slate-700">
                {locale === "ar" ? "لا توجد بضائع مطابقة" : "Aucun article correspondant"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {locale === "ar" ? "قم بتعديل خيارات البحث أو المستودع" : "Modifiez vos filtres de recherche"}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const progress = Math.min(100, Math.max(10, (item.quantite / (item.qte_min || 10)) * 50));

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-xl transition-all flex flex-col justify-between space-y-4 group relative overflow-hidden"
                >
                  {/* Badge */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-xl">
                      {item.reference}
                    </span>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        item.is_out
                          ? "bg-rose-100 text-rose-700"
                          : item.is_low
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {item.is_out ? "Rupture" : item.is_low ? "Stock Faible" : "Disponible"}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                      {item.designation}
                    </h3>
                    <div className="text-[11px] text-slate-400 font-bold mt-1">
                      Seuil Min : <span className="text-slate-700">{item.qte_min || 5} {item.unite || "unités"}</span>
                    </div>
                  </div>

                  {/* Stock Quantity Gauge */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Stock Physique</span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-black tracking-tight ${
                            item.is_out
                              ? "text-rose-600"
                              : item.is_low
                              ? "text-amber-600"
                              : "text-slate-900"
                          }`}
                        >
                          {item.quantite}
                        </span>
                        <span className="text-xs font-bold text-slate-400">{item.unite || "U"}</span>
                      </div>
                    </div>

                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.is_out
                            ? "bg-rose-500"
                            : item.is_low
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleAdjust(item)}
                      className="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus size={14} />
                      <span>{locale === "ar" ? "تعديل" : "Ajuster"}</span>
                    </button>

                    <button
                      onClick={() => handleTransfer(item)}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRightLeft size={14} />
                      <span>{locale === "ar" ? "تحويل" : "Transférer"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Detailed Table View */
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{locale === "ar" ? "المرجع" : "Référence"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "اسم الصنف" : "Désignation"}</th>
                  <th className="py-3.5 px-4 text-center">{locale === "ar" ? "الحد الأدنى" : "Seuil Min"}</th>
                  <th className="py-3.5 px-4 text-center">{locale === "ar" ? "الرصيد الفعلي" : "Stock Actuel"}</th>
                  <th className="py-3.5 px-4 text-center">{locale === "ar" ? "الحالة" : "État"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "إجراءات فورية" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-600 text-xs">
                      {item.reference}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">{item.designation}</td>
                    <td className="py-3.5 px-4 text-center text-xs text-slate-400">
                      {item.qte_min || 5} {item.unite || "U"}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-black text-slate-900 text-base">{item.quantite}</span>{" "}
                      <span className="text-xs text-slate-400">{item.unite || "U"}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                          item.is_out
                            ? "bg-rose-100 text-rose-700"
                            : item.is_low
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {item.is_out ? "Rupture" : item.is_low ? "Stock Faible" : "Disponible"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleAdjust(item)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-black transition-colors cursor-pointer"
                        >
                          Ajuster
                        </button>
                        <button
                          onClick={() => handleTransfer(item)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors cursor-pointer"
                        >
                          Transférer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      <AdjustmentModal 
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        item={selectedItem}
        depotId={activeDepotId}
        depotNom={activeDepotNom}
        onSuccess={fetchStock}
      />
      <TransferModal 
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        item={selectedItem}
        sourceDepotId={activeDepotId}
        sourceDepotNom={activeDepotNom}
        onSuccess={handleTransferSuccess}
      />
      <AddArticleModal 
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={fetchStock}
        currentDepotId={activeDepotId}
        currentDepotNom={activeDepotNom}
      />
      {printTransferRef && (
        <StockTransferModal
          transferRef={printTransferRef}
          onClose={() => setPrintTransferRef(null)}
        />
      )}
    </div>
  );
}
