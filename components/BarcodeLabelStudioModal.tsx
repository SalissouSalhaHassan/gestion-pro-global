"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Barcode as BarcodeIcon,
  Printer,
  X,
  Sparkles,
  Layers,
  Settings2,
  Check,
  Package,
  FileSpreadsheet,
  Tag,
  DollarSign,
  Building2
} from "lucide-react";
import Barcode from "react-barcode";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { useLanguage } from "@/lib/i18n/context";

export type LabelArticle = {
  id: string | number;
  reference: string;
  code_barre: string | null;
  designation: string;
  p_vente_ttc: number;
  stock_total?: number;
  famille?: string | null;
};

type LabelFormat = "thermal_50x30" | "thermal_40x20" | "a4_sheet_24" | "shelf_tag";

interface BarcodeLabelStudioModalProps {
  articles: LabelArticle[];
  companyName?: string;
  onClose: () => void;
}

export default function BarcodeLabelStudioModal({
  articles,
  companyName = "GESTION PRO GLOBAL",
  onClose,
}: BarcodeLabelStudioModalProps) {
  const { locale, dir } = useLanguage();

  // Selected format
  const [format, setFormat] = useState<LabelFormat>("thermal_50x30");

  // Options
  const [showCompanyName, setShowCompanyName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showReference, setShowReference] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [companyTitle, setCompanyTitle] = useState(companyName);

  // Quantities per article { [articleId]: count }
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    articles.forEach((a) => {
      initial[String(a.id)] = 1;
    });
    return initial;
  });

  // Current preview article
  const [previewArticleId, setPreviewArticleId] = useState<string | number>(
    articles[0]?.id || ""
  );

  const activeArticle =
    articles.find((a) => String(a.id) === String(previewArticleId)) || articles[0];

  // Set uniform quantity
  const handleSetAllQuantity = (qty: number) => {
    const updated: Record<string, number> = {};
    articles.forEach((a) => {
      updated[String(a.id)] = qty;
    });
    setQuantities(updated);
  };

  // Set quantity from stock
  const handleSetFromStock = () => {
    const updated: Record<string, number> = {};
    articles.forEach((a) => {
      updated[String(a.id)] = Math.max(1, Math.min(a.stock_total || 1, 100));
    });
    setQuantities(updated);
  };

  const totalLabelsCount = Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);

  // Hidden print container ref
  const printContainerRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printContainerRef.current) return;

    const printWindow = window.open("", "_blank", "width=850,height=900");
    if (!printWindow) {
      alert(locale === "ar" ? "يرجى السماح بالنوافذ المنبثقة للطباعة." : "Veuillez autoriser les fenêtres pop-up pour l'impression.");
      return;
    }

    let pageCss = "";
    if (format === "thermal_50x30") {
      pageCss = `@page { size: 50mm 30mm; margin: 0; } body { margin: 0; padding: 0; } .label-card { width: 50mm; height: 30mm; page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 2mm 3mm; font-family: sans-serif; text-align: center; }`;
    } else if (format === "thermal_40x20") {
      pageCss = `@page { size: 40mm 20mm; margin: 0; } body { margin: 0; padding: 0; } .label-card { width: 40mm; height: 20mm; page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; padding: 1.5mm 2mm; font-family: sans-serif; text-align: center; }`;
    } else if (format === "shelf_tag") {
      pageCss = `@page { size: 65mm 40mm; margin: 0; } body { margin: 0; padding: 0; } .label-card { width: 65mm; height: 40mm; page-break-after: always; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; padding: 3mm 4mm; font-family: sans-serif; border: 1px dashed #333; }`;
    } else {
      // a4_sheet_24
      pageCss = `@page { size: A4 portrait; margin: 8mm 6mm; } body { margin: 0; padding: 0; font-family: sans-serif; } .a4-grid { display: grid; grid-template-columns: repeat(3, 1fr); grid-gap: 2.5mm; box-sizing: border-box; } .label-card { border: 1px dotted #ccc; border-radius: 4px; height: 33.8mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; box-sizing: border-box; text-align: center; page-break-inside: avoid; }`;
    }

    const contentHtml = printContainerRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impression Étiquettes Barcode - Gestion Pro Global</title>
          <style>
            ${pageCss}
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .comp-name { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: #1e293b; margin-bottom: 1px; }
            .art-name { font-size: 9px; font-weight: 800; color: #0f172a; line-height: 1.1; max-height: 20px; overflow: hidden; margin-bottom: 2px; }
            .art-price { font-size: 13px; font-weight: 900; color: #000; margin-top: 2px; }
            .shelf-price { font-size: 20px; font-weight: 900; color: #000; letter-spacing: -0.5px; }
            .ref-txt { font-size: 7px; color: #64748b; font-family: monospace; }
            svg { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          ${format === "a4_sheet_24" ? `<div class="a4-grid">${contentHtml}</div>` : contentHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto font-sans animate-in fade-in duration-200"
      dir={dir}
    >
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Hero Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <BarcodeIcon size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">
                  {locale === "ar" ? "استوديو طباعة الباركود والملصقات 4K" : "Studio d'Impression de Codes-Barres & Étiquettes"}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black">
                  {articles.length} {locale === "ar" ? "صنف" : "article(s)"} • {totalLabelsCount} {locale === "ar" ? "ملصق إجمالي" : "étiquette(s)"}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {locale === "ar"
                  ? "توليد ملصقات احترافية للطابعات الحرارية وصفحات A4 مع السعر بالفرنك الإفريقي"
                  : "Formats thermiques Xprinter/Zebra et planches A4 autocollantes avec prix en FCFA"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Main Content (2 Columns) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-50/50">
          {/* Left Column: Settings & Article List (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Format Selection Card */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={15} className="text-indigo-600" />
                <span>{locale === "ar" ? "تنسيق وحجم الملصق" : "Format & Support d'Impression"}</span>
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setFormat("thermal_50x30")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    format === "thermal_50x30"
                      ? "bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs">50 × 30 mm</span>
                    {format === "thermal_50x30" && <Check size={14} className="text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">
                    {locale === "ar" ? "طابعة حرارية فردية (Standard)" : "Thermique Standard (Rouleau)"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat("thermal_40x20")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    format === "thermal_40x20"
                      ? "bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs">40 × 20 mm</span>
                    {format === "thermal_40x20" && <Check size={14} className="text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">
                    {locale === "ar" ? "طابعة حرارية مدمجة" : "Thermique Compacte"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat("a4_sheet_24")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    format === "a4_sheet_24"
                      ? "bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs">Planche A4 (24x)</span>
                    {format === "a4_sheet_24" && <Check size={14} className="text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">
                    {locale === "ar" ? "ورق A4 لاصق (طابعات عادية)" : "Feuille Autocollante (Grille 3×8)"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat("shelf_tag")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    format === "shelf_tag"
                      ? "bg-indigo-50/70 border-indigo-600 text-indigo-950 shadow-xs ring-1 ring-indigo-600"
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs">Rayon / Gondole</span>
                    {format === "shelf_tag" && <Check size={14} className="text-indigo-600" />}
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-1">
                    {locale === "ar" ? "ملصق الرف مع سعر كبير" : "Gondole 65×40 mm (Grand Prix)"}
                  </span>
                </button>
              </div>
            </div>

            {/* Customization Options */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 size={15} className="text-indigo-600" />
                <span>{locale === "ar" ? "خيارات ومحتوى الملصق" : "Éléments Visuels du Sticker"}</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showCompanyName}
                    onChange={(e) => setShowCompanyName(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <span>{locale === "ar" ? "اسم المتجر / الشركة" : "Nom de l'Entreprise"}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <span>{locale === "ar" ? "سعر البيع TTC" : "Prix de Vente TTC"}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showReference}
                    onChange={(e) => setShowReference(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <span>{locale === "ar" ? "المرجع (SKU / Réf)" : "Référence / SKU"}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={showBarcodeText}
                    onChange={(e) => setShowBarcodeText(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <span>{locale === "ar" ? "أرقام الباركود المقروءة" : "Texte du Code-barres"}</span>
                </label>
              </div>

              {showCompanyName && (
                <div className="pt-2">
                  <input
                    type="text"
                    value={companyTitle}
                    onChange={(e) => setCompanyTitle(e.target.value)}
                    placeholder="Nom affiché sur l'étiquette"
                    className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Articles Table & Quantities */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package size={15} className="text-indigo-600" />
                  <span>{locale === "ar" ? "قائمة الأصناف والكميات" : "Articles & Nombre d'Exemplaires"}</span>
                </label>

                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSetAllQuantity(1)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                  >
                    1x
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllQuantity(5)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                  >
                    5x
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllQuantity(10)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                  >
                    10x
                  </button>
                  <button
                    type="button"
                    onClick={handleSetFromStock}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer"
                    title="Ajuster la quantité selon le stock"
                  >
                    {locale === "ar" ? "حسب المخزون" : "Selon Stock"}
                  </button>
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                {articles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setPreviewArticleId(art.id)}
                    className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      String(art.id) === String(previewArticleId)
                        ? "bg-indigo-50/60"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{art.designation}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {art.code_barre || art.reference} • {formatCurrencyAmount(art.p_vente_ttc)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] font-bold text-slate-400">Qté:</span>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={quantities[String(art.id)] ?? 1}
                        onChange={(e) =>
                          setQuantities({
                            ...quantities,
                            [String(art.id)]: Math.max(0, parseInt(e.target.value) || 0),
                          })
                        }
                        className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-center font-mono font-bold text-xs bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>{locale === "ar" ? "معاينة الملصق المباشرة" : "Aperçu de l'Étiquette"}</span>
                </span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {format === "thermal_50x30"
                    ? "50 × 30 mm"
                    : format === "thermal_40x20"
                    ? "40 × 20 mm"
                    : format === "shelf_tag"
                    ? "65 × 40 mm"
                    : "Planche A4"}
                </span>
              </div>

              {/* Dynamic Sticker Mockup */}
              <div className="flex-1 flex items-center justify-center p-6 bg-slate-100/70 rounded-2xl my-4 border border-dashed border-slate-300">
                {activeArticle ? (
                  <div
                    className={`bg-white rounded-lg shadow-xl border border-slate-200 p-3 flex flex-col items-center justify-between text-center transition-all ${
                      format === "thermal_40x20"
                        ? "w-48 h-28 p-2"
                        : format === "shelf_tag"
                        ? "w-72 h-44 p-4 border-2 border-slate-800"
                        : "w-60 h-36 p-3"
                    }`}
                  >
                    {showCompanyName && (
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 truncate max-w-full">
                        {companyTitle}
                      </span>
                    )}

                    <div className="w-full">
                      <span className="text-xs font-black text-slate-900 line-clamp-1 block leading-tight">
                        {activeArticle.designation}
                      </span>
                      {showReference && (
                        <span className="text-[8px] font-mono text-slate-400 block mt-0.5">
                          Réf: {activeArticle.reference}
                        </span>
                      )}
                    </div>

                    {/* Barcode Render */}
                    <div className="w-full flex justify-center py-1">
                      <Barcode
                        value={activeArticle.code_barre || activeArticle.reference}
                        width={format === "thermal_40x20" ? 1.2 : 1.5}
                        height={format === "thermal_40x20" ? 28 : format === "shelf_tag" ? 38 : 34}
                        fontSize={format === "thermal_40x20" ? 9 : 11}
                        displayValue={showBarcodeText}
                        margin={0}
                      />
                    </div>

                    {showPrice && (
                      <div className="w-full pt-1 border-t border-slate-100">
                        {format === "shelf_tag" ? (
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-xl font-black text-slate-950 font-mono">
                              {formatCurrencyAmount(activeArticle.p_vente_ttc)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-black text-slate-950 font-mono">
                            {formatCurrencyAmount(activeArticle.p_vente_ttc)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 font-bold">Aucun article sélectionné</p>
                )}
              </div>

              {/* Summary info box */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{locale === "ar" ? "الأصناف المحددة :" : "Articles traités :"}</span>
                  <span className="text-slate-900">{articles.length}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>{locale === "ar" ? "إجمالي الملصقات المزمع طباعتها :" : "Total d'étiquettes à sortir :"}</span>
                  <span className="text-indigo-600 font-black">{totalLabelsCount}</span>
                </div>
                {format === "a4_sheet_24" && (
                  <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    <span>Pages A4 nécessaires :</span>
                    <span className="font-bold">{Math.ceil(totalLabelsCount / 24)} page(s)</span>
                  </div>
                )}
              </div>

              {/* Launch Print Button */}
              <div className="pt-4 mt-auto">
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={totalLabelsCount === 0}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm shadow-xl shadow-indigo-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  <Printer size={18} />
                  <span>
                    {locale === "ar"
                      ? `طباعة ${totalLabelsCount} ملصق الآن`
                      : `Lancer l'Impression (${totalLabelsCount} étiquettes)`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden container for rendering HTML printable cards for the popup window */}
      <div className="hidden">
        <div ref={printContainerRef}>
          {articles.flatMap((art) => {
            const count = quantities[String(art.id)] || 0;
            return Array.from({ length: count }).map((_, idx) => (
              <div key={`${art.id}-${idx}`} className="label-card">
                {showCompanyName && <div className="comp-name">{companyTitle}</div>}
                <div className="art-name">{art.designation}</div>
                {showReference && <div className="ref-txt">REF: {art.reference}</div>}
                <div style={{ margin: "2px 0" }}>
                  <Barcode
                    value={art.code_barre || art.reference}
                    width={format === "thermal_40x20" ? 1.1 : 1.4}
                    height={format === "thermal_40x20" ? 25 : format === "shelf_tag" ? 36 : 30}
                    fontSize={format === "thermal_40x20" ? 8 : 10}
                    displayValue={showBarcodeText}
                    margin={0}
                  />
                </div>
                {showPrice && (
                  <div className={format === "shelf_tag" ? "shelf-price" : "art-price"}>
                    {formatCurrencyAmount(art.p_vente_ttc)}
                  </div>
                )}
              </div>
            ));
          })}
        </div>
      </div>
    </div>
  );
}
