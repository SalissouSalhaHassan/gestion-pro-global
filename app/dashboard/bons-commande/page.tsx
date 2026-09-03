"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Truck,
  Plus,
  Search,
  Filter,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  Printer,
  MessageCircle,
  PackageCheck,
  Eye,
  Trash2,
  Loader2,
  Calendar
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import NewBCModal from "./NewBCModal";
import BCDetailModal from "./BCDetailModal";

type BC = {
  id: number;
  numero_bc: string;
  date_commande: string;
  date_livraison_prevue?: string;
  fournisseur_nom: string;
  statut: string;
  total_ht: number;
  total_ttc: number;
  notes?: string;
  created_by?: string;
  items?: any[];
};

export default function BonsCommandePage() {
  const { locale, dir } = useLanguage();
  const [bcs, setBcs] = useState<BC[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedBc, setSelectedBc] = useState<BC | null>(null);
  const [autoSuggestions, setAutoSuggestions] = useState<any[]>([]);

  const fetchBcs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("statut", statusFilter);
      if (search) params.append("search", search);

      const res = await fetch(`/api/bons-commande?${params.toString()}`);
      const data = await res.json();
      setBcs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load POs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBcs();
  }, [statusFilter]);

  const handleLaunchAutoReorder = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/bons-commande/auto-suggest");
      const data = await res.json();
      if (data.suggestions && data.suggestions.length > 0) {
        const rows = data.suggestions.map((s: any) => ({
          article_id: s.article_id,
          reference: s.reference,
          designation: s.designation,
          quantite: s.suggested_qty,
          prix_achat_unitaire: s.prix_achat_unitaire,
        }));
        setAutoSuggestions(rows);
        setIsNewModalOpen(true);
      } else {
        alert(locale === "ar" ? "المخزون ممتاز! لا توجد أصناف قريبة من النفاد حالياً." : "Aucun article en rupture ou seuil critique.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBc = async (id: number) => {
    if (!confirm(locale === "ar" ? "هل أنت متأكد من حذف أمر الشراء هذا؟" : "Supprimer ce bon de commande ?")) return;

    try {
      const res = await fetch(`/api/bons-commande/${id}`, { method: "DELETE" });
      if (res.ok) {
        setBcs(bcs.filter((b) => b.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredBcs = useMemo(() => {
    if (!search) return bcs;
    const q = search.toLowerCase();
    return bcs.filter(
      (b) =>
        b.numero_bc.toLowerCase().includes(q) ||
        b.fournisseur_nom.toLowerCase().includes(q)
    );
  }, [bcs, search]);

  // KPIs
  const totalBcs = bcs.length;
  const pendingBcs = bcs.filter((b) => b.statut !== "REÇU").length;
  const receivedBcs = bcs.filter((b) => b.statut === "REÇU").length;
  const totalCommittedValue = bcs.reduce((sum, b) => sum + (Number(b.total_ttc) || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* 4K Hero Header */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Truck size={14} />
                PROCUREMENT STUDIO 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                RÉAPPROVISIONNEMENT AUTOMATIQUE
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "أوامر الشراء وإعادة التموين الآلي (Bons de Commande)" : "Bons de Commande Fournisseurs (PO)"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "توليد أوامر التوريد، استلام البضائع بالتحويل إلى المخزون بنقرة واحدة، والمشاركة عبر WhatsApp"
                : "Automatisez vos approvisionnements, gérez vos bons de commande et réceptions de stock en 1-clic"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleLaunchAutoReorder}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>{locale === "ar" ? "⚡ تموين آلي (نواقص المخزون)" : "⚡ Réappro. Automatique"}</span>
            </button>

            <button
              onClick={() => {
                setAutoSuggestions([]);
                setIsNewModalOpen(true);
              }}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-black shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{locale === "ar" ? "أمر شراء جديد" : "Nouveau Bon de Commande"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الأوامر" : "Total Commandes"}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <FileText size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalBcs}</div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "أوامر شراء مسجلة" : "Ordres émis"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "في انتظار التوريد" : "En Attente Fournisseur"}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">{pendingBcs}</div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "بضائع قيد الشحن والتسليم" : "Livraison attendue"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "مستلمة ومدخلة للمخزون" : "Réceptionnées"}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">{receivedBcs}</div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "تم استلامها وتغذية المستودعات" : "Entrées en stock validées"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "قيمة المشتريات الملتزم بها" : "Valeur Engagée"}
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono">
            {formatCurrencyAmount(totalCommittedValue, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "إجمالي التكلفة التقديرية" : "Budget prévisionnel achats"}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث برقم الأمر أو اسم المورد..." : "Rechercher par N° BC ou fournisseur..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
          {["ALL", "BROUILLON", "REÇU"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {st === "ALL" ? (locale === "ar" ? "الكل" : "Tous") : st === "REÇU" ? (locale === "ar" ? "مستلمة" : "Reçus") : (locale === "ar" ? "مسودة" : "Brouillons")}
            </button>
          ))}
        </div>

        <button
          onClick={fetchBcs}
          className="p-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">{locale === "ar" ? "رقم الأمر" : "N° Commande"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "التاريخ" : "Date"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "المورد" : "Fournisseur"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "تاريخ التسليم" : "Livraison Prévue"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "المبلغ التقديري" : "Total TTC"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "الحالة" : "Statut"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-3 text-indigo-600" size={36} />
                      <p className="font-bold text-slate-600 text-xs">
                        {locale === "ar" ? "جاري تحميل أوامر الشراء..." : "Chargement des commandes..."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredBcs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Truck className="opacity-20 mb-3 text-indigo-600" size={48} />
                      <p className="font-black text-slate-700 text-sm">
                        {locale === "ar" ? "لا توجد أوامر شراء مسجلة." : "Aucun bon de commande trouvé."}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {locale === "ar"
                          ? "اضغط على تموين آلي لتوليد أمر شراء للأصناف الناقصة بنقرة واحدة."
                          : "Cliquez sur 'Réappro. Automatique' pour générer un ordre basé sur vos ruptures."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBcs.map((bc) => (
                  <tr key={bc.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-black text-indigo-700 text-xs">
                      {bc.numero_bc}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                      {new Date(bc.date_commande).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {bc.fournisseur_nom}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {bc.date_livraison_prevue
                        ? new Date(bc.date_livraison_prevue).toLocaleDateString("fr-FR")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-black font-mono text-slate-900">
                      {formatCurrencyAmount(bc.total_ttc, "FCFA")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border ${
                          bc.statut === "REÇU"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {bc.statut === "REÇU" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {bc.statut}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedBc(bc)}
                          className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white transition-all cursor-pointer shadow-2xs"
                          title="Voir / Imprimer / Réceptionner"
                        >
                          <Eye size={15} />
                        </button>
                        {bc.statut !== "REÇU" && (
                          <button
                            onClick={() => handleDeleteBc(bc.id)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white transition-all cursor-pointer shadow-2xs"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isNewModalOpen && (
        <NewBCModal
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={() => {
            setIsNewModalOpen(false);
            fetchBcs();
          }}
          initialSuggestions={autoSuggestions}
        />
      )}

      {selectedBc && (
        <BCDetailModal
          bc={selectedBc}
          onClose={() => setSelectedBc(null)}
          onRefresh={fetchBcs}
        />
      )}
    </div>
  );
}
