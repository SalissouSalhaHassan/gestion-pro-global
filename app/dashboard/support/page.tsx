"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import {
  Headphones,
  MessageSquare,
  Phone,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Search,
  ShieldCheck,
  Zap,
  Clock,
  ExternalLink,
  Laptop,
} from "lucide-react";

export default function SupportDeskPage() {
  const { t, locale, dir } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [ticketCategory, setTicketCategory] = useState("Ventes & POS");
  const [ticketPriority, setTicketPriority] = useState("Normale");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastSuccess, setToastSuccess] = useState(false);

  const [tickets, setTickets] = useState([
    {
      id: "TICK-8041",
      subject: "Question sur la synchronisation POS hors-ligne",
      category: "Point de Vente",
      priority: "Normale",
      status: "Résolu",
      date: "Aujourd'hui, 14:20",
    },
    {
      id: "TICK-7992",
      subject: "Demande d'ajout d'une nouvelle devise NGN",
      category: "Configuration",
      priority: "Basse",
      status: "En cours",
      date: "Hier, 18:45",
    },
  ]);

  const faqs = [
    {
      q: locale === "ar" ? "كيف يعمل وضع نقطة البيع دون إنترنت (Offline POS)؟" : "Comment fonctionne le mode hors-ligne du POS ?",
      a:
        locale === "ar"
          ? "يقوم النظام تلقائياً بتخزين المنتجات محلياً في متصفحك. عند انقطاع الإنترنت، يمكنك متابعة البيع وطباعة الإيصالات بشكل طبيعي. بمجرد عودة الاتصال، اضغط على زر 'مزامنة السحاب' لحفظ المبيعات في السيرفر فوراً."
          : "Le POS met automatiquement en cache vos articles. En cas de coupure Internet, vous pouvez continuer à enregistrer vos ventes et imprimer les tickets. Dès que la connexion revient, les ventes sont synchronisées avec le Cloud.",
    },
    {
      q: locale === "ar" ? "كيف يمكنني إرسال الفاتورة للعميل عبر WhatsApp؟" : "Comment partager une facture via WhatsApp ?",
      a:
        locale === "ar"
          ? "من شاشة الفواتير أو الإدارة المالية، اضغط على زر 'WhatsApp' بجانب أي فاتورة. ستظهر نافذة تتيح لك إدخال رقم هاتف العميل وفتح محادثة واتساب تحتوي على رابط الفاتورة الرقمية بنقرة واحدة."
          : "Dans la liste des factures ou la gestion financière, cliquez sur le bouton 'WhatsApp'. Le système prépare un message professionnel avec le lien de paiement et de consultation en ligne pour votre client.",
    },
    {
      q: locale === "ar" ? "كيف يتم تخصيص الشعار والختم الرسمي على الفاتورة؟" : "Comment ajouter le logo et le cachet sur mes factures ?",
      a:
        locale === "ar"
          ? "توجه إلى الإعدادات ثم 'استوديو هوية الفواتير (Branding & Facture)'. يمكنك اختيار لون الهوية التجارية وتفعيل الختم الرسمي ورمز QR للتحقق المالي المباشر."
          : "Rendez-vous dans Paramètres > Branding & Facture pour choisir votre palette de couleurs, afficher votre cachet officiel et activer le QR code de vérification.",
    },
    {
      q: locale === "ar" ? "هل يمكن للموظفين الوصول إلى بيانات مؤسسات أخرى؟" : "L'isolation des données entre entreprises est-elle garantie ?",
      a:
        locale === "ar"
          ? "نعم، 100%. النظام مصمم بتقنية Multi-Tenancy المتقدمة مع عزل صارم لقواعد البيانات وسياسات RLS، بحيث لا يمكن لأي مؤسسة الاطلاع على بيانات مؤسسة أخرى."
          : "Oui, la sécurité est totale grâce à l'architecture Multi-Tenancy et aux politiques RLS de Supabase. Chaque entreprise opère dans un espace hermétique et isolé.",
    },
  ];

  const handleOpenWhatsAppHotline = () => {
    const text = encodeURIComponent(
      locale === "ar"
        ? "مرحباً فريق دعم GestionPro Global! أحتاج إلى مساعدة في حسابي."
        : "Bonjour l'équipe support GestionPro Global ! J'ai besoin d'une assistance technique."
    );
    window.open(`https://wa.me/22790000000?text=${text}`, "_blank");
  };

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    setSubmitting(true);
    setTimeout(() => {
      const newTicket = {
        id: `TICK-${Math.floor(1000 + Math.random() * 9000)}`,
        subject: ticketSubject,
        category: ticketCategory,
        priority: ticketPriority,
        status: "Ouvert",
        date: "À l'instant",
      };

      setTickets([newTicket, ...tickets]);
      setTicketSubject("");
      setTicketMessage("");
      setSubmitting(false);
      setToastSuccess(true);
      setTimeout(() => setToastSuccess(false), 4000);
    }, 600);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastSuccess && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-in slide-in-from-top-3">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <div>
            <div className="text-xs font-black">
              {locale === "ar" ? "تم فتح تذكرة الدعم بنجاح!" : "Ticket de Support Créé !"}
            </div>
            <div className="text-[11px] text-slate-300">
              {locale === "ar" ? "سيقوم فريق الدعم الفني بالرد عليك في أقرب وقت." : "Notre équipe technique prend en charge votre demande."}
            </div>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <ShieldCheck size={14} />
                SUPPORT 24/7 ACTIF
              </span>
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1 bg-white/10 px-3 py-1 rounded-xl border border-white/15">
                <Clock size={12} className="text-amber-400" />
                Temps de réponse: &lt; 15 min
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "مركز الدعم الفني وخدمة العملاء" : "Centre de Support & Assistance"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "نحن هنا لمساعدتك على مدار الساعة عبر الدعم المباشر والتذاكر وقاعدة المعرفة"
                : "Nous vous accompagnons 24h/24 via assistance directe WhatsApp, tickets et base de connaissances"}
            </p>
          </div>

          <button
            onClick={handleOpenWhatsAppHotline}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer shrink-0"
          >
            <MessageSquare size={16} />
            <span>{locale === "ar" ? "محادثة واتساب فورية" : "WhatsApp Support Direct"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Submit Ticket + Live Ticket History + FAQ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Open Ticket Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSubmitTicket}
            className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Headphones size={20} className="text-indigo-600" />
              <h2 className="text-base font-black text-slate-900">
                {locale === "ar" ? "فتح تذكرة دعم فني جديدة" : "Créer un Ticket d'Assistance"}
              </h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === "ar" ? "قسم الاستفسار" : "Catégorie"}
              </label>
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Ventes & POS">Point de Vente & Ventes (POS)</option>
                <option value="Facturation & WhatsApp">Facturation & WhatsApp</option>
                <option value="Stock & Dépôts">Gestion des Stocks & Dépôts</option>
                <option value="Comptabilité & Finance">Comptabilité & Finance</option>
                <option value="Autre">Autre question technique</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === "ar" ? "درجة الأهمية" : "Priorité"}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Basse", "Normale", "Urgente"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTicketPriority(p)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      ticketPriority === p
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-black"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === "ar" ? "عنوان التذكرة" : "Sujet du Ticket"}
              </label>
              <input
                type="text"
                placeholder={locale === "ar" ? "مثال: استفسار عن ربط الطابعة الحرارية..." : "Ex: Problème d'impression ticket..."}
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === "ar" ? "تفاصيل الطلب أو المشكلة" : "Description détaillée"}
              </label>
              <textarea
                rows={4}
                placeholder={locale === "ar" ? "اشرح بالتفصيل ما ترغب في إنجازه..." : "Expliquez précisément votre besoin..."}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none resize-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !ticketSubject.trim() || !ticketMessage.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send size={15} />
              <span>{locale === "ar" ? "إرسال التذكرة" : "Soumettre le Ticket"}</span>
            </button>
          </form>

          {/* System Diagnostics Box */}
          <div className="bg-slate-900 text-white rounded-3xl p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold text-slate-400 flex items-center gap-1.5">
                <Laptop size={14} className="text-indigo-400" />
                Diagnostic Système
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 size={12} />
                Opérationnel
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400">Latence Cloud</span>
                <div className="font-black text-white mt-0.5">24 ms (Excellent)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400">Version Système</span>
                <div className="font-black text-indigo-300 mt-0.5">v4.0.0 Global SaaS</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: FAQ + Ticket List (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* FAQ Accordion */}
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle size={20} className="text-indigo-600" />
              <h2 className="text-base font-black text-slate-900">
                {locale === "ar" ? "الأسئلة الشائعة وقاعدة المعرفة" : "Foire Aux Questions (FAQ)"}
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((f, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200/80 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between font-bold text-xs text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span>{f.q}</span>
                    {openFaq === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {openFaq === idx && (
                    <div className="p-4 pt-0 text-xs text-slate-600 leading-relaxed font-medium bg-slate-50/50 border-t border-slate-100">
                      {f.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Ticket History */}
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <h2 className="text-base font-black text-slate-900">
              {locale === "ar" ? "سجل التذاكر الأخيرة" : "Mes Derniers Tickets"}
            </h2>

            <div className="space-y-3">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-indigo-600">{t.id}</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                        {t.category}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-1">{t.subject}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{t.date}</div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black ${
                      t.status === "Résolu"
                        ? "bg-emerald-100 text-emerald-700"
                        : t.status === "En cours"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
