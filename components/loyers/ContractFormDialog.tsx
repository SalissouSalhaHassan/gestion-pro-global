"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Home, Wallet, Save, X } from "lucide-react";
import type { Contract } from "@/lib/services/loyer.service";

const Field = ({ label, dataKey, form, onChange, required, type = "text", colSpan = false }: { label: string; dataKey: string; form: Record<string, string>; onChange: (key: string, value: string) => void; required?: boolean; type?: string; colSpan?: boolean }) => (
  <div className={colSpan ? "md:col-span-2" : ""}>
    <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
      {label} {required && <span className="text-rose-500">*</span>}
    </Label>
    <Input
      type={type}
      value={form[dataKey] || ""}
      onChange={(e) => onChange(dataKey, e.target.value)}
      className="h-11 bg-white/60 border-slate-200/80 rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all font-medium"
    />
  </div>
);

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  contractId?: number | null;
};

const emptyForm = {
  locataire_nom_complet: "",
  ref_locataire: "",
  locataire_telephone: "",
  locataire_email: "",
  locataire_cni: "",
  date_naissance: "",
  adresse_complete: "",
  profession: "",
  piece_jointe: "",
  type_bien: "",
  bien_loue_details: "",
  quartier: "",
  loyer_mensuel: "",
  caution: "",
  annee_debut: "2026",
  mois_debut: "1",
  statut: "Actif",
};

export default function ContractFormDialog({ open, onClose, onSaved, contractId }: Props) {
  const [form, setForm] = useState<Record<string, string>>({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Generate reference for new contracts
  useEffect(() => {
    if (open && !contractId) {
      setForm({
        ...emptyForm,
        ref_locataire: `LOC-${new Date().toISOString().replace(/[-T:.Z]/g, "").slice(0, 14)}`,
      });
    }
  }, [open, contractId]);

  // Load existing contract data for editing
  useEffect(() => {
    if (open && contractId) {
      setLoading(true);
      fetch(`/api/loyers/${contractId}`)
        .then((res) => res.json())
        .then((data: Contract) => {
          setForm({
            locataire_nom_complet: data.locataire_nom_complet || "",
            ref_locataire: data.ref_locataire || "",
            locataire_telephone: data.locataire_telephone || "",
            locataire_email: data.locataire_email || "",
            locataire_cni: data.locataire_cni || "",
            date_naissance: data.date_naissance || "",
            adresse_complete: data.adresse_complete || "",
            profession: data.profession || "",
            piece_jointe: data.piece_jointe || "",
            type_bien: data.type_bien || "",
            bien_loue_details: data.bien_loue_details || "",
            quartier: data.quartier || "",
            loyer_mensuel: String(data.loyer_mensuel || ""),
            caution: String(data.caution || ""),
            annee_debut: String(data.annee_debut || "2026"),
            mois_debut: String(data.mois_debut || "1"),
            statut: data.statut || "Actif",
          });
        })
        .catch(() => setError("Impossible de charger les données du contrat."))
        .finally(() => setLoading(false));
    }
  }, [open, contractId]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.locataire_nom_complet || !form.bien_loue_details || !form.loyer_mensuel) {
      setError("Veuillez remplir les champs obligatoires (*).");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const method = contractId ? "PUT" : "POST";
      const url = contractId ? `/api/loyers/${contractId}` : "/api/loyers";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde.");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };



  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50/80 to-indigo-50/30 border-white/60 backdrop-blur-2xl shadow-2xl rounded-[28px] p-0">
        <DialogHeader className="px-8 pt-8 pb-4 border-b border-slate-100">
          <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/30">
              <User size={20} className="text-white" />
            </div>
            {contractId ? `Modifier Contrat #${contractId}` : "Nouveau Contrat"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="px-8 py-6 space-y-8">
            {/* Tenant Info */}
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-4 flex items-center gap-2">
                <User size={16} /> Informations du Locataire
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field form={form} onChange={handleChange} label="Nom complet" dataKey="locataire_nom_complet" required colSpan />
                <Field form={form} onChange={handleChange} label="Référence (Code)" dataKey="ref_locataire" />
                <Field form={form} onChange={handleChange} label="Téléphone" dataKey="locataire_telephone" />
                <Field form={form} onChange={handleChange} label="Email" dataKey="locataire_email" type="email" />
                <Field form={form} onChange={handleChange} label="Numéro CNI" dataKey="locataire_cni" />
                <Field form={form} onChange={handleChange} label="Date de naissance" dataKey="date_naissance" type="date" />
                <Field form={form} onChange={handleChange} label="Profession" dataKey="profession" />
                <Field form={form} onChange={handleChange} label="Adresse complète" dataKey="adresse_complete" colSpan />
              </div>
            </div>

            {/* Property Info */}
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                <Home size={16} /> Détails du Bien Loué
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Type de bien</Label>
                  <Select value={form.type_bien} onValueChange={(v) => handleChange("type_bien", v)}>
                    <SelectTrigger className="h-11 bg-white/60 border-slate-200/80 rounded-xl">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["Appartement", "Chambre", "Boutique", "Maison", "Terrain"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Field form={form} onChange={handleChange} label="Description du bien" dataKey="bien_loue_details" required />
                <Field form={form} onChange={handleChange} label="Quartier" dataKey="quartier" />
              </div>
            </div>

            {/* Financial Info */}
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-amber-600 mb-4 flex items-center gap-2">
                <Wallet size={16} /> Informations Financières
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field form={form} onChange={handleChange} label="Loyer mensuel (F CFA)" dataKey="loyer_mensuel" required type="number" />
                <Field form={form} onChange={handleChange} label="Caution (F CFA)" dataKey="caution" type="number" />
                <Field form={form} onChange={handleChange} label="Année de début" dataKey="annee_debut" type="number" />
                <div>
                  <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Mois de début</Label>
                  <Select value={form.mois_debut} onValueChange={(v) => handleChange("mois_debut", v)}>
                    <SelectTrigger className="h-11 bg-white/60 border-slate-200/80 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        {v: "1", l: "Janvier"}, {v: "2", l: "Février"}, {v: "3", l: "Mars"},
                        {v: "4", l: "Avril"}, {v: "5", l: "Mai"}, {v: "6", l: "Juin"},
                        {v: "7", l: "Juillet"}, {v: "8", l: "Août"}, {v: "9", l: "Septembre"},
                        {v: "10", l: "Octobre"}, {v: "11", l: "Novembre"}, {v: "12", l: "Décembre"}
                      ].map((m) => (
                        <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Statut</Label>
                <Select value={form.statut} onValueChange={(v) => handleChange("statut", v)}>
                  <SelectTrigger className="h-11 bg-white/60 border-slate-200/80 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Actif">✅ Actif</SelectItem>
                    <SelectItem value="Expiré">⏳ Expiré</SelectItem>
                    <SelectItem value="Annulé">❌ Annulé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-bold">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={onClose}
                className="rounded-xl h-11 px-6 font-bold border-slate-200"
              >
                <X size={16} className="mr-2" /> Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-xl h-11 px-8 font-black bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-lg shadow-indigo-500/30 transition-all"
              >
                {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
