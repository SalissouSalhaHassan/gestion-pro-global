"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Database,
  FileSpreadsheet,
  ShieldCheck,
  Calendar,
  Layers,
  FileText,
  Users,
  ShoppingCart,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  HardDrive,
  RefreshCw,
  Loader2,
  FileCheck,
  Server,
  Building2
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

export default function DataHubPage() {
  const { locale, dir } = useLanguage();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");

  useEffect(() => {
    try {
      const match = document.cookie.match(/gp_session=([^;]+)/);
      if (match) {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        if (parsed.organization_name) {
          setOrgName(parsed.organization_name);
        }
      }
    } catch (e) {}
  }, []);

  // Filter dates
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleExport = (type: string, format = "csv") => {
    setDownloading(type);
    const params = new URLSearchParams();
    params.append("type", type);
    params.append("format", format);
    if (startDate) params.append("start", startDate);
    if (endDate) params.append("end", endDate);

    // Trigger direct file download
    window.location.href = `/api/data-hub/export?${params.toString()}`;

    setTimeout(() => {
      setDownloading(null);
    }, 2000);
  };

  const setPreset = (preset: "all" | "month" | "year") => {
    const now = new Date();
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === "year") {
      const firstDay = `${now.getFullYear()}-01-01`;
      const lastDay = `${now.getFullYear()}-12-31`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* 4K Executive Hero Control Room */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Database size={14} />
                DATA HUB & EXPORT EXCEL 4K
              </span>
              {orgName && (
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 bg-indigo-950/80 px-3 py-1 rounded-xl border border-indigo-500/30">
                  <Building2 size={13} className="text-indigo-400" />
                  {orgName} (Export Isolé)
                </span>
              )}
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <ShieldCheck size={13} className="text-emerald-400" />
                {locale === "ar" ? "تصدير متوافق مع معايير Excel & UTF-8" : "Encodage UTF-8 universel"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "مركز التصدير الشامل والنسخ الاحتياطي (Data Hub)" : "Centre d'Export & Sauvegarde Séquentielle"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "استخراج تقارير إكسل المحاسبية الرسمية بنقرة واحدة، وتنزيل نسخة احتياطية سحابية كاملة لمؤسستك"
                : "Téléchargement certifié des grands livres pour expert-comptable et snapshots de sécurité"}
            </p>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setPreset("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !startDate ? "bg-white text-slate-950 shadow-md" : "text-slate-300 hover:text-white"
              }`}
            >
              {locale === "ar" ? "كل الأرشيف" : "Tout"}
            </button>
            <button
              onClick={() => setPreset("month")}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              {locale === "ar" ? "هذا الشهر" : "Ce mois"}
            </button>
            <button
              onClick={() => setPreset("year")}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              {locale === "ar" ? "هذه السنة" : "Cette année"}
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-indigo-600" />
          <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
            {locale === "ar" ? "نطاق التصدير الزمني :" : "Période d'extraction :"}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs">
            <span className="text-slate-400 font-bold">{locale === "ar" ? "من :" : "Du :"}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none"
            />
            <span className="text-slate-400 font-bold">{locale === "ar" ? "إلى :" : "Au :"}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-800 outline-none"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
            >
              {locale === "ar" ? "إعادة ضبط" : "Réinitialiser"}
            </button>
          )}
        </div>
      </div>

      {/* 5 Export Domain Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Factures & Ventes */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 w-fit rounded-2xl bg-indigo-50 text-indigo-600">
              <FileText size={22} />
            </div>
            <h3 className="text-base font-black text-slate-900">
              {locale === "ar" ? "سجل فواتير المبيعات (Ventes)" : "Journal des Ventes & Factures"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {locale === "ar"
                ? "يشمل أرقام الفواتير، أسماء العملاء، مبالغ HT و TVA و TTC، المبالغ المحصلة، والديون المتبقية."
                : "Extraction détaillée avec référence BL, client, CA HT, TVA, TTC, règlements et soldes dus."}
            </p>
          </div>

          <button
            onClick={() => handleExport("invoices")}
            disabled={downloading === "invoices"}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-indigo-600 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {downloading === "invoices" ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>{locale === "ar" ? "تنزيل ملف إكسل (CSV)" : "Télécharger Excel / CSV"}</span>
          </button>
        </div>

        {/* 2. Articles & Stocks */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 w-fit rounded-2xl bg-emerald-50 text-emerald-600">
              <Layers size={22} />
            </div>
            <h3 className="text-base font-black text-slate-900">
              {locale === "ar" ? "كتالوج الأصناف وتقييم المخزون" : "Catalogue & Valorisation du Stock"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {locale === "ar"
                ? "يشمل أسماء الأصناف، الباركود، سعر الشراء، سعر التجزئة، سعر الجملة، الكميات الحالية، وقيمة المخزون الإجمالية."
                : "Tous les articles, codes-barres, prix de gros, prix de détail, niveaux de stock et valorisation d'achat."}
            </p>
          </div>

          <button
            onClick={() => handleExport("articles")}
            disabled={downloading === "articles"}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-emerald-600 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {downloading === "articles" ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>{locale === "ar" ? "تنزيل ملف إكسل (CSV)" : "Télécharger Excel / CSV"}</span>
          </button>
        </div>

        {/* 3. Clients & Créances */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 w-fit rounded-2xl bg-blue-50 text-blue-600">
              <Users size={22} />
            </div>
            <h3 className="text-base font-black text-slate-900">
              {locale === "ar" ? "سجل العملاء ودفتر الديون (Clients)" : "Fichier Clients & Solde Créances"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {locale === "ar"
                ? "يشمل كافة العملاء، الهواتف، الفئة السعرية (تجزئة/جملة)، ديون الفواتير، ديون السندات، وإجمالي الرصيد المستحق."
                : "Liste nominative des clients, coordonnées, catégorie tarifaire et solde débiteur en cours."}
            </p>
          </div>

          <button
            onClick={() => handleExport("clients")}
            disabled={downloading === "clients"}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-blue-600 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {downloading === "clients" ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>{locale === "ar" ? "تنزيل ملف إكسل (CSV)" : "Télécharger Excel / CSV"}</span>
          </button>
        </div>

        {/* 4. Achats & Fournisseurs */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 w-fit rounded-2xl bg-purple-50 text-purple-600">
              <ShoppingCart size={22} />
            </div>
            <h3 className="text-base font-black text-slate-900">
              {locale === "ar" ? "سجل المشتريات والموردين (Achats)" : "Achats & Dettes Fournisseurs"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {locale === "ar"
                ? "يشمل فواتير الشراء، أسماء الموردين، المبالغ الإجمالية، المبالغ المسددة، والديون المتبقية للموردين."
                : "Registre des factures d'achat, décaissements effectués et arriérés dus aux fournisseurs."}
            </p>
          </div>

          <button
            onClick={() => handleExport("purchases")}
            disabled={downloading === "purchases"}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-purple-600 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {downloading === "purchases" ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>{locale === "ar" ? "تنزيل ملف إكسل (CSV)" : "Télécharger Excel / CSV"}</span>
          </button>
        </div>

        {/* 5. Dépenses d'Exploitation */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="p-3 w-fit rounded-2xl bg-rose-50 text-rose-600">
              <TrendingDown size={22} />
            </div>
            <h3 className="text-base font-black text-slate-900">
              {locale === "ar" ? "سجل المصروفات التشغيلية (Dépenses)" : "Journal des Dépenses d'Exploitation"}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {locale === "ar"
                ? "يشمل التواريخ، التصنيفات (رواتب، إيجار، نقل، كهرباء...)، المبالغ المصروفة، المستفيد، والسبب."
                : "Enregistrement complet des frais généraux, salaires, loyers, avec ventilation par catégorie."}
            </p>
          </div>

          <button
            onClick={() => handleExport("expenses")}
            disabled={downloading === "expenses"}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-rose-600 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
          >
            {downloading === "expenses" ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            <span>{locale === "ar" ? "تنزيل ملف إكسل (CSV)" : "Télécharger Excel / CSV"}</span>
          </button>
        </div>
      </div>

      {/* 🛡️ Full Disaster Recovery & Cloud Database Snapshot Section */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 rounded-[32px] p-6 lg:p-8 text-white border border-indigo-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute -bottom-10 -right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <HardDrive size={18} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                {locale === "ar" ? "النسخ الاحتياطي السحابي الشامل (Disaster Recovery)" : "Sauvegarde Intégrale de Sécurité (Cloud Snapshot)"}
              </span>
            </div>

            <h2 className="text-xl lg:text-2xl font-black text-white">
              {locale === "ar" ? "أخذ نسخة احتياطية فورية لقاعدة بيانات المؤسسة" : "Créer un Snapshot Complet de la Base de Données"}
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              {locale === "ar"
                ? "يقوم هذا الأمر بتجميع وحفظ كافة بيانات شركتك (المنتجات، الفواتير، العملاء، الموردين، المخزون، والمصروفات) في ملف أرشيف منظم (JSON) يحتوي على بصمة رقمية وتاريخ التصدير. يمكنك حفظه في قرص خارجي أو سحابتك الخاصة لحماية بياناتك من أي طارئ."
                : "Génération instantanée d'une archive structurée (JSON) contenant l'ensemble de vos tables : articles, factures, clients, stocks, achats et dépenses avec empreinte de sécurité."}
            </p>
          </div>

          <button
            onClick={() => handleExport("full_snapshot", "json")}
            disabled={downloading === "full_snapshot"}
            className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {downloading === "full_snapshot" ? <Loader2 size={18} className="animate-spin" /> : <Server size={18} />}
            <span>{locale === "ar" ? "توليد وتنزيل النسخة الاحتياطية الآن" : "Générer la Sauvegarde Complète (JSON)"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
