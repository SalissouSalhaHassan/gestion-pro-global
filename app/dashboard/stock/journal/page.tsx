"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  ClipboardList, 
  Search, 
  Calendar, 
  Printer, 
  ArrowLeft,
  Loader2,
  Package,
  TrendingUp,
  TrendingDown,
  Filter,
  RefreshCw,
  Box,
  Layers,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type JournalItem = {
  id: number;
  reference: string;
  designation: string;
  unite: string;
  avant: number;
  variation: number;
  apres: number;
};

export default function StockJournal() {
  const [items, setItems] = useState<JournalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepot, setSelectedDepot] = useState("Tous");
  const [depots, setDepots] = useState<string[]>([]);
  const [categories, setCategories] = useState<{id: number, nom: string}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const supabase = createClient();

  const fetchJournal = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        date,
        depot: selectedDepot,
        search: searchTerm,
        categoryId: selectedCategory
      });
      const res = await fetch(`/api/stock/journal?${queryParams.toString()}`);
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error("Error fetching journal:", err);
    } finally {
      setLoading(false);
    }
  }, [date, selectedDepot, searchTerm, selectedCategory]);

  useEffect(() => {
    fetchDepots();
    fetchCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchJournal(), 300);
    return () => clearTimeout(timer);
  }, [fetchJournal]);

  const fetchDepots = async () => {
    const { data } = await supabase.from("depots").select("nom").eq("is_active", true);
    if (data) setDepots(data.map(d => d.nom));
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, nom").order("nom");
    if (data) setCategories(data);
  };

  const stats = {
    totalArticles: items.length,
    totalVariation: items.reduce((sum, item) => sum + Math.abs(item.variation), 0),
    positiveChanges: items.filter(i => i.variation > 0).length,
    negativeChanges: items.filter(i => i.variation < 0).length,
  };

  const handlePrint = () => {
    const queryParams = new URLSearchParams({
        date,
        depot: selectedDepot,
        search: searchTerm,
        categoryId: selectedCategory
      });
    window.open(`/api/stock/journal/print?${queryParams.toString()}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8 space-y-8 font-sans">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Link href="/dashboard/stock" className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm group">
            <ArrowLeft className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 group-hover:-translate-x-1 transition-all" />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                 <ClipboardList className="w-7 h-7 text-white" />
              </div>
              Journal Quotidien du Stock
            </h1>
            <p className="text-slate-500 mt-1 font-medium italic">
              Journal détaillé des états de stock pour la journée du <span className="text-indigo-600 font-bold underline">{new Date(date).toLocaleDateString('fr-FR')}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
           <div className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
             <Calendar className="w-5 h-5 text-indigo-500" />
             <input 
               type="date" 
               className="bg-transparent font-bold text-slate-700 outline-none"
               value={date}
               onChange={(e) => setDate(e.target.value)}
             />
           </div>
           
           <select 
             className="px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
             value={selectedDepot}
             onChange={(e) => setSelectedDepot(e.target.value)}
           >
              <option value="Tous">Tous les dépôts</option>
              {depots.map(d => <option key={d} value={d}>{d}</option>)}
           </select>

           <button 
             onClick={handlePrint}
             className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold shadow-lg shadow-slate-200"
           >
             <Printer className="w-5 h-5" />
             Imprimer le Journal
           </button>
        </div>
      </div>

      {/* ── STATS CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Articles" 
          value={stats.totalArticles} 
          icon={<Box className="w-6 h-6 text-indigo-600" />} 
          color="indigo" 
        />
        <StatCard 
          label="Total Variations" 
          value={stats.totalVariation} 
          icon={<RefreshCw className="w-6 h-6 text-emerald-600" />} 
          color="emerald"
        />
        <StatCard 
          label="Entrées (Articles)" 
          value={stats.positiveChanges} 
          icon={<TrendingUp className="w-6 h-6 text-amber-500" />} 
          color="amber"
        />
        <StatCard 
          label="Sorties (Articles)" 
          value={stats.negativeChanges} 
          icon={<TrendingDown className="w-6 h-6 text-rose-500" />} 
          color="rose"
        />
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Rechercher par référence ou désignation..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-transparent border focus:border-indigo-200 focus:bg-white rounded-2xl outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-400 placeholder:font-normal"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Layers className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-transparent border focus:border-indigo-200 focus:bg-white rounded-2xl outline-none transition-all font-semibold text-slate-700 appearance-none"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    <option value="">Toutes les catégories</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
            </div>
            
            <button 
                onClick={fetchJournal}
                className="p-4 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
            >
                <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      {/* ── DATA TABLE ── */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Référence & Article</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center bg-slate-100/30">Stock Avant</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Variation (Jour)</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center bg-indigo-50/30">Après Stock</th>
                <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-8 py-6">
                       <div className="h-8 bg-slate-100 rounded-xl w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="inline-flex p-8 bg-slate-50 rounded-full mb-4">
                       <Package className="w-12 h-12 text-slate-200" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-400">Aucun mouvement trouvé</h3>
                    <p className="text-slate-400 mt-1">Essayez d'ajuster les filtres ou la date.</p>
                  </td>
                </tr>
              ) : items.map((item) => (
                <tr key={item.id} className="group hover:bg-slate-50/80 transition-all duration-300">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-white transition-colors border border-transparent group-hover:border-slate-100">
                        <Package className="w-6 h-6 text-slate-400 group-hover:text-indigo-500" />
                      </div>
                      <div>
                        <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                          {item.designation}
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                          {item.reference}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-8 py-5 text-center bg-slate-100/10 group-hover:bg-transparent transition-colors">
                    <span className="text-lg font-black text-slate-600">{item.avant}</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase">{item.unite}</span>
                  </td>

                  <td className="px-8 py-5 text-center">
                    <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-black text-sm ${
                        item.variation > 0 ? 'bg-emerald-50 text-emerald-600' : 
                        item.variation < 0 ? 'bg-rose-50 text-rose-600' : 
                        'bg-slate-100 text-slate-400'
                    }`}>
                        {item.variation > 0 && <TrendingUp className="w-4 h-4" />}
                        {item.variation < 0 && <TrendingDown className="w-4 h-4" />}
                        {item.variation > 0 ? '+' : ''}{item.variation}
                    </div>
                  </td>

                  <td className="px-8 py-5 text-center bg-indigo-50/10 group-hover:bg-indigo-50/30 transition-colors">
                    <span className="text-xl font-black text-indigo-700">{item.apres}</span>
                    <span className="text-[10px] font-bold text-indigo-400 ml-1 uppercase">{item.unite}</span>
                  </td>

                  <td className="px-8 py-5 text-right">
                    <Link 
                      href={`/dashboard/mouvements?articleId=${item.id}&date=${date}`}
                      className="inline-flex p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Voir les détails"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 border-indigo-100 text-indigo-700 shadow-indigo-100",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700 shadow-emerald-100",
    amber: "bg-amber-50 border-amber-100 text-amber-700 shadow-amber-100",
    rose: "bg-rose-50 border-rose-100 text-rose-700 shadow-rose-100"
  };

  return (
    <div className={`p-6 rounded-[2rem] border bg-white shadow-sm flex items-center gap-5 transition-all hover:scale-[1.02] hover:shadow-lg ${colors[color].replace('bg-', 'hover:shadow-')}`}>
      <div className={`p-4 rounded-2xl ${colors[color].split(' ')[0]} ${colors[color].split(' ')[2]}`}>
        {icon}
      </div>
      <div>
        <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{label}</h4>
        <div className="text-3xl font-black text-slate-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}
