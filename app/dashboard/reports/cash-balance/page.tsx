"use client";

import { useState, useEffect } from "react";
import { 
  Scale, 
  Calendar, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Loader2, 
  FileText, 
  User, 
  MapPin, 
  Printer, 
  Info,
  Sparkles,
  RefreshCw,
  CreditCard,
  Banknote,
  Receipt,
  Lock
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import CashBalanceModal from "./CashBalanceModal";
import CashClosureModal from "./CashClosureModal";


export default function CashBalancePage() {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<{
    summary: { 
      totalIncome: number; 
      totalExpenses: number; 
      totalUnpaid?: number; 
      netBalance: number;
      reconciliation?: {
        totalInvoiced: number;
        totalUnpaidPeriod: number;
        totalPaidInvoicesPeriod: number;
        totalPaidOlderInvoicesPeriod: number;
        totalAdvancesPeriod: number;
        totalCementPeriod: number;
      }
    };
    entries: any[];
    scoping?: {
      isAdmin: boolean;
      cashier: string;
      cashiers?: string[];
    };
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [filters, setFilters] = useState({ 
    start: new Date().toISOString().split("T")[0], 
    end: new Date().toISOString().split("T")[0], 
    cashier: "Tous",
    type: "Tous"
  });

  const [userSession, setUserSession] = useState<any>(null);

  useEffect(() => {
    const cookie = document.cookie.split('; ').find(row => row.startsWith('gp_session='));
    if (cookie) {
      try {
        const session = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        setUserSession(session);
        const isAdmin = session?.admin === "Oui" || session?.role === 1 || session?.role === "1";
        if (!isAdmin) {
          setFilters(f => ({ ...f, cashier: session.username || "Tous" }));
        }
      } catch (e) { console.error(e); }
    }
  }, []);

  const isAdmin = userSession?.admin === "Oui" || userSession?.role === 1 || userSession?.role === "1";

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams(filters).toString();
      const res = await fetch(`/api/reports/cash-balance?${q}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userSession) fetchBalance();
  }, [filters, userSession]);

  const summaryItems = [
    {
      label: locale === "ar" ? "إجمالي المقبوضات النقدية" : "Total Recettes en Caisse",
      value: data?.summary.totalIncome || 0,
      icon: TrendingUp,
      color: "emerald",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
    },
    {
      label: locale === "ar" ? "إجمالي المصروفات" : "Total Dépenses",
      value: data?.summary.totalExpenses || 0,
      icon: TrendingDown,
      color: "rose",
      bg: "bg-rose-50",
      text: "text-rose-600",
    },
    {
      label: locale === "ar" ? "المبيعات الآجلة (ديون معلقة)" : "Total Non Payé (Crédit)",
      value: data?.summary.totalUnpaid || 0,
      icon: Scale,
      color: "amber",
      bg: "bg-amber-50",
      text: "text-amber-600",
    },
    {
      label: locale === "ar" ? "صافي الرصيد في الخزينة" : "Solde Net en Caisse",
      value: data?.summary.netBalance || 0,
      icon: Wallet,
      color: "indigo",
      bg: "bg-indigo-50",
      text: "text-indigo-600",
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ── 4K EXECUTIVE HERO HEADER ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Scale size={14} />
                FINANCIAL RECONCILIATION HUB 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                {isAdmin ? "TOUTES LES CAISSES" : `CAISSE : ${userSession?.username || 'ACTIF'}`}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {isAdmin 
                ? (locale === "ar" ? "الميزانية والتدقيق المالي الشامل للصناديق" : "Bilan de Caisse Global & Trésorerie")
                : (locale === "ar" ? "ميزانية الصندوق والكاشير" : "Mon Bilan de Caisse")}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "مطابقة وتدقيق فوري لحجم المبيعات الفعلي مع المقبوضات النقدية والودائع ومصروفات الصندوق"
                : "Réconciliation financière en temps réel des ventes, dépôts d'avances, crédits et dépenses"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchBalance}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Actualiser"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            <button 
              onClick={() => setIsPrintModalOpen(true)}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs border border-white/10 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>{locale === "ar" ? "طباعة التقرير" : "Imprimer le Bilan"}</span>
            </button>

            <button 
              onClick={() => setIsClosureModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Lock size={16} />
              <span>{locale === "ar" ? "إغلاق الصندوق (Rapport Z)" : "Clôture de Caisse Z"}</span>
            </button>
          </div>
        </div>
      </div>

      {isPrintModalOpen && (
        <CashBalanceModal 
          filters={filters} 
          onClose={() => setIsPrintModalOpen(false)} 
        />
      )}

      {isClosureModalOpen && data?.summary && (
        <CashClosureModal
          summary={data.summary}
          filters={filters}
          userSession={userSession}
          onClose={() => setIsClosureModalOpen(false)}
        />
      )}

      {/* ── FILTERS TOOLBAR ── */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
          <Calendar size={15} className="text-slate-500" />
          <input 
            type="date" 
            className="bg-transparent border-none text-xs font-black text-slate-800 outline-none"
            value={filters.start}
            onChange={(e) => setFilters({...filters, start: e.target.value})}
          />
          <span className="text-slate-400 text-xs">→</span>
          <input 
            type="date" 
            className="bg-transparent border-none text-xs font-black text-slate-800 outline-none"
            value={filters.end}
            onChange={(e) => setFilters({...filters, end: e.target.value})}
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
            <User size={15} className="text-slate-400" />
            <select 
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
              value={filters.cashier}
              onChange={(e) => setFilters({...filters, cashier: e.target.value})}
            >
              <option value="Tous">{locale === "ar" ? "جميع الصناديق / الكاشير" : "Tous les caissiers"}</option>
              {(data?.scoping?.cashiers || []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
          <Filter size={15} className="text-slate-400" />
          <select 
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
            value={filters.type}
            onChange={(e) => setFilters({...filters, type: e.target.value})}
          >
            <option value="Tous">Tous les types de flux</option>
            <option value="Vente">Ventes Facturées</option>
            <option value="Dépôt">Dépôts / Avances</option>
            <option value="Dépense">Dépenses Caisse</option>
            <option value="Paiement Ciment">Ciment</option>
          </select>
        </div>
      </div>

      {/* ── 4 EXECUTIVE FINANCIAL KPIS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {summaryItems.map((item, i) => (
          <div key={i} className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">{item.label}</span>
              <div className={`p-2 rounded-xl ${item.bg} ${item.text}`}>
                <item.icon size={18} />
              </div>
            </div>
            <div className={`text-2xl font-black ${item.text}`}>
              {loading ? "..." : formatCurrencyAmount(item.value)}
            </div>
            <div className="text-[11px] text-slate-400 font-bold mt-1.5">
              {locale === "ar" ? "المبالغ المحققة خلال الفترة المحددة" : "Flux consolidés de la période"}
            </div>
          </div>
        ))}
      </div>

      {/* ── ACCOUNTING MATCH & RECONCILIATION MATRIX ── */}
      {data?.summary?.reconciliation && (
        <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xs border border-slate-200/80 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
              <Scale size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {locale === "ar" ? "جدول المطابقة المحاسبية وتدقيق الصندوق" : "Match Comptable & Réconciliation Caisse"}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {locale === "ar" ? "مقارنة المبيعات الإجمالية مقابل السيولة المقبوضة فعلياً" : "Vérification de la concordance Ventes vs Encaissé"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Detailed math breakdown */}
            <div className="space-y-3.5 bg-slate-50/70 p-5 rounded-2xl border border-slate-100">
              <div className="flex justify-between items-center py-2 border-b border-slate-200/80">
                <span className="text-xs font-bold text-slate-700">
                  {locale === "ar" ? "إجمالي مبيعات الفترة (الفواتير الصادرة)" : "Chiffre d'Affaires de la période (A)"}
                </span>
                <span className="font-black text-slate-900 text-sm">
                  {formatCurrencyAmount(data.summary.reconciliation.totalInvoiced)}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-200/80 text-rose-600">
                <span className="text-xs font-bold">
                  {locale === "ar" ? "(-) المبيعات الآجلة (ديون غير مسددة)" : "(-) Crédits accordés (Ventes non payées)"}
                </span>
                <span className="font-black text-sm">
                  -{formatCurrencyAmount(data.summary.reconciliation.totalUnpaidPeriod)}
                </span>
              </div>

              {data.summary.reconciliation.totalAdvancesPeriod > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-slate-200/80 text-emerald-600">
                  <span className="text-xs font-bold">
                    {locale === "ar" ? "(+) الودائع والأرصدة المسبقة المقبوضة" : "(+) Avances clients perçues"}
                  </span>
                  <span className="font-black text-sm">
                    +{formatCurrencyAmount(data.summary.reconciliation.totalAdvancesPeriod)}
                  </span>
                </div>
              )}

              {data.summary.reconciliation.totalCementPeriod > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-slate-200/80 text-emerald-600">
                  <span className="text-xs font-bold">
                    {locale === "ar" ? "(+) مقبوضات الأسمنت" : "(+) Règlements Ciment perçus"}
                  </span>
                  <span className="font-black text-sm">
                    +{formatCurrencyAmount(data.summary.reconciliation.totalCementPeriod)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t-2 border-slate-200">
                <span className="text-slate-900 font-black uppercase text-xs">
                  {locale === "ar" ? "إجمالي السيولة النقدية المقبوضة (B)" : "Total Recettes en Caisse (B)"}
                </span>
                <span className="text-base font-black text-indigo-700 bg-indigo-50 px-3.5 py-1.5 rounded-xl border border-indigo-200/50">
                  {formatCurrencyAmount(data.summary.totalIncome)}
                </span>
              </div>
            </div>

            {/* Explanation card */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Info size={16} className="text-indigo-400" />
                {locale === "ar" ? "كيفية قراءة ومطابقة الأرقام المالية؟" : "Principe de la Réconciliation Comptable"}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {locale === "ar"
                  ? "المبيعات الفاتورية تمثل الاستحقاق الكلي، بينما ميزانية الصندوق ترصد السيولة الحقيقية المقبوضة في يد الكاشير (المبيعات النقدية + ودائع العملاء - المبيعات الآجلة)."
                  : "Le chiffre d'affaires correspond aux factures émises, tandis que le bilan de caisse retrace les encaissements réels en espèces."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TRANSACTIONS LEDGER TABLE ── */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-4">
          <div>
            <h2 className="text-base font-black text-slate-900">
              {locale === "ar" ? "حركات وسجل العمليات المالية" : "Mouvements de Trésorerie"}
            </h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              {locale === "ar" ? "تفاصيل المقبوضات والمصروفات" : "Détail chronologique des encaissements et décaissements"}
            </p>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700">
            {(data?.entries || []).filter((e: any) => !filters.type || filters.type === "Tous" || (e.type || "").toLowerCase().includes(filters.type.toLowerCase())).length} {locale === "ar" ? "حركة مسجلة" : "transactions"}
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">{locale === "ar" ? "التاريخ والوقت" : "Date & Heure"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "رقم المرجع / الفاتورة" : "Référence Doc"}</th>
                <th className="py-3.5 px-4 text-center">{locale === "ar" ? "نوع الحركة" : "Type de Flux"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "طريقة الدفع" : "Moyen Paiement"}</th>
                <th className="py-3.5 px-4">{locale === "ar" ? "المسؤول / الكاشير" : "Caissier / Opérateur"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "ar" ? "مقبوضات (+)" : "Entrée (+)"}</th>
                <th className="py-3.5 px-4 text-right">{locale === "ar" ? "مصروفات (-)" : "Sortie (-)"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Loader2 size={32} className="animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>{locale === "ar" ? "جاري تحميل التدقيق المالي..." : "Calcul de la position financière..."}</span>
                  </td>
                </tr>
              ) : (data?.entries || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">
                    <Receipt size={36} className="mx-auto text-slate-300 mb-2" />
                    <span>{locale === "ar" ? "لا توجد حركات مالية مسجلة لهذه الفترة." : "Aucun mouvement financier trouvé."}</span>
                  </td>
                </tr>
              ) : (() => {
                const filteredEntries = (data?.entries || []).filter((entry: any) => {
                  if (!filters.type || filters.type === "Tous") return true;
                  return (entry.type || "").toLowerCase().includes(filters.type.toLowerCase());
                });

                if (filteredEntries.length === 0) {
                  return (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400">
                        <Receipt size={36} className="mx-auto text-slate-300 mb-2" />
                        <span>{locale === "ar" ? "لا توجد حركات مالية مطابقة للفلتر المحدد." : "Aucun mouvement financier correspondant à ce filtre."}</span>
                      </td>
                    </tr>
                  );
                }

                return filteredEntries.map((entry: any, i: number) => {
                  const isPositive = entry.entree > 0;
                  const isExpense = entry.sortie > 0;

                  return (
                    <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-mono font-bold text-slate-500">
                        {new Date(entry.date).toLocaleDateString('fr-FR')}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-mono font-black text-indigo-600 text-xs">{entry.ref}</div>
                        {entry.client && (
                          <div className="text-[10px] text-slate-400 font-bold">{entry.client}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-black inline-block ${
                            entry.type.includes("Vente") || entry.type.includes("Paiement")
                              ? "bg-emerald-100 text-emerald-700"
                              : entry.type.includes("Dépôt") || entry.type.includes("Avance")
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-bold text-slate-700">
                        {entry.moyen}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-bold text-slate-800">
                        <span className="font-black text-slate-900">{entry.user}</span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isPositive ? (
                          <span className="font-black text-emerald-600 text-sm">
                            +{formatCurrencyAmount(entry.entree)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {isExpense ? (
                          <span className="font-black text-rose-600 text-sm">
                            -{formatCurrencyAmount(entry.sortie)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
