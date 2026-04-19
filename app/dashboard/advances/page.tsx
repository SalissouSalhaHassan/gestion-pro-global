"use client";

import { useEffect, useState } from "react";
import { useAdvanceStore } from "@/lib/stores/advance-store";
import { format } from "date-fns";
import { Plus, Search, LogOut, Wallet, X, CheckCircle2, User, ArrowDownToLine, Pencil, Ban, AlertTriangle, Printer } from "lucide-react";
import AdvanceReceiptModal from "./AdvanceReceiptModal";
import DepositListModal from "./DepositListModal";

export default function AdvancesPage() {
  const { advances, fetchAdvances, isLoading, addAdvance, withdraw, updateAdvance, cancelAdvance } = useAdvanceStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<any[]>([]);
  
  // -- MODALS STATE --
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [printAdvanceId, setPrintAdvanceId] = useState<number | null>(null);
  const [isGlobalPrintOpen, setIsGlobalPrintOpen] = useState(false);
  
  // -- SELECTION STATE --
  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }, [fetchAdvances]);

  const filteredAdvances = advances.filter(a => 
    (a as any).clients?.nom?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.reference_paiement?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.statut?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      await withdraw(selectedAdvance.id, amt, withdrawNotes, "Admin");
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

  // Open Modals Builders
  const openEditModal = (adv: any) => {
    setSelectedAdvance(adv);
    setEditData({
      moyen_paiement: adv.moyen_paiement || 'Espece',
      reference_paiement: adv.reference_paiement || '',
      notes: adv.notes || '',
      date_avance: adv.date_avance || new Date().toISOString().split('T')[0]
    });
    setIsEditModalOpen(true);
  };

  const openWithdrawModal = (adv: any) => {
    setSelectedAdvance(adv);
    setWithdrawAmount("");
    setWithdrawNotes("");
    setIsWithdrawModalOpen(true);
  };

  const openCancelModal = (adv: any) => {
    setSelectedAdvance(adv);
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="p-8 w-full max-w-7xl mx-auto space-y-8 fade-in animate-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
            <Wallet className="h-8 w-8 text-blue-600" />
            Dépôts & Avances
          </h1>
          <p className="text-gray-500 mt-1 dark:text-gray-400">Gérez les dépôts anticipés et soldes de vos clients</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsGlobalPrintOpen(true)}
            className="flex items-center gap-2 px-4 py-2 border border-blue-100 bg-blue-50 text-blue-700 rounded-lg text-sm font-black hover:bg-blue-100 transition-colors shadow-sm"
          >
            <Printer className="h-4 w-4" /> Imprimer le Relevé
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4" /> Nouveau Dépôt
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2 bg-white dark:bg-gray-800/80 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded-xl">
          <Search className="text-gray-400 h-5 w-5" />
        </div>
        <input 
          type="text"
          placeholder="Rechercher par client ou référence..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-2xl w-full border-0 focus:outline-none focus:ring-0 bg-transparent text-gray-900 dark:text-gray-100 px-2"
        />
      </div>

      <div className="bg-white dark:bg-gray-800/60 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-900/50 text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-700/50">
              <tr>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Montant Initial</th>
                <th className="px-6 py-4 text-right">Montant Restant</th>
                <th className="px-6 py-4">Moyen</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50 text-gray-700 dark:text-gray-300">
              {isLoading && advances.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Chargement...</td></tr>
              ) : filteredAdvances.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">Aucun dépôt trouvé.</td></tr>
              ) : (
                filteredAdvances.map((adv) => (
                  <tr key={adv.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {(adv as any).clients?.nom || `Client #${adv.client_id}`}
                    </td>
                    <td className="px-6 py-4">{format(new Date(adv.date_avance), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {Number(adv.montant_initial).toLocaleString()} FCFA
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600 dark:text-blue-400">
                      {Number(adv.montant_restant).toLocaleString()} FCFA
                    </td>
                    <td className="px-6 py-4 text-xs font-medium">{adv.moyen_paiement}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                        adv.statut === 'Disponible' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                        adv.statut === 'Annulée' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                      }`}>{adv.statut}</span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setPrintAdvanceId(adv.id)}
                        title="Imprimer le reçu"
                        className="text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 p-2 rounded-lg transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {(adv.statut === 'Disponible' || adv.statut === 'Partiellement utilisée') && Number(adv.montant_restant) > 0 && (
                        <button 
                          onClick={() => openWithdrawModal(adv)}
                          title="Effectuer un retrait"
                          className="text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 p-2 rounded-lg transition-colors"
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => openEditModal(adv)}
                        title="Modifier"
                        className="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {adv.statut === 'Disponible' && (
                        <button 
                          onClick={() => openCancelModal(adv)}
                          title="Annuler"
                          className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {printAdvanceId && (
        <AdvanceReceiptModal 
          advanceId={printAdvanceId} 
          onClose={() => setPrintAdvanceId(null)} 
        />
      )}

      {printAdvanceId && (
        <AdvanceReceiptModal 
          advanceId={printAdvanceId} 
          onClose={() => setPrintAdvanceId(null)} 
        />
      )}

      {isGlobalPrintOpen && (
        <DepositListModal 
          onClose={() => setIsGlobalPrintOpen(false)} 
        />
      )}

      {/* --- CREATE MODAL --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden relative z-10 w-full max-w-lg border border-gray-100 dark:border-gray-800 shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold flex items-center gap-2">Nouveau Dépôt</h3>
              <button onClick={() => setIsCreateModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">Client *</label>
                <select 
                  className="w-full rounded-xl border p-3 bg-gray-50 focus:ring-2 focus:ring-blue-600 outline-none"
                  value={createData.client_id} onChange={e => setCreateData({...createData, client_id: e.target.value})} required
                >
                  <option value="" disabled>Sélectionner...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom || c.ref_client}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Montant *</label>
                  <input type="number" step="0.01" className="w-full rounded-xl border p-3 bg-gray-50 focus:ring-2 focus:ring-blue-600 outline-none" 
                    value={createData.montant_initial} onChange={e => setCreateData({...createData, montant_initial: e.target.value})} required/>
                </div>
                <div>
                  <label className="text-sm font-semibold mb-1 block">Moyen de Paiement</label>
                  <select className="w-full rounded-xl border p-3 bg-gray-50 focus:ring-2 focus:ring-blue-600 outline-none"
                    value={createData.moyen_paiement} onChange={e => setCreateData({...createData, moyen_paiement: e.target.value})}>
                    <option value="Espece">Espèce</option>
                    <option value="Cheque">Chèque</option>
                    <option value="Virement">Virement</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Référence</label>
                <input type="text" className="w-full rounded-xl border p-3 bg-gray-50" value={createData.reference_paiement} onChange={e => setCreateData({...createData, reference_paiement: e.target.value})}/>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Notes</label>
                <textarea className="w-full rounded-xl border p-3 bg-gray-50 min-h-[80px]" value={createData.notes} onChange={e => setCreateData({...createData, notes: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium w-full lg:w-auto">Confirm</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden relative z-10 w-full max-w-lg border border-gray-100 dark:border-gray-800 shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-blue-50/50">
              <h3 className="text-xl font-bold flex items-center gap-2"><Pencil className="h-5 w-5 text-blue-600" /> Modifier Dépôt</h3>
              <button onClick={() => setIsEditModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
               <div>
                  <label className="text-sm font-semibold mb-1 block">Moyen de Paiement</label>
                  <select className="w-full rounded-xl border p-3 bg-gray-50 focus:ring-2 focus:ring-blue-600 outline-none"
                    value={editData.moyen_paiement} onChange={e => setEditData({...editData, moyen_paiement: e.target.value})}>
                    <option value="Espece">Espèce</option>
                    <option value="Cheque">Chèque</option>
                    <option value="Virement">Virement</option>
                  </select>
                </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Référence</label>
                <input type="text" className="w-full rounded-xl border p-3 bg-gray-50" value={editData.reference_paiement} onChange={e => setEditData({...editData, reference_paiement: e.target.value})}/>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">Notes</label>
                <textarea className="w-full rounded-xl border p-3 bg-gray-50 min-h-[80px]" value={editData.notes} onChange={e => setEditData({...editData, notes: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium w-full lg:w-auto">Mettre à jour</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- WITHDRAW MODAL --- */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsWithdrawModalOpen(false)}></div>
          <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden relative z-10 w-full max-w-md border border-gray-100 shadow-2xl">
            <div className="px-6 py-5 border-b border-amber-100 flex justify-between items-center bg-amber-50/50">
              <h3 className="text-xl font-bold flex items-center gap-2"><ArrowDownToLine className="h-5 w-5 text-amber-500" /> Retrait</h3>
              <button onClick={() => setIsWithdrawModalOpen(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold">Montant à Retirer</label>
                <input type="number" step="0.01" className="w-full rounded-xl border p-3 font-bold bg-gray-50" max={selectedAdvance?.montant_restant} value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} required autoFocus/>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold">Raison</label>
                <textarea className="w-full rounded-xl border p-3 bg-gray-50" value={withdrawNotes} onChange={e => setWithdrawNotes(e.target.value)}></textarea>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-amber-500 text-white rounded-xl font-bold mt-4">Valider</button>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRM MODAL --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsDeleteModalOpen(false)}></div>
           <div className="bg-white dark:bg-gray-900 rounded-3xl overflow-hidden relative z-10 w-full max-w-sm border border-gray-100 shadow-2xl p-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-2">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold dark:text-white">Annuler ce dépôt ?</h3>
              <p className="text-gray-500 text-sm">Cette action marquera le dépôt comme annulé, mais il restera visible dans l'historique.</p>
              
              <div className="flex gap-3 pt-4">
                <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium">Fermer</button>
                <button onClick={handleCancelSubmit} disabled={isSubmitting} className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium shadow-lg shadow-red-500/30">Confirmer l'annulation</button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
