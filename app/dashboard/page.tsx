"use client";

import { useEffect, useState } from "react";
import { 
  TrendingUp, 
  FileText, 
  AlertTriangle, 
  ArrowUpRight, 
  Wallet, 
  Activity,
  Calendar as CalendarIcon,
  Database,
  Loader2,
  Package,
  ArrowRightLeft
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";

export default function DashboardPage() {
  const [data, setData] = useState<{
    todaySales: number;
    todayInvoices: number;
    lowStockCount: number;
    recentActivity: any[];
    chartData: number[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (res.ok) {
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const stats = [
    {
      label: "Ventes du jour",
      value: loading ? "..." : `${Number(data?.todaySales || 0).toLocaleString("fr-FR").replace(/\u202f/g, ' ')} F CFA`,
      change: "+", 
      icon: Wallet,
      bg: "linear-gradient(135deg, #4f46e5, #7c3aed)",
      shadowColor: "rgba(79,70,229,0.3)"
    },
    {
      label: "Factures émises",
      value: loading ? "..." : String(data?.todayInvoices || 0),
      change: "+",
      icon: FileText,
      bg: "linear-gradient(135deg, #ec4899, #8b5cf6)",
      shadowColor: "rgba(139,92,246,0.3)"
    },
    {
      label: "Stock faible",
      value: loading ? "..." : String(data?.lowStockCount || 0).padStart(2, '0'),
      change: "",
      icon: AlertTriangle,
      bg: "linear-gradient(135deg, #f59e0b, #ef4444)",
      shadowColor: "rgba(245,158,11,0.3)"
    }
  ];

  const maxVal = Math.max(...(data?.chartData || [1]), 10);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header with Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            Vue d&apos;ensemble
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Bienvenue sur votre espace de gestion premium.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/50 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/50 shadow-sm">
          <CalendarIcon size={18} className="text-indigo-500" />
          <span className="text-slate-600 font-bold text-sm">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="group relative overflow-hidden rounded-[32px] p-8 text-white transition-all duration-300 hover:scale-[1.03]"
            style={{ background: stat.bg, boxShadow: `0 20px 40px ${stat.shadowColor}` }}
          >
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl">
                  <stat.icon size={24} />
                </div>
                {stat.change && (
                  <div className="flex items-center gap-1 bg-white/20 backdrop-blur-lg px-3 py-1 rounded-full text-xs font-black">
                    <ArrowUpRight size={14} />
                    {stat.change}
                  </div>
                )}
              </div>
              
              <h3 className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">{stat.label}</h3>
              <p className="text-4xl font-black tracking-tight">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activities & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="group bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[40px] p-8 shadow-2xl shadow-indigo-100/40 min-h-[400px] flex flex-col transition-all duration-500 hover:shadow-indigo-500/10 hover:-translate-y-1">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-500/10 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                <Activity size={24} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800">Activité récente</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Flux en direct</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1">
             {loading ? (
               <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
               </div>
             ) : data?.recentActivity.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                   <Package size={48} className="mb-4" />
                   <p className="font-bold">Aucune activité</p>
                </div>
             ) : (
                <div className="space-y-4">
                   {data?.recentActivity.map((act, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/40 rounded-2xl border border-white/60 hover:bg-white transition-colors">
                         <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${act.type.includes("VENTE") || act.type.includes("SORTIE") ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-500"}`}>
                               {act.type.charAt(0)}
                            </div>
                            <div>
                               <p className="font-black text-slate-800 text-sm">{act.designation}</p>
                               <p className="text-[10px] font-bold text-slate-400 uppercase">{act.type.replace(/_/g, ' ')} • {new Date(act.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className={`font-black ${act.type.includes("VENTE") || act.type.includes("SORTIE") ? "text-rose-500" : "text-emerald-500"}`}>
                               {act.type.includes("VENTE") || act.type.includes("SORTIE") ? "-" : "+"}{Math.abs(act.quantite)}
                            </p>
                         </div>
                      </div>
                   ))}
                </div>
             )}
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[40px] p-8 shadow-2xl overflow-hidden relative group min-h-[400px]">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black text-white mb-1">Performance du Stock</h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Sorties sur 7 jours</p>
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                <TrendingUp size={20} className="text-indigo-400" />
              </div>
            </div>
            
            <div className="flex-1 w-full">
              {loading ? (
                 <div className="w-full h-full flex items-center justify-center opacity-20">
                    <Database size={48} className="text-white animate-pulse" />
                 </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={(data?.chartData || []).map((val, i) => ({
                      name: ['J-6','J-5','J-4','J-3','J-2','Hier','Auj.'][i],
                      value: val
                    }))}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4f46e5" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.05)', radius: 12 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                              <p className="text-lg font-black text-slate-900">{payload[0].value} <span className="text-xs text-slate-400">Unités</span></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[10, 10, 0, 0]} 
                      fill="url(#barGradient)"
                      barSize={40}
                    >
                      {(data?.chartData || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} className="hover:brightness-125 transition-all duration-300" />
                      ))}
                    </Bar>
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
