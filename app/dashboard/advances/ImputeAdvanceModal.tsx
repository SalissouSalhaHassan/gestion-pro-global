"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Receipt, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Wallet, 
  Calendar,
  DollarSign
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/context";

interface ImputeAdvanceModalProps {
  advance: any;
  onClose: () => void;
  onSuccess: (result: any) => void;
}

export default function ImputeAdvanceModal({ advance, onClose, onSuccess }: ImputeAdvanceModalProps) {
  const { locale, dir } = useLanguage();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = advance?.clients?.nom || `Client #${advance?.client_id}`;
  const advanceRemaining = Number(advance?.montant_restant || 0);

  useEffect(() => {
    async function fetchUnpaidInvoices() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/clients/${advance.client_id}/unpaid-invoices`);
        const data = await res.json();
        if (data.invoices && Array.isArray(data.invoices)) {
          setInvoices(data.invoices);
          if (data.invoices.length > 0) {
            // Auto-select first invoice
            const firstInv = data.invoices[0];
            setSelectedInvoiceId(firstInv.id);
            const defaultAmt = Math.min(advanceRemaining, Number(firstInv.montant_restant));
            setAmount(String(defaultAmt));
          }
        }
      } catch (err: any) {
        console.error("Error loading unpaid invoices:", err);
        setError(locale === "ar" ? "تعذر تحميل فواتير العميل" : "Impossible de charger les factures impayées");
      } finally {
        setLoading(false);
      }
    }

    if (advance?.client_id) {
      fetchUnpaidInvoices();
    }
  }, [advance?.client_id, advanceRemaining, locale]);

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);

  const handleInvoiceChange = (invId: number) => {
    setSelectedInvoiceId(invId);
    const target = invoices.find(inv => inv.id === invId);
    if (target) {
      const defaultAmt = Math.min(advanceRemaining, Number(target.montant_restant));
      setAmount(String(defaultAmt));
    }
  };

  const handleSetMax = () => {
    if (selectedInvoice) {
      const maxAmt = Math.min(advanceRemaining, Number(selectedInvoice.montant_restant));
      setAmount(String(maxAmt));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !amount) return;

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(locale === "ar" ? "يرجى إدخال مبلغ صحيح أكبر من الصفر." : "Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    if (numAmount > advanceRemaining) {
      setError(locale === "ar" ? "المبلغ المدخل يتجاوز رصيد الأمانة المتاح." : "Le montant dépasse le solde disponible de l'acompte.");
      return;
    }

    if (selectedInvoice && numAmount > Number(selectedInvoice.montant_restant)) {
      setError(locale === "ar" ? "المبلغ يتجاوز المبلغ المتبقي على الفاتورة." : "Le montant dépasse le reste à payer sur la facture.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${selectedInvoiceId}/use-advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advance_id: advance.id,
          amount: numAmount
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'imputation de l'acompte");
      }

      onSuccess({
        ...data,
        applied_amount: numAmount,
        advance_id: advance.id,
        invoice_ref: selectedInvoice?.bl_number || `FAC-${selectedInvoiceId}`,
        client_name: clientName
      });
    } catch (err: any) {
      console.error("Imputation error:", err);
      setError(err.message || (locale === "ar" ? "فشلت عملية تسوية الفاتورة." : "Échec de l'imputation"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-indigo-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-blue-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-200">
              <Receipt size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {locale === "ar" ? "استخدام الأمانة في سداد فاتورة" : "Imputer l'Acompte sur une Facture"}
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                {clientName} • REF: {advance?.reference_paiement || `DEP-${advance?.id}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border border-slate-200/60"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Balance Cards Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-200/80">
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block">
                {locale === "ar" ? "رصيد الأمانة المتاح" : "Solde Acompte Disponible"}
              </span>
              <span className="text-lg font-black text-blue-900 mt-0.5 block">
                {formatCurrencyAmount(advanceRemaining)}
              </span>
            </div>

            <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80">
              <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider block">
                {locale === "ar" ? "المتبقي بعد هذه العملية" : "Nouveau Solde Restant"}
              </span>
              <span className="text-lg font-black text-amber-950 mt-0.5 block">
                {formatCurrencyAmount(Math.max(0, advanceRemaining - (Number(amount) || 0)))}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Invoices List */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              {locale === "ar" ? "اختر الفاتورة المراد تسويتها" : "Sélectionner la Facture à Régler"} *
            </label>

            {loading ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 size={24} className="animate-spin mx-auto text-indigo-600 mb-2" />
                <span className="text-xs font-bold">{locale === "ar" ? "جاري البحث عن الفواتير غير المسددة..." : "Recherche des factures en attente..."}</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-slate-500 text-xs font-bold">
                <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-1.5" />
                {locale === "ar" ? "لا توجد فواتير غير مسددة لهذا العميل حالياً." : "Ce client n'a aucune facture impayée actuellement."}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {invoices.map((inv) => {
                  const isSelected = inv.id === selectedInvoiceId;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => handleInvoiceChange(inv.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-indigo-50/70 border-indigo-500 shadow-xs ring-2 ring-indigo-200"
                          : "bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                          isSelected ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                        }`}>
                          <FileText size={14} />
                        </div>
                        <div>
                          <div className="font-black text-xs text-slate-900">
                            {inv.bl_number || `Facture #${inv.id}`}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Calendar size={10} />
                            {new Date(inv.date_facture).toLocaleDateString(locale === "ar" ? "ar-SA" : "fr-FR")}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400">
                          {locale === "ar" ? "المتبقي:" : "Reste à payer :"}
                        </div>
                        <div className="text-xs font-black text-rose-600">
                          {formatCurrencyAmount(Number(inv.montant_restant))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amount Input */}
          {selectedInvoice && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  {locale === "ar" ? "المبلغ المراد خصمه من الأمانة (FCFA)" : "Montant à Imputer (FCFA)"} *
                </label>
                <button
                  type="button"
                  onClick={handleSetMax}
                  className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {locale === "ar" ? "المبلغ الأقصى الممكن" : "Max possible"}
                </button>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  max={Math.min(advanceRemaining, Number(selectedInvoice.montant_restant))}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 50000"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-lg font-black text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div className="text-[11px] font-bold text-slate-500 flex justify-between">
                <span>{locale === "ar" ? "إجمالي الفاتورة:" : "Total facture :"} {formatCurrencyAmount(Number(selectedInvoice.total_ttc))}</span>
                <span>{locale === "ar" ? "متبقي الفاتورة:" : "Reste facture :"} {formatCurrencyAmount(Number(selectedInvoice.montant_restant))}</span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              {locale === "ar" ? "إلغاء" : "Annuler"}
            </button>

            <button
              type="submit"
              disabled={submitting || invoices.length === 0 || !selectedInvoiceId || !amount || Number(amount) <= 0}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              <span>{locale === "ar" ? "تأكيد واستخدام الأمانة" : "Valider l'Imputation"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
