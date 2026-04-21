"use client";

import { useEffect, useState } from "react";
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
  ClipboardCheck
} from "lucide-react";
import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
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
  stocks?: { quantite: number; depot_id: number; depot_nom: string }[];
};

export default function StockDashboard() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeDepotId, setActiveDepotId] = useState<number | null>(null);
  const [activeDepotNom, setActiveDepotNom] = useState("Tous");
  const [stats, setStats] = useState({ total: 0, low: 0, out: 0 });
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [printTransferRef, setPrintTransferRef] = useState<string | null>(null);

  const fetchStock = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stock?search=${searchTerm}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Erreur de chargement du stock.");
      }
      if (Array.isArray(data.items)) {
        setItems(data.items);
        setActiveDepotId(data.depot_id || null);
        setActiveDepotNom(data.depot_nom || "Tous");
        
        const low = data.items.filter((i: any) => i.is_low).length;
        const out = data.items.filter((i: any) => i.is_out).length;
        setStats({ total: data.items.length, low, out });
      }
    } catch (error) {
      console.error("Error fetching stock:", error);
      setError(error instanceof Error ? error.message : "Erreur de chargement du stock.");
      setItems([]);
      setStats({ total: 0, low: 0, out: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchStock(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8 space-y-8 font-sans">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-200">
               <Package className="w-8 h-8 text-white" />
            </div>
            Gestion du Stock
          </h1>
          <p className="text-slate-500 mt-1 font-medium italic">
            Suivi en temps réel pour le dépôt : <span className="text-emerald-600 font-bold underline">{activeDepotNom}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
           <Link href="/dashboard/stock/reconciliation" className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200">
             <ClipboardCheck className="w-5 h-5" />
             Jerd الدوري
           </Link>
           <Link href="/dashboard/mouvements" className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all font-bold shadow-sm">
             <History className="w-5 h-5 text-slate-400" />
             Journal d'Audit
           </Link>
           <button 
             onClick={fetchStock}
             className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm"
           >
             <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      {/* ── STATS CARDS ── */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Total Articles" 
          value={stats.total} 
          icon={<Box className="w-6 h-6 text-indigo-600" />} 
          color="indigo" 
        />
        <StatCard 
          label="Alerte Stock Bas" 
          value={stats.low} 
          icon={<AlertTriangle className="w-6 h-6 text-amber-500" />} 
          color="amber"
          isPulse={stats.low > 0}
        />
        <StatCard 
          label="Rupture de Stock" 
          value={stats.out} 
          icon={<AlertCircle className="w-6 h-6 text-rose-500" />} 
          color="rose"
          isPulse={stats.out > 0}
        />
      </div>

      {/* ── FILTERS & SEARCH ── */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Rechercher par référence ou désignation..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-transparent border focus:border-emerald-200 focus:bg-white rounded-2xl outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsAddOpen(true)}
          className="px-6 py-4 bg-slate-900 text-white rounded-2xl flex items-center gap-2 font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
        >
           <Plus className="w-5 h-5" />
           Nouvel Article
        </button>
      </div>

      {/* ── ITEMS GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
           {[...Array(8)].map((_, i) => (
             <div key={i} className="h-64 bg-slate-200 rounded-3xl" />
           ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <ArticleStockCard 
              key={item.id} 
              item={item} 
              onAdjust={() => handleAdjust(item)}
              onTransfer={() => handleTransfer(item)}
            />
          ))}

          {items.length === 0 && (
            <div className="col-span-full py-20 text-center">
               <div className="inline-flex p-6 bg-slate-100 rounded-full mb-4">
                  <PackageSearch className="w-12 h-12 text-slate-300" />
               </div>
               <h3 className="text-xl font-bold text-slate-400">Aucun produit trouvé</h3>
               <p className="text-slate-400">Essayez de changer vos filtres ou termes de recherche.</p>
            </div>
          )}
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

function StatCard({ label, value, icon, color, isPulse = false }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    rose: "bg-rose-50 border-rose-100 text-rose-700"
  };

  return (
    <div className={`p-6 rounded-[2rem] border bg-white shadow-sm flex items-center gap-5 transition-transform hover:scale-[1.02]`}>
      <div className={`p-4 rounded-2xl ${colors[color]} relative`}>
        {icon}
        {isPulse && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${color === 'rose' ? 'bg-rose-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-4 w-4 ${color === 'rose' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
          </span>
        )}
      </div>
      <div>
        <h4 className="text-slate-500 font-bold text-sm uppercase tracking-wider">{label}</h4>
        <div className="text-3xl font-black text-slate-900 mt-1">{value}</div>
      </div>
    </div>
  );
}

function ArticleStockCard({ item, onAdjust, onTransfer }: { item: StockItem, onAdjust: () => void, onTransfer: () => void }) {
  return (
    <div className="group relative bg-white border border-slate-100 rounded-[2.5rem] p-5 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
      
      {/* Alert Ribbon */}
      {(item.is_low || item.is_out) && (
        <div className={`absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm ${item.is_out ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'}`}>
           {item.is_out ? 'Rupture' : 'Stock Bas'}
        </div>
      )}

      {/* Image / Icon */}
      <div className="relative aspect-square mb-4 rounded-3xl bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-50 group-hover:bg-white transition-colors">
         {item.image_path ? (
           <img src={item.image_path} alt={item.designation} className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" />
         ) : (
           <Package className="w-16 h-16 text-slate-200 group-hover:text-slate-300 transition-colors" />
         )}
         
         {/* Glass Overlay on Hover */}
         <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px] flex items-center justify-center gap-3">
            <button 
              onClick={onAdjust}
              className="p-3 bg-white text-indigo-600 rounded-2xl hover:bg-indigo-50 transition-all flex items-center gap-2 font-black text-sm uppercase"
            >
               Ajuster <ChevronRight className="w-4 h-4" />
            </button>
         </div>
      </div>

      {/* Info */}
      <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.reference}</p>
        <h3 className="text-lg font-extrabold text-slate-800 leading-tight line-clamp-2 min-h-[3rem] group-hover:text-indigo-600 transition-colors">
          {item.designation}
        </h3>
      </div>

      {/* Qty Section */}
      <div className="mt-4 pt-4 border-t border-slate-50 flex items-end justify-between">
         <div className="max-w-[120px]">
            <span className="text-slate-400 text-[10px] font-bold uppercase block mb-1">Disponible</span>
            <div className="flex items-baseline gap-2">
               <span className={`text-4xl font-black tracking-tighter truncate ${item.is_out ? 'text-rose-600' : item.is_low ? 'text-amber-600' : 'text-slate-900'}`}>
                 {item.quantite}
               </span>
               <span className="text-xs font-bold text-slate-400">{item.unite}</span>
            </div>
         </div>
         
         <div className="flex flex-col gap-2">
            <button 
              onClick={onTransfer}
              className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
              title="Transférer"
            >
               <ArrowRightLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={onAdjust}
              className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all shadow-sm"
              title="Entrée Rapide"
            >
               <Plus className="w-5 h-5" />
            </button>
         </div>
      </div>
      
    </div>
  );
}

function ChevronRight(props: any) {
  return <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
}
function AlertCircle(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function PackageSearch(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>
}
