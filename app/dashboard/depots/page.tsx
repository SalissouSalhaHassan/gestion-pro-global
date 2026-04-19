"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Warehouse, 
  MapPin, 
  User, 
  Search, 
  RefreshCw,
  LayoutGrid,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Edit3,
  X,
  Save,
  Check,
  Power
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Depot = {
  id: number;
  nom: string;
  emplacement: string;
  responsable: string;
  is_active: boolean;
  created_at: string;
};

const supabase = createClient();

const statsCardClass = "bg-white p-6 rounded-[28px] border border-slate-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center gap-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300";

export default function DepotManagementPage() {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null as number | null,
    nom: "",
    emplacement: "",
    responsable: "",
    is_active: true
  });

  const loadData = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch Users for the dropdown
      const { data: userData, error: userErr } = await supabase
        .from("users")
        .select("utilisateur, nom_prenom")
        .order("utilisateur");
      
      if (!userErr && userData) {
        setUsers(userData.map(u => u.nom_prenom || u.utilisateur));
      }

      // 2. Fetch Depots
      const { data, error } = await supabase
        .from("depots")
        .select("*")
        .eq("is_deleted", false)
        .order("nom");

      if (error) throw error;

      if (data) {
        setDepots(data);
      }
    } catch (err) {
      console.error("Failed to load depots:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom) return;

    setIsSubmitting(true);
    try {
      const payload = {
        nom: formData.nom,
        emplacement: formData.emplacement,
        responsable: formData.responsable,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (isEditing && formData.id) {
        const { error } = await supabase
          .from("depots")
          .update(payload)
          .eq("id", formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("depots")
          .insert([payload]);
        if (error) throw error;
      }

      handleCloseModal();
      loadData();
    } catch (err: any) {
      alert("Erreur: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (depot: Depot) => {
    setFormData({
      id: depot.id,
      nom: depot.nom,
      emplacement: depot.emplacement || "",
      responsable: depot.responsable || "",
      is_active: depot.is_active
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Voulez-vous supprimer ce dépôt ?")) return;
    try {
      const { error } = await supabase
        .from("depots")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert("Erreur lors de la suppression: " + err.message);
    }
  };

  const handleOpenAdd = () => {
    setFormData({ id: null, nom: "", emplacement: "", responsable: "", is_active: true });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredDepots = (list: Depot[]) => list.filter((d: Depot) => 
    d.nom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.emplacement?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.responsable?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = useMemo(() => {
    const total = depots.length;
    const active = depots.filter(d => d.is_active).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [depots]);

  return (
    <div className="min-h-screen text-slate-900 p-6 lg:p-10 -m-6 lg:-m-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-slate-100">
               <Warehouse className="text-slate-600" size={24} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gestion des Dépôts</h1>
          </div>
          <p className="text-slate-500 text-sm font-medium ml-11">Configurez vos points de stockage et responsables</p>
        </div>

        <button 
          onClick={handleOpenAdd}
          className="flex items-center gap-2 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 group bg-[#6366f1] shadow-indigo-200">
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          Nouveau Dépôt
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {[
          { label: "Total Dépôts", value: stats.total, color: "text-[#6366f1]", bg: "bg-[#6366f1]/5", icon: Warehouse },
          { label: "Dépôts Actifs", value: stats.active, color: "text-emerald-500", bg: "bg-emerald-50", icon: Power },
          { label: "Inactive / Maintenance", value: stats.inactive, color: "text-rose-500", bg: "bg-rose-50", icon: AlertCircle }
        ].map((stat, i) => (
          <div key={i} className={statsCardClass}>
            <div className={cn("p-4 rounded-2xl", stat.bg)}>
               <stat.icon className={stat.color} size={24} />
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em] mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-slate-800 tracking-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* List Container */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un dépôt..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl pl-13 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#6366f1]/5 transition-all text-slate-700"
            />
          </div>
          <button onClick={loadData} className="p-3 text-slate-300 hover:text-[#6366f1] transition-colors">
            <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center w-20">ID</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Dépôt</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Emplacement</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">Chargement...</p>
                  </td>
                </tr>
              ) : filteredDepots(depots).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Warehouse size={48} className="text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold text-lg">Aucun dépôt trouvé</p>
                  </td>
                </tr>
              ) : (
                filteredDepots(depots).map((depot: Depot) => (
                  <tr key={depot.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 text-center font-mono text-xs text-slate-400">#{depot.id.toString().padStart(3, '0')}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                          <Warehouse size={16} />
                        </div>
                        <span className="font-bold text-slate-800">{depot.nom}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <MapPin size={14} className="opacity-50" />
                        {depot.emplacement || "-"}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <User size={14} className="opacity-50" />
                        {depot.responsable || "Non assigné"}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter",
                        depot.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {depot.is_active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(depot)} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-all">
                          <Edit3 size={18} />
                        </button>
                        <button onClick={() => handleDelete(depot.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all">
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCloseModal}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-white/20 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl font-black text-slate-900">{isEditing ? "Modifier le Dépôt" : "Nouveau Dépôt"}</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Configuration du point de stockage</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-slate-100">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom du Dépôt <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Warehouse className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    required type="text" value={formData.nom}
                    onChange={(e) => setFormData({...formData, nom: e.target.value})}
                    placeholder="Ex: Dépôt Principal"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Emplacement</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    type="text" value={formData.emplacement}
                    onChange={(e) => setFormData({...formData, emplacement: e.target.value})}
                    placeholder="Ex: Zone Industrielle, Lot 42"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Responsable</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <select 
                    value={formData.responsable}
                    onChange={(e) => setFormData({...formData, responsable: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-800 appearance-none"
                  >
                    <option value="">Non assigné</option>
                    {users.map(user => (
                      <option key={user} value={user}>{user}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div>
                  <p className="text-sm font-black text-slate-700">Statut du dépôt</p>
                  <p className="text-[10px] font-bold text-slate-400">Désactiver pour suspendre les mouvements</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData({...formData, is_active: !formData.is_active})}
                  className={cn(
                    "relative w-14 h-8 rounded-full transition-colors duration-300",
                    formData.is_active ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center",
                    formData.is_active ? "translate-x-6" : "translate-x-0"
                  )}>
                    <Check size={12} className={cn(formData.is_active ? "text-emerald-500" : "hidden")} strokeWidth={4} />
                  </div>
                </button>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button" onClick={handleCloseModal}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-4 rounded-2xl font-black transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  className="flex-1 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 bg-[#6366f1] disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {isEditing ? "Enregistrer" : "Créer le Dépôt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
