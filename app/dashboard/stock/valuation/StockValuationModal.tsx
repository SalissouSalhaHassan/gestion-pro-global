"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  BarChart3,
  Calendar,
  Boxes,
  Wallet,
  TrendingUp,
  ShieldCheck,
  MapPin,
  ClipboardList,
  Info
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type StockValuationModalProps = {
  filters: { depot: string; categoryId: string };
  onClose: () => void;
};

export default function StockValuationModal({ filters, onClose }: StockValuationModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5' | 'Ticket'>('A4');
  const [printFormat, setPrintFormat] = useState<'P' | 'L'>('L'); // Portrait or Landscape

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

        const query = new URLSearchParams({
            depot: filters.depot,
            categoryId: filters.categoryId
        });
        const res = await fetch(`/api/stock/valuation?${query.toString()}`);
        const json = await res.json();
        setData(json);

      } catch (err) {
        console.error("Error fetching valuation data:", err);
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
          <p className="font-bold text-slate-600 font-outfit text-sm">Analyse de la valeur du stock...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-6 print:hidden z-[110]">
          {/* Paper Size & Orientation */}
          <div className="flex gap-4">
            <div className="bg-slate-200/80 backdrop-blur-md p-1.5 rounded-[24px] flex items-center shadow-lg border border-white/20">
               {['A4', 'A5'].map((size) => (
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
            <div className="bg-slate-200/80 backdrop-blur-md p-1.5 rounded-[24px] flex items-center shadow-lg border border-white/20">
               <button
                 onClick={() => setPrintFormat('P')}
                 className={`px-6 py-2 rounded-2xl text-xs font-black transition-all ${
                   printFormat === 'P' ? 'bg-slate-900 text-white' : 'text-slate-500'
                 }`}
               >
                 Portrait
               </button>
               <button
                 onClick={() => setPrintFormat('L')}
                 className={`px-6 py-2 rounded-2xl text-xs font-black transition-all ${
                   printFormat === 'L' ? 'bg-slate-900 text-white' : 'text-slate-500'
                 }`}
               >
                 Paysage
               </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <button 
              onClick={handlePrint}
              className="bg-indigo-600 text-white px-10 py-5 rounded-[28px] font-black shadow-2xl shadow-indigo-500/40 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all text-lg"
            >
              <Printer size={24} />
              Imprimer Rapport
            </button>
            <button 
              onClick={onClose}
              className="bg-white text-slate-400 p-5 rounded-[28px] shadow-xl border border-slate-100 hover:text-rose-500 transition-all active:scale-95"
            >
              <X size={28} />
            </button>
          </div>
      </div>

      {/* Report Paper Container */}
      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible transition-all duration-500 ${
        printFormat === 'L' ? 'max-w-[297mm]' : 'max-w-[210mm]'
      } w-full rounded-[40px] border border-slate-100 print:border-none`}>
        
        <div id="printable-valuation" className="p-10 text-slate-900 font-outfit leading-tight relative overflow-hidden">
          
          {/* HEADER */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-900">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{company?.nom_entreprise || "ETS SOUNO"}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                {company?.adresse || "MARADI, NIGER"}
              </p>
              <div className="flex items-center gap-4 mt-3 text-[9px] font-black text-slate-400">
                 <span className="flex items-center gap-1">NIF: {company?.nif}</span>
                 <span className="flex items-center gap-1">Tél: {company?.telephone}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-indigo-600 text-white px-6 py-2 rounded-xl mb-2">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em]">VALORISATION DU STOCK</h2>
              </div>
              <div className="text-[10px] font-bold text-slate-500 space-y-0.5">
                  <p>Dépôt: <span className="text-slate-900 font-black uppercase">{filters.depot}</span></p>
                  <p>Date d'Inventaire: {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          </div>

          {/* SUMMARY KPI */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Valeur Achat</p>
                <p className="text-lg font-black text-slate-900">{new Intl.NumberFormat('fr-FR').format(data.summary.total_valeur_achat)} F</p>
            </div>
            <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl">
                <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-1">Valeur Moyenne (PMP)</p>
                <p className="text-lg font-black text-purple-900">{new Intl.NumberFormat('fr-FR').format(data.summary.total_valeur_moyenne)} F</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Valeur Vente</p>
                <p className="text-lg font-black text-emerald-900">{new Intl.NumberFormat('fr-FR').format(data.summary.total_valeur_vente)} F</p>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest mb-1">Marge Latente</p>
                <p className="text-lg font-black text-rose-900">{new Intl.NumberFormat('fr-FR').format(data.summary.marge_latente)} F</p>
            </div>
          </div>

          {/* MAIN DATA TABLE */}
          <div className="border border-slate-100 rounded-2xl overflow-hidden mb-12">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                      <th className="p-3">Référence</th>
                      <th className="p-3">Désignation</th>
                      <th className="p-3 text-center">Stock</th>
                      <th className="p-3 text-right">P. Achat</th>
                      <th className="p-3 text-right">P. Moyen</th>
                      <th className="p-3 text-right">T. Achat</th>
                      <th className="p-3 text-right">T. Moyen</th>
                      <th className="p-3 text-right">T. Vente</th>
                   </tr>
                </thead>
                <tbody className="text-[9px] font-bold">
                   {data.items.map((item: any, i: number) => (
                        <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                           <td className="p-3 font-black text-slate-500">{item.reference}</td>
                           <td className="p-3 text-slate-800 uppercase truncate max-w-[150px]">{item.designation}</td>
                           <td className="p-3 text-center text-indigo-600 font-black">{new Intl.NumberFormat().format(item.quantite)}</td>
                           <td className="p-3 text-right">{new Intl.NumberFormat().format(item.p_achat_ht)}</td>
                           <td className="p-3 text-right text-purple-600">{new Intl.NumberFormat().format(item.p_moyen)}</td>
                           <td className="p-3 text-right font-black">{new Intl.NumberFormat().format(item.total_valeur_achat)}</td>
                           <td className="p-3 text-right font-black text-purple-700 bg-purple-50/20">{new Intl.NumberFormat().format(item.total_valeur_moyenne)}</td>
                           <td className="p-3 text-right font-black text-emerald-700">{new Intl.NumberFormat().format(item.total_valeur_vente)}</td>
                        </tr>
                   ))}
                </tbody>
             </table>
          </div>

          {/* FOOTER */}
          <div className="mt-auto grid grid-cols-2 gap-16 pt-12">
             <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-300 mb-10">Magasinier / Gestionnaire</p>
                <div className="h-px bg-slate-100"></div>
             </div>
             <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-300 mb-10">Visa Direction</p>
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
          #printable-valuation, #printable-valuation * {
            visibility: visible;
          }
          #printable-valuation {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 10mm !important;
            margin: 0 !important;
            font-family: 'Outfit', sans-serif !important;
          }
          @page {
            size: ${pageSize === 'A4' ? (printFormat === 'L' ? 'A4 landscape' : 'A4 portrait') : 'A5 landscape'};
            margin: 0;
          }
          .bg-slate-900 { background-color: #0f172a !important; color: #fff !important; }
          .bg-indigo-600 { background-color: #4f46e5 !important; color: #fff !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          .bg-purple-50 { background-color: #faf5ff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .text-emerald-700 { color: #047857 !important; }
          .text-purple-700 { color: #7e22ce !important; }
          .text-rose-600 { color: #e11d48 !important; }
        }
      `}</style>
    </div>
  );
}
