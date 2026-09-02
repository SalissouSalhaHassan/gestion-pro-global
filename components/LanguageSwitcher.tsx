"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { Globe, ChevronDown, Check } from "lucide-react";
import { Locale } from "@/lib/i18n/translations";

export default function LanguageSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { locale, setLocale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages: { code: Locale; label: string; flag: string }[] = [
    { code: "fr", label: "Français", flag: "🇫🇷" },
    { code: "ar", label: "العربية", flag: "🇸🇦" },
    { code: "en", label: "English", flag: "🇬🇧" },
  ];

  const currentLang = languages.find((l) => l.code === locale) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isDark = variant === "dark";

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border cursor-pointer select-none ${
          isDark
            ? "bg-slate-800/80 hover:bg-slate-700/80 text-white border-white/10 shadow-sm"
            : "bg-white/80 hover:bg-white text-slate-700 border-slate-200/80 shadow-xs backdrop-blur-md"
        }`}
      >
        <span className="text-sm">{currentLang.flag}</span>
        <span className="tracking-wide hidden sm:inline">{currentLang.label}</span>
        <ChevronDown size={14} className={`opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-40 rounded-2xl p-1.5 shadow-xl border z-50 animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? "bg-slate-900/95 border-white/10 text-white backdrop-blur-xl"
              : "bg-white/95 border-slate-200/90 text-slate-800 backdrop-blur-xl"
          }`}
        >
          {languages.map((lang) => {
            const isSelected = lang.code === locale;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLocale(lang.code);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : isDark
                    ? "hover:bg-white/10 text-slate-300 hover:text-white"
                    : "hover:bg-slate-100/80 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.label}</span>
                </div>
                {isSelected && <Check size={14} className="stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
