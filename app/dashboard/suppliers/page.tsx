"use client";

import { useEffect, useState } from "react";
import { Users, Search, Plus, Edit3, Trash2, X, Save, Phone, Mail, Globe, MapPin, CreditCard, Loader2, FileText } from "lucide-react";
import SupplierStatementModal from "./SupplierStatementModal";

type Supplier = {
  id: number;
  ref_fournisseur: string;
  nom: string;
  contact?: string;
  tel?: string;
  gsm?: string;
  adresse?: string;
  email?: string;
  site?: string;
  credit: number;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statementSupplierId, setStatementSupplierId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Supplier>>({
    nom: "", ref_fournisseur: "", contact: "", tel: "", gsm: "", adresse: "", email: "", site: ""
  });
  const [toast, setToast] = useState<{message: string, type: "success" | "error"} | null>(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      const data = await res.json();
      setSuppliers(data);
    } catch (error) {
      console.error("Failed to fetch suppliers", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isEditing = !!formData.id;
      const url = isEditing ? `/api/suppliers/${formData.id}` : "/api/suppliers";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to save");

      setToast({ message: isEditing ? "Fournisseur mis à jour !" : "Fournisseur ajouté !", type: "success" });
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (error) {
      setToast({ message: "Erreur lors de l'enregistrement.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce fournisseur ?")) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setSuppliers(prev => prev.filter(s => s.id !== id));
      setToast({ message: "Fournisseur supprimé.", type: "success" });
    } catch (error) {
      setToast({ message: "Erreur lors de la suppression.", type: "error" });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.nom.toLowerCase().includes(query.toLowerCase()) || 
    s.ref_fournisseur.toLowerCase().includes(query.toLowerCase())
  );

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
              <Users className="text-indigo-600" size={32} />
            </div>
            Gestion des Fournisseurs
          </h1>
          <p className="mt-2 text-slate-500 font-medium ml-1">
            Gérez vos relations fournisseurs, contacts et crédits.
          </p>
        </div>
        <button 
          onClick={() => { setFormData({ nom: "" }); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus size={20} /> Nouveau Fournisseur
        </button>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-[40px] border border-white p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher par nom ou référence..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border-none rounded-3xl pl-16 pr-6 py-5 text-lg font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="font-bold">Chargement des fournisseurs...</p>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
            <Users className="opacity-20 mb-4" size={60} />
            <p className="font-bold text-xl">Aucun fournisseur trouvé.</p>
          </div>
        ) : (
          filteredSuppliers.map(supplier => (
            <div key={supplier.id} className="group bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -translate-y-1/2 translate-x-1/2 opacity-50 group-hover:bg-indigo-100 transition-colors"></div>
              
              <div className="flex items-start justify-between mb-6 relative">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md mb-2 inline-block">
                    {supplier.ref_fournisseur}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 leading-tight">{supplier.nom}</h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setStatementSupplierId(supplier.id)} 
                    title="Relevé de Compte Fournisseur (A4)" 
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
                  >
                    <FileText size={18} />
                  </button>
                  <button onClick={() => { setFormData(supplier); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => handleDelete(supplier.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 relative">
                {supplier.tel && (
                  <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                    <div className="p-2 bg-slate-50 rounded-lg"><Phone size={14} /></div>
                    {supplier.tel}
                  </div>
                )}
                {supplier.email && (
                  <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                    <div className="p-2 bg-slate-50 rounded-lg"><Mail size={14} /></div>
                    {supplier.email}
                  </div>
                )}
                {supplier.adresse && (
                  <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
                    <div className="p-2 bg-slate-50 rounded-lg"><MapPin size={14} /></div>
                    {supplier.adresse}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between relative">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Solde Crédit</p>
                  <p className={`text-xl font-black ${supplier.credit > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {new Intl.NumberFormat("fr-FR").format(supplier.credit)} F CFA
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl text-slate-400">
                  <CreditCard size={20} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-900">{formData.id ? "Modifier" : "Nouveau"} Fournisseur</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Nom du Fournisseur *</label>
                  <input 
                    type="text" required value={formData.nom}
                    onChange={e => setFormData({...formData, nom: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Référence</label>
                  <input 
                    type="text" value={formData.ref_fournisseur}
                    onChange={e => setFormData({...formData, ref_fournisseur: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Contact</label>
                  <input 
                    type="text" value={formData.contact}
                    onChange={e => setFormData({...formData, contact: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Téléphone</label>
                  <input 
                    type="text" value={formData.tel}
                    onChange={e => setFormData({...formData, tel: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">GSM</label>
                  <input 
                    type="text" value={formData.gsm}
                    onChange={e => setFormData({...formData, gsm: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Adresse</label>
                  <input 
                    type="text" value={formData.adresse}
                    onChange={e => setFormData({...formData, adresse: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Email</label>
                  <input 
                    type="email" value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Site Web</label>
                  <input 
                    type="text" value={formData.site}
                    onChange={e => setFormData({...formData, site: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
              </div>
              
              <div className="pt-6 border-t border-slate-50 flex gap-4">
                <button 
                  type="button" onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit" disabled={saving}
                  className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : "Valider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statementSupplierId && (
        <SupplierStatementModal
          supplierId={statementSupplierId}
          onClose={() => setStatementSupplierId(null)}
        />
      )}
    </div>
  );
}

