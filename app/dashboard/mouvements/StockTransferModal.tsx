"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  ArrowRightLeft,
  MapPin,
  Calendar,
  Box,
  User
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type StockTransferModalProps = {
  transferRef: string;
  onClose: () => void;
};

export default function StockTransferModal({ transferRef, onClose }: StockTransferModalProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [transferData, setTransferData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<'A4' | 'A5'>('A4');
  const [showPrintChoice, setShowPrintChoice] = useState(false);

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

        // 2. Fetch Transit Record (Primary source for source/dest depots)
        const { data: transit } = await supabase
          .from("stock_transits")
          .select("*")
          .eq("reference", transferRef)
          .maybeSingle();

        // 3. Fetch Movements related to this transfer reference
        const { data: mvts } = await supabase
          .from("mouvements")
          .select("*, articles(reference, designation, unite)")
          .eq("nr_doc", transferRef);
        
        if (transit) {
            setTransferData({
                ref: transferRef,
                date: transit.created_at,
                source: transit.source_depot,
                dest: transit.dest_depot,
                user: transit.created_by,
                notes: transit.notes
            });
            
            // For items, use movements (sortie) or details from transit
            if (mvts && mvts.length > 0) {
                setItems(mvts.filter(m => m.type === 'transfert_sortie'));
            } else if (transit.details) {
                // Fallback to transit details if movements haven't synced yet
                setItems((transit.details as any[]).map(d => ({
                    articles: { reference: "", designation: d.designation, unite: "" },
                    quantite: d.qty
                })));
            }
        } else if (mvts && mvts.length > 0) {
            // Fallback to movements if transit record missing
            const sortie = mvts.find(m => m.type === 'transfert_sortie');
            const entree = mvts.find(m => m.type === 'transfert_entree');
            
            setTransferData({
                ref: transferRef,
                date: mvts[0].date_mouvement,
                source: sortie?.depot || "Inconnu",
                dest: entree?.depot || "Inconnu",
                user: mvts[0].utilisateur
            });
            setItems(mvts.filter(m => m.type === 'transfert_sortie'));
        }

      } catch (err) {
        console.error("Error fetching transfer data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (transferRef) fetchData();
  }, [transferRef]);

  const handlePrint = (format: 'A4' | 'A5') => {
    setPrintFormat(format);
    setShowPrintChoice(false);
    setTimeout(() => {
        window.print();
    }, 100);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-emerald-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit">Préparation du bon de transfert...</p>
        </div>
      </div>
    );
  }

  if (!transferData) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar (Hidden on Print) */}
      <div className="absolute top-6 right-6 flex items-center gap-3 print:hidden z-[110]">
          <div className="relative">
            <button 
              onClick={() => setShowPrintChoice(!showPrintChoice)}
              className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-emerald-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
            >
              <Printer size={20} />
              Imprimer
            </button>
            
            {showPrintChoice && (
                <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 w-40 animate-in slide-in-from-top-2 duration-200">
                    <button 
                        onClick={() => handlePrint('A4')}
                        className="w-full text-left p-3 hover:bg-slate-50 rounded-xl font-bold text-slate-700 text-sm flex items-center justify-between"
                    >
                        Format A4
                        <span className="text-[9px] bg-slate-100 px-2 py-0.5 rounded text-slate-400">Portrait</span>
                    </button>
                    <button 
                        onClick={() => handlePrint('A5')}
                        className="w-full text-left p-3 hover:bg-slate-50 rounded-xl font-bold text-slate-700 text-sm flex items-center justify-between"
                    >
                        Format A5
                        <span className="text-[9px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-600">Compact</span>
                    </button>
                </div>
            )}
          </div>
          <button 
            onClick={onClose}
            className="bg-white text-slate-400 p-3 rounded-2xl shadow-lg border border-slate-100 hover:text-rose-500 transition-colors"
          >
            <X size={24} />
          </button>
      </div>

      {/* Report Paper Component */}
      <div className="bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible max-w-[210mm] w-full rounded-[32px]">
        
        <div id="printable-transfer" className="p-12 text-black font-outfit leading-tight border-[16px] border-slate-50 print:border-none">
          
          {/* HEADER */}
          <div className="flex justify-between items-start mb-12">
            <div>
                <h1 className="text-2xl font-black uppercase text-slate-900 mb-1">{company?.nom_entreprise || "ETS TASSIOU KOMMA"}</h1>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">{company?.adresse || "GESTION DE STOCK"}</p>
                <div className="mt-4 text-[10px] font-bold text-slate-500 space-y-0.5">
                    <p>Tél: {company?.telephone}</p>
                    <p>NIF: {company?.nif}</p>
                </div>
            </div>
            <div className="text-right">
                <div className="bg-slate-900 text-white px-6 py-2.5 rounded-xl mb-4 inline-block">
                    <h2 className="text-xs font-black uppercase tracking-[0.4em] whitespace-nowrap">B O N D E T R A N S F E R T</h2>
                </div>
                <div className="text-[11px] font-black text-slate-400 space-y-1">
                    <p>Réf: <span className="text-slate-900">{transferData?.ref || '—'}</span></p>
                    <p>Date: <span className="text-slate-900">
                      {transferData?.date ? new Date(transferData.date).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : (new Date().toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      }))}
                    </span></p>
                </div>
            </div>
          </div>

          {/* LOGISTICS BLOCK */}
          <div className="grid grid-cols-11 items-center gap-4 mb-12">
            <div className="col-span-5 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Dépôt Source</p>
                <div className="flex items-center justify-center gap-3 text-indigo-600">
                    <MapPin size={18} />
                    <span className="text-lg font-black uppercase">{transferData.source}</span>
                </div>
            </div>
            <div className="col-span-1 flex justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
                    <ArrowRightLeft size={20} />
                </div>
            </div>
            <div className="col-span-5 bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/50 mb-2">Dépôt Destination</p>
                <div className="flex items-center justify-center gap-3 text-emerald-600">
                    <MapPin size={18} />
                    <span className="text-lg font-black uppercase">{transferData.dest}</span>
                </div>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div className="border border-slate-200 rounded-3xl overflow-hidden mb-12 shadow-sm">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                        <th className="p-4 text-left w-32 border-r border-white/10">Code Article</th>
                        <th className="p-4 text-left border-r border-white/10">Désignation</th>
                        <th className="p-4 text-center w-32">Quantité</th>
                    </tr>
                </thead>
                <tbody className="text-[11px] font-bold">
                    {items.map((item, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-5 text-slate-400 border-r border-slate-50">{item.articles?.reference}</td>
                            <td className="p-5 border-r border-slate-50">
                                <span className="font-black text-slate-800 uppercase">{item.articles?.designation}</span>
                            </td>
                            <td className="p-5 text-center text-lg font-black text-indigo-600">
                                {Math.abs(item.sortie || item.quantite)} <span className="text-[10px] text-slate-300 uppercase italic ml-1">{item.articles?.unite}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          {/* SIGNATURES */}
          <div className="grid grid-cols-3 gap-12 mt-auto">
            <div className="text-center group">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-20 border-b border-slate-100 pb-2">Magasinier (Départ)</p>
                <div className="h-px bg-slate-200"></div>
            </div>
            <div className="text-center group">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-20 border-b border-slate-100 pb-2">Chauffeur / Porteur</p>
                <div className="h-px bg-slate-200"></div>
            </div>
            <div className="text-center group">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-20 border-b border-slate-100 pb-2">Réceptionnaire (Cible)</p>
                <div className="h-px bg-slate-200"></div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-20 flex justify-between items-center text-[9px] font-black uppercase text-slate-300 italic">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><User size={10}/> Généré par: {transferData.user || 'Admin'}</span>
                <span>• {new Date().toLocaleTimeString()}</span>
            </div>
            <span>Document de contrôle interne • LOGICIEL EASY</span>
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
          #printable-transfer, #printable-transfer * {
            visibility: visible;
          }
          #printable-transfer {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${printFormat === 'A5' ? '148mm' : '210mm'} !important;
            height: ${printFormat === 'A5' ? '210mm' : '297mm'} !important;
            padding: ${printFormat === 'A5' ? '8mm' : '15mm'} !important;
            margin: 0 !important;
            font-family: 'Outfit', sans-serif !important;
            background: white !important;
            border: none !important;
          }
          @page {
            size: ${printFormat === 'A5' ? 'A5 portrait' : 'A4 portrait'};
            margin: 0;
          }
          .bg-slate-900 { background-color: #0f172a !important; color: #fff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .text-white { color: #fff !important; }
          .text-indigo-600 { color: #4f46e5 !important; }
          .text-emerald-600 { color: #059669 !important; }
          .border-slate-900 { border-color: #0f172a !important; }
          
          /* Scale down for A5 */
          ${printFormat === 'A5' ? `
            #printable-transfer h1 { font-size: 14px !important; }
            #printable-transfer h2 { font-size: 8px !important; tracking: 0.2em !important; }
            #printable-transfer .text-lg { font-size: 11px !important; }
            #printable-transfer .p-12 { padding: 5mm !important; }
            #printable-transfer .mb-12 { margin-bottom: 10px !important; }
            #printable-transfer .p-6 { padding: 6px !important; }
            #printable-transfer table th, #printable-transfer table td { padding: 5px !important; font-size: 8px !important; }
            #printable-transfer .rounded-[2rem] { border-radius: 10px !important; }
            #printable-transfer .p-12 { padding: 0 !important; }
            #printable-transfer { padding: 6mm !important; }
            #printable-transfer .mb-4 { margin-bottom: 8px !important; }
            #printable-transfer .py-2.5 { padding-top: 6px !important; padding-bottom: 6px !important; }
          ` : ''}
        }
      `}</style>
    </div>
  );
}
