"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { formatDateTime } from "@/lib/utils/datetime";
import {
  Wallet,
  TrendingUp,
  AlertTriangle,
  FileText,
  DollarSign,
  PieChart as PieChartIcon,
  Calendar,
  Search,
  Printer,
  Download,
  Share2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowUpRight,
  TrendingDown,
  MessageSquare,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import WhatsAppShareModal from "@/components/WhatsAppShareModal";

const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

export default function FinanceCenterPage() {
  const { t, locale, dir } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState("mois");
  
  // WhatsApp Share state
  const [selectedWhatsAppInvoice, setSelectedWhatsAppInvoice] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance?period=${dateRange}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load finance data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const summary = data?.summary || {
    totalAttendu: 0,
    totalEncaisse: 0,
    totalImpaye: 0,
    soldeActuel: 0,
    tauxRecouvrement: 100,
    nombrePaiements: 0,
    clientsPayes: 0,
    clientsImpayes: 0,
    revenusAujourdhui: 0,
    revenusCetteSemaine: 0,
    revenusCeMois: 0,
    revenusCetteAnnee: 0,
    totalDepenses: 0,
  };

  const evolutionChart = data?.charts?.evolution || [];
  const modesChart = data?.charts?.modesPaiement || [];
  const rows = data?.rows || [];

  const filteredRows = rows.filter((r: any) => {
    const matchesQuery =
      r.reference?.toLowerCase().includes(query.toLowerCase()) ||
      r.client?.toLowerCase().includes(query.toLowerCase()) ||
      r.emplacement?.toLowerCase().includes(query.toLowerCase()) ||
      r.vendeur?.toLowerCase().includes(query.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "payee" && r.statut === "Payée") ||
      (statusFilter === "partielle" && r.statut === "Partielle") ||
      (statusFilter === "impayee" && r.statut === "Non Payée");

    return matchesQuery && matchesStatus;
  });

  const exportCSV = () => {
    if (!rows.length) return;
    const headers = ["Numero", "Date", "Client", "Depot", "Vendeur", "Mode", "Total TTC", "Paye", "Reste", "Statut"];
    const csvRows = rows.map((r: any) => [
      `"${r.reference}"`,
      `"${r.date}"`,
      `"${r.client}"`,
      `"${r.emplacement}"`,
      `"${r.vendeur}"`,
      `"${r.modePaiement}"`,
      r.totalTTC,
      r.montantPaye,
      r.reste,
      `"${r.statut}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...csvRows.map((e: any) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rapport_financier_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* WhatsApp Share Modal */}
      {selectedWhatsAppInvoice && (
        <WhatsAppShareModal
          details={{
            companyName: "GESTION PRO GLOBAL",
            invoiceNumber: selectedWhatsAppInvoice.reference,
            clientName: selectedWhatsAppInvoice.client,
            totalTTC: selectedWhatsAppInvoice.totalTTC,
            montantPaye: selectedWhatsAppInvoice.montantPaye,
            resteAPayer: selectedWhatsAppInvoice.reste,
            currency: "FCFA",
            invoiceUrl: `https://gestion-pro-global-tege.vercel.app/invoice/${selectedWhatsAppInvoice.id}`,
            locale,
          }}
          initialPhone={selectedWhatsAppInvoice.clientTel}
          onClose={() => setSelectedWhatsAppInvoice(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider">
              FINANCE & TRÉSORERIE
            </span>
            <span className="text-xs font-bold text-slate-500">
              {locale === "ar" ? "مركز التقارير والتدقيق المالي الشامل" : "Centre d'Analyse & Reporting Financier"}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Wallet className="text-indigo-600" size={32} />
            {locale === "ar" ? "الإدارة والتقارير المالية" : "Gestion Financière"}
          </h1>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
          </button>

          <button
            onClick={exportCSV}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-black transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Download size={14} className="text-indigo-600" />
            <span>Excel / CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Printer size={14} />
            <span>{locale === "ar" ? "طباعة التقرير" : "Imprimer"}</span>
          </button>
        </div>
      </div>

      {/* Row 1: Core Commercial KPIs (4 Main Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Attendu (CA) */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي المبيعات (المتوقع)" : "Total Facturé (CA)"}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <FileText size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 truncate">
            {formatCurrencyAmount(summary.totalAttendu, "FCFA", locale)}
          </div>
          <div className="text-xs text-indigo-600 font-bold mt-1.5 flex items-center gap-1">
            <TrendingUp size={13} />
            <span>{summary.nombrePaiements} {locale === "ar" ? "معاملة تجارية" : "factures émises"}</span>
          </div>
        </div>

        {/* Total Encaissé */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "المحصل الفعلي (السيولة)" : "Total Encaissé"}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 truncate">
            {formatCurrencyAmount(summary.totalEncaisse, "FCFA", locale)}
          </div>
          <div className="text-xs text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
            <CheckCircle2 size={13} />
            <span>{summary.tauxRecouvrement}% {locale === "ar" ? "نسبة التحصيل" : "recouvert"}</span>
          </div>
        </div>

        {/* Total Impayé (Créances) */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الديون والمستحقات" : "Créances Clients"}
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 truncate">
            {formatCurrencyAmount(summary.totalImpaye, "FCFA", locale)}
          </div>
          <div className="text-xs text-amber-600 font-bold mt-1.5">
            {summary.clientsImpayes} {locale === "ar" ? "عملاء مدينين" : "clients avec solde dû"}
          </div>
        </div>

        {/* Solde Net de Trésorerie */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-indigo-300 tracking-wider">
              {locale === "ar" ? "صافي السيولة النقدية" : "Solde Net Trésorerie"}
            </span>
            <div className="p-2 rounded-xl bg-white/10 text-emerald-400">
              <Wallet size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 truncate">
            {formatCurrencyAmount(summary.soldeActuel, "FCFA", locale)}
          </div>
          <div className="text-xs text-slate-300 font-bold mt-1.5">
            Dépenses déduites ({formatCurrencyAmount(summary.totalDepenses, "FCFA", locale)})
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Metric Badges (Aujourd'hui, Semaine, Mois, Année) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-extrabold text-slate-400 uppercase">
            {locale === "ar" ? "مبيعات اليوم" : "Revenus Aujourd'hui"}
          </div>
          <div className="text-lg font-black text-slate-900 mt-1">
            {formatCurrencyAmount(summary.revenusAujourdhui, "FCFA", locale)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-extrabold text-slate-400 uppercase">
            {locale === "ar" ? "مبيعات هذا الأسبوع" : "Revenus Cette Semaine"}
          </div>
          <div className="text-lg font-black text-slate-900 mt-1">
            {formatCurrencyAmount(summary.revenusCetteSemaine, "FCFA", locale)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-extrabold text-slate-400 uppercase">
            {locale === "ar" ? "مبيعات هذا الشهر" : "Revenus Ce Mois"}
          </div>
          <div className="text-lg font-black text-indigo-600 mt-1">
            {formatCurrencyAmount(summary.revenusCeMois, "FCFA", locale)}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-extrabold text-slate-400 uppercase">
            {locale === "ar" ? "مبيعات هذا العام" : "Revenus Cette Année"}
          </div>
          <div className="text-lg font-black text-emerald-600 mt-1">
            {formatCurrencyAmount(summary.revenusCetteAnnee, "FCFA", locale)}
          </div>
        </div>
      </div>

      {/* Row 3: Interactive Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <TrendingUp size={20} className="text-indigo-600" />
                {locale === "ar" ? "منحنى تطور الإيرادات والمصروفات" : "Évolution des Flux Financiers"}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {locale === "ar" ? "مقارنة السيولة المحصلة مع النفقات" : "Encaissements vs Dépenses par période"}
              </p>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionChart}>
                <defs>
                  <linearGradient id="encaisseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="depenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "16px",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: "bold",
                  }}
                />
                <Area type="monotone" dataKey="encaisse" name="Encaissé" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#encaisseGrad)" />
                <Area type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#depenseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Modes of Payment Breakdown */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 mb-1">
              <CreditCard size={20} className="text-indigo-600" />
              {locale === "ar" ? "وسائل وطرق السداد" : "Modes de Paiement"}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {locale === "ar" ? "توزيع المقبوضات حسب وسيلة الدفع" : "Répartition des règlements"}
            </p>
          </div>

          <div className="h-[200px] w-full relative flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modesChart}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {modesChart.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="space-y-1.5 text-xs font-bold">
            {modesChart.map((m: any, idx: number) => (
              <div key={m.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-slate-700">{m.name}</span>
                </div>
                <span className="font-extrabold text-slate-900">{formatCurrencyAmount(m.value, "FCFA", locale)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Commercial Invoices & Transactions Table */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900">
              {locale === "ar" ? "سجل المعاملات والتحصيلات التجارية" : "Détail des Transactions & Encaissements"}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {locale === "ar" ? "متابعة الفواتير، المبالغ المسددة والمتبقية مع المشاركة عبر واتساب" : "Historique complet des factures et règlements"}
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={locale === "ar" ? "بحث برقم الفاتورة، العميل..." : "Recherche (Facture, Client...)"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">{locale === "ar" ? "كل الحالات" : "Tous les statuts"}</option>
              <option value="payee">{locale === "ar" ? "مدفوعة بالكامل" : "Payée"}</option>
              <option value="partielle">{locale === "ar" ? "مدفوعة جزئياً" : "Partielle"}</option>
              <option value="impayee">{locale === "ar" ? "غير مدفوعة" : "Non Payée"}</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">{locale === "ar" ? "رقم الفاتورة" : "Réf Facture"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "التاريخ" : "Date"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "العميل" : "Client"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "المستودع / الفرع" : "Dépôt / Magasin"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "وسيلة الدفع" : "Mode"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "الإجمالي TTC" : "Total TTC"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "المسدد" : "Payé"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "المتبقي" : "Reste"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "الحالة" : "Statut"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "ar" ? "مشاركة" : "Action"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    {locale === "ar" ? "لا توجد معاملات مطابقة للبحث." : "Aucune transaction trouvée."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-indigo-600">
                      {r.reference}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                      {formatDateTime(r.date, locale)}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">
                      {r.client}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {r.emplacement}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                        {r.modePaiement}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">
                      {formatCurrencyAmount(r.totalTTC, "FCFA", locale)}
                    </td>
                    <td className="py-3.5 px-4 font-black text-emerald-600">
                      {formatCurrencyAmount(r.montantPaye, "FCFA", locale)}
                    </td>
                    <td className="py-3.5 px-4 font-black text-amber-600">
                      {formatCurrencyAmount(r.reste, "FCFA", locale)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                          r.statut === "Payée"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.statut === "Partielle"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.statut}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedWhatsAppInvoice(r)}
                        className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold shadow-xs"
                        title="Partager sur WhatsApp"
                      >
                        <MessageSquare size={14} />
                        <span>WhatsApp</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
