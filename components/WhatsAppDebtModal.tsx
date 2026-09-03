"use client";

import { useState, useEffect } from "react";
import { MessageSquare, Send, Phone, X, Sparkles, CheckCircle2, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import {
  generateDebtReminderWhatsAppMessage,
  openWhatsAppDirect,
} from "@/lib/utils/whatsapp";

type WhatsAppDebtModalProps = {
  client: {
    id: string | number;
    nom: string;
    tel?: string | null;
    credit_facture?: number;
    credit_bl?: number;
    credit?: number;
  };
  companyName?: string;
  onClose: () => void;
};

export default function WhatsAppDebtModal({
  client,
  companyName = "GESTION PRO GLOBAL",
  onClose,
}: WhatsAppDebtModalProps) {
  const { locale, dir } = useLanguage();
  const [phone, setPhone] = useState(client.tel || "");
  const [tone, setTone] = useState<"friendly" | "formal">("friendly");

  const totalDebt = (client.credit !== undefined)
    ? client.credit
    : (Number(client.credit_facture || 0) + Number(client.credit_bl || 0));

  const [message, setMessage] = useState(() =>
    generateDebtReminderWhatsAppMessage({
      companyName,
      clientName: client.nom,
      totalDebt,
      invoiceDebt: Number(client.credit_facture || 0),
      blDebt: Number(client.credit_bl || 0),
      tone: "friendly",
      locale,
    })
  );

  const [sent, setSent] = useState(false);

  useEffect(() => {
    setMessage(
      generateDebtReminderWhatsAppMessage({
        companyName,
        clientName: client.nom,
        totalDebt,
        invoiceDebt: Number(client.credit_facture || 0),
        blDebt: Number(client.credit_bl || 0),
        tone,
        locale,
      })
    );
  }, [tone, locale, companyName, client.nom, totalDebt, client.credit_facture, client.credit_bl]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert(locale === "ar" ? "يرجى إدخال رقم هاتف صالح للعميل." : "Veuillez saisir un numéro de téléphone valide.");
      return;
    }
    openWhatsAppDirect(phone, message);
    setSent(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in duration-200 font-sans" dir={dir}>
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 text-white p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black">
                <MessageSquare size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-black">
                  {locale === "ar" ? "تذكير بالديون عبر WhatsApp" : "Rappel de Créance via WhatsApp"}
                </h3>
                <p className="text-xs text-emerald-100 font-medium">
                  {client.nom} • {totalDebt.toLocaleString()} FCFA
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSend} className="p-6 space-y-4">
          {/* Tone Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setTone("friendly")}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                tone === "friendly"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {locale === "ar" ? "🌸 تذكير ودي ولطيف" : "🌸 Rappel Confraternel"}
            </button>
            <button
              type="button"
              onClick={() => setTone("formal")}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                tone === "formal"
                  ? "bg-white text-rose-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {locale === "ar" ? "⚠️ إشعار تسوية رسمي" : "⚠️ Avis Officiel Urgent"}
            </button>
          </div>

          {/* Phone Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {locale === "ar" ? "رقم هاتف العميل (WhatsApp) :" : "Numéro WhatsApp du Destinataire :"}
            </label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: +227 90 00 00 00"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Message Preview */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {locale === "ar" ? "معاينة وتعديل نص الرسالة :" : "Aperçu du message à envoyer :"}
            </label>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-mono"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            >
              {locale === "ar" ? "إلغاء" : "Annuler"}
            </button>

            <button
              type="submit"
              disabled={sent}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {sent ? <CheckCircle2 size={16} /> : <Send size={15} />}
              <span>{sent ? (locale === "ar" ? "تم الإرسال!" : "Envoyé !") : (locale === "ar" ? "فتح في WhatsApp" : "Envoyer sur WhatsApp")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
