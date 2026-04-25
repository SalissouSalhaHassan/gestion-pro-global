"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Package, Home, ArrowRight, Loader2, Info } from "lucide-react";
import Link from "next/link";

export default function NotificationBell() {
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
    // Refresh every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-3 rounded-2xl transition-all duration-300 group ${
          isOpen ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" : "bg-white/80 hover:bg-white text-slate-400 hover:text-indigo-500 border border-slate-200"
        }`}
      >
        <Bell size={20} className={unreadCount > 0 ? "animate-wiggle" : ""} />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 border-2 border-white rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-80 bg-white/95 backdrop-blur-2xl border border-slate-200/60 rounded-[32px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden z-[110] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-full text-[10px] font-black">
                {unreadCount} Alertes
              </span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center opacity-40">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                <p className="text-xs font-bold">Chargement...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-10 flex flex-col items-center justify-center text-center opacity-40">
                <Info size={32} className="mb-2" />
                <p className="text-xs font-bold uppercase tracking-wider">Tout est en ordre</p>
                <p className="text-[10px] mt-1 font-medium">Aucune alerte pour le moment.</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {notifications.map((notif) => (
                  <Link
                    key={notif.id}
                    href={notif.link}
                    onClick={() => setIsOpen(false)}
                    className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all group/item"
                  >
                    <div className={`p-2.5 rounded-xl ${
                      notif.type === "stock" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                    }`}>
                      {notif.type === "stock" ? <Package size={18} /> : <Home size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{notif.title}</p>
                      <p className="text-xs font-bold text-slate-800 leading-relaxed truncate">{notif.message}</p>
                    </div>
                    <ArrowRight size={14} className="mt-1 text-slate-300 opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100">
             <button 
               onClick={fetchNotifications}
               className="w-full py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 transition-colors"
             >
               Actualiser les alertes
             </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(10deg); }
          75% { transform: rotate(-10deg); }
        }
        .animate-wiggle {
          animation: wiggle 0.5s ease-in-out infinite;
          animation-play-state: paused;
        }
        button:hover .animate-wiggle {
          animation-play-state: running;
        }
      `}</style>
    </div>
  );
}
