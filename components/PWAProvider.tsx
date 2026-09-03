"use client";

import { useEffect, useState, createContext, useContext, ReactNode } from "react";

type PWAContextType = {
  isInstallable: boolean;
  installPWA: () => Promise<void>;
  isStandalone: boolean;
};

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  installPWA: async () => {},
  isStandalone: false,
});

export const usePWA = () => useContext(PWAContext);

export function PWAProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("PWA Service Worker registration skipped:", err);
        });
    }

    // 2. Check if running in standalone mode (installed)
    if (typeof window !== "undefined") {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    }

    // 3. Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  return (
    <PWAContext.Provider value={{ isInstallable, installPWA, isStandalone }}>
      {children}
    </PWAContext.Provider>
  );
}
