"use client";

import { useState, useEffect } from "react";
import {
  X,
  Printer,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calculator,
  ShieldCheck,
  Lock,
  Calendar,
  Clock,
  User,
  Building2,
  Receipt,
  Wallet,
  Coins,
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  MessageSquare
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { createClient } from "@/lib/supabase/client";
import { generateCashClosureWhatsAppMessage, openWhatsAppDirect } from "@/lib/utils/whatsapp";

const supabase = createClient();

type CashClosureModalProps = {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    reconciliation?: {
      totalInvoiced: number;
      totalUnpaidPeriod: number;
      totalPaidInvoicesPeriod: number;
      totalAdvancesPeriod: number;
      totalCementPeriod: number;
    };
  };
  filters: { start: string; end: string; cashier: string };
  userSession: any;
  onClose: () => void;
};

export default function CashClosureModal({
  summary,
  filters,
  userSession,
  onClose,
}: CashClosureModalProps) {
  const [fondDeCaisse, setFondDeCaisse] = useState<number>(0);
  const [especesComptees, setEspecesComptees] = useState<number | "">("");
  const [observations, setObservations] = useState("");
  const [step, setStep] = useState<"count" | "print">("count");
  const [format, setFormat] = useState<"Ticket" | "A4">("Ticket");
  const [company, setCompany] = useState<any>(null);
  const [closureDate, setClosureDate] = useState(new Date().toISOString());

  // Bills breakdown state (optional quick calculator)
  const [bills, setBills] = useState<Record<number, number>>({
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
  });
  const [showBillCalculator, setShowBillCalculator] = useState(false);

  useEffect(() => {
    async function loadCompany() {
      const { data } = await supabase.from("informations_entreprise").select("*").maybeSingle();
      if (data) setCompany(data);
    }
    loadCompany();
  }, []);

  // Update counted cash when bills calculator changes
  const updateBillCount = (denomination: number, count: number) => {
    const updated = { ...bills, [denomination]: Math.max(0, count) };
    setBills(updated);
    const sum = Object.entries(updated).reduce((acc, [val, qte]) => acc + Number(val) * qte, 0);
    setEspecesComptees(sum);
  };

  const netBalance = summary.netBalance || 0;
  const soldeTheorique = (Number(fondDeCaisse) || 0) + netBalance;
  const especesReelles = Number(especesComptees) || 0;
  const ecart = especesComptees !== "" ? especesReelles - soldeTheorique : 0;

  const isEcartZero = Math.abs(ecart) < 1;
  const isExcedent = ecart > 0;
  const isDeficit = ecart < 0;

  const handleValidate = () => {
    setClosureDate(new Date().toISOString());
    setStep("print");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const text = generateCashClosureWhatsAppMessage({
      companyName: company?.nom_entreprise || "GESTION PRO GLOBAL",
      dateClosure: new Date(closureDate).toLocaleDateString("fr-FR"),
      cashierName: filters.cashier === "Tous" ? userSession?.username || "Caisse" : filters.cashier,
      fondDeCaisse,
      encaissements: summary.totalIncome,
      decaissements: summary.totalExpenses,
      soldeTheorique,
      soldeReel: Number(especesComptees) || 0,
      ecart,
    });
    openWhatsAppDirect("", text);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none">
      <div
        className={`w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all print:border-none print:shadow-none ${
          format === "Ticket" ? "max-w-md print:max-w-[80mm]" : "max-w-3xl print:max-w-full"
        }`}
      >
        {/* Header Modal Bar (Hidden on Print) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                Clôture de Caisse & Rapport Z
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  OFFICIEL
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Caissier: <span className="text-white font-bold">{filters.cashier === "Tous" ? userSession?.username || "Caisse" : filters.cashier}</span> • {new Date().toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {step === "print" && (
              <div className="bg-white/10 p-1 rounded-xl flex items-center gap-1 border border-white/10">
                <button
                  onClick={() => setFormat("Ticket")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    format === "Ticket" ? "bg-white text-slate-900 shadow-sm" : "text-white/70 hover:text-white"
                  }`}
                >
                  Ticket 80mm
                </button>
                <button
                  onClick={() => setFormat("A4")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    format === "A4" ? "bg-white text-slate-900 shadow-sm" : "text-white/70 hover:text-white"
                  }`}
                >
                  Format A4
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* STEP 1: COUNTING & CLOSURE WIZARD */}
        {step === "count" && (
          <div className="p-6 space-y-5">
            {/* System Theoretical Card */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                <span className="flex items-center gap-1.5">
                  <Scale size={15} className="text-indigo-600" />
                  Flux Opérationnels de la Session
                </span>
                <span className="font-mono text-slate-500">{filters.start}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Encaissements</span>
                  <span className="text-sm font-black text-emerald-600 font-mono">
                    +{formatCurrencyAmount(summary.totalIncome, "FCFA")}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Décaissements</span>
                  <span className="text-sm font-black text-rose-600 font-mono">
                    -{formatCurrencyAmount(summary.totalExpenses, "FCFA")}
                  </span>
                </div>
              </div>
            </div>

            {/* Inputs: Fond de Caisse & Physical Count */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  1. Fond de Caisse Initial (Ouverture)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={fondDeCaisse || ""}
                    onChange={(e) => setFondDeCaisse(Number(e.target.value) || 0)}
                    placeholder="Ex: 50 000"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    FCFA
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    2. Espèces Réelles Comptées dans le Tiroir
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBillCalculator(!showBillCalculator)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
                  >
                    <Calculator size={13} />
                    {showBillCalculator ? "Masquer le détail" : "Détail par billets"}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={especesComptees}
                    onChange={(e) => setEspecesComptees(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Saisissez le montant total compté..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-indigo-500 text-base font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600">
                    FCFA
                  </span>
                </div>
              </div>

              {/* Bill Denominations Calculator */}
              {showBillCalculator && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in">
                  <span className="text-[11px] font-bold text-slate-500 block">
                    Comptage rapide par coupure (Billets & Pièces) :
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[10000, 5000, 2000, 1000, 500].map((val) => (
                      <div key={val} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                        <span className="font-bold text-slate-700">{val.toLocaleString()} F :</span>
                        <input
                          type="number"
                          min="0"
                          value={bills[val] || ""}
                          onChange={(e) => updateBillCount(val, Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-14 text-right font-black font-mono text-indigo-600 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Reconciliation Variance (Écart de Caisse) */}
              <div className="p-4 rounded-2xl border transition-all space-y-2 bg-slate-50 border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Solde Théorique Exigible :</span>
                  <span className="font-mono font-black text-slate-900">{formatCurrencyAmount(soldeTheorique, "FCFA")}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Espèces Réelles Saisies :</span>
                  <span className="font-mono font-black text-slate-900">{formatCurrencyAmount(especesReelles, "FCFA")}</span>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">Écart de Caisse :</span>
                  <div className="text-right">
                    {especesComptees === "" ? (
                      <span className="text-xs font-bold text-slate-400">En attente de comptage...</span>
                    ) : isEcartZero ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 size={13} />
                        0 FCFA (Caisse Équilibrée)
                      </span>
                    ) : isExcedent ? (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg font-mono">
                        <TrendingUp size={13} />
                        +{formatCurrencyAmount(ecart, "FCFA")} (Excédent)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg font-mono">
                        <AlertTriangle size={13} />
                        {formatCurrencyAmount(ecart, "FCFA")} (Déficit / Manquant)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observations / Remarques du Caissier (Optionnel)
                </label>
                <textarea
                  rows={2}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Ex: Facture #12 annulée sur accord client, monnaie rendue..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleValidate}
                disabled={especesComptees === ""}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Générer le Rapport Z</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: OFFICIAL PRINTABLE Z-REPORT (TICKET OR A4) */}
        {step === "print" && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between print:hidden pb-3 border-b border-slate-100">
              <button
                onClick={() => setStep("count")}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer flex items-center gap-1"
              >
                ← Modifier le comptage
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendWhatsApp}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <MessageSquare size={15} />
                  <span>Envoyer Rapport Z (WhatsApp)</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  <Printer size={15} />
                  <span>Imprimer le Rapport Z</span>
                </button>
              </div>
            </div>

            {/* PRINT AREA: THERMAL 80MM TICKET OR FORMAL A4 */}
            <div
              className={`bg-white text-slate-900 mx-auto transition-all ${
                format === "Ticket"
                  ? "w-[80mm] p-3 text-[11px] font-mono leading-tight space-y-3"
                  : "w-full p-8 text-xs font-sans space-y-5 border border-slate-200 rounded-2xl"
              }`}
            >
              {/* Header */}
              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <h2 className="font-black text-sm uppercase">{company?.nom_entreprise || "GESTION PRO GLOBAL"}</h2>
                <p className="text-[10px] text-slate-600">{company?.adresse || "Niamey, Niger"}</p>
                <p className="text-[9px] text-slate-500">Tél: {company?.telephone || "+227 00 00 00 00"}</p>
                <div className="mt-2 py-1 bg-slate-900 text-white rounded font-black text-xs uppercase tracking-widest">
                  RAPPORT Z - CLÔTURE DE CAISSE
                </div>
              </div>

              {/* Session Meta */}
              <div className="text-[10px] space-y-1 pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span>Date Clôture:</span>
                  <span className="font-bold">{new Date(closureDate).toLocaleDateString("fr-FR")} {new Date(closureDate).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Période:</span>
                  <span className="font-bold">{filters.start}</span>
                </div>
                <div className="flex justify-between">
                  <span>Caissier:</span>
                  <span className="font-bold uppercase">{filters.cashier === "Tous" ? userSession?.username || "Caisse" : filters.cashier}</span>
                </div>
                <div className="flex justify-between">
                  <span>Établissement:</span>
                  <span className="font-bold">BOUTIQUE CENTRALE</span>
                </div>
              </div>

              {/* Financial Totals */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between font-bold">
                  <span>Fond de Caisse Initial:</span>
                  <span>{formatCurrencyAmount(fondDeCaisse, "FCFA")}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Total Encaissements (+):</span>
                  <span className="font-bold">{formatCurrencyAmount(summary.totalIncome, "FCFA")}</span>
                </div>
                <div className="flex justify-between text-rose-700">
                  <span>Total Décaissements (-):</span>
                  <span className="font-bold">{formatCurrencyAmount(summary.totalExpenses, "FCFA")}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-300 font-bold">
                  <span>Net Opérationnel:</span>
                  <span>{formatCurrencyAmount(netBalance, "FCFA")}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-900 font-black text-xs">
                  <span>SOLDE THÉORIQUE:</span>
                  <span>{formatCurrencyAmount(soldeTheorique, "FCFA")}</span>
                </div>
              </div>

              {/* Counted vs Variance (Écart) */}
              <div className="p-2 rounded bg-slate-100 border border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between font-black">
                  <span>ESPÈCES COMPTÉES:</span>
                  <span>{formatCurrencyAmount(especesReelles, "FCFA")}</span>
                </div>
                <div className="flex justify-between font-black pt-1 border-t border-slate-300">
                  <span>ÉCART DE CAISSE:</span>
                  <span className={isDeficit ? "text-rose-700" : isExcedent ? "text-blue-700" : "text-emerald-700"}>
                    {isEcartZero
                      ? "0 FCFA (PARFAIT)"
                      : `${ecart > 0 ? "+" : ""}${formatCurrencyAmount(ecart, "FCFA")} (${isDeficit ? "DÉFICIT" : "EXCÉDENT"})`}
                  </span>
                </div>
              </div>

              {/* Observations */}
              {observations && (
                <div className="text-[10px] p-2 bg-slate-50 border border-slate-200 rounded">
                  <span className="font-bold block">Observations:</span>
                  <p className="italic text-slate-600">{observations}</p>
                </div>
              )}

              {/* Signatures */}
              <div className="pt-4 mt-4 border-t border-dashed border-slate-400 grid grid-cols-2 gap-4 text-[10px] text-center">
                <div>
                  <span className="font-bold block mb-8">Le Caissier</span>
                  <div className="border-t border-slate-400 pt-1 text-[9px] text-slate-500">Signature</div>
                </div>
                <div>
                  <span className="font-bold block mb-8">Visa Direction</span>
                  <div className="border-t border-slate-400 pt-1 text-[9px] text-slate-500">Cachet & Signature</div>
                </div>
              </div>

              <div className="text-center pt-2 text-[8px] text-slate-400">
                Document certifié • Gestion Pro Global v2.0
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
