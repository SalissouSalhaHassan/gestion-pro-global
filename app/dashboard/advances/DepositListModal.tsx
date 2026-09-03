"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  Wallet,
  Users,
  Search,
  Filter
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type DepositListModalProps = {
  onClose: () => void;
};

export default function DepositListModal({ onClose }: DepositListModalProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);

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

        // 2. Fetch All Advances
        const { data: adv } = await supabase
          .from("avances_clients")
          .select("*, clients(id, nom, ref_client)")
          .order('date_avance', { ascending: false });
        
        setItems(adv || []);

      } catch (err) {
        console.error("Error fetching deposit list data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const totalInitial = items.reduce((acc, item) => acc + (Number(item.montant_initial) || 0), 0);
  const totalRestant = items.reduce((acc, item) => acc + (Number(item.montant_restant) || 0), 0);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit">Génération du relevé des dépôts...</p>
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
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-blue-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
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

      {/* Report Paper Component (Landscape) */}
      <div className="bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible max-w-[297mm] w-full rounded-[32px]">
        
        <div id="printable-deposit-list" className="p-10 text-black font-outfit leading-tight border-[16px] border-slate-50 print:border-none">
          
          {/* HEADER */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-8 mb-8">
            <div>
                <h1 className="text-2xl font-black uppercase text-slate-900 mb-1">{company?.nom_entreprise || "ETS TASSIOU KOMMA"}</h1>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{company?.adresse || "GESTION CLIENTÈLE"}</p>
                <div className="mt-4 flex gap-6 text-[10px] font-bold text-slate-500 uppercase italic">
                    <span>Tél: {company?.telephone}</span>
                    <span>NIF: {company?.nif}</span>
                </div>
            </div>
            <div className="text-right">
                <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl mb-4 inline-block shadow-lg shadow-blue-500/20">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em]">RELEVÉ GLOBAL DES DÉPÔTS CLIENTS</h2>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Situation au : {new Date().toLocaleDateString('fr-FR')} • {new Date().toLocaleTimeString('fr-FR')}
                </p>
            </div>
          </div>

          {/* TABLE */}
          <div className="border border-slate-200 rounded-3xl overflow-hidden mb-8 shadow-sm">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest">
                        <th className="p-4 text-left border-r border-white/10 w-48">Client</th>
                        <th className="p-4 text-center border-r border-white/10 w-24">Date</th>
                        <th className="p-4 text-left border-r border-white/10 w-32">Référence</th>
                        <th className="p-4 text-center border-r border-white/10 w-24">Mode</th>
                        <th className="p-4 text-right border-r border-white/10 w-32">Montant Initial</th>
                        <th className="p-4 text-right border-r border-white/10 w-32">Montant Restant</th>
                        <th className="p-4 text-center w-32">Statut</th>
                    </tr>
                </thead>
                <tbody className="text-[10px] font-bold">
                    {items.map((item, i) => {
                        const rawClients = item.clients;
                        const clientObj = Array.isArray(rawClients) ? rawClients[0] : rawClients;
                        const clientNom = clientObj?.nom || `Client #${item.client_id}`;
                        const itemRef = item.reference_paiement || clientObj?.ref_client || `DEP-${String(item.id).padStart(4, '0')}`;

                        return (
                          <tr key={i} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                              <td className="p-4 border-r border-slate-50 uppercase text-slate-900 font-black">{clientNom}</td>
                              <td className="p-4 text-center border-r border-slate-50 text-slate-400">{new Date(item.date_avance).toLocaleDateString('fr-FR')}</td>
                              <td className="p-4 border-r border-slate-50 text-slate-700 font-mono font-bold">{itemRef}</td>
                            <td className="p-4 text-center border-r border-slate-50">{item.moyen_paiement}</td>
                            <td className="p-4 text-right border-r border-slate-50">{new Intl.NumberFormat('fr-FR').format(item.montant_initial)}</td>
                            <td className="p-4 text-right border-r border-slate-50 font-black text-blue-600">{new Intl.NumberFormat('fr-FR').format(item.montant_restant)}</td>
                            <td className="p-4 text-center">
                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${
                                    item.statut === 'Disponible' ? 'bg-emerald-100 text-emerald-700' :
                                    item.statut === 'Annulée' ? 'bg-rose-100 text-rose-700' :
                                    'bg-amber-100 text-amber-700'
                                }`}>
                                    {item.statut}
                                </span>
                            </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                    <tr className="bg-slate-900 text-white font-black uppercase text-[10px]">
                        <td colSpan={4} className="p-5 text-right tracking-[0.2em]">TOTAUX GÉNÉRAUX :</td>
                        <td className="p-5 text-right border-l border-white/10">{new Intl.NumberFormat('fr-FR').format(totalInitial)}</td>
                        <td className="p-5 text-right border-l border-white/10">{new Intl.NumberFormat('fr-FR').format(totalRestant)}</td>
                        <td className="p-5 border-l border-white/10"></td>
                    </tr>
                </tfoot>
            </table>
          </div>

          {/* SIGNATURES */}
          <div className="grid grid-cols-2 gap-20 mt-12 pb-10">
            <div className="text-center group">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2 mb-24">Visa Comptabilité</p>
                <div className="h-0.5 bg-slate-900/5 rounded-full"></div>
            </div>
            <div className="text-center group">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2 mb-24">Validation Direction Générale</p>
                <div className="h-0.5 bg-slate-900/5 rounded-full"></div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-auto flex justify-between items-center text-[8px] font-black uppercase text-slate-300 tracking-[0.2em] italic border-t border-slate-100 pt-6">
            <span>Rapport d&apos;Audit des Passifs Clients • Logiciel Easy Version Web</span>
            <span>Certification de Trésorerie Intègre</span>
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
          #printable-deposit-list, #printable-deposit-list * {
            visibility: visible;
          }
          #printable-deposit-list {
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
          .bg-blue-600 { background-color: #2563eb !important; color: #fff !important; }
          .bg-slate-50\/50 { background-color: rgba(248, 250, 252, 0.5) !important; }
          .bg-emerald-100 { background-color: #dcfce7 !important; color: #15803d !important; }
          .bg-rose-100 { background-color: #fee2e2 !important; color: #b91c1c !important; }
          .bg-amber-100 { background-color: #fef3c7 !important; color: #b45309 !important; }
          .text-white { color: #fff !important; }
          .text-blue-600 { color: #2563eb !important; }
        }
      `}</style>
    </div>
  );
}
