"use client";

import { useState } from "react";
import { X, Target, Save, DollarSign, Percent, Award, Loader2 } from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";

type TargetSettingModalProps = {
  seller: any;
  month: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function TargetSettingModal({ seller, month, onClose, onSaved }: TargetSettingModalProps) {
  const [targetCA, setTargetCA] = useState<number>(seller.objectifCA || 2500000);
  const [rate, setRate] = useState<number>(seller.tauxCommission || 2.0);
  const [bonus, setBonus] = useState<number>(seller.primeBonus || 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: seller.userId,
          mois_annee: month,
          objectif_ca: targetCA,
          taux_commission: rate,
          prime_bonus_atteinte: bonus,
        }),
      });

      if (!res.ok) throw new Error("Erreur lors de l'enregistrement");
      onSaved();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500 text-slate-950">
              <Target size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Objectif & Taux de Commission
              </h3>
              <p className="text-[11px] text-slate-400 font-bold">{seller.nom} ({month})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
              Objectif Chiffre d'Affaires Mensuel (FCFA)
            </label>
            <div className="relative">
              <DollarSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="0"
                step="50000"
                required
                value={targetCA}
                onChange={(e) => setTargetCA(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
              Taux de Commission sur Ventes (%)
            </label>
            <div className="relative">
              <Percent size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                required
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
              Prime de Performance si 100% Atteint (FCFA)
            </label>
            <div className="relative">
              <Award size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min="0"
                step="10000"
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value))}
                placeholder="Ex: 50 000 FCFA"
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-medium">
            💡 Pour <span className="font-bold">{formatCurrencyAmount(targetCA, "FCFA")}</span> vendus à {rate}%, la commission sera de <span className="font-bold text-amber-700">{formatCurrencyAmount(Math.round(targetCA * rate / 100) + bonus, "FCFA")}</span>.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-600"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shadow-md flex items-center gap-1.5"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Enregistrer Objectif</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
