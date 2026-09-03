"use client";

import { useState } from "react";
import { Download, Smartphone, X, Sparkles } from "lucide-react";
import { usePWA } from "./PWAProvider";
import { useLanguage } from "@/lib/i18n/context";

export default function PWAInstallBanner() {
  const { isInstallable, installPWA, isStandalone } = usePWA();
  const { locale, dir } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || isStandalone || dismissed) {
    return null;
  }

  return (
    <div
      className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300 print:hidden"
      dir={dir}
    >
      <div className="bg-slate-950/90 text-white backdrop-blur-xl p-4 rounded-3xl shadow-2xl border border-indigo-500/40 flex items-center justify-between gap-3.5">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shrink-0 shadow-md">
          <Smartphone size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-400">
            <Sparkles size={13} />
            <span>{locale === "ar" ? "تطبيق الجوال متوفر" : "Application Mobile"}</span>
          </div>
          <p className="text-[11px] text-slate-300 font-medium truncate">
            {locale === "ar"
              ? "قم بتثبيت التطبيق على شاشة هاتفك الرئيسية"
              : "Installez l'application sur votre écran d'accueil"}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={installPWA}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Download size={14} />
            <span>{locale === "ar" ? "تثبيت" : "Installer"}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Fermer"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
