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
  Layers
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
  const [depots, setDepots] = useState<{id: number, nom: string}[]>([]);
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
    } catch (err) {}
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
        const { data: ci } = await supabase.from("informations_entreprise").select("*").single();
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
      raw = raw.filter(item => item.type === typeFilter);
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
    const processed = raw.map(m => {
        const key = `${m.article_id}-${m.depot || "default"}`;
        
        const refined = {
            ...m,
            stock_avant: Number(m.stock_avant || 0),
            stock_apres: Number(m.stock_apres || 0)
        };
        
        contextMap[key] = refined.stock_apres;
        return refined;
    });

    // 4. Calculate Stats (Sync with filtered UI View)
    const totalIn = processed.reduce((s, m) => s + Number(m.entree || 0), 0);
    const totalOut = processed.reduce((s, m) => s + Number(m.sortie || 0), 0);
    
    // Estimate selling value of filtered stock
    const articlesMap: Record<string, number> = {};
    processed.forEach(m => {
       const key = `${m.article_id}`;
       articlesMap[key] = Number(m.articles?.p_vente_ttc || 0);
    });
    
    const valuationVal = Object.entries(contextMap).reduce((sum, [key, stock]) => {
       const artId = key.split('-')[0];
       return sum + (stock * (articlesMap[artId] || 0));
    }, 0);

    // 5. Final Display Order (Latest First for the Table)
    const visualOrder = [...processed].reverse();

    // 6. Optional Grouping
    const groups: Record<string, { items: MouvementRecord[], in: number, out: number, current: number }> = {};
    if (groupByProduct) {
        processed.forEach(m => {
            const name = m.articles?.designation || "Inconnu";
            if (!groups[name]) groups[name] = { items: [], in: 0, out: 0, current: 0 };
            groups[name].items.unshift(m); // Latest first in each group
            groups[name].in += Number(m.entree || 0);
            groups[name].out += Number(m.sortie || 0);
            groups[name].current = (m as any).stock_apres; // Last processed is the current for this period
        });
    }

    return {
      filteredData: visualOrder,
      stats: { stockIn: totalIn, stockOut: totalOut, balance: totalIn - totalOut, valuation: valuationVal },
      groupedData: groups
    };
  }, [data, typeFilter, groupByProduct]);

  const handleRefresh = () => {
    fetchData();
    fetchStockValuation();
  };

  const handlePrint = () => setShowPrintJournal(true);
  
  const isFiltered = !!(startDate || endDate || generalSearch || (typeFilter !== "Tous"));
  const stockValuationValue = isFiltered ? stats.valuation : (stockValuation ?? stats.valuation);
  const formattedStockValuation = stockValuationLoading && stockValuation === null && !isFiltered
    ? "..."
    : stockValuationValue.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " F CFA";

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 print:hidden">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[24px] bg-slate-900 flex items-center justify-center shadow-2xl shadow-slate-200">
            <History className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-1">Auditeur de Stock</h1>
            <p className="text-slate-400 text-sm font-bold flex items-center gap-2 uppercase tracking-widest">
              <ShieldCheck size={14} className="text-emerald-500" />
              Journal Maître des Mouvements
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => setGroupByProduct(!groupByProduct)}
            className={`flex items-center gap-2 px-5 py-4 rounded-2xl border text-sm font-black transition-all active:scale-95 ${groupByProduct ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-inner" : "bg-white border-slate-200 text-slate-500 shadow-sm"}`}
          >
            <Layers size={18} />
            {groupByProduct ? "Vue Liste" : "Grouper par Produit"}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-4 rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} size={20} />
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-black text-sm transition-all active:scale-95 shadow-[0_12px_40px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_45px_rgba(79,70,229,0.4)]"
            style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
          >
            <Printer size={20} />
            Générer Rapport d'Audit
          </button>
        </div>
      </div>

      {/* ── KPI Widgets ── */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
         <KPICard 
          title="Entrées" 
          value={stats.stockIn.toFixed(2)} 
          sub="Volume Entrant" 
          color="emerald" 
          icon={ArrowUpRight} 
         />
         <KPICard 
          title="Sorties" 
          value={stats.stockOut.toFixed(2)} 
          sub="Volume Sortant" 
          color="rose" 
          icon={TrendingUp} 
          reverseIcon
         />
         <KPICard 
          title="Variation Nette" 
          value={(stats.balance >= 0 ? "+" : "") + stats.balance.toFixed(2)} 
          sub="Flux Logistique" 
          color="indigo" 
          icon={ArrowUpDown} 
         />
         <KPICard 
          title="Valeur Stock" 
          value={formattedStockValuation} 
          sub="Estimation Financière" 
          color="slate" 
          icon={Sparkles} 
         />
      </div>

      {/* ── Auditor Control Panel ── */}
      <div className="bg-white/70 backdrop-blur-2xl rounded-[32px] border border-white/60 shadow-2xl shadow-indigo-100/20 p-6 space-y-6 print:hidden">
        <div className="flex flex-col xl:flex-row items-center gap-4">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Rechercher par document, article, fournisseur..."
              value={generalSearch}
              onChange={(e) => setGeneralSearch(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-100 rounded-[20px] py-4 pl-14 pr-6 text-sm font-bold text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 focus:bg-white transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full xl:w-auto">
             <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-3 px-6 py-4 rounded-[20px] border text-sm font-black transition-all ${showFilters ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-600 hover:bg-slate-50"}`}
            >
              <Filter size={18} />
              {showFilters ? "Cacher Filtres" : "Affiner la recherche"}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 animate-in slide-in-from-top-4 duration-500">
            <FilterField label="Début" icon={CalendarIcon}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-transparent outline-none font-bold text-slate-700" />
            </FilterField>
            <FilterField label="Fin" icon={CalendarIcon}>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-transparent outline-none font-bold text-slate-700" />
            </FilterField>
            <FilterField label="Mouvement" icon={Activity}>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full bg-transparent outline-none font-bold text-slate-700 appearance-none">
                <option value="Tous">Tous Types</option>
                <option value="VENTE">Ventes</option>
                <option value="achat">Achats</option>
                <option value="ENTRÉE INITIALE">Entrée Initiale</option>
                <option value="transfert_entree">Transferts (In)</option>
                <option value="transfert_sortie">Transferts (Out)</option>
                <option value="ajustement_entree">Ajustements (+)</option>
                <option value="ajustement_sortie">Ajustements (-)</option>
                <option value="retour">Retours</option>
              </select>
            </FilterField>
            <FilterField label="Dépôt" icon={MapPin}>
              <select value={selectedDepotName} onChange={(e) => setSelectedDepotName(e.target.value)} className="w-full bg-transparent outline-none font-bold text-slate-700 appearance-none">
                <option value="">Tous les Dépôts</option>
                {depots.map(d => <option key={d.id} value={d.nom}>{d.nom}</option>)}
              </select>
            </FilterField>
          </div>
        )}
      </div>

      {/* ── Ledger Table ── */}
      <div className="bg-white/80 backdrop-blur-3xl rounded-[40px] border border-white shadow-2xl shadow-slate-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          {groupByProduct ? (
             <div className="p-8 space-y-12">
                {Object.entries(groupedData).map(([product, g]) => (
                    <div key={product} className="space-y-4 bg-slate-50/30 p-6 rounded-[32px] border border-slate-100">
                        <div className="flex flex-col md:flex-row md:items-center gap-4 pb-4 border-b border-white">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">{product}</h3>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.items[0]?.articles?.reference}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 md:ml-auto">
                                <div className="px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm text-center">
                                    <span className="block text-[9px] font-black text-slate-400 uppercase">Total Entrées</span>
                                    <span className="text-sm font-black text-emerald-600">+{g.in.toFixed(2)}</span>
                                </div>
                                <div className="px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm text-center">
                                    <span className="block text-[9px] font-black text-slate-400 uppercase">Total Sorties</span>
                                    <span className="text-sm font-black text-rose-600">-{g.out.toFixed(2)}</span>
                                </div>
                                <div className="px-4 py-2 bg-slate-900 rounded-xl shadow-lg text-center min-w-[100px]">
                                    <span className="block text-[9px] font-black text-slate-400 uppercase">Stock Final</span>
                                    <span className="text-sm font-black text-white">{g.current.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                        <AuditTable items={g.items} onPrintTransfer={setPrintTransferRef} />
                    </div>
                ))}
             </div>
          ) : (
            <AuditTable 
                items={loading ? [] : filteredData} 
                loading={loading}
                fetchData={fetchData} 
                onPrintTransfer={setPrintTransferRef} 
            />
          )}
        </div>
        
        {/* Footer info */}
        <div className="px-10 py-6 bg-slate-50/50 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
          <div className="flex items-center gap-3">
             <ShieldCheck size={16} className="text-emerald-500" />
             Système Certifié Logistique Excellence
          </div>
          <div className="bg-white px-4 py-2 rounded-full border border-slate-200">
            {filteredData.length} Lignes d&apos;audit affichées
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {printTransferRef && (
        <StockTransferModal 
          transferRef={printTransferRef} 
          onClose={() => setPrintTransferRef(null)} 
        />
      )}
      {showPrintJournal && (
        <StockJournalModal 
          filters={{ search: generalSearch, startDate, endDate, depot: selectedDepotName || "", type: typeFilter }}
          onClose={() => setShowPrintJournal(false)}
        />
      )}

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function AuditTable({ items, loading, fetchData, onPrintTransfer }: any) {
    return (
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] custom-scrollbar">
            <table className="w-full text-left relative">
                <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-md shadow-sm">
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                    <HeaderCell label="Audit Info" />
                    <HeaderCell label="Produit / Réf" />
                    <HeaderCell label="Nature" />
                    <HeaderCell label="Document" />
                    <HeaderCell label="Avant" className="text-right" />
                    <HeaderCell label="Variation" className="text-right" />
                    <HeaderCell label="Après" className="text-right" />
                    <HeaderCell label="" />
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {loading ? (
                    <LoadingState />
                ) : items.length === 0 ? (
                    <EmptyState onRetry={fetchData} />
                ) : (
                    items.map((item: any) => (
                        <LedgerRow 
                            key={item.id} 
                            item={item} 
                            onPrintTransfer={() => onPrintTransfer(item.nr_doc)} 
                        />
                    ))
                )}
            </tbody>
        </table>
        </div>
    );
}

