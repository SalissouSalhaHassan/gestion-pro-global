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
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchData();
  }, [invoice.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const pRes = await fetch(`/api/invoices/${invoice.id}/payments`);
      const pData = await pRes.json();
      setPayments(Array.isArray(pData) ? pData : []);

      if (invoice.client_id) {
        // Fetch client advances
        const aRes = await fetch(`/api/clients/${invoice.client_id}/advances?statut=Disponible`);
        const aData = await aRes.json();
        setAdvances(Array.isArray(aData) ? aData : []);
      }
    } catch (err) {
      console.error("Error fetching payment data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPayment)
      });
      if (res.ok) {
        setNewPayment({ ...newPayment, reference_paiement: "", banque: "" });
        onRefresh();
        fetchData();
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
        fetchData();
      }
    } catch (err) {
      console.error("Error deleting payment:", err);
    }
  };

  const handleUseAdvance = async () => {
    if (!selectedAdvanceId || advanceAmount <= 0) return;
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
        fetchData();
      }
    } catch (err) {
      console.error("Error using advance:", err);
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
              <p className="text-green-600 font-black text-lg">{(invoice.montant_paye || 0).toLocaleString()} <span className="text-xs font-medium text-slate-400 ml-1">FCFA</span></p>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center gap-4 bg-gradient-to-br from-white to-red-50/30">
            <div className="h-10 w-10 bg-red-50 rounded-full flex items-center justify-center text-red-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Reste à Payer</p>
              <p className="text-red-600 font-black text-lg">{(invoice.montant_restant || 0).toLocaleString()} <span className="text-xs font-medium text-slate-400 ml-1">FCFA</span></p>
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
            Utiliser une Avance
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
                            <p className="text-slate-900 font-black">{p.montant_regle.toLocaleString()} FCFA</p>
                            <p className="text-slate-400 text-xs font-semibold">{format(new Date(p.date_operation), 'dd MMMM yyyy', { locale: fr })} {p.reference_paiement && `• ${p.reference_paiement}`}</p>
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
                      onChange={(e) => setNewPayment({...newPayment, montant_regle: parseFloat(e.target.value)})}
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
                    disabled={saving || invoice.montant_restant <= 0 || newPayment.montant_regle <= 0}
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
              <div className="flex items-center justify-between">
                <h3 className="text-slate-800 font-black text-sm uppercase tracking-widest">Avances Disponibles pour ce client</h3>
                <div className="p-2 bg-amber-50 rounded-lg text-amber-600 text-xs font-bold flex items-center gap-2 border border-amber-100">
                  <Wallet className="h-3 w-3" />
                  Sélectionnez une avance pour l&apos;utiliser
                </div>
              </div>

              {advances.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                  <Wallet className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-bold mb-1">Aucune avance disponible</p>
                  <p className="text-slate-400 text-sm">Le client n&apos;a pas de crédits prépayés en attente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {advances.map((adv) => (
                    <div 
                      key={adv.id}
                      onClick={() => {
                        setSelectedAdvanceId(adv.id);
                        setAdvanceAmount(Math.min(adv.montant_restant, invoice.montant_restant));
                      }}
                      className={`cursor-pointer p-5 rounded-2xl border-2 transition-all group ${selectedAdvanceId === adv.id ? "border-blue-600 bg-blue-50/30" : "border-slate-100 hover:border-slate-200 bg-white"}`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-white transition-colors">
                          <Wallet className="h-5 w-5 text-slate-600" />
                        </div>
                        <div className="text-right">
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-tighter">Solde Restant</p>
                          <p className="text-slate-900 font-black text-lg">{adv.montant_restant.toLocaleString()} FCFA</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-slate-400 text-xs font-bold">{format(new Date(adv.date_avance), 'dd MMM yyyy')}</span>
                        <span className="text-slate-500 text-xs font-black">{adv.reference_paiement || "Sans Ref"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedAdvanceId && (
                <div className="bg-slate-900 rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex-1">
                    <p className="text-blue-400 text-xs font-black uppercase tracking-widest mb-1">Montant à utiliser</p>
                    <input 
                      type="number"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(parseFloat(e.target.value))}
                      className="bg-transparent border-none text-white text-4xl font-black focus:ring-0 p-0 w-full"
                    />
                  </div>
                  <div className="flex gap-4 w-full md:w-auto">
                    <button 
                      onClick={() => setSelectedAdvanceId(null)}
                      className="flex-1 md:w-32 py-4 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20 transition-all border border-white/5"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleUseAdvance}
                      disabled={saving || advanceAmount <= 0}
                      className="flex-1 md:w-64 py-4 rounded-xl font-black bg-blue-600 text-white shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition-all active:scale-95 disabled:bg-slate-700"
                    >
                      {saving ? "Traitement..." : "Appliquer l'Avance"}
                    </button>
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
