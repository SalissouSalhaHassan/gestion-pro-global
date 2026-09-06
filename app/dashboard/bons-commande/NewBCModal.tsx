"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  Sparkles,
  Truck,
  Calendar,
  Layers,
  AlertCircle,
  Copy,
  Check,
  Database,
  Building2,
  Package,
  Boxes,
  HelpCircle,
  TrendingUp,
  Info,
  Phone
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

type Supplier = {
  id: number;
  nom: string;
  telephone?: string;
  solde?: number;
};

type Depot = {
  id: number;
  nom: string;
  adresse?: string;
  type?: string;
};

type Article = {
  id: number;
  reference: string;
  designation: string;
  p_achat_ht: number;
  p_vente_ttc?: number;
  stocks?: { quantite: number; depot_nom?: string; depot_id?: number }[];
};

type ItemRow = {
  article_id?: number;
  reference?: string;
  designation: string;
  quantite: number;
  prix_achat_unitaire: number;
  prix_vente_ref?: number;
  current_stock?: number;
};

type NewBCModalProps = {
  onClose: () => void;
  onSuccess: () => void;
  initialSuggestions?: ItemRow[];
};

const SQL_MIGRATION_SCRIPT = `-- 1. Table des bons de commande (En-tête)
CREATE TABLE IF NOT EXISTS public.bons_commande (
    id SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    numero_bc VARCHAR(50) UNIQUE NOT NULL,
    date_commande DATE NOT NULL DEFAULT CURRENT_DATE,
    date_livraison_prevue DATE,
    fournisseur_id INTEGER REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
    fournisseur_nom VARCHAR(255) NOT NULL,
    statut VARCHAR(50) NOT NULL DEFAULT 'BROUILLON',
    total_ht NUMERIC(15, 2) DEFAULT 0,
    total_ttc NUMERIC(15, 2) DEFAULT 0,
    notes TEXT,
    created_by VARCHAR(100),
    depot_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Table des lignes d'articles du bon de commande
CREATE TABLE IF NOT EXISTS public.bon_commande_items (
    id SERIAL PRIMARY KEY,
    organization_id UUID REFERENCES public.organizations(id),
    bon_commande_id INTEGER NOT NULL REFERENCES public.bons_commande(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES public.articles(id) ON DELETE SET NULL,
    reference VARCHAR(100),
    designation VARCHAR(255) NOT NULL,
    quantite NUMERIC(15, 2) NOT NULL,
    prix_achat_unitaire NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_ligne NUMERIC(15, 2) NOT NULL DEFAULT 0
);

-- 3. Sécurité Row Level Security (RLS)
ALTER TABLE public.bons_commande ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bon_commande_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for authenticated users on bons_commande"
  ON public.bons_commande FOR SELECT USING (true);
CREATE POLICY "Enable write for authenticated users on bons_commande"
  ON public.bons_commande FOR ALL USING (true);
CREATE POLICY "Enable read for authenticated users on bon_commande_items"
  ON public.bon_commande_items FOR SELECT USING (true);
CREATE POLICY "Enable write for authenticated users on bon_commande_items"
  ON public.bon_commande_items FOR ALL USING (true);

-- 4. Recharger le cache de schéma Supabase
NOTIFY pgrst, 'reload schema';`;

