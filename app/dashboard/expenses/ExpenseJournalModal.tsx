"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  TrendingDown,
  Calendar,
  User,
  ShieldCheck,
  FileText,
  MapPin,
  ClipboardList
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type ExpenseJournalModalProps = {
  filters: { start: string; end: string; oper: string };
  onClose: () => void;
};

export default function ExpenseJournalModal({ filters, onClose }: ExpenseJournalModalProps) {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5' | 'Ticket'>('A4');

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

        const q = new URLSearchParams(filters).toString();
        const res = await fetch(`/api/expenses?${q}`);
        const data = await res.json();
        setExpenses(data || []);

      } catch (err) {
        console.error("Error fetching expense data:", err);
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
          <Loader2 className="animate-spin text-rose-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit text-sm">Génération du journal des dépenses...</p>
        </div>
      </div>
    );
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.montant || 0), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-6 print:hidden z-[110]">
          <div className="bg-slate-200/80 backdrop-blur-md p-1.5 rounded-[24px] flex items-center shadow-lg border border-white/20">
             {['A4', 'A5', 'Ticket'].map((size) => (
               <button
                 key={size}
                 onClick={() => setPageSize(size as any)}
                 className={`px-6 py-2 rounded-2xl text-xs font-black transition-all ${
                   pageSize === size 
                   ? 'bg-rose-600 text-white shadow-md scale-105' 
                   : 'text-slate-500 hover:text-slate-800'
                 }`}
               >
                 {size}
               </button>
             ))}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handlePrint}
              className="bg-rose-600 text-white px-10 py-5 rounded-[28px] font-black shadow-2xl shadow-rose-500/40 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all text-lg"
            >
              <Printer size={24} />
              Imprimer Journal
            </button>
            <button 
              onClick={onClose}
              className="bg-white text-slate-400 p-5 rounded-[28px] shadow-xl border border-slate-100 hover:text-rose-500 transition-all active:scale-95"
            >
              <X size={28} />
            </button>
          </div>
      </div>

      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible transition-all duration-500 ${
        pageSize === 'A4' ? 'max-w-[210mm]' : pageSize === 'Ticket' ? 'max-w-[80mm]' : 'max-w-[148mm]'
      } w-full rounded-[40px] border border-slate-100 print:border-none`}>
        
        <div id="printable-expenses" className={`p-10 text-slate-900 font-outfit leading-tight relative overflow-hidden ${
           pageSize === 'Ticket' ? 'px-4 py-6' : 'p-10'
        }`}>
          
          <div className={`flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-900 ${
             pageSize === 'Ticket' ? 'flex-col items-center text-center gap-4' : ''
          }`}>
            <div className={pageSize === 'Ticket' ? 'text-center' : 'text-left'}>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{company?.nom_entreprise || "ETS SOUNO"}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                {company?.adresse || "MARADI, NIGER"}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-rose-600 text-white px-6 py-2 rounded-xl mb-2">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em]">JOURNAL DES DÉPENSES</h2>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Imprimé le: {new Date().toLocaleString()}</p>
            </div>
          </div>

          <div className="mb-8 p-6 bg-rose-50 border border-rose-100 rounded-3xl flex items-center justify-between">
             <div>
                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Total Sorties de Caisse</p>
                <p className="text-3xl font-black text-rose-900">{new Intl.NumberFormat('fr-FR').format(total)} F CFA</p>
             </div>
             <TrendingDown size={40} className="text-rose-200" />
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-hidden mb-12">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3">Libellé / Réf</th>
                      <th className="p-3">User</th>
                      <th className="p-3 text-right">Montant</th>
                   </tr>
                </thead>
                <tbody className="text-[9px] font-bold">
                   {expenses.map((exp, i) => (
                        <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                           <td className="p-3 text-slate-400">{new Date(exp.date_depense).toLocaleDateString('fr-FR')}</td>
                           <td className="p-3 text-slate-800">
                              <p className="uppercase">{exp.libelle}</p>
                              <p className="text-[8px] text-slate-400">REF: {exp.no_caisse}</p>
                           </td>
                           <td className="p-3 text-slate-500">{exp.operateur}</td>
                           <td className="p-3 text-right font-black text-rose-600">-{new Intl.NumberFormat('fr-FR').format(exp.montant)}</td>
                        </tr>
                   ))}
                </tbody>
             </table>
          </div>

          <div className={`grid ${pageSize === 'Ticket' ? 'grid-cols-1 gap-8' : 'grid-cols-2 gap-16'} mt-auto pt-10`}>
             <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-300 mb-8">Opérateur</p>
                <div className="h-px bg-slate-100"></div>
             </div>
             <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-300 mb-8">Autorisation</p>
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
          #printable-expenses, #printable-expenses * {
            visibility: visible;
          }
          #printable-expenses {
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
          .bg-rose-600 { background-color: #e11d48 !important; color: #fff !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          .text-rose-600 { color: #e11d48 !important; }
        }
      `}</style>
    </div>
  );
}
