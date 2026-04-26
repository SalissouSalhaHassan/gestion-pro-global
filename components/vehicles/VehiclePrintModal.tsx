"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  Car,
  Calendar,
  Truck,
  Wrench,
  ShieldCheck,
  FileText,
  MapPin,
  ClipboardList
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type VehiclePrintModalProps = {
  open: boolean;
  onClose: () => void;
  vehicles: any[];
};

export default function VehiclePrintModal({ open, onClose, vehicles }: VehiclePrintModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A4');
  const [reportType, setReportType] = useState<'fleet' | 'fees' | 'expenses'>('fleet');

  useEffect(() => {
    async function fetchCompany() {
      const { data: comp } = await supabase
        .from("informations_entreprise")
        .select("*")
        .limit(1)
        .single();
      setCompany(comp);
    }
    if (open) fetchCompany();
  }, [open]);

  useEffect(() => {
    async function fetchData() {
        if (!open) return;
        setLoading(true);
        try {
            if (reportType === 'fleet') {
                setData(vehicles);
            } else {
                const res = await fetch("/api/vehicles/records");
                const json = await res.json();
                setData(json.filter((r: any) => reportType === 'fees' ? r.record_type === 'FRAI' : r.record_type === 'DEPENSE'));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    fetchData();
  }, [open, reportType, vehicles]);

  const handlePrint = () => {
    window.print();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-6 print:hidden z-[110]">
          {/* Report Type Selector */}
          <div className="bg-slate-200/80 backdrop-blur-md p-1.5 rounded-[24px] flex items-center shadow-lg border border-white/20">
             {[
               { id: 'fleet', label: 'Flotte' },
               { id: 'fees', label: 'Transports' },
               { id: 'expenses', label: 'Dépenses' }
             ].map((t) => (
               <button
                 key={t.id}
                 onClick={() => setReportType(t.id as any)}
                 className={`px-6 py-2 rounded-2xl text-xs font-black transition-all ${
                   reportType === t.id 
                   ? 'bg-slate-900 text-white shadow-md' 
                   : 'text-slate-500 hover:text-slate-800'
                 }`}
               >
                 {t.label}
               </button>
             ))}
          </div>

          {/* Paper Size */}
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
              className="bg-white text-slate-400 p-5 rounded-[28px] shadow-xl border border-slate-100 hover:text-rose-500 transition-all active:scale-95"
            >
              <X size={28} />
            </button>
          </div>
      </div>

      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible transition-all duration-500 ${
        pageSize === 'A4' ? 'max-w-[210mm]' : 'max-w-[148mm]'
      } w-full rounded-[40px] border border-slate-100 print:border-none`}>
        
        <div id="printable-vehicles" className="p-10 text-slate-900 font-outfit leading-tight relative overflow-hidden min-h-[297mm] print:min-h-0">
          
          {/* HEADER */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-900">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{company?.nom_entreprise || "ETS SOUNO"}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                {company?.adresse || "MARADI, NIGER"}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-slate-900 text-white px-6 py-2 rounded-xl mb-2">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em]">
                     {reportType === 'fleet' ? "RAPPORT DE LA FLOTTE" : reportType === 'fees' ? "JOURNAL DES TRANSPORTS" : "JOURNAL DE MAINTENANCE"}
                  </h2>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Imprimé le: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {loading ? (
             <div className="py-20 text-center">
                <Loader2 className="animate-spin mx-auto text-indigo-500 mb-4" size={40} />
                <p className="font-black text-slate-400 uppercase text-xs">Traitement des données...</p>
             </div>
          ) : (
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-wider">
                        {reportType === 'fleet' ? (
                          <>
                            <th className="p-4">Matricule</th>
                            <th className="p-4">Marque / Modèle</th>
                            <th className="p-4">Chauffeur</th>
                            <th className="p-4 text-center">Expiration Vig.</th>
                          </>
                        ) : (
                          <>
                            <th className="p-4">Date</th>
                            <th className="p-4">Véhicule</th>
                            <th className="p-4">Détails / Destination</th>
                            <th className="p-4 text-right">Montant</th>
                          </>
                        )}
                     </tr>
                  </thead>
                  <tbody className="text-[10px] font-bold text-slate-700">
                     {data.map((item: any, i: number) => (
                        <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                           {reportType === 'fleet' ? (
                             <>
                               <td className="p-4 font-black text-indigo-600">{item.matricule}</td>
                               <td className="p-4 uppercase">{item.marque} {item.modele}</td>
                               <td className="p-4 text-slate-500">{item.chauffeur || "—"}</td>
                               <td className="p-4 text-center">{item.date_expiration ? new Date(item.date_expiration).toLocaleDateString() : "—"}</td>
                             </>
                           ) : (
                             <>
                               <td className="p-4 text-slate-400">{new Date(item.record_date).toLocaleDateString()}</td>
                               <td className="p-4 font-black">{item.voitures?.matricule}</td>
                               <td className="p-4 text-slate-500 uppercase">{item.destination || item.category || "—"}</td>
                               <td className={`p-4 text-right font-black ${reportType === 'fees' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {new Intl.NumberFormat().format(item.amount)} F
                               </td>
                             </>
                           )}
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
          )}

          <div className="mt-16 pt-12 border-t-2 border-slate-900 grid grid-cols-2 gap-16">
             <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-300 mb-12">Gestionnaire de Parc</p>
                <div className="h-px bg-slate-100"></div>
             </div>
             <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-300 mb-12">Direction Générale</p>
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
          #printable-vehicles, #printable-vehicles * {
            visibility: visible;
          }
          #printable-vehicles {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 10mm !important;
            margin: 0 !important;
            font-family: 'Outfit', sans-serif !important;
          }
          @page {
            size: ${pageSize === 'A4' ? 'A4 portrait' : 'A5 portrait'};
            margin: 0;
          }
          .bg-slate-900 { background-color: #0f172a !important; color: #fff !important; }
          .bg-indigo-600 { background-color: #4f46e5 !important; color: #fff !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-rose-600 { color: #e11d48 !important; }
        }
      `}</style>
    </div>
  );
}
