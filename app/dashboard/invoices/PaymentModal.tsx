"use client";

import React, { useState, useEffect } from "react";
import { 
  X, 
  Plus, 
  Trash2, 
  CreditCard, 
  History, 
  Wallet, 
  CheckCircle2, 
  Clock, 
  Building2,
  Calendar,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Payment {
  id: number;
  date_operation: string;
  montant_regle: number;
  moyen_reglement: string;
  reference_paiement: string;
  banque?: string;
}

interface Advance {
  id: number;
  date_avance: string;
  montant_initial: number;
  montant_restant: number;
  moyen_paiement: string;
  reference_paiement: string;
  statut?: string;
  emplacement?: string;
}

interface PaymentModalProps {
  invoice: any;
  onClose: () => void;
  onRefresh: () => void;
}

export default function PaymentModal({ invoice, onClose, onRefresh }: PaymentModalProps) {
  const [activeTab, setActiveTab] = useState<"history" | "advances">("history");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [totalAdvanceBalance, setTotalAdvanceBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [advancesLoading, setAdvancesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [newPayment, setNewPayment] = useState({
    montant_regle: invoice.montant_restant || 0,
    moyen_reglement: "Espece",
    date_operation: new Date().toISOString().split("T")[0],
    reference_paiement: "",
    banque: "",
    proprietaire_cheque: "",
    date_echeance: ""
  });

  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<number | null>(null);

  const totalPaid = payments
    .filter(p => {
      const mode = (p.moyen_reglement || "").toLowerCase();
      return !mode.includes('redit');
    })
    .reduce((acc, curr) => acc + Number(curr.montant_regle), 0);
  const remainingToPay = Math.max(0, (invoice.total_ttc || 0) - totalPaid);

  useEffect(() => {
    if (!loading) {
      setNewPayment(prev => ({ ...prev, montant_regle: remainingToPay }));
    }
  }, [loading, remainingToPay]);

  const getEffectiveClientId = () => {
    return invoice.client_id || invoice.id_client || invoice.client?.id || (typeof invoice.client === 'object' ? invoice.client?.id : null);
  };

  const loadAdvances = async (targetClientId?: number) => {
    let cId = targetClientId || getEffectiveClientId();
    if (!cId && invoice.id) {
      try {
        const invRes = await fetch(`/api/invoices/${invoice.id}`);
        if (invRes.ok) {
          const invData = await invRes.json();
          cId = invData.client_id || invData.id_client || invData.client?.id;
        }
      } catch (err) {
        console.error("Error retrieving client id from invoice:", err);
      }
    }

    if (!cId) {
      setAdvances([]);
      setTotalAdvanceBalance(0);
      return;
    }

    setAdvancesLoading(true);
    try {
      const aRes = await fetch(`/api/clients/${cId}/advances`);
      if (aRes.ok) {
        const aData = await aRes.json();
        // Support both { advances: [...], totalBalance } and raw array
        const list: Advance[] = Array.isArray(aData) 
          ? aData 
          : (Array.isArray(aData?.advances) 
              ? aData.advances 
              : (Array.isArray(aData?.data) ? aData.data : []));
        
        const validAdvances = list.filter(a => Number(a.montant_restant) > 0);
        setAdvances(validAdvances);

        const total = typeof aData?.totalBalance === 'number'
          ? aData.totalBalance
          : validAdvances.reduce((sum, a) => sum + Number(a.montant_restant || 0), 0);
        setTotalAdvanceBalance(total);
      } else {
        setAdvances([]);
        setTotalAdvanceBalance(0);
      }
    } catch (err) {
      console.error("Error fetching client advances:", err);
      setAdvances([]);
      setTotalAdvanceBalance(0);
    } finally {
      setAdvancesLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/invoices/${invoice.id}/payments`);
      const pData = await pRes.json();
      setPayments(Array.isArray(pData) ? pData : []);

      await loadAdvances();
    } catch (err) {
      console.error("Error fetching payment data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [invoice.id]);

  useEffect(() => {
    if (activeTab === "advances") {
      loadAdvances();
    }
  }, [activeTab]);

  const formatDateSafe = (d: any, formatStr = 'dd MMM yyyy') => {
    if (!d) return "-";
    try {
      const dt = new Date(d);
      return isNaN(dt.getTime()) ? "-" : format(dt, formatStr, { locale: fr });
    } catch {
      return "-";
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPayment,
          montant_regle: (newPayment.moyen_reglement?.toLowerCase().includes('redit')) ? 0 : newPayment.montant_regle
        })
      });
      if (res.ok) {
        setNewPayment({ ...newPayment, reference_paiement: "", banque: "" });
        onRefresh();
        await fetchData();
        alert("Paiement enregistré avec succès !");
      } else {
        const errorData = await res.json();
        alert(`Erreur: ${errorData.error || "Impossible d'enregistrer le paiement"}`);
      }
    } catch (err) {
      console.error("Error adding payment:", err);
      alert("Erreur de connexion au serveur.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePayment = async (id: number) => {
    if (!confirm("Supprimer ce règlement ?")) return;
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      if (res.ok) {
        onRefresh();
        await fetchData();
      }
    } catch (err) {
      console.error("Error deleting payment:", err);
    }
  };

  const handleUseAdvance = async () => {
    if (!selectedAdvanceId || advanceAmount <= 0) return;
    if (remainingToPay <= 0) {
      alert("Cette facture est déjà totalement réglée.");
      return;
    }
    const selectedAdv = advances.find(a => a.id === selectedAdvanceId);
    if (selectedAdv && advanceAmount > selectedAdv.montant_restant) {
      alert(`Le montant dépasse le solde disponible (${selectedAdv.montant_restant.toLocaleString()} FCFA).`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/use-advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advance_id: selectedAdvanceId,
          amount: advanceAmount
        })
      });
      if (res.ok) {
        setSelectedAdvanceId(null);
        setAdvanceAmount(0);
        onRefresh();
        await fetchData();
        alert("✅ Avance appliquée avec succès sur la facture !");
      } else {
        const errorData = await res.json();
        alert(`❌ Erreur: ${errorData.error || "Impossible d'appliquer l'avance"}`);
      }
    } catch (err) {
      console.error("Error using advance:", err);
      alert("❌ Erreur de connexion au serveur.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Règlement de Facture</h2>
              <p className="text-slate-400 text-xs font-medium">#{invoice.bl_number} • {invoice.client_nom}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-200">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total TTC</p>
              <p className="text-slate-900 font-black text-lg">{(invoice.total_ttc || 0).toLocaleString()} <span className="text-xs font-medium text-slate-400 ml-1">FCFA</span></p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="h-10 w-10 bg-green-50 rounded-full flex items-center justify-center text-green-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Montant Payé</p>
              <p className="text-green-600 font-black text-lg">{totalPaid.toLocaleString()} <span className="text-xs font-medium text-slate-400 ml-1">FCFA</span></p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-4 bg-gradient-to-br from-white to-red-50/30">
            <div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center text-red-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Reste à Payer</p>
              <p className="text-red-600 font-black text-lg">{remainingToPay.toLocaleString()} <span className="text-xs font-medium text-slate-400 ml-1">FCFA</span></p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 flex items-center gap-6 border-b border-slate-200">
          <button 
            onClick={() => setActiveTab("history")}
            className={`py-4 text-sm font-bold flex items-center gap-2 transition-all relative ${activeTab === "history" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            <History className="h-4 w-4" />
            Historique & Nouveau
            {activeTab === "history" && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab("advances")}
            className={`py-4 text-sm font-bold flex items-center gap-2 transition-all relative ${activeTab === "advances" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Wallet className="h-4 w-4" />
            <span>Utiliser une Avance</span>
            {advances.length > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs font-black rounded-full bg-blue-100 text-blue-700">
                {advances.length}
              </span>
            )}
            {activeTab === "advances" && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "history" ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* History Table */}
              <div className="lg:col-span-3 space-y-4">
                <h3 className="text-slate-800 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                  Derniers Règlements
                </h3>
                {payments.length === 0 ? (
                  <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                    <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">Aucun règlement enregistré pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((p) => (
                      <div key={p.id} className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between hover:shadow-md transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-slate-100 rounded-lg text-slate-600 font-bold text-xs uppercase">
                            {p.moyen_reglement}
                          </div>
                          <div>
                            <p className="text-slate-900 font-black">{Number(p.montant_regle || 0).toLocaleString()} FCFA</p>
                            <p className="text-slate-400 text-xs font-semibold">{formatDateSafe(p.date_operation, 'dd MMMM yyyy')} {p.reference_paiement && `• ${p.reference_paiement}`}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Payment Form */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-slate-800 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                  Enregistrer un Paiement
                </h3>
                <form onSubmit={handleAddPayment} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1 uppercase">Montant</label>
                    <input 
                      type="number"
                      required
                      value={newPayment.montant_regle}
                      onChange={(e) => setNewPayment({...newPayment, montant_regle: parseFloat(e.target.value) || 0})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-black text-lg focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1 uppercase">Mode</label>
                    <select 
                      value={newPayment.moyen_reglement}
                      onChange={(e) => setNewPayment({...newPayment, moyen_reglement: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all"
                    >
                      <option value="Espece">Espèce</option>
                      <option value="Cheque">Chèque</option>
                      <option value="Virement">Virement</option>
                      <option value="TPE">TPE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1.5 ml-1 uppercase">Référence</label>
                    <input 
                      type="text"
                      placeholder="N° Chèque, Ref..."
                      value={newPayment.reference_paiement}
                      onChange={(e) => setNewPayment({...newPayment, reference_paiement: e.target.value})}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 shadow-sm transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={saving || remainingToPay <= 0 || newPayment.montant_regle <= 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {saving ? "Enregistrement..." : (
                      <>
                        <Plus className="h-5 w-5" />
                        Valider le Règlement
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-slate-800 font-black text-sm uppercase tracking-widest">Avances Disponibles pour ce client</h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Solde total des acomptes : <strong className="text-emerald-600 font-bold">{totalAdvanceBalance.toLocaleString()} FCFA</strong>
                  </p>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg text-amber-700 text-xs font-bold flex items-center gap-2 border border-amber-200">
                  <Wallet className="h-3.5 w-3.5 text-amber-600" />
                  Sélectionnez une avance pour l&apos;utiliser
                </div>
              </div>

              {advancesLoading ? (
                <div className="p-12 text-center text-slate-400">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p className="text-sm font-medium">Chargement des avances du client...</p>
                </div>
              ) : advances.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                  <Wallet className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-700 font-bold mb-1">Aucune avance disponible</p>
                  <p className="text-slate-400 text-sm">Le client n&apos;a pas de crédits prépayés en attente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {advances.map((adv) => {
                    const isSelected = selectedAdvanceId === adv.id;
                    return (
                      <div 
                        key={adv.id}
                        onClick={() => {
                          setSelectedAdvanceId(adv.id);
                          const defaultAmt = Math.min(Number(adv.montant_restant), remainingToPay > 0 ? remainingToPay : Number(adv.montant_restant));
                          setAdvanceAmount(defaultAmt);
                        }}
                        className={`cursor-pointer p-5 rounded-2xl border-2 transition-all relative group ${
                          isSelected 
                            ? "border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20" 
                            : "border-slate-200 hover:border-blue-300 bg-white hover:shadow-sm"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-xl transition-colors ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600"}`}>
                              <Wallet className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 uppercase">
                                {adv.moyen_paiement || "Avance"}
                              </span>
                              {adv.statut && (
                                <span className="ml-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {adv.statut}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-tighter">Solde Restant</p>
                            <p className="text-slate-900 font-black text-xl text-emerald-600">{Number(adv.montant_restant).toLocaleString()} <span className="text-xs font-semibold text-slate-400">FCFA</span></p>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span>{formatDateSafe(adv.date_avance)}</span>
                          <span className="font-semibold text-slate-400">
                            Initial : {Number(adv.montant_initial).toLocaleString()} FCFA
                          </span>
                          <span className="font-bold text-slate-700">{adv.reference_paiement || "Sans Ref"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedAdvanceId && (
                <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col gap-5 text-white animate-in slide-in-from-bottom-4 duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <p className="text-blue-400 text-xs font-black uppercase tracking-widest">Avance N° #{selectedAdvanceId} sélectionnée</p>
                      <p className="text-slate-300 text-xs mt-0.5">
                        Solde de cette avance : <strong className="text-white font-bold">{Number(advances.find(a => a.id === selectedAdvanceId)?.montant_restant || 0).toLocaleString()} FCFA</strong> • Reste facture : <strong className="text-white font-bold">{remainingToPay.toLocaleString()} FCFA</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const adv = advances.find(a => a.id === selectedAdvanceId);
                          if (adv) {
                            setAdvanceAmount(Math.min(Number(adv.montant_restant), remainingToPay));
                          }
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-bold transition-colors"
                      >
                        Solder facture ({Math.min(Number(advances.find(a => a.id === selectedAdvanceId)?.montant_restant || 0), remainingToPay).toLocaleString()} FCFA)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const adv = advances.find(a => a.id === selectedAdvanceId);
                          if (adv) {
                            setAdvanceAmount(Number(adv.montant_restant));
                          }
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-bold transition-colors"
                      >
                        Tout le dépôt ({Number(advances.find(a => a.id === selectedAdvanceId)?.montant_restant || 0).toLocaleString()} FCFA)
                      </button>
                    </div>
                  </div>

                  {remainingToPay <= 0 && (
                    <div className="p-3 bg-amber-500/20 text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold">
                      ⚠️ Cette facture est déjà entièrement réglée. Aucun montant supplémentaire ne peut être imputé.
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1 w-full">
                      <label className="block text-blue-400 text-xs font-black uppercase tracking-widest mb-1.5">Montant à imputer (FCFA)</label>
                      <div className="relative">
                        <input 
                          type="number"
                          min={1}
                          max={Number(advances.find(a => a.id === selectedAdvanceId)?.montant_restant || 0)}
                          value={advanceAmount}
                          onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                          className="bg-white/10 border border-white/20 text-white text-3xl font-black rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-400 focus:border-transparent w-full"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto pt-2 md:pt-0">
                      <button 
                        type="button"
                        onClick={() => setSelectedAdvanceId(null)}
                        className="flex-1 md:w-28 py-3.5 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20 transition-all border border-white/5"
                      >
                        Annuler
                      </button>
                      <button 
                        type="button"
                        onClick={handleUseAdvance}
                        disabled={saving || advanceAmount <= 0 || remainingToPay <= 0}
                        className="flex-1 md:w-56 py-3.5 rounded-xl font-black bg-blue-600 text-white shadow-xl shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-95 disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
                      >
                        {saving ? "Traitement..." : "Appliquer l'Avance"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
