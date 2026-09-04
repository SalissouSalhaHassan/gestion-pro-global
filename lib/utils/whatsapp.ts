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

/**
 * Generates an Enterprise Customer Debt Reminder WhatsApp Message
 */
export function generateDebtReminderWhatsAppMessage(params: {
  companyName: string;
  clientName: string;
  totalDebt: number;
  invoiceDebt?: number;
  blDebt?: number;
  tone?: "friendly" | "formal";
  currency?: string;
  locale?: Locale;
}): string {
  const {
    companyName,
    clientName,
    totalDebt,
    invoiceDebt = 0,
    blDebt = 0,
    tone = "friendly",
    currency = "FCFA",
    locale = "fr",
  } = params;

  const fmtTotal = formatCurrencyAmount(totalDebt, currency, locale);
  const fmtInv = formatCurrencyAmount(invoiceDebt, currency, locale);
  const fmtBl = formatCurrencyAmount(blDebt, currency, locale);

  if (locale === "ar") {
    if (tone === "formal") {
      return (
        `*⚠️ إشعار تسوية رصيد مستحق - ${companyName}*\n\n` +
        `عناية السيد/المؤسسة: *${clientName}*\n\n` +
        `نحيطكم علماً بأن ذمتكم المالية لدى شركتنا تسجل رصيداً مستحق السداد قدره: *${fmtTotal}*.\n` +
        (invoiceDebt > 0 ? `• فواتير مستحقة: ${fmtInv}\n` : "") +
        (blDebt > 0 ? `• سندات تسليم معلقة: ${fmtBl}\n` : "") +
        `\nنرجو منكم التكرم باتخاذ الإجراءات اللازمة لتحويل أو تسديد المبلغ في أقرب الآجال.\n\n` +
        `شاكرين لكم حسن تعاونكم وتفضلوا بقبول فائق الاحترام والتقدير.\n` +
        `*الإدارة المالية - ${companyName}*`
      );
    }
    return (
      `*🌸 تذكير لطيف من ${companyName}*\n\n` +
      `أهلاً بك عزيزنا *${clientName}*،\n` +
      `نتمنى أن تكون بخير وعافية. نود تذكيركم بلطف بأن رصيدكم الحالي المستحق هو: *${fmtTotal}*.\n\n` +
      `نسعد دائماً بخدمتكم وشكراً لثقتكم المستمرة بنا! ✨🙏\n` +
      `*${companyName}*`
    );
  }

  // French (default)
  if (tone === "formal") {
    return (
      `*⚠️ AVIS DE RÈGLEMENT - ${companyName}*\n\n` +
      `À l'attention de : *${clientName}*\n\n` +
      `Sauf erreur ou omission de notre part, votre compte présente un solde débiteur en notre faveur de : *${fmtTotal}*.\n` +
      (invoiceDebt > 0 ? `• Factures échues : ${fmtInv}\n` : "") +
      (blDebt > 0 ? `• Bons de livraison : ${fmtBl}\n` : "") +
      `\nNous vous prions de bien vouloir procéder à la régularisation de cette situation dans les meilleurs délais.\n\n` +
      `Restant à votre disposition, veuillez agréer nos salutations distinguées.\n` +
      `*Service Comptabilité - ${companyName}*`
    );
  }

  return (
    `*🌸 Rappel Confraternel - ${companyName}*\n\n` +
    `Bonjour *${clientName}*,\n` +
    `Nous espérons que vous allez bien. Sauf erreur de notre part, votre encours actuel s'élève à *${fmtTotal}*.\n\n` +
    `Merci de bien vouloir prévoir son règlement lors de votre prochain passage.\n` +
    `Au plaisir de vous servir à nouveau ! ✨🙏\n` +
    `*${companyName}*`
  );
}

/**
 * Generates an Executive Daily Cash Register Closure (Rapport Z) WhatsApp Message
 */
