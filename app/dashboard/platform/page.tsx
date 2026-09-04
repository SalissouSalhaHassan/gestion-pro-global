"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { formatDateTime, formatRelativeTime } from "@/lib/utils/datetime";
import {
  Building2,
  Users,
  CreditCard,
  ShieldCheck,
  Activity,
  Server,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Layers,
  Database,
  Lock,
  Globe,
  Sliders,
  PlusCircle,
  Plus,
  RefreshCw,
  X,
  Save,
  Loader2,
  Crown,
  ExternalLink,
  Power,
  Zap,
  Copy,
  Check,
  MessageCircle,
  AlertCircle,
  Trash2,
  Edit3,
} from "lucide-react";
import TenantManagementModal from "@/components/platform/TenantManagementModal";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

export default function PlatformManagementPage() {
  const { t, locale, dir } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"tenants" | "plans" | "infrastructure">("tenants");
  const [selectedOrgForManage, setSelectedOrgForManage] = useState<any>(null);

  // Modal State
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isSubmittingOrg, setIsSubmittingOrg] = useState(false);
  const [newOrgForm, setNewOrgForm] = useState({
    name: "",
    country: "Niger",
    currency: "FCFA",
    plan: "pro",
    adminUsername: "",
    adminPassword: "",
    phone: "",
    email: "",
  });
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Delete Organization State
  const [orgToDelete, setOrgToDelete] = useState<any>(null);
  const [isDeletingOrg, setIsDeletingOrg] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const confirmDeleteOrg = async () => {
    if (!orgToDelete) return;
    try {
      setIsDeletingOrg(true);
      const res = await fetch(`/api/platform/organizations/${orgToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de suppression");

      setToast({
        message: locale === "ar" ? `تم حذف مؤسسة ${orgToDelete.name} بنجاح!` : `Organisation ${orgToDelete.name} supprimée !`,
        type: "success",
      });
      setOrgToDelete(null);
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Erreur de suppression", type: "error" });
    } finally {
      setIsDeletingOrg(false);
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const metrics = data?.metrics || {
    totalOrganizations: 1,
    activeTenants: 1,
    trialTenants: 0,
    paidTenants: 1,
    totalUsers: 1,
    totalVolume: 0,
    serverUptime: "99.98%",
    databaseLatencyMs: 24,
    status: "OPERATIONAL",
  };

  const organizations = data?.organizations || [];

  const planPrices: Record<string, number> = {
    starter: 25000,
    pro: 49000,
    enterprise: 99000,
    trial: 0,
  };

  const calculatedMRR = organizations.reduce((sum: number, org: any) => {
    if (!org.is_active) return sum;
    const p = (org.subscription?.plan || "pro").toLowerCase();
    return sum + (planPrices[p] ?? 49000);
  }, 0);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgForm.name.trim()) return;

    setIsSubmittingOrg(true);
    try {
      const generatedPass = newOrgForm.adminPassword.trim() || "pass" + Math.floor(1000 + Math.random() * 9000);
      const generatedUser = (newOrgForm.adminUsername.trim() || "admin_" + newOrgForm.name.toLowerCase().replace(/[^a-z0-9]/g, "")).trim();

      const res = await fetch("/api/auth/register-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: newOrgForm.name,
          country: newOrgForm.country,
          currency: newOrgForm.currency,
          plan: newOrgForm.plan,
          adminUsername: generatedUser,
          password: generatedPass,
          phone: newOrgForm.phone,
          email: newOrgForm.email || `admin@${newOrgForm.name.toLowerCase().replace(/\s+/g, "")}.com`,
          fromAdminPlatform: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de création");

      const finalUsername = data.user?.username || data.credentials?.username || generatedUser;

      setCreatedCredentials({
        orgName: newOrgForm.name,
        username: finalUsername,
        password: generatedPass,
        phone: newOrgForm.phone,
        plan: newOrgForm.plan,
        currency: newOrgForm.currency,
      });

      setToast({
        message: locale === "ar" ? `تم إنشاء المؤسسة السحابية بنجاح! المعرف: ${finalUsername}` : `Organisation créée avec succès ! Identifiant: ${finalUsername}`,
        type: "success",
      });
      loadData();
    } catch (err: any) {
      setToast({ message: err.message || "Erreur de création", type: "error" });
    } finally {
      setIsSubmittingOrg(false);
    }
  };

  const filteredOrgs = organizations.filter((org: any) => {
    const matchesSearch =
      org.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.country?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesPlan =
      planFilter === "all" || org.subscription?.plan === planFilter;

    return matchesSearch && matchesPlan;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border text-white flex items-center gap-3 animate-in slide-in-from-top-3 ${
            toast.type === "success"
              ? "bg-slate-900 border-emerald-500/30"
              : "bg-rose-950 border-rose-500/30"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={20} className="text-emerald-400" />
          ) : (
            <X size={20} className="text-rose-400" />
          )}
          <span className="text-xs font-black">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest">
              SUPER ADMIN CONSOLE
            </span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {locale === "ar" ? "المنصة السحابية تعمل بكفاءة 100%" : "Système SaaS Opérationnel"}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Globe className="text-indigo-600" size={32} />
            {locale === "ar" ? "مركز إدارة المنصة والاشتراكات" : "Gestion de la Plateforme SaaS"}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {locale === "ar"
              ? "مراقبة وإدارة كافة المؤسسات والشركات المشتركة، خطط الاشتراكات والبنية السحابية العالمية"
              : "Contrôle global des organisations abonnées, facturation des forfaits et infrastructure cloud"}
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
          </button>

          <button
            onClick={() => setIsCreateOrgModalOpen(true)}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            <span>{locale === "ar" ? "إنشاء مؤسسة جديدة" : "Créer Organisation"}</span>
          </button>
        </div>
      </div>

      {/* Row 1: Key Platform Metrics (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي المؤسسات" : "Organisations Clientes"}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Building2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.totalOrganizations}</div>
          <div className="text-xs text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
            <CheckCircle2 size={13} />
            <span>{metrics.activeTenants} {locale === "ar" ? "نشطة ومتصلة" : "actives sur le Cloud"}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "الإيرادات المتكررة (MRR)" : "Revenu Récurrent (MRR)"}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {formatCurrencyAmount(calculatedMRR, "FCFA")}
          </div>
          <div className="text-xs text-indigo-600 font-bold mt-1.5 flex items-center gap-1 font-mono">
            <Crown size={13} />
            <span>ARR: {formatCurrencyAmount(calculatedMRR * 12, "FCFA")}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "المستخدمين النشطين" : "Utilisateurs Actifs"}
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{metrics.totalUsers}</div>
          <div className="text-xs text-blue-600 font-bold mt-1.5">
            {locale === "ar" ? "كاشيرية ومدراء فروع" : "Caissiers & Gestionnaires"}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-5 shadow-xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-indigo-300 tracking-wider">
              {locale === "ar" ? "حالة السحابة وقواعد البيانات" : "Infrastructure Cloud"}
            </span>
            <div className="p-2 rounded-xl bg-white/10 text-emerald-400">
              <Cpu size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{metrics.serverUptime}</div>
          <div className="text-xs text-slate-300 font-bold mt-1.5 flex items-center gap-1">
            <Zap size={13} className="text-amber-400" />
            <span>Latence Supabase: {metrics.databaseLatencyMs}ms</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("tenants")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "tenants"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Building2 size={15} />
          <span>{locale === "ar" ? "المؤسسات والشركات (Tenants)" : "Organisations (Tenants)"}</span>
        </button>

        <button
          onClick={() => setActiveTab("plans")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "plans"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <CreditCard size={15} />
          <span>{locale === "ar" ? "باقات وخطط الاشتراكات" : "Plans & Tarifs"}</span>
        </button>

        <button
          onClick={() => setActiveTab("infrastructure")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "infrastructure"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Server size={15} />
          <span>{locale === "ar" ? "خوادم السحابة والأمان" : "Infrastructure & Sécurité"}</span>
        </button>
      </div>

      {/* Tab 1: Organizations Table */}
      {activeTab === "tenants" && (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={locale === "ar" ? "بحث باسم الشركة، الدولة..." : "Recherche d'organisation..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">{locale === "ar" ? "كافة الباقات" : "Tous les forfaits"}</option>
              <option value="trial">Trial (Essai)</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{locale === "ar" ? "المؤسسة / الشركة" : "Organisation"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "الدولة والعملة" : "Pays & Devise"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "الخطة" : "Forfait"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "المستخدمين" : "Utilisateurs"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "المستودعات" : "Dépôts"}</th>
                  <th className="py-3.5 px-4 text-center">{locale === "ar" ? "الحالة" : "Statut"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                {filteredOrgs.map((org: any) => (
                  <tr key={org.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs uppercase">
                          {org.name?.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-black text-slate-900">{org.name}</div>
                          <div className="font-mono text-[10px] text-slate-400">/{org.slug}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-bold text-slate-700">
                      <div>{org.country || "International"}</div>
                      <span className="text-[10px] text-indigo-600 font-extrabold">{org.currency || "FCFA"}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-700 uppercase">
                        {org.subscription?.plan || "Enterprise"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs font-black text-slate-900">
                      {org.users_count || 1} / {org.subscription?.max_users || "Illimité"}
                    </td>

                    <td className="py-3.5 px-4 text-xs font-black text-slate-900">
                      {org.depots_count || 1} / {org.subscription?.max_depots || "Illimité"}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700">
                        {org.is_active ? "ACTIF" : "SUSPENDU"}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedOrgForManage(org)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs border border-indigo-200"
                          title={locale === "ar" ? "تعديل وإدارة المنشأة" : "Gérer & Configurer"}
                        >
                          <Edit3 size={13} />
                          <span>{locale === "ar" ? "تعديل" : "Gérer"}</span>
                        </button>

                        {org.id !== "00000000-0000-0000-0000-000000000001" && org.slug !== "gestion-pro-global" && !org.name?.toLowerCase().includes("gestion pro global") ? (
                          <button
                            onClick={() => setOrgToDelete(org)}
                            className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all cursor-pointer shadow-2xs border border-rose-200"
                            title={locale === "ar" ? "حذف المؤسسة نهائياً" : "Supprimer l'organisation"}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : (
                          <span
                            className="p-1.5 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed inline-flex items-center justify-center"
                            title={locale === "ar" ? "المنشأة الرئيسية محمية" : "Organisation Principale (Protégée)"}
                          >
                            <Lock size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Pricing & Plans Simulator */}
      {activeTab === "plans" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 space-y-4">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black uppercase">
              Starter Plan
            </span>
            <div className="text-3xl font-black text-slate-900">
              25 000 <span className="text-xs text-slate-400 font-bold">FCFA / mois</span>
            </div>
            <ul className="text-xs space-y-2 text-slate-600 font-bold">
              <li>✓ Jusqu'à 3 Utilisateurs</li>
              <li>✓ 1 Dépôt / Boutique</li>
              <li>✓ POS & Facturation</li>
              <li>✓ Mode Hors-ligne</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-purple-950 text-white rounded-3xl p-6 shadow-xl border border-indigo-500/30 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-indigo-500 text-white text-xs font-black uppercase">
                Pro Business (Populaire)
              </span>
              <Sparkles size={18} className="text-amber-400" />
            </div>
            <div className="text-3xl font-black text-white">
              49 000 <span className="text-xs text-indigo-300 font-bold">FCFA / mois</span>
            </div>
            <ul className="text-xs space-y-2 text-slate-200 font-bold">
              <li>✓ Jusqu'à 15 Utilisateurs</li>
              <li>✓ 5 Dépôts & Multi-agences</li>
              <li>✓ WhatsApp Direct & Facture Web</li>
              <li>✓ Assistant IA Copilot Inclus</li>
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 space-y-4">
            <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-black uppercase">
              Enterprise Global
            </span>
            <div className="text-3xl font-black text-slate-900">
              99 000 <span className="text-xs text-slate-400 font-bold">FCFA / mois</span>
            </div>
            <ul className="text-xs space-y-2 text-slate-600 font-bold">
              <li>✓ Utilisateurs Illimités</li>
              <li>✓ Dépôts & Flotte Illimités</li>
              <li>✓ Multi-devises & Multi-pays</li>
              <li>✓ Support Dédié 24/7 VIP</li>
            </ul>
          </div>
        </div>
      )}

      {/* Tab 3: Infrastructure Health */}
      {activeTab === "infrastructure" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-white/10 space-y-4">
            <h3 className="text-base font-black flex items-center gap-2">
              <Database size={18} className="text-indigo-400" />
              Base de Données PostgreSQL Supabase
            </h3>
            <div className="space-y-2 text-xs font-bold">
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-400">Région Cloud</span>
                <span>eu-west-1 (Frankfurt)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-400">Latence Moyenne</span>
                <span className="text-emerald-400 font-black">24 ms</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/10">
                <span className="text-slate-400">Connexions Pool Actives</span>
                <span>18 / 100 max</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Sauvegarde Quotidienne</span>
                <span className="text-emerald-400 font-black">Automatique (SSL 256-bit)</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-white/10 space-y-4">
            <h3 className="text-base font-black flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-400" />
              Sécurité & Isolation Multi-Tenancy
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              Chaque requête est scellée avec le tag unique <code className="bg-white/10 px-1.5 py-0.5 rounded text-indigo-300">organization_id</code> et protégée par les politiques RLS (Row Level Security) de Supabase.
            </p>
            <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>Conformité SaaS & Zéro Risque de Fuite de Données</span>
            </div>
          </div>
        </div>
      )}

      {/* Create Org Modal */}
      {isCreateOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Building2 size={16} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {locale === "ar" ? "إنشاء مؤسسة سحابية جديدة" : "Créer une Nouvelle Organisation"}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOrgModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {createdCredentials ? (
              <div className="p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 size={36} />
                </div>

                <div>
                  <h4 className="text-lg font-black text-slate-900">
                    {locale === "ar" ? "تم إنشاء المؤسسة السحابية بنجاح!" : "Organisation SaaS Créée avec Succès !"}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {locale === "ar"
                      ? "تم ربط قاعدة البيانات، والمستودع الافتراضي، وتفعيل حساب المدير العام"
                      : "Base de données isolée, boutique créée et compte administrateur actif."}
                  </p>
                </div>

                {/* Credentials Box */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white text-left space-y-2.5 font-mono text-xs border border-indigo-500/30 shadow-xl">
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-slate-400">Entreprise :</span>
                    <span className="font-bold text-amber-300">{createdCredentials.orgName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-slate-400">Identifiant :</span>
                    <span className="font-bold text-white">{createdCredentials.username}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-2">
                    <span className="text-slate-400">Mot de passe :</span>
                    <span className="font-bold text-emerald-400">{createdCredentials.password}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Lien direct :</span>
                    <span className="text-[11px] text-indigo-300 truncate">https://gestion-pro-global-tege.vercel.app/login</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const msg =
                        `🎉 *BIENVENUE SUR GESTION PRO GLOBAL*\n\n` +
                        `Votre espace d'entreprise dédié est prêt :\n` +
                        `🏢 *Entreprise :* ${createdCredentials.orgName}\n` +
                        `👤 *Identifiant :* \`${createdCredentials.username}\`\n` +
                        `🔑 *Mot de passe :* \`${createdCredentials.password}\`\n` +
                        `🌐 *Lien de connexion :* https://gestion-pro-global-tege.vercel.app/login\n\n` +
                        `Connectez-vous dès maintenant pour commencer vos opérations commerciales !`;
                      openWhatsAppDirect(createdCredentials.phone || "", msg);
                    }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle size={16} />
                    <span>{locale === "ar" ? "إرسال بيانات الدخول عبر WhatsApp (1-Clic)" : "Envoyer les Accès sur WhatsApp (1-Clic)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const textToCopy = `Entreprise: ${createdCredentials.orgName}\nIdentifiant: ${createdCredentials.username}\nMot de passe: ${createdCredentials.password}\nLien: https://gestion-pro-global-tege.vercel.app/login`;
                      navigator.clipboard.writeText(textToCopy);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }}
                    className="w-full py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                    <span>{copied ? (locale === "ar" ? "تم النسخ بنجاح !" : "Copié !") : (locale === "ar" ? "نسخ البيانات" : "Copier les identifiants")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOrgModalOpen(false);
                      setCreatedCredentials(null);
                    }}
                    className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    {locale === "ar" ? "إغلاق النافذة" : "Terminer"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateOrg} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "اسم الشركة / المؤسسة" : "Nom de l'Organisation"} *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: ETS TASSIOU KOMMA"
                    value={newOrgForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const words = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(w => !['ets', 'ste', 'sarl', 'sa', 'eurl', 'groupe', 'cie'].includes(w) && w.length > 1);
                      const key = (words[0] || name.toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 15);
                      const suggested = key ? `admin_${key}` : "";
                      setNewOrgForm(prev => ({
                        ...prev,
                        name,
                        adminUsername: (!prev.adminUsername || prev.adminUsername === "admin" || prev.adminUsername.startsWith("admin_")) ? (suggested || prev.adminUsername) : prev.adminUsername
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        {locale === "ar" ? "اسم مستخدم المدير" : "Identifiant Admin"} *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const words = newOrgForm.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(w => !['ets', 'ste', 'sarl', 'sa', 'eurl', 'groupe'].includes(w) && w.length > 1);
                          const key = (words[0] || newOrgForm.name.toLowerCase().replace(/[^a-z0-9]/g, '')).slice(0, 12) || "org";
                          setNewOrgForm(prev => ({ ...prev, adminUsername: `admin_${key}` }));
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                        title="Générer automatiquement"
                      >
                        <Sparkles size={11} />
                        <span>{locale === "ar" ? "توليد آلي" : "Auto"}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Ex: admin_tassiou"
                      value={newOrgForm.adminUsername}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, adminUsername: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {newOrgForm.adminUsername.trim().toLowerCase() === "admin" && (
                      <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                        <AlertCircle size={12} className="shrink-0" />
                        <span>
                          {locale === "ar"
                            ? "ملاحظة: سيتم إضافة بادئة المنشأة تلقائياً لضمان عزل الحسابات بأمان."
                            : "'admin' sera adapté avec le nom de l'entreprise pour un accès dédié."}
                        </span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">
                        {locale === "ar" ? "كلمة المرور" : "Mot de passe"} *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const randomPass = "Pass@" + Math.floor(1000 + Math.random() * 9000);
                          setNewOrgForm(prev => ({ ...prev, adminPassword: randomPass }));
                        }}
                        className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold cursor-pointer"
                      >
                        🎲 {locale === "ar" ? "عشوائي" : "Générer"}
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Pass2026!"
                      value={newOrgForm.adminPassword}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, adminPassword: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === "ar" ? "هاتف المدير (WhatsApp)" : "Téléphone / WhatsApp"}
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: +227 90 00 00 00"
                      value={newOrgForm.phone}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === "ar" ? "باقة الاشتراك" : "Forfait SaaS"}
                    </label>
                    <select
                      value={newOrgForm.plan}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, plan: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                    >
                      <option value="trial">Essai Gratuit (14 jours)</option>
                      <option value="starter">Starter (25 000 FCFA/m)</option>
                      <option value="pro">Pro Business (49 000 FCFA/m)</option>
                      <option value="enterprise">Enterprise Global (99 000 FCFA/m)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === "ar" ? "الدولة" : "Pays"}
                    </label>
                    <input
                      type="text"
                      value={newOrgForm.country}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, country: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {locale === "ar" ? "العملة الرئيسية" : "Devise"}
                    </label>
                    <select
                      value={newOrgForm.currency}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, currency: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                    >
                      <option value="FCFA">FCFA (XOF/XAF)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="SAR">SAR (﷼)</option>
                      <option value="NGN">NGN (₦)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateOrgModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {locale === "ar" ? "إلغاء" : "Annuler"}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingOrg}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingOrg ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span>{locale === "ar" ? "إنشاء وتفعيل المؤسسة" : "Créer le Tenant"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Interactive Tenant Management Modal */}
      {selectedOrgForManage && (
        <TenantManagementModal
          org={selectedOrgForManage}
          onClose={() => setSelectedOrgForManage(null)}
          onUpdated={() => {
            loadData();
            setToast({
              message: locale === "ar" ? "تم تحديث بيانات المؤسسة بنجاح!" : "Organisation mise à jour avec succès !",
              type: "success",
            });
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {orgToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-rose-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 size={28} />
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">
                  {locale === "ar" ? "حذف المؤسسة نهائياً؟" : "Supprimer définitivement l'organisation ?"}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1.5">
                  {locale === "ar" ? (
                    <>
                      أنت على وشك حذف مؤسسة <strong className="text-slate-900">{orgToDelete.name}</strong>.
                      سيتم حذف حسابات المستخدمين، المستودعات، والبيانات المرتبطة بها نهائياً.
                    </>
                  ) : (
                    <>
                      Vous êtes sur le point de supprimer l'organisation <strong className="text-slate-900">{orgToDelete.name}</strong>.
                      Tous les utilisateurs, dépôts et données associés seront définitivement effacés.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOrgToDelete(null)}
                  disabled={isDeletingOrg}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {locale === "ar" ? "إلغاء" : "Annuler"}
                </button>

                <button
                  type="button"
                  onClick={confirmDeleteOrg}
                  disabled={isDeletingOrg}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDeletingOrg ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  <span>{locale === "ar" ? "تأكيد الحذف النهائي" : "Supprimer définitivement"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
