"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/context";
import {
  Shield,
  Search,
  Save,
  Check,
  X,
  ChevronRight,
  Loader2,
  Users,
  ShoppingCart,
  Package,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
  UserCog,
  Store,
  Banknote,
  Sparkles,
  Lock,
  Unlock,
  Crown,
  CheckCheck,
  RefreshCw,
  Car,
  Home,
  Waves,
  ShieldCheck,
  Zap,
  Sliders,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
type Role = {
  id: number;
  role_name: string;
  description: string | null;
};

type Permission = {
  id: number;
  permission_key: string;
  description: string;
};

type GroupedPerms = Record<string, Permission[]>;
type RolePermMap = Record<number, number[]>;
type RoleCounts = Record<number, number>;

/* ═══════════════════════════════════════════════════════════════════
   CATEGORY ICONS & COLORS
   ═══════════════════════════════════════════════════════════════════ */
const CATEGORY_META: Record<string, { icon: any; gradient: string; shadow: string; accent: string }> = {
  "Ventes & Facturation": { icon: ShoppingCart, gradient: "linear-gradient(135deg, #6366f1, #818cf8)", shadow: "rgba(99,102,241,0.25)", accent: "#6366f1" },
  "Gestion de Stock": { icon: Package, gradient: "linear-gradient(135deg, #10b981, #34d399)", shadow: "rgba(16,185,129,0.25)", accent: "#10b981" },
  "Clients & Crédits": { icon: Users, gradient: "linear-gradient(135deg, #3b82f6, #60a5fa)", shadow: "rgba(59,130,246,0.25)", accent: "#3b82f6" },
  "Fournisseurs & Achats": { icon: CreditCard, gradient: "linear-gradient(135deg, #f59e0b, #fbbf24)", shadow: "rgba(245,158,11,0.25)", accent: "#f59e0b" },
  "Dépenses & Caisse": { icon: Wallet, gradient: "linear-gradient(135deg, #ef4444, #f87171)", shadow: "rgba(239,68,68,0.25)", accent: "#ef4444" },
  "Rapports & Statistiques": { icon: BarChart3, gradient: "linear-gradient(135deg, #8b5cf6, #a78bfa)", shadow: "rgba(139,92,246,0.25)", accent: "#8b5cf6" },
  "Administration & Paramètres": { icon: Settings, gradient: "linear-gradient(135deg, #64748b, #94a3b8)", shadow: "rgba(100,116,139,0.25)", accent: "#64748b" },
  "Utilisateurs & Profils": { icon: UserCog, gradient: "linear-gradient(135deg, #ec4899, #f472b6)", shadow: "rgba(236,72,153,0.25)", accent: "#ec4899" },
  "Point de Vente (POS)": { icon: Store, gradient: "linear-gradient(135deg, #14b8a6, #2dd4bf)", shadow: "rgba(20,184,166,0.25)", accent: "#14b8a6" },
  "Acomptes & Avances": { icon: Banknote, gradient: "linear-gradient(135deg, #f97316, #fb923c)", shadow: "rgba(249,115,22,0.25)", accent: "#f97316" },
  "Gestion Parc & Véhicules": { icon: Car, gradient: "linear-gradient(135deg, #6366f1, #a5b4fc)", shadow: "rgba(99,102,241,0.25)", accent: "#6366f1" },
  "Gestion des Loyers": { icon: Home, gradient: "linear-gradient(135deg, #10b981, #6ee7b7)", shadow: "rgba(16,185,129,0.25)", accent: "#10b981" },
  "Gestion du Ciment": { icon: Waves, gradient: "linear-gradient(135deg, #0ea5e9, #7dd3fc)", shadow: "rgba(14,165,233,0.25)", accent: "#0ea5e9" },
  "Autres": { icon: Shield, gradient: "linear-gradient(135deg, #475569, #64748b)", shadow: "rgba(71,85,105,0.25)", accent: "#475569" },
};

const DEFAULT_META = { icon: Shield, gradient: "linear-gradient(135deg, #475569, #64748b)", shadow: "rgba(71,85,105,0.25)", accent: "#475569" };

export default function PermissionsPage() {
  const { t, locale, dir } = useLanguage();
  const [roles, setRoles] = useState<Role[]>([]);
  const [grouped, setGrouped] = useState<GroupedPerms>({});
  const [rolePerms, setRolePerms] = useState<RolePermMap>({});
  const [roleCounts, setRoleCounts] = useState<RoleCounts>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [activePerms, setActivePerms] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/permissions");
      if (!res.ok) throw new Error("Erreur de chargement");
      const json = await res.json();

      setRoles(json.roles || []);
      setGrouped(json.grouped || {});
      setRolePerms(json.role_permissions || {});
      setRoleCounts(json.role_counts || {});

      if (json.roles && json.roles.length > 0) {
        const firstRole = json.roles[0];
        setSelectedRoleId(firstRole.id);
        const permsForFirst = json.role_permissions?.[firstRole.id] || [];
        setActivePerms(new Set(permsForFirst));
      }
    } catch (err: any) {
      setToast({ message: err.message || "Erreur de connexion", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectRole = (roleId: number) => {
    setSelectedRoleId(roleId);
    const perms = rolePerms[roleId] || [];
    setActivePerms(new Set(perms));
    setHasChanges(false);
  };

  const togglePermission = (permId: number) => {
    setActivePerms((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) {
        next.delete(permId);
      } else {
        next.add(permId);
      }
      return next;
    });
    setHasChanges(true);
  };

  const toggleAllCategory = (perms: Permission[], enable: boolean) => {
    setActivePerms((prev) => {
      const next = new Set(prev);
      perms.forEach((p) => {
        if (enable) next.add(p.id);
        else next.delete(p.id);
      });
      return next;
    });
    setHasChanges(true);
  };

  const toggleAll = (enable: boolean) => {
    if (enable) {
      const allIds = Object.values(grouped).flatMap((list) => list.map((p) => p.id));
      setActivePerms(new Set(allIds));
    } else {
      setActivePerms(new Set());
    }
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    try {
      setSaving(true);
      const res = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: selectedRoleId,
          permission_ids: Array.from(activePerms),
        }),
      });

      if (!res.ok) throw new Error("Échec de l'enregistrement");
      const result = await res.json();

      setRolePerms((prev) => ({
        ...prev,
        [selectedRoleId]: Array.from(activePerms),
      }));
      setHasChanges(false);
      setToast({
        message: locale === "ar" ? "تم تحديث الصلاحيات بنجاح!" : "Permissions enregistrées avec succès !",
        type: "success",
      });
    } catch (err: any) {
      setToast({ message: err.message || "Erreur de sauvegarde", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const totalPermCount = useMemo(() => {
    return Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
  }, [grouped]);

  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase();
    const result: GroupedPerms = {};
    for (const [cat, perms] of Object.entries(grouped)) {
      const matches = perms.filter(
        (p) =>
          p.permission_key.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q)
      );
      if (matches.length > 0) {
        result[cat] = matches;
      }
    }
    return result;
  }, [grouped, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        <p className="text-xs font-bold text-slate-500">
          {locale === "ar" ? "جاري تحميل مصفوفة الصلاحيات..." : "Chargement de la matrice de sécurité..."}
        </p>
      </div>
    );
  }

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
            <CheckCheck size={20} className="text-emerald-400" />
          ) : (
            <X size={20} className="text-rose-400" />
          )}
          <span className="text-xs font-black">{toast.message}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <ShieldCheck size={14} />
                ENTERPRISE RBAC MATRIX
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                {totalPermCount} {locale === "ar" ? "صلاحية دقيقة" : "Points de Contrôle"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "مركز التحكم في الصلاحيات والأمان (RBAC)" : "Centre de Contrôle des Accès"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "تخصيص الصلاحيات والأدوار للموظفين والكاشيرية بدقة متناهية لحماية بيانات الشركة"
                : "Gouvernance granulaire des privilèges et matrice d'accès par rôle utilisateur"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={15} />
              <span>{locale === "ar" ? "تحديث" : "Actualiser"}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`px-6 py-3 rounded-2xl text-white font-black text-xs shadow-xl transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                hasChanges
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/25 animate-pulse"
                  : "bg-indigo-600"
              }`}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{locale === "ar" ? "حفظ التغييرات" : "Enregistrer la Matrice"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Roles List (Left) + Permissions Matrix (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Roles (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                {locale === "ar" ? "الأدوار المتاحة" : "Rôles Système"}
              </h2>
              <span className="text-xs font-extrabold text-slate-400">
                {roles.length} {locale === "ar" ? "أدوار" : "profils"}
              </span>
            </div>

            <div className="space-y-2">
              {roles.map((r) => {
                const isSelected = r.id === selectedRoleId;
                const assignedCount = isSelected ? activePerms.size : (rolePerms[r.id] || []).length;
                const percent = totalPermCount > 0 ? Math.round((assignedCount / totalPermCount) * 100) : 0;

                return (
                  <button
                    key={r.id}
                    onClick={() => selectRole(r.id)}
                    className={`w-full p-4 rounded-2xl text-left transition-all cursor-pointer border flex items-center justify-between ${
                      isSelected
                        ? "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-300 shadow-sm"
                        : "bg-slate-50/60 border-slate-200/70 hover:bg-slate-100/70"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        {r.role_name.toLowerCase().includes("admin") ? (
                          <Crown size={15} className="text-amber-500" />
                        ) : (
                          <Shield size={15} className="text-indigo-600" />
                        )}
                        <span className="text-xs font-black text-slate-900">{r.role_name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-[200px] truncate">
                        {r.description || (locale === "ar" ? "صلاحيات مخصصة" : "Rôle d'exploitation")}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-indigo-600">{percent}%</span>
                      <div className="w-12 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Permission Cards Matrix (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Quick Actions & Search Toolbar */}
          <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={
                  locale === "ar" ? "بحث عن صلاحية أو ميزة..." : "Filtrer les permissions (POS, Vente, Stock...)"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleAll(true)}
                className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCheck size={14} />
                <span>{locale === "ar" ? "تفعيل الكل" : "Tout Cocher"}</span>
              </button>

              <button
                onClick={() => toggleAll(false)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <X size={14} />
                <span>{locale === "ar" ? "إلغاء الكل" : "Tout Décocher"}</span>
              </button>
            </div>
          </div>

          {/* Grouped Permission Accordions */}
          <div className="space-y-4">
            {Object.keys(filteredGrouped).length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-200">
                <Search size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold">
                  {locale === "ar" ? "لا توجد صلاحيات مطابقة للبحث." : "Aucune permission trouvée."}
                </p>
              </div>
            ) : (
              Object.entries(filteredGrouped).map(([category, perms]) => {
                const meta = CATEGORY_META[category] || DEFAULT_META;
                const Icon = meta.icon;
                const activeCount = perms.filter((p) => activePerms.has(p.id)).length;
                const isAllActive = activeCount === perms.length;

                return (
                  <div
                    key={category}
                    className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4"
                  >
                    {/* Category Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md"
                          style={{ background: meta.gradient }}
                        >
                          <Icon size={18} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900">{category}</h3>
                          <span className="text-[11px] font-bold text-slate-400">
                            {activeCount} / {perms.length} {locale === "ar" ? "مفعلة" : "autorisées"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleAllCategory(perms, !isAllActive)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isAllActive
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {isAllActive
                          ? locale === "ar"
                            ? "إلغاء تفعيل الفئة"
                            : "Désactiver le groupe"
                          : locale === "ar"
                          ? "تفعيل الفئة كاملة"
                          : "Activer le groupe"}
                      </button>
                    </div>

                    {/* Permissions Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {perms.map((p) => {
                        const active = activePerms.has(p.id);

                        return (
                          <div
                            key={p.id}
                            onClick={() => togglePermission(p.id)}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              active
                                ? "bg-indigo-50/60 border-indigo-200 shadow-xs"
                                : "bg-slate-50/40 border-slate-200/60 hover:bg-slate-100/60"
                            }`}
                          >
                            <div className="pr-3">
                              <div className="text-xs font-black text-slate-900">{p.description}</div>
                              <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                                {p.permission_key}
                              </div>
                            </div>

                            <div
                              className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                                active
                                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                                  : "bg-slate-200 text-slate-400"
                              }`}
                            >
                              {active && <Check size={14} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
