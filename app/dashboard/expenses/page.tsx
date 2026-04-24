"use client";

import { useState, useEffect } from "react";
import { 
  TrendingDown, 
  Plus, 
  Search, 
  Calendar, 
  Filter, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Loader2,
  AlertCircle,
  TrendingUp,
  MapPin,
  User,
  MoreVertical,
  RefreshCw
} from "lucide-react";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ start: "", end: "", oper: "Tous" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    date_depense: new Date().toISOString().split("T")[0],
    libelle: "",
    montant: "",
    no_caisse: "",
    operateur: "ADMIN",
    autorise_par: "ADMIN"
  });

  const generateRef = () => {
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EXP-${year}-${random}`;
  };

  useEffect(() => {
    if (isModalOpen && !editingExpense && !form.no_caisse) {
      setForm(prev => ({ ...prev, no_caisse: generateRef() }));
    }
  }, [isModalOpen, editingExpense]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/expenses?${q}`);
      const data = await res.json();
      
      // If API returns an error object instead of an array
      if (data && !Array.isArray(data)) {
        console.error("API Error or invalid format:", data);
        setExpenses([]);
        return;
      }
      
      setExpenses(data || []);
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingExpense ? { ...form, id: editingExpense.id } : form)
      });
      const result = await res.json();
      
      if (!res.ok) {
         throw new Error(result.error || "Erreur lors de l'enregistrement");
      }

      setSuccess(result.message);
      setTimeout(() => {
        setIsModalOpen(false);
        setEditingExpense(null);
        setSuccess(null);
        fetchExpenses();
      }, 1000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cette dépense ?")) return;
    try {
      await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      fetchExpenses();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (exp: any) => {
    setEditingExpense(exp);
    setForm({
      date_depense: exp.date_depense,
      libelle: exp.libelle,
      montant: exp.montant,
      no_caisse: exp.no_caisse || "",
      operateur: exp.operateur,
      autorise_par: exp.autorise_par
    });
    setIsModalOpen(true);
  };

  const totalExpenses = Array.isArray(expenses) ? expenses.reduce((sum, e) => sum + Number(e.montant || 0), 0) : 0;


  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-600 shadow-inner">
            <TrendingDown size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Journal des Dépenses</h1>
            <p className="text-slate-500 font-medium">Suivi et gestion des sorties de caisse administratives.</p>
          </div>
        </div>

        <button 
          onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
          className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-200"
        >
          <Plus size={22} />
          Nouvelle Dépense
        </button>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
               <TrendingDown size={24} />
            </div>
            <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Dépenses</p>
               <p className="text-2xl font-black text-slate-900">{new Intl.NumberFormat('fr-FR').format(totalExpenses)} F CFA</p>
            </div>
         </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white/60 backdrop-blur-xl border border-white p-4 rounded-3xl shadow-sm flex flex-wrap items-center gap-4">
         <div className="flex-1 min-w-[200px] relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par libellé..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50/50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none font-bold transition-all"
            />
         </div>
         <div className="flex items-center gap-2">
            <Calendar className="text-slate-400" size={18} />
            <input 
              type="date" 
              className="bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm outline-none"
              value={filters.start}
              onChange={(e) => setFilters({...filters, start: e.target.value})}
            />
            <span className="text-slate-300 font-bold px-1">à</span>
            <input 
              type="date" 
              className="bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold shadow-sm outline-none"
              value={filters.end}
              onChange={(e) => setFilters({...filters, end: e.target.value})}
            />
         </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
         <div className="overflow-x-auto overflow-y-auto max-h-[70vh] custom-scrollbar">
            <table className="w-full text-left border-collapse relative">
               <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur-md shadow-sm">
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Libellé / Détails</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Opérateur</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Montant</th>
                     <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <Loader2 className="w-10 h-10 text-slate-200 animate-spin mx-auto mb-4" />
                        <p className="text-slate-400 font-bold">Chargement du journal...</p>
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold">Aucune dépense enregistrée sur cette période.</p>
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-8 py-6">
                           <p className="font-extrabold text-slate-900">{new Date(exp.date_depense).toLocaleDateString('fr-FR')}</p>
                           <p className="text-[10px] font-black text-slate-400 uppercase">{exp.no_caisse || 'No Caisse'}</p>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                                 <TrendingUp size={14} className="rotate-180" />
                              </div>
                              <div>
                                 <p className="font-black text-slate-800">{exp.libelle}</p>
                                 <p className="text-[10px] font-bold text-slate-400">AUTORISÉ : {exp.autorise_par}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                           <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full font-black text-[11px] uppercase tracking-wide">
                              {exp.operateur}
                           </span>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-rose-600 text-lg">
                           -{new Intl.NumberFormat('fr-FR').format(exp.montant)}
                        </td>
                        <td className="px-8 py-6 text-right">
                           <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(exp)} className="p-3 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-colors">
                                 <Edit3 size={18} />
                              </button>
                              <button onClick={() => handleDelete(exp.id)} className="p-3 hover:bg-rose-50 text-rose-500 rounded-xl transition-colors">
                                 <Trash2 size={18} />
                              </button>
                           </div>
                        </td>
                      </tr>
                    ))
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* Modal: New/Edit Expense */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200">
              <div className="bg-slate-900 p-8 text-white relative">
                  <button onClick={() => setIsModalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors">
                    <X size={22} />
                  </button>
                  <h3 className="text-2xl font-black flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center">
                       <TrendingDown size={20} />
                    </div>
                    {editingExpense ? "Modifier la dépense" : "Nouvelle Dépense"}
                  </h3>
                  <p className="text-slate-400 font-bold mt-1 text-sm italic">Veuillez renseigner les détails du retrait.</p>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-slate-50/30">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date</label>
                       <input 
                        type="date" 
                        required
                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all"
                        value={form.date_depense}
                        onChange={(e) => setForm({...form, date_depense: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Caisse / Réf</label>
                       <div className="relative">
                          <input 
                            type="text" 
                            placeholder="Ex: C001"
                            className="w-full pl-5 pr-12 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all text-indigo-600 shadow-sm"
                            value={form.no_caisse}
                            onChange={(e) => setForm({...form, no_caisse: e.target.value})}
                          />
                          <button 
                            type="button"
                            onClick={() => setForm({...form, no_caisse: generateRef()})}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all"
                          >
                             <RefreshCw size={16} />
                          </button>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Libellé de la dépense</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Facture d'électricité"
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-3xl font-black outline-none focus:border-indigo-500 transition-all text-slate-800"
                      value={form.libelle}
                      onChange={(e) => setForm({...form, libelle: e.target.value})}
                    />
                 </div>

                 {error && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 font-bold text-sm flex items-center gap-3 animate-shake">
                       <AlertCircle size={18} />
                       {error}
                    </div>
                 )}

                 {success && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 font-bold text-sm flex items-center gap-3 animate-bounce">
                       <TrendingUp size={18} />
                       {success}
                    </div>
                 )}

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-rose-400 uppercase tracking-widest ml-1">Montant (F CFA)</label>
                       <input 
                        type="number" 
                        required
                        className="w-full px-5 py-4 bg-rose-50 border border-rose-100 rounded-2xl font-black text-rose-600 outline-none focus:ring-4 focus:ring-rose-500/10 transition-all text-xl"
                        value={form.montant}
                        onChange={(e) => setForm({...form, montant: e.target.value})}
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Autorisé par</label>
                       <input 
                        type="text" 
                        placeholder="ADMIN"
                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:border-indigo-500 transition-all"
                        value={form.autorise_par}
                        onChange={(e) => setForm({...form, autorise_par: e.target.value})}
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6 pt-2">
                    <div className="bg-white border border-slate-100 p-4 rounded-3xl flex items-center gap-3 w-full">
                       <User size={18} className="text-slate-400" />
                       <div className="flex-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase">Opérateur</p>
                          <select 
                            className="bg-transparent font-black text-slate-700 outline-none w-full"
                            value={form.operateur}
                            onChange={(e) => setForm({...form, operateur: e.target.value})}
                          >
                             <option value="ADRR">ADRR</option>
                             <option value="ADMIN">ADMIN</option>
                             <option value="SYSTEME">SYSTEME</option>
                          </select>
                       </div>
                    </div>
                 </div>

                 <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-slate-900 text-white rounded-full font-black text-xl flex items-center justify-center gap-3 transition-all hover:bg-black"
                 >
                   {loading ? <Loader2 className="animate-spin" /> : <Save size={24} />}
                   {editingExpense ? "Enregistrer les modifications" : "Confirmer la Dépense"}
                 </button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
