"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import {
  Palette,
  Image as ImageIcon,
  Stamp,
  QrCode,
  FileText,
  Save,
  CheckCircle2,
  Building2,
  Sparkles,
  Eye,
  Sliders,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

export default function InvoiceBrandingPage() {
  const { t, locale, dir } = useLanguage();
  const [companyName, setCompanyName] = useState("GESTION PRO GLOBAL");
  const [subtitle, setSubtitle] = useState("Commerce Général & Import-Export");
  const [phone, setPhone] = useState("+227 90 00 00 00");
  const [email, setEmail] = useState("contact@gestionpro.com");
  const [address, setAddress] = useState("Niamey, Niger - Boulevard Mali Béro");
  const [rccm, setRccm] = useState("RCCM-NI-NIA-2026-B-001");
  const [nif, setNif] = useState("NIF: 12345/P");

  const [footerNote, setFooterNote] = useState("Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 48h.");
  const [brandColor, setBrandColor] = useState("#4f46e5");
  const [showQrCode, setShowQrCode] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  
  const [savedToast, setSavedToast] = useState(false);

  const colors = [
    { name: "Indigo Classic", hex: "#4f46e5" },
    { name: "Emerald Pro", hex: "#059669" },
    { name: "Ocean Blue", hex: "#0284c7" },
    { name: "Ruby Premium", hex: "#e11d48" },
    { name: "Dark Slate", hex: "#0f172a" },
    { name: "Gold Luxury", hex: "#d97706" },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3500);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast */}
      {savedToast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-3 animate-in slide-in-from-top-3">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <div>
            <div className="text-xs font-black">
              {locale === "ar" ? "تم حفظ هوية الفاتورة بنجاح" : "Identité Visuelle Enregistrée"}
            </div>
            <div className="text-[11px] text-slate-300">
              {locale === "ar" ? "سيتم تطبيق الشعار والألوان على الفواتير المطبوعة والرقمية فوراً." : "Appliquée à toutes vos factures PDF et tickets."}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider">
              BRANDING & IMPRESSION
            </span>
            <span className="text-xs font-bold text-slate-500">
              {locale === "ar" ? "تخصيص الشعار، الختم وألوان الفاتورة" : "Personnalisation du modèle de facture et reçu"}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Palette className="text-indigo-600" size={32} />
            {locale === "ar" ? "استوديو هوية الفواتير والختم الرسمي" : "Studio d'Identité des Factures"}
          </h1>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Save size={15} />
          <span>{locale === "ar" ? "حفظ التخصيص" : "Enregistrer le Modèle"}</span>
        </button>
      </div>

      {/* Main Grid: Form Controls + Live Interactive Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Sliders size={18} className="text-indigo-600" />
              {locale === "ar" ? "خيارات التخصيص" : "Paramètres de Présentation"}
            </h2>

            {/* Brand Colors */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                {locale === "ar" ? "لون العلامة التجارية الأساسي" : "Couleur Principale du Thème"}
              </label>
              <div className="grid grid-cols-6 gap-2">
                {colors.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setBrandColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center text-white ${
                      brandColor === c.hex ? "ring-4 ring-indigo-500/30 scale-105" : "opacity-80 hover:opacity-100"
                    }`}
                    title={c.name}
                  >
                    {brandColor === c.hex && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Company Info */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "اسم الشركة التجاري" : "Nom de l'Entreprise"}
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "النشاط / العنوان الفرعي" : "Activité / Slogan"}
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">RCCM</label>
                  <input
                    type="text"
                    value={rccm}
                    onChange={(e) => setRccm(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">NIF</label>
                  <input
                    type="text"
                    value={nif}
                    onChange={(e) => setNif(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "ملاحظة وتذييل الفاتورة" : "Pied de page / Conditions de vente"}
                </label>
                <textarea
                  rows={3}
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 cursor-pointer">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <Stamp size={16} className="text-indigo-600" />
                  {locale === "ar" ? "إظهار الختم والتوقيع الرسمي" : "Afficher le Cachet & Signature"}
                </span>
                <input
                  type="checkbox"
                  checked={showStamp}
                  onChange={(e) => setShowStamp(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 cursor-pointer">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <QrCode size={16} className="text-indigo-600" />
                  {locale === "ar" ? "إظهار رمز QR للتحقق المالي" : "Afficher le QR Code de Vérification"}
                </span>
                <input
                  type="checkbox"
                  checked={showQrCode}
                  onChange={(e) => setShowQrCode(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600"
                />
              </label>
            </div>
          </form>
        </div>

        {/* Right Live Interactive Invoice Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Eye size={16} className="text-indigo-600" />
              {locale === "ar" ? "معاينة حية ومباشرة للنموذج A4" : "Aperçu en Direct (Format A4 & PDF)"}
            </span>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              Live Render
            </span>
          </div>

          {/* Paper Sheet Simulator */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 text-slate-900 space-y-6">
            {/* Header Ribbon */}
            <div
              className="p-6 rounded-2xl text-white flex items-center justify-between"
              style={{ backgroundColor: brandColor }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-black text-sm">
                    GP
                  </div>
                  <h3 className="font-black text-lg text-white">{companyName}</h3>
                </div>
                <p className="text-xs text-white/80 mt-0.5">{subtitle}</p>
                <div className="text-[10px] text-white/70 mt-1 space-x-2">
                  <span>{rccm}</span>
                  <span>•</span>
                  <span>{nif}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-extrabold uppercase tracking-wider text-white/80">FACTURE</div>
                <div className="text-xl font-black text-white font-mono">#FAC-2026-089</div>
                <div className="text-[11px] text-white/80 mt-0.5">Date: {new Date().toLocaleDateString("fr-FR")}</div>
              </div>
            </div>

            {/* Bill To Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-extrabold text-slate-400 uppercase text-[10px]">Facturé à :</span>
                <div className="font-black text-slate-900 text-sm mt-0.5">ETS AL-BARAKA & CIE</div>
                <div className="text-slate-500 mt-0.5">Client Partenaire • Niamey</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-right">
                <span className="font-extrabold text-slate-400 uppercase text-[10px]">Émetteur :</span>
                <div className="font-bold text-slate-700 mt-0.5">{address}</div>
                <div className="text-slate-500 mt-0.5">{phone} • {email}</div>
              </div>
            </div>

            {/* Items Table Mockup */}
            <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 font-black text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Désignation</th>
                    <th className="py-2.5 px-3 text-center">Qté</th>
                    <th className="py-2.5 px-3 text-right">P.U TTC</th>
                    <th className="py-2.5 px-3 text-right">Total TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  <tr>
                    <td className="py-2.5 px-3 font-bold">Ciment Dangote 42.5R (Tonne)</td>
                    <td className="py-2.5 px-3 text-center font-bold">10</td>
                    <td className="py-2.5 px-3 text-right">85 000 FCFA</td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">850 000 FCFA</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold">Fer à Béton FeE500 12mm</td>
                    <td className="py-2.5 px-3 text-center font-bold">25</td>
                    <td className="py-2.5 px-3 text-right">4 200 FCFA</td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">105 000 FCFA</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Row */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total HT :</span>
                  <span className="font-bold">802 521 FCFA</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>TVA (19%) :</span>
                  <span className="font-bold">152 479 FCFA</span>
                </div>
                <div
                  className="flex justify-between text-sm font-black p-2.5 rounded-xl text-white mt-2"
                  style={{ backgroundColor: brandColor }}
                >
                  <span>TOTAL TTC :</span>
                  <span>955 000 FCFA</span>
                </div>
              </div>
            </div>

            {/* Stamp + QR Code + Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs">
              <div className="max-w-xs text-[11px] text-slate-500">
                {footerNote}
              </div>

              <div className="flex items-center gap-4">
                {showQrCode && (
                  <div className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 text-center">
                    <QrCode size={40} className="text-slate-800" />
                    <span className="text-[8px] font-bold text-slate-400 block">Vérifié SSL</span>
                  </div>
                )}

                {showStamp && (
                  <div
                    className="w-24 h-20 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center rotate-[-6deg]"
                    style={{ borderColor: brandColor, color: brandColor }}
                  >
                    <span className="text-[9px] font-black uppercase">{companyName.slice(0, 14)}</span>
                    <span className="text-[8px] font-extrabold uppercase">CACHET OFFICIEL</span>
                    <span className="text-[7px] font-bold">NIAMEY - NIGER</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
