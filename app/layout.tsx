import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";
import { PWAProvider } from "@/components/PWAProvider";
import PWAInstallBanner from "@/components/PWAInstallBanner";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4f46e5",
};

export const metadata: Metadata = {
  title: "GestionPro Global | Système ERP & POS d'Entreprise",
  description: "Plateforme SaaS globale de gestion commerciale, POS, multi-devises et facturation",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "GestionPro Global",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="fr" dir="ltr">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <LanguageProvider>
          <PWAProvider>
            {children}
            <PWAInstallBanner />
          </PWAProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
