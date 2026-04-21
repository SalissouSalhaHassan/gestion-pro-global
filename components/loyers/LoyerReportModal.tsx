"use client";

import { useEffect, useState } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type LoyerReportModalProps = {
  onClose: () => void;
};

export default function LoyerReportModal({ onClose }: LoyerReportModalProps) {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<'A4' | 'A5' | 'Ticket'>('A4');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch Company Info
        const { data: compData } = await supabase.from("informations_entreprise").select("*").limit(1);
        setCompany(compData && compData.length > 0 ? compData[0] : null);

        // Fetch Payments via API to leverage existing logic
        const res = await fetch('/api/loyers/payments');
        if (!res.ok) throw new Error("Erreur lors du chargement des paiements");
        const data = await res.json();
        setPayments(data);
      } catch (err: any) {
        setError(err.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="font-bold text-slate-600">Préparation du rapport...</p>
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
          <button onClick={onClose} className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all">Fermer</button>
        </div>
      </div>
    );
  }

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.montant || 0), 0);
  const today = new Date();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 print:hidden z-[110]">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur p-2 rounded-2xl shadow-lg border border-white/20">
          {(['A4', 'A5'] as const).map((fmt) => (
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
        printFormat === 'A5' ? 'w-[145mm] rounded-[24px]' : 'w-full max-w-[190mm] rounded-[32px]'
      }`}>
        <div id="printable-report" className="p-4 md:p-6 text-black font-sans leading-tight">
          
          <div className="mb-2 text-center">
            <h1 className="text-xl font-black uppercase tracking-tight">{company?.nom_entreprise || "GestionPro"}</h1>
            <p className="text-xs font-black uppercase mt-0.5">{company?.adresse || ""}</p>
            <div className="w-full h-[1.5px] bg-black mt-2"></div>
          </div>

          <div className="bg-[#ebebeb] p-1.5 text-center mb-4 border border-black">
            <h2 className="text-lg font-black uppercase tracking-[0.2em]">RAPPORT DES PAIEMENTS DE LOYER</h2>
          </div>

          <div className="flex justify-between items-start mb-4 text-[11px]">
             <div>
                <span className="font-black">Imprimé le:</span> {today.toLocaleDateString('fr-FR')} à {today.toLocaleTimeString('fr-FR')}
             </div>
             <div>
                <span className="font-black">Total Transactions:</span> {payments.length}
             </div>
          </div>

          <table className="w-full border border-black border-collapse table-fixed mb-4">
            <thead>
              <tr className="bg-[#ebebeb] border-b border-black text-[10px]">
                <th className="border-r border-black p-1 text-center font-black w-[15%]">Date</th>
                <th className="border-r border-black p-1 text-left font-black w-[40%]">Locataire</th>
                <th className="border-r border-black p-1 text-center font-black w-[25%]">Période</th>
                <th className="p-1 text-right font-black w-[20%]">Montant (F)</th>
              </tr>
            </thead>
            <tbody className="font-medium text-[10px]">
              {payments.map((p, i) => (
                <tr key={i} className="border-b border-black last:border-b-0">
                  <td className="border-r border-black p-1 text-center">{new Date(p.date_paiement).toLocaleDateString("fr-FR")}</td>
                  <td className="border-r border-black p-1 break-words">{p.contrats?.locataire_nom_complet || '—'}</td>
                  <td className="border-r border-black p-1 text-center">{p.periode_debut ? `${new Date(p.periode_debut).toLocaleDateString("fr-FR")} au ${new Date(p.periode_fin).toLocaleDateString("fr-FR")}` : (p.nom_de_mois || '—')}</td>
                  <td className="p-1 text-right font-bold">{Number(p.montant).toLocaleString("fr-FR", { minimumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-row w-full mb-4 border border-black min-h-[40px]">
            <div className="flex-1 border-r border-black p-1 text-center bg-[#f9f9f9] flex flex-col justify-center overflow-hidden">
               <span className="font-black uppercase text-[10px] leading-none shrink-0">TOTAL REÇU</span>
               <span className="text-sm font-[900] mt-1">{totalAmount.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} F CFA</span>
            </div>
          </div>

          <div className="mt-8 text-center ticket-hide">
             <p className="text-[9px] font-bold text-slate-400">Page 1/1 - Généré par GestionPro</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; background: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report {
            position: absolute; left: 0; top: 0; 
            width: 100% !important;
            padding: 5mm !important;
            margin: 0 !important; border: none !important;
          }
          @page { 
            size: ${printFormat === 'A5' ? 'A5 portrait' : 'A4 portrait'}; 
            margin: 0; 
          }
          .bg-[#ebebeb] { background-color: #ebebeb !important; }
          .bg-[#f9f9f9] { background-color: #f9f9f9 !important; }
        }
      `}</style>
    </div>
  );
}
