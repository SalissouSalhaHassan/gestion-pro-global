"use client";

import { useEffect, useState } from "react";
import { X, Clock, User, ArrowDownCircle, PlusCircle, Ban, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";

type HistoryModalProps = {
  advanceId: number;
  onClose: () => void;
};

export default function HistoryModal({ advanceId, onClose }: HistoryModalProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/advances/${advanceId}/history`);
        const data = await res.json();
        setHistory(data);
      } catch (e) {
        console.error("Failed to load history", e);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [advanceId]);

  const getIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <PlusCircle className="text-emerald-500" size={18} />;
      case 'WITHDRAW': return <ArrowDownCircle className="text-amber-500" size={18} />;
      case 'CANCEL': return <Ban className="text-rose-500" size={18} />;
      default: return <RefreshCw className="text-blue-500" size={18} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden relative z-10 w-full max-w-md border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col max-h-[80vh]">
        
        <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Historique du Dépôt</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Suivi d'audit détaillé</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
               <Loader2 className="animate-spin mb-2" />
               <p className="text-sm font-bold">Chargement du journal...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-400 opacity-50">
               <Clock size={40} className="mx-auto mb-2" />
               <p className="text-sm font-bold tracking-tight">Aucun historique disponible.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-3 pl-6 space-y-8">
              {history.map((item, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[35px] top-0 bg-white dark:bg-slate-900 p-1 rounded-full border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                    {getIcon(item.action)}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">{item.action}</span>
                      <span className="text-[10px] font-bold text-slate-400">{format(new Date(item.date_action), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <p className="text-sm font-extrabold text-slate-600 dark:text-slate-300">
                      {item.amount > 0 ? `${new Intl.NumberFormat('fr-FR').format(item.amount)} FCFA` : ''}
                    </p>
                    <p className="text-xs text-slate-500 italic mt-1">{item.notes}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase">
                        <User size={10} /> {item.utilisateur || "Système"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
