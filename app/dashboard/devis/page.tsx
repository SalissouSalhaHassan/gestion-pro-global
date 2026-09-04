"use client";

import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Search,
  Plus,
  Printer,
  Trash2,
  Eye,
  Filter,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Loader2,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCheck,
  Download,
  Copy,
  Check,
  Database,
  MessageSquare
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { generateDevisWhatsAppMessage, openWhatsAppDirect } from "@/lib/utils/whatsapp";
import DevisModal from "./DevisModal";
import NewDevisModal from "./NewDevisModal";

const SQL_MIGRATION_SCRIPT = `-- ==============================================================================
-- MIGRATION: devis & devis_items (Quotations & Proforma Invoices)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.devis (
    id SERIAL PRIMARY KEY,
    numero_devis VARCHAR(50) NOT NULL UNIQUE,
    client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
    client_nom VARCHAR(255) NOT NULL,
    client_tel VARCHAR(50),
    client_adresse TEXT,
    date_devis DATE NOT NULL DEFAULT CURRENT_DATE,
    date_validite DATE,
    total_ht NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_tva NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_ttc NUMERIC(15, 2) NOT NULL DEFAULT 0,
    statut VARCHAR(50) NOT NULL DEFAULT 'En attente',
    facture_id INTEGER REFERENCES public.factures(id) ON DELETE SET NULL,
    vendeur VARCHAR(100),
    notes TEXT,
    conditions_reglement TEXT,
    organization_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.devis_items (
    id SERIAL PRIMARY KEY,
    devis_id INTEGER NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES public.articles(id) ON DELETE SET NULL,
    reference VARCHAR(100),
    description VARCHAR(255) NOT NULL,
    qte NUMERIC(12, 3) NOT NULL DEFAULT 1,
    pu_ht NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remise_pourcentage NUMERIC(5, 2) DEFAULT 0,
    taux_tva NUMERIC(5, 2) DEFAULT 0,
    total_ligne_ht NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_ligne_ttc NUMERIC(15, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_devis_date ON public.devis (date_devis DESC);
CREATE INDEX IF NOT EXISTS idx_devis_client ON public.devis (client_id, date_devis DESC);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON public.devis (statut);
CREATE INDEX IF NOT EXISTS idx_devis_items_devis ON public.devis_items (devis_id);

ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devis_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users on devis" ON public.devis FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users on devis" ON public.devis FOR ALL USING (true);
CREATE POLICY "Enable read for authenticated users on devis_items" ON public.devis_items FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users on devis_items" ON public.devis_items FOR ALL USING (true);
NOTIFY pgrst, 'reload schema';`;

type Devis = {
  id: number;
  numero_devis: string;
  client_nom: string;
  client_tel?: string;
  date_devis: string;
  date_validite?: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  statut: string;
  facture_id?: number;
  vendeur?: string;
  devis_items?: any[];
};

