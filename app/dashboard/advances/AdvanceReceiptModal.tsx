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
  Truck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  const [docType, setDocType] = useState<'Facture' | 'Bon de Livraison'>('Facture');

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
          ref = `${yy}DRSNO-${mm}${suffix}`;
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
          operation: "RETRAIT",
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
          <p className="font-bold text-slate-600 font-outfit">Génération du reçu...</p>
        </div>
      </div>
    );
  }

  if (!advance) return null;

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
                onClick={() => setDocType('Facture')}
                className={`px-6 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                  docType === 'Facture' 
                  ? 'bg-emerald-600 text-white shadow-md scale-105' 
                  : 'text-slate-500 hover:text-slate-800'
                }`}
             >
                <FileText size={14} /> Facture
             </button>
             <button
                onClick={() => setDocType('Bon de Livraison')}
                className={`px-6 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
                  docType === 'Bon de Livraison' 
                  ? 'bg-slate-300 text-slate-600 shadow-md scale-105' 
                  : 'text-slate-500 hover:text-slate-800'
                }`}
             >
                <Truck size={14} /> Bon de Livraison
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

      {/* Main Container */}
      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible transition-all duration-500 ${
        pageSize === 'A4' ? 'max-w-[210mm]' : pageSize === 'Ticket' ? 'max-w-[80mm]' : 'max-w-[148mm]'
      } w-full rounded-[40px] border border-slate-100 print:border-none`}>
        
        <div id="printable-advance" className="p-8 text-slate-950 font-outfit leading-tight relative overflow-hidden print:p-4">
          
          {/* Header Info like the photo */}
          <div className="text-center w-full flex flex-col items-center mb-6 border-b border-dashed border-slate-300 pb-6">
            <h1 className="text-xl font-black uppercase text-slate-900 tracking-tight leading-none">{company?.nom_entreprise || "ETSOUNO"}</h1>
            <p className="text-xs font-bold text-slate-600 mt-1">Etablissement SOUNA</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">
               {company?.slogan || "Ventes de matériaux de construction"}
            </p>
            <p className="text-[9px] text-slate-400 font-bold mt-1">
               {company?.adresse || "sous la route PMI 17 Portes BP 281"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-1 text-[8px] font-black text-slate-400">
               <span>RCCM: {company?.rccm || 'NI-MAR-2007-A-93'}</span>
               <span>NIF: {company?.nif || '11835/R'}</span>
            </div>
            <p className="text-[8px] font-bold text-slate-400 mt-1">
               Tél: {company?.telephone || '96.29.77.03 - 96.97.01.57'}
            </p>
          </div>

          {/* Title Section */}
          <div className="text-center mb-6 border-b-2 border-slate-900 pb-4">
            <h2 className="text-md font-black uppercase tracking-wider text-slate-900">
               SITUATION DEPOTS TIERS
            </h2>
            <p className="text-sm font-black text-slate-900 uppercase mt-2">
               {advance.clients?.tel ? `${advance.clients.tel} ` : ""}{advance.clients?.nom}
            </p>
            <p className="text-xs font-black text-indigo-600 uppercase mt-1 tracking-widest">
               {advance.emplacement || "SOUNO SIEGE"}
            </p>
          </div>

          {/* Transaction Ledger Table like the photo */}
          <div className="mb-6 overflow-hidden">
             <table className="w-full text-left border border-slate-950 border-collapse">
                <thead>
                   <tr className="text-[9px] font-black bg-slate-50 text-slate-900 uppercase border-b-2 border-slate-950">
                      <th className="py-2.5 px-3 border-r border-slate-950">REF.</th>
                      <th className="py-2.5 px-3 border-r border-slate-950 text-center">DATE</th>
                      <th className="py-2.5 px-3 border-r border-slate-950 text-right">MONTANT</th>
                      <th className="py-2.5 px-3 text-center">OPERATIONS</th>
                   </tr>
                </thead>
                <tbody className="text-[11px] font-bold text-slate-900">
                   {transactions.map((tx, idx) => (
                     <tr key={tx.id} className="border-b border-slate-300 last:border-none">
                        <td className="py-2.5 px-3 border-r border-slate-950 font-mono text-[10px]">{tx.ref}</td>
                        <td className="py-2.5 px-3 border-r border-slate-950 text-center">
                           {new Date(tx.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-2.5 px-3 border-r border-slate-950 text-right font-black">
                           {tx.montant < 0 ? '-' : ''}{new Intl.NumberFormat('fr-FR').format(Math.abs(tx.montant))}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-[9px] uppercase tracking-wider">{tx.operation}</td>
                     </tr>
                   ))}
                   {transactions.length === 0 && (
                     <tr>
                       <td colSpan={4} className="py-6 text-center text-slate-400 italic font-normal text-xs">
                         Aucun mouvement de dépôt disponible.
                       </td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>

          {/* TOTAL & CURRENCY */}
          <div className="flex justify-between items-center py-2.5 border-t-2 border-slate-950 border-b-2 border-slate-950 font-black text-sm uppercase mb-3">
             <span>TOTAL</span>
             <span>{new Intl.NumberFormat('fr-FR').format(totalBalance)}</span>
          </div>
          <div className="text-center font-extrabold text-[11px] italic uppercase tracking-wider mb-8 text-slate-800">
             Francs CFA
          </div>

          {/* SIGNATURES */}
          <div className="grid grid-cols-2 gap-12 mt-6">
             <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-900 mb-12">Signature Client</p>
                <div className="h-px bg-slate-950 w-3/4 mx-auto"></div>
             </div>
             <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-900 mb-12">Signature Vendeur</p>
                <div className="h-px bg-slate-950 w-3/4 mx-auto"></div>
             </div>
          </div>

          {/* Date of Print & Page Footer */}
          <div className="mt-12 flex justify-between items-center border-t border-slate-200 pt-4 text-[8px] font-bold text-slate-400">
             <span>
                {(() => {
                  const now = new Date();
                  const mm = String(now.getMonth() + 1).padStart(2, '0');
                  const dd = String(now.getDate()).padStart(2, '0');
                  const yyyy = now.getFullYear();
                  const timeStr = now.toTimeString().split(' ')[0];
                  return `${mm}-${dd}-${yyyy} ${timeStr}`;
                })()}
             </span>
             <span>Page 1</span>
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
          #printable-advance, #printable-advance * {
            visibility: visible;
          }
          #printable-advance {
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
          .bg-emerald-600 { background-color: #059669 !important; color: #fff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .bg-indigo-50 { background-color: #eef2ff !important; }
          .bg-slate-300 { background-color: #cbd5e1 !important; color: #475569 !important; }
          .text-white { color: #fff !important; }
          .text-indigo-600 { color: #4f46e5 !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-rose-500 { color: #f43f5e !important; }
          .text-indigo-400 { color: #818cf8 !important; }
          .border-indigo-100 { border-color: #e0e7ff !important; }
          .border-slate-100 { border-color: #f1f5f9 !important; }
          .border-slate-950 { border-color: #000000 !important; }
          .border-slate-300 { border-color: #cbd5e1 !important; }
        }
      `}</style>
    </div>
  );
}
