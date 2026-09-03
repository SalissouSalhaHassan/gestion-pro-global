"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Package,
  Home,
  ArrowRight,
  Loader2,
  Info,
  Banknote,
  Car,
  Scale,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/context";

export default function NotificationBell() {
  const { locale, dir } = useLanguage();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (Array.isArray(data)) setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 3 * 60 * 1000); // Check every 3 mins
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.length;
  const highPriorityCount = notifications.filter((n) => n.priority === "high").length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-3 rounded-2xl transition-all duration-300 group cursor-pointer ${
          isOpen
            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
            : "bg-white/90 hover:bg-white text-slate-500 hover:text-indigo-600 border border-slate-200/80 shadow-xs"
        }`}
        title={locale === "ar" ? "مركز الإشعارات والتنبيهات" : "Centre de Notifications & Alertes"}
      >
        <Bell size={19} className={unreadCount > 0 ? "animate-wiggle" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          dir={dir}
          className={`absolute top-full mt-3 w-84 sm:w-96 bg-white/95 backdrop-blur-2xl border border-slate-200/80 rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] overflow-hidden z-[120] animate-in fade-in slide-in-from-top-4 duration-300 ${
            dir === "rtl" ? "left-0" : "right-0"
          }`}
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Sparkles size={14} />
              </div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                {locale === "ar" ? "التنبيهات التشغيلية" : "Alertes Opérationnelles"}
              </h3>
            </div>
            {unreadCount > 0 ? (
              <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200/60 rounded-full text-[10px] font-black">
                {unreadCount} {locale === "ar" ? "تنبيه نشط" : "Alertes"}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/60 rounded-full text-[10px] font-black">
                {locale === "ar" ? "كل شيء سليم" : "Tout est OK"}
              </span>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center opacity-60">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                <p className="text-xs font-bold text-slate-500">
                  {locale === "ar" ? "جاري فحص حالة النظام والمخزون..." : "Vérification des alertes..."}
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center opacity-70">
                <CheckCircle2 size={36} className="mb-2 text-emerald-500" />
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  {locale === "ar" ? "النظام مستقر تماماً" : "Tout est sous contrôle"}
                </p>
                <p className="text-[11px] mt-1 font-medium text-slate-500">
                  {locale === "ar"
                    ? "لا توجد نواقص في المخزون أو ديون حرجة في الوقت الحالي."
                    : "Aucune rupture de stock ni échéance critique pour le moment."}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {notifications.map((notif) => {
                  const isStock = notif.type === "stock";
                  const isDebt = notif.type === "debt";
                  const isVehicle = notif.type === "vehicle";
                  const isRent = notif.type === "rent";

                  return (
                    <Link
                      key={notif.id}
                      href={notif.link}
                      onClick={() => setIsOpen(false)}
                      className="flex items-start gap-3.5 p-3.5 rounded-2xl hover:bg-slate-50/80 transition-all group/item"
                    >
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isStock
                            ? "bg-amber-50 text-amber-600 border border-amber-200/50"
                            : isDebt
                            ? "bg-rose-50 text-rose-600 border border-rose-200/50"
                            : isVehicle
                            ? "bg-blue-50 text-blue-600 border border-blue-200/50"
                            : isRent
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200/50"
                            : "bg-indigo-50 text-indigo-600 border border-indigo-200/50"
                        }`}
                      >
                        {isStock ? (
                          <Package size={17} />
                        ) : isDebt ? (
                          <Banknote size={17} />
                        ) : isVehicle ? (
                          <Car size={17} />
                        ) : isRent ? (
                          <Home size={17} />
                        ) : (
                          <AlertTriangle size={17} />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p
                            className={`text-[10px] font-black uppercase tracking-wider truncate ${
                              notif.priority === "high" ? "text-rose-600" : "text-slate-500"
                            }`}
                          >
                            {notif.title}
                          </p>
                          {notif.priority === "high" && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-snug break-words">
                          {notif.message}
                        </p>
                      </div>

                      <ArrowRight
                        size={14}
                        className={`mt-1 text-slate-300 opacity-0 group-hover/item:opacity-100 transition-all shrink-0 ${
                          dir === "rtl"
                            ? "rotate-180 group-hover/item:-translate-x-1"
                            : "group-hover/item:translate-x-1"
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-[10px] font-bold text-slate-400">
              {highPriorityCount > 0 && (
                <span className="text-rose-600 font-black">
                  {highPriorityCount} {locale === "ar" ? "حرجة للغاية" : "priorité haute"} •{" "}
                </span>
              )}
              {locale === "ar" ? "تحديث تلقائي" : "Sync Auto"}
            </span>

            <button
              onClick={fetchNotifications}
              disabled={loading}
              className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              <span>{locale === "ar" ? "تحديث الآن" : "Actualiser"}</span>
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(12deg); }
          75% { transform: rotate(-12deg); }
        }
        .animate-wiggle {
          animation: wiggle 0.6s ease-in-out infinite;
          animation-play-state: paused;
        }
        button:hover .animate-wiggle {
          animation-play-state: running;
        }
      `}</style>
    </div>
  );
}
