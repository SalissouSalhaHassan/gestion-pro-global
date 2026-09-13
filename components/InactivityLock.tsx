"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Key, Eye, EyeOff, Loader2, LogOut, ShieldAlert, AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";

const INACTIVITY_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes = 180,000 ms
const STORAGE_KEY_LAST_ACTIVE = "gp_last_active";
const STORAGE_KEY_LOCKED = "gp_is_locked";

interface InactivityLockProps {
  userSession: any;
}

export default function InactivityLock({ userSession }: InactivityLockProps) {
  const router = useRouter();
  const { locale, dir } = useLanguage();
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mark activity
  const recordActivity = useCallback(() => {
    if (isLocked) return;
    const now = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
    } catch (_) {}
  }, [isLocked]);

  // Lock session
  const lockSession = useCallback(() => {
    setIsLocked(true);
    setErrorMsg("");
    setPassword("");
    try {
      localStorage.setItem(STORAGE_KEY_LOCKED, "true");
    } catch (_) {}
  }, []);

  // Unlock session
  const unlockSession = useCallback(() => {
    setIsLocked(false);
    setErrorMsg("");
    setPassword("");
    const now = Date.now();
    try {
      localStorage.removeItem(STORAGE_KEY_LOCKED);
      localStorage.setItem(STORAGE_KEY_LAST_ACTIVE, String(now));
    } catch (_) {}
  }, []);

  // Handle Unlock Request
  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password || loading) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(
          data.error ||
          (locale === "ar" ? "كلمة المرور غير صحيحة" : "Mot de passe incorrect")
        );
        if (inputRef.current) {
          inputRef.current.select();
        }
      } else {
        unlockSession();
      }
    } catch (err) {
      console.error("Unlock error:", err);
      setErrorMsg(
        locale === "ar"
          ? "حدث خطأ في الاتصال بالخادم"
          : "Erreur de connexion au serveur"
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Logout from Lock Screen
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      localStorage.removeItem(STORAGE_KEY_LOCKED);
      localStorage.removeItem(STORAGE_KEY_LAST_ACTIVE);
      document.cookie = "gp_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    } catch (_) {}
    router.push("/login");
    router.refresh();
  };

  // Activity listeners
  useEffect(() => {
    if (!userSession) return;

    // Check if previously locked
    const wasLocked = localStorage.getItem(STORAGE_KEY_LOCKED) === "true";
    const lastActiveStr = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
    const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();

    if (wasLocked || (Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS)) {
      lockSession();
    } else {
      recordActivity();
    }

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    let throttleTimer: any = null;

    const handleEvent = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          recordActivity();
          throttleTimer = null;
        }, 1000);
      }
    };

    events.forEach((evt) => window.addEventListener(evt, handleEvent, { passive: true }));

    // Periodic interval to check elapsed time
    const interval = setInterval(() => {
      if (isLocked) return;
      const currentLastActiveStr = localStorage.getItem(STORAGE_KEY_LAST_ACTIVE);
      const currentLastActive = currentLastActiveStr ? parseInt(currentLastActiveStr, 10) : Date.now();
      if (Date.now() - currentLastActive >= INACTIVITY_TIMEOUT_MS) {
        lockSession();
      }
    }, 2000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleEvent));
      clearInterval(interval);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [userSession, isLocked, recordActivity, lockSession]);

  // Focus input when locked
  useEffect(() => {
    if (isLocked) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isLocked]);

  if (!isLocked) return null;

  const displayName = userSession?.name || userSession?.username || "Utilisateur";
  const orgName = userSession?.organization_name || "GESTION PRO GLOBAL";

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none overflow-hidden"
      dir={dir}
      style={{
        backgroundColor: "rgba(2, 6, 23, 0.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {/* Dynamic Background Glows */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-[120px] -top-32 -left-32 animate-pulse pointer-events-none" />
      <div className="absolute w-[450px] h-[450px] rounded-full bg-purple-600/15 blur-[120px] -bottom-32 -right-32 pointer-events-none" />

      {/* Lock Card */}
      <div className="relative w-full max-w-md bg-slate-900/90 border border-white/10 rounded-[32px] p-8 shadow-[0_25px_70px_rgba(0,0,0,0.6)] backdrop-blur-2xl text-white text-center">
        {/* Lock Icon Badge */}
        <div className="mx-auto mb-6 w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-indigo-700 flex items-center justify-center shadow-[0_12px_30px_rgba(79,70,229,0.5)] border border-indigo-400/30">
          <Lock size={36} className="text-white animate-bounce" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-black tracking-tight text-white mb-1.5">
          {locale === "ar" ? "الجلسة مقفلة لعدم النشاط" : "Session Verrouillée"}
        </h2>
        <p className="text-xs text-indigo-300 font-semibold mb-6 flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          {locale === "ar"
            ? "مرت 3 دقائق بدون استخدام. يرجى إدخال كلمة المرور للمتابعة"
            : "Inactivité de 3 minutes détectée. Veuillez saisir votre mot de passe"}
        </p>

        {/* User Info Capsule */}
        <div className="mb-6 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between text-start">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-400 block">
              {orgName}
            </span>
            <span className="text-sm font-bold text-slate-100 block">
              👤 {displayName}
            </span>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {userSession?.role_name || userSession?.role || "Utilisateur"}
          </span>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2 text-start animate-shake">
            <AlertCircle size={16} className="shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-slate-400">
              <Key size={18} />
            </div>
            <input
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={locale === "ar" ? "كلمة المرور..." : "Mot de passe..."}
              disabled={loading}
              className="w-full ps-11 pe-11 py-3.5 bg-slate-950/60 border border-white/15 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-inner"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 end-0 flex items-center pe-4 text-slate-400 hover:text-slate-200 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-[0.98] text-white font-extrabold text-sm shadow-[0_8px_25px_rgba(79,70,229,0.45)] border border-indigo-400/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>{locale === "ar" ? "جارٍ التحقق..." : "Vérification..."}</span>
              </>
            ) : (
              <>
                <Unlock size={18} />
                <span>{locale === "ar" ? "إلغاء القفل والمتابعة" : "Déverrouiller"}</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Logout */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-xs font-bold text-slate-400 hover:text-rose-400 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut size={15} />
            <span>
              {loggingOut
                ? (locale === "ar" ? "جارٍ الخروج..." : "Déconnexion...")
                : (locale === "ar" ? "تسجيل الخروج أو تبديل الحساب" : "Se déconnecter")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
