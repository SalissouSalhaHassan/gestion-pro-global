"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, TrendingUp, Wallet, Users, Home, Printer, Loader2,
  Calendar, PieChart as PieChartIcon, BarChart3, Download, Search, X,
  Filter, AlertCircle, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function LoyerReportsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [detailedReport, setDetailedReport] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingDetailed, setLoadingDetailed] = useState(true);

  // Stats Filters (Charts)
  const [fStartDate, setFStartDate] = useState("");
  const [fEndDate, setFEndDate] = useState("");

  // Detailed Report Filters
  const [fYear, setFYear] = useState(new Date().getFullYear().toString());
  const [fMonth, setFMonth] = useState((new Date().getMonth() + 1).toString());
  const [fStatus, setFStatus] = useState("All"); // All, Paid, Unpaid

  const fetchStats = async () => {
    setLoadingStats(true);
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
      setLoadingStats(false);
    }
  };

  const fetchDetailedReport = async () => {
    setLoadingDetailed(true);
    try {
      const params = new URLSearchParams();
      params.set("year", fYear);
      params.set("month", fMonth);
      params.set("status", fStatus);
      const res = await fetch(`/api/loyers/reports/detailed?${params.toString()}`);
      const data = await res.json();
      setDetailedReport(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch detailed report", error);
    } finally {
      setLoadingDetailed(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDetailedReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyDetailedFilters = () => {
    fetchDetailedReport();
  };

  if (loadingStats && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        <p className="text-slate-500 font-bold animate-pulse text-lg">Préparation du tableau de bord...</p>
      </div>
    );
  }

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
          <Button onClick={() => window.open('/api/loyers/print/report', '_blank')} className="rounded-2xl h-12 px-6 font-black bg-[#0f172a] hover:bg-slate-800 shadow-xl transition-all hover:scale-105 active:scale-95">
            <Printer size={18} className="mr-2" /> Imprimer Rapport Complet
          </Button>
        </div>
      </div>

      {/* Stats KPI Cards */}
      {stats && (
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
      )}

      {/* Detailed Report Section */}
      <div className="bg-white rounded-[40px] p-8 shadow-xl border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="w-2 h-8 bg-rose-500 rounded-full" />
            Rapport Détaillé des Impayés
          </h3>
          
          {/* Detailed Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <Button 
              onClick={() => window.open(`/api/loyers/print/detailed-report?year=${fYear}&month=${fMonth}&status=${fStatus}`, '_blank')}
              className="bg-white text-rose-600 border border-rose-100 hover:bg-rose-50 rounded-xl h-9 px-4 font-black text-xs shadow-sm mr-2"
            >
              <Printer size={14} className="mr-2" /> Imprimer Ce Rapport
            </Button>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2 px-3">
              <span className="text-[10px] font-black text-slate-400 uppercase">Année</span>
              <Select value={fYear} onValueChange={setFYear}>
                <SelectTrigger className="w-24 h-9 border-none bg-transparent font-black text-sm focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["2024", "2025", "2026", "2027"].map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2 px-3">
              <span className="text-[10px] font-black text-slate-400 uppercase">Mois</span>
              <Select value={fMonth} onValueChange={setFMonth}>
                <SelectTrigger className="w-32 h-9 border-none bg-transparent font-black text-sm focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}).map((_, i) => (
                    <SelectItem key={i+1} value={(i+1).toString()}>
                      {new Date(2024, i).toLocaleString('fr-FR', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div className="flex items-center gap-2 px-3">
              <span className="text-[10px] font-black text-slate-400 uppercase">État</span>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="w-32 h-9 border-none bg-transparent font-black text-sm focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Tous</SelectItem>
                  <SelectItem value="Paid">Payés</SelectItem>
                  <SelectItem value="Unpaid">Impayés</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleApplyDetailedFilters} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-9 px-4 font-black text-xs">
              Appliquer
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-slate-100">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Locataire / Réf</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Loyer Mensuel</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Total Payé</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-rose-600">Retards (F)</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-rose-600">Mois Impayés</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-indigo-600">Année</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-indigo-600">État</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest text-indigo-600">Échéance</th>
                <th className="px-6 py-4 font-black uppercase text-[10px] tracking-widest">Statut</th>
              </tr>
            </thead>
            <tbody>
              {loadingDetailed ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-500" />
                  </td>
                </tr>
              ) : detailedReport.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-400 font-bold">Aucune donnée trouvée pour cette période.</td>
                </tr>
              ) : (
                detailedReport.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900">{row.locataire}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.ref}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">{fmt(row.loyer)} F</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{fmt(row.total_paye)} F</td>
                    <td className={`px-6 py-4 font-black ${row.retards > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                      {fmt(row.retards)} F
                    </td>
                    <td className="px-6 py-4">
                      {row.mois_impayes !== 'À jour' ? (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-black text-[10px] uppercase">
                          <AlertCircle size={12} /> {row.mois_impayes}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-black text-[10px] uppercase">
                          <CheckCircle2 size={12} /> À jour
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-700">{row.annee}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        row.etat === 'Payé' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {row.etat}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-700">{row.echeance}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        row.statut_contrat === 'Actif' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {row.statut_contrat}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Income Chart */}
        <div className="bg-[#0f172a] rounded-[40px] p-8 shadow-2xl relative overflow-hidden border border-white/5">
          <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 relative z-10">
            <div className="w-2 h-8 bg-indigo-500 rounded-full" />
            Évolution des Revenus (12 mois)
          </h3>
          <div className="h-[350px] w-full relative z-10">
            {stats && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff' }}
                    itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
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
              {stats && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.modeRevenue} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value">
                      {stats.modeRevenue.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              {stats?.modeRevenue.map((item: any, i: number) => (
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
      
      {/* Footer Info */}
      <div className="text-center">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">GestionPro Analytique • {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
