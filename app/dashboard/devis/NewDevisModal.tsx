"use client";

import { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  Search,
  User,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  Sparkles,
  Layers,
  Package
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type NewDevisModalProps = {
  onClose: () => void;
  onSaved: () => void;
};

export default function NewDevisModal({
  onClose,
  onSaved,
}: NewDevisModalProps) {
  const { locale, dir } = useLanguage();
  const [clients, setClients] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [selectedClientId, setSelectedClientId] = useState<number | "">("");
  const [clientNom, setClientNom] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [dateDevis, setDateDevis] = useState(new Date().toISOString().split("T")[0]);

  // Default validity: 30 days from today
  const defaultValidite = new Date();
  defaultValidite.setDate(defaultValidite.getDate() + 30);
  const [dateValidite, setDateValidite] = useState(defaultValidite.toISOString().split("T")[0]);

  const [notes, setNotes] = useState("");

  // Items list in quote
  const [items, setItems] = useState<any[]>([
    { article_id: null, reference: "", description: "", qte: 1, pu_ht: 0, remise_pourcentage: 0, taux_tva: 0 }
  ]);

  // Article search state for adding rows
  const [articleQuery, setArticleQuery] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [cRes, aRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/articles"),
        ]);
        const [cData, aData] = await Promise.all([
          cRes.ok ? cRes.json() : [],
          aRes.ok ? aRes.json() : [],
        ]);
        setClients(Array.isArray(cData) ? cData : (cData.clients || []));
        setArticles(Array.isArray(aData) ? aData : (aData.articles || []));
      } catch (e) {
        console.error("Error loading initial data for devis", e);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  const handleClientChange = (clientId: string) => {
    if (!clientId) {
      setSelectedClientId("");
      return;
    }
    const id = Number(clientId);
    setSelectedClientId(id);
    const c = clients.find((item) => item.id === id);
    if (c) {
      setClientNom(c.nom || "");
      setClientTel(c.tel || "");
      setClientAdresse(c.adresse || "");
    }
  };

  const addItemRow = (article?: any) => {
    if (article) {
      setItems([
        ...items,
        {
          article_id: article.id,
          reference: article.reference,
          description: article.designation,
          qte: 1,
          pu_ht: Number(article.p_vente_ht || article.p_vente_ttc || 0),
          remise_pourcentage: 0,
          taux_tva: 0,
        },
      ]);
    } else {
      setItems([
        ...items,
        { article_id: null, reference: "", description: "", qte: 1, pu_ht: 0, remise_pourcentage: 0, taux_tva: 0 },
      ]);
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Compute live totals
  const totalHT = items.reduce((sum, it) => {
    const qte = Number(it.qte) || 0;
    const pu = Number(it.pu_ht) || 0;
    const remise = Number(it.remise_pourcentage) || 0;
    return sum + (qte * pu * (1 - remise / 100));
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientNom) {
      alert("Veuillez saisir ou sélectionner le nom du client.");
      return;
    }

    const validItems = items.filter((it) => it.description.trim() !== "");
    if (validItems.length === 0) {
      alert("Veuillez saisir au moins un article valide.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/devis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClientId || null,
          client_nom: clientNom,
          client_tel: clientTel,
          client_adresse: clientAdresse,
          date_devis: dateDevis,
          date_validite: dateValidite,
          notes,
          items: validItems,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Erreur lors de l'enregistrement");
      }

      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto font-sans" dir={dir}>
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                {locale === "ar" ? "إنشاء عرض سعر / فاتورة شكلية جديدة" : "Établissement d'un Nouveau Devis (Proforma)"}
              </h3>
              <p className="text-[11px] text-slate-300">
                {locale === "ar" ? "إعداد عرض سعر قابل للتحويل إلى فاتورة مبيعات بنقرة واحدة" : "Devis commercial avec validité et conversion en vente directe"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Client & Dates Grid */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User size={14} className="text-indigo-600" />
              {locale === "ar" ? "بيانات العميل والفترة" : "Informations Client & Délais"}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Existing Client Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {locale === "ar" ? "عميل مسجل (اختياري)" : "Client existant"}
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">{locale === "ar" ? "-- اختر عميلاً أو أدخل بياناته --" : "-- Choisir un client existant --"}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.nom}</option>
                  ))}
                </select>
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {locale === "ar" ? "اسم العميل *" : "Nom du client *"}
                </label>
                <input
                  type="text"
                  required
                  value={clientNom}
                  onChange={(e) => setClientNom(e.target.value)}
                  placeholder="Ex: Entreprise Sahel SARL"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Client Phone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {locale === "ar" ? "الهاتف" : "Téléphone"}
                </label>
                <input
                  type="text"
                  value={clientTel}
                  onChange={(e) => setClientTel(e.target.value)}
                  placeholder="+227 00 00 00 00"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {locale === "ar" ? "تاريخ الإصدار" : "Date du devis"}
                </label>
                <input
                  type="date"
                  value={dateDevis}
                  onChange={(e) => setDateDevis(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {locale === "ar" ? "تاريخ انتهاء الصلاحية" : "Date de validité"}
                </label>
                <input
                  type="date"
                  value={dateValidite}
                  onChange={(e) => setDateValidite(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Package size={14} className="text-indigo-600" />
                {locale === "ar" ? "أصناف وبنود عرض السعر" : "Articles & Prestations"}
              </h4>

              {/* Quick Article Search Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  onChange={(e) => {
                    const art = articles.find((a) => String(a.id) === e.target.value);
                    if (art) addItemRow(art);
                    e.target.value = "";
                  }}
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="">{locale === "ar" ? "+ أضف صنفاً من الكتالوج..." : "+ Ajouter depuis le catalogue..."}</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.designation} ({formatCurrencyAmount(a.p_vente_ht || a.p_vente_ttc || 0, "FCFA")})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => addItemRow()}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>{locale === "ar" ? "سطر يدوي" : "Ligne libre"}</span>
                </button>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="px-3 py-2.5 w-1/2">{locale === "ar" ? "الوصف" : "Désignation"}</th>
                    <th className="px-2 py-2.5 w-20 text-center">{locale === "ar" ? "الكمية" : "Qté"}</th>
                    <th className="px-2 py-2.5 w-28 text-right">{locale === "ar" ? "السعر" : "P.U HT"}</th>
                    <th className="px-2 py-2.5 w-20 text-right">{locale === "ar" ? "خصم %" : "Remise %"}</th>
                    <th className="px-2 py-2.5 w-28 text-right">{locale === "ar" ? "الإجمالي" : "Total HT"}</th>
                    <th className="px-2 py-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => {
                    const lineTotal = (Number(it.qte) || 0) * (Number(it.pu_ht) || 0) * (1 - (Number(it.remise_pourcentage) || 0) / 100);
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            required
                            value={it.description}
                            onChange={(e) => updateItem(idx, "description", e.target.value)}
                            placeholder="Désignation du produit ou service..."
                            className="w-full bg-transparent font-bold text-slate-800 outline-none text-xs"
                          />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={it.qte}
                            onChange={(e) => updateItem(idx, "qte", Number(e.target.value) || 0)}
                            className="w-16 text-center font-black bg-slate-50 rounded-lg p-1 text-slate-800 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={it.pu_ht}
                            onChange={(e) => updateItem(idx, "pu_ht", Number(e.target.value) || 0)}
                            className="w-24 text-right font-black font-mono bg-slate-50 rounded-lg p-1 text-slate-800 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={it.remise_pourcentage}
                            onChange={(e) => updateItem(idx, "remise_pourcentage", Number(e.target.value) || 0)}
                            className="w-14 text-right font-bold bg-slate-50 rounded-lg p-1 text-slate-600 outline-none"
                          />
                        </td>
                        <td className="px-2 py-2 text-right font-black font-mono text-slate-900">
                          {formatCurrencyAmount(lineTotal, "FCFA")}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            disabled={items.length <= 1}
                            className="text-slate-300 hover:text-rose-600 transition-colors disabled:opacity-20 cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50/50 border-t-2 border-indigo-200 font-black text-xs">
                    <td colSpan={4} className="px-3 py-3 text-right uppercase text-indigo-900">
                      {locale === "ar" ? "المجموع الكلي لعرض السعر:" : "TOTAL ESTIMÉ DU DEVIS :"}
                    </td>
                    <td className="px-2 py-3 text-right font-mono text-sm text-indigo-900">
                      {formatCurrencyAmount(totalHT, "FCFA")}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {locale === "ar" ? "شروط وملاحظات عرض السعر" : "Conditions & Notes"}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Offre valable sous réserve des stocks disponibles. Modalités de paiement à définir..."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            >
              {locale === "ar" ? "إلغاء" : "Annuler"}
            </button>

            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? (locale === "ar" ? "جاري الحفظ..." : "Enregistrement...") : (locale === "ar" ? "حفظ وتوليد عرض السعر" : "Enregistrer le Devis")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
