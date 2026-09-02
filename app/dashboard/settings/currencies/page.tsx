"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { SUPPORTED_CURRENCIES, convertCurrency, formatCurrencyAmount } from "@/lib/utils/currency";
import { ArrowRightLeft, Coins, Calculator, Percent, Sparkles } from "lucide-react";

export default function CurrenciesPage() {
  const { t, locale, dir } = useLanguage();
  const [calcAmount, setCalcAmount] = useState<number>(100000);
  const [calcFrom, setCalcFrom] = useState<string>("FCFA");
  const [calcTo, setCalcTo] = useState<string>("EUR");

  const convertedResult = convertCurrency(calcAmount, calcFrom, calcTo);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-slate-900 flex items-center gap-3">
            <Coins className="text-indigo-600" size={32} />
            {locale === "ar" ? "إدارة العملات والضرائب الدولية" : "Devises & Fiscalité Internationale"}
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {locale === "ar"
              ? "محرك أسعار الصرف الحية، الفوترة متعددة العملات والضرائب الذكية"
              : "Taux de change en temps réel, facturation multidevise et gestion des taxes"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {locale === "ar" ? "أسعار الصرف نشطة ومحدثة" : "Taux de change synchronisés"}
          </span>
        </div>
      </div>

      {/* Grid: Currency Converter + Quick Exchange Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Converter Card */}
        <div className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-white/10 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -z-0" />
          
          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Calculator size={16} />
                {locale === "ar" ? "محول العملات الفوري" : "Calculateur Instantané"}
              </span>
              <Sparkles size={18} className="text-amber-400" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                {locale === "ar" ? "المبلغ المراد تحويله" : "Montant à convertir"}
              </label>
              <input
                type="number"
                value={calcAmount}
                onChange={(e) => setCalcAmount(Number(e.target.value))}
                className="w-full bg-white/10 border border-white/15 rounded-2xl px-4 py-3 text-white text-lg font-black focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {locale === "ar" ? "من عملة" : "De"}
                </label>
                <select
                  value={calcFrom}
                  onChange={(e) => setCalcFrom(e.target.value)}
                  className="w-full bg-slate-800 border border-white/15 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
                >
                  {Object.keys(SUPPORTED_CURRENCIES).map((code) => (
                    <option key={code} value={code}>
                      {code} ({SUPPORTED_CURRENCIES[code].symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {locale === "ar" ? "إلى عملة" : "Vers"}
                </label>
                <select
                  value={calcTo}
                  onChange={(e) => setCalcTo(e.target.value)}
                  className="w-full bg-slate-800 border border-white/15 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none"
                >
                  {Object.keys(SUPPORTED_CURRENCIES).map((code) => (
                    <option key={code} value={code}>
                      {code} ({SUPPORTED_CURRENCIES[code].symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Result Box */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
              <span className="text-xs text-slate-400 block mb-1">
                {locale === "ar" ? "القيمة المحولة المقدرة" : "Résultat estimé"}
              </span>
              <span className="text-2xl font-black text-emerald-400 tracking-tight block">
                {formatCurrencyAmount(convertedResult, calcTo, locale)}
              </span>
            </div>
          </div>
        </div>

        {/* Live Rates Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <ArrowRightLeft size={20} className="text-indigo-600" />
              {locale === "ar" ? "جدول أسعار العملات المدعومة" : "Tableau des Devises Mondiales"}
            </h2>
            <span className="text-xs font-bold text-slate-500">Base: 1 USD</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.values(SUPPORTED_CURRENCIES).map((curr) => {
              const amountInFcfa = convertCurrency(1, curr.code, "FCFA");
              return (
                <div
                  key={curr.code}
                  className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">
                      {curr.symbol}
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm">
                        {locale === "ar" ? curr.nameAr : curr.nameFr}
                      </div>
                      <div className="text-xs font-bold text-slate-400">{curr.code}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500">
                      1 {curr.code} =
                    </div>
                    <div className="text-sm font-black text-indigo-600">
                      {formatCurrencyAmount(amountInFcfa, "FCFA", locale)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* International Tax Rules Section */}
      <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Percent size={20} className="text-indigo-600" />
              {locale === "ar" ? "قواعد الضرائب والرسوم الدولية" : "Règles Fiscales & Taxes"}
            </h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              {locale === "ar"
                ? "إعداد نسب الضرائب التلقائية لكل دولة وفاتورة"
                : "Configuration automatique des taxes par pays et type de facture"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-sm text-slate-900">TVA Standard (UEMOA)</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-extrabold text-xs">19.00%</span>
            </div>
            <p className="text-xs text-slate-500">Appliquée aux ventes et factures locales au Niger et UEMOA.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-sm text-slate-900">BIC / Acompte IS</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 font-extrabold text-xs">5.00%</span>
            </div>
            <p className="text-xs text-slate-500">Retenue à la source fiscale sur les prestations et marchés.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-sm text-slate-900">Exonéré / Export (0%)</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-extrabold text-xs">0.00%</span>
            </div>
            <p className="text-xs text-slate-500">Pour les clients internationaux, ONG et ventes exonérées de taxes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
