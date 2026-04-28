"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  Users,
  Calendar,
  Banknote,
  ShieldAlert,
  FileText,
  MapPin
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClientSessionFromCookie, isAdminOrManagerSession, DEFAULT_CLIENT_ID } from "@/lib/client_helpers";

const supabase = createClient();

type ClientListModalProps = {
  onClose: () => void;
};

export default function ClientListModal({ onClose }: ClientListModalProps) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A4');

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

        const session = getClientSessionFromCookie();
        const admin = isAdminOrManagerSession(session);

        let clientQuery = supabase
          .from("clients")
          .select("id, ref_client, nom, tel, credit_facture, credit_bl")
          .eq("is_deleted", false);

        // ── CLIENT ISOLATION: Dépôt users only see their own clients + default client ──
        if (!admin && session?.id) {
          clientQuery = clientQuery.or(`created_by.eq.${session.id},id.eq.${DEFAULT_CLIENT_ID}`);
        }

        const { data, error } = await clientQuery;

        if (data) {
          setClients(data.map(c => ({
            ...c,
            credit: (Number(c.credit_facture) || 0) + (Number(c.credit_bl) || 0)
          })));
        }

      } catch (err) {
        console.error("Error fetching client data:", err);
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
          <p className="font-bold text-slate-600 font-outfit text-sm">Génération de la liste des clients...</p>
        </div>
      </div>
    );
  }

  const totalCredit = clients.reduce((sum, c) => sum + c.credit, 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-6 print:hidden z-[110]">
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

          <div className="flex items-center gap-4">
            <button 
              onClick={handlePrint}
              className="bg-indigo-600 text-white px-10 py-5 rounded-[28px] font-black shadow-2xl shadow-indigo-500/40 flex items-center gap-3 hover:scale-105 active:scale-95 transition-all text-lg"
            >
              <Printer size={24} />
              Imprimer Liste
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
        
        <div id="printable-clients" className="p-10 text-slate-900 font-outfit leading-tight relative overflow-hidden">
          
          <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-slate-900">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{company?.nom_entreprise || "ETS SOUNO"}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                {company?.adresse || "MARADI, NIGER"}
              </p>
            </div>
            <div className="text-right">
              <div className="bg-indigo-600 text-white px-6 py-2 rounded-xl mb-2">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em]">LISTE DES CLIENTS</h2>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Crédit Global: {new Intl.NumberFormat().format(totalCredit)} F</p>
            </div>
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-hidden">
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                      <th className="p-3">Référence</th>
                      <th className="p-3">Nom du Client</th>
                      <th className="p-3">Téléphone</th>
                      <th className="p-3 text-right">Crédit (F)</th>
                   </tr>
                </thead>
                <tbody className="text-[9px] font-bold">
                   {clients.map((c, i) => (
                        <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                           <td className="p-3 text-slate-500">{c.ref_client || "—"}</td>
                           <td className="p-3 text-slate-900 uppercase">{c.nom}</td>
                           <td className="p-3 text-slate-600">{c.tel || "—"}</td>
                           <td className={`p-3 text-right font-black ${c.credit > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {new Intl.NumberFormat().format(c.credit)}
                           </td>
                        </tr>
                   ))}
                </tbody>
             </table>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 text-[10px] text-slate-400 font-bold flex justify-between italic">
             <span>Document généré par le système de gestion.</span>
             <span>Page 1 / 1</span>
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
          #printable-clients, #printable-clients * {
            visibility: visible;
          }
          #printable-clients {
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
          .text-rose-600 { color: #e11d48 !important; }
        }
      `}</style>
    </div>
  );
}
