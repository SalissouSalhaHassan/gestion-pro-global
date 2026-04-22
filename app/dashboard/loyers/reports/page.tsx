"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, TrendingUp, Wallet, Users, Home, Printer, Loader2,
  Calendar, PieChart as PieChartIcon, BarChart3, Download, Search, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function LoyerReportsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [fStartDate, setFStartDate] = useState("");
  const [fEndDate, setFEndDate] = useState("");

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fStartDate) params.set("start_date", fStartDate);
      if (fEndDate) params.set("end_date", fEndDate);
      const res = await fetch(`/api/loyers/stats?${params.toString()}`);
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        <p className="text-slate-500 font-bold animate-pulse text-lg">Préparation du tableau de bord...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push("/dashboard/loyers")} className="rounded-2xl h-12 border-slate-200 hover:bg-slate-50 shadow-sm px-6">
            <ArrowLeft size={18} className="mr-2" /> Retour
          </Button>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <TrendingUp className="text-indigo-500" size={32} />
              Rapports Détaillés
            </h1>
            <p className="text-slate-500 font-medium mt-1 uppercase text-[10px] tracking-widest">Analytique de la Gestion des Loyers</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200">
             <div className="flex items-center gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Du</label>
                <Input 
                  type="date" 
                  value={fStartDate} 
                  onChange={(e) => setFStartDate(e.target.value)} 
                  className="h-8 w-32 border-none bg-transparent font-bold text-xs p-0 focus-visible:ring-0"
                />
             </div>
             <div className="w-px h-4 bg-slate-200 mx-2" />
             <div className="flex items-center gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Au</label>
                <Input 
                  type="date" 
                  value={fEndDate} 
                  onChange={(e) => setFEndDate(e.target.value)} 
                  className="h-8 w-32 border-none bg-transparent font-bold text-xs p-0 focus-visible:ring-0"
                />
             </div>
             <Button size="sm" onClick={fetchStats} className="h-8 w-8 p-0 rounded-lg ml-2 bg-indigo-600">
                <Search size={14} />
             </Button>
             {(fStartDate || fEndDate) && (
               <Button variant="ghost" size="sm" onClick={() => { setFStartDate(""); setFEndDate(""); }} className="h-8 w-8 p-0 rounded-lg ml-1">
                 <X size={14} />
               </Button>
             )}
          </div>
          <Button onClick={() => window.open('/api/loyers/print/report', '_blank')} className="rounded-2xl h-12 px-6 font-black bg-[#0f172a] hover:bg-slate-800 shadow-xl transition-all hover:scale-105 active:scale-95">
            <Printer size={18} className="mr-2" /> Imprimer Rapport Complet
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Revenue Total", value: `${fmt(stats.totalRevenue)} F`, icon: Wallet, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
          { label: "Potentiel Mensuel", value: `${fmt(stats.potentialMonthly)} F`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
          { label: "Contrats Actifs", value: stats.contracts.active, icon: Users, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "Contrats Totaux", value: stats.contracts.total, icon: Home, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
        ].map((kpi, i) => (
          <div key={i} className={`bg-white rounded-[32px] p-6 border-2 ${kpi.border} shadow-sm group transition-all duration-300 hover:shadow-xl hover:translate-y-[-4px]`}>
            <div className={`w-14 h-14 ${kpi.bg} ${kpi.color} rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:rotate-12`}>
              <kpi.icon size={28} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Income Chart */}
        <div className="bg-[#0f172a] rounded-[40px] p-8 shadow-2xl relative overflow-hidden border border-white/5">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <BarChart3 size={120} className="text-white" />
          </div>
          <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 relative z-10">
            <div className="w-2 h-8 bg-indigo-500 rounded-full" />
            Évolution des Revenus (12 mois)
          </h3>
          <div className="h-[350px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="rgba(255,255,255,0.4)" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `${val / 1000}k`}
                />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '16px', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                    color: '#fff' 
                  }}
                  itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#6366f1" 
                  radius={[10, 10, 0, 0]} 
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Payment Mode */}
        <div className="bg-white rounded-[40px] p-8 shadow-xl border border-slate-100 flex flex-col">
          <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
            <div className="w-2 h-8 bg-emerald-500 rounded-full" />
            Répartition par Mode de Paiement
          </h3>
          <div className="flex-1 flex flex-col md:flex-row items-center gap-8">
            <div className="h-[300px] w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.modeRevenue}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {stats.modeRevenue.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              {stats.modeRevenue.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-bold text-slate-600 uppercase tracking-wide">{item.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-900 group-hover:text-indigo-600">{fmt(item.value)} F</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contract Distribution */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[40px] p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <Users size={180} />
        </div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
            <div className="w-2 h-8 bg-white/30 rounded-full" />
            Statuts des Contrats
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: "Contrats Actifs", count: stats.contracts.active, percent: (stats.contracts.active / stats.contracts.total) * 100, color: "bg-emerald-400" },
              { label: "Contrats Expirés", count: stats.contracts.expired, percent: (stats.contracts.expired / stats.contracts.total) * 100, color: "bg-amber-400" },
              { label: "Autres / Annulés", count: stats.contracts.total - stats.contracts.active - stats.contracts.expired, percent: ((stats.contracts.total - stats.contracts.active - stats.contracts.expired) / stats.contracts.total) * 100, color: "bg-white/40" },
            ].map((st, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
                <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-2">{st.label}</p>
                <div className="flex items-end justify-between mb-4">
                  <span className="text-4xl font-black">{st.count}</span>
                  <span className="text-sm font-bold opacity-60">{st.percent.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full ${st.color}`} style={{ width: `${st.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="text-center">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">GestionPro Analytique • {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
