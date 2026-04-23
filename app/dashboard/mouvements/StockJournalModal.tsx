"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  Package,
  History,
  Scale
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type StockJournalModalProps = {
  filters: { search: string; startDate: string; endDate: string; depot: string; type: string };
  onClose: () => void;
};

export default function StockJournalModal({ filters, onClose }: StockJournalModalProps) {
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // 1. Fetch Company Info
        const { data: comp } = await supabase
          .from("informations_entreprise")
          .select("*")
          .limit(1)
          .single();
        setCompany(comp);

        // 2. Fetch Movements Data
        const url = new URL("/api/stock/mouvements", window.location.origin);
        if (filters.search) url.searchParams.set("search", filters.search);
        if (filters.startDate) url.searchParams.set("startDate", filters.startDate);
        if (filters.endDate) url.searchParams.set("endDate", filters.endDate);
        if (filters.depot && filters.depot !== "Tous") url.searchParams.set("depot", filters.depot);
        
        const res = await fetch(url.toString());
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Erreur de chargement du journal.");
        }
        
        if (data && !Array.isArray(data)) {
          console.error("Modal Stock Movements API Error:", data);
          throw new Error(data?.error || "Erreur de chargement du journal.");
        }
        
        const normalized = Array.isArray(data) ? data : [];
        const filtered = filters.type === "Tous"
          ? normalized
          : normalized.filter((movement: any) => movement.type === filters.type);

        setMovements(filtered);

      } catch (err) {
        console.error("Error fetching stock journal data:", err);
        setError(err instanceof Error ? err.message : "Erreur de chargement du journal.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [filters.search, filters.startDate, filters.endDate, filters.depot, filters.type]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit">Génération du journal de stock...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar (Hidden on Print) */}
      <div className="absolute top-6 right-6 flex items-center gap-3 print:hidden z-[110]">
          <button 
            onClick={handlePrint}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-indigo-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
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

      {/* Report Paper Component (Landscape Style) */}
      <div className="bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible max-w-[280mm] w-full rounded-[32px]">
        
        <div id="printable-stock-journal" className="p-10 text-black font-outfit leading-tight border-[16px] border-slate-50 print:border-none">
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 font-bold print:hidden">
              {error}
            </div>
          )}
          
          {/* HEADER */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-10">
            <div>
                <h1 className="text-3xl font-black uppercase text-slate-900 leading-none mb-1">{company?.nom_entreprise || "LOGICIEL EASY"}</h1>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">{company?.adresse || "GESTION PROFESSIONNELLE"}</p>
                <div className="flex gap-6 mt-4 text-[11px] font-black uppercase text-slate-400">
                    <span className="flex items-center gap-2 tracking-tighter">Tél: {company?.telephone}</span>
                    <span className="flex items-center gap-2 tracking-tighter">NIF: {company?.nif}</span>
                    <span className="flex items-center gap-1 tracking-tighter opacity-50 italic">Journal de Stock #AUDIT</span>
                </div>
            </div>
            <div className="text-right">
                <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl mb-4 inline-block">
                    <h2 className="text-sm font-black uppercase tracking-[0.3em]">JOURNAL DES MOUVEMENTS</h2>
                </div>
                <div className="text-[11px] font-black text-slate-400 space-y-1 uppercase tracking-widest">
                    <p>Période: {filters.startDate || "Début"} au {filters.endDate || "Présent"}</p>
                    <p>Imprimé le: {new Date().toLocaleString('fr-FR')}</p>
                </div>
            </div>
          </div>

          {/* MAIN TABLE */}
          <div className="border border-slate-900 rounded-2xl overflow-hidden mb-10 shadow-xl shadow-slate-100/50">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                        <th className="p-4 text-left w-24 border-r border-white/10">Date</th>
                        <th className="p-4 text-left w-32 border-r border-white/10">Référence</th>
                        <th className="p-4 text-left border-r border-white/10">Article</th>
                        <th className="p-4 text-center w-32 border-r border-white/10">Nature</th>
                        <th className="p-4 text-right w-24 border-r border-white/10">Avant</th>
                        <th className="p-4 text-right w-24 border-r border-white/10">Mvt</th>
                        <th className="p-4 text-right w-24 border-r border-white/10">Après</th>
                        <th className="p-4 text-center w-24">User</th>
                    </tr>
                </thead>
                <tbody className="text-[10px] font-bold">
                    {(Array.isArray(movements) ? movements : []).map((m: any, i: number) => (
                        <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                            <td className="p-4 text-slate-500 border-r border-slate-50">{new Date(m.date_mouvement).toLocaleDateString('fr-FR')}</td>
                            <td className="p-4 text-slate-900 border-r border-slate-50 font-black tracking-tighter">{m.nr_doc}</td>
                            <td className="p-4 border-r border-slate-50">
                                <span className="font-black text-slate-800 uppercase block">{m.articles?.designation}</span>
                                <span className="text-[8px] text-slate-400 italic font-medium tracking-widest">{m.articles?.reference}</span>
                            </td>
                            <td className="p-4 text-center border-r border-slate-50">
                                <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[8px] font-black uppercase border border-slate-200 shadow-sm">
                                    {m.type}
                                </span>
                            </td>
                            <td className="p-4 text-right text-slate-400 font-medium border-r border-slate-50">{m.stock_avant}</td>
                            <td className="p-4 text-right border-r border-slate-50">
                                {m.entree > 0 ? (
                                    <span className="text-emerald-600 text-[12px] font-black tracking-tighter">+{m.entree}</span>
                                ) : (
                                    <span className="text-rose-600 text-[12px] font-black tracking-tighter">-{m.sortie}</span>
                                )}
                            </td>
                            <td className="p-4 text-right bg-slate-900/5 font-black text-slate-900 border-r border-slate-50">{m.stock_apres}</td>
                            <td className="p-4 text-center text-slate-400 italic">@{m.utilisateur?.[0] || 'U'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* SIGNATURES SECTION */}
          <div className="grid grid-cols-2 gap-20 mt-16 pb-10">
            <div className="text-center group">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-200 pb-2 mb-20 group-hover:text-indigo-600 transition-colors">Visa Responsable de Stock</p>
                <div className="h-0.5 bg-slate-900/5 rounded-full"></div>
            </div>
            <div className="text-center group">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] border-b border-slate-200 pb-2 mb-20 group-hover:text-emerald-600 transition-colors">Validation Direction</p>
                <div className="h-0.5 bg-slate-900/5 rounded-full"></div>
            </div>
          </div>

          {/* PAGE FOOTER DECOR */}
          <div className="flex justify-between items-center mt-auto pt-6 border-t border-slate-100 text-[9px] font-black uppercase text-slate-300 tracking-widest italic">
            <span>Certification de Conformité • Logiciel Easy</span>
            <span>Page 01 sur 01</span>
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
          #printable-stock-journal, #printable-stock-journal * {
            visibility: visible;
          }
          #printable-stock-journal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 10mm !important;
            margin: 0 !important;
            font-family: 'Outfit', sans-serif !important;
          }
          @page {
            size: A4 landscape;
            margin: 0;
          }
          
          .bg-slate-900 { background-color: #0f172a !important; color: #fff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
          .bg-slate-900\/5 { background-color: rgba(15, 23, 42, 0.05) !important; }
          .text-white { color: #fff !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-rose-600 { color: #e11d48 !important; }
          .border-slate-900 { border-color: #0f172a !important; }
        }
      `}</style>
    </div>
  );
}
