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
  AlertCircle
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
        alert("Aucun article en stock faible détecté !");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) {
      alert("Veuillez sélectionner un fournisseur.");
      return;
    }
    if (items.length === 0 || !items[0].designation) {
      alert("Veuillez ajouter au moins un article avec une désignation.");
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
          fournisseur_nom: selectedSupplier,
          date_livraison_prevue: dateLivraison || null,
          notes,
          items,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la création");
      }

      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Truck size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Nouveau Bon de Commande Fournisseur (PO)
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  ACHATS
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                Générez un ordre d'approvisionnement officiel avec calcul automatique
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Top Bar: Supplier, Expected Date, Auto-Suggest Button */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fournisseur Partenaire *
              </label>
              <input
                list="suppliers-list"
                type="text"
                required
                placeholder="Rechercher ou saisir fournisseur..."
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <datalist id="suppliers-list">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.nom} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date de Livraison Souhaitée
              </label>
              <input
                type="date"
                value={dateLivraison}
                onChange={(e) => setDateLivraison(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleAutoSuggest}
                disabled={loadingSuggestions}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {loadingSuggestions ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} />
                )}
                <span>⚡ Réappro. Automatique (Stock Faible)</span>
              </button>
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">
                Articles & Quantités à Commander ({items.length})
              </span>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>Ajouter une ligne</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                    <th className="px-4 py-3">Article / Désignation</th>
                    <th className="px-4 py-3 w-28 text-center">Quantité</th>
                    <th className="px-4 py-3 w-36 text-right">Prix Achat Estimé</th>
                    <th className="px-4 py-3 w-36 text-right">Total Ligne</th>
                    <th className="px-2 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5">
                        <div className="space-y-1">
                          <input
                            list={`articles-list-${idx}`}
                            type="text"
                            placeholder="Choisir un article du catalogue..."
                            value={it.designation}
                            onChange={(e) => {
                              const match = articles.find((a) => a.designation === e.target.value);
                              if (match) {
                                handleArticleSelect(idx, match.id);
                              } else {
                                updateItem(idx, "designation", e.target.value);
                              }
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <datalist id={`articles-list-${idx}`}>
                            {articles.map((a) => (
                              <option key={a.id} value={a.designation} />
                            ))}
                          </datalist>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="1"
                          value={it.quantite}
                          onChange={(e) =>
                            updateItem(idx, "quantite", Number(e.target.value) || 1)
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-black text-center text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={it.prix_achat_unitaire}
                          onChange={(e) =>
                            updateItem(idx, "prix_achat_unitaire", Number(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-right text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900">
                        {formatCurrencyAmount(
                          (Number(it.quantite) || 0) * (Number(it.prix_achat_unitaire) || 0),
                          "FCFA"
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Total Bar & Notes */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex-1 w-full sm:w-auto">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Instructions ou observations pour le fournisseur..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white"
              />
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <span className="text-xs font-bold text-slate-500">Montant Total Estimé :</span>
              <span className="text-lg font-black font-mono text-indigo-700 bg-white px-3.5 py-1.5 rounded-xl border border-indigo-100 shadow-2xs">
                {formatCurrencyAmount(totalHT, "FCFA")}
              </span>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Enregistrer le Bon de Commande</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
