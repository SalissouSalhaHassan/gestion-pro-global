"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { CreditCard, Smartphone, CheckCircle, ShieldCheck, ArrowRight, QrCode, Lock } from "lucide-react";

export default function CheckoutDemoModal({
  invoiceId,
  amount,
  clientName,
  currency = "FCFA",
  onSuccess,
  onClose,
}: {
  invoiceId: string | number;
  amount: number;
  clientName?: string;
  currency?: string;
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const { locale } = useLanguage();
  const [selectedMethod, setSelectedMethod] = useState<"card" | "mobile_money" | "bank_transfer">("mobile_money");
  const [mobileOperator, setMobileOperator] = useState<"wave" | "orange" | "mtn" | "moov">("wave");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);

    // Simulate instant secure payment processing
    setTimeout(() => {
      setProcessing(false);
      setCompleted(true);
      if (onSuccess) onSuccess();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl" />
          
          <div className="relative z-10 flex items-center justify-between mb-3">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock size={14} />
              {locale === "ar" ? "بوابة الدفع الآمنة المشفرة" : "Paiement Sécurisé SSL"}
            </span>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg bg-white/10"
            >
              ✕
            </button>
          </div>

          <div className="text-center my-3">
            <div className="text-xs text-slate-300 font-medium">
              {locale === "ar" ? "المبلغ المستحق للدفع" : "Montant total à payer"}
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-1">
              {formatCurrencyAmount(amount, currency, locale)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {locale === "ar" ? `فاتورة رقم: #${invoiceId}` : `Facture #${invoiceId}`}
              {clientName ? ` • ${clientName}` : ""}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {completed ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle size={36} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {locale === "ar" ? "تم الدفع بنجاح!" : "Paiement Effectué avec Succès !"}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {locale === "ar"
                    ? "تم تحديث حالة الفاتورة وإرسال الإشعار للعميل فوراً."
                    : "La facture est marquée comme payée et le reçu est disponible."}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black text-sm shadow-md hover:bg-indigo-700 transition-colors"
              >
                {locale === "ar" ? "إغلاق ومتابعة" : "Fermer & Continuer"}
              </button>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-5">
              {/* Payment Methods Tabs */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedMethod("mobile_money")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                    selectedMethod === "mobile_money"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Smartphone size={16} />
                  Mobile Money
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod("card")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                    selectedMethod === "card"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CreditCard size={16} />
                  Carte Bancaire
                </button>
              </div>

              {/* Mobile Money Options */}
              {selectedMethod === "mobile_money" ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      {locale === "ar" ? "اختر شبكة الدفع" : "Opérateur Mobile"}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: "wave", name: "Wave", color: "bg-cyan-500" },
                        { id: "orange", name: "Orange", color: "bg-orange-500" },
                        { id: "mtn", name: "MTN", color: "bg-yellow-500" },
                        { id: "moov", name: "Moov", color: "bg-blue-600" },
                      ].map((op) => (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => setMobileOperator(op.id as any)}
                          className={`p-2.5 rounded-xl border text-center font-black text-xs transition-all ${
                            mobileOperator === op.id
                              ? "border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${op.color} mx-auto mb-1`} />
                          {op.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {locale === "ar" ? "رقم الهاتف للدفع" : "Numéro de téléphone"}
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+227 90 00 00 00"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      {locale === "ar" ? "رقم البطاقة الائتمانية" : "Numéro de Carte"}
                    </label>
                    <input
                      type="text"
                      placeholder="4000 1234 5678 9010"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Exp MM/YY</label>
                      <input
                        type="text"
                        placeholder="12/28"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">CVC / CVV</label>
                      <input
                        type="password"
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={processing}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {processing ? (
                  <span>{locale === "ar" ? "جاري المعالجة والتحقق..." : "Traitement du paiement..."}</span>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>
                      {locale === "ar"
                        ? `سداد ${formatCurrencyAmount(amount, currency, locale)} الآن`
                        : `Payer ${formatCurrencyAmount(amount, currency, locale)} maintenant`}
                    </span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Paiement sécurisé crypté SSL 256-bit • Instant Webhook</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
