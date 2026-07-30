"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Eye, 
  Trash2, 
  Printer, 
  Filter, 
  Calendar, 
  User, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Wallet,
  Edit2,
  Bell
} from "lucide-react";

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
      setPurchases(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch purchases", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cet achat ? Cette action est irréversible.")) return;
    try {
      const res = await fetch(`/api/purchases/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setPurchases(prev => prev.filter(p => p.id !== id));
      setToast({ message: "Achat supprimé avec succès.", type: "success" });
    } catch (error) {
      setToast({ message: "Erreur lors de la suppression.", type: "error" });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Payée": return "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "Partiellement Payée": return "bg-amber-50 text-amber-600 border-amber-200";
      case "Brouillon": return "bg-slate-100 text-slate-600 border-slate-200";
      default: return "bg-rose-50 text-rose-600 border-rose-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Payée": return <CheckCircle2 size={13} />;
      case "Partiellement Payée": return <Clock size={13} />;
      default: return <AlertCircle size={13} />;
    }
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-xl font-bold text-white flex items-center gap-3 transition-all animate-in zoom-in-95 ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {toast.message}
        </div>
      )}


      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-600 shadow-sm">
              <ShoppingCart size={28} />
            </div>
            Historique des Achats
          </h1>
          <p className="mt-1 text-slate-500 font-medium text-xs ml-1">
            Consultez, modifiez et gérez vos factures d'achat et règlements.
          </p>
        </div>
        
        <Link 
          href="/dashboard/purchases/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 w-fit"
        >
          <Plus size={18} /> Nouvel Achat
        </Link>
      </div>

      {/* Filters Card */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-wider">
          <Filter size={14} /> Filtres de recherche
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Ref Facture Filter */}
          <div className="relative">
            <FileText className="absolute left-4 top-3 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Réf. Facture"
              value={filters.ref} 
              onChange={e => setFilters({...filters, ref: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Supplier Filter */}
          <div className="relative">
            <User className="absolute left-4 top-3 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Fournisseur"
              value={filters.supplier} 
              onChange={e => setFilters({...filters, supplier: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-4 top-3 text-slate-400" size={16} />
            <input 
              type="date" 
              value={filters.start_date} 
              onChange={e => setFilters({...filters, start_date: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-4 top-3 text-slate-400" size={16} />
            <input 
              type="date" 
              value={filters.end_date} 
              onChange={e => setFilters({...filters, end_date: e.target.value})}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Réf. Facture</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Fournisseur</th>
                <th className="px-6 py-4 text-right">Montant Total</th>
                <th className="px-6 py-4 text-right">Payé</th>
                <th className="px-6 py-4 text-center">Statut</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-3 text-indigo-600" size={36} />
                      <p className="font-bold text-slate-600">Chargement des achats...</p>
                    </div>
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <ShoppingCart className="opacity-20 mb-3 text-indigo-600" size={48} />
                      <p className="font-bold text-slate-700 text-base">Aucun achat enregistré.</p>
                      <p className="text-xs text-slate-400 mt-1">Créez votre premier achat en cliquant sur Nouvel Achat.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                purchases.map(purchase => (
                  <tr key={purchase.id} className="hover:bg-indigo-50/20 transition-colors group">
                    {/* Ref Facture */}
                    <td className="px-6 py-4 font-black text-slate-900">{purchase.numero_facture}</td>
                    
                    {/* Date */}
                    <td className="px-6 py-4 text-slate-500 font-semibold">
                      {purchase.date_achat ? new Date(purchase.date_achat).toLocaleDateString("fr-FR") : "-"}
                    </td>
                    
                    {/* Fournisseur */}
                    <td className="px-6 py-4 text-slate-900 font-bold">{purchase.fournisseur_nom}</td>
                    
                    {/* Montant Total */}
                    <td className="px-6 py-4 text-right font-black text-slate-900">
                      {new Intl.NumberFormat("fr-FR").format(purchase.montant_total)} F
                    </td>
                    
                    {/* Montant Payé */}
                    <td className="px-6 py-4 text-right font-black text-emerald-600">
                      {new Intl.NumberFormat("fr-FR").format(purchase.montant_paye)} F
                    </td>
                    
                    {/* Statut */}
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border ${getStatusStyle(purchase.statut)}`}>
                        {getStatusIcon(purchase.statut)}
                        {purchase.statut}
                      </span>
                    </td>
                    
                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* Payments Link */}
                        <Link 
                          href={`/dashboard/purchases/${purchase.id}/payments`} 
                          title="Règlements" 
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <Wallet size={16} />
                        </Link>

                        {/* Edit Link */}
                        <Link 
                          href={`/dashboard/purchases/new?id=${purchase.id}`} 
                          title="Modifier l'achat" 
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                        >
                          <Edit2 size={16} />
                        </Link>

                        {/* Details PDF View */}
                        <button 
                          onClick={() => window.open(`/api/purchases/${purchase.id}/pdf`, '_blank')} 
                          title="Aperçu / Imprimer PDF" 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        >
                          <Eye size={16} />
                        </button>

                        {/* Delete Button */}
                        <button 
                          onClick={() => handleDelete(purchase.id)} 
                          title="Supprimer" 
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
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
