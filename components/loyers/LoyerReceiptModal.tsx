"use client";

import { useEffect, useState } from "react";
import { X, Printer, Loader2, FileText, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type LoyerReceiptModalProps = {
  paymentId: string | number;
  onClose: () => void;
};

export default function LoyerReceiptModal({ paymentId, onClose }: LoyerReceiptModalProps) {
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<'A4' | 'A5' | 'Ticket'>('A4');
  const [error, setError] = useState<string | null>(null);

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

    return convert(Math.floor(total)).charAt(0).toUpperCase() + convert(Math.floor(total)).slice(1);
  };

  const [history, setHistory] = useState<any[]>([]);
  const [allYearPayments, setAllYearPayments] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const numericId = typeof paymentId === 'string' ? Number(paymentId) : paymentId;
        
        // 1. Fetch Company Info
        const { data: compData } = await supabase.from("informations_entreprise").select("*").limit(1);
        setCompany(compData && compData.length > 0 ? compData[0] : null);

        // 2. Fetch Payment with Contract
        const { data: payData, error: payErr } = await supabase
          .from("contrat_paiements")
          .select(`*, contrats!inner(*)`)
          .eq("id", numericId)
          .single();
        
        if (payErr) throw new Error(`Erreur paiement: ${payErr.message}`);
        setPayment(payData);

        // 3. Fetch Payment History for this contract/month
        if (payData) {
          const { data: historyData } = await supabase
            .from("contrat_paiements")
            .select("*")
            .eq("contrat_id", payData.contrat_id)
            .order("date_paiement", { ascending: false })
            .limit(5);
          setHistory(historyData || []);

          // 4. Fetch All Payments for the Year
          const payYear = new Date(payData.date_paiement).getFullYear();
          const { data: yearData } = await supabase
            .from("contrat_paiements")
            .select("*")
            .eq("contrat_id", payData.contrat_id)
            .gte("periode_debut", `${payYear}-01-01`)
            .lte("periode_fin", `${payYear}-12-31`);
          
          // Also fetch based on nom_de_mois containing the year
          const { data: yearDataByMonth } = await supabase
            .from("contrat_paiements")
            .select("*")
            .eq("contrat_id", payData.contrat_id)
            .ilike("nom_de_mois", `%${payYear}%`);

          // Combine and deduplicate
          const combined = [...(yearData || []), ...(yearDataByMonth || [])];
          const unique = Array.from(new Map(combined.map(p => [p.id, p])).values());
          setAllYearPayments(unique);
        }

      } catch (err: any) {
        setError(err.message || "Erreur lors du chargement du reçu");
      } finally {
        setLoading(false);
      }
    }

    if (paymentId) fetchData();
  }, [paymentId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="font-bold text-slate-600">Préparation du reçu...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center max-w-md">
          <X className="text-red-500 mb-4" size={40} />
          <p className="font-bold text-slate-800 text-center mb-4">{error}</p>
          <button onClick={onClose} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  if (!payment) return null;

  const contract = payment.contrats;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 print:hidden z-[110]">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur p-2 rounded-2xl shadow-lg border border-white/20">
          {(['A4', 'A5', 'Ticket'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setPrintFormat(fmt)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                printFormat === fmt 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-indigo-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
            <Printer size={20} /> Imprimer
          </button>
          <button onClick={onClose} className="bg-white text-slate-400 p-3 rounded-2xl shadow-lg border border-slate-100 hover:text-rose-500 transition-colors">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Paper Component */}
      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible ${
        printFormat === 'Ticket' ? 'w-[320px] rounded-lg' : 
        printFormat === 'A5' ? 'w-[148mm] min-h-[210mm] rounded-[24px]' : 
        'w-full max-w-[210mm] min-h-[297mm] rounded-[32px]'
      }`}>
        <div id="printable-receipt" className="p-8 md:p-12 text-black font-sans leading-tight">
          
          {/* Header */}
          <div className="mb-6 flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900">{company?.nom_entreprise || "GESTION PRO"}</h1>
              <p className="text-sm font-bold text-slate-600 mt-1 uppercase">{company?.adresse || "ADRESSE NON CONFIGURÉE"}</p>
              <div className="text-[11px] font-bold text-slate-500 mt-1 flex flex-wrap gap-x-3">
                <span>Tél: {company?.telephone || "—"}</span>
                <span className="opacity-30">|</span>
                <span>NIF: {company?.nif || "—"}</span>
                <span className="opacity-30">|</span>
                <span>RC: {company?.rc || "—"}</span>
              </div>
            </div>
          </div>

          <div className="w-full h-[2px] bg-slate-900 mb-6"></div>

          {/* Title Box */}
          <div className="bg-slate-50 border-2 border-slate-900 p-3 text-center mb-8">
            <h2 className="text-xl font-black uppercase tracking-[0.3em] text-slate-900">REÇU DE PAIEMENT</h2>
          </div>

          {/* Info Section */}
          <div className="grid grid-cols-2 gap-12 mb-8 text-[12px]">
            <div>
              <h3 className="font-black text-sm mb-3 border-b-2 border-slate-900 pb-1 uppercase">Détails du Paiement</h3>
              <div className="space-y-1.5">
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-black text-slate-500 uppercase">Reçu N°:</span>
                  <span className="font-bold text-slate-900">{payment.id.toString().padStart(6, '0')}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-black text-slate-500 uppercase">Date:</span>
                  <span className="font-bold text-slate-900">{new Date(payment.date_paiement).toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-black text-slate-500 uppercase">Gérant:</span>
                  <span className="font-bold text-slate-900">Admin</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <span className="font-black text-slate-500 uppercase">Mode:</span>
                  <span className="font-bold text-slate-900">{payment.mode_paiement}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-black text-sm mb-3 border-b-2 border-slate-900 pb-1 uppercase">Locataire</h3>
              <div className="space-y-1.5">
                <p className="font-black text-base text-slate-900 leading-none">{contract.locataire_nom_complet}</p>
                <p className="font-bold text-slate-600">Réf: {contract.ref_locataire}</p>
                {contract.locataire_telephone && <p className="font-bold text-slate-600">Tél: {contract.locataire_telephone}</p>}
                {contract.adresse_complete && <p className="font-bold text-slate-600 leading-tight">{contract.adresse_complete}</p>}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 border-2 border-slate-900 text-[12px]">
                  <th className="p-3 text-left font-black uppercase border-r-2 border-slate-900">Description</th>
                  <th className="p-3 text-center font-black uppercase border-r-2 border-slate-900 w-24">Qté (Mois)</th>
                  <th className="p-3 text-right font-black uppercase border-r-2 border-slate-900 w-32">Loyer Mens.</th>
                  <th className="p-3 text-right font-black uppercase w-32">Total</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                <tr className="border-x-2 border-b-2 border-slate-900 min-h-[80px]">
                  <td className="p-4 border-r-2 border-slate-900 align-top">
                    <p className="font-black text-slate-900 mb-1">LOCATION DU BIEN : {contract.bien_loue_details}</p>
                    <p className="font-bold text-slate-600 italic">Période: {payment.periode_debut ? `${new Date(payment.periode_debut).toLocaleDateString("fr-FR")} au ${new Date(payment.periode_fin).toLocaleDateString("fr-FR")}` : (payment.nom_de_mois || '—')}</p>
                    {payment.description && <p className="mt-3 text-slate-500 font-medium">Note: {payment.description}</p>}
                  </td>
                  <td className="p-4 text-center border-r-2 border-slate-900 font-bold align-top">
                    {payment.qte_mois || 1}
                  </td>
                  <td className="p-4 text-right border-r-2 border-slate-900 font-bold align-top">
                    {Number(contract.loyer_mensuel).toLocaleString("fr-FR")}
                  </td>
                  <td className="p-4 text-right font-black text-slate-900 align-top text-sm">
                    {Number(payment.montant).toLocaleString("fr-FR")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="mb-10 italic text-[11px] font-bold text-slate-600">
            Arrêtée la présente somme à : <span className="font-black uppercase text-slate-900">{numberToWordsFr(payment.montant)} francs CFA.</span>
          </div>

          {/* Summary Boxes */}
          <div className="grid grid-cols-3 border-2 border-slate-900 mb-12">
            <div className="p-3 text-center border-r-2 border-slate-900 bg-slate-50">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">TOTAL À PAYER</p>
              <p className="text-lg font-black text-slate-900">{Number(payment.montant).toLocaleString("fr-FR")} F</p>
            </div>
            <div className="p-3 text-center border-r-2 border-slate-900 bg-white">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">MONTANT PAYÉ</p>
              <p className="text-lg font-black text-slate-900">{Number(payment.montant).toLocaleString("fr-FR")} F</p>
            </div>
            <div className="p-3 text-center bg-slate-50">
              <p className="text-[10px] font-black uppercase text-slate-500 mb-1">RESTE À PAYER</p>
              <p className="text-lg font-black text-slate-900">0 F</p>
            </div>
          </div>

          {/* History Table */}
          {history.length > 0 && (
            <div className="mb-12">
              <h3 className="text-[11px] font-black uppercase mb-3 text-slate-900">Historique des Versements</h3>
              <table className="w-full text-[10px] border-collapse">
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
                    <tr key={i} className="border-x-2 border-b border-slate-900 last:border-b-2">
                      <td className="p-2 border-r border-slate-300 font-bold">{new Date(h.date_paiement).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2 text-center border-r border-slate-300 font-bold">{h.mode_paiement}</td>
                      <td className="p-2 border-r border-slate-300 font-bold">{h.nom_de_mois || "Paiement direct"}</td>
                      <td className="p-2 text-right font-black">{Number(h.montant).toLocaleString("fr-FR")} F</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 12-Month Status Grid */}
          <div className="mb-12 border-2 border-slate-900 p-4 rounded-2xl bg-slate-50/50">
            <h3 className="text-[11px] font-black uppercase mb-4 text-slate-900 flex items-center gap-2">
              <ClipboardList size={14} className="text-indigo-600" />
              État de Paiement Annuel ({new Date(payment.date_paiement).getFullYear()})
            </h3>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"].map((month, idx) => {
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
                  <div key={month} className={`border p-2 rounded-xl text-center transition-all ${
                    isPaid ? "border-emerald-500 bg-emerald-50" : "border-rose-200 bg-rose-50"
                  }`}>
                    <p className="text-[9px] font-black uppercase text-slate-500 mb-1">{month}</p>
                    <span className={`text-[10px] font-black px-1 py-0.5 rounded-full ${
                      isPaid ? "text-emerald-700" : "text-rose-700"
                    }`}>
                      {isPaid ? "PAYÉ" : "IMPAYÉ"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-auto grid grid-cols-2 gap-20 pt-10 px-4">
            <div className="text-center">
              <p className="text-[11px] font-black uppercase mb-16 border-b-2 border-slate-900 pb-1">Signature Locataire</p>
              <p className="text-[10px] font-bold text-slate-400 italic">(Lu et approuvé)</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] font-black uppercase mb-16 border-b-2 border-slate-900 pb-1">Cachet et Signature Bailleur</p>
              <div className="flex justify-center">
                 {/* Stamp Placeholder */}
                 <div className="w-20 h-20 border-4 border-slate-200 rounded-full flex items-center justify-center opacity-20 rotate-12">
                   <span className="text-[10px] font-black uppercase text-center">Gestion<br/>Pro</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 flex justify-between items-center text-[10px] font-bold text-slate-400 border-t pt-4">
            <span>GestionPro - Système de Gestion Immobilière</span>
            <span className="uppercase tracking-widest">Page 1 / 1</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; background: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt {
            position: absolute; left: 0; top: 0; 
            width: 100% !important;
            padding: ${printFormat === 'Ticket' ? '0' : '5mm'} !important;
            margin: 0 !important; border: none !important;
          }
          .ticket-hide { display: ${printFormat === 'Ticket' ? 'none' : 'block'} !important; }
          @page { 
            size: ${printFormat === 'Ticket' ? '80mm auto' : printFormat === 'A5' ? 'A5 portrait' : 'A4 portrait'}; 
            margin: 0; 
          }
          .bg-[#ebebeb] { background-color: #ebebeb !important; }
          .bg-[#f9f9f9] { background-color: #f9f9f9 !important; }
        }
      `}</style>
    </div>
  );
}
