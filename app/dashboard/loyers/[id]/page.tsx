"use client";

import { useEffect, useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, User, Home, Wallet, Loader2, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LoyerReceiptModalV2 from "@/components/loyers/LoyerReceiptModalV2";
import type { Contract, Payment } from "@/lib/services/loyer.service";

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

const MODE_COLORS: Record<string, string> = {
  "Espèces": "text-emerald-400",
  "Virement bancaire": "text-sky-400",
  "Chèque": "text-purple-400",
  "My Nita": "text-amber-400",
  "AmanaTa": "text-emerald-400",
};

export default function TenantDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [contract, setContract] = useState<Contract | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [cRes, pRes] = await Promise.all([
          fetch(`/api/loyers/${id}`),
          fetch(`/api/loyers/${id}/payments`),
        ]);
        const cData = await cRes.json();
        const pData = await pRes.json();
        setContract(cData);
        setPayments(Array.isArray(pData) ? pData : []);
      } catch {
        setContract(null);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const totalPaye = useMemo(() => payments.reduce((s, p) => s + (p.montant || 0), 0), [payments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500 font-bold text-lg">Contrat introuvable.</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4 rounded-xl">
          <ArrowLeft size={16} className="mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    Actif: "text-emerald-600 bg-emerald-50",
    Expiré: "text-amber-600 bg-amber-50",
    Annulé: "text-rose-600 bg-rose-50",
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push("/dashboard/loyers")} className="rounded-xl h-10 border-slate-200">
          <ArrowLeft size={16} className="mr-2" /> Retour
        </Button>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">📊 Tableau de Bord du Locataire</h1>
          <p className="text-slate-500 font-medium text-sm">Contrat #{contract.id}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant Info */}
        <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[32px] p-8 shadow-xl transition-all hover:shadow-2xl">
          <h3 className="text-sm font-black uppercase tracking-widest text-indigo-600 mb-5 flex items-center gap-2">
            <User size={18} /> Informations du Locataire
          </h3>
          <div className="space-y-3">
            {[
              ["Nom Complet", contract.locataire_nom_complet],
              ["Référence", contract.ref_locataire],
              ["Téléphone", contract.locataire_telephone],
              ["Email", contract.locataire_email],
              ["N° CNI", contract.locataire_cni],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                <span className="font-black text-slate-800 text-sm">{value || "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Property Info */}
        <div className="bg-white/60 backdrop-blur-2xl border border-white/80 rounded-[32px] p-8 shadow-xl transition-all hover:shadow-2xl">
          <h3 className="text-sm font-black uppercase tracking-widest text-emerald-600 mb-5 flex items-center gap-2">
            <Home size={18} /> Détails du Bien
          </h3>
          <div className="space-y-3">
            {[
              ["Bien Loué", contract.bien_loue_details],
              ["Quartier", contract.quartier],
              ["Loyer Mensuel", `${fmt(contract.loyer_mensuel)} F`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
                <span className="font-black text-slate-800 text-sm">{value || "—"}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Statut</span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[contract.statut] || ""}`}>
                {contract.statut}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="group relative overflow-hidden rounded-[28px] p-7 text-white bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-xl shadow-emerald-500/30 transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
          <div className="relative z-10">
            <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl w-fit mb-3">
              <Wallet size={22} />
            </div>
            <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Total Payé</p>
            <p className="text-3xl font-black mt-1">{fmt(totalPaye)} F</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-[28px] p-7 text-white bg-gradient-to-r from-indigo-600 to-indigo-500 shadow-xl shadow-indigo-500/30 transition-all duration-300 hover:scale-[1.02]">
          <div className="absolute -right-4 -top-4 w-28 h-28 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500" />
          <div className="relative z-10">
            <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl w-fit mb-3">
              <Calendar size={22} />
            </div>
            <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Caution Versée</p>
            <p className="text-3xl font-black mt-1">{fmt(contract.caution || 0)} F</p>
          </div>
        </div>
      </div>

      {/* Payments History */}
      <div className="bg-[#0f172a] rounded-[32px] overflow-hidden shadow-2xl">
        <div className="px-6 py-5 border-b border-white/5">
          <h3 className="text-lg font-black text-white flex items-center gap-3">
            📜 Historique des Paiements
            <span className="text-xs font-bold text-slate-500 bg-white/5 px-3 py-1 rounded-full">{payments.length}</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                {["ID", "Date Paiement", "Période Payée", "Qté Mois", "Montant (F)", "Mode", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-[0.15em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-500 font-bold">Aucun paiement enregistré.</td>
                </tr>
              ) : (
                payments.map((p, i) => (
                  <tr key={p.id} className={`border-b border-white/5 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-5 py-3.5 text-slate-400 font-mono text-xs">{p.id}</td>
                    <td className="px-5 py-3.5 text-white font-bold">{fmtDate(p.date_paiement)}</td>
                    <td className="px-5 py-3.5 text-slate-300 font-medium">
                      {p.periode_debut ? `${fmtDate(p.periode_debut)} — ${fmtDate(p.periode_fin)}` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300 font-bold text-center">{p.qte_mois || "—"}</td>
                    <td className="px-5 py-3.5 text-emerald-400 font-black text-right">{fmt(p.montant)} F</td>
                    <td className={`px-5 py-3.5 font-bold ${MODE_COLORS[p.mode_paiement] || "text-slate-300"}`}>{p.mode_paiement}</td>
                    <td className="px-5 py-3.5 text-right flex items-center justify-end">
                      <button
                        onClick={() => setReceiptPaymentId(p.id)}
                        className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl transition-colors"
                        title="Imprimer le Reçu"
                      >
                        <Wallet size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