function KPICard({ title, value, sub, color, icon: Icon, reverseIcon = false }: any) {
  const colors: any = {
    emerald: "from-emerald-500 to-teal-600 shadow-emerald-200/50",
    rose: "from-rose-500 to-pink-600 shadow-rose-200/50",
    indigo: "from-indigo-600 to-blue-700 shadow-indigo-200/50",
    slate: "from-slate-700 to-slate-900 shadow-slate-200/50"
  };

  return (
    <div className={`relative overflow-hidden p-8 rounded-[32px] bg-gradient-to-br ${colors[color]} text-white shadow-2xl transition-all hover:scale-[1.02] cursor-default`}>
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
           <Icon size={24} className={reverseIcon ? "rotate-180" : ""} />
        </div>
        <ArrowUpRight size={20} className="opacity-40" />
      </div>
      <div className="text-sm font-black uppercase tracking-widest opacity-80 mb-1">{title}</div>
      <div className="text-4xl font-black tracking-tighter mb-2">{value}</div>
      <div className="text-[11px] font-bold opacity-70 uppercase tracking-widest">{sub}</div>
    </div>
  );
}

function FilterField({ label, icon: Icon, children }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm focus-within:border-indigo-200 transition-all">
        <Icon size={16} className="text-slate-300" />
        {children}
      </div>
    </div>
  );
}

