"use client";

import { useEffect, useState } from "react";
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
  const [history, setHistory] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5' | 'Ticket'>('A5');
  const [docType, setDocType] = useState<'Facture' | 'Bon de Livraison'>('Facture');

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
          .select("*, clients(nom, tel, adresse)")
          .eq("id", advanceId)
          .single();
        
        setAdvance(adv);

        const { data: hist } = await supabase
          .from("avances_history")
          .select("*")
          .eq("advance_id", advanceId)
          .order("date_action", { ascending: true });
        
        setHistory(hist || []);

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
        
        <div id="printable-advance" className={`p-10 text-slate-900 font-outfit leading-tight relative overflow-hidden ${
           pageSize === 'Ticket' ? 'px-4 py-6' : 'p-10'
        }`}>
          
          {/* Watermark */}
          {pageSize !== 'Ticket' && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45 text-[100px] font-black text-slate-50 opacity-[0.03] select-none pointer-events-none uppercase">
              DÉPÔT VALIDE
            </div>
          )}

          {/* HEADER */}
          <div className={`flex justify-between items-start mb-10 pb-6 border-b-2 border-slate-900 ${
             pageSize === 'Ticket' ? 'flex-col items-center text-center gap-4' : ''
          }`}>
            <div className={pageSize === 'Ticket' ? 'text-center' : 'text-left'}>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">{company?.nom_entreprise || "ETS SOUNO"}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 max-w-[200px] leading-relaxed mx-auto">
                {company?.adresse || "MARADI-NIGER"}
              </p>
              <div className={`flex items-center gap-3 mt-3 text-[9px] font-black text-slate-400 ${pageSize === 'Ticket' ? 'justify-center' : ''}`}>
                 <span className="flex items-center gap-1"><Info size={10}/> NIF: {company?.nif || '11835/R'}</span>
                 <span className="flex items-center gap-1"><Calendar size={10}/> {new Date().toLocaleDateString()}</span>
              </div>
            </div>
            {pageSize !== 'Ticket' && (
              <div className="text-right flex flex-col items-end">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg mb-2">
                    <ShieldCheck size={28} />
                </div>
                <p className="text-[10px] font-black text-slate-900 uppercase">Document Certifié</p>
                <p className="text-[8px] font-bold text-slate-400">Tél: {company?.telephone || '98 41 03 99'}</p>
              </div>
            )}
          </div>

          {/* TITLE SECTION */}
          <div className="text-center mb-10">
            <h2 className={`${pageSize === 'Ticket' ? 'text-lg' : 'text-3xl'} font-black uppercase tracking-[0.1em] text-slate-900 relative inline-block`}>
               {docType === 'Facture' ? 'REÇU DE DÉPÔT' : 'BON DE LIVRAISON'}
               <div className="absolute -bottom-2 left-0 w-full h-1 bg-indigo-600 rounded-full"></div>
            </h2>
          </div>

          {/* DÉTAILS SECTION */}
          <div className={`grid ${pageSize === 'Ticket' ? 'grid-cols-1 gap-6' : 'grid-cols-2 gap-10'} mb-10 text-[11px]`}>
             <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Détails du Reçu</p>
                   <div className="flex justify-between mb-1"><span className="font-bold text-slate-500">N°:</span> <span className="font-black text-indigo-600">#{advance.id} / {advance.reference_paiement || 'NCR'}</span></div>
                   <div className="flex justify-between mb-1"><span className="font-bold text-slate-500">Date:</span> <span className="font-black">{new Date(advance.date_avance).toLocaleDateString('fr-FR')}</span></div>
                   <div className="flex justify-between"><span className="font-bold text-slate-500">Mode:</span> <span className="font-black">{advance.moyen_paiement}</span></div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Localisation & Vente</p>
                   <div className="flex items-center gap-2 mb-1"><MapPin size={12} className="text-indigo-500"/><span className="font-black uppercase">{advance.emplacement || "Général"}</span></div>
                   <div className="flex items-center gap-2"><User size={12} className="text-indigo-500"/><span className="font-bold text-slate-500 text-[9px]">Vendeur:</span> <span className="font-black">{advance.utilisateur}</span></div>
                </div>
             </div>

             <div className="space-y-4">
                <div className="bg-indigo-50/50 p-5 rounded-3xl border-2 border-indigo-100 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-2 opacity-10"><User size={40} /></div>
                   <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2">Informations Client</p>
                   <p className={`${pageSize === 'Ticket' ? 'text-sm' : 'text-lg'} font-black text-slate-900 uppercase tracking-tighter mb-1`}>{advance.clients?.nom}</p>
                   <p className="text-[10px] font-bold text-slate-500">Tél: {advance.clients?.tel || 'N/A'}</p>
                   <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      advance.statut === 'Disponible' ? 'bg-emerald-100 text-emerald-700' : 
                      advance.statut === 'Annulée' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                   }`}>
                      <CheckCircle size={10}/> {advance.statut}
                   </div>
                </div>
             </div>
          </div>

          {/* BIG AMOUNT */}
          <div className="mb-10 text-center">
             <div className={`inline-block ${pageSize === 'Ticket' ? 'px-6 py-4' : 'px-12 py-8'} bg-slate-900 text-white rounded-[40px] shadow-2xl relative`}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-[0.2em]">Montant Principal</div>
                <p className={`${pageSize === 'Ticket' ? 'text-2xl' : 'text-5xl'} font-black tracking-tighter`}>
                   {new Intl.NumberFormat('fr-FR').format(advance.montant_initial)}
                   <span className={`${pageSize === 'Ticket' ? 'text-xs' : 'text-xl'} ml-2 text-indigo-400`}>FCFA</span>
                </p>
             </div>
          </div>

          {/* WORDS */}
          <div className="bg-slate-50 p-6 rounded-[32px] border-2 border-slate-100 mb-10">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Montant en toutes lettres</p>
             <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight leading-relaxed">
                {numberToWordsFr(advance.montant_initial)} francs CFA.
             </p>
          </div>

           {/* TABLE RECAP */}
           <div className="mb-8">
              <table className="w-full text-left">
                 <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                       <th className="py-3 px-4">Désignation</th>
                       <th className="py-3 px-4 text-right">Crédit</th>
                       <th className="py-3 px-4 text-right">Débit</th>
                    </tr>
                 </thead>
                 <tbody className="text-xs font-bold text-slate-700">
                    <tr className="border-b border-slate-50">
                       <td className="py-4 px-4 font-black text-[10px]">Dépôt Initial</td>
                       <td className="py-4 px-4 text-right text-emerald-600">+{new Intl.NumberFormat('fr-FR').format(advance.montant_initial)}</td>
                       <td className="py-4 px-4 text-right text-slate-300">—</td>
                    </tr>
                    <tr className="border-b border-slate-50">
                       <td className="py-4 px-4 font-bold italic text-slate-400 text-[10px]">Utilisation (-)</td>
                       <td className="py-4 px-4 text-right text-slate-300">—</td>
                       <td className="py-4 px-4 text-right text-rose-500">-{new Intl.NumberFormat('fr-FR').format(advance.montant_initial - advance.montant_restant)}</td>
                    </tr>
                    <tr className="bg-indigo-600 text-white">
                       <td className={`py-5 px-6 ${pageSize === 'Ticket' ? 'rounded-l-2xl' : 'rounded-l-[24px]'} font-black uppercase text-[10px]`}>Solde Nette</td>
                       <td className="py-5 px-6 text-right font-black text-lg" colSpan={2}>
                          {new Intl.NumberFormat('fr-FR').format(advance.montant_restant)} <span className="text-[10px] text-indigo-200">FCFA</span>
                       </td>
                    </tr>
                 </tbody>
              </table>
           </div>

           {/* TABLE HISTORY */}
           <div className="mb-12">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                 <FileBadge size={12} /> Historique des Mouvements du Dépôt
              </p>
              <div className="border border-slate-100 rounded-[20px] overflow-hidden">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50">
                       <tr className="text-[9px] font-black text-slate-400 uppercase border-b border-slate-100">
                          <th className="py-3 px-4">Date</th>
                          <th className="py-3 px-4">Opération</th>
                          <th className="py-3 px-4">Référence</th>
                          <th className="py-3 px-4 text-right">Montant</th>
                       </tr>
                    </thead>
                    <tbody className="text-[10px] font-bold text-slate-700">
                       {history.map((h, i) => {
                         const op = h.action === 'CREATE' ? 'Dépôt Initial' : h.action === 'WITHDRAW' ? 'Utilisation (Retrait)' : h.action === 'CANCEL' ? 'Annulation' : 'Modification';
                         const ref = h.action === 'CREATE' ? (advance.reference_paiement || 'N/A') : (h.notes || 'N/A');
                         const sign = h.action === 'WITHDRAW' || h.action === 'CANCEL' ? '-' : '+';
                         const color = h.action === 'WITHDRAW' || h.action === 'CANCEL' ? 'text-rose-500' : 'text-emerald-600';
                         
                         return (
                           <tr key={i} className="border-b border-slate-50 last:border-none">
                              <td className="py-3 px-4">{new Date(h.date_action).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'})}</td>
                              <td className="py-3 px-4 uppercase">{op}</td>
                              <td className="py-3 px-4 italic text-slate-500">{ref}</td>
                              <td className={`py-3 px-4 text-right font-black ${color}`}>
                                 {h.amount > 0 ? `${sign}${new Intl.NumberFormat('fr-FR').format(h.amount)}` : '—'}
                              </td>
                           </tr>
                         );
                       })}
                       {history.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400 italic font-normal text-[10px]">
                               Aucun historique disponible.
                            </td>
                          </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>

          {/* OBSERVATIONS */}
          {advance.notes && (
             <div className="mb-12">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                   <FileText size={12} /> Observations
                </p>
                <div className="p-5 bg-slate-50 rounded-2xl italic text-[10px] text-slate-600 border border-slate-100 leading-relaxed">
                   {advance.notes}
                </div>
             </div>
          )}

          {/* SIGNATURES */}
          <div className="grid grid-cols-2 gap-16 mt-auto">
             <div className="text-center">
                <div className="h-[60px] flex items-center justify-center opacity-10">
                   <User size={50} />
                </div>
                <p className="text-[10px] font-black uppercase text-slate-300 mb-2">Signature Client</p>
                <div className="h-px bg-slate-100"></div>
             </div>
             <div className="text-center">
                <div className="h-[60px] flex items-center justify-center opacity-10">
                   <ShieldCheck size={50} />
                </div>
                <p className="text-[10px] font-black uppercase text-slate-300 mb-2">Signature Vendeur</p>
                <div className="h-px bg-slate-100"></div>
             </div>
          </div>

          {/* FOOTER */}
          <div className="mt-16 text-center border-t border-slate-50 pt-6">
             <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">
                {company?.nom_entreprise} — {new Date().getFullYear()}
             </p>
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
        }
      `}</style>
    </div>
  );
}
