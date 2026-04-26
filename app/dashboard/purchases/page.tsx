"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Search, Plus, Eye, Trash2, Printer, Filter, Calendar, User, FileText, Loader2, CheckCircle2, Clock, AlertCircle, Wallet } from "lucide-react";

type Purchase = {
  id: number;
  numero_facture: string;
  date_achat: string;
  fournisseur_nom: string;
  montant_total: number;
  montant_paye: number;
  statut: string;
};

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ ref: "", supplier: "", start_date: "", end_date: "" });
  const [toast, setToast] = useState<{message: string, type: "success" | "error"} | null>(null);

  useEffect(() => {
    fetchPurchases();
  }, [filters]);

  const fetchPurchases = async () => {
    try {
      const params = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/purchases?${params}`);
      const data = await res.json();
      setPurchases(data);
    } catch (error) {
      console.error("Failed to fetch purchases", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cet achat ?")) return;
    try {
      const res = await fetch(`/api/purchases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setPurchases(prev => prev.filter(p => p.id !== id));
      setToast({ message: "Achat supprimé.", type: "success" });
    } catch (error) {
      setToast({ message: "Erreur lors de la suppression.", type: "error" });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Payée": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "Partiellement Payée": return "bg-amber-50 text-amber-600 border-amber-100";
      default: return "bg-rose-50 text-rose-600 border-rose-100";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Payée": return <CheckCircle2 size={14} />;
      case "Partiellement Payée": return <Clock size={14} />;
      default: return <AlertCircle size={14} />;
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-lg font-bold text-white flex items-center gap-3 transition-all ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
            <div className="p-3 bg-white/50 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
              <ShoppingCart className="text-indigo-600" size={32} />
            </div>
            Historique des Achats
          </h1>
          <p className="mt-2 text-slate-500 font-medium ml-1">
            Consultez et gérez vos factures d'achat et règlements.
          </p>
        </div>
        <Link 
          href="/dashboard/purchases/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 w-fit"
        >
          <Plus size={20} /> Nouvel Achat
        </Link>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-[40px] border border-white p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest mb-2">
          <Filter size={14} /> Filtres de recherche
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" placeholder="Réf. Facture"
              value={filters.ref} onChange={e => setFilters({...filters, ref: e.target.value})}
              className="w-full bg-white border-slate-100 rounded-2xl pl-12 pr-4 py-3 font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
            />
          </div>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" placeholder="Fournisseur"
              value={filters.supplier} onChange={e => setFilters({...filters, supplier: e.target.value})}
              className="w-full bg-white border-slate-100 rounded-2xl pl-12 pr-4 py-3 font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="date" 
              value={filters.start_date} onChange={e => setFilters({...filters, start_date: e.target.value})}
              className="w-full bg-white border-slate-100 rounded-2xl pl-12 pr-4 py-3 font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="date" 
              value={filters.end_date} onChange={e => setFilters({...filters, end_date: e.target.value})}
              className="w-full bg-white border-slate-100 rounded-2xl pl-12 pr-4 py-3 font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-2xl rounded-[48px] border border-white shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">Réf. Facture</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">Date</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">Fournisseur</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 text-right">Montant Total</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 text-right">Payé</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 text-center">Statut</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-4" size={40} />
                      <p className="font-bold">Chargement des achats...</p>
                    </div>
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <ShoppingCart className="opacity-10 mb-4" size={60} />
                      <p className="font-bold text-xl">Aucun achat enregistré.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                purchases.map(purchase => (
                  <tr key={purchase.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6 font-black text-slate-900">{purchase.numero_facture}</td>
                    <td className="px-8 py-6 text-slate-500 font-bold">{new Date(purchase.date_achat).toLocaleDateString("fr-FR")}</td>
                    <td className="px-8 py-6 text-slate-700 font-black">{purchase.fournisseur_nom}</td>
                    <td className="px-8 py-6 text-right font-black text-slate-900">
                      {new Intl.NumberFormat("fr-FR").format(purchase.montant_total)} F
                    </td>
                    <td className="px-8 py-6 text-right font-bold text-emerald-600">
                      {new Intl.NumberFormat("fr-FR").format(purchase.montant_paye)} F
                    </td>
                    <td className="px-8 py-6">
                      <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black border ${getStatusStyle(purchase.statut)}`}>
                        {getStatusIcon(purchase.statut)}
                        {purchase.statut}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/purchases/${purchase.id}/payments`} title="Règlements" className="p-3 text-indigo-500 hover:bg-indigo-50 rounded-2xl transition-all">
                          <Wallet size={18} />
                        </Link>
                        <button title="Détails" className="p-3 text-slate-400 hover:bg-slate-100 rounded-2xl transition-all">
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleDelete(purchase.id)} title="Supprimer" className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
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
    </div>
  );
}
