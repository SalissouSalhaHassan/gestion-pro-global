"use client";

import { useState, useEffect } from "react";
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
  ExternalLink,
  DollarSign
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";

type Supplier = {
  id: number;
  nom: string;
  telephone?: string;
};

type Article = {
  id: number;
  reference: string;
  designation: string;
  p_achat_ht: number;
};

type ItemRow = {
  article_id?: number;
  reference?: string;
  designation: string;
  quantite: number;
  prix_achat_unitaire: number;
};

type NewBCModalProps = {
  onClose: () => void;
  onSuccess: () => void;
  initialSuggestions?: ItemRow[];
};

const SQL_MIGRATION_SCRIPT = `-- 1. Table des bons de commande (En-tête)
CREATE TABLE IF NOT EXISTS public.bons_commande (
    id SERIAL PRIMARY KEY,
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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [dateLivraison, setDateLivraison] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>(
    initialSuggestions && initialSuggestions.length > 0
      ? initialSuggestions
      : [{ designation: "", quantite: 10, prix_achat_unitaire: 0 }]
  );
  const [saving, setSaving] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Error & Migration states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMigrationError, setIsMigrationError] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    // Load suppliers and articles
    const loadMetadata = async () => {
      try {
        const [supRes, artRes] = await Promise.all([
          fetch("/api/suppliers"),
          fetch("/api/articles"),
        ]);
        const supData = await supRes.json();
        const artData = await artRes.json();
        setSuppliers(Array.isArray(supData) ? supData : []);
        setArticles(Array.isArray(artData) ? artData : []);
      } catch (e) {
        console.error("Failed to load PO metadata", e);
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
        }));
        setItems(suggestedRows);
      } else {
        alert("Stock optimal ! Aucun article sous le seuil critique pour le moment.");
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
    const next = [...items];
    next[index] = {
      ...next[index],
      article_id: art.id,
      reference: art.reference,
      designation: art.designation,
      prix_achat_unitaire: Number(art.p_achat_ht) || 0,
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

  const totalHT = items.reduce(
    (sum, it) => sum + (Number(it.quantite) || 0) * (Number(it.prix_achat_unitaire) || 0),
    0
  );

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsMigrationError(false);

    if (!selectedSupplier.trim()) {
      setErrorMessage("Veuillez sélectionner ou saisir un fournisseur partenaire.");
      return;
    }
    if (items.length === 0 || !items[0].designation.trim()) {
      setErrorMessage("Veuillez ajouter au moins un article avec une désignation valide.");
      return;
    }

    const supObj = suppliers.find((s) => s.nom === selectedSupplier);

    try {
      setSaving(true);
      const res = await fetch("/api/bons-commande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fournisseur_id: supObj?.id || null,
          fournisseur_nom: selectedSupplier.trim(),
          date_livraison_prevue: dateLivraison || null,
          notes: notes.trim(),
          items,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-inner">
              <Truck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">
                  Nouveau Bon de Commande Fournisseur (PO)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  ACHATS & STOCK
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Générez un ordre d'approvisionnement officiel avec calcul automatique et dispatch WhatsApp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-6 overflow-y-auto max-h-[78vh] custom-scrollbar">
          {/* Error Banner with 1-Click SQL Copy if schema is missing */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs space-y-3 animate-fadeIn">
              <div className="flex items-start gap-3 text-rose-800 dark:text-rose-200 font-semibold">
                <AlertCircle size={20} className="shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-sm">Action Requise : Initialisation de la Table</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
              </div>

              {isMigrationError && (
                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/40 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11px] text-rose-700 dark:text-rose-300">
                    Ouvrez Supabase SQL Editor et collez le script ci-dessous :
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedSql ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedSql ? "Script SQL Copié !" : "Copier le Script SQL"}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Top Bar: Supplier, Expected Date, Auto-Suggest Button */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Fournisseur Partenaire *
              </label>
              <input
                list="suppliers-list"
                type="text"
                required
                placeholder="Rechercher ou saisir fournisseur..."
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <datalist id="suppliers-list">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.nom} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Date de Livraison Souhaitée
              </label>
              <input
                type="date"
                value={dateLivraison}
                onChange={(e) => setDateLivraison(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleAutoSuggest}
                disabled={loadingSuggestions}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {loadingSuggestions ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} className="text-amber-200" />
                )}
                <span>Réappro. Automatique (Stock Faible)</span>
              </button>
            </div>
          </div>

          {/* Items & Quantities Table Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                Articles & Quantités à Commander ({items.length})
              </span>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus size={15} />
                <span>Ajouter une ligne</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => {
                const lineTotal = (Number(it.quantite) || 0) * (Number(it.prix_achat_unitaire) || 0);
                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 grid grid-cols-12 gap-3 items-center group"
                  >
                    {/* Article select / input */}
                    <div className="col-span-12 sm:col-span-5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Article / Désignation
                      </label>
                      <div className="flex gap-2">
                        {articles.length > 0 && (
                          <select
                            onChange={(e) => handleArticleSelect(idx, Number(e.target.value))}
                            className="w-1/3 px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                            defaultValue=""
                          >
                            <option value="" disabled>Catalogue...</option>
                            {articles.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.designation}
                              </option>
                            ))}
                          </select>
                        )}
                        <input
                          type="text"
                          required
                          placeholder="Désignation de l'article..."
                          value={it.designation}
                          onChange={(e) => updateItem(idx, "designation", e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Quantity */}
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Quantité
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        required
                        value={it.quantite}
                        onChange={(e) => updateItem(idx, "quantite", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Unit Cost */}
                    <div className="col-span-4 sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Prix Achat Est.
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={it.prix_achat_unitaire}
                        onChange={(e) => updateItem(idx, "prix_achat_unitaire", e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Line Total */}
                    <div className="col-span-3 sm:col-span-2 text-right">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                        Total Ligne
                      </span>
                      <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                        {lineTotal.toLocaleString("fr-FR")} FCFA
                      </span>
                    </div>

                    {/* Delete row */}
                    <div className="col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        disabled={items.length <= 1}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-30 cursor-pointer"
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

          {/* Notes and Total summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Instructions ou observations pour le fournisseur
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Livraison au dépôt principal, validation échantillon requise..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-center items-end">
              <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                Montant Total Estimé (HT)
              </span>
              <div className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                {totalHT.toLocaleString("fr-FR")} <span className="text-xs">FCFA</span>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? "Enregistrement..." : "Enregistrer le Bon de Commande"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
