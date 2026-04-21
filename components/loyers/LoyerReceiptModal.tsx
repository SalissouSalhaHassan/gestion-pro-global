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
        printFormat === 'A5' ? 'w-[145mm] rounded-[24px]' : 
        'w-full max-w-[190mm] rounded-[32px]'
      }`}>
        <div id="printable-receipt" className="p-4 md:p-6 text-black font-sans leading-tight">
          
          <div className="mb-2">
            <h1 className="text-xl font-black uppercase tracking-tight">{company?.nom_entreprise || "GestionPro"}</h1>
            <p className="text-xs font-black uppercase mt-0.5">{company?.adresse || ""}</p>
            <div className="text-[10px] font-medium mt-0.5">
              <p>Tél: {company?.telephone || ""} | NIF: {company?.nif || ""} | RC: {company?.rc || ""}</p>
            </div>
            <div className="w-full h-[1.5px] bg-black mt-2"></div>
          </div>

          <div className="bg-[#ebebeb] p-1.5 text-center mb-4 border border-black">
            <h2 className="text-lg font-black uppercase tracking-[0.2em]">REÇU DE PAIEMENT</h2>
          </div>

          <div className="flex justify-between items-start mb-4 text-[11px]">
            <div className="w-1/2 pr-2">
              <h3 className="font-black text-sm mb-1 border-b border-black pb-0.5">Détails du Reçu</h3>
              <div className="grid grid-cols-[80px_1fr] gap-x-1 gap-y-0.5">
                <span className="font-black">Reçu N°:</span> <span>{payment.id.toString().padStart(6, '0')}</span>
                <span className="font-black">Date:</span> <span>{new Date(payment.date_paiement).toLocaleDateString("fr-FR")}</span>
                <span className="font-black">Propriétaire:</span> <span>Admin</span>
              </div>
            </div>
            <div className="w-1/2 pl-2">
              <h3 className="font-black text-sm mb-1 border-b border-black pb-0.5">Locataire</h3>
              <p className="font-black text-sm">{contract.locataire_nom_complet}</p>
              <p className="font-medium text-[10px]">Réf: {contract.ref_locataire}</p>
              {contract.locataire_telephone && <p className="font-medium text-[10px]">Tél: {contract.locataire_telephone}</p>}
            </div>
          </div>

          <div className="mb-3">
            <table className="w-full border border-black border-collapse table-fixed">
              <thead>
                <tr className="bg-[#ebebeb] border-b border-black text-[11px]">
                  <th className="border-r border-black p-1 text-left font-black w-[40%]">Description</th>
                  <th className="border-r border-black p-1 text-center w-[20%] font-black">Période</th>
                  <th className="border-r border-black p-1 text-center w-[20%] font-black">Mode</th>
                  <th className="p-1 text-right w-[20%] font-black">Montant</th>
                </tr>
              </thead>
              <tbody className="font-medium text-[11px]">
                <tr className="border-b border-black last:border-b-0 h-16">
                  <td className="border-r border-black p-1 break-words leading-tight align-top">
                    <strong>Bien:</strong> {contract.bien_loue_details}<br/>
                    {payment.description && <><br/><strong>Obs:</strong> {payment.description}</>}
                  </td>
                  <td className="border-r border-black p-1 text-center align-top">
                    {payment.periode_debut ? `${new Date(payment.periode_debut).toLocaleDateString("fr-FR")} au ${new Date(payment.periode_fin).toLocaleDateString("fr-FR")}` : (payment.nom_de_mois || '-')}
                    <br/><span className="text-[9px] text-gray-600">{payment.qte_mois ? `${payment.qte_mois} mois` : ''}</span>
                  </td>
                  <td className="border-r border-black p-1 text-center align-top">{payment.mode_paiement}</td>
                  <td className="p-1 text-right font-bold align-top">{Number(payment.montant).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} F</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="italic mb-3 text-[10px] font-medium leading-tight">
            Arrêtée à la somme de : <span className="font-black uppercase">{numberToWordsFr(payment.montant)}</span> francs CFA.
          </p>

          <div className="flex flex-row w-full mb-4 border border-black min-h-[40px]">
            <div className="flex-1 border-r border-black p-1 text-center bg-[#f9f9f9] flex flex-col justify-center overflow-hidden">
              <span className="font-black uppercase text-[8px] leading-none shrink-0">LOYER MENSUEL</span>
              <span className="text-[11px] font-[900] mt-0.5 truncate">{Number(contract.loyer_mensuel).toLocaleString("fr-FR")} F</span>
            </div>
            <div className="flex-1 p-1 text-center bg-[#ebebeb] flex flex-col justify-center overflow-hidden">
              <span className="font-black uppercase text-[10px] leading-none shrink-0">MONTANT PAYÉ</span>
              <span className="text-sm font-[900] mt-0.5 truncate">{Number(payment.montant).toLocaleString("fr-FR")} F</span>
            </div>
          </div>

          <div className="mt-12 flex justify-between items-start text-[10px] font-black px-2">
            <div className="text-center w-[140px] border-t border-black pt-2">
              Signature Locataire
            </div>
            <div className="text-center w-[180px] border-t border-black pt-2 flex flex-col items-center">
              <span>Cachet et Signature Bailleur</span>
              <span className="italic font-bold mt-1 text-[9px]">(Lu et approuvé)</span>
            </div>
          </div>

          <div className="mt-8 text-center ticket-hide">
             <p className="text-[9px] font-bold text-slate-400">Ce reçu atteste du paiement reçu. Conservez ce document.</p>
          </div>
        </div>
      </div>

      <style jsx global>{\`
        @media print {
          body * { visibility: hidden; background: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          #printable-receipt {
            position: absolute; left: 0; top: 0; 
            width: 100% !important;
            padding: \${printFormat === 'Ticket' ? '0' : '5mm'} !important;
            margin: 0 !important; border: none !important;
          }
          .ticket-hide { display: \${printFormat === 'Ticket' ? 'none' : 'block'} !important; }
          @page { 
            size: \${printFormat === 'Ticket' ? '80mm auto' : printFormat === 'A5' ? 'A5 portrait' : 'A4 portrait'}; 
            margin: 0; 
          }
          .bg-[#ebebeb] { background-color: #ebebeb !important; }
          .bg-[#f9f9f9] { background-color: #f9f9f9 !important; }
        }
      \`}</style>
    </div>
  );
}
