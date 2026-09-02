import { Locale } from "@/lib/i18n/translations";
import { formatCurrencyAmount } from "@/lib/utils/currency";

export interface InvoiceWhatsAppDetails {
  companyName: string;
  invoiceNumber: string | number;
  clientName: string;
  totalTTC: number;
  montantPaye?: number;
  resteAPayer?: number;
  currency?: string;
  invoiceUrl?: string;
  locale?: Locale;
}

/**
 * Formats a phone number for WhatsApp wa.me link
 * Removes spaces, dashes, parentheses and ensures international format
 */
export function formatPhoneForWhatsApp(phone: string, defaultCountryCode: string = "227"): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^0-9+]/g, "");

  // If starts with +, remove +
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.length === 8) {
    // Standard Niger / West Africa 8-digit phone without country code
    cleaned = `${defaultCountryCode}${cleaned}`;
  }

  return cleaned;
}

/**
 * Generates an elegant WhatsApp invoice message
 */
export function generateInvoiceWhatsAppMessage(details: InvoiceWhatsAppDetails): string {
  const {
    companyName,
    invoiceNumber,
    clientName,
    totalTTC,
    montantPaye = 0,
    resteAPayer = 0,
    currency = "FCFA",
    invoiceUrl = "",
    locale = "fr",
  } = details;

  const formattedTotal = formatCurrencyAmount(totalTTC, currency, locale);
  const formattedPaye = formatCurrencyAmount(montantPaye, currency, locale);
  const formattedReste = formatCurrencyAmount(resteAPayer, currency, locale);

  if (locale === "ar") {
    return (
      `*🧾 فاتورة جديدة من ${companyName}*\n\n` +
      `مرحباً بك عزيزنا *${clientName}*،\n` +
      `يسرنا إرسال تفاصيل الفاتورة الخاصة بكم:\n\n` +
      `🔢 *رقم الفاتورة:* #${invoiceNumber}\n` +
      `💰 *المبلغ الإجمالي:* ${formattedTotal}\n` +
      `✅ *المبلغ المسدد:* ${formattedPaye}\n` +
      (resteAPayer > 0 ? `⚠️ *المبلغ المتبقي:* ${formattedReste}\n` : `🎉 *الحالة:* مدفوعة بالكامل\n`) +
      (invoiceUrl ? `\n🔗 *رابط الفاتورة الرقمية والدفع:* ${invoiceUrl}\n\n` : "\n") +
      `شكراً لثقتكم وتعاملكم معنا! 🙏✨`
    );
  }

  // French (default)
  return (
    `*🧾 Facture #${invoiceNumber} - ${companyName}*\n\n` +
    `Bonjour *${clientName}*,\n` +
    `Voici le récapitulatif de votre facture :\n\n` +
    `💰 *Montant Total TTC :* ${formattedTotal}\n` +
    `✅ *Montant Payé :* ${formattedPaye}\n` +
    (resteAPayer > 0 ? `⚠️ *Reste à Payer :* ${formattedReste}\n` : `🎉 *Statut :* Payée en totalité\n`) +
    (invoiceUrl ? `\n🔗 *Consulter et payer en ligne :* ${invoiceUrl}\n\n` : "\n") +
    `Merci pour votre confiance ! 🙏✨`
  );
}

/**
 * Opens WhatsApp Web or WhatsApp Mobile app with pre-filled text
 */
export function openWhatsAppDirect(phone: string, message: string) {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(message);
  
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;

  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}
