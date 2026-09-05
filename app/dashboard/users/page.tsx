"use client";

import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/context";
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ChevronRight,
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
  Building2,
  Crown,
  Key,
  MessageSquare,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  is_active?: boolean;
};

const supabase = createClient();

export default function UserManagementPage() {
  const { t, locale, dir } = useLanguage();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<{ id: number; role_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    depots: [] as number[],
  });

  const [availableDepotsData, setAvailableDepotsData] = useState<{ id: number; nom: string }[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDepotDropdownOpen, setIsDepotDropdownOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentOrgId, setCurrentOrgId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/users");
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Erreur de chargement");
      }
      const data = await res.json();

      if (data.currentOrgId) {
        setCurrentOrgId(data.currentOrgId);
      }

      if (data.roles && data.roles.length >= 2) {
        setRoles(data.roles);
      } else {
        setRoles([
          { id: 1, role_name: "Admin" },
          { id: 2, role_name: "Manager" },
          { id: 3, role_name: "Gérant de Dépôt" },
          { id: 4, role_name: "Caissier" },
          { id: 5, role_name: "Comptable" },
          { id: 6, role_name: "Livreur" },
        ]);
      }

      if (data.depots) {
        setAvailableDepotsData(data.depots);
      }

      if (data.users) {
        const mappedData: UserRecord[] = data.users.map((u: any) => ({
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
    } catch (err: any) {
      console.error("Failed to load users:", err);
      setToast({ message: "Erreur de chargement des utilisateurs", type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setNewUser({
      id: null,
      utilisateur: "",
      nom_prenom: "",
      mot_de_passe: "",
      role_id: roles[0] ? String(roles[0].id) : "1",
      emplacement: availableDepotsData[0] ? availableDepotsData[0].nom : "BOUTIQUE",
      admin: "Non",
      langue: "fr",
      ref_per: "",
      depots: [],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: UserRecord) => {
    setIsEditing(true);
    const matchedRole = roles.find((r) => r.role_name === u.role_name);
    setNewUser({
      id: u.id,
      utilisateur: u.utilisateur,
      nom_prenom: u.nom_prenom === "-" ? "" : u.nom_prenom,
      mot_de_passe: "",
      role_id: matchedRole ? String(matchedRole.id) : "1",
      emplacement: u.emplacement,
      admin: u.admin,
      langue: u.langue.toLowerCase(),
      ref_per: u.ref_per === "-" ? "" : u.ref_per,
      depots: u.depot_ids || [],
    });
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.utilisateur || (!isEditing && !newUser.mot_de_passe)) {
      setToast({ message: "Veuillez remplir les champs obligatoires", type: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newUser.id,
          utilisateur: newUser.utilisateur,
          nom_prenom: newUser.nom_prenom,
          role_id: newUser.role_id ? parseInt(newUser.role_id) : null,
          emplacement: newUser.emplacement,
          admin: newUser.admin,
          langue: newUser.langue,
          ref_per: newUser.ref_per,
          mot_de_passe: newUser.mot_de_passe || undefined,
          depots: newUser.depots,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Erreur de sauvegarde");
      }

      setToast({
        message: isEditing ? "Utilisateur modifié avec succès" : "Nouvel utilisateur créé avec succès",
        type: "success",
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Erreur de sauvegarde", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: number, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'utilisateur "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Erreur lors de la suppression");
      }
      setToast({ message: "Utilisateur supprimé", type: "success" });
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Erreur lors de la suppression", type: "error" });
    }
  };

  const handleShareCredentialsWhatsApp = (u: UserRecord) => {
    const text = encodeURIComponent(
      locale === "ar"
        ? `🔐 بيانات الدخول لنظام GestionPro Global:\n👤 اسم المستخدم: ${u.utilisateur}\n🏢 الفرع: ${u.emplacement}\n🌐 رابط النظام: https://gestion-pro-global-tege.vercel.app/login`
        : `🔐 Vos identifiants d'accès GestionPro Global:\n👤 Identifiant: ${u.utilisateur}\n🏢 Dépôt: ${u.emplacement}\n🌐 Connexion: https://gestion-pro-global-tege.vercel.app/login`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.utilisateur.toLowerCase().includes(q) ||
        u.nom_prenom.toLowerCase().includes(q) ||
        u.role_name.toLowerCase().includes(q) ||
        u.emplacement.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border text-white flex items-center gap-3 animate-in slide-in-from-top-3 ${
            toast.type === "success"
              ? "bg-slate-900 border-emerald-500/30"
              : "bg-rose-950 border-rose-500/30"
          }`}
        >
          {toast.type === "success" ? (
            <ShieldCheck size={20} className="text-emerald-400" />
          ) : (
            <AlertCircle size={20} className="text-rose-400" />
          )}
          <span className="text-xs font-black">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider">
              ADMINISTRATION & CAISSIERS
            </span>
            <span className="text-xs font-bold text-slate-500">
              {locale === "ar" ? "إدارة الموظفين، الكاشيرية وتعيين المستودعات" : "Comptes utilisateurs & affectation des dépôts"}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Users className="text-indigo-600" size={32} />
            {locale === "ar" ? "إدارة المستخدمين والموظفين" : "Gestion des Utilisateurs"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus size={16} />
            <span>{locale === "ar" ? "إضافة مستخدم جديد" : "Nouvel Utilisateur"}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث بالاسم، الكاشير، الدور أو المستودع..." : "Rechercher un utilisateur, rôle, dépôt..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="text-xs font-extrabold text-slate-500">
          Total : <span className="text-indigo-600">{filteredUsers.length}</span> {locale === "ar" ? "حساب" : "comptes"}
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">{locale === "ar" ? "المستخدم" : "Utilisateur"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "الاسم الكامل" : "Nom & Prénom"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "الدور والصلاحية" : "Rôle"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "المستودع الرئيسي" : "Dépôt Principal"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "المستودعات المصرح بها" : "Dépôts Autorisés"}</th>
                <th className="py-3.5 px-4 text-center">{locale === "ar" ? "المدير" : "Admin"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "ar" ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 size={28} className="animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>{locale === "ar" ? "جاري تحميل المستخدمين..." : "Chargement..."}</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {locale === "ar" ? "لا يوجد مستخدمين مطابقين للبحث." : "Aucun utilisateur trouvé."}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isAdmin = u.admin === "Oui" || u.role_name.toLowerCase().includes("admin");

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs uppercase">
                            {u.utilisateur.slice(0, 2)}
                          </div>
                          <span className="font-mono font-black text-slate-900">{u.utilisateur}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-extrabold text-slate-800">
                        {u.nom_prenom}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                            isAdmin
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-indigo-100 text-indigo-800"
                          }`}
                        >
                          {isAdmin ? <Crown size={12} /> : <ShieldCheck size={12} />}
                          {u.role_name}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-bold text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                          {u.emplacement}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {u.depots ? (
                          <div className="flex flex-wrap gap-1">
                            {u.depots.split(", ").map((d, i) => (
                              <span key={i} className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Tous (Admin)</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            isAdmin ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {isAdmin ? "OUI" : "NON"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleShareCredentialsWhatsApp(u)}
                            className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                            title="Envoyer les accès via WhatsApp"
                          >
                            <MessageSquare size={14} />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                            title="Modifier"
                          >
                            <Edit3 size={14} />
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u.id, u.utilisateur)}
                            className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <UserPlus size={16} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {isEditing
                    ? locale === "ar"
                      ? "تعديل بيانات المستخدم"
                      : "Modifier l'Utilisateur"
                    : locale === "ar"
                    ? "إضافة مستخدم / كاشير جديد"
                    : "Créer un Nouvel Utilisateur"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "اسم المستخدم (Login)" : "Identifiant (Login)"} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser.utilisateur}
                    onChange={(e) => setNewUser({ ...newUser, utilisateur: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "الاسم واللقب" : "Nom & Prénom"}
                  </label>
                  <input
                    type="text"
                    value={newUser.nom_prenom}
                    onChange={(e) => setNewUser({ ...newUser, nom_prenom: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "كلمة المرور" : "Mot de passe"}{" "}
                  {isEditing && <span className="text-slate-400 font-normal">(Laissez vide pour conserver)</span>} *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required={!isEditing}
                    value={newUser.mot_de_passe}
                    onChange={(e) => setNewUser({ ...newUser, mot_de_passe: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "الدور والصلاحيات" : "Rôle"}
                  </label>
                  <select
                    value={newUser.role_id}
                    onChange={(e) => setNewUser({ ...newUser, role_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.role_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "المستودع الرئيسي" : "Dépôt Principal"}
                  </label>
                  <select
                    value={newUser.emplacement}
                    onChange={(e) => setNewUser({ ...newUser, emplacement: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    {availableDepotsData.map((d) => (
                      <option key={d.id} value={d.nom}>
                        {d.nom}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multi-Warehouse Assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "المستودعات المصرح له بالبيع والاطلاع عليها" : "Dépôts Autorisés Multi-Agences"}
                </label>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  {availableDepotsData.map((d) => {
                    const isChecked = newUser.depots.includes(d.id);
                    return (
                      <label key={d.id} className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUser({ ...newUser, depots: [...newUser.depots, d.id] });
                            } else {
                              setNewUser({ ...newUser, depots: newUser.depots.filter((id) => id !== d.id) });
                            }
                          }}
                          className="w-4 h-4 rounded text-indigo-600"
                        />
                        <span>{d.nom}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {locale === "ar" ? "إلغاء" : "Annuler"}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{locale === "ar" ? "حفظ المستخدم" : "Enregistrer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
