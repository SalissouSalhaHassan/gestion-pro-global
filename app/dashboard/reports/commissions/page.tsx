"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Award,
  Crown,
  Target,
  DollarSign,
  TrendingUp,
  Users,
  Search,
  Filter,
  RefreshCw,
  Percent,
  Wallet,
  CheckCircle2,
  Calendar,
  Loader2,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import TargetSettingModal from "./TargetSettingModal";
import PayoutModal from "./PayoutModal";

type SellerPerformance = {
  userId: number;
  nom: string;
  role: string;
  emplacement: string;
  totalVentes: number;
  nombreFactures: number;
  objectifCA: number;
  tauxCommission: number;
  primeBonus: number;
  pctAtteinte: number;
  isTargetReached: boolean;
  commissionBase: number;
  commissionTotale: number;
  montantPaye: number;
  soldeRestant: number;
  targetId: number | null;
};

type CommissionData = {
  month: string;
  kpis: {
    totalCompanySales: number;
    totalCommissionsDue: number;
    totalCommissionsPaid: number;
    totalCommissionsRemaining: number;
    sellersCount: number;
    topPerformer: SellerPerformance | null;
  };
  performances: SellerPerformance[];
};

export default function CommissionsPage() {
  const { locale, dir } = useLanguage();
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [data, setData] = useState<CommissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedSellerForTarget, setSelectedSellerForTarget] = useState<SellerPerformance | null>(null);
  const [selectedSellerForPayout, setSelectedSellerForPayout] = useState<SellerPerformance | null>(null);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/commissions?month=${selectedMonth}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, [selectedMonth]);

  const filteredPerformances = useMemo(() => {
    if (!data?.performances) return [];
    return data.performances.filter((p) => {
      const q = search.toLowerCase();
      return (
        !search ||
        p.nom.toLowerCase().includes(q) ||
        (p.emplacement && p.emplacement.toLowerCase().includes(q))
      );
    });
  }, [data, search]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shadow-sm">
          <Crown size={14} /> #1 TOP
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-300 text-slate-800 font-black text-xs shadow-xs">
          <Award size={14} /> #2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-700 text-white font-black text-xs shadow-xs">
          <Award size={14} /> #3
        </span>
      );
    }
    return <span className="font-mono font-bold text-slate-400 text-xs">#{rank}</span>;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* 4K Hero Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Crown size={14} />
                COMMISSIONS & PERFORMANCE 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                OBJECTIFS DE VENTES & PRIMES
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "أهداف المبيعات وعمولات الموظفين (Sales Targets & Commissions)" : "Objectifs & Commissions des Vendeurs"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "تتبع أداء البائعين الشهري، نسبة تحقيق الهدف، واحتساب وصرف العمولات والمكافآت آلياً"
                : "Fixez les quotas de vente mensuels, suivez l'atteinte des objectifs et versez les commissions"}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-2 rounded-2xl border border-white/20">
              <Calendar size={15} className="text-amber-400" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={fetchCommissions}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer shadow-sm"
              title="Actualiser"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "مبيعات الفريق هذا الشهر" : "Ventes Globales du Mois"}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700 font-mono">
            {formatCurrencyAmount(data?.kpis.totalCompanySales || 0, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "إجمالي رقم الأعمال المحقق" : "Chiffre d'affaires cumulé équipe"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي العمولات المستحقة" : "Commissions Dues"}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Award size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {formatCurrencyAmount(data?.kpis.totalCommissionsDue || 0, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "عمولات ونسب مستحقة للموظفين" : "Droits acquis par les vendeurs"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "العمولات المصروفة فعلياً" : "Commissions Versées"}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono">
            {formatCurrencyAmount(data?.kpis.totalCommissionsPaid || 0, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "أموال تم تسليمها للموظفين" : "Montant déjà déboursé"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "نجم المبيعات (Top Performer)" : "Meilleur Vendeur"}
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Crown size={18} />
            </div>
          </div>
          <div className="text-base font-black text-purple-900 truncate">
            {data?.kpis.topPerformer ? data.kpis.topPerformer.nom : "Aucun"}
          </div>
          <p className="text-[11px] font-medium text-slate-500 font-mono">
            {data?.kpis.topPerformer
              ? `${formatCurrencyAmount(data.kpis.topPerformer.totalVentes, "FCFA")} (${data.kpis.topPerformer.pctAtteinte}%)`
              : "En attente de ventes"}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث باسم البائع أو المستودع..." : "Rechercher par nom ou dépôt..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Rang</th>
                <th className="px-6 py-4">{locale === "ar" ? "البائع / الموظف" : "Vendeur"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "المبيعات / الهدف" : "Réalisé vs Objectif"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "نسبة الإنجاز" : "% Atteinte"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "العمولة المكتسبة" : "Commission Due"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "المتبقي للصرف" : "Reste à Verser"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "الإجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-3 text-amber-500" size={36} />
                      <p className="font-bold text-slate-600 text-xs">
                        Calcul des performances et des commissions...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredPerformances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-bold">
                    Aucun employé trouvé pour cette période.
                  </td>
                </tr>
              ) : (
                filteredPerformances.map((perf, idx) => (
                  <tr key={perf.userId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      {getRankBadge(idx + 1)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900">{perf.nom}</div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {perf.role} • {perf.emplacement || "Boutique"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono font-black text-slate-900">
                        {formatCurrencyAmount(perf.totalVentes, "FCFA")}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Objectif : {formatCurrencyAmount(perf.objectifCA, "FCFA")}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            perf.pctAtteinte >= 100
                              ? "bg-emerald-100 text-emerald-800"
                              : perf.pctAtteinte >= 70
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {perf.pctAtteinte}%
                        </span>
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              perf.pctAtteinte >= 100 ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.min(perf.pctAtteinte, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-black text-amber-700">
                      <div>{formatCurrencyAmount(perf.commissionTotale, "FCFA")}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        ({perf.tauxCommission}%)
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-black text-emerald-600">
                      {formatCurrencyAmount(perf.soldeRestant, "FCFA")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedSellerForTarget(perf)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                          title="Modifier l'objectif"
                        >
                          <Target size={13} />
                          <span>Objectif</span>
                        </button>
                        {perf.soldeRestant > 0 && (
                          <button
                            onClick={() => setSelectedSellerForPayout(perf)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Wallet size={13} />
                            <span>Verser</span>
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
      {selectedSellerForTarget && (
        <TargetSettingModal
          seller={selectedSellerForTarget}
          month={selectedMonth}
          onClose={() => setSelectedSellerForTarget(null)}
          onSaved={() => {
            setSelectedSellerForTarget(null);
            fetchCommissions();
          }}
        />
      )}

      {selectedSellerForPayout && (
        <PayoutModal
          seller={selectedSellerForPayout}
          month={selectedMonth}
          onClose={() => setSelectedSellerForPayout(null)}
          onPaid={() => {
            setSelectedSellerForPayout(null);
            fetchCommissions();
          }}
        />
      )}
    </div>
  );
}