function HeaderCell({ label, className = "" }: any) {
  return (
    <th className={`px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ${className}`}>
      {label}
    </th>
  );
}

function LedgerRow({ item, onPrintTransfer }: { item: MouvementRecord, onPrintTransfer: () => void }) {
  const delta = Number(item.stock_apres) - Number(item.stock_avant);
  const isIncoming = delta >= 0;
  const isTransfer = item.type?.toLowerCase().includes("transfert");
  const isNegative = Number(item.stock_apres) < 0;

  return (
    <tr className={`group transition-all duration-300 ${isNegative ? "bg-rose-50/30 hover:bg-rose-50/50" : "hover:bg-slate-50/50"}`}>
      <td className="px-10 py-6">
        <div className="flex flex-col">
          <span className="text-sm font-black text-slate-800 tracking-tight">
            {new Date(item.date_mouvement).toLocaleDateString("fr-FR")}
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
             <span className="text-indigo-500">@{item.utilisateur?.[0] || "S"}</span> {item.utilisateur || "Système"}
          </span>
        </div>
      </td>
      <td className="px-10 py-6">
        <div className="flex flex-col">
          <span className="text-sm font-black text-slate-800 leading-tight">{item.articles?.designation || "Inconnu"}</span>
          <code className="text-[10px] text-slate-400 font-bold bg-slate-100/80 px-1.5 py-0.5 rounded mt-1 w-fit">{item.articles?.reference}</code>
        </div>
      </td>
      <td className="px-10 py-6">
         <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isIncoming ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"}`}>
            {isIncoming ? <ArrowUpRight size={12} /> : <TrendingUp size={12} className="rotate-180" />}
            {item.type}
         </span>
      </td>
      <td className="px-10 py-6">
         <span className="text-[11px] font-black text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
            {item.nr_doc}
         </span>
         {item.fournisseur_client && (
           <span className="block text-[9px] text-slate-400 font-bold mt-1.5 uppercase truncate max-w-[100px]">{item.fournisseur_client}</span>
         )}
      </td>
      <td className="px-10 py-6 text-right">
         <span className="text-xs font-bold text-slate-400 tabular-nums">{Number(item.stock_avant).toFixed(2)}</span>
      </td>
      <td className="px-10 py-6 text-right">
         <div className={`text-sm font-black tabular-nums ${isIncoming ? "text-emerald-600" : "text-rose-600"}`}>
           {isIncoming ? "+" : ""}{delta.toFixed(2)}
         </div>
      </td>
      <td className="px-10 py-6 text-right">
         <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black tabular-nums shadow-lg ${isNegative ? "bg-rose-600 text-white shadow-rose-200" : "bg-slate-900 text-white shadow-slate-200"}`}>
           {isNegative && <AlertCircle size={14} className="animate-pulse" />}
           {Number(item.stock_apres).toFixed(2)}
         </div>
      </td>
      <td className="px-10 py-6 text-right">
        {isTransfer && (
          <button 
            onClick={onPrintTransfer}
            className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-white hover:shadow-xl rounded-2xl transition-all active:scale-90"
            title="Imprimer Document"
          >
            <Printer size={18} />
          </button>
        )}
      </td>
    </tr>
  );
}

function LoadingState() {
  return (
    <tr>
      <td colSpan={8} className="py-32 text-center">
        <RefreshCw className="animate-spin inline-block text-indigo-500 mb-4" size={32} />
        <p className="text-slate-400 font-bold tracking-widest uppercase text-xs">Vérification de l'intégrité des données...</p>
      </td>
    </tr>
  );
}

function EmptyState({ onRetry }: any) {
  return (
    <tr>
      <td colSpan={8} className="py-32 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center">
            <Package size={40} className="text-slate-200" />
          </div>
          <div>
            <p className="text-slate-900 font-black text-xl">Aucune trace d'audit</p>
            <p className="text-slate-400 text-sm font-medium mt-1">Les critères sélectionnés ne correspondent à aucun mouvement.</p>
          </div>
          <button
            onClick={onRetry}
            className="mt-2 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200"
          >
            Réinitialiser la vue
          </button>
        </div>
      </td>
    </tr>
  );
}
