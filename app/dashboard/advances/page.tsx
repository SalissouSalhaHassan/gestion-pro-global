"use client";

import { useEffect, useState } from "react";
import { useAdvanceStore } from "@/lib/stores/advance-store";
import { format } from "date-fns";
import { 
  Plus, Search, Wallet, X, User, ArrowDownToLine, 
  Pencil, Ban, AlertTriangle, Printer, Clock, Filter, 
  MapPin, FileSpreadsheet, Download, Loader2
} from "lucide-react";
import AdvanceReceiptModal from "./AdvanceReceiptModal";
import DepositListModal from "./DepositListModal";
import HistoryModal from "./HistoryModal";
import ClientStatementModal from "./ClientStatementModal";

export default function AdvancesPage() {
  const { advances, fetchAdvances, isLoading, addAdvance, withdraw, updateAdvance, cancelAdvance } = useAdvanceStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  
  // -- MODALS STATE --
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [historyAdvanceId, setHistoryAdvanceId] = useState<number | null>(null);
  const [printAdvanceId, setPrintAdvanceId] = useState<number | null>(null);
  const [isGlobalPrintOpen, setIsGlobalPrintOpen] = useState(false);
  const [activeView, setActiveView] = useState<'individual' | 'client-summary'>('individual');
  const [selectedClientIdForStatement, setSelectedClientIdForStatement] = useState<number | null>(null);
  const [selectedClientNomForStatement, setSelectedClientNomForStatement] = useState<string>("");
  
  // -- SELECTION STATE --
  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [filterSeller, setFilterSeller] = useState("Tous");

  // -- FORM STATES --
  const [createData, setCreateData] = useState({
    client_id: "",
    montant_initial: "",
    moyen_paiement: "Espece",
    reference_paiement: "",
    notes: "",
    date_avance: new Date().toISOString().split('T')[0]
  });

  const [editData, setEditData] = useState({
    moyen_paiement: "Espece",
    reference_paiement: "",
    notes: "",
    date_avance: new Date().toISOString().split('T')[0]
  });

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");

  useEffect(() => {
    fetchAdvances();
    fetch('/api/clients')
      .then(res => res.json())
      .then(data => { if(Array.isArray(data)) setClients(data); })
      .catch(e => console.error("Could not load clients", e));

    const cookie = document.cookie.split('; ').find(row => row.startsWith('gp_session='));
    if (cookie) {
      try {
        const session = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        setUserSession(session);
      } catch (e) { console.error(e); }
    }
  }, [fetchAdvances]);

  const isAdmin = userSession?.admin === "Oui" || userSession?.role === 1 || userSession?.role === "1";

  const filteredAdvances = advances.filter(a => {
    const matchesSearch = (a as any).clients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.reference_paiement?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          a.statut?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeller = filterSeller === "Tous" || a.utilisateur === filterSeller;
    return matchesSearch && matchesSeller;
  });

  const uniqueSellers = Array.from(new Set(advances.map(a => a.utilisateur).filter(Boolean)));

  const clientSummaries = useMemo(() => {
    return clients
      .map(client => {
        const clientAdvances = advances.filter(a => Number(a.client_id) === Number(client.id) && a.statut !== "Annulée");
        const totalDeposited = clientAdvances.reduce((sum, a) => sum + Number(a.montant_initial), 0);
        const soldeAvances = clientAdvances.reduce((sum, a) => sum + Number(a.montant_restant), 0);
        const creditFacture = Number(client.credit_facture) || 0;
        const positionNette = soldeAvances - creditFacture;
        return {
          ...client,
          total_depose: totalDeposited,
          solde_avances: soldeAvances,
          credit_facture: creditFacture,
          position_nette: positionNette,
          has_activity: totalDeposited > 0 || creditFacture > 0
        };
      })
      .filter(c => c.has_activity);
  }, [clients, advances]);

  const filteredClientSummaries = useMemo(() => {
    return clientSummaries.filter(c => {
      return c.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (c.ref_client && c.ref_client.toLowerCase().includes(searchTerm.toLowerCase()));
    });
  }, [clientSummaries, searchTerm]);

  // -- HANDLERS --
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if(!createData.client_id || !createData.montant_initial) return;
      await addAdvance({
        client_id: Number(createData.client_id),
        montant_initial: Number(createData.montant_initial),
        date_avance: createData.date_avance,
        moyen_paiement: createData.moyen_paiement,
        reference_paiement: createData.reference_paiement,
        notes: createData.notes
      });
      setIsCreateModalOpen(false);
      setCreateData({...createData, client_id: "", montant_initial: "", reference_paiement: "", notes: ""});
    } catch (error) {
      alert("Erreur lors de la création.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const amt = Number(withdrawAmount);
      if(!amt || amt <= 0 || amt > Number(selectedAdvance.montant_restant)) {
        alert("Montant invalide.");
        setIsSubmitting(false);
        return;
      }
      await withdraw(selectedAdvance.id, amt, withdrawNotes, userSession?.username);
      setIsWithdrawModalOpen(false);
      setSelectedAdvance(null);
    } catch (error) {
      alert("Erreur lors du retrait.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateAdvance(selectedAdvance.id, editData);
      setIsEditModalOpen(false);
      setSelectedAdvance(null);
    } catch (error) {
      alert("Erreur lors de la modification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    setIsSubmitting(true);
    try {
      await cancelAdvance(selectedAdvance.id);
      setIsDeleteModalOpen(false);
      setSelectedAdvance(null);
    } catch (error) {
       alert("Erreur lors de l'annulation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Client,Date,Montant Initial,Montant Restant,Moyen,Emplacement,Vendeur,Statut"];
    const rows = filteredAdvances.map(a => 
      `"${(a as any).clients?.nom || a.client_id}","${a.date_avance}",${a.montant_initial},${a.montant_restant},"${a.moyen_paiement}","${a.emplacement || 'Général'}","${a.utilisateur}","${a.statut}"`
    );
    const content = headers.concat(rows).join("\n");
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `advances_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 w-full max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[24px] bg-blue-600/10 flex items-center justify-center text-blue-600 shadow-inner">
             <Wallet size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Dépôts & Avances</h1>
            <p className="text-slate-500 font-medium italic font-outfit">Gestion centralisée des soldes clients et audits financiers.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-black text-xs hover:bg-slate-50 transition-all active:scale-95 shadow-sm uppercase tracking-widest"
          >
            <FileSpreadsheet size={18} className="text-emerald-500" /> Exporter
          </button>
          <button 
            onClick={() => setIsGlobalPrintOpen(true)}
            className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs hover:bg-slate-800 transition-all active:scale-95 shadow-xl uppercase tracking-widest"
          >
            <Printer size={18} /> Imprimer Relevé
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-500/20 uppercase tracking-widest"
          >
            <Plus size={18} /> Nouveau Dépôt
          </button>
        </div>
      </div>

    {/* View Selector Tabs */}
    <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6">
      <button 
        onClick={() => setActiveView('individual')}
        className={`pb-4 px-2 font-black text-sm uppercase tracking-wider border-b-2 transition-all active:scale-95 ${
          activeView === 'individual' 
            ? 'border-blue-600 text-blue-600' 
            : 'border-transparent text-slate-400 hover:text-slate-600'
        }`}
      >
        Dépôts Individuels
      </button>
      <button 
        onClick={() => setActiveView('client-summary')}
        className={`pb-4 px-2 font-black text-sm uppercase tracking-wider border-b-2 transition-all active:scale-95 ${
          activeView === 'client-summary' 
            ? 'border-blue-600 text-blue-600' 
            : 'border-transparent text-slate-400 hover:text-slate-600'
        }`}
      >
        Synthèse par Client
      </button>
    </div>

      {/* Filters Bar */}
      <div className="bg-white/60 backdrop-blur-2xl border border-white p-6 rounded-[32px] shadow-sm flex flex-wrap items-center gap-8">
         <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="p-2 bg-slate-100 rounded-lg"><Search size={18} className="text-slate-400" /></div>
            <input 
              type="text"
              placeholder="Rechercher par client, référence ou statut..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none font-black text-slate-700 outline-none w-full placeholder:text-slate-300"
            />
         </div>

         {isAdmin && (
           <>
             <div className="h-8 w-px bg-slate-100 mx-2 hidden md:block"></div>
             <div className="flex items-center gap-3">
                <Filter size={18} className="text-slate-400" />
                <select 
                   className="bg-transparent font-black text-slate-700 outline-none cursor-pointer"
                   value={filterSeller}
                   onChange={(e) => setFilterSeller(e.target.value)}
                >
                   <option value="Tous">Tous les vendeurs</option>
                   {uniqueSellers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
             </div>
           </>
         )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-[100px]"></div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Déposé</h3>
            <p className="text-3xl font-black text-slate-900">
               {new Intl.NumberFormat('fr-FR').format(filteredAdvances.reduce((sum, a) => sum + Number(a.montant_initial), 0))} <span className="text-xs">FCFA</span>
            </p>
         </div>
         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-[100px]"></div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Solde Disponible</h3>
            <p className="text-3xl font-black text-emerald-600">
               {new Intl.NumberFormat('fr-FR').format(filteredAdvances.reduce((sum, a) => sum + Number(a.montant_restant), 0))} <span className="text-xs text-slate-400">FCFA</span>
            </p>
         </div>
         <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-[100px]"></div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Nombre d'avances</h3>
            <p className="text-3xl font-black text-slate-900">{filteredAdvances.length}</p>
         </div>
      </div>

      {/* Main Table */}
    {activeView === 'individual' ? (
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Initial</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Restant</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Emplacement</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-8 py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-2" /><p className="font-black text-slate-400 uppercase text-[10px]">Chargement...</p></td></tr>
              ) : filteredAdvances.length === 0 ? (
                <tr><td colSpan={7} className="px-8 py-20 text-center grayscale opacity-30"><Wallet size={48} className="mx-auto mb-4" /><p className="font-black text-lg">Aucune avance trouvée.</p></td></tr>
              ) : (
                filteredAdvances.map((adv) => (
                  <tr key={adv.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6">
                       <div className="flex flex-col">
                          <span className="font-black text-slate-800 text-[13px] tracking-tight">{(adv as any).clients?.nom || `Client #${adv.client_id}`}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">REF: {adv.reference_paiement || '—'}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-center text-xs font-bold text-slate-500">
                       {format(new Date(adv.date_avance), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-8 py-6 text-right font-bold text-slate-400 text-xs">
                      {new Intl.NumberFormat('fr-FR').format(adv.montant_initial)}
                    </td>
                    <td className="px-8 py-6 text-right">
                       <span className="font-black text-blue-600 text-lg">
                        {new Intl.NumberFormat('fr-FR').format(adv.montant_restant)}
                       </span>
                    </td>
                    <td className="px-8 py-6">
                       <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-slate-300" />
                          <span className="text-[10px] font-black text-slate-500 uppercase">{adv.emplacement || "Général"}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${
                        adv.statut === 'Disponible' ? 'bg-emerald-50 text-emerald-600' :
                        adv.statut === 'Annulée' ? 'bg-rose-50 text-rose-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{adv.statut}</span>
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setHistoryAdvanceId(adv.id)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Historique"
                          >
                            <Clock size={18} />
                          </button>
                          <button 
                            onClick={() => setPrintAdvanceId(adv.id)}
                            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                            title="Imprimer"
                          >
                            <Printer size={18} />
                          </button>
                          {(adv.statut === 'Disponible' || adv.statut === 'Partiellement utilisée') && Number(adv.montant_restant) > 0 && (
                            <button 
                              onClick={() => { setSelectedAdvance(adv); setWithdrawAmount(""); setWithdrawNotes(""); setIsWithdrawModalOpen(true); }}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="Effectuer un retrait"
                            >
                              <ArrowDownToLine size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => { setSelectedAdvance(adv); setEditData({ moyen_paiement: adv.moyen_paiement, reference_paiement: adv.reference_paiement || '', notes: adv.notes || '', date_avance: adv.date_avance }); setIsEditModalOpen(true); }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Modifier"
                          >
                            <Pencil size={18} />
                          </button>
                          {adv.statut === 'Disponible' && (
                            <button 
                              onClick={() => { setSelectedAdvance(adv); setIsDeleteModalOpen(true); }}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Annuler"
                            >
                              <Ban size={18} />
                            </button>
                          )}
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl overflow-hidden relative animate-in fade-in duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Téléphone</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total Déposé</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Solde d'avances</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Dette Factures</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Situation Nette</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={7} className="px-8 py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600 mb-2" /><p className="font-black text-slate-400 uppercase text-[10px]">Chargement...</p></td></tr>
              ) : filteredClientSummaries.length === 0 ? (
                <tr><td colSpan={7} className="px-8 py-20 text-center grayscale opacity-30"><Wallet size={48} className="mx-auto mb-4" /><p className="font-black text-lg">Aucun client trouvé.</p></td></tr>
              ) : (
                filteredClientSummaries.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800 text-[13px] tracking-tight">{c.nom}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">REF: {c.ref_client || '—'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-slate-500 font-bold text-xs">{c.tel || "—"}</td>
                    <td className="px-8 py-6 text-right font-bold text-slate-400 text-xs">
                      {new Intl.NumberFormat('fr-FR').format(c.total_depose)}
                    </td>
                    <td className="px-8 py-6 text-right font-black text-blue-600 text-sm">
                      {new Intl.NumberFormat('fr-FR').format(c.solde_avances)}
                    </td>
                    <td className="px-8 py-6 text-right font-bold text-rose-600 text-xs">
                      {new Intl.NumberFormat('fr-FR').format(c.credit_facture)}
                    </td>
                    <td className={`px-8 py-6 text-right font-black text-sm ${c.position_nette >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {c.position_nette >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(c.position_nette)}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => { setSelectedClientIdForStatement(c.id); setSelectedClientNomForStatement(c.nom); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-colors shadow-sm ml-auto"
                      >
                        <FileSpreadsheet size={12} /> Relevé
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )}

      {/* --- MODALS --- */}

      {historyAdvanceId && (
        <HistoryModal advanceId={historyAdvanceId} onClose={() => setHistoryAdvanceId(null)} />
      )}

      {printAdvanceId && (
        <AdvanceReceiptModal advanceId={printAdvanceId} onClose={() => setPrintAdvanceId(null)} />
      )}

      {isGlobalPrintOpen && (
        <DepositListModal onClose={() => setIsGlobalPrintOpen(false)} />
      )}

      {selectedClientIdForStatement && (
        <ClientStatementModal 
          clientId={selectedClientIdForStatement} 
          clientNom={selectedClientNomForStatement} 
          onClose={() => { setSelectedClientIdForStatement(null); setSelectedClientNomForStatement(""); }} 
        />
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="bg-white rounded-[32px] overflow-hidden relative z-10 w-full max-w-lg border border-slate-100 shadow-2xl">
            <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-slate-900">Nouveau Dépôt</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enregistrement d'une avance client</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-8 space-y-6">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Client *</label>
                <select 
                  className="w-full rounded-2xl border-2 border-slate-100 p-4 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none font-bold transition-all"
                  value={createData.client_id} onChange={e => setCreateData({...createData, client_id: e.target.value})} required
                >
                  <option value="" disabled>Sélectionner un client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom || c.ref_client}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Montant (FCFA) *</label>
                  <input type="number" step="0.01" className="w-full rounded-2xl border-2 border-slate-100 p-4 bg-slate-50 font-black text-lg focus:border-blue-500 focus:bg-white outline-none" 
                    value={createData.montant_initial} onChange={e => setCreateData({...createData, montant_initial: e.target.value})} required/>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Moyen</label>
                  <select className="w-full rounded-2xl border-2 border-slate-100 p-4 bg-slate-50 font-bold focus:border-blue-500 focus:bg-white outline-none"
                    value={createData.moyen_paiement} onChange={e => setCreateData({...createData, moyen_paiement: e.target.value})}>
                    <option value="Espece">Espèce</option>
                    <option value="Cheque">Chèque</option>
                    <option value="Virement">Virement</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95">
                  {isSubmitting ? "Traitement..." : "Confirmer le dépôt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsWithdrawModalOpen(false)}></div>
          <div className="bg-white rounded-[32px] overflow-hidden relative z-10 w-full max-w-md border border-slate-100 shadow-2xl">
            <div className="px-8 py-6 border-b border-amber-100 flex justify-between items-center bg-amber-50/50 text-amber-900">
               <h3 className="text-xl font-black tracking-tight">Retrait de fonds</h3>
               <button onClick={() => setIsWithdrawModalOpen(false)}><X size={24} /></button>
            </div>
            <form onSubmit={handleWithdrawSubmit} className="p-8 space-y-6">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                 <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Disponible</p>
                 <p className="text-2xl font-black text-amber-900">{new Intl.NumberFormat('fr-FR').format(selectedAdvance?.montant_restant)} FCFA</p>
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Montant à retirer</label>
                <input type="number" step="0.01" className="w-full rounded-2xl border-2 border-slate-100 p-4 bg-slate-50 font-black text-2xl focus:border-amber-500 outline-none" max={selectedAdvance?.montant_restant} value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} required autoFocus/>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-500/20 active:scale-95">
                {isSubmitting ? "Validation..." : "Confirmer le retrait"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)}></div>
           <div className="bg-white rounded-[40px] overflow-hidden relative z-10 w-full max-w-sm border border-slate-100 shadow-2xl p-8 text-center">
              <div className="mx-auto w-20 h-20 bg-rose-50 text-rose-500 rounded-[30px] flex items-center justify-center mb-6 shadow-inner">
                <AlertTriangle size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">Annuler ce dépôt ?</h3>
              <p className="text-slate-500 font-medium italic mb-8">Cette action est irréversible et marquera le dépôt comme annulé.</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[10px]">Fermer</button>
                <button onClick={handleCancelSubmit} disabled={isSubmitting} className="px-6 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-rose-500/20">Confirmer</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
