"use client";

import { useState } from "react";
import {
  X,
  Building2,
  ShieldCheck,
  CreditCard,
  Calendar,
  Users,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Save,
  Power,
  Sparkles,
  Loader2
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

type TenantManagementModalProps = {
  org: any;
  onClose: () => void;
  onUpdated: () => void;
};

export default function TenantManagementModal({ org, onClose, onUpdated }: TenantManagementModalProps) {
  const [isActive, setIsActive] = useState<boolean>(org.is_active ?? true);
  const [plan, setPlan] = useState<string>(org.subscription?.plan || "pro");
  const [maxUsers, setMaxUsers] = useState<number>(org.subscription?.max_users || 15);
  const [maxDepots, setMaxDepots] = useState<number>(org.subscription?.max_depots || 5);
  const [phone, setPhone] = useState<string>(org.phone || "");
  const [extendDays, setExtendDays] = useState<number>(30);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch(`/api/platform/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_active: isActive,
          plan,
          max_users: maxUsers,
          max_depots: maxDepots,
          phone,
          extend_days: extendDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de mise à jour");

      onUpdated();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendWhatsApp = () => {
    const msg =
      `🌐 *GESTION PRO GLOBAL - COMPTE SAAS ACTIVÉ*\n\n` +
      `Organisation : *${org.name}*\n` +
      `Forfait : *${plan.toUpperCase()}*\n` +
      `Statut : *${isActive ? "✅ ACTIF & OPÉRATIONNEL" : "⏸️ SUSPENDU"}*\n` +
      `Validité Prolongée : *+${extendDays} jours*\n` +
      `Quotas : *${maxUsers} Utilisateurs* • *${maxDepots} Dépôts*\n\n` +
      `Accédez à votre espace en ligne : https://gestion-pro-global-tege.vercel.app/dashboard\n\n` +
      `Merci de faire confiance à Gestion Pro Global !`;

    openWhatsAppDirect(phone || org.phone || "", msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm uppercase">
              {org.name?.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  {org.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {isActive ? "ACTIF" : "SUSPENDU"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                /{org.slug} • {org.country || "International"} • {org.currency || "FCFA"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Status Toggle Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Power size={14} className={isActive ? "text-emerald-600" : "text-rose-600"} />
                État d'Accès à l'Application
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                {isActive
                  ? "L'organisation et tous ses caissiers peuvent se connecter normalement."
                  : "Accès bloqué. Les utilisateurs verront un écran de suspension d'abonnement."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                isActive
                  ? "bg-rose-100 hover:bg-rose-200 text-rose-700 border border-rose-300"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isActive ? "Suspendre l'accès" : "Réactiver l'accès"}
            </button>
          </div>

          {/* Subscription Plan & Extension */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
              <CreditCard size={15} className="text-indigo-600" />
              <span>Forfait & Abonnement SaaS</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                  Plan Actuel
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="trial">Essai Gratuit (Trial)</option>
                  <option value="starter">Starter (25 000 FCFA/m)</option>
                  <option value="pro">Pro Business (49 000 FCFA/m)</option>
                  <option value="enterprise">Enterprise Global (99 000 FCFA/m)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                  Prolonger la Validité
                </label>
                <select
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value={30}>+ 30 jours (1 Mois)</option>
                  <option value={90}>+ 90 jours (3 Mois - Trimestre)</option>
                  <option value={180}>+ 180 jours (6 Mois)</option>
                  <option value={365}>+ 365 jours (1 An - Annuel)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Limits & Quotas */}
          <div className="space-y-4 border-t border-slate-100 pt-4">
            <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
              <Users size={15} className="text-indigo-600" />
              <span>Quotas et Limites Techniques</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                  Utilisateurs Max
                </label>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                  Dépôts / Magasins Max
                </label>
                <input
                  type="number"
                  min="1"
                  max="9999"
                  value={maxDepots}
                  onChange={(e) => setMaxDepots(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-mono font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* WhatsApp Direct Notification */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <label className="text-[11px] font-black uppercase text-slate-600 block">
              Contact WhatsApp du Client
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ex: +227 90 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800"
              />
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <MessageCircle size={15} />
                <span>Notifier sur WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Enregistrer Modifications</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
