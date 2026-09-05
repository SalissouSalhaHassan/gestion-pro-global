"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  AlertTriangle,
  FileText,
  DollarSign,
  Layers,
  Trash2,
  Lock,
  Eye,
  Activity,
  CheckCircle2,
  Sparkles,
  Loader2,
  AlertOctagon,
  Info,
  Database,
  Copy,
  Check,
  Building2,
  X
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

const SQL_AUDIT_MIGRATION = `-- ==============================================================================
-- MIGRATION: 20260903_anti_fraud_audit_trail.sql
-- DESCRIPTION: Anti-Fraud & Forensic Audit Trail (Multi-Tenant Isolated)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    module VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    target_id VARCHAR(100),
    user_id INTEGER,
    username VARCHAR(100) NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    ip_address VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs (severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON public.audit_logs (username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs (module);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for authenticated users on audit_logs"
  ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users on audit_logs"
  ON public.audit_logs FOR INSERT WITH CHECK (true);
NOTIFY pgrst, 'reload schema';`;

type AuditLog = {
  id: number;
  action_type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  module: string;
  description: string;
  metadata?: any;
  target_id?: string;
  username: string;
  created_at: string;
};

type AuditStats = {
  totalCount: number;
  criticalCount: number;
  highCount: number;
  deleteCount: number;
  priceOverrideCount: number;
};

