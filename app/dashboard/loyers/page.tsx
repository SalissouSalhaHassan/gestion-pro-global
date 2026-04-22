"use client";
// Force Change for Git - 11:51 AM

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, BarChart3, Wallet, ListChecks,
  Loader2, Search, Home, Users, FileText, Printer, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ContractFormDialog from "@/components/loyers/ContractFormDialog";
import PaymentFormDialog from "@/components/loyers/PaymentFormDialog";
import LoyerReportModal from "@/components/loyers/LoyerReportModal";
import type { Contract } from "@/lib/services/loyer.service";

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Actif: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  Expiré: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  Annulé: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export default function LoyersPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Contract | null>(null);

  // Dialogs
  const [showContractForm, setShowContractForm] = useState(false);
  const [editContractId, setEditContractId] = useState<number | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loyers");
      const data = await res.json();
      setContracts(Array.isArray(data) ? data : []);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return contracts;
    const s = search.toLowerCase();
    return contracts.filter((c) =>
      [c.locataire_nom_complet, c.bien_loue_details, c.quartier, c.type_bien, c.ref_locataire]
        .some((v) => (v || "").toLowerCase().includes(s))
    );
  }, [contracts, search]);

  const stats = useMemo(() => {
    const total = contracts.length;
    const actifs = contracts.filter((c) => c.statut === "Actif").length;
    const totalPaye = contracts.reduce((sum, c) => sum + (c.total_paye || 0), 0);
    return { total, actifs, totalPaye };
  }, [contracts]);

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Supprimer le contrat de "${selected.locataire_nom_complet}" ?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/loyers/${selected.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Contrat supprimé.");
        setSelected(null);
        fetchContracts();
      }
    } catch { /* ignore */ } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#0f172a] text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          ✅ {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Home className="text-indigo-500" size={32} />
            Gestion des Loyers
          </h1>
          <p className="text-slate-500 font-medium mt-1">Gérez vos contrats de location et paiements.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Total Contrats", value: stats.total, icon: FileText, gradient: "from-indigo-600 to-indigo-500", shadow: "shadow-indigo-500/30" },
          { label: "Contrats Actifs", value: stats.actifs, icon: Users, gradient: "from-emerald-600 to-emerald-500", shadow: "shadow-emerald-500/30" },
          { label: "Total Encaissé", value: `${fmt(stats.totalPaye)} F`, icon: Wallet, gradient: "from-amber-500 to-orange-500", shadow: "shadow-amber-500/30" },
        ].map((s, i) => (
          <div key={i} className={`group relative overflow-hidden rounded-[28px] p-7 text-white bg-gradient-to-r ${s.gradient} shadow-xl ${s.shadow} transition-all duration-300 hover:scale-[1.03]`}>
            <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
            <div className="relative z-10">
              <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl w-fit mb-4">
                <s.icon size={22} />
              </div>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest">{s.label}</p>
              <p className="text-3xl font-black mt-1">{loading ? "..." : s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => { setEditContractId(null); setShowContractForm(true); }}
          className="rounded-xl h-11 px-5 font-black bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 shadow-lg shadow-emerald-500/30"
        >
          <Plus size={18} className="mr-2" /> Nouveau Contrat
        </Button>
        <Button
          disabled={!selected}
          onClick={() => { setEditContractId(selected!.id); setShowContractForm(true); }}
          className="rounded-xl h-11 px-5 font-black bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 shadow-lg shadow-indigo-500/30 disabled:opacity-40"
        >
          <Pencil size={16} className="mr-2" /> Modifier
        </Button>
        <Button
          disabled={!selected || deleting}
          onClick={handleDelete}
          className="rounded-xl h-11 px-5 font-black bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 shadow-lg shadow-rose-500/30 disabled:opacity-40"
        >
          {deleting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />} Supprimer
        </Button>
        <Button
          onClick={() => router.push("/dashboard/loyers/reports")}
          className="rounded-xl h-11 px-5 font-black bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 flex items-center gap-2"
        >
          <TrendingUp size={18} /> Rapports Détaillés
        </Button>

        <Button
          disabled={!selected}
          onClick={() => selected && router.push(`/dashboard/loyers/${selected.id}`)}
          className="rounded-xl h-11 px-5 font-black bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm disabled:opacity-40"
          variant="outline"
        >
          <BarChart3 size={16} className="mr-2" /> Tableau de Bord
        </Button>
        <Button
          disabled={!selected}
          onClick={() => selected && setShowPaymentForm(true)}
          className="rounded-xl h-11 px-5 font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 disabled:opacity-40"
        >
          <Wallet size={16} className="mr-2" /> Paiement
        </Button>
        <Button
          onClick={() => router.push("/dashboard/loyers/payments")}
          className="rounded-xl h-11 px-5 font-black bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm"
          variant="outline"
        >
          <ListChecks size={16} className="mr-2" /> Liste Paiements
        </Button>

        <Button
          onClick={() => setShowReportModal(true)}
          className="rounded-xl h-11 px-5 font-black bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50 shadow-sm"
          variant="outline"
        >
          <Printer size={16} className="mr-2" /> Imprimer Rapport
        </Button>

        {/* Search */}
        <div className="flex-1 min-w-[200px] ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-white/60 border-slate-200/80 rounded-xl font-medium"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0f172a] rounded-[32px] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                {["ID", "Référence", "Nom", "Téléphone", "Loyer", "Total Payé", "Retards", "Mois Impayés", "Statut"].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.15em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-20 text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-500" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-20 text-slate-500 font-bold">Aucun contrat trouvé.</td>
                </tr>
              ) : (
                filtered.map((c, i) => {
                  const isSelected = selected?.id === c.id;
                  const st = STATUS_STYLES[c.statut] || STATUS_STYLES.Actif;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(isSelected ? null : c)}
                      className={`border-b border-white/5 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500/30"
                          : i % 2 === 0
                            ? "bg-white/[0.02] hover:bg-white/[0.06]"
                            : "hover:bg-white/[0.06]"
                      }`}
                    >
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">{c.id}</td>
                      <td className="px-5 py-3.5 text-indigo-400 font-bold text-xs">{c.ref_locataire}</td>
                      <td className="px-5 py-3.5 text-white font-black">{c.locataire_nom_complet}</td>
                      <td className="px-5 py-3.5 text-slate-300 font-medium">{c.locataire_telephone || "—"}</td>
                      <td className="px-5 py-3.5 text-emerald-400 font-black text-right">{fmt(c.loyer_mensuel)} F</td>
                      <td className="px-5 py-3.5 text-amber-400 font-black text-right">{fmt(c.total_paye || 0)} F</td>
                      <td className="px-5 py-3.5 text-rose-400 font-black text-right">{fmt(c.retards || 0)} F</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                          c.mois_impayes === "À jour" || c.mois_impayes === "OK" 
                            ? "bg-emerald-500/20 text-emerald-400" 
                            : "bg-rose-500/20 text-rose-400"
                        }`}>
                          {c.mois_impayes}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${st.bg} ${st.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {c.statut}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 text-right text-xs text-slate-500 font-bold">
          Total: {stats.total} | Actifs: {stats.actifs}
        </div>
      </div>

      {/* Dialogs */}
      <ContractFormDialog
        open={showContractForm}
        onClose={() => { setShowContractForm(false); setEditContractId(null); }}
        onSaved={() => { fetchContracts(); showToast("Contrat enregistré."); }}
        contractId={editContractId}
      />

      {selected && (
        <PaymentFormDialog
          open={showPaymentForm}
          onClose={() => setShowPaymentForm(false)}
          onSaved={() => { fetchContracts(); showToast("Paiement enregistré."); }}
          contract={selected}
        />
      )}

      {showReportModal && (
        <LoyerReportModal onClose={() => setShowReportModal(false)} />
      )}
    </div>
  );
}
