"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  Wallet,
  Calendar,
  User,
  Info
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type AdvanceReceiptModalProps = {
  advanceId: number;
  onClose: () => void;
};

export default function AdvanceReceiptModal({ advanceId, onClose }: AdvanceReceiptModalProps) {
  const [loading, setLoading] = useState(true);
  const [advance, setAdvance] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);

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

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // 1. Fetch Company Info
        const { data: comp } = await supabase
          .from("informations_entreprise")
          .select("*")
          .limit(1)
          .single();
        setCompany(comp);

        // 2. Fetch Advance with Client
        const { data: adv } = await supabase
          .from("avances_clients")
          .select("*, clients(nom, tel, adresse)")
          .eq("id", advanceId)
          .single();
        
        setAdvance(adv);

      } catch (err) {
        console.error("Error fetching advance data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (advanceId) fetchData();
  }, [advanceId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit">Préparation du reçu...</p>
        </div>
      </div>
    );
  }

  if (!advance) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar (Hidden on Print) */}
      <div className="absolute top-6 right-6 flex items-center gap-3 print:hidden z-[110]">
          <button 
            onClick={handlePrint}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-blue-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <Printer size={20} />
            Imprimer
          </button>
          <button 
            onClick={onClose}
            className="bg-white text-slate-400 p-3 rounded-2xl shadow-lg border border-slate-100 hover:text-rose-500 transition-colors"
          >
            <X size={24} />
          </button>
      </div>

      {/* Report Paper Component (A5 Style) */}
      <div className="bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible max-w-[148mm] w-full rounded-[32px]">
        
        <div id="printable-advance" className="p-8 text-black font-outfit leading-tight border-[12px] border-slate-50 print:border-none">
          
          {/* HEADER */}
          <div className="mb-6 border-b border-black pb-4 text-center">
            <h1 className="text-xl font-black uppercase tracking-tighter">{company?.nom_entreprise || "ETS TASSIOU KOMMA"}</h1>
            <p className="text-[10px] font-black uppercase mt-1">{company?.adresse || "MARADI, NIGER"}</p>
            <p className="text-[9px] font-bold text-slate-500">Tél: {company?.telephone} | NIF: {company?.nif}</p>
          </div>

          {/* TITLE BOX */}
          <div className="bg-slate-100 p-3 text-center mb-6 border-y-2 border-slate-900">
            <h2 className="text-lg font-black uppercase tracking-[0.2em] text-slate-900">REÇU DE DÉPÔT / AVANCE</h2>
          </div>

          {/* DETAILS GRID */}
          <div className="grid grid-cols-2 gap-8 mb-8 text-[11px]">
            <div className="space-y-2">
                <div className="flex border-b border-slate-100 pb-1">
                    <span className="font-black w-24 uppercase text-slate-400 text-[9px]">Reçu N°</span>
                    <span className="font-black text-slate-900">#{advance.id} / {advance.reference_paiement || 'REF-NCR'}</span>
                </div>
                <div className="flex border-b border-slate-100 pb-1">
                    <span className="font-black w-24 uppercase text-slate-400 text-[9px]">Date</span>
                    <span className="font-black text-slate-900">{new Date(advance.date_avance).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex border-b border-slate-100 pb-1">
                    <span className="font-black w-24 uppercase text-slate-400 text-[9px]">Mode</span>
                    <span className="font-black text-slate-900">{advance.moyen_paiement}</span>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex border-b border-slate-100 pb-1">
                    <span className="font-black w-24 uppercase text-slate-400 text-[9px]">Client</span>
                    <span className="font-black text-slate-900 uppercase">{advance.clients?.nom}</span>
                </div>
                <div className="flex border-b border-slate-100 pb-1">
                    <span className="font-black w-24 uppercase text-slate-400 text-[9px]">Téléphone</span>
                    <span className="font-black text-slate-900">{advance.clients?.tel || 'N/A'}</span>
                </div>
                <div className="flex border-b border-slate-100 pb-1">
                    <span className="font-black w-24 uppercase text-slate-400 text-[9px]">Statut</span>
                    <span className="font-black text-blue-600">{advance.statut}</span>
                </div>
            </div>
          </div>

          {/* AMOUNT BOX */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl mb-6 text-center shadow-xl shadow-slate-200">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Montant du Dépôt</p>
            <p className="text-4xl font-black">{new Intl.NumberFormat('fr-FR').format(advance.montant_initial)} <span className="text-xl opacity-60">FCFA</span></p>
          </div>

          {/* AMOUNT IN WORDS */}
          <div className="italic text-[11px] mb-8 p-4 bg-slate-50 rounded-2xl border-l-4 border-slate-900">
            Arrêté le présent reçu à la somme de : <br/>
            <span className="font-black uppercase text-slate-900 tracking-tight">{numberToWordsFr(advance.montant_initial)}</span> francs CFA.
          </div>

          {/* RECAP TABLE */}
          <div className="mb-10 text-[11px]">
            <table className="w-full border-collapse border border-slate-200">
                <thead>
                    <tr className="bg-slate-100 text-slate-500 uppercase text-[9px] font-black border-b border-slate-200">
                        <th className="p-2 text-left border-r border-slate-200">Désignation</th>
                        <th className="p-2 text-right">Valeur (F)</th>
                    </tr>
                </thead>
                <tbody className="font-bold">
                    <tr className="border-b border-slate-100">
                        <td className="p-2 border-r border-slate-200">Dépôt Initial</td>
                        <td className="p-2 text-right">{new Intl.NumberFormat('fr-FR').format(advance.montant_initial)}</td>
                    </tr>
                    <tr className="border-b border-slate-100 text-orange-600">
                        <td className="p-2 border-r border-slate-200 italic">Consommé / Retiré (-)</td>
                        <td className="p-2 text-right">-{new Intl.NumberFormat('fr-FR').format(advance.montant_initial - advance.montant_restant)}</td>
                    </tr>
                    <tr className="bg-slate-50 text-blue-600 text-sm">
                        <td className="p-3 border-r border-slate-200 font-black uppercase">Solde Restant (=)</td>
                        <td className="p-3 text-right font-black">{new Intl.NumberFormat('fr-FR').format(advance.montant_restant)}</td>
                    </tr>
                </tbody>
            </table>
          </div>

          {/* NOTES IF ANY */}
          {advance.notes && (
              <div className="mb-10 text-[10px] text-slate-500">
                <span className="font-black text-slate-900 block mb-1">Observation :</span>
                <p className="p-3 bg-slate-50 rounded-xl italic leading-normal border border-slate-100">{advance.notes}</p>
              </div>
          )}

          {/* SIGNATURES */}
          <div className="grid grid-cols-2 gap-12 mt-auto">
            <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-16">Signature Client</p>
                <div className="h-px bg-slate-200"></div>
            </div>
            <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-16">Cachet & Signature</p>
                <div className="h-px bg-slate-200"></div>
            </div>
          </div>

          {/* FOOTER SMALL PRINT */}
          <div className="mt-12 text-center text-[8px] font-bold text-slate-300 italic">
            Ce document est un titre de créance. Prière de le conserver pour toute opération ultérieure.
          </div>

        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
        
        @media print {
          body * {
            visibility: hidden;
            background: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-advance, #printable-advance * {
            visibility: visible;
          }
          #printable-advance {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 8mm !important;
            margin: 0 !important;
            font-family: 'Outfit', sans-serif !important;
          }
          @page {
            size: A5 portrait;
            margin: 5mm;
          }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
          .bg-slate-900 { background-color: #0f172a !important; color: #fff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .text-white { color: #fff !important; }
          .text-blue-600 { color: #2563eb !important; }
          .text-orange-600 { color: #ea580c !important; }
          .border-slate-900 { border-color: #0f172a !important; }
        }
      `}</style>
    </div>
  );
}