export function generateCashClosureWhatsAppMessage(params: {
  companyName: string;
  dateClosure: string;
  cashierName: string;
  fondDeCaisse: number;
  encaissements: number;
  decaissements: number;
  soldeTheorique: number;
  soldeReel: number;
  ecart: number;
  currency?: string;
  locale?: Locale;
}): string {
  const {
    companyName,
    dateClosure,
    cashierName,
    fondDeCaisse,
    encaissements,
    decaissements,
    soldeTheorique,
    soldeReel,
    ecart,
    currency = "FCFA",
    locale = "fr",
  } = params;

  const fmt = (n: number) => formatCurrencyAmount(n, currency, locale);

  const ecartText =
    ecart === 0
      ? (locale === "ar" ? "✅ الصندوق متطابق بدقة (0 FCFA)" : "✅ Caisse parfaitement équilibrée (0 FCFA)")
      : ecart > 0
      ? (locale === "ar" ? `🟢 فائض نقدي: +${fmt(ecart)}` : `🟢 Excédent de caisse : +${fmt(ecart)}`)
      : (locale === "ar" ? `🔴 عجز في الصندوق: ${fmt(ecart)}` : `🔴 Déficit de caisse : ${fmt(ecart)}`);

  if (locale === "ar") {
    return (
      `*📊 تقرير إغلاق الصندوق اليومي (Rapport Z)*\n` +
      `🏢 *المؤسسة:* ${companyName}\n` +
      `📅 *التاريخ:* ${dateClosure}\n` +
      `👤 *مسؤول الصندوق:* ${cashierName}\n\n` +
      `💵 *رصيد البداية (Fond de Caisse):* ${fmt(fondDeCaisse)}\n` +
      `📥 *إجمالي المقبوضات (Ventes):* ${fmt(encaissements)}\n` +
      `📤 *إجمالي المدفوعات (Dépenses):* ${fmt(decaissements)}\n` +
      `──────────────────\n` +
      `📈 *الرصيد الدفتري المحاسبي:* ${fmt(soldeTheorique)}\n` +
      `💰 *الرصيد الفعلي المعدود:* ${fmt(soldeReel)}\n` +
      `⚖️ *نتيجة المطابقة:* ${ecartText}\n\n` +
      `*تم إنشاء هذا التقرير آلياً عبر Gestion Pro Global*`
    );
  }

  return (
    `*📊 RAPPORT DE CLÔTURE DE CAISSE (RAPPORT Z)*\n` +
    `🏢 *Entreprise :* ${companyName}\n` +
    `📅 *Date :* ${dateClosure}\n` +
    `👤 *Caissier :* ${cashierName}\n\n` +
    `💵 *Fond de Caisse :* ${fmt(fondDeCaisse)}\n` +
    `📥 *Encaissements (Ventes) :* ${fmt(encaissements)}\n` +
    `📤 *Décaissements (Dépenses) :* ${fmt(decaissements)}\n` +
    `──────────────────\n` +
    `📈 *Solde Théorique :* ${fmt(soldeTheorique)}\n` +
    `💰 *Espèces Réelles Comptées :* ${fmt(soldeReel)}\n` +
    `⚖️ *Bilan & Écart :* ${ecartText}\n\n` +
    `*Généré automatiquement par Gestion Pro Global 4K*`
  );
}

export interface DevisWhatsAppDetails {
  companyName: string;
  devisNumber: string;
  clientName: string;
  totalTTC: number;
  dateDevis: string;
  dateValidite?: string;
  items?: Array<{ description: string; qte: number; total_ligne_ttc?: number }>;
  currency?: string;
  locale?: Locale;
}

export function generateDevisWhatsAppMessage(details: DevisWhatsAppDetails): string {
  const {
    companyName,
    devisNumber,
    clientName,
    totalTTC,
    dateDevis,
    dateValidite,
    items = [],
    currency = "FCFA",
    locale = "fr",
  } = details;

  const formattedTotal = formatCurrencyAmount(totalTTC, currency, locale);

  if (locale === "ar") {
    let msg = `*📋 عرض أسعار جديد (Devis / Proforma) من ${companyName}*\n\n`;
    msg += `مرحباً بك عزيزنا *${clientName}*،\n`;
    msg += `يسعدنا تقديم عرض السعر الرسمي رقم: *${devisNumber}*\n\n`;
    msg += `📅 *تاريخ العرض:* ${dateDevis}\n`;
    if (dateValidite) msg += `⏳ *صلاحية العرض حتى:* ${dateValidite}\n`;
    msg += `💰 *المبلغ الإجمالي (TTC):* *${formattedTotal}*\n\n`;
    if (items.length > 0) {
      msg += `*📦 تفاصيل الأصناف المقترحة:*\n`;
      items.slice(0, 10).forEach((it) => {
        msg += `• ${it.description} (الكمية: ${it.qte})\n`;
      });
      if (items.length > 10) msg += `• ... و ${items.length - 10} صنف إضافي\n`;
      msg += `\n`;
    }
    msg += `للموافقة والتحويل إلى فاتورة مبيعات، يرجى الرد على هذه الرسالة.\n\nمع تحيات إدارة المبيعات،\n*${companyName}*`;
    return msg;
  }

  let msg = `*📋 Devis / Facture Proforma N° ${devisNumber}*\n\n`;
  msg += `Bonjour *${clientName}*,\n`;
  msg += `Veuillez trouver ci-dessous notre proposition commerciale émise par *${companyName}* :\n\n`;
  msg += `📅 *Date :* ${dateDevis}\n`;
  if (dateValidite) msg += `⏳ *Validité :* jusqu'au ${dateValidite}\n`;
  msg += `💰 *Total TTC :* *${formattedTotal}*\n\n`;
  if (items.length > 0) {
    msg += `*Détail des articles :*\n`;
    items.slice(0, 10).forEach((it) => {
      msg += `• ${it.description} (x${it.qte})\n`;
    });
    if (items.length > 10) msg += `• ... et ${items.length - 10} autre(s) article(s)\n`;
    msg += `\n`;
  }
  msg += `Pour valider cette proposition ou pour tout complément d'information, n'hésitez pas à nous contacter.\n\nCordialement,\n*Direction Commerciale - ${companyName}*`;
  return msg;
}
