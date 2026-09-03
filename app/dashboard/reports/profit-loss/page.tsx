"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  DollarSign,
  Printer,
  RefreshCw,
  Sparkles,
  PieChart as PieChartIcon,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  BarChart3,
  Loader2
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";

export default function ProfitLossPage() {
  const { locale, dir } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Default to current month
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(today);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append("start", startDate);
      if (endDate) params.append("end", endDate);

      const res = await fetch(`/api/reports/profit-loss?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load profit & loss report", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const summary = data?.summary || {
    chiffreAffairesHT: 0,
    coutMarchandisesVendues: 0,
    margeBrute: 0,
    tauxMargeBrute: 0,
    totalDepenses: 0,
    resultatNet: 0,
    tauxMargeNette: 0,
    isBenefice: true,
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* 4K Executive Hero Control Room (Hidden on Print) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <BarChart3 size={14} />
                COMPTE DE RÉSULTAT & RENTABILITÉ 4K
              </span>
              <span className={`text-xs font-bold flex items-center gap-1 px-3 py-1 rounded-xl border ${
                summary.isBenefice
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-950/60 text-rose-400 border-rose-500/30"
              }`}>
                {summary.isBenefice ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {summary.isBenefice
                  ? `${locale === "ar" ? "صافي ربح:" : "Bénéfice Net :"} +${formatCurrencyAmount(summary.resultatNet, "FCFA")}`
                  : `${locale === "ar" ? "عجز / خسارة:" : "Déficit Net :"} ${formatCurrencyAmount(summary.resultatNet, "FCFA")}`}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "تقرير الأرباح والخسائر والربحية الشاملة (P&L)" : "Rapport des Pertes & Profits (P&L)"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "حساب دقيق لهامش الربح التجاري، تكلفة المبيعات، وتأثير المصروفات على صافي الدخل"
                : "Analyse approfondie du chiffre d'affaires, marge brute, charges d'exploitation et résultat net"}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchReport}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title={locale === "ar" ? "تحديث" : "Actualiser"}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={loading}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer size={16} />
              <span>{locale === "ar" ? "طباعة التقرير الرسمي A4" : "Imprimer Compte de Résultat"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Toolbar (Hidden on Print) */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs">
            <Calendar size={15} className="text-slate-500" />
            <span className="font-bold text-slate-700">{locale === "ar" ? "الفترة المالية:" : "Période Fiscale :"}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-900 outline-none"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-xs font-bold text-slate-900 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setStartDate(firstDayOfMonth);
                setEndDate(today);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              {locale === "ar" ? "هذا الشهر" : "Ce mois"}
            </button>
            <button
              onClick={() => {
                const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
                setStartDate(yearStart);
                setEndDate(today);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              {locale === "ar" ? "هذه السنة" : "Cette année"}
            </button>
          </div>
        </div>

        <div className="text-xs font-bold text-slate-500">
          {summary.nombreFactures} {locale === "ar" ? "فاتورة مبيعات محللة" : "factures analysées"}
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 1. Revenue */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إيرادات المبيعات (HT)" : "Chiffre d'Affaires HT"}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {formatCurrencyAmount(summary.chiffreAffairesHT, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            TTC: {formatCurrencyAmount(summary.chiffreAffairesTTC, "FCFA")}
          </p>
        </div>

        {/* 2. COGS */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "تكلفة البضاعة المباعة" : "Coût d'Achat (COGS)"}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Package size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700 font-mono">
            {formatCurrencyAmount(summary.coutMarchandisesVendues, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "تكلفة شراء المنتجات المسحوبة" : "Coût d'acquisition des stocks vendus"}
          </p>
        </div>

        {/* 3. Gross Profit */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الربح التجاري" : "Marge Brute"}
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-700 font-mono">
            {formatCurrencyAmount(summary.margeBrute, "FCFA")}
          </div>
          <p className="text-[11px] font-bold text-blue-600">
            {locale === "ar" ? "هامش الربح:" : "Taux de marge :"} {summary.tauxMargeBrute}%
          </p>
        </div>

        {/* 4. Net Result */}
        <div className={`rounded-3xl p-6 shadow-xs border space-y-2 ${
          summary.isBenefice ? "bg-emerald-50/50 border-emerald-200" : "bg-rose-50/50 border-rose-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {locale === "ar" ? "صافي النتيجة التشغيلية" : "Résultat Net d'Exploitation"}
            </span>
            <div className={`p-2.5 rounded-xl ${summary.isBenefice ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {summary.isBenefice ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
            </div>
          </div>
          <div className={`text-2xl font-black font-mono ${summary.isBenefice ? "text-emerald-700" : "text-rose-700"}`}>
            {summary.isBenefice ? "+" : ""}{formatCurrencyAmount(summary.resultatNet, "FCFA")}
          </div>
          <p className="text-[11px] font-bold text-slate-600">
            {summary.isBenefice
              ? `${locale === "ar" ? "ربح صافي بنسبة:" : "Marge nette de :"} ${summary.tauxMargeNette}%`
              : `${locale === "ar" ? "عجز مسجل بعد المصروفات" : "Déficit enregistré"}`}
          </p>
        </div>
      </div>

      {/* Breakdown Grid: Top Products & Operating Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Top Profitable Products */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Sparkles size={16} />
              </div>
              <h3 className="text-sm font-black text-slate-900">
                {locale === "ar" ? "أعلى المنتجات تحقيقاً للأرباح" : "Top 10 des Articles les Plus Rentables"}
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {locale === "ar" ? "مرتبة حسب هامش الربح" : "Classé par marge"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                  <th className="px-3 py-2.5">{locale === "ar" ? "الصنف" : "Article"}</th>
                  <th className="px-3 py-2.5 text-center">{locale === "ar" ? "الكمية" : "Qté"}</th>
                  <th className="px-3 py-2.5 text-right">{locale === "ar" ? "المبيعات" : "CA HT"}</th>
                  <th className="px-3 py-2.5 text-right">{locale === "ar" ? "الربح المحقق" : "Marge"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      <span className="font-bold">{locale === "ar" ? "جاري التحليل..." : "Calcul de la rentabilité..."}</span>
                    </td>
                  </tr>
                ) : (data?.topProducts || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                      {locale === "ar" ? "لا توجد مبيعات في هذه الفترة." : "Aucune vente sur cette période."}
                    </td>
                  </tr>
                ) : (
                  (data?.topProducts || []).map((prod: any, i: number) => (
                    <tr key={prod.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5">
                        <span className="font-black text-slate-900 block truncate max-w-[200px]">
                          {prod.designation}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{prod.reference}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700">
                        {prod.quantiteVendue}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                        {formatCurrencyAmount(prod.chiffreAffairesHT, "FCFA")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-600">
                        +{formatCurrencyAmount(prod.margeBrute, "FCFA")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Operating Expenses Breakdown */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <TrendingDown size={16} />
              </div>
              <h3 className="text-sm font-black text-slate-900">
                {locale === "ar" ? "المصروفات التشغيلية" : "Charges & Dépenses d'Exploitation"}
              </h3>
            </div>
            <span className="text-xs font-black text-rose-600 font-mono">
              -{formatCurrencyAmount(summary.totalDepenses, "FCFA")}
            </span>
          </div>

          <div className="space-y-3">
            {(data?.expensesList || []).length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-slate-400">
                {locale === "ar" ? "لم تسجل أي مصروفات خلال هذه الفترة." : "Aucune dépense enregistrée sur cette période."}
              </p>
            ) : (
              (data?.expensesList || []).map((exp: any, idx: number) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{exp.category}</span>
                    <span className="font-mono font-black text-slate-900">
                      {formatCurrencyAmount(exp.amount, "FCFA")} ({exp.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, exp.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* OFFICIAL PRINTABLE A4 COMPTE DE RÉSULTAT (VISIBLE ON PRINT) */}
      {/* ============================================================ */}
      <div className="hidden print:block text-slate-900 p-8 space-y-6 bg-white font-sans text-xs leading-relaxed">
        {/* Print Header */}
        <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider">{data?.company?.nom_entreprise || "GESTION PRO GLOBAL"}</h1>
            <p className="text-slate-600 font-medium">{data?.company?.adresse || "Niamey, Niger"}</p>
            <p className="text-slate-500">Tél: {data?.company?.telephone || "+227 00 00 00 00"}</p>
            {data?.company?.nif && <p className="text-slate-500">NIF: {data?.company?.nif} • RC: {data?.company?.rc || "N/A"}</p>}
          </div>

          <div className="text-right">
            <div className="px-4 py-1.5 bg-slate-900 text-white rounded font-black text-xs uppercase tracking-widest inline-block mb-1">
              COMPTE DE RÉSULTAT (P&L)
            </div>
            <p className="font-bold">Exercice du {new Date(startDate).toLocaleDateString("fr-FR")} au {new Date(endDate).toLocaleDateString("fr-FR")}</p>
            <p className="text-[10px] text-slate-500">Édité le: {new Date().toLocaleDateString("fr-FR")}</p>
          </div>
        </div>

        {/* Financial P&L Statement Structure */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-black text-[11px] uppercase">
                <th className="px-4 py-3">Rubriques Comptables</th>
                <th className="px-4 py-3 text-right">Montant (FCFA)</th>
                <th className="px-4 py-3 text-right">% sur CA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="font-bold">
                <td className="px-4 py-2.5">I. Chiffre d'Affaires Net Hors Taxes (Ventes)</td>
                <td className="px-4 py-2.5 text-right font-mono font-black">{formatCurrencyAmount(summary.chiffreAffairesHT, "FCFA")}</td>
                <td className="px-4 py-2.5 text-right font-mono">100.0%</td>
              </tr>
              <tr className="text-slate-600">
                <td className="px-4 py-2.5 pl-8">(-) Coût des Marchandises Vendues (Achats & Stocks)</td>
                <td className="px-4 py-2.5 text-right font-mono">-{formatCurrencyAmount(summary.coutMarchandisesVendues, "FCFA")}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {summary.chiffreAffairesHT > 0 ? ((summary.coutMarchandisesVendues / summary.chiffreAffairesHT) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>
              <tr className="bg-blue-50/50 font-black text-blue-900 border-t border-b border-blue-200">
                <td className="px-4 py-3">= MARGE BRUTE COMMERCIALE</td>
                <td className="px-4 py-3 text-right font-mono">{formatCurrencyAmount(summary.margeBrute, "FCFA")}</td>
                <td className="px-4 py-3 text-right font-mono">{summary.tauxMargeBrute}%</td>
              </tr>
              <tr className="text-slate-600">
                <td className="px-4 py-2.5 pl-8">(-) Charges d'Exploitation & Dépenses Générales</td>
                <td className="px-4 py-2.5 text-right font-mono">-{formatCurrencyAmount(summary.totalDepenses, "FCFA")}</td>
                <td className="px-4 py-2.5 text-right font-mono">
                  {summary.chiffreAffairesHT > 0 ? ((summary.totalDepenses / summary.chiffreAffairesHT) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>
              <tr className={`font-black text-sm border-t-2 border-slate-900 ${summary.isBenefice ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
                <td className="px-4 py-3.5">= RÉSULTAT NET D'EXPLOITATION ({summary.isBenefice ? "BÉNÉFICE" : "DÉFICIT"})</td>
                <td className="px-4 py-3.5 text-right font-mono">{summary.isBenefice ? "+" : ""}{formatCurrencyAmount(summary.resultatNet, "FCFA")}</td>
                <td className="px-4 py-3.5 text-right font-mono">{summary.tauxMargeNette}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Audit Signatures */}
        <div className="pt-12 grid grid-cols-2 gap-12 text-center">
          <div>
            <p className="font-black mb-16 uppercase text-slate-700">Le Responsable Financier / Comptable</p>
            <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">Signature & Visa</div>
          </div>
          <div>
            <p className="font-black mb-16 uppercase text-slate-700">La Direction Générale</p>
            <div className="border-t border-slate-400 pt-1 text-[10px] text-slate-500">Cachet & Signature</div>
          </div>
        </div>

        <div className="text-center pt-6 text-[8px] text-slate-400">
          Document financier généré par Gestion Pro Global v2.0 • Système Intégré de Gestion ERP
        </div>
      </div>
    </div>
  );
}
