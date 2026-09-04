"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import {
  Package,
  Search,
  ArrowUpDown,
  AlertCircle,
  PackageOpen,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  X,
  Save,
  Edit3,
  Trash2,
  Printer,
  Sparkles,
  Barcode as BarcodeIcon,
  RefreshCw,
  Building2,
  TrendingUp,
  Tag,
  CheckCircle2,
  Layers,
  Filter,
  Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Barcode from "react-barcode";
import BarcodeLabelStudioModal from "@/components/BarcodeLabelStudioModal";

type Article = {
  id: string | number;
  reference: string;
  code_barre: string | null;
  designation: string;
  nom?: string | null;
  famille?: string | null;
  p_achat_ht?: number;
  p_vente_ht: number;
  p_vente_ttc: number;
  prix_gros?: number | null;
  prix_special?: number | null;
  image_path: string | null;
  stock_total: number;
};

const supabase = createClient();

function generateSmartReference() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ART-${year}-${rand}`;
}

function generateSmartBarcode() {
  // Generate valid 12-digit numeric barcode prefix
  const prefix = "2026";
  const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${randomSuffix}`;
}

export default function ArticlesPage() {
  const { t, locale, dir } = useLanguage();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Article>("designation");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [barcodeStudioArticles, setBarcodeStudioArticles] = useState<Article[] | null>(null);
  const [printArticle, setPrintArticle] = useState<Article | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    designation: "",
    nom: "",
    reference: "",
    code_barre: "",
    famille: "",
    fournisseur_pref: "",
    unite: "",
    p_achat_ht: "",
    p_achat_ttc: "",
    p_vente_ht: "",
    p_vente_ttc: "",
    prix_gros: "",
    prix_special: "",
    taxe: "0",
    qte_min: "5",
    article_par_colis: "1",
    stock_initial: "0",
    rayonnage: "",
    isb: "",
    ts: "",
    is_favorite: false,
    depot_nom: "BOUTIQUE",
    id: null as string | number | null,
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [allDepots, setAllDepots] = useState<string[]>([]);
  const [selectedFilterDepot, setSelectedFilterDepot] = useState<string>("Tous");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Fetch auxiliary data
      const [catRes, supRes, unitRes, depotRes] = await Promise.all([
        supabase.from("categories").select("nom").eq("is_deleted", false),
        supabase.from("fournisseurs").select("nom").eq("is_deleted", false),
        supabase.from("unites").select("nom").eq("is_deleted", false),
        supabase.from("depots").select("nom").eq("is_deleted", false),
      ]);

      if (catRes.data) setCategories(catRes.data.map((c: any) => c.nom));
      if (supRes.data) setSuppliers(supRes.data.map((s: any) => s.nom));
      if (unitRes.data) setUnits(unitRes.data.map((u: any) => u.nom));
      if (depotRes.data) setAllDepots(depotRes.data.map((d: any) => d.nom));

      // 2. Fetch articles
      const { data: artsData, error: artsErr } = await supabase
        .from("articles")
        .select("*")
        .eq("is_deleted", false)
        .order("designation");

      if (artsErr) throw artsErr;

      // 3. Fetch stocks
      const { data: stockData } = await supabase.from("stocks").select("article_id, depot_nom, quantite");

      const stockMap: Record<string | number, number> = {};
      if (stockData) {
        stockData.forEach((st: any) => {
          const qty = Number(st.quantite) || 0;
          stockMap[st.article_id] = (stockMap[st.article_id] || 0) + qty;
        });
      }

      if (artsData) {
        const enriched: Article[] = artsData.map((a: any) => ({
          id: a.id,
          reference: a.reference || `ART-${a.id}`,
          code_barre: a.code_barre || null,
          designation: a.designation || a.nom || "Sans titre",
          nom: a.nom || null,
          famille: a.famille || null,
          p_achat_ht: Number(a.p_achat_ht) || 0,
          p_vente_ht: Number(a.p_vente_ht) || Number(a.p_vente_ttc) || 0,
          p_vente_ttc: Number(a.p_vente_ttc) || Number(a.p_vente_ht) || 0,
          prix_gros: a.prix_gros ? Number(a.prix_gros) : null,
          prix_special: a.prix_special ? Number(a.prix_special) : null,
          image_path: a.image_path || null,
          stock_total: stockMap[a.id] || 0,
        }));
        setArticles(enriched);
      }
    } catch (err: any) {
      console.error(err);
      setToast({ message: "Erreur de chargement du catalogue", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({
      designation: "",
      nom: "",
      reference: generateSmartReference(),
      code_barre: generateSmartBarcode(),
      famille: categories.length > 0 ? categories[0] : "",
      fournisseur_pref: suppliers.length > 0 ? suppliers[0] : "",
      unite: units.length > 0 ? units[0] : "Pièce",
      p_achat_ht: "",
      p_achat_ttc: "",
      p_vente_ht: "",
      p_vente_ttc: "",
      prix_gros: "",
      prix_special: "",
      taxe: "0",
      qte_min: "5",
      article_par_colis: "1",
      stock_initial: "0",
      rayonnage: "",
      isb: "",
      ts: "",
      is_favorite: false,
      depot_nom: allDepots.length > 0 ? allDepots[0] : "BOUTIQUE",
      id: null,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (article: Article) => {
    setFormData({
      id: article.id,
      designation: article.designation,
      nom: article.nom || "",
      reference: article.reference,
      code_barre: article.code_barre || "",
      famille: article.famille || "",
      fournisseur_pref: "",
      unite: "",
      p_achat_ht: String(article.p_achat_ht || "0"),
      p_achat_ttc: String(article.p_achat_ht || "0"),
      p_vente_ht: String(article.p_vente_ht),
      p_vente_ttc: String(article.p_vente_ttc),
      prix_gros: article.prix_gros ? String(article.prix_gros) : "",
      prix_special: article.prix_special ? String(article.prix_special) : "",
      taxe: "0",
      qte_min: "5",
      article_par_colis: "1",
      stock_initial: "0",
      rayonnage: "",
      isb: "",
      ts: "",
      is_favorite: false,
      depot_nom: "",
    });
    setIsModalOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.designation.trim()) return;

    setSaving(true);
    try {
      const pVenteTtc = Number(formData.p_vente_ttc) || Number(formData.p_vente_ht) || 0;
      const pVenteHt = Number(formData.p_vente_ht) || pVenteTtc;
      const pAchatHt = Number(formData.p_achat_ht) || 0;
      const isEditing = !!formData.id;

      const payload: any = {
        designation: formData.designation.trim(),
        nom: formData.nom || formData.designation.trim(),
        reference: formData.reference.trim() || generateSmartReference(),
        code_barre: formData.code_barre.trim() || null,
        famille: formData.famille || null,
        p_achat_ht: pAchatHt,
        p_achat_ttc: pAchatHt,
        p_vente_ht: pVenteHt,
        p_vente_ttc: pVenteTtc,
        prix_gros: formData.prix_gros ? Number(formData.prix_gros) : null,
        prix_special: formData.prix_special ? Number(formData.prix_special) : null,
        taxe: Number(formData.taxe) || 0,
        qte_min: Number(formData.qte_min) || 0,
        article_par_colis: Number(formData.article_par_colis) || 1,
        rayonnage: formData.rayonnage || null,
        updated_at: new Date().toISOString(),
      };

      let savedId = formData.id;

      if (isEditing && savedId) {
        let { error } = await supabase.from("articles").update(payload).eq("id", savedId);
        // Resilient fallback if prix_gros or prix_special are not yet added in database schema
        if (error && (error.message?.includes("prix_gros") || error.message?.includes("prix_special") || error.code === "PGRST204" || error.message?.includes("schema cache"))) {
          const fallback = { ...payload };
          delete fallback.prix_gros;
          delete fallback.prix_special;
          const retry = await supabase.from("articles").update(fallback).eq("id", savedId);
          error = retry.error;
        }
        if (error) throw error;
      } else {
        payload.is_deleted = false;
        payload.image_path = "";
        let { data: created, error } = await supabase.from("articles").insert([payload]).select().single();
        // Resilient fallback if prix_gros or prix_special are not yet added in database schema
        if (error && (error.message?.includes("prix_gros") || error.message?.includes("prix_special") || error.code === "PGRST204" || error.message?.includes("schema cache"))) {
          const fallback = { ...payload };
          delete fallback.prix_gros;
          delete fallback.prix_special;
          const retry = await supabase.from("articles").insert([fallback]).select().single();
          created = retry.data;
          error = retry.error;
        }
        if (error) throw error;
        savedId = created.id;

        // Insert initial stock
        const stockInitial = Number(formData.stock_initial) || 0;
        if (stockInitial > 0 && savedId) {
          await supabase.from("stocks").insert([
            {
              article_id: savedId,
              depot_nom: formData.depot_nom || "BOUTIQUE",
              quantite: stockInitial,
            },
          ]);
        }
      }

      setToast({
        message: isEditing ? "Article mis à jour avec succès" : "Nouvel article créé avec succès",
        type: "success",
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || "Erreur lors de l'enregistrement", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string | number, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'article "${name}" ?`)) return;
    try {
      const { error } = await supabase.from("articles").update({ is_deleted: true }).eq("id", id);
      if (error) throw error;
      setToast({ message: "Article supprimé", type: "success" });
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Erreur de suppression", type: "error" });
    }
  };

  const filteredArticles = useMemo(() => {
    const q = query.toLowerCase().trim();
    return articles
      .filter((a) => {
        const matchesQuery =
          !q ||
          a.designation.toLowerCase().includes(q) ||
          a.reference.toLowerCase().includes(q) ||
          (a.code_barre && a.code_barre.toLowerCase().includes(q)) ||
          (a.famille && a.famille.toLowerCase().includes(q));
        return matchesQuery;
      })
      .sort((a, b) => {
        let valA: any = a[sortField] || "";
        let valB: any = b[sortField] || "";
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [articles, query, sortField, sortAsc]);

  // Executive Metrics
  const totalStockQty = articles.reduce((sum, a) => sum + a.stock_total, 0);
  const totalStockValue = articles.reduce((sum, a) => sum + a.stock_total * (a.p_achat_ht || a.p_vente_ht * 0.7), 0);
  const totalLowStock = articles.filter((a) => a.stock_total <= 5).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast */}
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

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Package size={14} />
                ENTERPRISE PRODUCT CATALOG
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                {articles.length} {locale === "ar" ? "صنف مسجل" : "Articles Référencés"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "إدارة الأصناف والمنتجات" : "Catalogue & Gestion des Articles"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "قاعدة بيانات المنتجات الذكية، التوليد التلقائي للباركود والمرجع، ومتابعة المخزون اللحظي"
                : "Base de données produits avec génération automatique des codes-barres et valorisation du stock"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                if (selectedIds.length > 0) {
                  const toPrint = articles.filter(a => selectedIds.includes(a.id));
                  setBarcodeStudioArticles(toPrint);
                } else {
                  setBarcodeStudioArticles(filteredArticles.slice(0, 30));
                }
              }}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Studio d'impression de codes-barres et étiquettes"
            >
              <BarcodeIcon size={16} />
              <span>{locale === "ar" ? "طباعة الملصقات والباركود" : "Studio Étiquettes"}</span>
            </button>

            <button
              onClick={loadData}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw size={15} />
              <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            <a
              href="/catalog"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xl shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Store size={16} />
              <span>{locale === "ar" ? "🌐 الكتالوج العام" : "🌐 Boutique en Ligne"}</span>
            </a>

            <button
              onClick={handleOpenAddModal}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-xl shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{locale === "ar" ? "إضافة صنف جديد" : "Nouvel Article"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الأصناف والقطع" : "Total Articles & Quantités"}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Package size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{articles.length}</div>
          <div className="text-xs text-indigo-600 font-bold mt-1.5 flex items-center gap-1">
            <Layers size={13} />
            <span>{totalStockQty} {locale === "ar" ? "وحدة متوفرة في المستودعات" : "unités en stock physique"}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "حالة وتنبيهات المخزون" : "Alertes Stock Faible"}
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">{totalLowStock}</div>
          <div className="text-xs text-slate-500 font-bold mt-1.5">
            {locale === "ar" ? "أصناف تتطلب إعادة الطلب فوراً" : "articles en dessous du seuil minimal"}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "القيمة المالية للمخزون" : "Valeur Totale du Stock"}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">{formatCurrencyAmount(totalStockValue)}</div>
          <div className="text-xs text-slate-500 font-bold mt-1.5">
            {locale === "ar" ? "محسوبة بسعر التكلفة التقديري" : "Valorisation globale d'inventaire"}
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, and View Switcher */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              locale === "ar"
                ? "بحث بالاسم، الكود المرجعي، الباركود، أو الفئة..."
                : "Rechercher par désignation, référence, code-barres..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                viewMode === "table" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vue Tableau"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                viewMode === "grid" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
              title="Vue Grille 4K"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <div className="text-xs font-extrabold text-slate-500">
            Total : <span className="text-indigo-600">{filteredArticles.length}</span> {locale === "ar" ? "صنف" : "articles"}
          </div>
        </div>
      </div>

      {/* Main Content: Table View or Grid View */}
      {viewMode === "table" ? (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{locale === "ar" ? "المرجع والباركود" : "Réf & Code-barres"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "اسم الصنف / المنتج" : "Désignation"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "الفئة" : "Catégorie"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "سعر البيع" : "Prix Vente TTC"}</th>
                  <th className="py-3.5 px-4 text-center">{locale === "ar" ? "الرصيد الفعلي" : "Stock"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <Loader2 size={32} className="animate-spin mx-auto text-indigo-600 mb-2" />
                      <span>{locale === "ar" ? "جاري تحميل الأصناف..." : "Chargement du catalogue..."}</span>
                    </td>
                  </tr>
                ) : filteredArticles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <Package size={36} className="mx-auto text-slate-300 mb-2" />
                      <span>{locale === "ar" ? "لا توجد أصناف مطابقة للبحث." : "Aucun article trouvé."}</span>
                    </td>
                  </tr>
                ) : (
                  filteredArticles.map((art) => {
                    const isLowStock = art.stock_total <= 5;

                    return (
                      <tr key={art.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-indigo-600 text-xs">{art.reference}</div>
                          {art.code_barre ? (
                            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 mt-0.5">
                              <BarcodeIcon size={12} />
                              <span>{art.code_barre}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic">Sans code-barres</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-black text-slate-900">
                          {art.designation}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                            {art.famille || "Général"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="font-black text-slate-900 text-sm">
                            {formatCurrencyAmount(art.p_vente_ttc)}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                              art.stock_total === 0
                                ? "bg-rose-100 text-rose-700 border border-rose-300"
                                : isLowStock
                                ? "bg-amber-100 text-amber-700 border border-amber-300"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {art.stock_total} unités
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setBarcodeStudioArticles([art])}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Imprimer Code-barres"
                            >
                              <Printer size={14} />
                            </button>

                            <button
                              onClick={() => handleOpenEditModal(art)}
                              className="p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                              title="Modifier"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              onClick={() => handleDelete(art.id, art.designation)}
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
      ) : (
        /* View 2: 4K Product Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredArticles.map((art) => {
            const isLowStock = art.stock_total <= 5;

            return (
              <div
                key={art.id}
                className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-lg transition-all space-y-4 relative overflow-hidden group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                    {art.reference}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      art.stock_total === 0
                        ? "bg-rose-100 text-rose-700"
                        : isLowStock
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {art.stock_total} en stock
                  </span>
                </div>

                <div className="pt-2">
                  <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {art.designation}
                  </h3>
                  <div className="text-xs text-slate-400 font-bold mt-1">
                    {art.famille || "Catégorie Générale"}
                  </div>
                </div>

                {art.code_barre && (
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
                    <span className="flex items-center gap-1">
                      <BarcodeIcon size={14} className="text-slate-400" />
                      {art.code_barre}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Prix Vente</span>
                    <span className="text-lg font-black text-slate-900">{formatCurrencyAmount(art.p_vente_ttc)}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setBarcodeStudioArticles([art])}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                      title="Imprimer"
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(art)}
                      className="p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                      title="Modifier"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Article Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Package size={16} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {formData.id
                    ? locale === "ar"
                      ? "تعديل بيانات الصنف"
                      : "Modifier l'Article"
                    : locale === "ar"
                    ? "إضافة صنف جديد (توليد ذكي تلقائي)"
                    : "Nouvel Article (Auto-génération)"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "اسم الصنف / المنتج" : "Désignation du Produit"} *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Ciment Dangote 50KG, Huile de Palme 5L..."
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Smart Reference & Barcode Generator */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {locale === "ar" ? "الكود المرجعي (تلقائي)" : "Référence (Auto-générée)"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, reference: generateSmartReference() })}
                      className="text-[11px] font-black text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={11} /> {locale === "ar" ? "توليد جديد" : "Régénérer"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-black text-indigo-700 bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      {locale === "ar" ? "الباركود (توليد تلقائي)" : "Code-barres (Auto-généré)"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, code_barre: generateSmartBarcode() })}
                      className="text-[11px] font-black text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={11} /> {locale === "ar" ? "توليد جديد" : "Régénérer"}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: 202612345678"
                    value={formData.code_barre}
                    onChange={(e) => setFormData({ ...formData, code_barre: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-xs font-black text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "الفئة / التصنيف" : "Famille / Catégorie"}
                  </label>
                  <select
                    value={formData.famille}
                    onChange={(e) => setFormData({ ...formData, famille: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="">Général</option>
                    {categories.map((c, i) => (
                      <option key={i} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "المستودع الأولي" : "Dépôt de Stock Initial"}
                  </label>
                  <select
                    value={formData.depot_nom}
                    onChange={(e) => setFormData({ ...formData, depot_nom: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    {allDepots.map((d, i) => (
                      <option key={i} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="text-[11px] font-black uppercase text-slate-500 tracking-wider block">
                  {locale === "ar" ? "الأسعار والتكلفة (FCFA)" : "Prix & Tarification"}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {locale === "ar" ? "سعر الشراء (التكلفة)" : "Prix d'Achat HT"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0"
                      value={formData.p_achat_ht}
                      onChange={(e) => setFormData({ ...formData, p_achat_ht: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {locale === "ar" ? "سعر البيع للجمهور (تجزئة)" : "Prix de Vente Détail (TTC)"} *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0"
                      value={formData.p_vente_ttc}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          p_vente_ttc: e.target.value,
                          p_vente_ht: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-black text-indigo-700 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {locale === "ar" ? "سعر الجملة (Gros - اختياري)" : "Prix de Vente Gros"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Optionnel"
                      value={formData.prix_gros}
                      onChange={(e) => setFormData({ ...formData, prix_gros: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-emerald-700 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {locale === "ar" ? "سعر خاص / موزع (اختياري)" : "Prix Spécial / Revendeur"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Optionnel"
                      value={formData.prix_special}
                      onChange={(e) => setFormData({ ...formData, prix_special: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-amber-700 bg-white"
                    />
                  </div>

                  {!formData.id && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        {locale === "ar" ? "الكمية الأولية بالمخزن" : "Stock Initial"}
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={formData.stock_initial}
                        onChange={(e) => setFormData({ ...formData, stock_initial: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-black text-emerald-700 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {locale === "ar" ? "إلغاء" : "Annuler"}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>{locale === "ar" ? "حفظ الصنف" : "Enregistrer l'Article"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4K Barcode Label Studio Modal */}
      {barcodeStudioArticles && barcodeStudioArticles.length > 0 && (
        <BarcodeLabelStudioModal
          articles={barcodeStudioArticles}
          onClose={() => setBarcodeStudioArticles(null)}
        />
      )}
    </div>
  );
}
