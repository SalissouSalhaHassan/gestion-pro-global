"use client";

import { useState, useEffect } from "react";
import {
  X,
  Printer,
  Calendar,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Loader2,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  MessageSquare
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/context";
import { generateDevisWhatsAppMessage, openWhatsAppDirect } from "@/lib/utils/whatsapp";

type DevisModalProps = {
  devisId: number;
  onClose: () => void;
  onConverted?: () => void;
};

export default function DevisModal({
  devisId,
  onClose,
  onConverted,
}: DevisModalProps) {
  const { locale, dir } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [conversionSuccess, setConversionSuccess] = useState<string | null>(null);

  const fetchDevis = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/devis/${devisId}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load devis", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevis();
  }, [devisId]);

  const handlePrint = () => {
    window.print();
  };

  const handleConvert = async () => {
    if (!confirm(locale === "ar" ? "هل تريد تحويل عرض السعر هذا إلى فاتورة مبيعات حقيقية وخصم الكميات من المخزون؟" : "Convertir ce devis en facture définitive ? Les stocks seront réajustés.")) return;

    try {
      setConverting(true);
      const res = await fetch(`/api/devis/${devisId}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de la conversion");

      setConversionSuccess(json.message);
      if (onConverted) onConverted();
      fetchDevis();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setConverting(false);
    }
  };

  const handleWhatsAppSend = () => {
    const phone = devis?.client_tel || devis?.clients?.tel || "";
    if (!phone) {
      alert(locale === "ar" ? "لا يوجد رقم هاتف مسجل لهذا العميل." : "Aucun numéro de téléphone enregistré pour ce client.");
      return;
    }

    const message = generateDevisWhatsAppMessage({
      companyName: company?.nom_entreprise || "GESTION PRO GLOBAL",
      devisNumber: devis?.numero_devis || "DEVIS",
      clientName: devis?.client_nom || "Client",
      totalTTC: Number(devis?.total_ttc) || 0,
      dateDevis: devis?.date_devis || new Date().toISOString().split("T")[0],
      dateValidite: devis?.date_validite || undefined,
      items: items.map((it: any) => ({
        description: it.description || it.reference || "Article",
        qte: Number(it.qte) || 1,
        total_ligne_ttc: Number(it.total_ligne_ttc || it.total_ligne_ht) || 0,
      })),
      locale: locale as any,
    });

    openWhatsAppDirect(phone, message);
  };

  const devis = data?.devis;
  const company = data?.company;
  const items = devis?.devis_items || [];
  const isConverted = devis?.statut === "Converti";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none font-sans" dir={dir}>
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all print:border-none print:shadow-none print:max-w-full">
        {/* Top Header Bar (Hidden on Print) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                {devis?.numero_devis || "DEVIS PROFORMA"}
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                  isConverted
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                }`}>
                  {isConverted ? (locale === "ar" ? "تم التحويل لفاتورة" : "CONVERTI EN FACTURE") : (locale === "ar" ? "عرض سعر رسمي" : "DEVIS PROFORMA")}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Client : <span className="text-white font-bold">{devis?.client_nom}</span> • Date: {devis?.date_devis}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {!isConverted && (
              <button
                onClick={handleConvert}
                disabled={converting || loading}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {converting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{locale === "ar" ? "تحويل إلى فاتورة بيع" : "Convertir en Facture"}</span>
              </button>
            )}

            <button
              onClick={handleWhatsAppSend}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Envoyer le devis sur WhatsApp"
            >
              <MessageSquare size={15} />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer size={15} />
              <span>{locale === "ar" ? "طباعة A4" : "Imprimer A4"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {conversionSuccess && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-black flex items-center gap-2 print:hidden">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{conversionSuccess}</span>
          </div>
        )}

        {/* Modal Body / A4 Printable Document */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[78vh] print:max-h-none print:overflow-visible print:p-0">
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
              <p className="font-bold text-xs text-slate-500">
                {locale === "ar" ? "جاري تحميل عرض السعر..." : "Chargement du devis..."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
                {/* Company Info */}
                <div className="space-y-1 text-xs">
                  <h2 className="text-base font-black text-slate-900 uppercase">
                    {company?.nom_entreprise || "GESTION PRO GLOBAL"}
                  </h2>
                  <p className="text-slate-600 font-medium">{company?.adresse || "Niamey, Niger"}</p>
                  <p className="text-slate-500">
                    Tél : <span className="font-bold">{company?.telephone || "+227 00 00 00 00"}</span>
                  </p>
                  {company?.nif && (
                    <p className="text-slate-500">
                      NIF : <span className="font-bold">{company?.nif}</span> • RC : <span className="font-bold">{company?.rc || "N/A"}</span>
                    </p>
                  )}
                </div>

                {/* Client & Document Info Box */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1 min-w-[260px]">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">DEVIS / PROFORMA</span>
                    <span className="font-mono font-black text-slate-900">{devis?.numero_devis}</span>
                  </div>
                  <p className="text-slate-500">Client : <span className="font-black text-slate-900">{devis?.client_nom}</span></p>
                  {devis?.client_tel && <p className="text-slate-500">Tél : <span className="font-bold">{devis?.client_tel}</span></p>}
                  {devis?.client_adresse && <p className="text-slate-500">{devis?.client_adresse}</p>}
                  <p className="text-slate-500 pt-1">Date d'émission : <span className="font-bold">{devis?.date_devis}</span></p>
                  {devis?.date_validite && (
                    <p className="text-rose-600 font-bold">Validité jusqu'au : {devis?.date_validite}</p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-3">{locale === "ar" ? "الصنف والوصف" : "Désignation & Réf."}</th>
                      <th className="px-4 py-3 text-center">{locale === "ar" ? "الكمية" : "Qté"}</th>
                      <th className="px-4 py-3 text-right">{locale === "ar" ? "سعر الوحدة" : "P.U HT"}</th>
                      <th className="px-4 py-3 text-right">{locale === "ar" ? "الخصم" : "Remise"}</th>
                      <th className="px-4 py-3 text-right">{locale === "ar" ? "الإجمالي" : "Total HT"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="font-bold text-slate-900 block">{it.description}</span>
                          {it.reference && <span className="text-[10px] font-mono text-slate-400">{it.reference}</span>}
                        </td>
                        <td className="px-4 py-3 text-center font-black text-slate-700">{it.qte}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                          {formatCurrencyAmount(it.pu_ht, "FCFA")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-500">
                          {it.remise_pourcentage > 0 ? `${it.remise_pourcentage}%` : "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                          {formatCurrencyAmount(it.total_ligne_ht, "FCFA")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                      <td colSpan={4} className="px-4 py-2 text-right uppercase text-[10px] text-slate-500">Total HT :</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-900">{formatCurrencyAmount(devis?.total_ht || 0, "FCFA")}</td>
                    </tr>
                    {Number(devis?.total_tva || 0) > 0 && (
                      <tr className="bg-slate-50 font-bold">
                        <td colSpan={4} className="px-4 py-2 text-right uppercase text-[10px] text-slate-500">TVA :</td>
                        <td className="px-4 py-2 text-right font-mono text-slate-900">{formatCurrencyAmount(devis?.total_tva || 0, "FCFA")}</td>
                      </tr>
                    )}
                    <tr className="bg-indigo-50/50 border-t-2 border-indigo-200 font-black text-sm">
                      <td colSpan={4} className="px-4 py-3 text-right uppercase text-indigo-900">TOTAL NET À PAYER (TTC) :</td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-900">{formatCurrencyAmount(devis?.total_ttc || 0, "FCFA")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notes & Terms */}
              {devis?.notes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="font-bold block text-[10px] uppercase text-slate-500 mb-1">Conditions & Modalités :</span>
                  <p className="text-slate-700">{devis.notes}</p>
                </div>
              )}

              {/* Acceptance & Signatures */}
              <div className="pt-8 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-xs text-center">
                <div>
                  <p className="font-black mb-12 uppercase text-slate-700">Pour la Société (Service Commercial)</p>
                  <div className="border-t border-slate-300 pt-1 text-[10px] text-slate-400">Signature & Cachet</div>
                </div>
                <div>
                  <p className="font-black mb-12 uppercase text-slate-700">Bon pour Accord & Commande (Le Client)</p>
                  <div className="border-t border-slate-300 pt-1 text-[10px] text-slate-400">Date, Signature & Mention manuscrite</div>
                </div>
              </div>

              <div className="text-center pt-2 text-[8px] text-slate-400">
                Devis proforma généré par Gestion Pro Global • Validité soumise à confirmation
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
