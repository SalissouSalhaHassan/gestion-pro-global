"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  Wallet,
  Calendar,
  User,
  Info,
  MapPin,
  FileText,
  ShieldCheck,
  CheckCircle,
  FileBadge,
  Truck,
  Receipt,
  ListOrdered
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyAmount } from "@/lib/utils/currency";

const supabase = createClient();

type AdvanceReceiptModalProps = {
  advanceId: number;
  onClose: () => void;
};

export default function AdvanceReceiptModal({ advanceId, onClose }: AdvanceReceiptModalProps) {
  const [loading, setLoading] = useState(true);
  const [advance, setAdvance] = useState<any>(null);
  const [allAdvances, setAllAdvances] = useState<any[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5' | 'Ticket'>('A5');
  const [receiptMode, setReceiptMode] = useState<'single' | 'statement'>('statement');

  const transactions = useMemo(() => {
    const list: any[] = [];
    
    // Add all deposits
    allAdvances.forEach(a => {
      list.push({
        id: `dep-${a.id}`,
        date: a.date_avance || a.created_at,
        ref: a.reference_paiement || `DEP-${a.id}`,
        montant: Number(a.montant_initial),
        operation: "DEPOT",
        timestamp: new Date(a.date_avance || a.created_at).getTime()
      });
    });

    // Add all withdrawals/cancellations
    allHistory.forEach(h => {
      if (h.action === "WITHDRAW") {
        let ref = h.notes || "";
        const rx = /^[0-9]{2}[A-Z]{5}-[0-9]+$/;
        if (!rx.test(ref)) {
          const dateAction = new Date(h.date_action);
          const yy = String(dateAction.getFullYear()).slice(-2);
          const mm = String(dateAction.getMonth() + 1).padStart(2, '0');
          const suffix = String(h.id).padStart(4, '0');
          ref = `${yy}RET-${mm}${suffix}`;
        }

        list.push({
          id: `wdr-${h.id}`,
          date: h.date_action,
          ref: ref,
          montant: -Number(h.amount),
          operation: "RETRAIT",
          timestamp: new Date(h.date_action).getTime()
        });
      } else if (h.action === "CANCEL") {
        list.push({
          id: `cnc-${h.id}`,
          date: h.date_action,
          ref: `ANN-${h.advance_id}`,
          montant: -Number(h.amount),
          operation: "ANNULATION",
          timestamp: new Date(h.date_action).getTime()
        });
      }
    });

    // Sort chronologically by date
    list.sort((a, b) => a.timestamp - b.timestamp);
    return list;
  }, [allAdvances, allHistory]);

  const totalBalance = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + tx.montant, 0);
  }, [transactions]);

  const numberToWordsFr = (total: number) => {
    if (total === 0) return "zéro";
    const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

    const convert = (n: number): string => {
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 70) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return tens[t] + (r === 1 ? ' et ' : (r > 0 ? '-' : '')) + ones[r];
      }
      if (n < 80) return "soixante-" + convert(n - 60);
      if (n < 100) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return (t === 8 ? "quatre-vingt" : "quatre-vingt-") + (r > 0 ? (t === 8 ? "-" : "") + convert(r) : "");
      }
      if (n < 1000) {
        const c = Math.floor(n / 100);
        const r = n % 100;
        return (c === 1 ? "cent" : ones[c] + " cent") + (r > 0 ? " " + convert(r) : "");
      }
      const m = Math.floor(n / 1000);
      const r = n % 1000;
      return (m === 1 ? "mille" : convert(m) + " mille") + (r > 0 ? " " + convert(r) : "");
    };

    return convert(Math.floor(total)).charAt(0).toUpperCase() + convert(Math.floor(total)).slice(1);
  };

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

        const { data: adv } = await supabase
          .from("avances_clients")
          .select("*, clients(id, nom, tel, adresse)")
          .eq("id", advanceId)
          .single();
        
        setAdvance(adv);

        if (adv) {
          const { data: allAdvs } = await supabase
            .from("avances_clients")
            .select("*")
            .eq("client_id", adv.client_id)
            .order("date_avance", { ascending: true });
          
          const advancesList = allAdvs || [];
          setAllAdvances(advancesList);

          if (advancesList.length > 0) {
            const advIds = advancesList.map(a => a.id);
            const { data: allHist } = await supabase
              .from("avances_history")
              .select("*")
              .in("advance_id", advIds)
              .order("date_action", { ascending: true });
            
            setAllHistory(allHist || []);
          }
        }

      } catch (err) {
        console.error("Error fetching advance data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (advanceId) fetchData();
  }, [advanceId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit">Génération du document...</p>
        </div>
      </div>
    );
  }

  if (!advance) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar - Modernized Toggle Buttons */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-4 print:hidden z-[110]">
          {/* Mode Toggle: Single Receipt vs Global Statement */}
          <div className="bg-slate-900/80 backdrop-blur-md p-1.5 rounded-[22px] flex items-center shadow-2xl border border-white/20">
             <button
                onClick={() => setReceiptMode('statement')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  receiptMode === 'statement' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white'
                }`}
             >
                <ListOrdered size={14} /> Situation Dépôts
             </button>
             <button
                onClick={() => setReceiptMode('single')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  receiptMode === 'single' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white'
                }`}
             >
                <Receipt size={14} /> Reçu Unitaire
             </button>
          </div>

          {/* Paper Size Toggle */}
          <div className="bg-slate-900/80 backdrop-blur-md p-1.5 rounded-[22px] flex items-center shadow-2xl border border-white/20">
             {['A4', 'A5', 'Ticket'].map((size) => (
               <button
                 key={size}
                 onClick={() => setPageSize(size as any)}
                 className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${
                   pageSize === size 
                   ? 'bg-emerald-600 text-white shadow-md' 
                   : 'text-slate-300 hover:text-white'
                 }`}
               >
                 {size}
               </button>
             ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button 
              onClick={handlePrint}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-[24px] font-black shadow-2xl shadow-indigo-500/40 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all text-base cursor-pointer"
            >
              <Printer size={20} />
              Imprimer
            </button>
            <button 
              onClick={onClose}
              className="bg-white text-slate-500 p-4 rounded-[24px] shadow-xl border border-slate-100 hover:text-rose-500 hover:scale-110 transition-all active:scale-95 cursor-pointer"
            >
              <X size={24} />
            </button>
          </div>
      </div>

      {/* Main Container */}
      <div className={`bg-white h-auto max-h-[92vh] overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:max-h-none print:overflow-visible transition-all duration-300 ${
        pageSize === 'A4' ? 'max-w-[210mm]' : pageSize === 'Ticket' ? 'max-w-[80mm]' : 'max-w-[148mm]'
      } w-full rounded-[36px] border border-slate-100 print:border-none`}>
        
        <div id="printable-advance" className="p-8 text-slate-950 font-sans leading-tight relative overflow-hidden print:p-4">
          
          {/* Company Header */}
          <div className="text-center w-full flex flex-col items-center mb-5 border-b border-dashed border-slate-300 pb-5">
            <h1 className="text-lg font-black uppercase text-slate-900 tracking-tight leading-none">
              {company?.nom_entreprise || "GESTION PRO GLOBAL"}
            </h1>
            <p className="text-xs font-bold text-slate-600 mt-1">
              {company?.activite || "Etablissement SOUNA"}
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
               {company?.slogan || "Ventes de matériaux de construction"}
            </p>
            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
               {company?.adresse || "sous la route PMI 17 Portes BP 281"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-1 text-[8px] font-black text-slate-400">
               <span>RCCM: {company?.rccm || 'NI-MAR-2007-A-93'}</span>
               <span>NIF: {company?.nif || '11835/R'}</span>
            </div>
            <p className="text-[8px] font-bold text-slate-400 mt-0.5">
               Tél: {company?.telephone || '96.29.77.03 - 96.97.01.57'}
            </p>
          </div>

          {/* Title Section */}
          <div className="text-center mb-5 border-b-2 border-slate-900 pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
               {receiptMode === 'statement' ? "SITUATION DEPOTS TIERS" : "REÇU D'ACOMPTE / DEPOT CLIENT"}
            </h2>
            <p className="text-sm font-black text-slate-900 uppercase mt-1">
               {advance.clients?.tel ? `${advance.clients.tel} ` : ""}{advance.clients?.nom}
            </p>
            <p className="text-xs font-black text-indigo-600 uppercase mt-0.5 tracking-wider">
               {advance.emplacement || "BOUTIQUE"}
            </p>
          </div>

          {/* Content Mode 1: Situation Dépôts (Ledger Table) */}
          {receiptMode === 'statement' ? (
            <div className="mb-5 overflow-hidden">
               <table className="w-full text-left border border-slate-950 border-collapse">
                  <thead>
                     <tr className="text-[9px] font-black bg-slate-50 text-slate-900 uppercase border-b-2 border-slate-950">
                        <th className="py-2 px-2.5 border-r border-slate-950">REF.</th>
                        <th className="py-2 px-2.5 border-r border-slate-950 text-center">DATE</th>
                        <th className="py-2 px-2.5 border-r border-slate-950 text-right">MONTANT</th>
                        <th className="py-2 px-2.5 text-center">OPERATIONS</th>
                     </tr>
                  </thead>
                  <tbody className="text-[10px] font-bold text-slate-900">
                     {transactions.map((tx) => (
                       <tr key={tx.id} className="border-b border-slate-300 last:border-none">
                          <td className="py-2 px-2.5 border-r border-slate-950 font-mono text-[9px]">{tx.ref}</td>
                          <td className="py-2 px-2.5 border-r border-slate-950 text-center">
                             {new Date(tx.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="py-2 px-2.5 border-r border-slate-950 text-right font-black">
                             {tx.montant < 0 ? '-' : ''}{new Intl.NumberFormat('fr-FR').format(Math.abs(tx.montant))}
                          </td>
                          <td className="py-2 px-2.5 text-center font-black text-[9px] uppercase tracking-wider">{tx.operation}</td>
                       </tr>
                     ))}
                     {transactions.length === 0 && (
                       <tr>
                         <td colSpan={4} className="py-4 text-center text-slate-400 italic font-normal text-xs">
                           Aucun mouvement disponible.
                         </td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
          ) : (
            /* Content Mode 2: Reçu Unitaire */
            <div className="mb-5 space-y-3 border border-slate-950 p-4 rounded-xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 uppercase">Référence :</span>
                <span className="font-mono font-black">{advance.reference_paiement || `DEP-${advance.id}`}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 uppercase">Date Opération :</span>
                <span className="font-black">{new Date(advance.date_avance || advance.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 uppercase">Mode de Paiement :</span>
                <span className="font-black uppercase">{advance.moyen_paiement || "Espèce"}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2">
                <span className="font-bold text-slate-500 uppercase">Montant Initial Déposé :</span>
                <span className="font-black text-emerald-600 text-sm">{formatCurrencyAmount(advance.montant_initial)}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-500 uppercase">Solde Restant Disponible :</span>
                <span className="font-black text-indigo-600 text-sm">{formatCurrencyAmount(advance.montant_restant)}</span>
              </div>
              {advance.notes && (
                <div className="text-[10px] text-slate-500 italic border-t border-slate-100 pt-1">
                  Note : {advance.notes}
                </div>
              )}
            </div>
          )}

          {/* TOTAL & CURRENCY */}
          <div className="flex justify-between items-center py-2 border-t-2 border-slate-950 border-b-2 border-slate-950 font-black text-sm uppercase mb-2">
             <span>TOTAL SOLDE DISPONIBLE</span>
             <span>{new Intl.NumberFormat('fr-FR').format(receiptMode === 'statement' ? totalBalance : advance.montant_restant)}</span>
          </div>
          <div className="text-center font-extrabold text-[10px] italic uppercase tracking-wider mb-6 text-slate-800">
             Francs CFA
          </div>

          {/* SIGNATURES */}
          <div className="grid grid-cols-2 gap-8 mt-6">
             <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-900 mb-10">Signature Client</p>
                <div className="h-px bg-slate-950 w-3/4 mx-auto"></div>
             </div>
             <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-900 mb-10">Signature Vendeur</p>
                <div className="h-px bg-slate-950 w-3/4 mx-auto"></div>
             </div>
          </div>

          {/* Date of Print & Page Footer */}
          <div className="mt-8 flex justify-between items-center border-t border-slate-200 pt-3 text-[8px] font-bold text-slate-400">
             <span>
                {(() => {
                  const now = new Date();
                  const dd = String(now.getDate()).padStart(2, '0');
                  const mm = String(now.getMonth() + 1).padStart(2, '0');
                  const yyyy = now.getFullYear();
                  const timeStr = now.toTimeString().split(' ')[0];
                  return `${dd}/${mm}/${yyyy} ${timeStr}`;
                })()}
             </span>
             <span>Page 1</span>
          </div>

        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
            background: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-advance, #printable-advance * {
            visibility: visible;
          }
          #printable-advance {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: ${pageSize === 'Ticket' ? '4mm' : '8mm'} !important;
            margin: 0 !important;
          }
          @page {
            size: ${pageSize === 'Ticket' ? '80mm 200mm' : pageSize === 'A4' ? 'A4 portrait' : 'A5 portrait'};
            margin: 0;
          }
          .border-slate-950 { border-color: #000000 !important; }
          .border-slate-300 { border-color: #cbd5e1 !important; }
        }
      `}</style>
    </div>
  );
}
