"use client";

import { useEffect, useState } from "react";
import { 
  Layers, 
  Plus, 
  Trash2, 
  Loader2, 
  Search, 
  ArrowLeft,
  LayoutGrid
} from "lucide-react";
import Link from "next/link";

type Category = {
  id: number;
  nom: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/stock/categories");
      const data = await res.json();
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/stock/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: newCatName.trim() })
      });
      if (res.ok) {
        setNewCatName("");
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    try {
      const res = await fetch(`/api/stock/categories?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = categories.filter(c => 
    c.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-10 font-sans">
      <div className="max-w-4xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link href="/dashboard/stock" className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm group">
              <ArrowLeft className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 group-hover:-translate-x-1 transition-all" />
            </Link>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                   <Layers className="w-7 h-7 text-white" />
                </div>
                Gestion des Catégories
              </h1>
              <p className="text-slate-500 mt-1 font-medium italic">Gérez les familles de produits de votre inventaire</p>
            </div>
          </div>
        </div>

        {/* Add Section */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50">
           <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Nom de la catégorie</label>
                <input 
                  type="text" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Ex: Matériaux de construction, Outillage..."
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-bold text-slate-700"
                  required
                />
              </div>
              <div className="md:pt-6">
                <button 
                  disabled={saving}
                  className="w-full h-full md:h-[58px] px-8 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                  Ajouter
                </button>
              </div>
           </form>
        </div>

        {/* List Section */}
        <div className="space-y-6">
          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Rechercher une catégorie..."
              className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/5 transition-all font-semibold text-slate-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-2xl border border-slate-100 animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
                 <LayoutGrid className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                 <p className="text-slate-400 font-bold">Aucune catégorie trouvée</p>
              </div>
            ) : filtered.map(cat => (
              <div key={cat.id} className="group flex items-center justify-between p-5 bg-white border border-slate-100 rounded-[1.5rem] shadow-sm hover:shadow-md hover:border-indigo-100 transition-all">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Layers className="w-5 h-5" />
                   </div>
                   <span className="font-bold text-slate-700">{cat.nom}</span>
                </div>
                <button 
                  onClick={() => handleDelete(cat.id)}
                  className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
