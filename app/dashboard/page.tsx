"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, FileText, AlertTriangle, ArrowUpRight,
  Wallet, Activity, Calendar as CalendarIcon, Database, Loader2,
  Package, ArrowRightLeft, MapPin, ShoppingBag, BarChart3
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie,
  Legend
} from "recharts";

const COLORS = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#f97316','#eab308'];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard").then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false));
    fetch("/api/dashboard/analytics").then(r => r.json()).then(setAnalytics).catch(console.error).finally(() => setLoadingAnalytics(false));
  }, []);

  const stats = [
    { label: "Ventes du jour", value: loading ? "..." : `${fmt(data?.todaySales || 0)} F`, icon: Wallet, bg: "linear-gradient(135deg, #4f46e5, #7c3aed)", sc: "rgba(79,70,229,0.3)" },
    { label: "Factures émises", value: loading ? "..." : String(data?.todayInvoices || 0), icon: FileText, bg: "linear-gradient(135deg, #ec4899, #8b5cf6)", sc: "rgba(139,92,246,0.3)" },
    { label: "Stock faible", value: loading ? "..." : String(data?.lowStockCount || 0).padStart(2, '0'), icon: AlertTriangle, bg: "linear-gradient(135deg, #f59e0b, #ef4444)", sc: "rgba(245,158,11,0.3)" },
  ];

  const growth = analytics?.summary?.growthPercent || 0;
  const isGrowthPositive = growth >= 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Vue d&apos;ensemble</h1>
          <p className="text-slate-500 font-medium mt-1">Bienvenue sur votre espace de gestion premium.</p>
        </div>
        <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/50 shadow-sm">
          <CalendarIcon size={18} className="text-indigo-500" />
          <span className="text-slate-600 font-bold text-sm">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((s, i) => (
          <div key={i} className="group relative overflow-hidden rounded-[32px] p-8 text-white transition-all duration-300 hover:scale-[1.03]" style={{ background: s.bg, boxShadow: `0 20px 40px ${s.sc}` }}>
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl"><s.icon size={24} /></div>
                <div className="flex items-center gap-1 bg-white/20 backdrop-blur-lg px-3 py-1 rounded-full text-xs font-black"><ArrowUpRight size={14} />+</div>
              </div>
              <h3 className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">{s.label}</h3>
              <p className="text-4xl font-black tracking-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Growth Summary Card */}
      {analytics?.summary && (
        <div className="rounded-[32px] p-8 bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl shadow-indigo-100/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${isGrowthPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {isGrowthPositive ? <TrendingUp size={28} /> : <TrendingDown size={28} />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Croissance mensuelle</p>
                <p className={`text-3xl font-black ${isGrowthPositive ? 'text-emerald-600' : 'text-rose-600'}`}>{isGrowthPositive ? '+' : ''}{growth}%</p>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{analytics.summary.currentMonthName}</p>
                <p className="text-xl font-black text-slate-800 mt-1">{fmt(analytics.summary.currentMonthTotal)} F</p>
              </div>
              <div className="w-px bg-slate-200" />
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{analytics.summary.previousMonthName}</p>
                <p className="text-xl font-black text-slate-400 mt-1">{fmt(analytics.summary.previousMonthTotal)} F</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1: Top Products + Top Locations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Products */}
        <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[40px] p-8 shadow-2xl shadow-indigo-100/40 min-h-[420px] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-500/10 rounded-2xl"><ShoppingBag size={24} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Produits les plus vendus</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ce mois</p>
            </div>
          </div>
          <div className="flex-1">
            {loadingAnalytics ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : (analytics?.topProducts?.length || 0) === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40"><Package size={48} className="mb-4" /><p className="font-bold">Aucune donnée</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.topProducts} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="prodGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} width={130} />
                  <Tooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-100">
                      <p className="text-xs font-black text-slate-800">{payload[0].payload.name}</p>
                      <p className="text-lg font-black text-indigo-600">{payload[0].value} <span className="text-xs text-slate-400">unités</span></p>
                    </div>
                  ) : null} />
                  <Bar dataKey="qty" fill="url(#prodGrad)" radius={[0, 8, 8, 0]} barSize={20}>
                    {(analytics?.topProducts || []).map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} className="hover:brightness-110 transition-all" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Locations */}
        <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[40px] p-8 shadow-2xl shadow-indigo-100/40 min-h-[420px] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-emerald-500/10 rounded-2xl"><MapPin size={24} className="text-emerald-600" /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Sites les plus rentables</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chiffre d&apos;affaires par emplacement</p>
            </div>
          </div>
          <div className="flex-1">
            {loadingAnalytics ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
            ) : (analytics?.topLocations?.length || 0) === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-40"><MapPin size={48} className="mb-4" /><p className="font-bold">Aucune donnée</p></div>
            ) : (
              <div className="flex flex-col h-full">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <defs>
                      {COLORS.map((c, i) => (
                        <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor={c} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={c} stopOpacity={0.6} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie data={analytics.topLocations} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {(analytics?.topLocations || []).map((_: any, i: number) => (
                        <Cell key={i} fill={`url(#pieGrad${i % COLORS.length})`} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-100">
                        <p className="text-xs font-black text-slate-800">{payload[0].name}</p>
                        <p className="text-lg font-black text-emerald-600">{fmt(Number(payload[0].value))} F</p>
                      </div>
                    ) : null} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {(analytics?.topLocations || []).map((loc: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs font-bold text-slate-700 truncate">{loc.name}</span>
                      <span className="text-[10px] font-black text-slate-400 ml-auto whitespace-nowrap">{fmt(loc.revenue)} F</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Comparison Area Chart */}
      <div className="bg-[#0f172a] rounded-[40px] p-8 shadow-2xl overflow-hidden relative group min-h-[400px]">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-white mb-1">Comparaison Mensuelle</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                {analytics?.summary?.currentMonthName || 'Ce mois'} vs {analytics?.summary?.previousMonthName || 'Mois précédent'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-xs font-bold text-slate-400">{analytics?.summary?.currentMonthName || 'Actuel'}</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500" /><span className="text-xs font-bold text-slate-500">{analytics?.summary?.previousMonthName || 'Précédent'}</span></div>
            </div>
          </div>
          <div className="flex-1 w-full" style={{ minHeight: 280 }}>
            {loadingAnalytics ? (
              <div className="w-full h-full flex items-center justify-center opacity-20"><Database size={48} className="text-white animate-pulse" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.monthlyComparison || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="curGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#64748b" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#64748b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} interval={1} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Jour {label}</p>
                      <p className="text-sm font-black text-indigo-600">{fmt(payload[0]?.value as number)} F <span className="text-xs text-slate-400">actuel</span></p>
                      <p className="text-sm font-black text-slate-400">{fmt(payload[1]?.value as number)} F <span className="text-xs text-slate-300">précédent</span></p>
                    </div>
                  ) : null} />
                  <Area type="monotone" dataKey="current" stroke="#818cf8" strokeWidth={2.5} fill="url(#curGrad)" dot={false} activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="previous" stroke="#475569" strokeWidth={1.5} strokeDasharray="5 5" fill="url(#prevGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Activity + Stock Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="group bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[40px] p-8 shadow-2xl shadow-indigo-100/40 min-h-[400px] flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300"><Activity size={24} className="text-indigo-600" /></div>
            <div><h2 className="text-xl font-black text-slate-800">Activité récente</h2><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Flux en direct</p></div>
          </div>
          <div className="flex-1">
            {loading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : (data?.recentActivity?.length || 0) === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40"><Package size={48} className="mb-4" /><p className="font-bold">Aucune activité</p></div>
            ) : (
              <div className="space-y-4">
                {data?.recentActivity.map((act: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/40 rounded-2xl border border-white/60 hover:bg-white transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${act.type.includes("VENTE") || act.type.includes("SORTIE") ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"}`}>{act.type.charAt(0)}</div>
                      <div>
                        <p className="font-black text-slate-800 text-sm">{act.designation}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{act.type.replace(/_/g, ' ')} • {new Date(act.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                      </div>
                    </div>
                    <p className={`font-black ${act.type.includes("VENTE") || act.type.includes("SORTIE") ? "text-rose-500" : "text-emerald-500"}`}>
                      {act.type.includes("VENTE") || act.type.includes("SORTIE") ? "-" : "+"}{Math.abs(act.quantite)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[40px] p-8 shadow-2xl overflow-hidden relative group min-h-[400px]">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div><h2 className="text-xl font-black text-white mb-1">Performance du Stock</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sorties sur 7 jours</p></div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10"><TrendingUp size={20} className="text-indigo-400" /></div>
            </div>
            <div className="flex-1 w-full">
              {loading ? (
                <div className="w-full h-full flex items-center justify-center opacity-20"><Database size={48} className="text-white animate-pulse" /></div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data?.chartData || []).map((val: number, i: number) => ({ name: ['J-6','J-5','J-4','J-3','J-2','Hier','Auj.'][i], value: val }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#4f46e5" /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                    <Tooltip content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.name}</p><p className="text-lg font-black text-slate-900">{payload[0].value} <span className="text-xs text-slate-400">Unités</span></p></div>
                    ) : null} />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="url(#barGradient)" barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
