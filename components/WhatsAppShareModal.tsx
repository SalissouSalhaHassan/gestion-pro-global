"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import {
  generateInvoiceWhatsAppMessage,
  openWhatsAppDirect,
  InvoiceWhatsAppDetails,
} from "@/lib/utils/whatsapp";
import { MessageSquare, Send, Phone, X, Sparkles, CheckCircle2 } from "lucide-react";

export default function WhatsAppShareModal({
  details,
  initialPhone = "",
  onClose,
}: {
  details: InvoiceWhatsAppDetails;
  initialPhone?: string;
  onClose: () => void;
}) {
  const { locale } = useLanguage();
  const [phone, setPhone] = useState(initialPhone);
  const [customText, setCustomText] = useState(() =>
    generateInvoiceWhatsAppMessage({ ...details, locale })
  );
  const [sent, setSent] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    openWhatsAppDirect(phone, customText);
    setSent(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black">
                <MessageSquare size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-black">
                  {locale === "ar" ? "إرسال الفاتورة عبر WhatsApp" : "Partage Facture via WhatsApp"}
                </h3>
                <p className="text-xs text-emerald-100 font-medium">
                  {locale === "ar" ? `فاتورة رقم #${details.invoiceNumber}` : `Facture #${details.invoiceNumber} • ${details.clientName}`}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-xl bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSend} className="p-6 space-y-5">
          {/* Phone Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Phone size={14} className="text-emerald-600" />
              {locale === "ar" ? "رقم هاتف العميل (واتساب)" : "Numéro de Téléphone (WhatsApp)"}
            </label>
            <input
              type="tel"
              placeholder="+227 90 00 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Message Preview */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              {locale === "ar" ? "نص الرسالة المجهزة للإرسال" : "Aperçu du Message"}
            </label>
            <textarea
              rows={6}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {sent ? (
              <>
                <CheckCircle2 size={18} />
                <span>{locale === "ar" ? "تم فتح WhatsApp!" : "WhatsApp Ouvert !"}</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>{locale === "ar" ? "إرسال إلى WhatsApp الآن" : "Envoyer sur WhatsApp"}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
