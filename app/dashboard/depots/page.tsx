"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
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
  ArrowRightLeft,
  Eye,
  Download,
  Phone,
  Boxes,
  FileSpreadsheet,
  LayoutGrid,
  List,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type DepotStockItem = {
  id: number;
  article_id: number;
  reference: string;
  designation: string;
  quantite: number;
  prix_achat: number;
  prix_vente: number;
  valeur_achat: number;
  valeur_vente: number;
  qte_min: number;
  is_low_stock: boolean;
  is_negative: boolean;
};

export type Depot = {
  id: number;
  nom: string;
  emplacement: string;
  adresse?: string | null;
  telephone?: string | null;
  responsable: string;
  is_active: boolean;
  created_at: string;
  articles_count?: number;
  total_units?: number;
  total_value?: number;
  total_sale_value?: number;
  low_stock_count?: number;
  negative_stock_count?: number;
  items?: DepotStockItem[];
};

type GlobalSummary = {
  total_depots: number;
  active_depots: number;
  global_stock_value: number;
  global_sale_value: number;
  global_units: number;
  global_references: number;
  global_alerts: number;
};

const supabase = createClient();

export default function DepotManagementPage() {
  const { t, locale, dir } = useLanguage();
  const [depots, setDepots] = useState<Depot[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [summary, setSummary] = useState<GlobalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "WITH_STOCK">("ALL");
  const [sortBy, setSortBy] = useState<"VALUE_DESC" | "NAME_ASC" | "ITEMS_DESC">("VALUE_DESC");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("GRID");
  const [refreshing, setRefreshing] = useState(false);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null as number | null,
    nom: "",
    emplacement: "",
    adresse: "",
    telephone: "",
    responsable: "",
    is_active: true,
  });

  // Stock Inspection Modal State
  const [inspectedDepot, setInspectedDepot] = useState<Depot | null>(null);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockTabFilter, setStockTabFilter] = useState<"ALL" | "POSITIVE" | "NEGATIVE" | "ALERT">("ALL");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [currentOrgId, setCurrentOrgId] = useState<string>("");
  const [orgName, setOrgName] = useState<string>("");

  useEffect(() => {
    try {
      const match = document.cookie.split("; ").find((c) => c.startsWith("gp_session="));
      if (match) {
        const decoded = decodeURIComponent(match.split("=")[1]);
        const data = JSON.parse(decoded);
        if (data.organization_id) setCurrentOrgId(data.organization_id);
        if (data.organization_name) setOrgName(data.organization_name);
        else if (data.nom_prenom) setOrgName(data.nom_prenom);
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

  const loadData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/depots", { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Erreur de chargement");
      }
      const data = await res.json();
      if (data.currentOrgId) setCurrentOrgId(data.currentOrgId);
      if (data.users) setUsers(data.users);
      if (data.depots) setDepots(data.depots);
      if (data.summary) setSummary(data.summary);

      // Refresh inspected depot if currently open
      if (inspectedDepot && data.depots) {
        const updated = data.depots.find((d: Depot) => d.id === inspectedDepot.id);
        if (updated) setInspectedDepot(updated);
      }
    } catch (err: any) {
      console.error("Failed to load depots:", err);
      setToast({ message: "Erreur de chargement des dépôts", type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleOpenAddModal = () => {
    setIsEditing(false);
    setFormData({
      id: null,
      nom: "",
      emplacement: "",
      adresse: "",
      telephone: "",
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
      adresse: depot.adresse || "",
      telephone: depot.telephone || "",
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
      const res = await fetch("/api/depots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEditing ? formData.id : undefined,
          nom: formData.nom.toUpperCase().trim(),
          emplacement: formData.emplacement.trim() || formData.nom.trim(),
          adresse: formData.adresse.trim() || formData.emplacement.trim() || formData.nom.trim(),
          telephone: formData.telephone.trim() || null,
          responsable: formData.responsable || "Non assigné",
          is_active: formData.is_active,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Erreur de sauvegarde");
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
      alert(
        locale === "ar"
          ? "لا يمكن حذف مستودع يحتوي على بضاعة أو مخزون حالي. يرجى تحويل المخزون أولاً إلى مستودع آخر."
          : "Impossible de supprimer un dépôt contenant des articles en stock. Veuillez d'abord transférer le stock."
      );
      return;
    }

    if (
      !confirm(
        locale === "ar"
          ? `هل أنت متأكد من رغبتك في حذف المستودع "${depot.nom}"؟`
          : `Voulez-vous vraiment supprimer le dépôt "${depot.nom}" ?`
      )
    )
      return;

    try {
      const res = await fetch(`/api/depots?id=${depot.id}`, { method: "DELETE" });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Erreur de suppression");
      }

      setToast({ message: "Dépôt supprimé", type: "success" });
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Erreur de suppression", type: "error" });
    }
  };

  // Filter & Sort Depots
  const filteredDepots = useMemo(() => {
    let list = [...depots];

    // Status filter
    if (statusFilter === "ACTIVE") list = list.filter((d) => d.is_active);
    else if (statusFilter === "INACTIVE") list = list.filter((d) => !d.is_active);
    else if (statusFilter === "WITH_STOCK") list = list.filter((d) => (d.total_value || 0) > 0 || (d.articles_count || 0) > 0);

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.nom.toLowerCase().includes(q) ||
          (d.emplacement && d.emplacement.toLowerCase().includes(q)) ||
          (d.adresse && d.adresse.toLowerCase().includes(q)) ||
          (d.responsable && d.responsable.toLowerCase().includes(q))
      );
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "VALUE_DESC") return (b.total_value || 0) - (a.total_value || 0);
      if (sortBy === "ITEMS_DESC") return (b.articles_count || 0) - (a.articles_count || 0);
      if (sortBy === "NAME_ASC") return a.nom.localeCompare(b.nom);
      return 0;
    });

    return list;
  }, [depots, searchQuery, statusFilter, sortBy]);

  // Calculated totals
  const totalStockValue = summary?.global_stock_value ?? depots.reduce((sum, d) => sum + (d.total_value || 0), 0);
  const totalSaleValue = summary?.global_sale_value ?? depots.reduce((sum, d) => sum + (d.total_sale_value || 0), 0);
  const totalUnitsCount = summary?.global_units ?? depots.reduce((sum, d) => sum + (d.total_units || 0), 0);
  const activeDepotsCount = summary?.active_depots ?? depots.filter((d) => d.is_active).length;
  const totalDepotsWithStock = depots.filter((d) => (d.total_value || 0) > 0).length;
  const totalNetworkAlerts = summary?.global_alerts ?? depots.reduce((sum, d) => sum + (d.negative_stock_count || 0) + (d.low_stock_count || 0), 0);

  // Filter inspected depot items
  const filteredInspectedItems = useMemo(() => {
    if (!inspectedDepot || !inspectedDepot.items) return [];
    let items = [...inspectedDepot.items];

    if (stockTabFilter === "POSITIVE") items = items.filter((it) => it.quantite > 0);
    else if (stockTabFilter === "NEGATIVE") items = items.filter((it) => it.quantite < 0);
    else if (stockTabFilter === "ALERT") items = items.filter((it) => it.is_low_stock || it.is_negative);

    if (stockSearchQuery.trim()) {
      const q = stockSearchQuery.toLowerCase();
      items = items.filter(
        (it) =>
          it.designation.toLowerCase().includes(q) ||
          it.reference.toLowerCase().includes(q)
      );
    }

    return items;
  }, [inspectedDepot, stockSearchQuery, stockTabFilter]);

  // Export inventory of a depot to CSV
  const exportDepotStockCSV = (depot: Depot) => {
    if (!depot.items || depot.items.length === 0) {
      alert("Aucun article en stock à exporter.");
      return;
    }

    const headers = ["Code Art", "Désignation", "Quantité", "P.U Achat", "P.U Vente", "Valeur Stock (Achat)", "Statut"];
    const rows = depot.items.map((it) => [
      `"${it.reference}"`,
      `"${it.designation.replace(/"/g, '""')}"`,
      it.quantite,
      it.prix_achat,
      it.prix_vente,
      it.valeur_achat,
      it.is_negative ? "NÉGATIF" : it.is_low_stock ? "ALERTE STOCK" : "NORMAL",
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Stock_${depot.nom.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDepotIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("boutique") || lower.includes("magasin")) return <Store size={22} />;
    return <Warehouse size={22} />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16">
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

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
              GESTION MULTI-AGENCES
            </span>
            {orgName && (
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-300/60">
                <Building2 size={11} />
                {orgName} ({locale === "ar" ? "معزول ومستقل" : "Mode Isolé"})
              </span>
            )}
            <span className="text-xs font-bold text-slate-400">
              {locale === "ar" ? "المستودعات، نقاط البيع، والمخازن اللوجستية" : "Dépôts, Magasins & Entrepôts Centraux"}
            </span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black shadow-inner">
              <Warehouse size={24} />
            </div>
            {locale === "ar" ? "إدارة المستودعات وتقييم المخزون" : "Gestion des Dépôts & Valorisation Stock"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => loadData()}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
            title="Rafraîchir les données"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-emerald-600" : "text-slate-500"} />
            <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
          </button>

          <Link
            href="/dashboard/stock"
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-all flex items-center gap-2"
          >
            <Boxes size={15} className="text-indigo-600" />
            <span>{locale === "ar" ? "جرد المخزون العام" : "Inventaire Global"}</span>
          </Link>

          <button
            onClick={handleOpenAddModal}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>{locale === "ar" ? "مستودع جديد" : "Nouveau Dépôt"}</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Depots */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي المستودعات" : "Total Dépôts & Boutiques"}
            </span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
              <Store size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{depots.length}</div>
          <div className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            <span>{activeDepotsCount} {locale === "ar" ? "مستودعات نشطة وقيد التشغيل" : "actifs et opérationnels"}</span>
          </div>
        </div>

        {/* Card 2: Valeur Totale du Stock (HIGHLIGHT) */}
        <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-5 shadow-xl border border-emerald-500/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-[11px] font-extrabold uppercase text-emerald-300 tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-300 animate-pulse" />
              {locale === "ar" ? "قيمة المخزون (شراء)" : "Valeur Totale en Stock"}
            </span>
            <div className="p-2 rounded-xl bg-white/10 text-emerald-300">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-white tracking-tight relative z-10">
            {formatCurrencyAmount(totalStockValue)}
          </div>
          <div className="text-[11px] text-emerald-200/90 font-bold mt-2 relative z-10 flex items-center justify-between">
            <span>{locale === "ar" ? "قيمة البيع المتوقعة:" : "Potentiel Vente TTC:"}</span>
            <span className="font-extrabold text-white">{formatCurrencyAmount(totalSaleValue)}</span>
          </div>
        </div>

        {/* Card 3: Total Units & References */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الوحدات والأصناف" : "Unités & Références"}
            </span>
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <Layers size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-indigo-700">
            {Number(totalUnitsCount).toLocaleString()} <span className="text-sm font-bold text-slate-500">unités</span>
          </div>
          <div className="text-xs text-slate-500 font-bold mt-2 flex items-center gap-1">
            <Package size={14} className="text-indigo-500" />
            <span>{depots.reduce((sum, d) => sum + (d.articles_count || 0), 0)} {locale === "ar" ? "مرجع موزع بالمخازن" : "références réparties"}</span>
          </div>
        </div>

        {/* Card 4: Network Security & Isolation */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "عزل وأمان الفروع" : "Scoping & Isolation"}
            </span>
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">100% SÉCURISÉ</div>
          <div className="text-xs text-slate-500 font-bold mt-2 flex items-center gap-1">
            {totalNetworkAlerts > 0 ? (
              <span className="text-amber-600 flex items-center gap-1 font-extrabold">
                <AlertTriangle size={13} />
                {totalNetworkAlerts} {locale === "ar" ? "أصناف بها تنبيه مخزون" : "alertes de stock réseau"}
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 size={13} />
                {locale === "ar" ? "عزل تلقائي حسب كل كاشير" : "Filtrage automatique par agence"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar & Interactive Filter Toolbar */}
      <div className="bg-white rounded-3xl p-4 lg:p-5 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث باسم المستودع، الموقع، أو المسؤول..." : "Rechercher dépôt, emplacement, responsable..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "ALL", label: locale === "ar" ? "الكل" : "Tous", count: depots.length },
            { id: "ACTIVE", label: locale === "ar" ? "نشط" : "Actifs", count: activeDepotsCount },
            { id: "WITH_STOCK", label: locale === "ar" ? "به مخزون" : "Avec Stock", count: totalDepotsWithStock },
            { id: "INACTIVE", label: locale === "ar" ? "معطل" : "Inactifs", count: depots.length - activeDepotsCount },
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                statusFilter === chip.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              <span>{chip.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${statusFilter === chip.id ? "bg-white/20 text-white" : "bg-white text-slate-700"}`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sort & View Mode Switch */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-none cursor-pointer"
          >
            <option value="VALUE_DESC">{locale === "ar" ? "الأعلى قيمة مخزون" : "Valeur Stock (Décroissante)"}</option>
            <option value="ITEMS_DESC">{locale === "ar" ? "الأكثر أصنافاً" : "Nombre d'articles"}</option>
            <option value="NAME_ASC">{locale === "ar" ? "الاسم أ - ي" : "Nom (A - Z)"}</option>
          </select>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode("GRID")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "GRID" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Vue Grille"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("TABLE")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === "TABLE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-400 hover:text-slate-600"
              }`}
              title="Vue Tableau"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Depots Display Area */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <Loader2 size={36} className="animate-spin mx-auto text-emerald-600 mb-3" />
          <span className="text-sm font-bold">{locale === "ar" ? "جاري تحميل بيانات المستودعات وتقييم المخزون..." : "Chargement des dépôts et valorisation des stocks..."}</span>
        </div>
      ) : filteredDepots.length === 0 ? (
        <div className="py-20 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <Warehouse size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-700">{locale === "ar" ? "لا يوجد مستودع مطابق لمعايير البحث." : "Aucun dépôt ne correspond à vos critères."}</p>
          <p className="text-xs text-slate-400 mt-1">{locale === "ar" ? "حاول تغيير نص البحث أو الفلتر." : "Essayez de modifier votre recherche ou filtre."}</p>
        </div>
      ) : viewMode === "GRID" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepots.map((depot) => {
            const hasAlerts = (depot.negative_stock_count || 0) > 0 || (depot.low_stock_count || 0) > 0;
            const isStore = depot.nom.toLowerCase().includes("boutique");

            return (
              <div
                key={depot.id}
                className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:shadow-xl hover:border-emerald-500/40 transition-all space-y-4 relative overflow-hidden flex flex-col justify-between group"
              >
                {/* Card Top */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shadow-inner transition-transform group-hover:scale-105 ${
                          isStore
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                        }`}
                      >
                        {getDepotIcon(depot.nom)}
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                          {depot.nom}
                        </h3>
                        <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <MapPin size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]">{depot.emplacement || depot.adresse || "Siège"}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        depot.is_active
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300/60"
                          : "bg-rose-100 text-rose-800 border border-rose-300/60"
                      }`}
                    >
                      {depot.is_active ? (locale === "ar" ? "نشط" : "ACTIF") : (locale === "ar" ? "معطل" : "INACTIF")}
                    </span>
                  </div>

                  {/* Stock Value Highlight Box */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/40 border border-emerald-100/80">
                    <div className="flex items-center justify-between text-[11px] font-extrabold uppercase text-slate-400 mb-1">
                      <span>{locale === "ar" ? "قيمة المخزون (سعر الشراء)" : "Valeur Stock (Achat)"}</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                        PUMP / Achat
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-700 tracking-tight">
                      {formatCurrencyAmount(depot.total_value || 0)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mt-1.5 pt-1.5 border-t border-slate-200/60">
                      <span>{locale === "ar" ? "قيمة البيع المحتملة:" : "Valeur Vente Estimée:"}</span>
                      <span className="text-slate-800 font-extrabold">{formatCurrencyAmount(depot.total_sale_value || 0)}</span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 py-2 text-xs font-bold">
                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-[10px] uppercase font-extrabold block">
                        {locale === "ar" ? "المسؤول" : "Responsable"}
                      </span>
                      <span className="text-slate-800 flex items-center gap-1.5 mt-1 truncate">
                        <User size={13} className="text-emerald-600 shrink-0" />
                        <span className="truncate">{depot.responsable || "Non assigné"}</span>
                      </span>
                    </div>

                    <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-400 text-[10px] uppercase font-extrabold block">
                        {locale === "ar" ? "الأصناف المتوفرة" : "Articles en Stock"}
                      </span>
                      <span className="text-indigo-600 font-black mt-1 flex items-center gap-1.5">
                        <Package size={13} className="shrink-0" />
                        <span>{depot.articles_count || 0} références</span>
                      </span>
                    </div>
                  </div>

                  {/* Units & Alerts pill */}
                  <div className="flex items-center justify-between text-[11px] font-bold px-1">
                    <span className="text-slate-500">
                      Total Unités: <strong className="text-slate-800">{Number(depot.total_units || 0).toLocaleString()}</strong>
                    </span>
                    {hasAlerts && (
                      <span className="text-rose-600 flex items-center gap-1 font-extrabold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/60 text-[10px]">
                        <AlertTriangle size={11} />
                        {(depot.negative_stock_count || 0) > 0 ? "Stock Négatif Détecté" : "Stock Faible"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Actions Bar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setInspectedDepot(depot)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Eye size={14} />
                    <span>{locale === "ar" ? "معاينة المخزون" : "Voir Stock"}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/stock/transit?from_depot=${encodeURIComponent(depot.nom)}`}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 transition-colors cursor-pointer"
                      title={locale === "ar" ? "تحويل بضاعة من هذا المستودع" : "Transférer du stock"}
                    >
                      <ArrowRightLeft size={14} />
                    </Link>

                    <button
                      onClick={() => handleOpenEditModal(depot)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors cursor-pointer"
                      title={locale === "ar" ? "تعديل بيانات المستودع" : "Modifier"}
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      onClick={() => handleDelete(depot)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition-colors cursor-pointer"
                      title={locale === "ar" ? "حذف المستودع" : "Supprimer"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <tr>
                  <th className="py-4 px-6">Dépôt</th>
                  <th className="py-4 px-4">Emplacement / Adresse</th>
                  <th className="py-4 px-4">Responsable</th>
                  <th className="py-4 px-4 text-center">Statut</th>
                  <th className="py-4 px-4 text-center">Références</th>
                  <th className="py-4 px-4 text-center">Unités</th>
                  <th className="py-4 px-4 text-right">Valeur Stock (Achat)</th>
                  <th className="py-4 px-4 text-right">Valeur Vente (Estimée)</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDepots.map((depot) => (
                  <tr key={depot.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-black text-slate-900 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        {getDepotIcon(depot.nom)}
                      </div>
                      <span className="hover:text-emerald-700 transition-colors">{depot.nom}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span>{depot.emplacement || depot.adresse || "-"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="flex items-center gap-1">
                        <User size={12} className="text-emerald-600 shrink-0" />
                        <span>{depot.responsable || "Non assigné"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          depot.is_active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {depot.is_active ? "ACTIF" : "INACTIF"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-extrabold text-indigo-600">
                      {depot.articles_count || 0}
                    </td>
                    <td className="py-3.5 px-4 text-center font-extrabold text-slate-800">
                      {Number(depot.total_units || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                      {formatCurrencyAmount(depot.total_value || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-500">
                      {formatCurrencyAmount(depot.total_sale_value || 0)}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setInspectedDepot(depot)}
                          className="p-2 rounded-xl bg-slate-900 text-white hover:bg-emerald-700 transition-colors"
                          title="Voir Stock"
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(depot)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 transition-colors"
                          title="Modifier"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(depot)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: INSPECTION DU STOCK DU DÉPÔT (Interactive Drawer/Modal) ─── */}
      {inspectedDepot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 lg:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md">
                  <Warehouse size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">{inspectedDepot.nom}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        inspectedDepot.is_active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {inspectedDepot.is_active ? "ACTIF" : "INACTIF"}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-400 flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} />
                      {inspectedDepot.emplacement || inspectedDepot.adresse || "Siège"}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {inspectedDepot.responsable || "Non assigné"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportDepotStockCSV(inspectedDepot)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  title="Exporter l'inventaire en CSV"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Exporter CSV</span>
                </button>

                <button
                  onClick={() => setInspectedDepot(null)}
                  className="p-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="p-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Références</span>
                <span className="text-lg font-black text-white">{inspectedDepot.articles_count || 0} articles</span>
              </div>
              <div className="p-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Unités</span>
                <span className="text-lg font-black text-white">{Number(inspectedDepot.total_units || 0).toLocaleString()}</span>
              </div>
              <div className="p-2">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Valeur Stock (Achat)</span>
                <span className="text-lg font-black text-emerald-400">{formatCurrencyAmount(inspectedDepot.total_value || 0)}</span>
              </div>
              <div className="p-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Valeur Vente (Estimée)</span>
                <span className="text-lg font-black text-white">{formatCurrencyAmount(inspectedDepot.total_sale_value || 0)}</span>
              </div>
            </div>

            {/* Modal Filter Toolbar */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrer par désignation, référence..."
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {[
                  { id: "ALL", label: "Tous", count: inspectedDepot.items?.length || 0 },
                  { id: "POSITIVE", label: "En Stock", count: (inspectedDepot.items || []).filter((i) => i.quantite > 0).length },
                  { id: "ALERT", label: "Alertes / Négatifs", count: (inspectedDepot.items || []).filter((i) => i.is_negative || i.is_low_stock).length },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setStockTabFilter(t.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      stockTabFilter === t.id
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Items Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredInspectedItems.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Package size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-600 text-xs">Aucun article trouvé dans ce dépôt</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs font-bold text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="py-3 px-3">Code Art.</th>
                      <th className="py-3 px-3">Désignation</th>
                      <th className="py-3 px-3 text-center">Quantité</th>
                      <th className="py-3 px-3 text-right">P.U Achat</th>
                      <th className="py-3 px-3 text-right">P.U Vente</th>
                      <th className="py-3 px-3 text-right">Valeur Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInspectedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{item.reference}</td>
                        <td className="py-2.5 px-3 font-black text-slate-900">{item.designation}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-black inline-block ${
                              item.quantite < 0
                                ? "bg-rose-100 text-rose-800 border border-rose-300/60"
                                : item.is_low_stock
                                ? "bg-amber-100 text-amber-800 border border-amber-300/60"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-300/60"
                            }`}
                          >
                            {Number(item.quantite).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {formatCurrencyAmount(item.prix_achat)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {formatCurrencyAmount(item.prix_vente)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                          {formatCurrencyAmount(item.valeur_achat)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                Total articles affichés: <strong className="text-slate-800">{filteredInspectedItems.length}</strong>
              </span>

              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/stock/transit?from_depot=${encodeURIComponent(inspectedDepot.nom)}`}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <ArrowRightLeft size={14} />
                  <span>Nouveau Transfert</span>
                </Link>

                <button
                  onClick={() => setInspectedDepot(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: AJOUTER / MODIFIER DÉPÔT ─── */}
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
                  {locale === "ar" ? "اسم المستودع / المحل" : "Nom du Dépôt"} *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: BOUTIQUE PRINCIPALE MARADI"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "الموقع / المدينة" : "Emplacement / Ville"}
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Maradi, Marché Central"
                    value={formData.emplacement}
                    onChange={(e) => setFormData({ ...formData, emplacement: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "الهاتف" : "Téléphone"}
                  </label>
                  <input
                    type="text"
                    placeholder="+227 90 00 00 00"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "المسؤول عن المستودع" : "Responsable du Dépôt"}
                </label>
                <select
                  value={formData.responsable}
                  onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
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
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{locale === "ar" ? "المستودع نشط وجاهز للعمليات والمبيعات" : "Dépôt actif pour les ventes et mouvements"}</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
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