export default function NewBCModal({ onClose, onSuccess, initialSuggestions }: NewBCModalProps) {
  const { locale, dir } = useLanguage();
  const isAr = locale === "ar";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  
  const [selectedSupplierName, setSelectedSupplierName] = useState<string>("");
  const [selectedDepotId, setSelectedDepotId] = useState<number | null>(null);
  const [dateLivraison, setDateLivraison] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>(
    initialSuggestions && initialSuggestions.length > 0
      ? initialSuggestions
      : [{ designation: "", quantite: 10, prix_achat_unitaire: 0 }]
  );

  const [saving, setSaving] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Error & Migration states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMigrationError, setIsMigrationError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setLoadingMeta(true);
        const [supRes, artRes, depRes] = await Promise.all([
          fetch("/api/suppliers"),
          fetch("/api/articles"),
          fetch("/api/depots"),
        ]);

        const supData = await supRes.json();
        const artData = await artRes.json();
        const depData = await depRes.json();

        setSuppliers(Array.isArray(supData) ? supData : []);
        setArticles(Array.isArray(artData) ? artData : []);

        const rawDepots = Array.isArray(depData) ? depData : depData?.depots || [];
        setDepots(rawDepots);
        if (rawDepots.length > 0 && !selectedDepotId) {
          setSelectedDepotId(rawDepots[0].id);
        }
      } catch (e) {
        console.error("Failed to load PO metadata", e);
      } finally {
        setLoadingMeta(false);
      }
    };
    loadMetadata();
  }, []);

  const handleAutoSuggest = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await fetch("/api/bons-commande/auto-suggest");
      const data = await res.json();
      if (data.suggestions && data.suggestions.length > 0) {
        const suggestedRows: ItemRow[] = data.suggestions.map((s: any) => ({
          article_id: s.article_id,
          reference: s.reference,
          designation: s.designation,
          quantite: s.suggested_qty,
          prix_achat_unitaire: s.prix_achat_unitaire,
          current_stock: s.current_stock,
        }));
        setItems(suggestedRows);
      } else {
        alert(isAr ? "المخزون مكتمل وفعال! لا توجد منتجات تحت عتبة التنبيه حالياً." : "Stock optimal ! Aucun article sous le seuil critique pour le moment.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleArticleSelect = (index: number, articleId: number) => {
    const art = articles.find((a) => a.id === Number(articleId));
    if (!art) return;

    // Calculate total on-hand stock across depots
    const totalStock = (art.stocks || []).reduce((acc, s) => acc + (Number(s.quantite) || 0), 0);

    const next = [...items];
    next[index] = {
      ...next[index],
      article_id: art.id,
      reference: art.reference || "",
      designation: art.designation,
      prix_achat_unitaire: Number(art.p_achat_ht) || 0,
      prix_vente_ref: Number(art.p_vente_ttc) || 0,
      current_stock: totalStock,
    };
    setItems(next);
  };

  const updateItem = (index: number, field: keyof ItemRow, val: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: val };
    setItems(next);
  };

  const addItemRow = () => {
    setItems([...items, { designation: "", quantite: 10, prix_achat_unitaire: 0 }]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const totalHT = useMemo(() => {
    return items.reduce(
      (sum, it) => sum + (Number(it.quantite) || 0) * (Number(it.prix_achat_unitaire) || 0),
      0
    );
  }, [items]);

  const totalQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantite) || 0), 0);
  }, [items]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3500);
  };

  const selectedSupplierObj = useMemo(() => {
    return suppliers.find(
      (s) => s.nom.trim().toLowerCase() === selectedSupplierName.trim().toLowerCase()
    );
  }, [suppliers, selectedSupplierName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsMigrationError(false);

    if (!selectedSupplierName.trim()) {
      setErrorMessage(isAr ? "يرجى تحديد أو إدخال المورد الشريك" : "Veuillez sélectionner ou saisir un fournisseur partenaire.");
      return;
    }
    if (items.length === 0 || !items[0].designation.trim()) {
      setErrorMessage(isAr ? "يرجى إضافة صنف واحد على الأقل مع التعيين المناسب" : "Veuillez ajouter au moins un article avec une désignation valide.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/bons-commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fournisseur_id: selectedSupplierObj?.id || null,
          fournisseur_nom: selectedSupplierName.trim(),
          depot_id: selectedDepotId || null,
          date_livraison_prevue: dateLivraison || null,
          notes: notes.trim(),
          items: items.map((it) => ({
            article_id: it.article_id || null,
            reference: it.reference || null,
            designation: it.designation.trim(),
            quantite: Number(it.quantite) || 1,
            prix_achat_unitaire: Number(it.prix_achat_unitaire) || 0,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.migrationRequired || data.error?.includes("bons_commande") || data.error?.includes("schema cache")) {
          setIsMigrationError(true);
        }
        throw new Error(data.error || "Erreur lors de la création du bon de commande");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn" dir={dir}>
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        
        {/* Enterprise Glassmorphic Header */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-6 py-5 sm:px-8 sm:py-6 text-white flex items-center justify-between border-b border-indigo-500/20 relative">
          <div className="absolute top-0 right-0 w-96 h-full bg-indigo-500/10 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 border border-indigo-400/30">
              <Truck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {isAr ? "أمر شراء وتوريد مورد جديد (Purchase Order)" : "Nouveau Bon de Commande Fournisseur (PO)"}
                </h3>
                <span className="px-3 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-black border border-indigo-500/30">
                  {isAr ? "المشتريات والمخازن" : "PROCUREMENT & STOCKS"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 font-medium">
                {isAr 
                  ? "إنشاء طلب توريد رسمي مع تخصيص مستودع الاستلام، والاحتساب التلقائي مع خيار التموين الذكي"
                  : "Émettez un ordre d'approvisionnement officiel, ciblez le dépôt de réception et gérez vos flux de stocks"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer relative z-10"
          >
            <X size={22} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
          
          {/* Error Banner with 1-Click SQL Copy if table genuinely missing */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs space-y-3 animate-fadeIn">
              <div className="flex items-start gap-3 text-rose-800 dark:text-rose-200 font-semibold">
                <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-sm">
                    {isAr ? "تنبيه النظام أثناء المعالجة" : "Action Requise : Initialisation de la Table"}
                  </p>
                  <p className="mt-0.5 text-rose-700 dark:text-rose-300">{errorMessage}</p>
                </div>
              </div>

              {isMigrationError && (
                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-rose-700 dark:text-rose-300">
                    {isAr ? "افتح محرر Supabase SQL والصق الكود التالي:" : "Ouvrez Supabase SQL Editor et collez le script ci-dessous :"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    {copiedSql ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedSql ? (isAr ? "تم نسخ الكود !" : "Script SQL Copié !") : (isAr ? "نسخ سكريبت SQL" : "Copier le Script SQL")}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Commercial Header Info */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              
              {/* Supplier Selection */}
              <div className="sm:col-span-5">
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                  <Building2 size={14} className="text-indigo-500" />
                  <span>{isAr ? "المورد الشريك *" : "Fournisseur Partenaire *"}</span>
                </label>
                <div className="relative">
                  <input
                    list="suppliers-list"
                    type="text"
                    required
                    placeholder={isAr ? "ابحث أو اختر أو اكتب اسم المورد..." : "Rechercher ou saisir fournisseur..."}
                    value={selectedSupplierName}
                    onChange={(e) => setSelectedSupplierName(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-xs"
                  />
                  <datalist id="suppliers-list">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.nom}>
                        {s.telephone ? `📞 ${s.telephone}` : ""}
                      </option>
                    ))}
                  </datalist>
                </div>
                {selectedSupplierObj && (
                  <div className="flex items-center gap-3 mt-1.5 px-1 text-[11px] text-slate-500">
                    {selectedSupplierObj.telephone && (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <Phone size={11} /> {selectedSupplierObj.telephone}
                      </span>
                    )}
                    {typeof selectedSupplierObj.solde === "number" && (
                      <span>
                        {isAr ? "الرصيد المالي:" : "Solde actuel:"}{" "}
                        <strong className="text-slate-700 dark:text-slate-200">
                          {selectedSupplierObj.solde.toLocaleString("fr-FR")} FCFA
                        </strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Destination Depot Selection */}
              <div className="sm:col-span-4">
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                  <Boxes size={14} className="text-amber-500" />
                  <span>{isAr ? "مستودع الاستلام *" : "Dépôt de Réception *"}</span>
                </label>
                <select
                  value={selectedDepotId || ""}
                  onChange={(e) => setSelectedDepotId(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-xs cursor-pointer"
                >
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      📦 {d.nom} {d.type ? `(${d.type})` : ""}
                    </option>
                  ))}
                  {depots.length === 0 && (
                    <option value="">{isAr ? "المستودع الرئيسي الافتراضي" : "Dépôt Principal par défaut"}</option>
                  )}
                </select>
              </div>

              {/* Expected Delivery Date */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={14} className="text-purple-500" />
                  <span>{isAr ? "تاريخ التسليم المتوقع" : "Date Prévue"}</span>
                </label>
                <input
                  type="date"
                  value={dateLivraison}
                  onChange={(e) => setDateLivraison(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-xs"
                />
              </div>

            </div>
          </div>

          {/* Section 2: Items Table with Smart Replenishment Banner */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  {isAr ? `قائمة المواد المطلوبة (${items.length})` : `Articles & Quantités Commandés (${items.length})`}
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-black">
                  {totalQty} {isAr ? "قطعة" : "unités"}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Auto Reorder Button */}
                <button
                  type="button"
                  onClick={handleAutoSuggest}
                  disabled={loadingSuggestions}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50 active:scale-95"
                  title="Charger automatiquement les articles dont le stock est faible ou en rupture"
                >
                  {loadingSuggestions ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} className="text-amber-200" />
                  )}
                  <span>{isAr ? "⚡ تموين آلي للمخزون المنخفض" : "⚡ Réappro. Automatique"}</span>
                </button>

                {/* Add Row Button */}
                <button
                  type="button"
                  onClick={addItemRow}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <Plus size={15} />
                  <span>{isAr ? "إضافة سطر" : "Ajouter une ligne"}</span>
                </button>
              </div>
            </div>

            {/* Rows List */}
            <div className="space-y-3">
              {items.map((it, idx) => {
                const lineTotal = (Number(it.quantite) || 0) * (Number(it.prix_achat_unitaire) || 0);
                return (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50/90 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/70 grid grid-cols-12 gap-3.5 items-center transition-all shadow-xs group"
                  >
                    {/* Item Designation & Fast Search */}
                    <div className="col-span-12 md:col-span-5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                          <span>{isAr ? "تعيين الصنف / المنتج" : "Article / Désignation"}</span>
                        </label>
                        {typeof it.current_stock === "number" && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            it.current_stock <= 0
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                              : it.current_stock <= 5
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
                          }`}>
                            {isAr ? `المخزون الحالي: ${it.current_stock}` : `Stock act.: ${it.current_stock}`}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {articles.length > 0 && (
                          <select
                            onChange={(e) => handleArticleSelect(idx, Number(e.target.value))}
                            className="w-2/5 px-2.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                            value={it.article_id || ""}
                          >
                            <option value="">{isAr ? "من الدليل..." : "Catalogue..."}</option>
                            {articles.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.designation} {a.reference ? `[${a.reference}]` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          required
                          placeholder={isAr ? "اسم الصنف أو البيان..." : "Désignation de l'article..."}
                          value={it.designation}
                          onChange={(e) => updateItem(idx, "designation", e.target.value)}
                          className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                        />
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-6 sm:col-span-3 md:col-span-2 space-y-1">
                      <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        {isAr ? "الكمية المطلوبة" : "Quantité"}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={it.quantite}
                        onChange={(e) => updateItem(idx, "quantite", e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>

                    {/* Unit Purchase Price */}
                    <div className="col-span-6 sm:col-span-3 md:col-span-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          {isAr ? "سعر الشراء المقدر" : "Prix Achat Est."}
                        </label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={it.prix_achat_unitaire}
                        onChange={(e) => updateItem(idx, "prix_achat_unitaire", e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                      />
                    </div>

                    {/* Line Total */}
                    <div className="col-span-9 sm:col-span-4 md:col-span-2 text-right space-y-1">
                      <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                        {isAr ? "إجمالي السطر" : "Total Ligne"}
                      </span>
                      <div className="text-xs sm:text-sm font-black font-mono text-indigo-600 dark:text-indigo-400 py-1.5">
                        {lineTotal.toLocaleString("fr-FR")} <span className="text-[10px]">FCFA</span>
                      </div>
                    </div>

                    {/* Delete Line Button */}
                    <div className="col-span-3 sm:col-span-2 md:col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length <= 1}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all disabled:opacity-25 cursor-pointer"
                        title="Supprimer la ligne"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Notes & Financial Grand Totals */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
            
            {/* Notes */}
            <div className="md:col-span-7 space-y-2">
              <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                {isAr ? "تعليمات وملاحظات لأمر الشراء" : "Instructions ou observations pour le fournisseur"}
              </label>
              <textarea
                rows={3}
                placeholder={
                  isAr
                    ? "مثال: تسليم بمستودع المستودع المركزي، فحص جودة وتاريخ انتهاء الصلاحية..."
                    : "Ex: Livraison au dépôt central, validation échantillon requise, délai 48h..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            {/* Grand Total Recap Card */}
            <div className="md:col-span-5 p-5 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-3xl border border-indigo-100 dark:border-indigo-900/50 flex flex-col justify-between space-y-3">
              <div className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>{isAr ? "عدد المواد المختلفة:" : "Total Articles:"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAr ? "إجمالي الوحدات:" : "Total Quantités:"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{totalQty}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isAr ? "الضريبة المقدرة:" : "Taxe (TVA):"}</span>
                  <span className="text-emerald-600 font-bold">{isAr ? "معفى (0%)" : "Exonéré (0%)"}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-indigo-200/60 dark:border-indigo-800/60 text-right">
                <span className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-wider block">
                  {isAr ? "المبلغ الإجمالي المقدر (FCFA)" : "Montant Total Estimé (HT / TTC)"}
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                  {totalHT.toLocaleString("fr-FR")} <span className="text-sm font-bold">FCFA</span>
                </div>
              </div>
            </div>

          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-black hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              {isAr ? "إلغاء" : "Annuler"}
            </button>
            
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>
                {saving 
                  ? (isAr ? "جارٍ الحفظ..." : "Enregistrement...") 
                  : (isAr ? "إصدار وحفظ أمر الشراء" : "Enregistrer le Bon de Commande")}
              </span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
