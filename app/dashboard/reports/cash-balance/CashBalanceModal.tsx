"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  User,
  ShieldCheck,
  FileText,
  MapPin,
  ClipboardList
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type CashBalanceModalProps = {
  filters: { start: string; end: string; cashier: string };
  onClose: () => void;
};

export default function CashBalanceModal({ filters, onClose }: CashBalanceModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5' | 'Ticket'>('A4');
  const [docType, setDocType] = useState<'Journal' | 'Bilan Recap'>('Journal');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        const { data: comp } = await supabase
          .from("informations_entreprise")
          .select("*")
          .limit(1)
          .single();
        setCompany(comp);

        const params = new URLSearchParams({
            start: filters.start,
            end: filters.end,
            cashier: filters.cashier
        });
        const res = await fetch(`/api/reports/cash-balance?${params.toString()}`);
        const json = await res.json();
        setData(json);

      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [filters]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit text-sm">Génération du rapport financier...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar - Modernized Toggle Buttons */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-6 print:hidden z-[110]">
          {/* Paper Size Toggle */}
          <div className="bg-slate-200/80 backdrop-blur-md p-1.5 rounded-[24px] flex items-center shadow-lg border border-white/20">
             {['A4', 'A5', 'Ticket'].map((size) => (
               <button
                 key={size}
                 onClick={() => setPageSize(size as any)}
                 className={`px-6 py-2 rounded-2xl text-xs font-black transition-all ${
                   pageSize === size 
                   ? 'bg-indigo-600 text-white shadow-md scale-105' 
                   : 'text-slate-500 hover:text-slate-800'
                 }`}
               >
                 {size}
               </button>
             ))}
          </div>

          {/* Doc Type Toggle */}
          <div className="bg-slate-200/80 backdrop-blur-md p-1.5 rounded-[24px] flex items-center shadow-lg border border-white/20">
             <button
                onClick={() => setDocType('Journal')}
                className={`px-6 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                  docType === 'Journal' 
                  ? 'bg-emerald-600 text-white shadow-md scale-105' 
                  : 'text-slate-500 hover:text-slate-800'
                }`}
             >
                <ClipboardList size={14} /> Journal
             </button>
             <button
                onClick={() => setDocType('Bilan Recap')}
                className={`px-6 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                  docType === 'Bilan Recap' 
                  ? 'bg-slate-300 text-slate-600 shadow-md scale-105' 
                  : 'text-slate-500 hover:text-slate-800'
                }`}
             >
                <FileText size={14} /> Récap
             </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button 
              onClick={handlePrint}
              className="bg-indigo-600 text-white px-10 py-5 rounded-[28px] font-black shadow-2xl shadow-indigo-500/40 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all text-lg"
            >
              <Printer size={24} />
              Imprimer
            </button>
            <button 
              onClick={onClose}
              className="bg-white text-slate-400 p-5 rounded-[28px] shadow-xl border border-slate-100 hover:text-rose-500 hover:scale-110 transition-all active:scale-95"
            >
              <X size={28} />
            </button>
          </div>
      </div>

      {/* Report Paper Component */}
      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible transition-all duration-500 ${
        pageSize === 'A4' ? 'max-w-[210mm]' : pageSize === 'Ticket' ? 'max-w-[80mm]' : 'max-w-[148mm]'
      } w-full rounded-[40px] border border-slate-100 print:border-none`}>
        
        <div id="printable-report" className={`p-10 text-slate-900 font-outfit leading-tight relative overflow-hidden ${
           pageSize === 'Ticket' ? 'px-4 py-6' : 'p-10'
        }`}>
          
          {/* HEADER */}
          <div className={`flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-900 ${
             pageSize === 'Ticket' ? 'flex-col items-center text-center gap-4' : ''
          }`}>
            <div className={pageSize === 'Ticket' ? 'text-center' : 'text-left'}>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{company?.nom_entreprise || "ETS SOUNO"}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                {company?.adresse || "MARADI, NIGER"}
              </p>
              <div className={`flex items-center gap-4 mt-3 text-[9px] font-black text-slate-400 ${pageSize === 'Ticket' ? 'justify-center' : ''}`}>
                 <span className="flex items-center gap-1">NIF: {company?.nif}</span>
                 <span className="flex items-center gap-1">RC: {company?.rc}</span>
              </div>
            </div>
            {pageSize !== 'Ticket' && (
              <div className="text-right">
                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl mb-2">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em]">BILAN DE CAISSE</h2>
                </div>
                <div className="text-[10px] font-bold text-slate-500 space-y-0.5">
                    <p>Du: {new Date(filters.start).toLocaleDateString()}</p>
                    <p>Au: {new Date(filters.end).toLocaleDateString()}</p>
                    <p>User: {filters.cashier}</p>
                </div>
              </div>
            )}
          </div>

          {/* SUMMARY CARDS */}
          <div className={`grid ${pageSize === 'Ticket' ? 'grid-cols-1' : 'grid-cols-3'} gap-4 mb-8`}>
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg">
                    <TrendingUp size={18} />
                </div>
                <div>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Entrées</p>
                    <p className="text-lg font-black text-emerald-900">+{new Intl.NumberFormat('fr-FR').format(data.summary.totalIncome)}</p>
                </div>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-rose-500 text-white rounded-lg shadow-lg">
                    <TrendingDown size={18} />
                </div>
                <div>
                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-wider">Sorties</p>
                    <p className="text-lg font-black text-rose-900">-{new Intl.NumberFormat('fr-FR').format(data.summary.totalExpenses)}</p>
                </div>
            </div>
            <div className={`p-4 rounded-2xl flex items-center gap-3 border ${data.summary.netBalance >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
                <div className={`p-2 text-white rounded-lg shadow-lg ${data.summary.netBalance >= 0 ? 'bg-indigo-500 shadow-indigo-200' : 'bg-amber-500 shadow-amber-200'}`}>
                    <Scale size={18} />
                </div>
                <div>
                    <p className={`text-[9px] font-black uppercase tracking-wider ${data.summary.netBalance >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>Net</p>
                    <p className={`text-lg font-black ${data.summary.netBalance >= 0 ? 'text-indigo-900' : 'text-amber-900'}`}>
                        {new Intl.NumberFormat('fr-FR').format(data.summary.netBalance)}
                    </p>
                </div>
            </div>
          </div>

          {/* MAIN TABLE */}
          {docType === 'Journal' && (
            <div className="border border-slate-100 rounded-2xl overflow-hidden mb-12">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                        <th className="p-3">Date</th>
                        <th className="p-3">Référence</th>
                        <th className="p-3">Détails</th>
                        <th className="p-3 text-right">E</th>
                        <th className="p-3 text-right">S</th>
                     </tr>
                  </thead>
                  <tbody className="text-[9px] font-bold">
                     {data.entries.map((item: any, i: number) => (
                        <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                           <td className="p-3 text-slate-400">{new Date(item.date).toLocaleDateString('fr-FR').split('/').slice(0,2).join('/')}</td>
                           <td className="p-3 text-slate-800">{item.ref}</td>
                           <td className="p-3 text-slate-500 italic truncate max-w-[100px]">{item.type}</td>
                           <td className="p-3 text-right text-emerald-600">
                              {item.entree > 0 ? `+${new Intl.NumberFormat('fr-FR').format(item.entree)}` : '—'}
                           </td>
                           <td className="p-3 text-right text-rose-600">
                              {item.sortie > 0 ? `-${new Intl.NumberFormat('fr-FR').format(item.sortie)}` : '—'}
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          )}

          {/* SIGNATURES */}
          <div className={`grid ${pageSize === 'Ticket' ? 'grid-cols-1 gap-8' : 'grid-cols-2 gap-16'} mt-auto pt-10`}>
             <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-300 mb-8">Caissier</p>
                <div className="h-px bg-slate-100"></div>
             </div>
             <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-300 mb-8">Contrôle / Direction</p>
                <div className="h-px bg-slate-100"></div>
             </div>
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
          #printable-report, #printable-report * {
            visibility: visible;
          }
          #printable-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: ${pageSize === 'Ticket' ? '4mm' : '10mm'} !important;
            margin: 0 !important;
            font-family: 'Outfit', sans-serif !important;
          }
          @page {
            size: ${pageSize === 'Ticket' ? '80mm 200mm' : pageSize === 'A4' ? 'A4 portrait' : 'A5 portrait'};
            margin: 0;
          }
          .bg-slate-900 { background-color: #0f172a !important; color: #fff !important; }
          .bg-indigo-600 { background-color: #4f46e5 !important; color: #fff !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          .bg-indigo-50 { background-color: #eef2ff !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-rose-600 { color: #e11d48 !important; }
        }
      `}</style>
    </div>
  );
}

function Phone({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.19-1.32a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    )
}
