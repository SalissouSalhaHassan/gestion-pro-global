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
  User
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
  const [printFormat, setPrintFormat] = useState<'A4' | 'A4-L'>('A4');

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

        // 2. Fetch Report Data
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
          <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit">Génération du bilan en cours...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar (Hidden on Print) */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 print:hidden z-[110]">
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur p-2 rounded-2xl shadow-lg border border-white/20">
          {(['A4', 'A4-L'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setPrintFormat(fmt)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                printFormat === fmt 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {fmt === 'A4' ? 'Portrait' : 'Paysage'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-emerald-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
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
      </div>

      {/* Report Paper Component */}
      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible transition-all duration-500 ${
        printFormat === 'A4-L' ? 'max-w-[280mm] w-full rounded-[32px]' : 'max-w-[190mm] w-full rounded-[32px]'
      }`}>
        
        <div id="printable-report" className="p-8 text-black font-outfit leading-tight">
          
          {/* HEADER */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
            <div>
                <h1 className="text-2xl font-black uppercase text-slate-900 leading-none mb-1">{company?.nom_entreprise || "LOGICIEL EASY"}</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{company?.adresse || "Siège Social - Maradi, Niger"}</p>
                <div className="flex gap-4 mt-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1"><Phone size={10}/> {company?.telephone}</span>
                    <span className="flex items-center gap-1 font-black">NIF: {company?.nif}</span>
                    <span className="flex items-center gap-1 font-black">RC: {company?.rc}</span>
                </div>
            </div>
            <div className="text-right">
                <div className="bg-slate-900 text-white px-4 py-2 rounded-xl mb-2">
                    <h2 className="text-xs font-black uppercase tracking-[0.2em]">BILAN DE CAISSE</h2>
                </div>
                <div className="text-[10px] font-bold text-slate-500 space-y-0.5">
                    <p>Période: {new Date(filters.start).toLocaleDateString('fr-FR')} - {new Date(filters.end).toLocaleDateString('fr-FR')}</p>
                    <p>Caissier: {filters.cashier}</p>
                    <p>Imprimé le: {new Date().toLocaleString('fr-FR')}</p>
                </div>
            </div>
          </div>

          {/* SUMMARY CARDS (HORIZONTAL ON PRINT) */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-200">
                    <TrendingUp size={18} />
                </div>
                <div>
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Total Recettes</p>
                    <p className="text-lg font-black text-emerald-900">+{new Intl.NumberFormat('fr-FR').format(data.summary.totalIncome)}</p>
                </div>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-rose-500 text-white rounded-lg shadow-lg shadow-rose-200">
                    <TrendingDown size={18} />
                </div>
                <div>
                    <p className="text-[9px] font-black text-rose-600 uppercase tracking-wider">Total Dépenses</p>
                    <p className="text-lg font-black text-rose-900">-{new Intl.NumberFormat('fr-FR').format(data.summary.totalExpenses)}</p>
                </div>
            </div>
            <div className={`p-4 rounded-2xl flex items-center gap-3 border ${data.summary.netBalance >= 0 ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-100'}`}>
                <div className={`p-2 text-white rounded-lg shadow-lg ${data.summary.netBalance >= 0 ? 'bg-indigo-500 shadow-indigo-200' : 'bg-amber-500 shadow-amber-200'}`}>
                    <Scale size={18} />
                </div>
                <div>
                    <p className={`text-[9px] font-black uppercase tracking-wider ${data.summary.netBalance >= 0 ? 'text-indigo-600' : 'text-amber-600'}`}>Solde Net</p>
                    <p className={`text-lg font-black ${data.summary.netBalance >= 0 ? 'text-indigo-900' : 'text-amber-900'}`}>
                        {new Intl.NumberFormat('fr-FR').format(data.summary.netBalance)}
                    </p>
                </div>
            </div>
          </div>

          {/* MAIN TABLE */}
          <div className="border border-slate-900 rounded-xl overflow-hidden mb-8">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                        <th className="p-3 text-left w-20">Date</th>
                        <th className="p-3 text-left">Référence</th>
                        <th className="p-3 text-left">Opération</th>
                        <th className="p-3 text-left">Mode</th>
                        <th className="p-3 text-right">Entrée</th>
                        <th className="p-3 text-right">Sortie</th>
                        <th className="p-3 text-center">User</th>
                    </tr>
                </thead>
                <tbody className="text-[10px] font-bold">
                    {data.entries.map((item: any, i: number) => (
                        <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                            <td className="p-3 text-slate-500">{new Date(item.date).toLocaleDateString('fr-FR')}</td>
                            <td className="p-3 text-slate-900">{item.ref}</td>
                            <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] ${
                                    item.type.includes('Dépense') ? 'bg-rose-100 text-rose-600' : 
                                    item.type.includes('Dépôt') ? 'bg-emerald-100 text-emerald-600' : 
                                    'bg-indigo-100 text-indigo-600'
                                }`}>
                                    {item.type}
                                </span>
                            </td>
                            <td className="p-3 text-slate-600 font-medium">{item.moyen}</td>
                            <td className="p-3 text-right text-emerald-600">
                                {item.entree > 0 ? `+${new Intl.NumberFormat('fr-FR').format(item.entree)}` : '-'}
                            </td>
                            <td className="p-3 text-right text-rose-600">
                                {item.sortie > 0 ? `-${new Intl.NumberFormat('fr-FR').format(item.sortie)}` : '-'}
                            </td>
                            <td className="p-3 text-center text-slate-400">@{item.user}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* SIGNATURES */}
          <div className="mt-12 flex justify-between">
            <div className="w-48 text-center">
                <p className="text-[10px] font-black uppercase border-b border-slate-900 pb-1 mb-16">Signature Caissier</p>
                <div className="h-0.5 bg-slate-100"></div>
            </div>
            <div className="w-48 text-center">
                <p className="text-[10px] font-black uppercase border-b border-slate-900 pb-1 mb-16">Cachet & Signature Direction</p>
                <div className="h-0.5 bg-slate-100"></div>
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
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            font-family: 'Outfit', sans-serif !important;
          }
          @page {
            size: ${printFormat === 'A4-L' ? 'A4 landscape' : 'A4 portrait'};
            margin: 10mm;
          }
          /* Ensure backgrounds work on print */
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          .bg-indigo-50 { background-color: #eef2ff !important; }
          .bg-slate-900 { background-color: #0f172a !important; color: #fff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .text-white { color: #fff !important; }
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
