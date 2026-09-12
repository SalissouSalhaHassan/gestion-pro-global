"use client";

import { useEffect, useState } from "react";
import { X, Save, Loader2, Calendar, User, Banknote, Tag, Package, CheckCircle2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getClientSessionFromCookie, isAdminOrManagerSession, DEFAULT_CLIENT_ID } from "@/lib/client_helpers";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";

const supabase = createClient();

type EditInvoiceModalProps = {
  invoiceId: string | number;
  onClose: () => void;
  onRefresh: () => void;
};

export default function EditInvoiceModal({ invoiceId, onClose, onRefresh }: EditInvoiceModalProps) {
  const { t, locale, dir } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [formData, setFormData] = useState({
    client_id: "",
    date_facture: "",
    mode_paiement: "Espèce",
    statut: "Non Payée",
    total_ttc: 0,
    montant_paye: 0,
    montant_restant: 0,
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
          setInvoiceData(inv);
          const totalTtc = Number(inv.total_ttc) || 0;
          const montantPaye = Number(inv.montant_paye) || 0;
          const montantRestant = Math.max(0, totalTtc - montantPaye);

          setFormData({
            client_id: inv.client_id ? String(inv.client_id) : "",
            date_facture: inv.date_facture ? inv.date_facture.split('T')[0] : "",
            mode_paiement: inv.moyen_reglement || inv.mode_paiement || "Espèce",
            statut: inv.statut || (montantRestant <= 0 ? "Payée" : montantPaye > 0 ? "Partielle" : "Non Payée"),
            total_ttc: totalTtc,
            montant_paye: montantPaye,
            montant_restant: montantRestant,
            observation: inv.notes || inv.observation || ""
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

        let clsData: any[] | null = null;

        if (!admin && session?.id) {
          try {
            const isolatedRes = await supabase
              .from("clients")
              .select("id, nom")
              .eq("is_deleted", false)
              .or(`created_by.eq.${session.id},id.eq.${DEFAULT_CLIENT_ID}`)
              .order("nom");
            if (!isolatedRes.error && isolatedRes.data) {
              clsData = isolatedRes.data;
            } else {
              const fallbackRes = await clientQuery;
              clsData = fallbackRes.data;
            }
          } catch {
            const fallbackRes = await clientQuery;
            clsData = fallbackRes.data;
          }
        } else {
          const { data } = await clientQuery;
          clsData = data;
        }

        setClients(clsData || []);

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

  // Handle amount paid changes and automatically update status
  const handlePaidChange = (newPaid: number) => {
    const totalTtc = Number(formData.total_ttc);
    const paid = Math.max(0, newPaid);
    const remaining = Math.max(0, totalTtc - paid);

    let newStatus = formData.statut;
    if (remaining <= 0) {
      newStatus = "Payée";
    } else if (paid > 0) {
      newStatus = "Partielle";
    } else {
      newStatus = "Non Payée";
    }

    setFormData(prev => ({
      ...prev,
      montant_paye: paid,
      montant_restant: remaining,
      statut: newStatus
    }));
  };

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
          client_id: formData.client_id ? Number(formData.client_id) : null,
          date_facture: formData.date_facture,
          mode_paiement: formData.mode_paiement,
          moyen_reglement: formData.mode_paiement,
          statut: formData.statut,
          montant_paye: montantPayeNum,
          montant_restant: montantRestant,
          notes: formData.observation,
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
        <p className="font-bold text-slate-600">{locale === "ar" ? "جاري تحميل بيانات الفاتورة..." : "Chargement de la facture..."}</p>
      </div>
    </div>
  );

  const items = invoiceData?.facture_items || [];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200" dir={dir}>
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-2xl shadow-xs">
              <Tag size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{locale === "ar" ? "تعديل الفاتورة" : "Modifier la Facture"}</span>
                {invoiceData?.bl_number && (
                  <span className="font-mono text-xs bg-indigo-600 text-white px-2.5 py-0.5 rounded-lg font-black">
                    {invoiceData.bl_number}
                  </span>
                )}
              </h2>
              <div className="text-xs text-slate-400 font-bold mt-0.5">
                {locale === "ar" ? "البائع:" : "Vendeur:"} {invoiceData?.vendeur || "Caisse"} • {locale === "ar" ? "الإجمالي:" : "Total:"} <span className="text-slate-900 font-black">{formatCurrencyAmount(formData.total_ttc)}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Client Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <User size={14} className="text-indigo-600" /> {locale === "ar" ? "العميل" : "Client"} <span className="text-rose-500">*</span>
            </label>
            <select
              required
              value={formData.client_id}
              onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer text-sm"
            >
              <option value="">{locale === "ar" ? "اختر العميل..." : "Choisir un client..."}</option>
              {clients.map(cl => (
                <option key={cl.id} value={cl.id}>{cl.nom}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date Facture */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Calendar size={14} className="text-indigo-600" /> {locale === "ar" ? "تاريخ الفاتورة" : "Date Facture"}
              </label>
              <input
                type="date"
                required
                value={formData.date_facture}
                onChange={(e) => setFormData({ ...formData, date_facture: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer text-sm"
              />
            </div>

            {/* Mode de Paiement */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Banknote size={14} className="text-indigo-600" /> {locale === "ar" ? "طريقة الدفع" : "Mode de Paiement"}
              </label>
              <select
                value={formData.mode_paiement}
                onChange={(e) => setFormData({ ...formData, mode_paiement: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer text-sm"
              >
                <option value="Espèce">{locale === "ar" ? "نقداً (Espèce)" : "Espèce"}</option>
                <option value="Chèque">{locale === "ar" ? "شيك (Chèque)" : "Chèque"}</option>
                <option value="Virement">{locale === "ar" ? "تحويل بنكي (Virement)" : "Virement"}</option>
                <option value="Carte Bancaire">{locale === "ar" ? "بطاقة مصرفية (Carte)" : "Carte Bancaire"}</option>
                <option value="Crédit">{locale === "ar" ? "آجل / على الحساب (Crédit)" : "Crédit"}</option>
                <option value="Avance">{locale === "ar" ? "خصم من رصيد العربون (Avance)" : "Avance"}</option>
              </select>
            </div>
          </div>

          {/* Payment Status & Financial Breakdown */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {locale === "ar" ? "حالة السداد" : "Statut de Paiement"}
                </label>
                <select
                  value={formData.statut}
                  onChange={(e) => setFormData({ ...formData, statut: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-black text-slate-800 focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="Payée">{locale === "ar" ? "مسددة بالكامل (Payée)" : "Payée"}</option>
                  <option value="Partielle">{locale === "ar" ? "مدفوعة جزئياً (Partielle)" : "Partielle"}</option>
                  <option value="Non Payée">{locale === "ar" ? "غير مسددة (Non Payée)" : "Non Payée"}</option>
                  <option value="Annulée">{locale === "ar" ? "ملغاة (Annulée)" : "Annulée"}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {locale === "ar" ? "المبلغ المدفوع (FCFA)" : "Montant Payé (FCFA)"}
                </label>
                <input
                  type="number"
                  min={0}
                  max={formData.total_ttc}
                  value={formData.montant_paye}
                  onChange={(e) => handlePaidChange(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-black text-emerald-600 focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>

            {/* Remaining amount display */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs font-bold">
              <span className="text-slate-500">{locale === "ar" ? "المبلغ المتبقي للتحصيل:" : "Reste à recouvrer:"}</span>
              <span className={`font-black text-sm ${formData.montant_restant > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                {formatCurrencyAmount(formData.montant_restant)}
              </span>
            </div>
          </div>

          {/* Line Items Summary View */}
          {items.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Package size={14} className="text-indigo-600" /> {locale === "ar" ? "أصناف الفاتورة المسجلة:" : "Articles de la facture:"} ({items.length})
              </label>
              <div className="max-h-36 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-100">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="p-2.5 px-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-slate-800">{it.description || "Article"}</div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {it.qte} x {formatCurrencyAmount(it.pu_ttc || it.pu_ht || 0)}
                      </div>
                    </div>
                    <div className="font-mono font-black text-slate-900">
                      {formatCurrencyAmount(it.total_item_ttc || (it.qte * (it.pu_ttc || it.pu_ht || 0)))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observation */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">
              {locale === "ar" ? "ملاحظات وتفاصيل التعديل" : "Observation / Notes"}
            </label>
            <textarea 
              value={formData.observation}
              onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-medium text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none text-xs"
              placeholder={locale === "ar" ? "أدخل أي ملاحظات على هذه الفاتورة..." : "Notes internes sur cette modification..."}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
            >
              {locale === "ar" ? "إلغاء" : "Annuler"}
            </button>
            <button
              disabled={saving}
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3 rounded-xl font-black text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              <span>{saving ? (locale === "ar" ? "جاري الحفظ..." : "Enregistrement...") : (locale === "ar" ? "حفظ التعديلات" : "Enregistrer les modifications")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
