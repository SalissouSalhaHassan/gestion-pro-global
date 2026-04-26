"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Lock,
  Unlock,
  Crown,
  CheckCheck,
  RefreshCw,
  Car,
  Home,
  Waves
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

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function PermissionsPage() {
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
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  /* ─── Fetch Data ─── */
  const fetchData = useCallback(async (isRetryAfterSeed = false) => {
    setLoading(true);
    try {
      const res = await fetch("/api/permissions");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Auto-seed if tables are empty (first time)
      if (!isRetryAfterSeed && (!data.roles || data.roles.length === 0)) {
        setToast({ message: "Initialisation des rôles et permissions...", type: "success" });
        try {
          const seedRes = await fetch("/api/permissions/seed", { method: "POST" });
          const seedData = await seedRes.json();
          if (seedData.seeded) {
            // Reload data after seeding
            return fetchData(true);
          }
        } catch (seedErr) {
          console.error("Seed failed:", seedErr);
        }
      }

      setRoles(data.roles || []);
      setGrouped(data.groupedPermissions || {});
      setRolePerms(data.rolePermissions || {});
      setRoleCounts(data.roleCounts || {});
    } catch (err: any) {
      setToast({ message: `Erreur: ${err.message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Role Selection ─── */
  const selectRole = (roleId: number) => {
    setSelectedRoleId(roleId);
    const permsForRole = rolePerms[roleId] || [];
    setActivePerms(new Set(permsForRole));
    setHasChanges(false);
    setSearchQuery("");
  };

  /* ─── Toggle Permission ─── */
  const togglePerm = (permId: number) => {
    setActivePerms((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
    setHasChanges(true);
  };

  /* ─── Toggle Category ─── */
  const toggleCategory = (perms: Permission[]) => {
    const allActive = perms.every((p) => activePerms.has(p.id));
    setActivePerms((prev) => {
      const next = new Set(prev);
      for (const p of perms) {
        if (allActive) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
    setHasChanges(true);
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: selectedRoleId,
          permission_ids: Array.from(activePerms),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update local cache
      setRolePerms((prev) => ({ ...prev, [selectedRoleId]: Array.from(activePerms) }));
      setHasChanges(false);
      setToast({ message: "Permissions sauvegardées avec succès !", type: "success" });
    } catch (err: any) {
      setToast({ message: `Erreur: ${err.message}`, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  /* ─── Stats ─── */
  const totalPermissions = useMemo(() => Object.values(grouped).flat().length, [grouped]);
  const activeCount = activePerms.size;
  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  /* ─── Filtered Groups ─── */
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase();
    const result: GroupedPerms = {};
    for (const [cat, perms] of Object.entries(grouped)) {
      const filtered = perms.filter(
        (p) => p.description.toLowerCase().includes(q) || p.permission_key.toLowerCase().includes(q) || cat.toLowerCase().includes(q)
      );
      if (filtered.length > 0) result[cat] = filtered;
    }
    return result;
  }, [grouped, searchQuery]);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-[calc(100vh-5rem)] gap-0 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-2xl text-white font-bold shadow-2xl flex items-center gap-3 animate-in slide-in-from-right duration-300 ${toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"}`}>
          {toast.type === "success" ? <Check size={20} /> : <X size={20} />}
          {toast.message}
        </div>
      )}

      {/* ════════════ LEFT PANEL: ROLES ════════════ */}
      <div className="w-80 flex-shrink-0 bg-white/70 backdrop-blur-2xl border-r border-slate-100 flex flex-col rounded-l-[32px] overflow-hidden shadow-xl shadow-slate-200/30">
        
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100/80">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-2xl" style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Rôles</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{roles.length} rôles configurés</p>
            </div>
          </div>
        </div>

        {/* Roles List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
            ))
          ) : (
            roles.map((role) => {
              const isSelected = selectedRoleId === role.id;
              const count = roleCounts[role.id] || 0;
              const permCount = (rolePerms[role.id] || []).length;
              return (
                <button
                  key={role.id}
                  onClick={() => selectRole(role.id)}
                  className={`w-full text-left p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                    isSelected
                      ? "text-white shadow-xl shadow-indigo-500/30 scale-[1.02]"
                      : "bg-white hover:bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:shadow-md"
                  }`}
                  style={isSelected ? { background: "linear-gradient(135deg, #4f46e5, #7c3aed)" } : undefined}
                >
                  {isSelected && (
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                  )}
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${isSelected ? "bg-white/20" : "bg-indigo-50"}`}>
                        <Crown size={18} className={isSelected ? "text-white" : "text-indigo-500"} />
                      </div>
                      <div>
                        <div className={`font-black text-sm tracking-tight ${isSelected ? "text-white" : "text-slate-800"}`}>
                          {role.role_name}
                        </div>
                        <div className={`text-[10px] font-bold ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                          {count} utilisateur{count !== 1 ? "s" : ""} · {permCount} accès
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className={`transition-transform ${isSelected ? "text-white translate-x-1" : "text-slate-300 group-hover:translate-x-1"}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Sync & Save Buttons */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          <button
            onClick={async () => {
              setLoading(true);
              try {
                const res = await fetch("/api/permissions/seed", { method: "POST" });
                const data = await res.json();
                if (data.success) {
                  setToast({ message: "Synchronisation réussie !", type: "success" });
                  fetchData();
                }
              } catch (e) {
                setToast({ message: "Échec de synchronisation", type: "error" });
              } finally {
                setLoading(false);
              }
            }}
            className="w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Synchroniser les Permissions
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges || saving || !selectedRoleId}
            className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-xl"
            style={{
              background: hasChanges ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #94a3b8, #cbd5e1)",
              boxShadow: hasChanges ? "0 12px 30px rgba(16,185,129,0.3)" : "none",
            }}
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {saving ? "Sauvegarde..." : hasChanges ? "Sauvegarder" : "Aucun changement"}
          </button>
        </div>
      </div>

      {/* ════════════ RIGHT PANEL: PERMISSIONS ════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Bar */}
        <div className="px-8 py-5 border-b border-slate-100 bg-white/50 backdrop-blur-xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Lock size={24} className="text-indigo-500" />
              {selectedRole ? `Accès : ${selectedRole.role_name}` : "Centre de Contrôle des Accès"}
            </h1>
            <p className="text-sm text-slate-400 font-medium mt-0.5">
              {selectedRole
                ? `${activeCount} / ${totalPermissions} permissions activées`
                : "Sélectionnez un rôle pour configurer ses permissions"}
            </p>
          </div>
          
          {/* Search */}
          <div className="relative w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Filtrer les permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Progress Bar */}
        {selectedRoleId && (
          <div className="px-8 py-3 bg-slate-50/50 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Niveau d'accès</span>
              <span className="text-[10px] font-black text-indigo-600 uppercase">
                {totalPermissions > 0 ? Math.round((activeCount / totalPermissions) * 100) : 0}%
              </span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${totalPermissions > 0 ? (activeCount / totalPermissions) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #4f46e5, #7c3aed, #a855f7)",
                }}
              />
            </div>
          </div>
        )}

        {/* Permissions Grid */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
              <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Chargement des permissions...</p>
            </div>
          ) : !selectedRoleId ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-6 rounded-[32px] bg-indigo-50 mb-6">
                <Unlock size={48} className="text-indigo-300" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Contrôle d'Accès</h3>
              <p className="text-slate-400 font-medium max-w-md">
                Sélectionnez un rôle dans le panneau de gauche pour consulter et modifier ses permissions d'accès au système.
              </p>
            </div>
          ) : (
            Object.entries(filteredGroups).map(([category, perms]) => {
              const meta = CATEGORY_META[category] || DEFAULT_META;
              const Icon = meta.icon;
              const allActive = perms.every((p) => activePerms.has(p.id));
              const someActive = perms.some((p) => activePerms.has(p.id));
              const activeInCat = perms.filter((p) => activePerms.has(p.id)).length;

              return (
                <div
                  key={category}
                  className="rounded-[28px] border border-slate-100 bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-100/50 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50 group/card"
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
                    <div className="flex items-center gap-4">
                      <div
                        className="p-3 rounded-2xl text-white shadow-lg"
                        style={{ background: meta.gradient, boxShadow: `0 8px 20px ${meta.shadow}` }}
                      >
                        <Icon size={20} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 tracking-tight">{category}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {activeInCat} / {perms.length} activées
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleCategory(perms)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        allActive
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100"
                          : "bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100"
                      }`}
                    >
                      <CheckCheck size={14} />
                      {allActive ? "Tout désélect." : "Tout sélect."}
                    </button>
                  </div>

                  {/* Permissions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    {perms.map((p, idx) => {
                      const isActive = activePerms.has(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePerm(p.id)}
                          className={`flex items-center justify-between px-6 py-4 text-left transition-all duration-200 border-b border-r border-slate-50 last:border-b-0 group/item ${
                            isActive
                              ? "bg-gradient-to-r from-emerald-50/50 to-transparent hover:from-emerald-50"
                              : "hover:bg-slate-50/80"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                                isActive
                                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                                  : "bg-slate-100 text-slate-300 group-hover/item:bg-slate-200 group-hover/item:text-slate-400"
                              }`}
                            >
                              {isActive ? <Check size={18} strokeWidth={3} /> : <Lock size={14} />}
                            </div>
                            <div className="min-w-0">
                              <span className={`text-sm font-bold block truncate ${isActive ? "text-slate-800" : "text-slate-500"}`}>
                                {p.description}
                              </span>
                              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest truncate block">
                                {p.permission_key}
                              </span>
                            </div>
                          </div>
                          <div className={`flex-shrink-0 transition-all duration-300 ${isActive ? "text-emerald-500" : "text-slate-200"}`}>
                            {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}

          {selectedRoleId && Object.keys(filteredGroups).length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search size={40} className="text-slate-200 mb-4" />
              <p className="font-black text-slate-400">Aucune permission ne correspond à "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.08);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
}
