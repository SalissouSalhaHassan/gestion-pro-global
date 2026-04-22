"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Search, Loader2, Pencil, Trash2, Plus, Filter, X, Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PaymentFormDialog from "@/components/loyers/PaymentFormDialog";
import LoyerReceiptModalV2 from "@/components/loyers/LoyerReceiptModalV2";
import type { Payment, Contract } from "@/lib/services/loyer.service";

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString("fr-FR");
  } catch {
    return String(d);
  }
}

const MODE_COLORS: Record<string, { bg: string; text: string }> = {
  "Espèces": { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  "Virement bancaire": { bg: "bg-sky-500/10", text: "text-sky-400" },
  "Chèque": { bg: "bg-purple-500/10", text: "text-purple-400" },
  "My Nita": { bg: "bg-amber-500/10", text: "text-amber-400" },
  "AmanaTa": { bg: "bg-emerald-500/10", text: "text-emerald-400" },
};

export default function PaymentsListPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [fLocataire, setFLocataire] = useState("");
  const [fMois, setFMois] = useState("");
  const [fStartDate, setFStartDate] = useState("");
  const [fEndDate, setFEndDate] = useState("");
  const [fMode, setFMode] = useState("Tous les modes");

  // Dialogs
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);
  const [dialogContract, setDialogContract] = useState<Contract | null>(null);

  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);

  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fLocataire) params.set("locataire", fLocataire);
      if (fMois) params.set("mois", fMois);
      if (fMode && fMode !== "Tous les modes") params.set("mode", fMode);
      if (fStartDate) {
        const p = fStartDate.split("/");
        if (p.length === 3) params.set("start_date", `${p[2]}-${p[1]}-${p[0]}`);
      }
      if (fEndDate) {
        const p = fEndDate.split("/");
        if (p.length === 3) params.set("end_date", `${p[2]}-${p[1]}-${p[0]}`);
      }

      const res = await fetch(`/api/loyers/payments?${params.toString()}`);
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch {
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => fetchPayments();

  const clearFilters = () => {
    setFLocataire(""); setFMois(""); setFStartDate(""); setFEndDate(""); setFMode("Tous les modes");
    // Fetch after clearing
    setTimeout(fetchPayments, 50);
  };

  const totalAmount = useMemo(() => payments.reduce((s, p) => s + (p.montant || 0), 0), [payments]);

  // Open add/edit payment dialog
  const openPaymentDialog = async (payment: Payment, editMode: boolean) => {
    // Fetch the contract for this payment
    try {
      const res = await fetch(`/api/loyers/${payment.contrat_id}`);
      const contract = await res.json();
      setDialogContract(contract);
      setEditPaymentId(editMode ? payment.id : null);
      setShowPaymentDialog(true);
    } catch {
      alert("Impossible de retrouver le contrat.");
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Supprimer ce paiement de ${fmt(selected.montant)} F pour ${selected.locataire_nom_complet} ?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/loyers/payments/${selected.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Paiement supprimé.");
        setSelected(null);
        fetchPayments();
      }
    } catch { /* ignore */ } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#0f172a] text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          ✅ {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/dashboard/loyers")} className="rounded-xl h-10 border-slate-200">
          <ArrowLeft size={16} className="mr-2" /> Retour
        </Button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">📜 Liste des Paiements</h1>
          <p className="text-slate-500 font-medium text-sm">Tous les paiements de loyer avec filtres avancés.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[28px] p-5 shadow-lg">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Locataire</label>
            <Input
              placeholder="Nom du locataire..."
              value={fLocataire}
              onChange={(e) => setFLocataire(e.target.value)}
              className="h-10 bg-white border-slate-200 rounded-xl font-medium text-sm"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Mois</label>
            <Input
              placeholder="Janvier, Mars..."
              value={fMois}
              onChange={(e) => setFMois(e.target.value)}
              className="h-10 bg-white border-slate-200 rounded-xl font-medium text-sm"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Début</label>
            <Input
              placeholder="jj/mm/aaaa"
              value={fStartDate}
              onChange={(e) => setFStartDate(e.target.value)}
              className="h-10 bg-white border-slate-200 rounded-xl font-medium text-sm"
            />
          </div>
          <div className="min-w-[120px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Fin</label>
            <Input
              placeholder="jj/mm/aaaa"
              value={fEndDate}
              onChange={(e) => setFEndDate(e.target.value)}
              className="h-10 bg-white border-slate-200 rounded-xl font-medium text-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Mode</label>
            <Select value={fMode} onValueChange={setFMode}>
              <SelectTrigger className="h-10 bg-white border-slate-200 rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Tous les modes", "Espèces", "Virement bancaire", "Chèque", "My Nita", "AmanaTa"].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSearch} className="rounded-xl h-10 px-4 bg-indigo-600 hover:bg-indigo-700 font-black shadow-md">
            <Search size={16} className="mr-1" /> Rechercher
          </Button>
          <Button onClick={clearFilters} variant="outline" className="rounded-xl h-10 px-4 border-slate-200 font-bold">
            <X size={16} className="mr-1" /> Effacer
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={!selected}
          onClick={() => selected && openPaymentDialog(selected, false)}
          className="rounded-xl h-10 px-5 font-black bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-lg shadow-emerald-500/30 disabled:opacity-40"
        >
          <Plus size={16} className="mr-2" /> Ajouter Paiement
        </Button>
        <Button
          disabled={!selected}
          onClick={() => selected && openPaymentDialog(selected, true)}
          className="rounded-xl h-10 px-5 font-black bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-lg shadow-indigo-500/30 disabled:opacity-40"
        >
          <Pencil size={16} className="mr-2" /> Modifier
        </Button>
        <Button
          disabled={!selected || deleting}
          onClick={handleDelete}
          className="rounded-xl h-10 px-5 font-black bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 shadow-lg shadow-rose-500/30 disabled:opacity-40"
        >
          {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />} Supprimer
        </Button>
        <Button
          disabled={!selected}
          onClick={() => selected && window.open(`/api/loyers/print/receipt/${selected.id}`, "_blank")}
          className="rounded-xl h-10 px-5 font-black bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-sm disabled:opacity-40"
          variant="outline"
        >
          <Printer size={16} className="mr-2" /> Imprimer Reçu
        </Button>

        {/* Summary */}
        <div className="ml-auto flex items-center gap-3 bg-white/50 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/50 shadow-sm">
          <span className="text-xs font-bold text-slate-500">{payments.length} paiements</span>
          <span className="text-slate-300">•</span>
          <span className="text-sm font-black text-indigo-600">Total: {fmt(totalAmount)} F</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f172a] rounded-[32px] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                {["ID", "Date Paiement", "Locataire", "Mois", "Période", "Montant (F)", "Mode", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.15em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-20 text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-500" />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-20 text-slate-500 font-bold">Aucun paiement trouvé.</td>
                </tr>
              ) : (
                payments.map((p, i) => {
                  const isSelected = selected?.id === p.id;
                  const modeStyle = MODE_COLORS[p.mode_paiement] || { bg: "", text: "text-slate-300" };
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(isSelected ? null : p)}
                      className={`border-b border-white/5 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500/30"
                          : i % 2 === 0
                            ? "bg-white/[0.02] hover:bg-white/[0.06]"
                            : "hover:bg-white/[0.06]"
                      }`}
                    >
                      <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{p.id}</td>
                      <td className="px-4 py-3.5 text-white font-bold">{fmtDate(p.date_paiement)}</td>
                      <td className="px-4 py-3.5 text-white font-black">{p.locataire_nom_complet || "—"}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-medium max-w-[180px] truncate">{p.nom_de_mois || "—"}</td>
                      <td className="px-4 py-3.5 text-slate-300 font-medium">{fmtDate(p.periode_debut)} - {fmtDate(p.periode_fin)}</td>
                      <td className="px-5 py-3.5 text-emerald-400 font-black text-right">{fmt(p.montant)} F</td>
                      <td className={`px-5 py-3.5 font-bold ${MODE_COLORS[p.mode_paiement] ? "" : "text-slate-300"}`}>
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black ${modeStyle.bg} ${modeStyle.text}`}>
                          {p.mode_paiement}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setReceiptPaymentId(p.id); }}
                          className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl transition-colors"
                          title="Imprimer le Reçu"
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialogs */}
      {selected && dialogContract && (
        <PaymentFormDialog
          open={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          onSaved={() => {
            fetchPayments();
            showToast("Paiement mis à jour.");
          }}
          contract={dialogContract}
          paymentId={editPaymentId || undefined}
        />
      )}

      {/* Print Receipt Modal */}
      {receiptPaymentId && (
        <LoyerReceiptModalV2
          paymentId={receiptPaymentId}
          onClose={() => setReceiptPaymentId(null)}
        />
      )}
    </div>
  );
}
