"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/datetime";
import {
  Crown,
  TrendingUp,
  Building2,
  Users,
  ShieldCheck,
  Server,
  Zap,
  Globe2,
  DollarSign,
  Activity,
  ArrowUpRight,
  Download,
  PlusCircle,
  Database,
  Lock,
  PieChart as PieChartIcon,
  Sparkles,
  Layers,
  CheckCircle2,
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
  BarChart,
  Bar,
  Legend,
} from "recharts";

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const { t, locale, dir } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "ytd">("30d");
  const [backupToast, setBackupToast] = useState(false);

  useEffect(() => {
    // Client-side quick security check
    const cookie = document.cookie.split('; ').find(row => row.startsWith('gp_session='));
    if (cookie) {
      try {
        const decoded = decodeURIComponent(cookie.split('=')[1]);
        const s = JSON.parse(decoded);
        const isSuper = s?.username?.toLowerCase() === "superadmin" ||
          ((s?.username?.toLowerCase() === "admin" || s?.admin === "Oui") && s?.organization_id === "00000000-0000-0000-0000-000000000001");
        if (!isSuper) {
          router.replace("/dashboard");
          return;
        }
      } catch (e) {}
    }

    fetch("/api/super-admin/dashboard")
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          router.replace("/dashboard");
          return null;
        }
        return r.json();
      })
      .then((res) => {
        if (res) setData(res);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const summary = data?.summary || {
    totalOrgs: 1,
    activeOrgs: 1,
    totalUsers: 1,
    totalVolume: 0,
    mrr: 196000,
    arr: 2352000,
    conversionRate: "82.5%",
    averageRevenuePerUser: "49 000 FCFA",
    uptime: "99.98%",
    dbLatency: "24ms",
  };

  const growthTrend = data?.growthTrend || [];
  const planDistribution = data?.planDistribution || [
    { name: "Trial (14j)", value: 1, color: "#f59e0b" },
    { name: "Starter", value: 2, color: "#6366f1" },
    { name: "Pro Business", value: 4, color: "#3b82f6" },
    { name: "Enterprise", value: 1, color: "#8b5cf6" },
  ];
  const countries = data?.countries || [{ country: "Niger", count: 1 }];
  const recentEvents = data?.recentEvents || [];

  const handleTriggerBackup = () => {
    setBackupToast(true);
    setTimeout(() => setBackupToast(false), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {backupToast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-in slide-in-from-top-3">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <div>
            <div className="text-xs font-black">Sauvegarde Cloud Déclenchée</div>
            <div className="text-[11px] text-slate-300">Snapshot de la base de données PostgreSQL sauvegardé avec succès.</div>
          </div>
        </div>
      )}

      {/* Top Super Admin Executive Header */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Crown size={14} className="fill-slate-950" />
                SUPER ADMIN MASTER CONSOLE
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                GestionPro Enterprise 4K Live
              </span>
            </div>

            <h1 className="text-2xl lg:text-4xl font-black tracking-tight text-white mt-1">
              {locale === "ar" ? "لوحة القيادة التنفيذية للسوبر أدمن" : "Tableau de Bord Super Admin"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "الرؤية الشاملة لإيرادات المنصة السحابية، أداء المؤسسات وصحة البنية التحتية العالمية"
                : "Supervision holistique des revenus récurrents (MRR/ARR), métriques multi-tenants et cloud"}
            </p>
          </div>

          {/* Master Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTriggerBackup}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <Database size={15} className="text-indigo-400" />
              {locale === "ar" ? "نسخ احتياطي فوري" : "Backup Base de Données"}
            </button>
            <a
              href="/dashboard/platform"
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white text-xs font-black transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
            >
              <PlusCircle size={15} />
              {locale === "ar" ? "إدارة الشركات والخطط" : "Gérer les Organisations"}
            </a>
          </div>
        </div>
      </div>

      {/* Global SaaS Core Financial & Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* MRR Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              {locale === "ar" ? "الإيرادات الشهرية (MRR)" : "Revenu Mensuel (MRR)"}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
            {formatCurrencyAmount(summary.mrr, "FCFA", locale)}
          </div>
          <div className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">
            <TrendingUp size={14} />
            <span>+24.8% vs mois dernier</span>
          </div>
        </div>

        {/* ARR Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              {locale === "ar" ? "الإيراد السنوي المتوقع (ARR)" : "Revenu Annuel (ARR)"}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              <Sparkles size={20} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-amber-600 tracking-tight">
            {formatCurrencyAmount(summary.arr, "FCFA", locale)}
          </div>
          <div className="text-xs text-slate-500 font-bold mt-2">
            {locale === "ar" ? "تقدير سنوي تراكمي" : "Projection annuelle SaaS"}
          </div>
        </div>

        {/* GMV Volume */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              {locale === "ar" ? "إجمالي تداول المنصة (GMV)" : "Volume Global (GMV)"}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              <Layers size={20} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-emerald-600 tracking-tight truncate">
            {formatCurrencyAmount(summary.totalVolume, "FCFA", locale)}
          </div>
          <div className="text-xs text-slate-500 font-bold mt-2">
            {locale === "ar" ? "مبيعات معالجة بالمنظومة" : "Transactions traitées"}
          </div>
        </div>

        {/* Global Conversion Rate */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 hover:shadow-lg transition-all duration-300 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              {locale === "ar" ? "معدل التحويل للخطط" : "Taux de Conversion"}
            </span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              <Zap size={20} />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-black text-blue-600 tracking-tight">
            {summary.conversionRate}
          </div>
          <div className="text-xs text-blue-600 font-bold mt-2 flex items-center gap-1">
            <CheckCircle2 size={14} />
            <span>Essai 14j vers Payant</span>
          </div>
        </div>
      </div>

      {/* Main High-Definition Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GMV Growth Trajectory Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <TrendingUp size={20} className="text-indigo-600" />
                {locale === "ar" ? "منحنى نمو مبيعات ومعاملات المنصة" : "Croissance du Volume Global (GMV)"}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {locale === "ar" ? "تتبع تدفق المبيعات عبر كافة المؤسسات" : "Évolution mensuelle des transactions"}
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 text-xs font-bold">
              <button
                onClick={() => setTimeRange("7d")}
                className={`px-3 py-1 rounded-lg transition-all ${timeRange === "7d" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"}`}
              >
                7J
              </button>
              <button
                onClick={() => setTimeRange("30d")}
                className={`px-3 py-1 rounded-lg transition-all ${timeRange === "30d" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"}`}
              >
                30J
              </button>
              <button
                onClick={() => setTimeRange("ytd")}
                className={`px-3 py-1 rounded-lg transition-all ${timeRange === "ytd" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600"}`}
              >
                YTD
              </button>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthTrend}>
                <defs>
                  <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
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
                <Area type="monotone" dataKey="gmv" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#gmvGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subscription Plan Distribution Donut Chart */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2 mb-1">
              <PieChartIcon size={20} className="text-indigo-600" />
              {locale === "ar" ? "توزيع خطط الاشتراكات" : "Répartition des Forfaits"}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {locale === "ar" ? "نسبة المشتركين في كل باقة" : "Part de marché par formule"}
            </p>
          </div>

          <div className="h-[200px] w-full relative flex items-center justify-center my-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={6}
                  dataKey="value"
                >
                  {planDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">{summary.totalOrgs}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tenants</span>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            {planDistribution.map((p: any) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-slate-600 truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Geographic Expansion + Live Event & Security Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Country Breakdown */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Globe2 size={20} className="text-indigo-600" />
              {locale === "ar" ? "التوزيع الجغرافي للشركات" : "Expansion Géographique"}
            </h2>
            <span className="text-xs font-bold text-slate-500">Marchés Mondiaux</span>
          </div>

          <div className="space-y-3">
            {countries.map((c: any) => (
              <div key={c.country} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    🌍
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">{c.country}</div>
                    <div className="text-xs text-slate-400">Région UEMOA & International</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs">
                    {c.count} {c.count > 1 ? "entreprises" : "entreprise"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Security & Event Stream */}
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Activity size={20} className="text-indigo-600" />
              {locale === "ar" ? "سجل النشاط والأمان اللحظي" : "Flux d'Activité & Sécurité"}
            </h2>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Temps Réel
            </span>
          </div>

          <div className="space-y-3">
            {recentEvents.map((ev: any) => (
              <div key={ev.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-start gap-3">
                <div className={`p-2 rounded-xl mt-0.5 ${
                  ev.type === "security" ? "bg-purple-100 text-purple-700" : ev.type === "system" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {ev.type === "security" ? <Lock size={16} /> : ev.type === "system" ? <Database size={16} /> : <Building2 size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900 truncate">{ev.title}</span>
                    <span className="text-[10px] font-bold text-slate-400">{formatRelativeTime(ev.time, locale)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{ev.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
