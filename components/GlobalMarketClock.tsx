"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { MAJOR_TIMEZONES } from "@/lib/utils/datetime";
import { Clock, Globe2 } from "lucide-react";

export default function GlobalMarketClock() {
  const { locale } = useLanguage();
  const [time, setTime] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
          <Globe2 size={16} className="text-indigo-600" />
          {locale === "ar" ? "ساعات الأسواق والشركاء الدوليين" : "Horloges des Marchés Mondiaux"}
        </span>
        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
          <Clock size={12} />
          Live UTC
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {MAJOR_TIMEZONES.slice(0, 6).map((tz) => {
          let timeString = "--:--";
          try {
            timeString = time.toLocaleTimeString("fr-FR", {
              timeZone: tz.id,
              hour: "2-digit",
              minute: "2-digit",
            });
          } catch (e) {}

          return (
            <div
              key={tz.id}
              className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/60 text-center hover:bg-indigo-50/30 transition-colors"
            >
              <div className="text-[11px] font-extrabold text-slate-700 truncate">
                {tz.city.split("/")[0].trim()}
              </div>
              <div className="text-sm font-black text-indigo-600 tracking-tight my-0.5 font-mono">
                {timeString}
              </div>
              <div className="text-[9px] font-extrabold text-slate-400">
                {tz.utcOffset}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
