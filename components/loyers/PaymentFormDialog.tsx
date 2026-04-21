"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, X, CalendarDays, CreditCard, Banknote, Smartphone, Receipt } from "lucide-react";
import type { Contract } from "@/lib/services/loyer.service";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  contract: Contract;
  /** If provided, pre-loads payment data for editing */
  paymentId?: number | null;
};

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const PAYMENT_MODES = [
  { value: "Espèces", icon: Banknote, label: "Espèces" },
  { value: "Virement bancaire", icon: CreditCard, label: "Virement" },
  { value: "Chèque", icon: Receipt, label: "Chèque" },
  { value: "My Nita", icon: Smartphone, label: "My Nita" },
  { value: "AmanaTa", icon: CreditCard, label: "AmanaTa" },
];

const STATUS_COLORS: Record<string, string> = {
  Actif: "text-emerald-600 bg-emerald-50",
  Expiré: "text-amber-600 bg-amber-50",
  Annulé: "text-rose-600 bg-rose-50",
};

function parseDateDMY(s: string): Date | null {
  const parts = s.split("/");
  if (parts.length !== 3) return null;
  const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  return isNaN(d.getTime()) ? null : d;
}

function formatDateDMY(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function monthDiff(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
}

export default function PaymentFormDialog({ open, onClose, onSaved, contract, paymentId }: Props) {
  const loyer = contract.loyer_mensuel || 0;
  const isEditing = !!paymentId;

  // Contract year end
  const createdAt = contract.created_at ? new Date(contract.created_at) : new Date();
  const contractEndDate = new Date(createdAt.getFullYear(), 11, 31);

  const [nbMois, setNbMois] = useState("");
  const [startPeriod, setStartPeriod] = useState("");
  const [endPeriod, setEndPeriod] = useState("");
  const [nomMois, setNomMois] = useState("");
  const [qteMois, setQteMois] = useState(0);
  const [total, setTotal] = useState(0);
  const [datePaiement, setDatePaiement] = useState(formatDateDMY(new Date()));
  const [modePaiement, setModePaiement] = useState("Espèces");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load existing payment data for editing
  useEffect(() => {
    if (open && paymentId) {
      setLoading(true);
      fetch(`/api/loyers/payments/${paymentId}`)
        .catch(() => null)
        .then(async (res) => {
          // The individual GET isn't implemented — use a workaround via contract payments
          // Actually, let's just load from the payments list endpoint
          return null;
        });

      // Fetch from contract payments and find the one
      fetch(`/api/loyers/${contract.id}/payments`)
        .then((r) => r.json())
        .then((payments: any[]) => {
          const p = payments.find((x: any) => x.id === paymentId);
          if (p) {
            // Format dates from yyyy-mm-dd to dd/mm/yyyy
            const fmtDate = (d: string) => {
              if (!d) return "";
              const dt = new Date(d);
              return formatDateDMY(dt);
            };
            setStartPeriod(fmtDate(p.periode_debut));
            setEndPeriod(fmtDate(p.periode_fin));
            setDatePaiement(fmtDate(p.date_paiement));
            setModePaiement(p.mode_paiement || "Espèces");
            setDescription(p.description || "");
          }
        })
        .catch(() => setError("Impossible de charger les données du paiement."))
        .finally(() => setLoading(false));
    } else if (open) {
      // Reset form for new payment
      setNbMois("");
      setStartPeriod("");
      setEndPeriod("");
      setNomMois("");
      setQteMois(0);
      setTotal(0);
      setDatePaiement(formatDateDMY(new Date()));
      setModePaiement("Espèces");
      setDescription("");
      setError("");
    }
  }, [open, paymentId, contract.id]);

  // Calculate from manual dates
  const calculateFromDates = useCallback(() => {
    if (startPeriod.length !== 10 || endPeriod.length !== 10) return;
    const start = parseDateDMY(startPeriod);
    const end = parseDateDMY(endPeriod);
    if (!start || !end) return;

    if (end > contractEndDate) {
      setError(`La date de fin ne peut pas dépasser ${formatDateDMY(contractEndDate)}.`);
      return;
    }

    if (start > end) {
      setQteMois(0);
      setNomMois("Date invalide");
      setTotal(0);
      return;
    }

    setError("");
    const months = monthDiff(start, end);
    setQteMois(months);

    // Build month names
    const names: string[] = [];
    let current = new Date(start);
    while (current <= end) {
      const name = `${MONTHS_FR[current.getMonth()]} ${current.getFullYear()}`;
      if (!names.includes(name)) names.push(name);
      current = addMonths(current, 1);
    }
    setNomMois(names.join(", "));
    setTotal(months * loyer);
  }, [startPeriod, endPeriod, loyer, contractEndDate]);

  useEffect(() => {
    calculateFromDates();
  }, [calculateFromDates]);

  // Calculate from month count (quick pay)
  const handleNbMoisChange = async (value: string) => {
    setNbMois(value);
    const n = parseInt(value);
    if (!n || n <= 0) return;

    // Get last payment end date from API
    try {
      const res = await fetch(`/api/loyers/${contract.id}/payments`);
      const payments = await res.json();

      let startDate: Date;
      if (payments.length > 0) {
        // Find the latest periode_fin
        const sortedPayments = payments
          .filter((p: any) => p.periode_fin)
          .sort((a: any, b: any) => new Date(b.periode_fin).getTime() - new Date(a.periode_fin).getTime());

        if (sortedPayments.length > 0) {
          startDate = addDays(new Date(sortedPayments[0].periode_fin), 1);
        } else {
          startDate = new Date(contractEndDate.getFullYear(), 0, 1);
        }
      } else {
        startDate = new Date(contractEndDate.getFullYear(), 0, 1);
      }

      const endDate = subDays(addMonths(startDate, n), 1);

      if (endDate > contractEndDate) {
        setError(`La période dépasse la fin de l'année du contrat (${formatDateDMY(contractEndDate)}).`);
        setNbMois("");
        return;
      }

      setStartPeriod(formatDateDMY(startDate));
      setEndPeriod(formatDateDMY(endDate));
    } catch {
      // fallback
      const startDate = new Date(contractEndDate.getFullYear(), 0, 1);
      const endDate = subDays(addMonths(startDate, n), 1);
      setStartPeriod(formatDateDMY(startDate));
      setEndPeriod(formatDateDMY(endDate));
    }
  };

  const handleSubmit = async () => {
    if (total <= 0) {
      setError("Le montant total doit être supérieur à zéro.");
      return;
    }

    const endDate = parseDateDMY(endPeriod);
    if (endDate && endDate > contractEndDate) {
      setError("La période de paiement dépasse la validité du contrat.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      contrat_id: contract.id,
      date_paiement: datePaiement,
      montant: total,
      mode_paiement: modePaiement,
      description,
      nom_de_mois: nomMois || null,
      qte_mois: qteMois || null,
      periode_debut: startPeriod,
      periode_fin: endPeriod,
    };

    try {
      let res;
      if (isEditing) {
        res = await fetch(`/api/loyers/payments/${paymentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/loyers/${contract.id}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

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

  const statut = contract.statut || "N/A";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-gradient-to-br from-white via-slate-50/80 to-amber-50/20 border-white/60 backdrop-blur-2xl shadow-2xl rounded-[28px] p-0">
        <DialogHeader className="px-8 pt-8 pb-4 border-b border-slate-100">
          <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/30">
              <CalendarDays size={20} className="text-white" />
            </div>
            {isEditing ? "Modifier le Paiement" : "Ajouter un Paiement"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : (
          <div className="px-8 py-6 space-y-6">
            {/* Contract Summary */}
            <div className="bg-[#0f172a] rounded-2xl p-5 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-3">Résumé du Contrat</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-400 text-xs">Locataire</span>
                  <p className="font-black">{contract.locataire_nom_complet}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">Bien</span>
                  <p className="font-black">{contract.bien_loue_details}</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">Loyer Mensuel</span>
                  <p className="font-black text-emerald-400">{new Intl.NumberFormat('fr-FR').format(loyer)} F</p>
                </div>
                <div>
                  <span className="text-slate-400 text-xs">Statut</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-black ${STATUS_COLORS[statut] || ""}`}>
                    {statut}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Pay */}
            {!isEditing && (
              <div className="bg-white/60 border border-slate-200/60 rounded-2xl p-5">
                <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-3">⚡ Paiement Rapide</p>
                <Label className="text-xs font-bold text-slate-500 mb-1.5 block">Nombre de mois à payer</Label>
                <Input
                  type="number"
                  min={1}
                  value={nbMois}
                  onChange={(e) => handleNbMoisChange(e.target.value)}
                  className="h-11 bg-white border-slate-200 rounded-xl text-center font-black text-lg"
                  placeholder="Ex: 3"
                />
              </div>
            )}

            {/* Manual Period */}
            <div className="bg-white/60 border border-slate-200/60 rounded-2xl p-5 space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-600 mb-1">Détails de la Période</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-500 mb-1.5 block">Début période</Label>
                  <Input
                    type="text"
                    placeholder="jj/mm/aaaa"
                    value={startPeriod}
                    onChange={(e) => setStartPeriod(e.target.value)}
                    className="h-11 bg-white border-slate-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-500 mb-1.5 block">Fin période</Label>
                  <Input
                    type="text"
                    placeholder="jj/mm/aaaa"
                    value={endPeriod}
                    onChange={(e) => setEndPeriod(e.target.value)}
                    className="h-11 bg-white border-slate-200 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Calculated fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold text-slate-400 mb-1.5 block">Mois Correspondants</Label>
                  <div className="h-11 bg-slate-100 border border-slate-200 rounded-xl px-3 flex items-center text-sm text-slate-600 font-medium truncate">
                    {nomMois || "—"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-400 mb-1.5 block">Quantité Mois</Label>
                  <div className="h-11 bg-slate-100 border border-slate-200 rounded-xl px-3 flex items-center justify-center text-sm font-black text-slate-700">
                    {qteMois}
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl p-4 text-white text-center">
                <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Montant Total</p>
                <p className="text-3xl font-black mt-1">{new Intl.NumberFormat('fr-FR').format(total)} F CFA</p>
              </div>
            </div>

            {/* Date & Mode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Date d&apos;enregistrement</Label>
                <Input
                  type="text"
                  placeholder="jj/mm/aaaa"
                  value={datePaiement}
                  onChange={(e) => setDatePaiement(e.target.value)}
                  className="h-11 bg-white/60 border-slate-200 rounded-xl font-medium"
                />
              </div>
            </div>

            {/* Payment Mode */}
            <div>
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 block">Mode de Paiement</Label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setModePaiement(m.value)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-all border ${
                      modePaiement === m.value
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/30 scale-105"
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50"
                    }`}
                  >
                    <m.icon size={16} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">Description / Notes</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-white/60 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-bold">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={onClose} className="rounded-xl h-11 px-6 font-bold border-slate-200">
                <X size={16} className="mr-2" /> Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-xl h-11 px-8 font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 transition-all"
              >
                {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                {isEditing ? "Mettre à Jour" : "Enregistrer"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
