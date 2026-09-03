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
  ListOrdered,
  ArrowDownToLine,
  ArrowRightLeft
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/context";

const supabase = createClient();

export type ReceiptType = 'single' | 'statement' | 'withdraw' | 'imputation';

type AdvanceReceiptModalProps = {
  advanceId: number;
  onClose: () => void;
  initialMode?: ReceiptType;
  customOperationData?: {
    type?: string;
    amount?: number;
    reference?: string;
    notes?: string;
    invoice_ref?: string;
    invoice_remaining?: number;
    advance_remaining?: number;
  };
};

export default function AdvanceReceiptModal({ 
  advanceId, 
  onClose, 
  initialMode = 'single',
  customOperationData 
}: AdvanceReceiptModalProps) {
  const { locale, dir } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [advance, setAdvance] = useState<any>(null);
  const [allAdvances, setAllAdvances] = useState<any[]>([]);
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [advancePayments, setAdvancePayments] = useState<any[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5' | 'Ticket'>('A5');
  const [receiptMode, setReceiptMode] = useState<ReceiptType>(initialMode);
  const [viewScope, setViewScope] = useState<'all' | 'single'>('all');

  const transactions = useMemo(() => {
    const list: any[] = [];
    
    // 1. Add all deposits
    allAdvances.forEach(a => {
      list.push({
        id: `dep-${a.id}`,
        date: a.date_avance || a.created_at,
        ref: a.reference_paiement || `DEP-${a.id}`,
        montant: Number(a.montant_initial),
        operation: locale === "ar" ? "إيداع أمانة" : "DEPOT",
        notes: a.notes || (locale === "ar" ? "إيداع مبدئي" : "Dépôt initial"),
        timestamp: new Date(a.date_avance || a.created_at).getTime()
      });
    });

    // 2. Add all withdrawals, invoice payments, and cancellations
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
          operation: locale === "ar" ? "سحب نقدي" : "RETRAIT",
          notes: h.notes || (locale === "ar" ? "سحب من الأمانة" : "Retrait de fonds"),
          timestamp: new Date(h.date_action).getTime()
        });
      } else if (h.action === "INVOICE_PAYMENT") {
        list.push({
          id: `inv-${h.id}`,
          date: h.date_action,
          ref: h.notes || `FAC-${h.id}`,
          montant: -Number(h.amount),
          operation: locale === "ar" ? "تسوية فاتورة" : "REGLEMENT FACTURE",
          notes: h.notes || (locale === "ar" ? "استخدام في فاتورة" : "Imputation sur facture"),
          timestamp: new Date(h.date_action).getTime()
        });
      } else if (h.action === "CANCEL") {
        list.push({
          id: `cnc-${h.id}`,
          date: h.date_action,
          ref: `ANN-${h.advance_id}`,
          montant: -Number(h.amount),
          operation: locale === "ar" ? "إلغاء أمانة" : "ANNULATION",
          notes: locale === "ar" ? "تم إلغاء الإيداع" : "Dépôt annulé",
          timestamp: new Date(h.date_action).getTime()
        });
      }
    });

    // Sort chronologically by date
    list.sort((a, b) => a.timestamp - b.timestamp);
    return list;
  }, [allAdvances, allHistory, locale]);

  const totalBalance = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + tx.montant, 0);
  }, [transactions]);

  const targetAdvances = useMemo(() => {
    if (!advance) return [];
    if (viewScope === 'single') return [advance];
    return allAdvances.length > 0 ? allAdvances : [advance];
  }, [advance, allAdvances, viewScope]);

  const singleAdvanceMovements = useMemo(() => {
    if (!targetAdvances || targetAdvances.length === 0) return [];
    const list: any[] = [];
    const targetIds = targetAdvances.map(a => Number(a.id));

    // 1. Initial Deposits (Credits) for all target advances
    targetAdvances.forEach(advItem => {
      list.push({
        id: `dep-${advItem.id}`,
        date: advItem.date_avance || advItem.created_at,
        type: locale === "ar" 
          ? (viewScope === 'all' ? `إيداع أمانة (DEP-${advItem.id})` : "إيداع أمانة مبدئي")
          : (viewScope === 'all' ? `Dépôt initial (DEP-${advItem.id})` : "Dépôt initial"),
        ref: advItem.reference_paiement || `DEP-${advItem.id}`,
        mode: advItem.moyen_paiement || "Espèce",
        debit: 0,
        credit: Number(advItem.montant_initial) || 0,
        notes: advItem.notes || (locale === "ar" ? "إيداع أمانة نقدي" : "Constitution d'acompte"),
        timestamp: new Date(advItem.date_avance || advItem.created_at).getTime()
      });
    });

    // 2. Withdrawals and History for target advances
    const relevantHistory = allHistory.filter(h => targetIds.includes(Number(h.advance_id)));
    relevantHistory.forEach(h => {
      const isWithdraw = h.action === "WITHDRAW";
      const isInvoice = h.action === "INVOICE_PAYMENT";
      const isCancel = h.action === "CANCEL";

      list.push({
        id: `h-${h.id}`,
        date: h.date_action,
        type: isWithdraw 
          ? (locale === "ar" ? "سحب / استرداد نقدي" : "Retrait d'acompte")
          : isInvoice 
            ? (locale === "ar" ? "تسوية فاتورة" : "Imputation Facture")
            : isCancel 
              ? (locale === "ar" ? "إلغاء أمانة" : "Annulation")
              : (h.action || "Mouvement"),
        ref: h.notes || (isWithdraw ? `RET-${h.id}` : isInvoice ? `IMP-${h.id}` : `MVT-${h.id}`),
        mode: isWithdraw ? "Espèce" : "Avance",
        debit: Number(h.amount) || 0,
        credit: 0,
        notes: h.notes || "",
        timestamp: new Date(h.date_action).getTime()
      });
    });

    // 3. Linked Payments for target advances (Real Invoices & Operations)
    advancePayments.forEach(p => {
      const advId = Number(p.avance_client_id);
      if (targetIds.includes(advId)) {
        const invNumber = p.factures?.bl_number || p.reference_paiement || `FA-${p.facture_id}`;
        list.push({
          id: `pay-${p.id}`,
          date: p.date_operation || p.created_at,
          type: locale === "ar" 
            ? (viewScope === 'all' ? `تسوية فاتورة ${invNumber} (DEP-${advId})` : `تسوية فاتورة ${invNumber}`)
            : (viewScope === 'all' ? `Règlement Facture ${invNumber} (DEP-${advId})` : `Règlement Facture ${invNumber}`),
          ref: invNumber,
          mode: p.moyen_reglement || "Avance",
          debit: Number(p.montant_regle) || 0,
          credit: 0,
          notes: locale === "ar" 
            ? `خصم من الأمانة DEP-${advId} لسداد مبيعات الفاتورة ${invNumber}` 
            : `Imputation sur acompte DEP-${advId} pour facture ${invNumber}`,
          timestamp: new Date(p.date_operation || p.created_at).getTime()
        });
      }
    });

    // 4. Per-advance reconciliation: If remaining < initial and debits don't equal difference
    targetAdvances.forEach(advItem => {
      const histDebits = relevantHistory
        .filter(h => Number(h.advance_id) === Number(advItem.id))
        .reduce((sum, h) => sum + Number(h.amount || 0), 0);

      const payDebits = advancePayments
        .filter(p => Number(p.avance_client_id) === Number(advItem.id))
        .reduce((sum, p) => sum + Number(p.montant_regle || 0), 0);

      const totalAccounted = histDebits + payDebits;
      const expectedConsumed = Math.max(0, (Number(advItem.montant_initial) || 0) - (Number(advItem.montant_restant) || 0));

      if (expectedConsumed > totalAccounted) {
        const diff = expectedConsumed - totalAccounted;
        list.push({
          id: `auto-diff-${advItem.id}`,
          date: advItem.updated_at || advItem.date_avance || advItem.created_at,
          type: locale === "ar" 
            ? (viewScope === 'all' ? `حركة سحب / استهلاك سابقة (DEP-${advItem.id})` : "حركة سحب / استهلاك سابقة")
            : (viewScope === 'all' ? `Retrait / Déduction antérieure (DEP-${advItem.id})` : "Retrait / Déduction antérieure"),
          ref: `IMP-00${advItem.id}`,
          mode: "Avance",
          debit: diff,
          credit: 0,
          notes: locale === "ar" ? "استهلاك برسم مبيعات أو سحب سابق" : "Mouvement antérieur déduit",
          timestamp: new Date(advItem.date_avance || advItem.created_at).getTime() + 1000
        });
      }
    });

    // Sort chronologically
    list.sort((a, b) => a.timestamp - b.timestamp);

    // Compute continuous running balance
    let running = 0;
    return list.map(item => {
      running += (item.credit - item.debit);
      return {
        ...item,
        solde_courant: running
      };
    });
  }, [targetAdvances, allHistory, advancePayments, viewScope, locale]);

  const singleTotals = useMemo(() => {
    let deb = 0;
    let cred = 0;
    singleAdvanceMovements.forEach(m => {
      deb += m.debit;
      cred += m.credit;
    });
    return {
      totalDebit: deb,
      totalCredit: cred,
      finalBalance: cred - deb
    };
  }, [singleAdvanceMovements]);

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

            // Fetch ALL linked payments for all client advances
            try {
              const { data: payData, error: pErr } = await supabase
                .from("paiements")
                .select("*, factures(id, bl_number, total_ttc, date_facture)")
                .in("avance_client_id", advIds);
              if (!pErr && payData) {
                setAdvancePayments(payData);
              } else if (pErr) {
                console.error("Notice: error querying paiements:", pErr);
              }
            } catch (pErr) {
              console.warn("Notice: paiements query in AdvanceReceiptModal:", pErr);
            }

            try {
              const { data: allHist, error: hErr } = await supabase
                .from("avances_history")
                .select("*")
                .in("advance_id", advIds)
                .order("date_action", { ascending: true });
              
              if (!hErr && allHist) {
                setAllHistory(allHist);
              }
            } catch (hCatch) {
              console.warn("Notice: avances_history in AdvanceReceiptModal:", hCatch);
            }
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
          <p className="font-bold text-slate-600">
            {locale === "ar" ? "جاري تحضير مستند الطباعة..." : "Génération du document..."}
          </p>
        </div>
      </div>
    );
  }

  if (!advance) return null;

  // Title calculation according to mode
  const getDocTitle = () => {
    if (receiptMode === 'statement') {
      return locale === "ar" ? "كشف وضعية الأمانات والودائع" : "SITUATION DEPOTS TIERS";
    }
    if (receiptMode === 'withdraw') {
      return locale === "ar" ? "وصل سحب / استرداد أمانة" : "REÇU DE RETRAIT D'ACOMPTE";
    }
    if (receiptMode === 'imputation') {
      return locale === "ar" ? "وصل تسوية فاتورة من الأمانة" : "REÇU D'IMPUTATION FACTURE";
    }
    return locale === "ar" ? "وصل إيداع / أمانة عميل" : "REÇU D'ACOMPTE / DEPOT CLIENT";
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar - Modernized Toggle Buttons */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 print:hidden z-[110]">
          {/* Mode Toggle Buttons */}
          <div className="bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl flex items-center shadow-2xl border border-white/20 gap-1">
             <button
                onClick={() => setReceiptMode('single')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  receiptMode === 'single' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white'
                }`}
             >
                <Receipt size={13} /> {locale === "ar" ? "وصل الإيداع" : "Reçu Dépôt"}
             </button>

             <button
                onClick={() => setReceiptMode('withdraw')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  receiptMode === 'withdraw' 
                  ? 'bg-amber-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white'
                }`}
             >
                <ArrowDownToLine size={13} /> {locale === "ar" ? "وصل السحب" : "Reçu Retrait"}
             </button>

             <button
                onClick={() => setReceiptMode('imputation')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  receiptMode === 'imputation' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white'
                }`}
             >
                <ArrowRightLeft size={13} /> {locale === "ar" ? "وصل الفاتورة" : "Imputation"}
             </button>

             <button
                onClick={() => setReceiptMode('statement')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  receiptMode === 'statement' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-300 hover:text-white'
                }`}
             >
                <ListOrdered size={13} /> {locale === "ar" ? "كشف الحساب" : "Relevé"}
             </button>
          </div>

          {/* Paper Size Toggle */}
          <div className="bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl flex items-center shadow-2xl border border-white/20">
             {(['A4', 'A5', 'Ticket'] as const).map((size) => (
               <button
                 key={size}
                 onClick={() => setPageSize(size)}
                 className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                   pageSize === size 
                   ? 'bg-white text-slate-900 shadow-md' 
                   : 'text-slate-300 hover:text-white'
                 }`}
               >
                 {size === 'Ticket' ? (locale === "ar" ? "إيصال حراري" : "Ticket 80mm") : size}
               </button>
             ))}
          </div>

          {/* Print & Close Buttons */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black shadow-xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer size={18} />
              <span>{locale === "ar" ? "طباعة الوصل" : "Imprimer"}</span>
            </button>
            <button 
              onClick={onClose}
              className="bg-white/90 hover:bg-white text-slate-600 p-3 rounded-2xl shadow-xl transition-all cursor-pointer border border-slate-200"
            >
              <X size={18} />
            </button>
          </div>
      </div>

      {/* Main Document Body */}
      <div className={`bg-white h-auto max-h-[92vh] overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:max-h-none print:overflow-visible transition-all duration-300 ${
        pageSize === 'A4' ? 'max-w-[210mm]' : pageSize === 'Ticket' ? 'max-w-[80mm]' : 'max-w-[148mm]'
      } w-full rounded-[32px] border border-slate-200 print:border-none`}>
        
        <div id="printable-advance" className="p-8 text-slate-950 font-sans leading-tight relative overflow-hidden print:p-4" dir={dir}>
          
          {/* Company Header */}
          <div className="text-center w-full flex flex-col items-center mb-5 border-b border-dashed border-slate-300 pb-4">
            <h1 className="text-base sm:text-lg font-black uppercase text-slate-900 tracking-tight leading-none">
              {company?.nom_entreprise || "GESTION PRO GLOBAL"}
            </h1>
            <p className="text-xs font-bold text-slate-600 mt-1">
              {company?.activite || "Solutions ERP & Commerce Multi-dépôts"}
            </p>
            <p className="text-[9px] text-slate-500 font-bold mt-0.5">
               {company?.adresse || "Siège Commercial International"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-1 text-[8px] font-black text-slate-400">
               {company?.nif && <span>NIF: {company.nif}</span>}
               {company?.rccm && <span>RCCM: {company.rccm}</span>}
               {company?.telephone && <span>Tél: {company.telephone}</span>}
            </div>
          </div>

          {/* Title Section */}
          <div className="text-center mb-4 border-b-2 border-slate-900 pb-3">
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
               {getDocTitle()}
            </h2>
            {(() => {
              const clientObj = Array.isArray(advance.clients) ? advance.clients[0] : advance.clients;
              const clientNom = clientObj?.nom || (advance.client_id ? `Client #${advance.client_id}` : "Client");
              const clientTel = clientObj?.tel || "";
              const clientRef = clientObj?.ref_client || "";
              const displayRef = advance.reference_paiement || clientRef || `DEP-${String(advance.id).padStart(4, '0')}`;

              return (
                <>
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <span className="text-xs font-black text-slate-900 uppercase">
                       {clientNom}
                    </span>
                    {clientTel && (
                      <span className="text-[11px] font-bold text-slate-500">
                        ({clientTel})
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-bold text-blue-600 mt-0.5 flex items-center justify-center gap-2">
                     <span>{locale === "ar" ? "الفرع:" : "Emplacement :"} {advance.emplacement || "BOUTIQUE"}</span>
                     <span>•</span>
                     <span className="font-mono text-slate-700">REF: {displayRef}</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* 1. Mode Statement: Table of all movements */}
          {receiptMode === 'statement' && (
            <div className="mb-5 overflow-hidden">
               <table className="w-full text-left border border-slate-950 border-collapse">
                  <thead>
                     <tr className="text-[9px] font-black bg-slate-50 text-slate-900 uppercase border-b-2 border-slate-950">
                        <th className="py-2 px-2 border-r border-slate-950">REF.</th>
                        <th className="py-2 px-2 border-r border-slate-950 text-center">DATE</th>
                        <th className="py-2 px-2 border-r border-slate-950 text-right">{locale === "ar" ? "المبلغ" : "MONTANT"}</th>
                        <th className="py-2 px-2 text-center">{locale === "ar" ? "العملية" : "OPERATION"}</th>
                     </tr>
                  </thead>
                  <tbody className="text-[10px] font-bold text-slate-900">
                     {transactions.map((tx) => (
                       <tr key={tx.id} className="border-b border-slate-300 last:border-none">
                          <td className="py-1.5 px-2 border-r border-slate-950 font-mono text-[9px]">{tx.ref}</td>
                          <td className="py-1.5 px-2 border-r border-slate-950 text-center text-[9px]">
                             {new Date(tx.date).toLocaleDateString(locale === "ar" ? 'ar-SA' : 'fr-FR')}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-950 text-right font-black">
                             {tx.montant < 0 ? '-' : ''}{formatCurrencyAmount(Math.abs(tx.montant))}
                          </td>
                          <td className="py-1.5 px-2 text-center font-black text-[9px] uppercase tracking-wider">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                              tx.montant > 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {tx.operation}
                            </span>
                          </td>
                       </tr>
                     ))}
                     {transactions.length === 0 && (
                       <tr>
                         <td colSpan={4} className="py-4 text-center text-slate-400 italic font-normal text-xs">
                           {locale === "ar" ? "لا توجد حركات مسجلة." : "Aucun mouvement disponible."}
                         </td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
          )}

          {/* 2. Mode Single Deposit: Comprehensive Accounting Movements Table */}
          {receiptMode === 'single' && (
            <div className="mb-4 space-y-3">
              {/* Scope Switcher (Hidden in Print) */}
              {allAdvances.length > 1 && (
                <div className="flex items-center justify-between gap-2 print:hidden bg-slate-100 p-1.5 rounded-xl text-xs font-black">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewScope('all')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        viewScope === 'all' 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {locale === "ar" ? `جميع الإيداعات والحركات (${allAdvances.length})` : `Tous les dépôts & mouvements (${allAdvances.length})`}
                    </button>
                    <button
                      onClick={() => setViewScope('single')}
                      className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        viewScope === 'single' 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {locale === "ar" ? `هذا الإيداع فقط (${advance.reference_paiement || `DEP-${advance.id}`})` : `Ce dépôt seul (${advance.reference_paiement || `DEP-${advance.id}`})`}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    {locale === "ar" ? "سجل تدقيق الأمانات المحاسبي" : "Grand livre auxiliaire"}
                  </span>
                </div>
              )}

              {/* Deposit Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border border-slate-900 rounded-xl p-3 bg-slate-50/70 text-xs">
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">
                    {locale === "ar" ? "النطاق المحاسبي:" : "PORTÉE DU REÇU :"}
                  </span>
                  <span className="font-mono font-black text-slate-900">
                    {viewScope === 'all' 
                      ? (locale === "ar" ? `كامل الأمانات (${allAdvances.length})` : `Global (${allAdvances.length} dépôts)`)
                      : (advance.reference_paiement || `DEP-${advance.id}`)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">
                    {locale === "ar" ? "إجمالي الإيداعات (+):" : "TOTAL DÉPOSÉ (+) :"}
                  </span>
                  <span className="font-black text-emerald-600 font-mono">
                    +{formatCurrencyAmount(singleTotals.totalCredit)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">
                    {locale === "ar" ? "إجمالي المستهلك (-):" : "TOTAL DÉBITÉ (-) :"}
                  </span>
                  <span className="font-black text-rose-600 font-mono">
                    -{formatCurrencyAmount(singleTotals.totalDebit)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-slate-400 block">
                    {locale === "ar" ? "الرصيد الصافي المتاح:" : "SOLDE DISPONIBLE :"}
                  </span>
                  <span className="font-black text-blue-700 font-mono">
                    {formatCurrencyAmount(singleTotals.finalBalance)}
                  </span>
                </div>
              </div>

              {/* Table of Movements */}
              <div className="overflow-x-auto border border-slate-900 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[480px] print:min-w-full sm:min-w-full">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase text-[9px] font-black border-b border-slate-900 print:bg-slate-200 print:text-black">
                      <th className="py-2 px-2.5 border-r border-white/20 print:border-slate-400 text-center w-20">{locale === "ar" ? "التاريخ" : "DATE"}</th>
                      <th className="py-2 px-2.5 border-r border-white/20 print:border-slate-400">{locale === "ar" ? "العملية والبيان" : "OPÉRATION / LIBELLÉ"}</th>
                      <th className="py-2 px-2.5 border-r border-white/20 print:border-slate-400 text-center w-24">{locale === "ar" ? "المرجع" : "RÉFÉRENCE"}</th>
                      <th className="py-2 px-2.5 border-r border-white/20 print:border-slate-400 text-right w-24 text-rose-300 print:text-rose-700 font-black">{locale === "ar" ? "مدين (-)" : "DÉBIT (-)"}</th>
                      <th className="py-2 px-2.5 border-r border-white/20 print:border-slate-400 text-right w-24 text-emerald-300 print:text-emerald-700 font-black">{locale === "ar" ? "دائن (+)" : "CRÉDIT (+)"}</th>
                      <th className="py-2 px-2.5 text-right w-28 font-black">{locale === "ar" ? "الرصيد" : "SOLDE"}</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px] font-bold divide-y divide-slate-200">
                    {singleAdvanceMovements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-2.5 text-center font-mono text-[9px] text-slate-600 border-r border-slate-200">
                          {new Date(m.date).toLocaleDateString(locale === "ar" ? 'ar-SA' : 'fr-FR')}
                        </td>
                        <td className="py-2 px-2.5 border-r border-slate-200">
                          <div className="text-slate-900 font-black">{m.type}</div>
                          {m.notes && <div className="text-[9px] text-slate-400 font-normal truncate max-w-[200px]">{m.notes}</div>}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono text-[9px] text-slate-700 border-r border-slate-200">
                          {m.ref}
                        </td>
                        <td className="py-2 px-2.5 text-right font-black text-rose-600 border-r border-slate-200">
                          {m.debit > 0 ? `-${formatCurrencyAmount(m.debit)}` : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-black text-emerald-600 border-r border-slate-200">
                          {m.credit > 0 ? `+${formatCurrencyAmount(m.credit)}` : "—"}
                        </td>
                        <td className="py-2 px-2.5 text-right font-black text-slate-900 font-mono">
                          {formatCurrencyAmount(m.solde_courant)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-[10px] uppercase border-t-2 border-slate-950 print:bg-slate-200 print:text-black">
                      <td colSpan={3} className="py-2.5 px-3 text-right border-r border-white/20 print:border-slate-400">
                        {locale === "ar" ? "المجموع والرصيد المتبقي :" : "TOTAUX & SOLDE DISPONIBLE :"}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-rose-300 print:text-rose-700 font-mono border-r border-white/20 print:border-slate-400">
                        {singleTotals.totalDebit > 0 ? `-${formatCurrencyAmount(singleTotals.totalDebit)}` : "0 FCFA"}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-emerald-300 print:text-emerald-700 font-mono border-r border-white/20 print:border-slate-400">
                        +{formatCurrencyAmount(singleTotals.totalCredit)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-white print:text-black font-mono text-xs">
                        {formatCurrencyAmount(singleTotals.finalBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 3. Mode Withdraw: Dedicated Withdrawal Receipt */}
          {receiptMode === 'withdraw' && (
            <div className="mb-4 space-y-2 border border-amber-950 p-4 rounded-xl bg-amber-50/40">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600 uppercase">{locale === "ar" ? "مرجع الأمانة:" : "Acompte Origine :"}</span>
                <span className="font-mono font-black">{advance.reference_paiement || `DEP-${advance.id}`}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600 uppercase">{locale === "ar" ? "تاريخ السحب:" : "Date de Retrait :"}</span>
                <span className="font-black">{new Date().toLocaleDateString(locale === "ar" ? 'ar-SA' : 'fr-FR')}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-amber-200 pt-2">
                <span className="font-black text-amber-900 uppercase text-xs">{locale === "ar" ? "المبلغ المسحوب / المسترد:" : "Montant Retiré :"}</span>
                <span className="font-black text-rose-600 text-base">
                  {formatCurrencyAmount(Number(customOperationData?.amount || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600 uppercase">{locale === "ar" ? "الرصيد المتبقي بالأمانة:" : "Nouveau Solde Restant :"}</span>
                <span className="font-black text-blue-600 text-sm">
                  {formatCurrencyAmount(Number(customOperationData?.advance_remaining ?? advance.montant_restant))}
                </span>
              </div>
              {customOperationData?.notes && (
                <div className="text-[10px] text-slate-600 italic border-t border-amber-200 pt-1.5">
                  {locale === "ar" ? "سبب السحب:" : "Motif :"} {customOperationData.notes}
                </div>
              )}
            </div>
          )}

          {/* 4. Mode Imputation: Invoice Payment Receipt */}
          {receiptMode === 'imputation' && (
            <div className="mb-4 space-y-2 border border-indigo-950 p-4 rounded-xl bg-indigo-50/40">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600 uppercase">{locale === "ar" ? "الفاتورة المسددة:" : "Facture Destinataire :"}</span>
                <span className="font-mono font-black text-indigo-700">{customOperationData?.invoice_ref || "Facture Client"}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600 uppercase">{locale === "ar" ? "مرجع الأمانة:" : "Acompte Utilisé :"}</span>
                <span className="font-mono font-black">{advance.reference_paiement || `DEP-${advance.id}`}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-indigo-200 pt-2">
                <span className="font-black text-indigo-950 uppercase text-xs">{locale === "ar" ? "المبلغ المخصوم للفاتورة:" : "Montant Imputé :"}</span>
                <span className="font-black text-indigo-600 text-base">
                  {formatCurrencyAmount(Number(customOperationData?.amount || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600 uppercase">{locale === "ar" ? "رصيد الأمانة المتبقي:" : "Solde Restant Acompte :"}</span>
                <span className="font-black text-blue-600 text-sm">
                  {formatCurrencyAmount(Number(customOperationData?.advance_remaining ?? advance.montant_restant))}
                </span>
              </div>
              {customOperationData?.invoice_remaining !== undefined && (
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600 uppercase">{locale === "ar" ? "المتبقي على الفاتورة:" : "Reste à Payer Facture :"}</span>
                  <span className="font-black text-rose-600 text-sm">
                    {formatCurrencyAmount(Number(customOperationData.invoice_remaining))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* TOTAL BAR */}
          <div className="flex justify-between items-center py-2.5 border-t-2 border-slate-950 border-b-2 border-slate-950 font-black text-xs sm:text-sm uppercase mb-1">
             <span>{locale === "ar" ? "صافي الرصيد المتاح" : "SOLDE NET DISPONIBLE"}</span>
             <span className="text-blue-700">
               {formatCurrencyAmount(receiptMode === 'statement' ? totalBalance : Number(advance.montant_restant))}
             </span>
          </div>

          {/* SIGNATURES SECTION */}
          <div className="grid grid-cols-2 gap-6 mt-6 pt-2">
             <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-900 mb-8">
                  {locale === "ar" ? "توقيع المستلم / العميل" : "Signature Client / Bénéficiaire"}
                </p>
                <div className="h-px bg-slate-900 w-3/4 mx-auto"></div>
             </div>
             <div className="text-center">
                <p className="text-[9px] font-black uppercase text-slate-900 mb-8">
                  {locale === "ar" ? "توقيع وأختام الإدارة / الصندوق" : "Cachet & Signature Caisse"}
                </p>
                <div className="h-px bg-slate-900 w-3/4 mx-auto"></div>
             </div>
          </div>

          {/* Date of Print Footer */}
          <div className="mt-6 flex justify-between items-center border-t border-slate-200 pt-2 text-[8px] font-bold text-slate-400">
             <span>{new Date().toLocaleString(locale === "ar" ? "ar-SA" : "fr-FR")}</span>
             <span>GestionPro Global Cloud ERP</span>
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
            padding: ${pageSize === 'Ticket' ? '3mm' : '8mm'} !important;
            margin: 0 !important;
          }
          @page {
            size: ${pageSize === 'Ticket' ? '80mm 200mm' : pageSize === 'A4' ? 'A4 portrait' : 'A5 portrait'};
            margin: 0;
          }
          .border-slate-950 { border-color: #000000 !important; }
        }
      `}</style>
    </div>
  );
}
