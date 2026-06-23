"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Contact2,
  ChevronRight,
  UserCircle2,
  Filter,
  MoreHorizontal,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Edit3,
  Check,
  ChevronDown,
  Save,
  X,
  PlusCircle,
  ShoppingCart
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* ═══════════════════════════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════════════════════════ */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type UserRecord = {
  id: number;
  utilisateur: string;
  nom_prenom: string;
  role_name: string;
  emplacement: string;
  admin: string;
  langue: string;
  ref_per: string;
  depots: string;
  depot_ids: number[];
  created_at: string;
};

const supabase = createClient();

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<{ id: number; role_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({
    id: null as number | null,
    utilisateur: "",
    nom_prenom: "",
    mot_de_passe: "",
    role_id: "",
    emplacement: "",
    admin: "Non",
    langue: "FR",
    ref_per: "",
    depots: [] as number[]
  });

  const [availableDepotsData, setAvailableDepotsData] = useState<{ id: number; nom: string }[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDepotDropdownOpen, setIsDepotDropdownOpen] = useState(false);

  /* ═══════════════════════════════════════════════════════════════
     DATA FETCHING
     ═══════════════════════════════════════════════════════════════ */

  const loadData = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch Roles first (needed for the form)
      const { data: rolesData, error: rolesErr } = await supabase
        .from("roles")
        .select("id, role_name")
        .order("role_name");
      
      if (!rolesErr && rolesData) {
        setRoles(rolesData);
      }

      // 1.1 Fetch available depots with IDs
      const { data: depotsData, error: depotsErr } = await supabase
        .from("depots")
        .select("id, nom")
        .eq("is_deleted", false)
        .order("nom");
      
      if (!depotsErr && depotsData) {
        setAvailableDepotsData(depotsData);
      }

      // 2. Fetch Users with their assigned warehouses
      const { data, error } = await supabase
        .from("users")
        .select(`
          id,
          utilisateur,
          nom_prenom,
          emplacement,
          admin,
          langue,
          ref_per,
          created_at,
          roles!fk_users_role_id (
            role_name
          ),
          user_warehouses (
            depot_id,
            depots (
              nom
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedData: UserRecord[] = data.map((u: any) => ({
          id: u.id,
          utilisateur: u.utilisateur,
          nom_prenom: u.nom_prenom || "-",
          role_name: u.roles?.role_name || "Utilisateur",
          emplacement: u.emplacement || "-",
          admin: u.admin || "Non",
          langue: u.langue || "FR",
          ref_per: u.ref_per || "-",
          depots: u.user_warehouses?.map((uw: any) => uw.depots?.nom).filter(Boolean).join(", ") || "",
          depot_ids: u.user_warehouses?.map((uw: any) => uw.depot_id) || [],
          created_at: u.created_at ? new Date(u.created_at).toLocaleString("fr-FR") : "-",
        }));
        setUsers(mappedData);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.utilisateur || (!isEditing && !newUser.mot_de_passe)) {
      alert("Veuillez remplir les champs obligatoires");
      return;
    }

    setIsSubmitting(true);
    try {
      const userData: any = {
        utilisateur: newUser.utilisateur,
        nom_prenom: newUser.nom_prenom,
        role_id: newUser.role_id ? parseInt(newUser.role_id) : null,
        emplacement: newUser.emplacement,
        admin: newUser.admin,
        langue: newUser.langue,
        ref_per: newUser.ref_per
      };

      // Only update password if provided during edit, or required during create
      if (newUser.mot_de_passe) {
        userData.mot_de_passe = newUser.mot_de_passe;
      }

      let userId = newUser.id;

      if (isEditing && userId) {
        const { error } = await supabase
          .from("users")
          .update(userData)
          .eq("id", userId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("users")
          .insert([userData])
          .select("id")
          .single();
        if (error) throw error;
        userId = data.id;
      }

      // --- Sync User Warehouses ---
      if (userId) {
        // 1. Clear existing
        await supabase.from("user_warehouses").delete().eq("user_id", userId);

        // 2. Add new ones and get their names
        let depotsString = "";
        if (newUser.depots.length > 0) {
          const warehouseEntries = newUser.depots.map(depotId => ({
            user_id: userId,
            depot_id: depotId
          }));
          const { error: uwErr } = await supabase.from("user_warehouses").insert(warehouseEntries);
          if (uwErr) throw uwErr;

          // Get names of selected depots to update users.depots
          const selectedDepotNames = availableDepotsData
            .filter(d => newUser.depots.includes(d.id))
            .map(d => d.nom);
          depotsString = selectedDepotNames.join(", ");
        }

        // Update depots column in users table
        const { error: updateDepotsErr } = await supabase
          .from("users")
          .update({ depots: depotsString })
          .eq("id", userId);
        if (updateDepotsErr) {
          console.warn("Failed to update depots column in users table:", updateDepotsErr);
        }
      }

      // Reset form and reload
      handleCloseModal();
      loadData();
    } catch (err: any) {
      console.error("Error saving user:", err);
      alert("Erreur lors de l'enregistrement : " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = (user: UserRecord) => {
    const roleId = roles.find(r => r.role_name === user.role_name)?.id?.toString() || "";

    setNewUser({
      id: user.id,
      utilisateur: user.utilisateur,
      nom_prenom: user.nom_prenom !== "-" ? user.nom_prenom : "",
      mot_de_passe: "", // Don't pre-fill password for security
      role_id: roleId,
      emplacement: user.emplacement !== "-" ? user.emplacement : "",
      admin: user.admin,
      langue: user.langue,
      ref_per: user.ref_per !== "-" ? user.ref_per : "",
      depots: user.depot_ids
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleOpenAdd = () => {
    setNewUser({
      id: null,
      utilisateur: "",
      nom_prenom: "",
      mot_de_passe: "",
      role_id: "",
      emplacement: "",
      admin: "Non",
      langue: "FR",
      ref_per: "",
      depots: []
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsDepotDropdownOpen(false);
  };

  const toggleDepot = (depotId: number) => {
    setNewUser(prev => {
      const exists = prev.depots.includes(depotId);
      if (exists) {
        return { ...prev, depots: prev.depots.filter(id => id !== depotId) };
      } else {
        return { ...prev, depots: [...prev.depots, depotId] };
      }
    });
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cet utilisateur ?")) return;
    
    try {
      const { error } = await supabase.from("users").delete().eq("id", id);
      if (error) throw error;
      loadData();
    } catch (err: any) {
      alert("Erreur lors de la suppression : " + err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     STATISTICS & FILTERING
     ═══════════════════════════════════════════════════════════════ */

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.admin === "Oui" || u.role_name.toLowerCase().includes("admin")).length;
    const staff = total - admins;
    const roles = Array.from(new Set(users.map((u) => u.role_name))).length;

    return { total, admins, staff, roles };
  }, [users]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.utilisateur.toLowerCase().includes(q) ||
        u.nom_prenom.toLowerCase().includes(q) ||
        u.role_name.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className="min-h-screen text-slate-900 p-6 lg:p-10 -m-6 lg:-m-10">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "#f1f5f9" }}>
               <Users className="text-slate-600" size={24} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900" style={{ letterSpacing: "-0.025em" }}>
              Gestion des Utilisateurs
            </h1>
          </div>
          <p className="text-slate-500 text-sm font-medium ml-11">
            Contrôlez les accès et gérez les comptes de votre équipe
          </p>
        </div>

        <button 
          onClick={handleOpenAdd}
          className="flex items-center gap-2 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 group bg-[#6366f1] shadow-indigo-100">
          <Plus size={18} className="transition-transform group-hover:rotate-90" />
          Nouvel Utilisateur
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {[
          { label: "Utilisateurs", value: stats.total, icon: Users, color: "text-[#6366f1]", bg: "bg-indigo-50" },
          { label: "Administrateurs", value: stats.admins, icon: ShieldCheck, color: "text-rose-500", bg: "bg-rose-50" },
          { label: "Vendeurs", value: stats.staff, icon: ShoppingCart, color: "text-emerald-500", bg: "bg-emerald-50" },
          { label: "Rôles Actifs", value: stats.roles, icon: Contact2, color: "text-amber-500", bg: "bg-amber-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[28px] border border-slate-100/50 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex items-center gap-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all duration-300">
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

      {/* Search & Filter Bar Section */}
      <div className="p-2 rounded-[28px] shadow-xl shadow-slate-200/50 mb-8 border border-white/60 bg-white/40 backdrop-blur-xl">
        <div className="relative flex items-center rounded-[22px] border border-slate-200/60 bg-slate-50/50 pr-2">
          <div className="pl-5 pr-3">
            <Search className="text-slate-400" size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Rechercher..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent py-4 text-slate-800 font-medium focus:outline-none"
          />
          <button 
            onClick={loadData}
            disabled={refreshing}
            className="p-3 text-slate-400 hover:text-slate-600 transition-all rounded-xl disabled:opacity-50"
            style={{ backgroundColor: "transparent" }}
          >
            <RefreshCw className={cn("transition-all", refreshing && "animate-spin")} size={18} />
          </button>
        </div>

        {/* Sub-Filters */}
        <div className="flex items-center gap-4 mt-2 px-2 pb-1">
          <button className="flex items-center gap-2 px-4 py-2 border rounded-xl text-slate-600 text-sm font-bold transition-all hover:bg-slate-50" style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}>
            <Filter size={14} />
            Tous les rôles
            <ChevronRight size={14} className="rotate-90 ml-1 text-slate-300" />
          </button>
          
          <button className="flex items-center gap-2 px-4 py-2 border rounded-xl text-slate-600 text-sm font-bold transition-all hover:bg-slate-50" style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}>
            <MoreHorizontal size={14} />
            Statut
            <ChevronRight size={14} className="rotate-90 ml-1 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Data Container (Table or EmptyState) */}
      <div className="rounded-[48px] border border-white/80 bg-white/60 backdrop-blur-3xl shadow-2xl shadow-indigo-100/40 flex flex-col overflow-hidden min-h-[400px] transition-all duration-300">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-20">
             <Loader2 size={40} className="animate-spin text-indigo-500 mb-4" />
             <p className="text-slate-400 font-black tracking-tight">Chargement des utilisateurs...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          /* Empty State Illustration */
          <div className="flex-1 flex flex-col items-center justify-center p-20 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 blur-3xl opacity-60 rounded-full scale-150 bg-indigo-100"></div>
              <div className="relative w-32 h-32 rounded-[32px] flex items-center justify-center border-4 border-white shadow-xl bg-slate-50 overflow-hidden">
                 <UserCircle2 size={128} className="-mb-8 text-slate-300" />
              </div>
              <div className="absolute -bottom-2 -right-2 p-3 rounded-2xl shadow-lg bg-white">
                 <AlertCircle size={28} className="text-indigo-500" />
              </div>
            </div>
            
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Aucun utilisateur trouvé</h2>
            <p className="text-slate-500 font-bold mb-8 max-w-sm">
              Ajoutez un nouvel utilisateur pour commencer à gérer votre équipe.
            </p>
            
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-3 text-white px-8 py-4 rounded-[22px] font-black shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 group bg-indigo-600">
              <Plus size={22} className="transition-transform group-hover:rotate-90" />
              Créer utilisateur
            </button>
          </div>
        ) : (
          /* Modern Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[2px]">ID</th>
                  <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[2px]">Identifiant</th>
                  <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[2px]">Nom Complet</th>
                  <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[2px]">Rôle</th>
                  <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[2px]">Dépôts Autorisés</th>
                  <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[2px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-5">
                      <span className="text-slate-400 font-mono text-xs">#{user.id.toString().padStart(4, '0')}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                           <UserCircle2 size={20} className="text-slate-500" />
                        </div>
                        <span className="font-bold text-slate-800">{user.utilisateur}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600">
                      {user.nom_prenom}
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-black",
                        user.role_name.toLowerCase().includes("admin") ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {user.role_name}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {user.depots ? user.depots.split(", ").map((d, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                            {d}
                          </span>
                        )) : (
                          <span className="text-slate-300 text-[10px] font-bold italic">Tous accès</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- ADD USER MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}
          ></div>
          
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-[#f8fafc]">
              <div>
                <h2 className="text-xl font-black text-slate-800">{isEditing ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}</h2>
                <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-wider">
                  {isEditing ? `ID: #${newUser.id?.toString().padStart(4, '0')}` : "Informations du compte"}
                </p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="p-2 hover:bg-slate-200 rounded-xl transition-all"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-8 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Identifiant (Unique)</label>
                  <input 
                    required
                    type="text" 
                    value={newUser.utilisateur}
                    onChange={(e) => setNewUser({...newUser, utilisateur: e.target.value})}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="e.g. jdoe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    {isEditing ? "Nouveau MDP (Optionnel)" : "Mot de passe"}
                  </label>
                  <input 
                    required={!isEditing}
                    type="password" 
                    value={newUser.mot_de_passe}
                    onChange={(e) => setNewUser({...newUser, mot_de_passe: e.target.value})}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nom complet</label>
                <input 
                  type="text" 
                  value={newUser.nom_prenom}
                  onChange={(e) => setNewUser({...newUser, nom_prenom: e.target.value})}
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="John Doe"
                />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rôle Système</label>
                  <select 
                    value={newUser.role_id}
                    onChange={(e) => setNewUser({...newUser, role_id: e.target.value})}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                  >
                    <option value="">Sélectionner...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.role_name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Administrateur ?</label>
                  <select 
                    value={newUser.admin}
                    onChange={(e) => setNewUser({...newUser, admin: e.target.value})}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                  >
                    <option value="Non">Non</option>
                    <option value="Oui">Oui (Accès complet)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dépôts Autorisés (Multi-sélection)</label>
                <div className="relative">
                  <button 
                    type="button"
                    onClick={() => setIsDepotDropdownOpen(!isDepotDropdownOpen)}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold flex items-center justify-between transition-all hover:bg-slate-100/50"
                  >
                    <span className="truncate">
                      {newUser.depots.length === 0 ? "Aucun (Accès à tous)" : `${newUser.depots.length} dépôt(s) sélectionné(s)`}
                    </span>
                    <ChevronDown size={16} className={cn("transition-transform", isDepotDropdownOpen && "rotate-180")} />
                  </button>
                  
                  {isDepotDropdownOpen && (
                    <div className="absolute z-10 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl p-2 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                      {availableDepotsData.length === 0 ? (
                        <p className="text-center py-4 text-xs font-bold text-slate-400 italic">Aucun dépôt trouvé</p>
                      ) : (
                        availableDepotsData.map(depot => (
                          <div 
                            key={depot.id}
                            onClick={() => toggleDepot(depot.id)}
                            className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                          >
                            <span className="text-sm font-bold text-slate-700">{depot.nom}</span>
                            {newUser.depots.includes(depot.id) && <Check size={16} className="text-blue-600" />}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Emplacement Principal</label>
                  <input 
                    type="text" 
                    value={newUser.emplacement}
                    onChange={(e) => setNewUser({...newUser, emplacement: e.target.value})}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="Magasin Principal"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Langue</label>
                  <select 
                    value={newUser.langue}
                    onChange={(e) => setNewUser({...newUser, langue: e.target.value})}
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                  >
                    <option value="FR">Français</option>
                    <option value="AR">العربية</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-4 rounded-[18px] font-black transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 text-white px-6 py-4 rounded-[18px] font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 bg-[#6366f1] disabled:opacity-70"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (isEditing ? <Save size={20} /> : <UserPlus size={20} />)}
                  {isEditing ? "Enregistrer" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        
        body {
          font-family: 'Outfit', sans-serif;
        }
      `}</style>
    </div>
  );
}

// Minimal Store icon if Store from lucide-react is not available
function Store({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7" />
    </svg>
  );
}
