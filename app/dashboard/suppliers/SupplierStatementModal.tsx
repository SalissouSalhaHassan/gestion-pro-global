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
  Scale,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Filter
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/context";

type SupplierStatementModalProps = {
  supplierId: number;
  onClose: () => void;
};

export default function SupplierStatementModal({
  supplierId,
  onClose,
}: SupplierStatementModalProps) {
  const { locale, dir } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchStatement = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/suppliers/${supplierId}/statement`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Failed to load supplier statement", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [supplierId]);

  const handlePrint = () => {
    window.print();
  };

  // Filter ledger lines by date if selected
  const filteredLedger = (data?.ledger || []).filter((item: any) => {
    if (startDate && item.date < startDate) return false;
    if (endDate && item.date > endDate) return false;
    return true;
  });

  const totalFilteredDebit = filteredLedger.reduce((sum: number, i: any) => sum + (Number(i.debit) || 0), 0);
  const totalFilteredCredit = filteredLedger.reduce((sum: number, i: any) => sum + (Number(i.credit) || 0), 0);
  const filteredBalance = totalFilteredDebit - totalFilteredCredit;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none font-sans" dir={dir}>
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col transition-all print:border-none print:shadow-none print:max-w-full">
        {/* Modal Top Header (Hidden on Print) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                {locale === "ar" ? "كشف حساب المورد" : "Relevé de Compte Fournisseur"}
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  OFFICIEL A4
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                {data?.supplier?.nom || "Fournisseur"} • Réf: {data?.supplier?.ref_fournisseur || "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer size={15} />
              <span>{locale === "ar" ? "طباعة الكشف A4" : "Imprimer Relevé"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Date Filters Bar (Hidden on Print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 text-xs">
            <Filter size={14} className="text-slate-400" />
            <span className="font-bold text-slate-600">{locale === "ar" ? "تصفية الفترة:" : "Période :"}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                {locale === "ar" ? "إعادة ضبط" : "Réinitialiser"}
              </button>
            )}
          </div>

          <div className="text-xs font-bold text-slate-500">
            {filteredLedger.length} {locale === "ar" ? "عملية مسجلة" : "opérations"}
          </div>
        </div>

        {/* Modal Body / Official A4 Printable Area */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[75vh] print:max-h-none print:overflow-visible print:p-0">
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
              <p className="font-bold text-xs text-slate-500">
                {locale === "ar" ? "جاري استخراج كشف حساب المورد وحساب الفروقات..." : "Génération du relevé fournisseur..."}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Official Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
                {/* Company Info */}
                <div className="space-y-1 text-xs">
                  <h2 className="text-base font-black text-slate-900 uppercase">
                    {data?.company?.nom_entreprise || "GESTION PRO GLOBAL"}
                  </h2>
                  <p className="text-slate-600 font-medium">{data?.company?.adresse || "Niamey, Niger"}</p>
                  <p className="text-slate-500">
                    Tél: <span className="font-bold">{data?.company?.telephone || "+227 00 00 00 00"}</span>
                  </p>
                  {data?.company?.nif && (
                    <p className="text-slate-500">
                      NIF: <span className="font-bold">{data?.company?.nif}</span> • RC: <span className="font-bold">{data?.company?.rc || "N/A"}</span>
                    </p>
                  )}
                </div>

                {/* Supplier Info Box */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1 min-w-[240px]">
                  <span className="text-[10px] font-black uppercase text-indigo-600 block tracking-wider">
                    {locale === "ar" ? "بيانات المورد" : "COMPTE FOURNISSEUR"}
                  </span>
                  <p className="font-black text-sm text-slate-900">{data?.supplier?.nom}</p>
                  <p className="text-slate-500 font-medium">Réf: <span className="font-mono font-bold">{data?.supplier?.ref_fournisseur}</span></p>
                  {data?.supplier?.tel && <p className="text-slate-500">Tél: <span className="font-bold">{data?.supplier?.tel}</span></p>}
                  {data?.supplier?.adresse && <p className="text-slate-500">{data?.supplier?.adresse}</p>}
                </div>
              </div>

              {/* Title Ribbon */}
              <div className="py-2.5 px-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest">
                  {locale === "ar" ? "كشف حساب المورد التفصيلي" : "RELEVÉ DE COMPTE CHRONOLOGIQUE"}
                </span>
                <span className="text-[11px] font-bold text-slate-300">
                  {locale === "ar" ? "بتاريخ:" : "Au :"} {new Date().toLocaleDateString("fr-FR")}
                </span>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    {locale === "ar" ? "إجمالي الفواتير (شراء)" : "Total Facturé (Débit)"}
                  </span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {formatCurrencyAmount(totalFilteredDebit, "FCFA")}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    {locale === "ar" ? "إجمالي المسدد (دفعات)" : "Total Réglé (Crédit)"}
                  </span>
                  <span className="text-base font-black text-emerald-600 font-mono">
                    {formatCurrencyAmount(totalFilteredCredit, "FCFA")}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">
                    {locale === "ar" ? "الرصيد المتبقي للمورد" : "Solde Restant Dû"}
                  </span>
                  <span className={`text-base font-black font-mono ${filteredBalance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {formatCurrencyAmount(filteredBalance, "FCFA")}
                  </span>
                </div>
              </div>

              {/* Chronological Ledger Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-3">{locale === "ar" ? "التاريخ" : "Date"}</th>
                      <th className="px-4 py-3">{locale === "ar" ? "المرجع" : "Réf. Pièce"}</th>
                      <th className="px-4 py-3">{locale === "ar" ? "نوع العملية" : "Opération"}</th>
                      <th className="px-4 py-3 text-right">{locale === "ar" ? "شراء (مدين)" : "Débit (+)"}</th>
                      <th className="px-4 py-3 text-right">{locale === "ar" ? "سداد (دائن)" : "Crédit (-)"}</th>
                      <th className="px-4 py-3 text-right">{locale === "ar" ? "الرصيد التراكمي" : "Solde Dû"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLedger.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                          {locale === "ar" ? "لا توجد حركات مسجلة لهذا المورد في هذه الفترة." : "Aucune opération enregistrée sur cette période."}
                        </td>
                      </tr>
                    ) : (
                      filteredLedger.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-500 font-medium">
                            {new Date(item.date).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="px-4 py-3 font-mono font-black text-slate-800">
                            {item.ref}
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-semibold">
                            <span>{item.type}</span>
                            {item.notes && <span className="block text-[10px] text-slate-400">{item.notes}</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {item.debit > 0 ? formatCurrencyAmount(item.debit, "FCFA") : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                            {item.credit > 0 ? formatCurrencyAmount(item.credit, "FCFA") : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-slate-900">
                            {formatCurrencyAmount(item.solde, "FCFA")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredLedger.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-black text-xs">
                        <td colSpan={3} className="px-4 py-3 uppercase">
                          {locale === "ar" ? "المجموع الكلي للفترة" : "TOTAUX DE LA PÉRIODE"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-900">
                          {formatCurrencyAmount(totalFilteredDebit, "FCFA")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-600">
                          {formatCurrencyAmount(totalFilteredCredit, "FCFA")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-rose-600">
                          {formatCurrencyAmount(filteredBalance, "FCFA")}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Signatures Area */}
              <div className="pt-8 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-xs text-center">
                <div>
                  <p className="font-black mb-12 uppercase text-slate-700">
                    {locale === "ar" ? "تأشيرة قسم المشتريات / المحاسبة" : "Visa Responsable Achats / Comptabilité"}
                  </p>
                  <div className="border-t border-slate-300 pt-1 text-[10px] text-slate-400">
                    Signature & Cachet
                  </div>
                </div>
                <div>
                  <p className="font-black mb-12 uppercase text-slate-700">
                    {locale === "ar" ? "تأشيرة وختم المورد" : "Visa & Cachet du Fournisseur"}
                  </p>
                  <div className="border-t border-slate-300 pt-1 text-[10px] text-slate-400">
                    Pour Accord
                  </div>
                </div>
              </div>

              <div className="text-center pt-2 text-[9px] text-slate-400">
                Document officiel généré par Gestion Pro Global v2.0 • Système Intégré de Gestion ERP
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
