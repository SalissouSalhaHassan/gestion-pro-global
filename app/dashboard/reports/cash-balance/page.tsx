"use client";

import { useState, useEffect } from "react";
import { 
  Scale, 
  Calendar, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  FileText,
  User,
  MapPin,
  Download,
  Database,
  Printer
} from "lucide-react";

import CashBalanceModal from "./CashBalanceModal";

export default function CashBalancePage() {
  const [data, setData] = useState<{
    summary: { totalIncome: number; totalExpenses: number; netBalance: number };
    entries: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [filters, setFilters] = useState({ 
    start: new Date().toISOString().split("T")[0], 
    end: new Date().toISOString().split("T")[0], 
    cashier: "Tous",
    type: "Tous"
  });

  const [userSession, setUserSession] = useState<any>(null);

  useEffect(() => {
    const cookie = document.cookie.split('; ').find(row => row.startsWith('gp_session='));
    if (cookie) {
      try {
        const session = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        setUserSession(session);
        const isAdmin = session?.admin === "Oui" || session?.role === 1 || session?.role === "1";
        if (!isAdmin) {
          setFilters(f => ({ ...f, cashier: session.username || "Tous" }));
        }
      } catch (e) { console.error(e); }
    }
  }, []);

  const isAdmin = userSession?.admin === "Oui" || userSession?.role === 1 || userSession?.role === "1";

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/reports/cash-balance?${q}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userSession) fetchBalance();
  }, [filters, userSession]);

  const summaryItems = [
    {
      label: "Total Recettes",
      value: data?.summary.totalIncome || 0,
      icon: TrendingUp,
      color: "emerald",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      gradient: "from-emerald-500 to-emerald-600"
    },
    {
      label: "Total Dépenses",
      value: data?.summary.totalExpenses || 0,
      icon: TrendingDown,
      color: "rose",
      bg: "bg-rose-50",
      text: "text-rose-600",
      gradient: "from-rose-500 to-rose-600"
    },
    {
      label: "Solde Net en Caisse",
      value: data?.summary.netBalance || 0,
      icon: Wallet,
      color: "indigo",
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      gradient: "from-indigo-600 to-indigo-700"
    }
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 shadow-inner text-indigo-600">
            <Scale size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Bilan de Caisse</h1>
            <p className="text-slate-500 font-medium italic font-outfit">Réconciliation financière et analyse des flux de trésorerie.</p>
          </div>
        </div>

        <button 
          onClick={() => setIsPrintModalOpen(true)}
          className="flex items-center gap-3 px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
        >
           <Printer size={20} />
           Imprimer le rapport
        </button>
      </div>

      {isPrintModalOpen && (
        <CashBalanceModal 
          filters={filters} 
          onClose={() => setIsPrintModalOpen(false)} 
        />
      )}

      {/* Filters */}
      <div className="bg-white/60 backdrop-blur-2xl border border-white p-6 rounded-[32px] shadow-sm flex flex-wrap items-center gap-6">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg"><Calendar size={18} className="text-slate-500" /></div>
            <div className="flex items-center gap-2">
               <input 
                 type="date" 
                 className="bg-transparent border-none font-black text-slate-700 outline-none"
                 value={filters.start}
                 onChange={(e) => setFilters({...filters, start: e.target.value})}
               />
               <span className="text-slate-300">→</span>
               <input 
                 type="date" 
                 className="bg-transparent border-none font-black text-slate-700 outline-none"
                 value={filters.end}
                 onChange={(e) => setFilters({...filters, end: e.target.value})}
               />
            </div>
         </div>
         
         {isAdmin && (
           <>
             <div className="h-8 w-px bg-slate-100 mx-2 hidden md:block"></div>
             <div className="flex items-center gap-3">
                <User size={18} className="text-slate-400" />
                <select 
                   className="bg-transparent font-black text-slate-700 outline-none cursor-pointer"
                   value={filters.cashier}
                   onChange={(e) => setFilters({...filters, cashier: e.target.value})}
                >
                   <option value="Tous">Tous les caissiers</option>
                   <option value="ADRR">ADRR</option>
                   <option value="ADMIN">ADMIN</option>
                   <option value="KADER">KADER</option>
                </select>
             </div>
           </>
         )}
         
         {!isAdmin && (
           <>
             <div className="h-8 w-px bg-slate-100 mx-2 hidden md:block"></div>
             <div className="flex items-center gap-3">
                <User size={18} className="text-slate-400" />
                <span className="font-black text-slate-700 uppercase tracking-tight">{userSession?.username}</span>
             </div>
             <div className="h-8 w-px bg-slate-100 mx-2 hidden md:block"></div>
             <div className="flex items-center gap-3">
                <Filter size={18} className="text-slate-400" />
                <select 
                   className="bg-transparent font-black text-slate-700 outline-none cursor-pointer"
                   value={filters.type}
                   onChange={(e) => setFilters({...filters, type: e.target.value})}
                >
                   <option value="Tous">Tous les types</option>
                   <option value="Vente (Caisse)">Ventes</option>
                   <option value="Paiement Ciment">Ciment</option>
                   <option value="Paiement Loyer">Loyers</option>
                   <option value="Dépense (Administrative)">Dépenses</option>
                   <option value="Avance Client">Avances</option>
                   <option value="Retrait">Retraits</option>
                </select>
             </div>
           </>
         )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         {summaryItems.map((item, i) => (
            <div key={i} className="group relative overflow-hidden bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl transition-all duration-300 hover:scale-[1.02]">
               <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${item.gradient} opacity-[0.03] rounded-bl-[100px] group-hover:opacity-[0.07] transition-opacity`}></div>
               <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                     <div className={`w-14 h-14 rounded-2xl ${item.bg} ${item.text} flex items-center justify-center`}>
                        <item.icon size={28} />
                     </div>
                     <div className={`px-4 py-1.5 rounded-full ${item.bg} ${item.text} text-[10px] font-black uppercase tracking-wider`}>
                        {new Date().toLocaleDateString('fr-FR', { month: 'short' })}
                     </div>
                  </div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</h3>
                  <p className={`text-4xl font-black tracking-tight ${item.text}`}>
                     {loading ? "..." : new Intl.NumberFormat('fr-FR').format(item.value)}
                  </p>
               </div>
            </div>
         ))}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden relative">
         <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div>
               <h2 className="text-xl font-black text-slate-900">Mouvements de Trésorerie</h2>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Détail des entrées et sorties</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl text-indigo-600 font-black text-xs">
               <Database size={14} />
               {data?.entries.length || 0} Transactions
            </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-white border-b border-slate-50">
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Opération</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Référence</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Caissier / Lieu</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Entrée</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Sortie</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-32 text-center">
                         <div className="relative w-20 h-20 mx-auto mb-6">
                            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                            <Scale size={32} className="absolute inset-0 m-auto text-indigo-600 animate-pulse" />
                         </div>
                         <p className="font-black text-slate-400 animate-pulse">Calcul de la position financière...</p>
                      </td>
                    </tr>
                  ) : (data?.entries || []).filter(e => filters.type === "Tous" || e.type === filters.type).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-32 text-center opacity-30 grayscale">
                         <Scale size={64} className="mx-auto mb-4" />
                         <p className="font-black text-lg">Aucun mouvement financier trouvé.</p>
                      </td>
                    </tr>
                  ) : (
                    (data?.entries || [])
                    .filter(e => filters.type === "Tous" || e.type === filters.type)
                    .map((entry, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${entry.entree > 0 ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"}`}>
                                 {entry.entree > 0 ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>}
                              </div>
                              <div>
                                 <p className="font-black text-slate-800 text-sm tracking-tight italic">Transaction</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(entry.date).toLocaleDateString('fr-FR')} • {entry.moyen}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                              <FileText size={14} className="text-slate-300" />
                              <span className="font-black text-slate-600 text-[13px] tracking-tight">{entry.ref}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                           <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                              entry.type.includes("Vente") || entry.type.includes("Paiement") ? "bg-emerald-100 text-emerald-700" :
                              entry.type.includes("Dépense") || entry.type.includes("Retrait") ? "bg-rose-100 text-rose-700" :
                              "bg-indigo-100 text-indigo-700"
                           }`}>
                              {entry.type}
                           </span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2 mb-1">
                              <User size={14} className="text-slate-400" />
                              <span className="font-extrabold text-slate-700 text-xs uppercase">{entry.user}</span>
                           </div>
                           <div className="flex items-center gap-2">
                              <MapPin size={12} className="text-slate-300" />
                              <span className="text-[10px] font-black text-slate-400 uppercase">{entry.emplacement || "Général"}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-emerald-600 text-lg">
                           {entry.entree > 0 ? `+${new Intl.NumberFormat('fr-FR').format(entry.entree)}` : "—"}
                        </td>
                        <td className="px-8 py-6 text-right font-black text-rose-600 text-lg">
                           {entry.sortie > 0 ? `-${new Intl.NumberFormat('fr-FR').format(entry.sortie)}` : "—"}
                        </td>
                      </tr>
                    ))
                    )
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