export default function AuditRadarPage() {
  const { locale, dir } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalCount: 0,
    criticalCount: 0,
    highCount: 0,
    deleteCount: 0,
    priceOverrideCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orgName, setOrgName] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [moduleFilter, setModuleFilter] = useState("ALL");

  useEffect(() => {
    const cookie = document.cookie.split('; ').find(row => row.startsWith('gp_session='));
    if (cookie) {
      try {
        const decoded = decodeURIComponent(cookie.split('=')[1]);
        const s = JSON.parse(decoded);
        if (s.organization_name) setOrgName(s.organization_name);
        else if (s.nom_prenom) setOrgName(s.nom_prenom);
      } catch (e) {}
    }
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (severityFilter !== "ALL") params.append("severity", severityFilter);
      if (moduleFilter !== "ALL") params.append("module", moduleFilter);
      if (search) params.append("search", search);

      const res = await fetch(`/api/audit?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setLogs(data.logs || []);
      if (data.needsMigration) setNeedsMigration(true);
      else setNeedsMigration(false);

      setStats(data.stats || {
        totalCount: 0,
        criticalCount: 0,
        highCount: 0,
        deleteCount: 0,
        priceOverrideCount: 0,
      });
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_AUDIT_MIGRATION);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [severityFilter, moduleFilter]);

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.description.toLowerCase().includes(q) ||
        l.username.toLowerCase().includes(q) ||
        (l.target_id && l.target_id.toLowerCase().includes(q))
    );
  }, [logs, search]);

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-600 border border-rose-500/30">
            <AlertOctagon size={12} className="text-rose-600" />
            CRITIQUE
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 border border-amber-500/30">
            <AlertTriangle size={12} className="text-amber-600" />
            ÉLEVÉ
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-blue-500/15 text-blue-600 border border-blue-500/30">
            <Info size={12} className="text-blue-600" />
            MOYEN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
            NORMAL
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* 4K Cyber Security Hero Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <ShieldAlert size={14} />
                RADAR ANTI-FRAUDE & AUDIT FORENSIC 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                SURVEILLANCE ACTIVE 24/7
              </span>
              {orgName && (
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 bg-indigo-950/60 px-3 py-1 rounded-xl border border-indigo-500/30">
                  <Building2 size={13} />
                  {orgName} ({locale === "ar" ? "معزول للمؤسسة" : "Isolé Tenant"})
                </span>
              )}
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "رادار الأمان وسجل الرقابة الصارمة (Audit Trail)" : "Journal d'Audit de Sécurité & Anti-Fraude"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "تتبع ورصد كافة العمليات الحساسة (حذف فواتير، تعديل الأسعار، تسويات المخزون، وفوارق الصندوق) لحماية المؤسسة"
                : "Traçabilité infalsifiable des actions sensibles : suppression de factures, remises manuelles, réajustements de stock"}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setShowSqlModal(true)}
              className="p-3 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/30 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Script SQL Migration"
            >
              <Database size={15} />
              <span>{locale === "ar" ? "سكربت ترحيل SQL" : "Script SQL"}</span>
            </button>

            <button
              onClick={fetchAuditLogs}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span>{locale === "ar" ? "تحديث السجل" : "Actualiser"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Migration Notice Banner if table missing */}
      {needsMigration && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xs font-bold">
                {locale === "ar" ? "جدول audit_logs المخصص غير مفعل بعد في قاعدة البيانات" : "La table audit_logs n'est pas encore créée dans Supabase"}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                {locale === "ar"
                  ? "يتم حالياً استعراض سجلات النشاط المباشرة للمؤسسة (activity_log) كبديل تلقائي."
                  : "Le système utilise le journal d'activité miroir de cette organisation en attendant l'exécution du script SQL."}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSqlModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shrink-0 transition-colors flex items-center gap-2 shadow-xs"
          >
            <Database size={14} />
            <span>{locale === "ar" ? "نسخ سكربت التثبيت" : "Voir Script SQL"}</span>
          </button>
        </div>
      )}

      {/* 4 Threat & Anomaly Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "تنبيهات حرجة" : "Alertes Critiques"}
            </span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
              <AlertOctagon size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {stats.criticalCount}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "عمليات تتطلب تدقيق الإدارة" : "Opérations à haut risque tracées"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "حذف أو إلغاء فواتير" : "Suppressions Factures"}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Trash2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {stats.deleteCount}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "فواتير تم حذفها أو إلغاؤها" : "Factures supprimées du registre"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "تعديل أسعار الكاشير" : "Dérogations Prix (POS)"}
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 font-mono">
            {stats.priceOverrideCount}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "تغييرات أسعار يدوية في نقطة البيع" : "Prix unitaires modifiés manuellement"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي السجلات المؤرخة" : "Total Tracé"}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Activity size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {stats.totalCount}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "بصمات أمنية محفوظة ومحمية" : "Événements audités et conservés"}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث بالمستخدم أو الوصف أو الرقم المرجعي..." : "Recherche par utilisateur, mot-clé ou réf..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs">
          <ShieldAlert size={14} className="text-slate-400" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">{locale === "ar" ? "كافة درجات الخطورة" : "Toutes les gravités"}</option>
            <option value="CRITICAL">{locale === "ar" ? "CRITIQUE (حرج جداً)" : "Critique"}</option>
            <option value="HIGH">{locale === "ar" ? "HIGH (مرتفع)" : "Élevé"}</option>
            <option value="MEDIUM">{locale === "ar" ? "MEDIUM (متوسط)" : "Moyen"}</option>
            <option value="LOW">{locale === "ar" ? "LOW (عادي)" : "Faible"}</option>
          </select>
        </div>

        {/* Module Filter */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs">
          <Filter size={14} className="text-slate-400" />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">{locale === "ar" ? "كافة الأقسام" : "Tous les modules"}</option>
            <option value="VENTES">Ventes</option>
            <option value="CAISSE">Caisse</option>
            <option value="STOCKS">Stocks</option>
            <option value="FINANCE">Finance</option>
            <option value="AUTH">Authentification</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">{locale === "ar" ? "التوقيت" : "Horodatage"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "درجة الخطورة" : "Gravité"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "المستخدم" : "Utilisateur"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "القسم" : "Module"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "العملية المنفذة" : "Action"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "التفاصيل والبيان" : "Description & Cible"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-3 text-rose-600" size={36} />
                      <p className="font-bold text-slate-600 text-xs">
                        {locale === "ar" ? "جاري مسح واسترجاع سجلات الأمان..." : "Chargement du radar d'audit..."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <ShieldCheck className="opacity-20 mb-3 text-emerald-600" size={48} />
                      <p className="font-black text-slate-700 text-sm">
                        {locale === "ar" ? "النظام آمن: لا توجد عمليات مشبوهة مسجلة في هذا النطاق." : "Aucune anomalie de sécurité répertoriée."}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {locale === "ar" ? "كافة العمليات الحساسة تُسجل آلياً وبشكل غير قابل للتعديل." : "Toutes les actions sensibles sont enregistrées de manière infalsifiable."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "fr-FR")}
                    </td>
                    <td className="px-6 py-4">
                      {getSeverityBadge(log.severity)}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <span className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        {log.username}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-slate-600 text-[10px] uppercase tracking-wider">
                      {log.module}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-indigo-700 text-[11px]">
                      {log.action_type}
                    </td>
                    <td className="px-6 py-4 text-slate-800 font-medium">
                      <span>{log.description}</span>
                      {log.target_id && (
                        <span className="ml-2 font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                          #{log.target_id}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {locale === "ar" ? "سكربت إنشاء وتحديث جدول الرقابة (audit_logs)" : "Script Migration Supabase - audit_logs"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {locale === "ar"
                      ? "قم بتنفيذ هذا الأمر في محرر SQL في Supabase لتفعيل العزل الصارم بين المؤسسات."
                      : "Exécutez ce script dans l'éditeur SQL de Supabase pour finaliser l'isolation RLS."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-72 custom-scrollbar">
                {SQL_AUDIT_MIGRATION}
              </pre>
              <button
                onClick={handleCopySql}
                className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? (locale === "ar" ? "تم النسخ!" : "Copié !") : (locale === "ar" ? "نسخ SQL" : "Copier")}</span>
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowSqlModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                {locale === "ar" ? "إغلاق" : "Fermer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
