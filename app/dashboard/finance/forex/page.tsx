"use client";

import { useState, useEffect } from "react";
import {
  Coins,
  DollarSign,
  Euro,
  RefreshCw,
  Save,
  Loader2,
  TrendingUp,
  Scale,
  Building2,
  FileCheck2,
  Calculator,
  ArrowRightLeft,
  ShieldCheck,
  Sparkles,
  CheckCircle2
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { CurrencyRate, DEFAULT_RATES, convertFromCFA, convertToCFA } from "@/lib/utils/currency_forex";

export default function ForexAndTaxPage() {
  const { locale, dir } = useLanguage();
  const [currencies, setCurrencies] = useState<CurrencyRate[]>(DEFAULT_RATES);
  const [loading, setLoading] = useState(true);
  const [savingRate, setSavingRate] = useState<string | null>(null);

  // Live Simulator State
  const [calcAmount, setCalcAmount] = useState<number>(100000);
  const [calcBase, setCalcBase] = useState<string>("FCFA");

  // Tax Settings State
  const [taxSettings, setTaxSettings] = useState({
    taux_tva_defaut: 19.0,
    tva_activee: true,
    nif: "",
    rccm: "",
    centre_impots: "DGI Niamey",
  });
  const [savingTax, setSavingTax] = useState(false);
  const [taxSavedToast, setTaxSavedToast] = useState(false);

  const fetchRatesAndTaxes = async () => {
    try {
      setLoading(true);
      const [currRes, taxRes] = await Promise.all([
        fetch("/api/currencies"),
        fetch("/api/taxes"),
      ]);
      const currData = await currRes.json();
      const taxData = await taxRes.json();
      if (Array.isArray(currData)) setCurrencies(currData);
      if (taxData) setTaxSettings(taxData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRatesAndTaxes();
  }, []);

  const handleUpdateRate = async (code: string, newRate: number) => {
    try {
      setSavingRate(code);
      const res = await fetch("/api/currencies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, taux_vers_cfa: newRate }),
      });

      if (!res.ok) throw new Error("Erreur de mise à jour");

      setCurrencies((prev) =>
        prev.map((c) => (c.code === code ? { ...c, taux_vers_cfa: newRate } : c))
      );
    } catch (e) {
      alert("Erreur lors de la sauvegarde du taux.");
    } finally {
      setSavingRate(null);
    }
  };

  const handleSaveTaxSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingTax(true);
      const res = await fetch("/api/taxes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taxSettings),
      });
      if (res.ok) {
        setTaxSavedToast(true);
        setTimeout(() => setTaxSavedToast(false), 3000);
      }
    } catch (e) {
      alert("Erreur lors de la sauvegarde fiscale.");
    } finally {
      setSavingTax(false);
    }
  };

  // Conversions for calculator
  const amountInCFA = calcBase === "FCFA" ? calcAmount : convertToCFA(calcAmount, calcBase, currencies);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* 4K Header */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Coins size={14} />
                FOREX & MULTI-DEVISES 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                COMMERCE TRANSFRONTALIER (NIGER / NIGERIA / INTERNATIONAL)
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "محرك العملات المتعددة والضرائب (Forex & TVA)" : "Gestion Multi-Devises & Paramètres Fiscaux"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "تحديث أسعار الصرف اليومية (FCFA, NGN, USD, EUR)، التحويل اللحظي، وإعدادات الضريبة على القيمة المضافة (TVA)"
                : "Ajustez les cours de change en temps réel et configurez votre assiette fiscale conforme UEMOA"}
            </p>
          </div>

          <button
            onClick={fetchRatesAndTaxes}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm self-start md:self-auto"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>{locale === "ar" ? "تحديث الأسعار" : "Actualiser"}</span>
          </button>
        </div>
      </div>

      {/* 4 Currency Exchange Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {currencies.map((curr) => {
          const isBase = curr.is_base;

          return (
            <div
              key={curr.code}
              className={`bg-white rounded-3xl p-6 shadow-xs border transition-all space-y-4 ${
                isBase ? "border-indigo-500/50 ring-2 ring-indigo-500/10" : "border-slate-200/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black font-mono px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800">
                  {curr.code}
                </span>
                <span className="text-lg font-black text-slate-400 font-mono">
                  {curr.symbole}
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-sm text-slate-900">{curr.nom}</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isBase ? "Monnaie Légale de Référence" : `1 ${curr.code} = ${curr.taux_vers_cfa} FCFA`}
                </p>
              </div>

              {isBase ? (
                <div className="pt-2 text-center py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-600">
                  1.00 (Base Système)
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.001"
                      defaultValue={curr.taux_vers_cfa}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value);
                        if (val > 0 && val !== curr.taux_vers_cfa) {
                          handleUpdateRate(curr.code, val);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {savingRate === curr.code && (
                      <Loader2 size={16} className="animate-spin text-indigo-600 shrink-0" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block text-right">
                    Taux FCFA modifiable
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Simulator & TVA 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Live Multi-Currency Simulator */}
        <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xs border border-slate-200/80 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Calculator size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {locale === "ar" ? "محاكي التحويل اللحظي للعملات" : "Convertisseur Multi-Devises Instantané"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {locale === "ar" ? "أدخل أي مبلغ وشاهد قيمته المعادلة في باقي العملات" : "Simulez vos montants en temps réel"}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Montant à Convertir
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(Number(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Devise Source
                </label>
                <select
                  value={calcBase}
                  onChange={(e) => setCalcBase(e.target.value)}
                  className="w-full px-3 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-900 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbole})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Results Matrix */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {currencies.map((c) => {
                const converted = convertFromCFA(amountInCFA, c.code, currencies);

                return (
                  <div key={c.code} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 font-mono">
                      Équivalent en {c.code}
                    </span>
                    <div className="text-base font-black font-mono text-indigo-700">
                      {c.symbole} {Math.round(converted).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* TVA & Fiscal Settings */}
        <div className="bg-white rounded-3xl p-6 lg:p-8 shadow-xs border border-slate-200/80 space-y-6">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <FileCheck2 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                {locale === "ar" ? "الإعدادات الضريبية والـ TVA" : "Configuration Fiscale & TVA"}
              </h3>
              <p className="text-[11px] text-slate-500">
                {locale === "ar" ? "بيانات الامتثال الضريبي والرقم الجبائي" : "Paramétrage conforme aux normes DGI / UEMOA"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveTaxSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Taux TVA Standard (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={taxSettings.taux_tva_defaut}
                  onChange={(e) =>
                    setTaxSettings({ ...taxSettings, taux_tva_defaut: Number(e.target.value) || 0 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-black font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Statut TVA
                </label>
                <select
                  value={taxSettings.tva_activee ? "true" : "false"}
                  onChange={(e) =>
                    setTaxSettings({ ...taxSettings, tva_activee: e.target.value === "true" })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white"
                >
                  <option value="true">Actif (19% Applicable)</option>
                  <option value="false">Exonéré / Suspendu</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NIF (Numéro Fiscale)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 12345/R"
                  value={taxSettings.nif || ""}
                  onChange={(e) => setTaxSettings({ ...taxSettings, nif: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  RCCM (Registre Commerce)
                </label>
                <input
                  type="text"
                  placeholder="Ex: NI-NIA-2026-B-00"
                  value={taxSettings.rccm || ""}
                  onChange={(e) => setTaxSettings({ ...taxSettings, rccm: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {taxSavedToast ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  Paramètres fiscaux enregistrés !
                </span>
              ) : (
                <span />
              )}

              <button
                type="submit"
                disabled={savingTax}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {savingTax ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>Enregistrer la Configuration</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