export default function DevisPage() {
  const { locale, dir } = useLanguage();
  const [devisList, setDevisList] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbNeedsSetup, setDbNeedsSetup] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals
  const [selectedDevisId, setSelectedDevisId] = useState<number | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchDevis = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (startDate) params.append("start", startDate);
      if (endDate) params.append("end", endDate);

      const res = await fetch(`/api/devis?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setDevisList(Array.isArray(data) ? data : []);
        setDbNeedsSetup(false);
      } else {
        if (data.error && (data.error.includes("devis") || data.error.includes("does not exist") || data.error.includes("42P01"))) {
          setDbNeedsSetup(true);
        }
      }
    } catch (err) {
      console.error("Failed to fetch devis", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevis();
  }, [statusFilter, startDate, endDate]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const exportToCSV = () => {
    if (filteredDevis.length === 0) return;
    const headers = [
      "N° Devis",
      "Client",
      "Téléphone",
      "Date Émission",
      "Date Validité",
      "Total HT",
      "Total TVA",
      "Total TTC",
      "Statut",
      "Commercial"
    ];

    const rows = filteredDevis.map((d) => [
      `"${d.numero_devis}"`,
      `"${(d.client_nom || "").replace(/"/g, '""')}"`,
      `"${(d.client_tel || "").replace(/"/g, '""')}"`,
      d.date_devis,
      d.date_validite || "",
      d.total_ht,
      d.total_tva,
      d.total_ttc,
      d.statut,
      `"${(d.vendeur || "").replace(/"/g, '""')}"`
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `devis_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(locale === "ar" ? "هل أنت متأكد من حذف عرض السعر هذا؟" : "Voulez-vous supprimer ce devis ?")) return;

    try {
      const res = await fetch(`/api/devis/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur de suppression");
      setDevisList((prev) => prev.filter((d) => d.id !== id));
      setToast({ message: locale === "ar" ? "تم حذف عرض السعر بنجاح." : "Devis supprimé avec succès.", type: "success" });
    } catch (err) {
      setToast({ message: locale === "ar" ? "خطأ أثناء الحذف." : "Erreur lors de la suppression.", type: "error" });
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Quick 1-click convert from table row
  const handleConvert = async (id: number) => {
    if (!confirm(locale === "ar" ? "هل تريد تحويل عرض السعر إلى فاتورة بيع حقيقية وخصم المخزون؟" : "Convertir ce devis en facture définitive ?")) return;

    try {
      const res = await fetch(`/api/devis/${id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur de conversion");

      setToast({ message: json.message, type: "success" });
      fetchDevis();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTimeout(() => setToast(null), 4000);
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const totalVolume = devisList.reduce((sum, d) => sum + (Number(d.total_ttc) || 0), 0);
    const countTotal = devisList.length;
    const countEnAttente = devisList.filter((d) => d.statut === "En attente").length;
    const countConvertis = devisList.filter((d) => d.statut === "Converti").length;
    const conversionRate = countTotal > 0 ? (countConvertis / countTotal) * 100 : 0;

    return { totalVolume, countTotal, countEnAttente, countConvertis, conversionRate };
  }, [devisList]);

  // Client-side search filtering
  const filteredDevis = useMemo(() => {
    if (!search) return devisList;
    const q = search.toLowerCase();
    return devisList.filter(
      (d) =>
        d.numero_devis.toLowerCase().includes(q) ||
        d.client_nom.toLowerCase().includes(q) ||
        (d.vendeur && d.vendeur.toLowerCase().includes(q))
    );
  }, [devisList, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Converti":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} />
            {locale === "ar" ? "متحول لفاتورة" : "Converti"}
          </span>
        );
      case "Accepté":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCheck size={12} />
            {locale === "ar" ? "مقبول" : "Accepté"}
          </span>
        );
      case "Refusé":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={12} />
            {locale === "ar" ? "مرفوض" : "Refusé"}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} />
            {locale === "ar" ? "قيد الانتظار" : "En attente"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl font-bold text-white flex items-center gap-3 transition-all animate-in slide-in-from-top-3 ${
          toast.type === "success" ? "bg-slate-900 border border-emerald-500/30 text-emerald-400" : "bg-rose-950 border border-rose-500/30 text-rose-400"
        }`}>
          <CheckCheck size={20} className={toast.type === "success" ? "text-emerald-400" : "text-rose-400"} />
          <span className="text-xs font-black text-white">{toast.message}</span>
        </div>
      )}

      {/* Database Missing Notice / Migration Banner */}
      {dbNeedsSetup && (
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600">
              <Database size={22} />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-950">
                {locale === "ar" ? "جداول عروض الأسعار (Devis) تحتاج تهيئة في قاعدة البيانات" : "Tables Devis non installées dans Supabase"}
              </h4>
              <p className="text-xs text-amber-800 font-medium">
                {locale === "ar"
                  ? "انسخ سكربت التثبيت ونفذه في Supabase SQL Editor لتفعيل ميزة عروض الأسعار والفواتير الشكلية فوراً."
                  : "Copiez le script SQL et exécutez-le dans Supabase SQL Editor pour initialiser les tables devis et devis_items."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySql}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              {sqlCopied ? <Check size={14} /> : <Copy size={14} />}
              <span>{sqlCopied ? (locale === "ar" ? "تم النسخ!" : "Copié !") : (locale === "ar" ? "نسخ السكربت" : "Copier le SQL")}</span>
            </button>
            <button
              onClick={() => setIsSqlModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs transition-all cursor-pointer"
            >
              {locale === "ar" ? "عرض الكود" : "Voir Script"}
            </button>
          </div>
        </div>
      )}

      {/* 4K Executive Hero Control Room */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <FileText size={14} />
                DEVIS & FACTURES PROFORMA 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                {stats.countTotal} {locale === "ar" ? "عرض سعر مسجل" : "Devis émis"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "عروض الأسعار والفواتير الشكلية (Devis & Proforma)" : "Gestion des Devis & Factures Proforma"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "إعداد عروض الأسعار التجارية الرسمية، متابعة حالة القبول، والتحويل إلى فواتير مبيعات بنقرة واحدة"
                : "Établissement d'offres commerciales, suivi de validité et conversion en factures réelles"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={exportToCSV}
              disabled={filteredDevis.length === 0}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-40"
              title={locale === "ar" ? "تصدير CSV" : "Exporter CSV"}
            >
              <Download size={15} />
              <span>{locale === "ar" ? "تصدير CSV" : "Exporter CSV"}</span>
            </button>

            <button
              onClick={fetchDevis}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title={locale === "ar" ? "تحديث" : "Actualiser"}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{locale === "ar" ? "إنشاء عرض سعر جديد" : "Nouveau Devis"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "حجم العروض الإجمالي" : "Volume Total Chiffré"}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {formatCurrencyAmount(stats.totalVolume, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "إجمالي قيمة العروض الصادرة" : "Montant cumulé des propositions"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "عروض قيد الدراسة" : "En Attente de Décision"}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">
            {stats.countEnAttente}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "عروض تنتظر موافقة العميل" : "Devis en cours de négociation"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "عروض تحولت لمبيعات" : "Convertis en Ventes"}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {stats.countConvertis}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "فواتير بيع حقيقية مكتملة" : "Commandes fermes facturées"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "معدل التحويل التجاري" : "Taux de Conversion"}
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Percent size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 font-mono">
            {stats.conversionRate.toFixed(1)}%
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "نسبة نجاح إتمام الصفقات" : "Efficacité commerciale globale"}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث برقم العرض أو اسم العميل..." : "Recherche réf. devis ou client..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs">
          <Filter size={14} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="all">{locale === "ar" ? "جميع الحالات" : "Tous les statuts"}</option>
            <option value="En attente">{locale === "ar" ? "قيد الانتظار" : "En attente"}</option>
            <option value="Accepté">{locale === "ar" ? "مقبول" : "Accepté"}</option>
            <option value="Converti">{locale === "ar" ? "متحول لفاتورة" : "Converti"}</option>
            <option value="Refusé">{locale === "ar" ? "مرفوض" : "Refusé"}</option>
          </select>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs">
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">{locale === "ar" ? "رقم العرض" : "Réf. Devis"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "العميل" : "Client"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "تاريخ الإصدار" : "Émission"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "الصلاحية" : "Validité"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "المبلغ الإجمالي" : "Montant TTC"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "الحالة" : "Statut"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-3 text-indigo-600" size={36} />
                      <p className="font-bold text-slate-600 text-xs">
                        {locale === "ar" ? "جاري تحميل عروض الأسعار..." : "Chargement des devis..."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredDevis.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FileText className="opacity-20 mb-3 text-indigo-600" size={48} />
                      <p className="font-black text-slate-700 text-sm">
                        {locale === "ar" ? "لا توجد عروض أسعار مسجلة مطابقة للبحث." : "Aucun devis enregistré."}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {locale === "ar" ? "اضغط على زر إنشاء عرض سعر جديد لبدء أول عرض." : "Créez votre premier devis en cliquant sur Nouveau Devis."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDevis.map((devis) => (
                  <tr key={devis.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="px-6 py-4 font-black text-slate-900 font-mono">
                      {devis.numero_devis}
                    </td>
                    <td className="px-6 py-4 text-slate-900 font-bold">
                      {devis.client_nom}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {devis.date_devis}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium">
                      {devis.date_validite || "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-900 font-mono">
                      {formatCurrencyAmount(devis.total_ttc, "FCFA")}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(devis.statut)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Direct WhatsApp Quote Share */}
                        {devis.client_tel && (
                          <button
                            onClick={() => {
                              const msg = generateDevisWhatsAppMessage({
                                companyName: "GESTION PRO GLOBAL",
                                devisNumber: devis.numero_devis,
                                clientName: devis.client_nom,
                                dateDevis: devis.date_devis,
                                dateValidite: devis.date_validite,
                                totalTTC: Number(devis.total_ttc) || 0,
                                currency: "FCFA",
                                locale: locale as any,
                              });
                              openWhatsAppDirect(devis.client_tel, msg);
                            }}
                            title={locale === "ar" ? "إرسال عرض السعر عبر واتساب" : "Envoyer devis par WhatsApp"}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer font-bold"
                          >
                            <MessageSquare size={16} />
                          </button>
                        )}

                        {/* 1-Click Convert to Invoice (If not yet converted) */}
                        {devis.statut !== "Converti" && (
                          <button
                            onClick={() => handleConvert(devis.id)}
                            title={locale === "ar" ? "تحويل فوري إلى فاتورة مبيعات" : "Convertir en Facture (1-Clic)"}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer font-bold"
                          >
                            <Sparkles size={16} />
                          </button>
                        )}

                        {/* View & Print A4 Modal */}
                        <button
                          onClick={() => setSelectedDevisId(devis.id)}
                          title={locale === "ar" ? "معاينة وطباعة A4" : "Aperçu / Imprimer A4"}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Eye size={16} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(devis.id)}
                          title={locale === "ar" ? "حذف" : "Supprimer"}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View / Print Devis Modal */}
      {selectedDevisId && (
        <DevisModal
          devisId={selectedDevisId}
          onClose={() => setSelectedDevisId(null)}
          onConverted={fetchDevis}
        />
      )}

      {/* New Devis Modal */}
      {isNewModalOpen && (
        <NewDevisModal
          onClose={() => setIsNewModalOpen(false)}
          onSaved={fetchDevis}
        />
      )}

      {/* SQL Migration Script Viewer Modal */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="text-indigo-600" size={20} />
                <h3 className="font-black text-slate-900 text-sm">
                  {locale === "ar" ? "سكربت إنشاء جداول عروض الأسعار (SQL Migration)" : "Script de Migration SQL (Devis)"}
                </h3>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {locale === "ar"
                ? "انسخ هذا الكود والصقه في محرّر SQL في Supabase ثم اضغط Run لإنشاء الجداول اللازمة فوراً."
                : "Copiez ce code et collez-le dans l'éditeur SQL de Supabase pour créer les tables devis et devis_items."}
            </p>
            <div className="flex-1 overflow-auto bg-slate-950 text-slate-200 p-4 rounded-2xl font-mono text-[11px] leading-relaxed select-all">
              <pre>{SQL_MIGRATION_SCRIPT}</pre>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleCopySql}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                {sqlCopied ? <Check size={14} /> : <Copy size={14} />}
                <span>{sqlCopied ? (locale === "ar" ? "تم النسخ!" : "Copié !") : (locale === "ar" ? "نسخ الكود بالكامل" : "Copier le code")}</span>
              </button>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
              >
                {locale === "ar" ? "إغلاق" : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
