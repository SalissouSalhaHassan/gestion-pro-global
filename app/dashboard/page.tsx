"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, 
  TrendingDown, 
  FileText, 
  AlertTriangle, 
  ArrowUpRight,
  Wallet, 
  Activity, 
  Calendar as CalendarIcon, 
  Database, 
  Loader2,
  Package, 
  ArrowRightLeft, 
  MapPin, 
  ShoppingBag, 
  BarChart3,
  Sparkles,
  RefreshCw,
  Plus,
  Scale,
  Users,
  ShieldCheck,
  CreditCard,
  Building2,
  Layers,
  CheckCircle2
} from "lucide-react";
import {
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  ResponsiveContainer, 
  Cell, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie,
  Legend
} from "recharts";
import { useRouter } from "next/navigation";
import GlobalMarketClock from "@/components/GlobalMarketClock";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";

const COLORS = ['#6366f1','#10b981','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f43f5e','#3b82f6'];

export default function DashboardPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  const loadAll = () => {
    setLoading(true);
    setLoadingAnalytics(true);
    fetch("/api/dashboard", { cache: "no-store" })
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/dashboard/analytics", { cache: "no-store" })
      .then(r => r.json())
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setLoadingAnalytics(false));
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 45000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    { 
      label: locale === "ar" ? "مبيعات اليوم المحققة" : "Ventes du jour", 
      value: loading ? "..." : formatCurrencyAmount(data?.todaySales || 0), 
      icon: Wallet, 
      bg: "linear-gradient(135deg, #4f46e5, #7c3aed)", 
      sc: "rgba(79,70,229,0.25)",
      sub: locale === "ar" ? "إجمالي الفواتير الصادرة اليوم" : "Factures générées aujourd'hui"
    },
    { 
      label: locale === "ar" ? "عدد فواتير اليوم" : "Factures émises", 
      value: loading ? "..." : String(data?.todayInvoices || 0), 
      icon: FileText, 
      bg: "linear-gradient(135deg, #ec4899, #8b5cf6)", 
      sc: "rgba(236,72,153,0.25)",
      sub: locale === "ar" ? "عمليات البيع بنقاط البيع" : "Tickets & factures POS"
    },
    { 
      label: locale === "ar" ? "تنبيهات المخزون المنخفض" : "Stock faible", 
      value: loading ? "..." : String(data?.lowStockCount || 0).padStart(2, '0'), 
      icon: AlertTriangle, 
      bg: "linear-gradient(135deg, #f59e0b, #ef4444)", 
      sc: "rgba(245,158,11,0.25)",
      sub: locale === "ar" ? "مواد بحاجة لإعادة التزويد" : "Articles sous le seuil d'alerte"
    },
  ];

  const growth = analytics?.summary?.growthPercent || 0;
  const isGrowthPositive = growth >= 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ── 4K EXECUTIVE HERO CONTROL ROOM ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Sparkles size={14} />
                GLOBAL ERP CONTROL CENTER 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                LIVE STREAMING
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "مركز القيادة والتحكم الإداري الشامل" : "Vue d'ensemble & Tableau de Bord"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "رصد فوري متقدم للأداء المالي، والمبيعات، وتدفقات المخزون عبر جميع الفروع والنقاط"
                : "Pilotage en temps réel des ventes, de la trésorerie et de la performance globale"}
            </p>
          </div>

          {/* Action Quick Shortcuts */}
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={loadAll}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Actualiser"
            >
              <RefreshCw size={15} className={loading || loadingAnalytics ? "animate-spin" : ""} />
              <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            <button 
              onClick={() => router.push("/dashboard/reports/cash-balance")}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-white/10"
            >
              <Scale size={15} className="text-indigo-400" />
              <span>{locale === "ar" ? "الميزانية المالية" : "Bilan de Caisse"}</span>
            </button>

            <button 
              onClick={() => router.push("/dashboard/pos")}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{locale === "ar" ? "نقطة البيع (POS)" : "Caisse POS"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Live Market Clocks */}
      <GlobalMarketClock />

      {/* ── 3 MAIN EXECUTIVE 4K STATS CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <div 
            key={i} 
            className="group relative overflow-hidden rounded-[32px] p-7 text-white transition-all duration-300 hover:scale-[1.02] cursor-pointer" 
            style={{ background: s.bg, boxShadow: `0 16px 36px ${s.sc}` }}
          >
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl"><s.icon size={22} /></div>
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-lg px-3 py-1 rounded-full text-xs font-black">
                  <ArrowUpRight size={14} />
                  <span>LIVE</span>
                </div>
              </div>
              <h3 className="text-xs font-bold opacity-80 uppercase tracking-widest mb-1">{s.label}</h3>
              <p className="text-3xl font-black tracking-tight">{s.value}</p>
              <p className="text-[11px] font-medium opacity-75 mt-2">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── MONTHLY GROWTH & TRAJECTORY SUMMARY ── */}
      {analytics?.summary && (
        <div className="rounded-[32px] p-6 lg:p-7 bg-white rounded-3xl shadow-xs border border-slate-200/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${isGrowthPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {isGrowthPositive ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {locale === "ar" ? "معدل النمو الشهري" : "Croissance mensuelle"}
                </p>
                <p className={`text-3xl font-black ${isGrowthPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isGrowthPositive ? '+' : ''}{growth}%
                </p>
              </div>
            </div>

            <div className="flex gap-8 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {analytics.summary.currentMonthName || "Ce mois"}
                </p>
                <p className="text-lg font-black text-slate-900 mt-0.5">
                  {formatCurrencyAmount(analytics.summary.currentMonthTotal)}
                </p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {analytics.summary.previousMonthName || "Mois précédent"}
                </p>
                <p className="text-lg font-black text-slate-400 mt-0.5">
                  {formatCurrencyAmount(analytics.summary.previousMonthTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CHARTS ROW 1: TOP PRODUCTS + TOP SELLERS / CASHIERS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top Products */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {locale === "ar" ? "المنتجات الأكثر مبيعاً" : "Produits les plus vendus"}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {locale === "ar" ? "حجم الكميات المباعة هذا الشهر" : "Volume vendu ce mois"}
              </p>
            </div>
          </div>

          <div className="flex-1">
            {loadingAnalytics ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : (analytics?.topProducts?.length || 0) === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <Package size={44} className="mb-2" />
                <p className="font-bold text-xs">Aucune donnée</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.topProducts} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} width={130} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 text-xs">
                      <p className="font-black text-slate-800">{payload[0].payload.name}</p>
                      <p className="text-base font-black text-indigo-600 mt-1">{payload[0].value} <span className="text-xs text-slate-400">unités</span></p>
                    </div>
                  ) : null} />
                  <Bar dataKey="qty" radius={[0, 8, 8, 0]} barSize={20}>
                    {(analytics?.topProducts || []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Sellers / Hubs */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Users size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {locale === "ar" ? "أعلى الكاشيرات ونقاط التحصيل" : "Pôles & Vendeurs les plus performants"}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {locale === "ar" ? "رقم المعاملات المحقق حسب الحساب" : "Chiffre d'affaires par opérateur"}
              </p>
            </div>
          </div>

          <div className="flex-1">
            {loadingAnalytics ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
            ) : (analytics?.topLocations?.length || 0) === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <MapPin size={44} className="mb-2" />
                <p className="font-bold text-xs">Aucune donnée</p>
              </div>
            ) : (
              <div className="flex flex-col h-full justify-between">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie 
                      data={analytics.topLocations} 
                      dataKey="revenue" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={50} 
                      outerRadius={75} 
                      paddingAngle={3} 
                      strokeWidth={0}
                    >
                      {(analytics?.topLocations || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 text-xs">
                        <p className="font-black text-slate-800">{payload[0].name}</p>
                        <p className="text-sm font-black text-emerald-600 mt-1">{formatCurrencyAmount(Number(payload[0].value))}</p>
                      </div>
                    ) : null} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  {(analytics?.topLocations || []).map((loc: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs font-bold text-slate-700 truncate">{loc.name}</span>
                      <span className="text-[10px] font-black text-slate-400 ml-auto whitespace-nowrap">{formatCurrencyAmount(loc.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MONTHLY COMPARISON 30-DAY TIMELINE (DARK LUXURY CHART) ── */}
      <div className="bg-slate-900 rounded-[32px] p-6 lg:p-8 shadow-2xl overflow-hidden relative border border-slate-800">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-black text-white">
              {locale === "ar" ? "المقارنة الشهرية وتطور المبيعات اليومية" : "Comparaison Mensuelle & Tendance Quotidienne"}
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
              {analytics?.summary?.currentMonthName || 'Ce mois'} vs {analytics?.summary?.previousMonthName || 'Mois précédent'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-slate-300">{analytics?.summary?.currentMonthName || 'Actuel'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-500" />
              <span className="text-slate-500">{analytics?.summary?.previousMonthName || 'Précédent'}</span>
            </div>
          </div>
        </div>

        <div className="w-full h-[280px]">
          {loadingAnalytics ? (
            <div className="w-full h-full flex items-center justify-center opacity-20">
              <Database size={40} className="text-white animate-pulse" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics?.monthlyComparison || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="curGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} interval={1} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                  <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-100 text-xs">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jour {label}</p>
                    <p className="text-sm font-black text-indigo-600">{formatCurrencyAmount(payload[0]?.value as number)} <span className="text-xs text-slate-400">actuel</span></p>
                    <p className="text-sm font-black text-slate-400">{formatCurrencyAmount(payload[1]?.value as number)} <span className="text-xs text-slate-300">précédent</span></p>
                  </div>
                ) : null} />
                <Area type="monotone" dataKey="current" stroke="#818cf8" strokeWidth={2.5} fill="url(#curGrad)" dot={false} activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="previous" stroke="#475569" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── ROW 3: RECENT ACTIVITY & 7-DAY INVENTORY PERFORMANCE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Activity */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 min-h-[380px] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Activity size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {locale === "ar" ? "الحركات والنشاطات الأخيرة" : "Activité récente"}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {locale === "ar" ? "سجل الحركات المباشر" : "Flux en direct"}
              </p>
            </div>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : (data?.recentActivity?.length || 0) === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40">
                <Package size={44} className="mb-2" />
                <p className="font-bold text-xs">Aucune activité récente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.recentActivity.map((act: any, i: number) => {
                  const isExit = act.type.includes("VENTE") || act.type.includes("SORTIE");
                  return (
                    <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isExit ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                        }`}>
                          {act.type.charAt(0)}
                        </div>
                        <div>
                          <p className="font-black text-slate-800 text-xs">{act.designation}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                            {act.type.replace(/_/g, ' ')} • {new Date(act.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <span className={`font-black text-sm ${isExit ? "text-rose-500" : "text-emerald-500"}`}>
                        {isExit ? "-" : "+"}{Math.abs(act.quantite)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 7-Day Stock Performance */}
        <div className="bg-slate-900 rounded-3xl p-6 shadow-xs border border-slate-800 min-h-[380px] flex flex-col text-white">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black text-white">
                {locale === "ar" ? "أداء حركة المخزون (7 أيام)" : "Performance du Stock"}
              </h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
                {locale === "ar" ? "حجم الوحدات المباعة أسبوعياً" : "Sorties sur les 7 derniers jours"}
              </p>
            </div>
            <div className="p-2.5 bg-white/10 rounded-2xl">
              <TrendingUp size={18} className="text-indigo-400" />
            </div>
          </div>

          <div className="flex-1 w-full min-h-[220px]">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center opacity-20">
                <Database size={40} className="text-white animate-pulse" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data?.chartData || []).map((val: number, i: number) => ({ name: ['J-6','J-5','J-4','J-3','J-2','Hier','Auj.'][i], value: val }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-100 text-xs">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                      <p className="text-base font-black text-slate-900">{payload[0].value} <span className="text-xs text-slate-400">Unités</span></p>
                    </div>
                  ) : null} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#818cf8" barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
