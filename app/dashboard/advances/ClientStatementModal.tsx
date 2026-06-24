"use client";

import { useEffect, useState } from "react";
import { X, Printer, Download, ArrowUpRight, ArrowDownLeft, FileSpreadsheet, Loader2, Calendar, Phone, UserCircle } from "lucide-react";
import { format } from "date-fns";

type ClientStatementModalProps = {
  clientId: number;
  clientNom: string;
  onClose: () => void;
};

export default function ClientStatementModal({ clientId, clientNom, onClose }: ClientStatementModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatement() {
      try {
        const res = await fetch(`/api/clients/${clientId}/statement`);
        if (!res.ok) throw new Error("Failed to fetch statement");
        const statementData = await res.json();
        setData(statementData);
      } catch (e) {
        console.error("Failed to load client statement", e);
      } finally {
        setLoading(false);
      }
    }
    fetchStatement();
  }, [clientId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!data || !data.events) return;
    const headers = ["Date,Type,Reference,Debit (-),Credit (+),Solde Courant,Notes,Agent"];
    const rows = data.events.map((e: any) => 
      `"${format(new Date(e.date), 'dd/MM/yyyy')}","${e.type}","${e.reference}",${e.debit},${e.credit},${e.solde_courant},"${e.notes || ''}","${e.utilisateur || ''}"`
    );
    const content = "\ufeff" + headers.concat(rows).join("\n");
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `releve_compte_${data.client.nom.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static print:inset-auto">
      {/* Modal Backdrop (hidden in print) */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="bg-white dark:bg-slate-900 rounded-[32px] print:rounded-none overflow-hidden relative z-10 w-full max-w-5xl border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:w-full print:h-full">
        
        {/* Modal Header (hidden in print) */}
        <div className="px-8 py-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Relevé de Compte Client</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grand livre comptable et historique des flux</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportCSV}
              disabled={loading || !data}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
            >
              <FileSpreadsheet size={16} className="text-emerald-500" /> CSV
            </button>
            <button 
              onClick={handlePrint}
              disabled={loading || !data}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-md"
            >
              <Printer size={16} /> Imprimer
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* Printable Title Block (only shown in print) */}
        <div className="hidden print:block text-center p-6 border-b-2 border-slate-900">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">ETS SALISSOU SALHA</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Relevé de Compte Client</p>
          <p className="text-xs text-slate-400 mt-1">Édité le {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>

        {/* Modal Body / Ledger Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 print:overflow-visible print:p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
               <Loader2 className="animate-spin mb-3 text-blue-600" size={32} />
               <p className="text-sm font-black uppercase tracking-wider">Chargement du relevé...</p>
            </div>
          ) : !data ? (
            <div className="text-center py-24 text-slate-400">
               <X size={48} className="mx-auto mb-4" />
               <p className="text-lg font-black">Erreur lors du chargement des données.</p>
            </div>
          ) : (
            <>
              {/* Client Info Banner */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50 dark:bg-slate-800/40 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 print:bg-white print:border-slate-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center print:hidden">
                    <UserCircle size={28} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 dark:text-white">{data.client.nom}</h4>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">REF: {data.client.ref_client || "—"}</span>
                      {data.client.tel && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          <Phone size={12} className="text-slate-300" /> {data.client.tel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <Calendar size={14} className="text-slate-300 print:hidden" />
                  Période: Historique global
                </div>
              </div>

              {/* Client Metrics Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
                <div className="bg-white dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 print:border-slate-300">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Total Déposé</span>
                  <span className="text-xl font-black text-slate-800 dark:text-white">
                    {new Intl.NumberFormat('fr-FR').format(data.client.total_depose)} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 print:border-slate-300">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Solde Avances</span>
                  <span className="text-xl font-black text-blue-600">
                    {new Intl.NumberFormat('fr-FR').format(data.client.solde_avances)} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-800/20 p-5 rounded-2xl border border-slate-100 dark:border-slate-800/60 print:border-slate-300">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Dette Factures</span>
                  <span className="text-xl font-black text-rose-600">
                    {new Intl.NumberFormat('fr-FR').format(data.client.credit_facture)} <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
                  </span>
                </div>
                <div className={`p-5 rounded-2xl border print:border-slate-300 ${
                  data.client.position_nette >= 0 
                    ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-400' 
                    : 'bg-rose-50/50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20 text-rose-800 dark:text-rose-400'
                }`}>
                  <span className="text-[9px] font-black uppercase tracking-widest mb-1 block text-slate-400 dark:text-slate-500">Situation Nette</span>
                  <span className="text-xl font-black flex items-center gap-1.5">
                    {data.client.position_nette >= 0 ? "+" : ""}
                    {new Intl.NumberFormat('fr-FR').format(data.client.position_nette)} 
                    <span className="text-[10px] text-slate-400 font-bold">FCFA</span>
                    {data.client.position_nette >= 0 
                      ? <ArrowUpRight size={16} className="text-emerald-500 print:hidden" /> 
                      : <ArrowDownLeft size={16} className="text-rose-500 print:hidden" />
                    }
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden print:border-slate-300">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50/60 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest print:bg-slate-100 print:text-black">
                      <th className="px-6 py-4 text-center">Date</th>
                      <th className="px-6 py-4">Opération</th>
                      <th className="px-6 py-4">Référence</th>
                      <th className="px-6 py-4 text-right">Débit (-)</th>
                      <th className="px-6 py-4 text-right">Crédit (+)</th>
                      <th className="px-6 py-4 text-right">Solde Courant</th>
                      <th className="px-6 py-4 max-w-[200px] print:max-w-none">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {data.events.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 uppercase font-black text-[10px]">
                          Aucune transaction comptabilisée.
                        </td>
                      </tr>
                    ) : (
                      data.events.map((e: any) => (
                        <tr key={e.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors">
                          <td className="px-6 py-4 text-center text-slate-400">{format(new Date(e.date), 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              e.type.includes("Dépôt") || e.type.includes("Règlement") 
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                : e.type.includes("Facture") || e.type.includes("Retrait") 
                                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' 
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}>{e.type}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{e.reference}</td>
                          <td className="px-6 py-4 text-right text-rose-600">
                            {e.debit > 0 ? `-${new Intl.NumberFormat('fr-FR').format(e.debit)}` : '—'}
                          </td>
                          <td className="px-6 py-4 text-right text-emerald-600">
                            {e.credit > 0 ? `+${new Intl.NumberFormat('fr-FR').format(e.credit)}` : '—'}
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-800 dark:text-white">
                            {new Intl.NumberFormat('fr-FR').format(e.solde_courant)}
                          </td>
                          <td className="px-6 py-4 max-w-[200px] truncate text-slate-400 italic print:max-w-none print:whitespace-normal" title={e.notes}>
                            {e.notes}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer (hidden in print) */}
        <div className="p-6 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex justify-end print:hidden">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
