"use client";

import { useEffect, useState } from "react";
import { X, Save, Loader2, Calendar, User, Banknote, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClientSessionFromCookie, isAdminOrManagerSession, DEFAULT_CLIENT_ID } from "@/lib/client_helpers";

const supabase = createClient();

type EditInvoiceModalProps = {
  invoiceId: string | number;
  onClose: () => void;
  onRefresh: () => void;
};

export default function EditInvoiceModal({ invoiceId, onClose, onRefresh }: EditInvoiceModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    client_id: "",
    date_facture: "",
    mode_paiement: "",
    statut: "",
    total_ttc: 0,
    montant_paye: 0,
    observation: ""
  });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // 1. Fetch Invoice via secure API
        const response = await fetch(`/api/invoices/${invoiceId}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Impossible de charger la facture");
        }
        
        const inv = await response.json();

        if (inv) {
          setFormData({
            client_id: inv.client_id || "",
            date_facture: inv.date_facture ? inv.date_facture.split('T')[0] : "", // Ensure date format YYYY-MM-DD
            mode_paiement: inv.mode_paiement || "",
            statut: inv.statut || "Non Payée",
            total_ttc: Number(inv.total_ttc) || 0,
            montant_paye: Number(inv.montant_paye) || 0,
            observation: inv.observation || ""
          });
        }

        // 2. Fetch Clients (with isolation for Dépôt users)
        const session = getClientSessionFromCookie();
        const admin = isAdminOrManagerSession(session);

        let clientQuery = supabase
          .from("clients")
          .select("id, nom")
          .eq("is_deleted", false)
          .order("nom");

        // ── CLIENT ISOLATION: Dépôt users only see their own clients + default client ──
        if (!admin && session?.id) {
          clientQuery = clientQuery.or(`created_by.eq.${session.id},id.eq.${DEFAULT_CLIENT_ID}`);
        }

        const { data: cls } = await clientQuery;
        setClients(cls || []);

      } catch (err) {
        console.error("Error loading invoice for edit:", err);
        alert(err instanceof Error ? err.message : "Erreur de chargement");
        onClose();
      } finally {
        setLoading(false);
      }
    }
    if (invoiceId) loadData();
  }, [invoiceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const montantPayeNum = Number(formData.montant_paye);
      const totalTtcNum = Number(formData.total_ttc);
      const montantRestant = Math.max(0, totalTtcNum - montantPayeNum);

      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: formData.client_id || null,
          date_facture: formData.date_facture,
          mode_paiement: formData.mode_paiement,
          statut: formData.statut,
          montant_paye: montantPayeNum,
          montant_restant: montantRestant,
          observation: formData.observation
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erreur lors de la mise à jour");
      }

      onRefresh();
      onClose();
    } catch (err) {
      console.error("Error updating invoice:", err);
      alert(err instanceof Error ? err.message : "Erreur lors de la mise à jour de la facture.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <p className="font-bold text-slate-600">Chargement...</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Tag size={20} />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Modifier la Facture</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto">
          {/* Client Selection */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <User size={14} /> Client <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option value="">Choisir un client...</option>
              {clients.map(cl => (
                <option key={cl.id} value={cl.id}>{cl.nom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Calendar size={14} /> Date Facture
              </label>
              <input
                type="date"
                required
                value={formData.date_facture}
                onChange={(e) => setFormData({ ...formData, date_facture: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
              />
            </div>

            {/* Mode de Paiement */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Banknote size={14} /> Mode de Paiement
              </label>
              <select
                value={formData.mode_paiement}
                onChange={(e) => setFormData({ ...formData, mode_paiement: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
              >
                <option value="Espèce">Espèce</option>
                <option value="Chèque">Chèque</option>
                <option value="Virement">Virement</option>
                <option value="Carte Bancaire">Carte Bancaire</option>
                <option value="Crédit">Crédit</option>
              </select>
            </div>
          </div>

          {/* Payment Status & Amount Paid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[28px] border border-slate-100 shadow-inner">
             <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Statut</label>
                <select
                    value={formData.statut}
                    onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 font-black text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                >
                    <option value="Payée">Payée</option>
                    <option value="Partielle">Partielle</option>
                    <option value="Non Payée">Non Payée</option>
                    <option value="Annulée">Annulée</option>
                </select>
             </div>
             <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Montant Payé</label>
                <input
                    type="number"
                    value={formData.montant_paye}
                    onChange={(e) => setFormData({ ...formData, montant_paye: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                />
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-black uppercase tracking-widest text-slate-400">Observation / Notes</label>
             <textarea 
                value={formData.observation}
                onChange={(e) => setFormData({...formData, observation: e.target.value})}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-medium text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none shadow-sm"
                placeholder="Notes internes sur cette modification..."
             />
          </div>

          {/* Action Button */}
          <div className="pt-4 flex justify-end">
            <button
              disabled={saving}
              type="submit"
              className="w-full md:w-auto bg-indigo-600 text-white px-10 py-4 rounded-[22px] font-black shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {saving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
              {saving ? "Enregistrement..." : "Enregistrer les modifications"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
