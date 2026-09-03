"use client";

import { useState } from "react";
import { X, Plus, Trash2, Truck, User, Phone, MapPin, DollarSign, Loader2 } from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";

type NewRunModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

type PackageItem = {
  client_nom: string;
  client_tel: string;
  adresse_livraison: string;
  montant_a_encaisser: number;
};

export default function NewRunModal({ onClose, onCreated }: NewRunModalProps) {
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [zone, setZone] = useState("");
  const [notes, setNotes] = useState("");
  const [packages, setPackages] = useState<PackageItem[]>([
    { client_nom: "", client_tel: "", adresse_livraison: "", montant_a_encaisser: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const addPackage = () => {
    setPackages([
      ...packages,
      { client_nom: "", client_tel: "", adresse_livraison: "", montant_a_encaisser: 0 },
    ]);
  };

  const removePackage = (idx: number) => {
    if (packages.length <= 1) return;
    setPackages(packages.filter((_, i) => i !== idx));
  };

  const updatePackage = (idx: number, field: keyof PackageItem, val: any) => {
    const updated = [...packages];
    updated[idx] = { ...updated[idx], [field]: val };
    setPackages(updated);
  };

  const totalMontantCOD = packages.reduce((sum, p) => sum + (Number(p.montant_a_encaisser) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverName.trim()) {
      alert("Veuillez saisir le nom du chauffeur");
      return;
    }

    const validPackages = packages.filter((p) => p.client_nom.trim() && p.adresse_livraison.trim());
    if (validPackages.length === 0) {
      alert("Veuillez ajouter au moins un colis avec le nom du client et l'adresse.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chauffeur_nom: driverName,
          chauffeur_tel: driverPhone,
          vehicule_matricule: vehicle,
          zone_livraison: zone,
          notes,
          colis: validPackages,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la création");
      }

      onCreated();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white">
              <Truck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Nouvelle Tournée de Livraison
              </h3>
              <p className="text-[11px] text-slate-400">
                Attribuez un chauffeur, un véhicule et des colis à livrer
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Driver & Vehicle Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                Nom du Chauffeur / Livreur *
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Ex: Ibrahim Ousmane"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                Téléphone / WhatsApp Chauffeur
              </label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ex: +227 90 00 00 00"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                Véhicule / Tricycle / Plaque
              </label>
              <div className="relative">
                <Truck size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ex: Moto Tricycle #04 / RN-8842"
                  value={vehicle}
                  onChange={(e) => setVehicle(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                Zone de Distribution
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ex: Katako, Grand Marché, Wadata"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Packages / Destinations List */}
          <div className="space-y-3 border-t border-slate-100 pt-5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-2">
                <span>Colis & Points de Livraison</span>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-mono text-[10px]">
                  {packages.length}
                </span>
              </h4>
              <button
                type="button"
                onClick={addPackage}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Ajouter un Colis</span>
              </button>
            </div>

            <div className="space-y-3">
              {packages.map((pkg, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500 font-mono">
                      Colis #{idx + 1}
                    </span>
                    {packages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePackage(idx)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Nom du Client / Destinataire *"
                      value={pkg.client_nom}
                      onChange={(e) => updatePackage(idx, "client_nom", e.target.value)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                    />

                    <input
                      type="text"
                      placeholder="Tél Destinataire (WhatsApp)"
                      value={pkg.client_tel}
                      onChange={(e) => updatePackage(idx, "client_tel", e.target.value)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
                    />

                    <input
                      type="text"
                      required
                      placeholder="Adresse exacte de livraison *"
                      value={pkg.adresse_livraison}
                      onChange={(e) => updatePackage(idx, "adresse_livraison", e.target.value)}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white sm:col-span-2"
                    />

                    <div className="relative sm:col-span-2">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-black text-slate-400">
                        Montant à encaisser (COD) :
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={pkg.montant_a_encaisser || ""}
                        onChange={(e) => updatePackage(idx, "montant_a_encaisser", Number(e.target.value))}
                        placeholder="0 FCFA si déjà payé"
                        className="w-full pl-44 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total COD Summary */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs font-bold text-amber-950">
              <span>Total Montant à Encaisser (Contre-Remboursement) :</span>
              <span className="text-sm font-black font-mono text-amber-700">
                {formatCurrencyAmount(totalMontantCOD, "FCFA")}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
              <span>Créer la Tournée</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
