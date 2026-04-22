"use client";

import { useEffect, useState } from "react";
import { 
  Package, 
  RefreshCw, 
  CheckCircle2, 
  MapPin, 
  Truck, 
  AlertCircle,
  ArrowRight,
  Clock
} from "lucide-react";
import StockTransferModal from "../../mouvements/StockTransferModal";

type Transit = {
  id: number;
  reference: string;
  source_depot: string;
  dest_depot: string;
  date_expedition: string;
  date_reception: string | null;
  status: string;
  details: any[];
  created_by: string;
  received_by?: string | null;
  notes: string;
};

export default function TransitPage() {
  const [data, setData] = useState<Transit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [printTransferRef, setPrintTransferRef] = useState<string | null>(null);

  const [depotFilter, setDepotFilter] = useState("Tous");
  const [depots, setDepots] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState("Tous");

  useEffect(() => {
    fetchDepots();
  }, []);

  const fetchDepots = async () => {
    try {
      const res = await fetch("/api/stock/depots");
      const data = await res.json();
      if (Array.isArray(data)) {
        const names = data.map((d: any) => d.nom || d.nom_depot || d).filter(Boolean);
        setDepots(names);
      }
    } catch (err) {}
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/stock/transits", window.location.origin);
      url.searchParams.set("t", new Date().getTime().toString()); // Cache bust
      if (depotFilter !== "Tous") url.searchParams.set("depot", depotFilter);
      if (statusFilter !== "Tous") url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de chargement");
      setData(Array.isArray(json) ? json : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [depotFilter, statusFilter]);

  const handleReceive = async (transitId: number) => {
    if (!confirm("Confirmer la réception physique de cette marchandise dans ce dépôt ?")) return;
    
    setProcessingId(transitId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "receive", transit_id: transitId })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur lors de la réception");

      setSuccess("Marchandise réceptionnée et stock mis à jour !");
      if (result.reference) setPrintTransferRef(result.reference);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header Container */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Truck size={32} className="text-white" />
           </div>
           <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight">Suivi des Expéditions</h1>
             <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Transits Inter-dépôts</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 px-3 border-r border-slate-100">
            <MapPin size={16} className="text-indigo-500" />
            <select value={depotFilter} onChange={(e) => setDepotFilter(e.target.value)} className="bg-transparent font-bold text-sm text-slate-700 outline-none pr-4 cursor-pointer">
               <option value="Tous">Tous Dépôts</option>
               {depots.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 px-3">
             <Clock size={16} className="text-slate-400" />
             <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent font-bold text-sm text-slate-700 outline-none pr-4 cursor-pointer">
               <option value="Tous">Tous Statuts</option>
               <option value="En Transit">En Transit</option>
               <option value="Reçu">Reçu</option>
             </select>
          </div>
          <button onClick={fetchData} className="p-3 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl font-bold shadow-sm">
          <AlertCircle size={20} /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl font-bold shadow-sm">
          <CheckCircle2 size={20} /> {success}
        </div>
      )}

      {/* Transit Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {loading ? (
           <div className="col-span-full py-20 flex justify-center">
             <RefreshCw className="animate-spin text-indigo-500 opacity-50" size={40} />
           </div>
         ) : data.length === 0 ? (
           <div className="col-span-full py-20 text-center flex flex-col items-center justify-center opacity-40">
             <Package size={60} className="mb-4 text-slate-400" />
             <p className="text-2xl font-black text-slate-900">Aucun Transit</p>
             <p className="text-sm font-bold text-slate-500 mt-2">Changez vos filtres ou effectuez un nouveau transfert.</p>
           </div>
         ) : (
           data.map((tr) => {
             const inTransit = tr.status === "En Transit";
             return (
               <div key={tr.id} className={`relative p-6 rounded-[32px] border transition-all duration-300 shadow-xl ${inTransit ? 'bg-white border-indigo-100 hover:shadow-indigo-500/10 hover:-translate-y-1' : 'bg-slate-50 border-emerald-100 opacity-80'}`}>
                 
                 {/* Status Badge */}
                 <div className="flex justify-between items-start mb-6">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${inTransit ? 'bg-amber-100 text-amber-700 shadow-sm shadow-amber-200/50' : 'bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-200/50'}`}>
                      {tr.status}
                    </span>
                    <span className="text-xs font-black text-slate-400">{tr.reference}</span>
                 </div>

                 {/* Route */}
                 <div className="flex items-center justify-between mb-8 px-2">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center mb-2 z-10">
                         <span className="text-xs font-black text-slate-600 truncate max-w-[40px] text-center">{(tr.source_depot || "").substring(0,3)}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tr.source_depot || "Inconnu"}</span>
                    </div>

                    <div className="flex-1 relative flex items-center justify-center">
                      <div className="absolute w-full h-[2px] bg-slate-100 top-1/2 -translate-y-1/2 rounded-full -z-10"></div>
                      <div className="absolute w-1/2 h-[2px] bg-indigo-500 top-1/2 -translate-y-1/2 rounded-full -z-10 left-0" style={{ opacity: inTransit ? 1 : 0.2 }}></div>
                      <div className={`p-2 rounded-full shadow-sm text-white ${inTransit ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}>
                        {inTransit ? <Truck size={14} /> : <CheckCircle2 size={14} />}
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center mb-2 z-10">
                         <span className="text-xs font-black text-slate-600 truncate max-w-[40px] text-center">{(tr.dest_depot || "").substring(0,3)}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tr.dest_depot || "Inconnu"}</span>
                    </div>
                 </div>

                 {/* Items summary */}
                 <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                     <Package size={12} /> Contenu ({tr.details?.length || 0} articles)
                   </p>
                   <div className="space-y-2 max-h-24 overflow-y-auto no-scrollbar">
                     {tr.details?.map((d: any, i: number) => (
                       <div key={i} className="flex justify-between items-center text-sm font-bold text-slate-700">
                         <span className="truncate pr-2">{d.designation || "Article sans nom"}</span>
                         <span className="bg-white px-2 py-0.5 rounded shadow-sm text-indigo-600">x{d.qty || 0}</span>
                       </div>
                     ))}
                   </div>
                 </div>

                 {/* Footer Info / Action */}
                 <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Opérateur</p>
                      <p className="text-sm font-black text-slate-800">@{tr.created_by}</p>
                    </div>
                    {inTransit ? (
                      <button 
                        onClick={() => handleReceive(tr.id)}
                        disabled={processingId === tr.id}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 hover:shadow-lg transition-all active:scale-95 disabled:opacity-50"
                      >
                         {processingId === tr.id ? <RefreshCw className="animate-spin" size={16} /> : "Recevoir"}
                      </button>
                    ) : (
                      <div className="text-right">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Reçu par</p>
                        <p className="text-sm font-black text-emerald-600">@{tr.received_by}</p>
                      </div>
                    )}
                 </div>
               </div>
             );
           })
         )}
      </div>

      {printTransferRef && (
        <StockTransferModal
          transferRef={printTransferRef}
          onClose={() => setPrintTransferRef(null)}
        />
      )}

    </div>
  );
}
