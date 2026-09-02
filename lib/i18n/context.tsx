"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, translations } from "./translations";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dir: "ltr" | "rtl";
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: "fr",
  setLocale: () => {},
  dir: "ltr",
  t: (key: string, fallback?: string) => fallback || key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // 1. Read from localStorage
    const saved = localStorage.getItem("gp_locale") as Locale;
    if (saved && (saved === "fr" || saved === "ar" || saved === "en")) {
      setLocaleState(saved);
      applyLocaleSettings(saved);
    } else {
      // 2. Read from navigator language
      const navLang = navigator.language?.toLowerCase() || "";
      if (navLang.startsWith("ar")) {
        setLocaleState("ar");
        applyLocaleSettings("ar");
      } else if (navLang.startsWith("en")) {
        setLocaleState("en");
        applyLocaleSettings("en");
      } else {
        setLocaleState("fr");
        applyLocaleSettings("fr");
      }
    }
  }, []);

  const applyLocaleSettings = (loc: Locale) => {
    const isRtl = loc === "ar";
    if (typeof document !== "undefined") {
      document.documentElement.lang = loc;
      document.documentElement.dir = isRtl ? "rtl" : "ltr";
      if (isRtl) {
        document.documentElement.classList.add("rtl");
      } else {
        document.documentElement.classList.remove("rtl");
      }
    }
  };

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("gp_locale", newLocale);
    document.cookie = `gp_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    applyLocaleSettings(newLocale);
  };

  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";

  const t = (key: string, fallback?: string): string => {
    const entry = translations[key];
    if (entry && entry[locale]) {
      return entry[locale];
    }
    return fallback || entry?.fr || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, dir, t }}>
      <div dir={dir} className={dir === "rtl" ? "font-arabic" : ""}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
