"use client";

import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import {
  Warehouse,
  MapPin,
  User,
  Search,
  RefreshCw,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  Edit3,
  X,
  Save,
  Check,
  Building2,
  Package,
  Layers,
  ShieldCheck,
  Power,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Depot = {
  id: number;
  nom: string;
  emplacement: string;
  responsable: string;
  is_active: boolean;
  created_at: string;
  articles_count?: number;
  total_value?: number;
};

const supabase = createClient();

export default function DepotManagementPage() {
  const { t, locale, dir } = useLanguage();
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
    is_active: true,
  });

  const [isAdmin, setIsAdmin] = useState(true);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [currentOrgId, setCurrentOrgId] = useState<string>("");

  useEffect(() => {
    try {
      const match = document.cookie.split("; ").find((c) => c.startsWith("gp_session="));
      if (match) {
        const decoded = decodeURIComponent(match.split("=")[1]);
        const data = JSON.parse(decoded);
        if (data.organization_id) {
          setCurrentOrgId(data.organization_id);
          loadData(data.organization_id);
          return;
        }
      }
    } catch {}
    loadData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async (orgIdOverride?: any) => {
    setRefreshing(true);
    const activeOrg = typeof orgIdOverride === "string" ? orgIdOverride : currentOrgId;
    try {
      // 1. Fetch Users for the responsible dropdown (scoped by organization)
      let userQuery = supabase
        .from("users")
        .select("utilisateur, nom_prenom")
        .order("utilisateur");
      if (activeOrg) userQuery = userQuery.eq("organization_id", activeOrg);
      const { data: userData } = await userQuery;

      if (userData) {
        setUsers(userData.map((u) => u.nom_prenom || u.utilisateur));
      }

      // 2. Fetch Depots (scoped by organization)
      let depotQuery = supabase
        .from("depots")
        .select("*")
        .eq("is_deleted", false)
        .order("nom");
      if (activeOrg) depotQuery = depotQuery.eq("organization_id", activeOrg);
      const { data: depotsData, error } = await depotQuery;

      if (error) throw error;

      // 3. Fetch Stock counts per depot (scoped by organization)
      let stockQuery = supabase
        .from("stocks")
        .select("depot_nom, quantite, articles(prix_achat)");
      if (activeOrg) stockQuery = stockQuery.eq("organization_id", activeOrg);
      const { data: stockData } = await stockQuery;

      const stockMap: Record<string, { count: number; value: number }> = {};
      if (stockData) {
        stockData.forEach((st: any) => {
          const dNom = st.depot_nom || "BOUTIQUE";
          if (!stockMap[dNom]) stockMap[dNom] = { count: 0, value: 0 };
          const qty = Number(st.quantite) || 0;
          const cost = Number(st.articles?.prix_achat) || 0;
          stockMap[dNom].count += qty > 0 ? 1 : 0;
          stockMap[dNom].value += qty * cost;
        });
      }

      if (depotsData) {
        const enriched = depotsData.map((d: any) => ({
          ...d,
          articles_count: stockMap[d.nom]?.count || 0,
          total_value: stockMap[d.nom]?.value || 0,
        }));
        setDepots(enriched);
      }
    } catch (err: any) {
      console.error("Failed to load depots:", err);
      setToast({ message: "Erreur de chargement des dépôts", type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setFormData({
      id: null,
      nom: "",
      emplacement: "",
      responsable: users.length > 0 ? users[0] : "",
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (depot: Depot) => {
    setIsEditing(true);
    setFormData({
      id: depot.id,
      nom: depot.nom,
      emplacement: depot.emplacement,
      responsable: depot.responsable,
      is_active: depot.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom.trim()) {
      setToast({ message: "Le nom du dépôt est obligatoire", type: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        nom: formData.nom.toUpperCase().trim(),
        emplacement: formData.emplacement.trim() || formData.nom.trim(),
        responsable: formData.responsable || "Non assigné",
        is_active: formData.is_active,
      };
      if (currentOrgId) {
        payload.organization_id = currentOrgId;
      }

      if (isEditing && formData.id) {
        const { error } = await supabase.from("depots").update(payload).eq("id", formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("depots").insert([payload]);
        if (error) throw error;
      }

      setToast({
        message: isEditing ? "Dépôt mis à jour avec succès" : "Nouveau dépôt créé avec succès",
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

  const handleDelete = async (depot: Depot) => {
    if (depot.articles_count && depot.articles_count > 0) {
      alert("Impossible de supprimer un dépôt contenant des articles en stock. Veuillez d'abord transférer le stock.");
      return;
    }

    if (!confirm(`Voulez-vous vraiment supprimer le dépôt "${depot.nom}" ?`)) return;

    try {
      const { error } = await supabase
        .from("depots")
        .update({ is_deleted: true })
        .eq("id", depot.id);

      if (error) throw error;

      setToast({ message: "Dépôt supprimé", type: "success" });
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Erreur de suppression", type: "error" });
    }
  };

  const filteredDepots = useMemo(() => {
    if (!searchQuery.trim()) return depots;
    const q = searchQuery.toLowerCase();
    return depots.filter(
      (d) =>
        d.nom.toLowerCase().includes(q) ||
        d.emplacement.toLowerCase().includes(q) ||
        d.responsable?.toLowerCase().includes(q)
    );
  }, [depots, searchQuery]);

  const totalStockValue = depots.reduce((sum, d) => sum + (d.total_value || 0), 0);
  const activeDepotsCount = depots.filter((d) => d.is_active).length;

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
            <CheckCircle2 size={20} className="text-emerald-400" />
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
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
              GESTION MULTI-AGENCES
            </span>
            <span className="text-xs font-bold text-slate-500">
              {locale === "ar" ? "إدارة المستودعات، المحلات، والفروع اللوجستية" : "Dépôts, Magasins & Entrepôts Centraux"}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Warehouse className="text-emerald-600" size={32} />
            {locale === "ar" ? "إدارة المستودعات والفروع" : "Gestion des Dépôts"}
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
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>{locale === "ar" ? "إضافة مستودع جديد" : "Nouveau Dépôt"}</span>
          </button>
        </div>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي المستودعات" : "Total Dépôts & Boutiques"}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Store size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{depots.length}</div>
          <div className="text-xs text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
            <CheckCircle2 size={13} />
            <span>{activeDepotsCount} {locale === "ar" ? "مستودعات نشطة" : "actifs et opérationnels"}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "قيمة المخزون الإجمالية" : "Valeur Totale en Stock"}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600">{formatCurrencyAmount(totalStockValue)}</div>
          <div className="text-xs text-slate-500 font-bold mt-1.5">
            {locale === "ar" ? "موزعة على كافة الفروع" : "Répartie sur l'ensemble du réseau"}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-emerald-950 text-white rounded-3xl p-5 shadow-xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-emerald-300 tracking-wider">
              {locale === "ar" ? "تأمين ونطاق البائعين" : "Scoping & Isolation"}
            </span>
            <div className="p-2 rounded-xl bg-white/10 text-emerald-400">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">100% SÉCURISÉ</div>
          <div className="text-xs text-slate-300 font-bold mt-1.5 flex items-center gap-1">
            <Sparkles size={13} className="text-amber-400" />
            <span>{locale === "ar" ? "تخصيص صارم لكل بائع" : "Filtrage automatique par agence"}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث باسم المستودع، الموقع، أو المسؤول..." : "Rechercher un dépôt, emplacement, responsable..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="text-xs font-extrabold text-slate-500">
          Total : <span className="text-emerald-600">{filteredDepots.length}</span> {locale === "ar" ? "مستودع" : "dépôts"}
        </div>
      </div>

      {/* Depots Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 size={32} className="animate-spin mx-auto text-emerald-600 mb-2" />
            <span>{locale === "ar" ? "جاري تحميل المستودعات..." : "Chargement des dépôts..."}</span>
          </div>
        ) : filteredDepots.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Warehouse size={36} className="mx-auto text-slate-300 mb-2" />
            <span>{locale === "ar" ? "لا يوجد مستودع مطابق للبحث." : "Aucun dépôt trouvé."}</span>
          </div>
        ) : (
          filteredDepots.map((depot) => (
            <div
              key={depot.id}
              className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:shadow-lg transition-all space-y-4 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                    <Warehouse size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                      {depot.nom}
                    </h3>
                    <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={12} />
                      <span>{depot.emplacement}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    depot.is_active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {depot.is_active ? "ACTIF" : "INACTIF"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs font-bold">
                <div>
                  <span className="text-slate-400 text-[11px] block">{locale === "ar" ? "المسؤول" : "Responsable"}</span>
                  <span className="text-slate-800 flex items-center gap-1 mt-0.5">
                    <User size={12} className="text-emerald-600" />
                    {depot.responsable || "Non assigné"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 text-[11px] block">{locale === "ar" ? "أصناف متوفرة" : "Articles Stock"}</span>
                  <span className="text-indigo-600 font-black mt-0.5 block">
                    {depot.articles_count || 0} références
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase block">
                    {locale === "ar" ? "قيمة المخزون" : "Valeur Stock"}
                  </span>
                  <span className="text-sm font-black text-emerald-600">
                    {formatCurrencyAmount(depot.total_value || 0)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEditModal(depot)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors cursor-pointer"
                    title="Modifier"
                  >
                    <Edit3 size={14} />
                  </button>

                  <button
                    onClick={() => handleDelete(depot)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition-colors cursor-pointer"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Warehouse size={16} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {isEditing
                    ? locale === "ar"
                      ? "تعديل بيانات المستودع"
                      : "Modifier le Dépôt"
                    : locale === "ar"
                    ? "إضافة مستودع / فرع جديد"
                    : "Créer un Nouveau Dépôt"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "اسم المستودع / الفرع" : "Nom du Dépôt"} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: DEPOT PRINCIPAL NIGER"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "الموقع الجغرافي / العنوان" : "Emplacement / Adresse"}
                </label>
                <input
                  type="text"
                  placeholder="Ex: Zone Industrielle, Niamey"
                  value={formData.emplacement}
                  onChange={(e) => setFormData({ ...formData, emplacement: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "المسؤول عن المستودع" : "Responsable du Dépôt"}
                </label>
                <select
                  value={formData.responsable}
                  onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="">Sélectionner un responsable...</option>
                  {users.map((u, i) => (
                    <option key={i} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600"
                  />
                  <span>{locale === "ar" ? "المستودع نشط وجاهز للعمليات" : "Dépôt actif pour les ventes et mouvements"}</span>
                </label>
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
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{locale === "ar" ? "حفظ المستودع" : "Enregistrer"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
