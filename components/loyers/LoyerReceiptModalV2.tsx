"use client";

import { useEffect, useState } from "react";
import { X, Printer, Loader2, FileText, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type LoyerReceiptModalProps = {
  paymentId: string | number;
  onClose: () => void;
};

export default function LoyerReceiptModalV2({ paymentId, onClose }: LoyerReceiptModalProps) {
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<'A4' | 'A5' | 'Ticket'>('A4');
  const [allYearPayments, setAllYearPayments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!paymentId) return;
      setLoading(true);
      try {
        // Fetch Payment
        const { data: payData, error: payErr } = await supabase
          .from("contrat_paiements")
          .select(`
            *,
            contrats (*)
          `)
          .eq("id", paymentId)
          .single();

        if (payErr) throw payErr;
        setPayment(payData);

        // Fetch History
        const { data: histData } = await supabase
          .from("contrat_paiements")
          .select("*")
          .eq("contrat_id", payData.contrat_id)
          .order("date_paiement", { ascending: false })
          .limit(5);
        setHistory(histData || []);

        // Fetch All Year Payments for Grid
        const year = new Date(payData.date_paiement).getFullYear();
        const { data: yearData } = await supabase
          .from("contrat_paiements")
          .select("*")
          .eq("contrat_id", payData.contrat_id)
          .or(`periode_debut.gte.${year}-01-01,periode_fin.lte.${year}-12-31,nom_de_mois.ilike.%${year}%`);
        
        setAllYearPayments(yearData || []);

        // Fetch Company
        const { data: compData } = await supabase.from("informations_entreprise").select("*").single();
        setCompany(compData);

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [paymentId]);

  const numberToWordsFr = (total: number) => {
    if (total === 0) return "zéro";
    const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
    const convert = (n: number): string => {
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 70) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return tens[t] + (r === 1 ? ' et ' : (r > 0 ? '-' : '')) + ones[r];
      }
      if (n < 80) return "soixante-" + convert(n - 60);
      if (n < 100) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return (t === 8 ? "quatre-vingt" : "quatre-vingt-") + (r > 0 ? (t === 8 ? "-" : "") + convert(r) : "");
      }
      if (n < 1000) {
        const c = Math.floor(n / 100);
        const r = n % 100;
        return (c === 1 ? "cent" : ones[c] + " cent") + (r > 0 ? " " + convert(r) : "");
      }
      const m = Math.floor(n / 1000);
      const r = n % 1000;
      return (m === 1 ? "mille" : convert(m) + " mille") + (r > 0 ? " " + convert(r) : "");
    };
    const res = convert(Math.floor(total));
    return res.charAt(0).toUpperCase() + res.slice(1);
  };

  if (!paymentId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Modal Header */}
        <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-500 p-2 rounded-xl">
              <Printer className="text-white" size={20} />
            </div>
            <div>
              <h3 className="text-white font-black text-lg">Aperçu du Reçu</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Format {printFormat}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={printFormat}
              onChange={(e) => setPrintFormat(e.target.value as any)}
              className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl border-none focus:ring-2 ring-indigo-500"
            >
              <option value="A4">Format A4</option>
              <option value="A5">Format A5</option>
              <option value="Ticket">Ticket (80mm)</option>
            </select>
            <button 
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
            >
              <Printer size={16} /> IMPRIMER
            </button>
            <button 
              onClick={onClose}
              className="bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-500 p-2 rounded-xl transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Receipt Content */}
        <div className="p-8 max-h-[80vh] overflow-y-auto bg-slate-100/50">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center text-rose-500 gap-4">
              <p className="font-bold">Erreur: {error}</p>
              <button onClick={onClose} className="text-slate-900 underline font-black">Fermer</button>
            </div>
          ) : (
            <div id="printable-receipt" className="bg-white mx-auto shadow-2xl p-10 min-h-[297mm] flex flex-col">
              {/* Receipt Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-1">
                    {company?.nom_entreprise || "ETS SOUNO"}
                  </h1>
                  <p className="text-slate-500 font-bold text-sm uppercase">{company?.adresse || "MARADI-NIGER"}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-[10px] font-black text-slate-400 uppercase">
                    <span>Tél: {company?.telephone || "98 41 03 99"}</span>
                    <span>NIF: {company?.nif || "11835/R"}</span>
                    <span>RC: {company?.rc || "NI-MAR-2007-A-93"}</span>
                  </div>
                </div>
              </div>

              <div className="h-0.5 bg-slate-900 w-full mb-6"></div>

              <div className="border-4 border-slate-900 p-3 text-center mb-6 bg-slate-50">
                <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-slate-900">REÇU DE PAIEMENT</h2>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <h3 className="text-xs font-black uppercase mb-4 text-slate-900 border-b-2 border-slate-900 pb-1">Détails du Paiement</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="font-black text-slate-400 uppercase text-[10px]">REÇU N° :</span>
                      <span className="font-bold text-slate-900 font-mono">{String(payment.id).padStart(6, '0')}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="font-black text-slate-400 uppercase text-[10px]">DATE :</span>
                      <span className="font-bold text-slate-900">{new Date(payment.date_paiement).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="font-black text-slate-400 uppercase text-[10px]">GÉRANT :</span>
                      <span className="font-bold text-slate-900">Admin</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="font-black text-slate-400 uppercase text-[10px]">MODE :</span>
                      <span className="font-bold text-slate-900">{payment.mode_paiement}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black uppercase mb-4 text-slate-900 border-b-2 border-slate-900 pb-1">Locataire</h3>
                  <div className="space-y-1">
                    <p className="text-lg font-black text-slate-900 leading-tight">{payment.contrats.locataire_nom_complet}</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Réf: {payment.contrats.ref_locataire}</p>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{payment.contrats.locataire_telephone || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* 12-Month Status Grid */}
              <div className="mb-6 border-4 border-slate-900 p-4 rounded-3xl bg-slate-50 shadow-xl">
                <h3 className="text-[14px] font-black uppercase mb-4 text-slate-900 border-b-2 border-slate-900 pb-2">
                  📊 ÉTAT DE PAIEMENT ANNUEL ({new Date(payment.date_paiement).getFullYear()})
                </h3>
                <table className="w-full border-collapse">
                  <tbody>
                    {[0, 1].map(rowIdx => (
                      <tr key={rowIdx}>
                        {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
                          .slice(rowIdx * 6, (rowIdx + 1) * 6)
                          .map((month, subIdx) => {
                            const idx = rowIdx * 6 + subIdx;
                            const year = new Date(payment.date_paiement).getFullYear();
                            const isPaid = (allYearPayments || []).some(p => {
                              if (p.nom_de_mois && p.nom_de_mois.includes(`${month} ${year}`)) return true;
                              if (p.periode_debut && p.periode_fin) {
                                const start = new Date(p.periode_debut);
                                const end = new Date(p.periode_fin);
                                const targetStart = new Date(year, idx, 1);
                                const targetEnd = new Date(year, idx + 1, 0);
                                return start <= targetEnd && end >= targetStart;
                              }
                              return false;
                            });
                            return (
                              <td key={month} className="p-1 w-1/6">
                                <div className={`border-2 p-2 rounded-xl text-center ${
                                  isPaid ? "border-emerald-500 bg-emerald-50 shadow-inner" : "border-slate-300 bg-white"
                                }`}>
                                  <p className="text-[9px] font-black uppercase text-slate-500 mb-1">{month}</p>
                                  <span className={`text-[10px] font-black ${
                                    isPaid ? "text-emerald-700" : "text-rose-600"
                                  }`}>
                                    {isPaid ? "PAYÉ" : "IMPAYÉ"}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* History Table */}
              {history.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-black uppercase mb-3 text-slate-900">Historique des Versements</h3>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-2 border-slate-900">
                        <th className="p-2 text-left font-black uppercase border-r border-slate-300">Date</th>
                        <th className="p-2 text-center font-black uppercase border-r border-slate-300">Moyen</th>
                        <th className="p-2 text-left font-black uppercase border-r border-slate-300">Référence / Mois</th>
                        <th className="p-2 text-right font-black uppercase">Versement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h, i) => (
                        <tr key={i} className="border-x-2 border-b border-slate-900 font-bold">
                          <td className="p-2 border-r border-slate-300">{new Date(h.date_paiement).toLocaleDateString("fr-FR")}</td>
                          <td className="p-2 text-center border-r border-slate-300">{h.mode_paiement}</td>
                          <td className="p-2 border-r border-slate-300">{h.nom_de_mois || "—"}</td>
                          <td className="p-2 text-right font-black">{Number(h.montant).toLocaleString("fr-FR")} F</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-x-2 border-b-2 border-slate-900 font-black bg-slate-50">
                        <td colSpan={3} className="p-2 text-right uppercase border-r border-slate-300">Total des Versements</td>
                        <td className="p-2 text-right">{history.reduce((sum, h) => sum + Number(h.montant || 0), 0).toLocaleString("fr-FR")} F</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Signatures */}
              <div className="mt-auto grid grid-cols-2 gap-20 pt-8 px-4">
                <div className="text-center">
                  <p className="text-xs font-black uppercase mb-10 border-b-2 border-slate-900 pb-1">Signature Locataire</p>
                  <p className="text-[10px] font-bold text-slate-400 italic">(Lu et approuvé)</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-black uppercase mb-10 border-b-2 border-slate-900 pb-1">Cachet et Signature Bailleur</p>
                  <div className="flex justify-center opacity-10">
                    <div className="w-20 h-20 border-4 border-slate-400 rounded-full flex items-center justify-center rotate-12">
                      <span className="text-[10px] font-black text-center leading-tight">GESTION<br/>PRO</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span>GestionPro - Système de Gestion Immobilière</span>
                <span className="tracking-[0.2em]">PAGE 1 / 1</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; background: none !important; }
          #printable-receipt, #printable-receipt * { visibility: visible !important; }
          #printable-receipt {
            position: absolute !important; left: 0 !important; top: 0 !important; 
            width: 100% !important; margin: 0 !important; padding: 10mm !important;
            box-shadow: none !important; border: none !important;
          }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </div>
  );
}
