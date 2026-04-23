"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Package, Search, ArrowUpDown, AlertCircle, PackageOpen, LayoutGrid, Loader2, Plus, X, Save, Edit3, Trash2, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Barcode from "react-barcode";

type Article = {
  id: string | number;
  reference: string;
  code_barre: string | null;
  designation: string;
  p_vente_ht: number;
  p_vente_ttc: number;
  image_path: string | null;
  stock_total: number;
};

const supabase = createClient();

const PRODUCT_IMAGES: Record<string, string> = {
  "coca cola": "/products/coca_cola.png",
  "coca-cola": "/products/coca_cola.png",
  "chips": "/products/chips.png",
  "lait": "/products/lait.png",
  "pomme": "/products/pomme.png",
  "shampooing": "/products/shampooing.png",
  "shampoing": "/products/shampooing.png",
};

function getProductImage(name: string): string | null {
  const lower = name.toLowerCase().trim();
  for (const [key, value] of Object.entries(PRODUCT_IMAGES)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Article>("designation");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [printArticle, setPrintArticle] = useState<Article | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "vendeur">("vendeur");
  const [userDepot, setUserDepot] = useState("");

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
    taxe: "0",
    qte_min: "0",
    article_par_colis: "1",
    stock_initial: "0",
    rayonnage: "",
    isb: "",
    ts: "",
    is_favorite: false,
    depot_nom: "",
    id: null as string | number | null
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [allDepots, setAllDepots] = useState<string[]>([]);
  const [toast, setToast] = useState<{message: string, type: "success" | "error"} | null>(null);

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.designation) return;
    setSaving(true);
    try {
      const pVenteTtcNum = Number(formData.p_vente_ttc) || 0;
      const pVenteHtNum = Number(formData.p_vente_ht) || pVenteTtcNum;
      const pAchatHtNum = Number(formData.p_achat_ht) || 0;
      const pAchatTtcNum = Number(formData.p_achat_ttc) || 0;
      const taxeNum = Number(formData.taxe) || 0;
      const qteMinNum = Number(formData.qte_min) || 0;
      const artParColisNum = Number(formData.article_par_colis) || 1;
      
      const isEditing = !!formData.id;
      
      const payload: any = {
        designation: formData.designation,
        nom: formData.nom || null,
        reference: formData.reference || (isEditing ? undefined : `ART-${Date.now().toString().slice(-6)}`),
        code_barre: formData.code_barre || null,
        famille: formData.famille || null,
        fournisseur_pref: formData.fournisseur_pref || null,
        unite: formData.unite || null,
        p_achat_ht: pAchatHtNum,
        p_achat_ttc: pAchatTtcNum,
        p_vente_ht: pVenteHtNum,
        p_vente_ttc: pVenteTtcNum,
        taxe: taxeNum,
        qte_min: qteMinNum,
        article_par_colis: artParColisNum,
        rayonnage: formData.rayonnage || null,
        isb: formData.isb || null,
        ts: formData.ts || null,
        is_favorite: formData.is_favorite,
        updated_at: new Date().toISOString()
      };

      let resultArticle;

      if (isEditing) {
        const { data, error } = await supabase
          .from("articles")
          .update(payload)
          .eq("id", formData.id)
          .select()
          .single();
        if (error) throw error;
        resultArticle = data;
      } else {
        payload.is_deleted = false;
        payload.image_path = "";
        const { data, error } = await supabase
          .from("articles")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        resultArticle = data;
      }
        
      // Initial Stock (only for new articles)
      const stockNum = Number(formData.stock_initial) || 0;
      if (!isEditing && stockNum > 0 && resultArticle) {
        await supabase.from("stocks").insert({
          article_id: resultArticle.id,
          depot_nom: formData.depot_nom || "Dépôt Principal",
          quantite: stockNum
        });
      }
      
      if (resultArticle) {
        if (isEditing) {
          setArticles(prev => prev.map(a => a.id === resultArticle.id ? {
            ...a,
            reference: resultArticle.reference,
            code_barre: resultArticle.code_barre,
            designation: resultArticle.designation,
            p_vente_ht: resultArticle.p_vente_ht,
            p_vente_ttc: resultArticle.p_vente_ttc,
          } : a));
        } else {
          setArticles(prev => [{
            id: resultArticle.id,
            reference: resultArticle.reference,
            code_barre: resultArticle.code_barre,
            designation: resultArticle.designation,
            p_vente_ht: resultArticle.p_vente_ht,
            p_vente_ttc: resultArticle.p_vente_ttc,
            image_path: null,
            stock_total: stockNum
          }, ...prev]);
        }
      }
      
      setToast({ message: isEditing ? "Article mis à jour !" : "Article ajouté !", type: "success" });
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de l'enregistrement.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const resetForm = () => {
    setFormData({
      designation: "", nom: "", reference: "", code_barre: "", famille: "", 
      fournisseur_pref: "", unite: "", p_achat_ht: "", p_achat_ttc: "", 
      p_vente_ht: "", p_vente_ttc: "", taxe: "0", qte_min: "0", 
      article_par_colis: "1", stock_initial: "0", rayonnage: "", isb: "", ts: "", is_favorite: false,
      depot_nom: "", id: null
    });
  };

  const handleEdit = async (articleId: string | number) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("articles")
        .select("*")
        .eq("id", articleId)
        .single();
        
      if (error) throw error;
      
      if (data) {
        setFormData({
          id: data.id,
          designation: data.designation || "",
          nom: data.nom || "",
          reference: data.reference || "",
          code_barre: data.code_barre || "",
          famille: data.famille || "",
          fournisseur_pref: data.fournisseur_pref || "",
          unite: data.unite || "",
          p_achat_ht: String(data.p_achat_ht || "0"),
          p_achat_ttc: String(data.p_achat_ttc || "0"),
          p_vente_ht: String(data.p_vente_ht || "0"),
          p_vente_ttc: String(data.p_vente_ttc || "0"),
          taxe: String(data.taxe || "0"),
          qte_min: String(data.qte_min || "0"),
          article_par_colis: String(data.article_par_colis || "1"),
          stock_initial: "0", // Not editable
          rayonnage: data.rayonnage || "",
          isb: data.isb || "",
          ts: data.ts || "",
          is_favorite: !!data.is_favorite,
          depot_nom: "" // Not used in edit
        });
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Échec du chargement de l'article.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (articleId: string | number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet article ?")) return;
    try {
      const { error } = await supabase
        .from("articles")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", articleId);
        
      if (error) throw error;
      
      setArticles(prev => prev.filter(a => a.id !== articleId));
      setToast({ message: "Article supprimé.", type: "success" });
    } catch (err) {
      console.error(err);
      setToast({ message: "Erreur lors de la suppression.", type: "error" });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handlePriceCalc = (type: 'ht' | 'ttc', mode: 'achat' | 'vente', value: string) => {
    const num = parseFloat(value) || 0;
    const taxe = parseFloat(formData.taxe) || 0;
    
    if (mode === 'achat') {
      if (type === 'ht') {
        const ttc = num * (1 + taxe/100);
        setFormData(prev => ({ ...prev, p_achat_ht: value, p_achat_ttc: ttc.toFixed(2) }));
      } else {
        const ht = num / (1 + taxe/100);
        setFormData(prev => ({ ...prev, p_achat_ttc: value, p_achat_ht: ht.toFixed(2) }));
      }
    } else {
      if (type === 'ht') {
        const ttc = num * (1 + taxe/100);
        setFormData(prev => ({ ...prev, p_vente_ht: value, p_vente_ttc: ttc.toFixed(2) }));
      } else {
        const ht = num / (1 + taxe/100);
        setFormData(prev => ({ ...prev, p_vente_ttc: value, p_vente_ht: ht.toFixed(2) }));
      }
    }
  };

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [cats, supps, unts, deps] = await Promise.all([
          supabase.from("categories").select("nom").order("nom"),
          supabase.from("fournisseurs").select("nom").order("nom"),
          supabase.from("types").select("nom").order("nom"),
          supabase.from("depots").select("nom").eq("is_deleted", false).order("nom")
        ]);

        if (cats.data) setCategories(cats.data.map(c => c.nom));
        if (supps.data) setSuppliers(supps.data.map(s => s.nom));
        if (unts.data) setUnits(unts.data.map(u => u.nom));
        if (deps.data) setAllDepots(deps.data.map(d => d.nom));
      } catch (err) {
        console.error("Failed to load metadata", err);
      }
    }
    loadInitialData();

    async function loadArticles() {
      try {
        const res = await fetch("/api/articles");
        const result = await res.json();
        
        if (!res.ok) {
          console.error("❌ Articles fetch error:", result.error);
          return;
        }

        // Set role and depot from API response
        if (result.role) setUserRole(result.role);
        if (result.depot) setUserDepot(result.depot);

        const rawArticles = Array.isArray(result) ? result : (result.items || []);

        if (rawArticles.length > 0) {
          const mapped: Article[] = rawArticles.map((r: any) => {
            const stockTotal = Array.isArray(r.stocks)
              ? r.stocks.reduce((acc: number, cur: any) => acc + (Number(cur.quantite) || 0), 0)
              : 0;

            return {
              id: r.id,
              reference: r.reference || "",
              code_barre: r.code_barre || null,
              designation: String(r.designation || r.nom || ""),
              p_vente_ht: Number(r.p_vente_ht) || 0,
              p_vente_ttc: Number(r.p_vente_ttc) || 0,
              image_path: r.image_path || null,
              stock_total: stockTotal,
            };
          });
          setArticles(mapped);
        }
      } catch (err) {
        console.error("Failed to load articles", err);
      } finally {
        setLoading(false);
      }
    }
    loadArticles();
  }, []);

  const { filteredArticles, totalValue, lowStockCount } = useMemo(() => {
    let filtered = articles;
    if (query) {
      const q = query.toLowerCase();
      filtered = articles.filter(
        (a) =>
          a.designation.toLowerCase().includes(q) ||
          a.reference.toLowerCase().includes(q) ||
          (a.code_barre && a.code_barre.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    const totalVal = articles.reduce((acc, curr) => acc + curr.stock_total * curr.p_vente_ht, 0);
    const lowStock = articles.filter((a) => a.stock_total <= 5).length;

    return { filteredArticles: filtered, totalValue: totalVal, lowStockCount: lowStock };
  }, [articles, query, sortField, sortAsc]);

  const toggleSort = (field: keyof Article) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked && filteredArticles.length > 0) {
      setSelectedIds(filteredArticles.map(a => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: string | number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Voulez-vous vraiment supprimer ${selectedIds.length} article(s)?`)) return;
    try {
      setLoading(true);
      await supabase.from("articles").update({ is_deleted: true, deleted_at: new Date().toISOString() }).in("id", selectedIds);
      setArticles(articles.filter(a => !selectedIds.includes(a.id)));
      setSelectedIds([]);
      setToast({ message: "Articles supprimés avec succès.", type: "success" });
    } catch (e) {
      setToast({ message: "Erreur lors de la suppression.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-lg font-bold text-white flex items-center gap-3 transition-all ${toast.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
          {toast.message}
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
            <div className="p-3 bg-white/50 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
              <Package className="text-indigo-600" size={32} />
            </div>
            Gestion des Articles
          </h1>
          <p className="mt-2 text-slate-500 font-medium ml-1">
            {userRole === "vendeur" 
              ? `Articles disponibles dans votre dépôt: ${userDepot}` 
              : "Consultez et gérez le catalogue complet de vos produits et stocks."
            }
          </p>
        </div>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {[
          { label: "Articles Totaux", value: articles.length, bg: "linear-gradient(135deg, #4f46e5, #7c3aed)", icon: LayoutGrid, shadowColor: "rgba(79,70,229,0.3)" },
          { label: "Stock Faible / Épuisé", value: lowStockCount, bg: "linear-gradient(135deg, #f59e0b, #ef4444)", icon: AlertCircle, shadowColor: "rgba(245,158,11,0.3)" },
          { label: "Valeur Totale (HT)", value: `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(totalValue)} F CFA`, bg: "linear-gradient(135deg, #10b981, #34d399)", icon: Package, shadowColor: "rgba(16,185,129,0.3)" },
        ].map((card, i) => (
          <div
            key={i}
            className="relative overflow-hidden p-8 rounded-[32px] text-white transition-all hover:scale-[1.03] cursor-pointer group"
            style={{ background: card.bg, boxShadow: `0 20px 40px ${card.shadowColor}` }}
          >
             <div className="absolute -right-4 -bottom-4 w-32 h-32 rounded-full blur-3xl group-hover:bg-white/20 transition-all bg-white/10"></div>
             <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-3">
                 <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md">
                    <card.icon size={22} />
                 </div>
                 <span className="text-sm font-black uppercase tracking-widest opacity-90">{card.label}</span>
               </div>
             </div>
             <div className="text-3xl font-black mt-2 tracking-tight line-clamp-1">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar (Search & New Article Button) */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-[0_15px_50px_-15px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher par désignation, référence ou code-barres..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-13 pr-4 py-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-[#6366f1]/5 transition-all text-slate-700"
            />
          </div>
          {userRole === "admin" && (
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex items-center gap-2 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 group bg-[#6366f1] shadow-indigo-100">
              <Plus size={18} className="transition-transform group-hover:rotate-90" />
              Nouvel Article
            </button>
          )}
        </div>
      </div>

      {/* Count Divider */}
      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink-0 mx-4 text-sm font-semibold text-slate-400">
          {filteredArticles.length} article(s) affiché(s)
        </span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-[48px] border border-white/80 bg-white/60 backdrop-blur-3xl shadow-2xl shadow-indigo-100/40 flex flex-col overflow-hidden transition-all duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll} 
                    checked={selectedIds.length === filteredArticles.length && filteredArticles.length > 0} 
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                  />
                </th>
                <th className="px-6 py-4">Image</th>
                <th 
                  className="cursor-pointer px-6 py-4 hover:bg-slate-200/50 transition-colors"
                  onClick={() => toggleSort("reference")}
                >
                  <div className="flex items-center gap-2">
                    Référence <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th 
                  className="cursor-pointer px-6 py-4 hover:bg-slate-200/50 transition-colors"
                  onClick={() => toggleSort("designation")}
                >
                  <div className="flex items-center gap-2">
                    Désignation <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th 
                  className="cursor-pointer px-6 py-4 text-right hover:bg-slate-200/50 transition-colors"
                  onClick={() => toggleSort("p_vente_ttc")}
                >
                  <div className="flex items-center justify-end gap-2">
                    Prix TTC <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th 
                  className="cursor-pointer px-6 py-4 text-center hover:bg-slate-200/50 transition-colors"
                  onClick={() => toggleSort("stock_total")}
                >
                  <div className="flex items-center justify-center gap-2">
                    Stock <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                      <p className="mt-3 text-sm font-semibold">Chargement des données...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <PackageOpen className="h-14 w-14 opacity-30 text-slate-400" />
                      <p className="mt-3 text-base font-semibold">Aucun article trouvé.</p>
                      <p className="text-sm mt-1">Modifiez votre recherche ou ajoutez un nouvel article.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => {
                  const outOfStock = article.stock_total <= 0;
                  const imgSrc = getProductImage(article.designation);

                  return (
                    <tr 
                      key={article.id} 
                      className={`group transition-colors border-b border-slate-100 last:border-0 hover:bg-[#F3F4F6] ${outOfStock ? "bg-red-50/10" : ""} ${selectedIds.includes(article.id) ? "bg-indigo-50/70" : ""}`}
                    >
                      <td className="px-6 py-4 w-12 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(article.id)} 
                          onChange={() => handleSelectItem(article.id)} 
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-12 w-12 flex-shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden shadow-sm">
                          {imgSrc ? (
                            <Image src={imgSrc} alt="" width={36} height={36} className="object-contain" />
                          ) : (
                            <Package className="h-6 w-6 text-slate-300" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">
                        {article.reference}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">{article.designation}</div>
                        {article.code_barre && (
                          <div className="text-[11px] font-semibold text-slate-400 mt-0.5 tracking-wider">CB: {article.code_barre}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-black text-slate-900">
                        {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(article.p_vente_ttc)} F CFA
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center font-bold">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm ${
                          outOfStock 
                            ? "bg-red-100 text-red-700" 
                            : article.stock_total < 5 
                              ? "bg-amber-100 text-amber-700"
                              : "text-slate-700"
                        }`}>
                          {article.stock_total}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setPrintArticle(article)}
                            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all"
                            title="Imprimer Code-barres"
                          >
                            <Printer size={18} />
                          </button>
                          {userRole === "admin" && (
                            <>
                              <button 
                                onClick={() => handleEdit(article.id)}
                                className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all"
                                title="Modifier"
                              >
                                <Edit3 size={18} />
                              </button>
                              <button 
                                onClick={() => handleDelete(article.id)}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all"
                                title="Supprimer"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700/50 text-white px-6 py-4 rounded-3xl shadow-2xl z-50 flex items-center gap-6 animate-in slide-in-from-bottom-5">
          <div className="flex bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold items-center gap-3">
            <span className="w-7 h-7 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs shadow-inner shadow-white/20">{selectedIds.length}</span>
            <span className="tracking-wide">Sélectionnés</span>
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <button onClick={handleBulkDelete} className="flex items-center gap-2 hover:bg-rose-500/20 text-rose-400 px-5 py-2.5 rounded-xl text-sm font-black transition-all group">
            <Trash2 size={18} className="group-hover:scale-110 transition-transform" /> Supprimer
          </button>
        </div>
      )}

      {/* Add Article Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="border-b border-slate-100 bg-[#F8FAFC] px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                <span className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <PackageOpen size={24} strokeWidth={2.5} />
                </span>
                {formData.id ? "Modifier l'Article" : "Nouvel Article"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X size={20} className="stroke-2" />
              </button>
            </div>
            
            <form onSubmit={handleSaveArticle} className="p-6 space-y-8 overflow-y-auto max-h-[75vh]">
              {/* Section 1: Informations Générales */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Package size={14} /> Informations Générales
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Désignation du Produit <span className="text-red-500">*</span></label>
                    <input
                      type="text" required value={formData.designation}
                      onChange={(e) => setFormData({...formData, designation: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-lg bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
                      placeholder="Ex: Coca Cola 1L"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Nom Commercial / Marque</label>
                    <input
                      type="text" value={formData.nom}
                      onChange={(e) => setFormData({...formData, nom: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-semibold bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
                      placeholder="Ex: Coca-Cola Company"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Référence (Auto-générée si vide)</label>
                    <input
                      type="text" value={formData.reference}
                      onChange={(e) => setFormData({...formData, reference: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono"
                      placeholder="Ex: ART-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Code Barre</label>
                    <input
                      type="text" value={formData.code_barre}
                      onChange={(e) => setFormData({...formData, code_barre: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-mono"
                      placeholder="Ex: 37188..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Famille / Catégorie</label>
                    <select 
                      value={formData.famille}
                      onChange={(e) => setFormData({...formData, famille: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold appearance-none cursor-pointer"
                    >
                      <option value="">Sélectionner...</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Fournisseur Préféré</label>
                    <select 
                      value={formData.fournisseur_pref}
                      onChange={(e) => setFormData({...formData, fournisseur_pref: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold appearance-none cursor-pointer"
                    >
                      <option value="">Sélectionner...</option>
                      {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Unité de mesure</label>
                    <select 
                      value={formData.unite}
                      onChange={(e) => setFormData({...formData, unite: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold"
                    >
                      <option value="">Sélectionner...</option>
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Rayonnage / Emplacement</label>
                    <input
                      type="text" value={formData.rayonnage}
                      onChange={(e) => setFormData({...formData, rayonnage: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-semibold"
                      placeholder="Ex: Rayon A2"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Prix et Taxes */}
              <div className="space-y-4 p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100">
                <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                  <ArrowUpDown size={14} /> Prix et Taxes
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Taxe (%)</label>
                    <input
                      type="number" value={formData.taxe}
                      onChange={(e) => setFormData({...formData, taxe: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white border border-indigo-200 rounded-xl px-4 py-3 font-black"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">P. Achat HT</label>
                    <input
                      type="number" step="0.01" value={formData.p_achat_ht}
                      onChange={(e) => handlePriceCalc('ht', 'achat', e.target.value)}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white border border-indigo-200 rounded-xl px-4 py-3 font-black"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">P. Achat TTC</label>
                    <input
                      type="number" step="0.01" value={formData.p_achat_ttc}
                      onChange={(e) => handlePriceCalc('ttc', 'achat', e.target.value)}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white border border-indigo-200 rounded-xl px-4 py-3 font-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                   <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Prix de Vente HT</label>
                    <input
                      type="number" step="0.01" value={formData.p_vente_ht}
                      onChange={(e) => handlePriceCalc('ht', 'vente', e.target.value)}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white border border-emerald-200 rounded-xl px-4 py-3 font-black text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Prix de Vente TTC</label>
                    <input
                      type="number" step="0.01" value={formData.p_vente_ttc}
                      onChange={(e) => handlePriceCalc('ttc', 'vente', e.target.value)}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 font-black text-emerald-700 text-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Stock et Colisage */}
              <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <LayoutGrid size={14} /> Stock et Colisage
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {!formData.id && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Dépôt de Stockage <span className="text-red-500">*</span></label>
                      <select 
                        required
                        value={formData.depot_nom}
                        onChange={(e) => setFormData({...formData, depot_nom: e.target.value})}
                        className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold appearance-none cursor-pointer"
                      >
                        <option value="">Choisir un dépôt...</option>
                        {allDepots.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}
                  <div className={formData.id ? "sm:col-span-2 opacity-50 pointer-events-none" : ""}>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Stock Initial {formData.id && "(Non modifiable ici)"}</label>
                    <input
                      type="number" value={formData.stock_initial}
                      disabled={!!formData.id}
                      onChange={(e) => setFormData({...formData, stock_initial: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Stock Min (Alerte)</label>
                    <input
                      type="number" value={formData.qte_min}
                      onChange={(e) => setFormData({...formData, qte_min: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Articles par Colis</label>
                    <input
                      type="number" value={formData.article_par_colis}
                      onChange={(e) => setFormData({...formData, article_par_colis: e.target.value})}
                      className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2">
                   <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.is_favorite}
                          onChange={(e) => setFormData({...formData, is_favorite: e.target.checked})}
                          className="sr-only"
                        />
                        <div className={`w-12 h-6 rounded-full transition-colors ${formData.is_favorite ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.is_favorite ? 'translate-x-6' : ''}`}></div>
                      </div>
                      <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                        ⭐ Ajouter aux favoris (Afficher en priorité dans le POS)
                      </span>
                   </label>
                </div>
              </div>
              
              <div className="pt-6 flex items-center justify-end gap-4 border-t border-slate-100 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-8 py-4 rounded-2xl font-black text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl font-black text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-70 group"
                  style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
                >
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} strokeWidth={3} className="group-hover:translate-x-0.5 transition-transform" />}
                  {saving ? "Enregistrement..." : (formData.id ? "Mettre à jour" : "Enregistrer l'Article")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Print Modal */}
      {printArticle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:bg-white print:p-0">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col items-center p-8 print:shadow-none print:w-auto print:p-4">
            
            <div className="w-full flex justify-end print:hidden mb-4">
              <button onClick={() => setPrintArticle(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="text-center print:text-black">
              <h3 className="font-black text-lg text-slate-800 uppercase tracking-wider mb-1 print:text-xs print:mb-0">
                {printArticle.designation.substring(0, 25)}
              </h3>
              <p className="text-2xl font-black text-slate-900 mb-6 print:text-sm print:mb-2">
                {new Intl.NumberFormat("fr-FR").format(printArticle.p_vente_ttc)} F CFA
              </p>
              
              <div className="bg-white px-4 py-2 rounded-xl mb-4">
                <Barcode 
                  value={printArticle.code_barre || printArticle.reference || `ART-${printArticle.id}`} 
                  width={2} 
                  height={50} 
                  displayValue={true}
                  fontSize={14}
                  font="monospace"
                  background="transparent"
                />
              </div>
            </div>

            <button 
              onClick={() => window.print()}
              className="mt-6 w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors print:hidden"
            >
              <Printer size={20} /> Lancer l'impression
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        
        body {
          font-family: 'Outfit', sans-serif;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .fixed.inset-0.z-\\[100\\] {
            position: absolute !important;
            left: 0;
            top: 0;
            margin: 0;
            padding: 0;
          }
          .fixed.inset-0.z-\\[100\\] * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}
