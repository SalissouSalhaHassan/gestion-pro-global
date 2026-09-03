"use client";

import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Settings,
  LogOut,
  ArrowRightLeft,
  Database,
  Warehouse,
  Boxes,
  Wallet,
  TrendingDown,
  Scale,
  Shield,
  ScanLine,
  Truck,
  Home,
  Layers,
  Car,
  BarChart3,
  Landmark,
  Crown,
  Sparkles,
  Bot,
  Headphones
} from "lucide-react";
import UnifiedSearch from "@/components/UnifiedSearch";
import NotificationBell from "@/components/NotificationBell";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/i18n/context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPos = pathname === "/dashboard/pos";
  const [loggingOut, setLoggingOut] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const { t, dir, locale } = useLanguage();

  useEffect(() => {
    // Client-side session retrieval
    const cookie = document.cookie.split('; ').find(row => row.startsWith('gp_session='));
    if (cookie) {
      try {
        const decoded = decodeURIComponent(cookie.split('=')[1]);
        setUserSession(JSON.parse(decoded));
      } catch (e) {
        console.error("Failed to parse session at layout", e);
      }
    }
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    // Clear custom session cookie
    document.cookie = "gp_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
    router.refresh();
  };

  const isAdmin = userSession?.admin === "Oui" || userSession?.role === 1 || userSession?.role === "1";

  const allNavItems = [
    { href: "/dashboard", label: t("nav_dashboard", "Tableau de bord"), icon: LayoutDashboard, perm: "sale.dashboard" },
    { href: "/dashboard/pos", label: t("nav_pos", "Point de vente (POS)"), icon: ShoppingCart, highlight: true, perm: "pos.access" },
    { href: "/dashboard/articles", label: t("nav_articles", "Articles"), icon: Package, perm: "stock.articles" },
    { href: "/dashboard/stock", label: t("nav_stock", "Gestion du Stock"), icon: Boxes, perm: "stock.inventory" },
    { href: "/dashboard/stock/valuation", label: t("nav_valuation", "Valorisation Stock"), icon: BarChart3, perm: "report.stock_valuation" },
    { href: "/dashboard/stock/transit", label: t("nav_transits", "Suivi Transits"), icon: Truck, perm: "stock.transfer" },
    { href: "/dashboard/inventory", label: t("nav_inventory", "Jeu d'Inventaire"), icon: ScanLine, perm: "stock.inventory" },
    { href: "/dashboard/ciment", label: t("nav_ciment", "Gestion Ciment"), icon: Layers, perm: "cement.access" },
    { href: "/dashboard/mouvements", label: t("nav_audit", "Journal d'Audit"), icon: ArrowRightLeft, perm: "report.activity_log" },
    { href: "/dashboard/clients", label: t("nav_clients", "Clients"), icon: Users, perm: "client.access" },
    { href: "/dashboard/suppliers", label: t("nav_suppliers", "Fournisseurs"), icon: Users, perm: "supplier.access" },
    { href: "/dashboard/invoices", label: t("nav_invoices", "Factures"), icon: FileText, perm: "sale.invoices_view" },
    { href: "/dashboard/devis", label: t("nav_devis", "Devis & Proforma"), icon: FileText, perm: "sale.proforma_create" },
    { href: "/dashboard/purchases", label: t("nav_purchases", "Achats"), icon: ShoppingCart, perm: "purchase.access" },
    { href: "/dashboard/expenses", label: t("nav_expenses", "Dépenses"), icon: TrendingDown, perm: "expense.access" },
    { href: "/dashboard/reports/cash-balance", label: t("nav_cash_balance", "Bilan de Caisse"), icon: Scale, perm: "expense.cash_balance" },
    { href: "/dashboard/reports/profit-loss", label: t("nav_profit_loss", "Pertes & Profits (P&L)"), icon: BarChart3, perm: "report.finance" },
    { href: "/dashboard/finance", label: t("nav_finance", "Gestion Financière"), icon: Landmark, perm: "report.finance" },
    { href: "/dashboard/advances", label: t("nav_advances", "Dépôts & Avances"), icon: Wallet, perm: "deposit.access" },
    { href: "/dashboard/loyers", label: t("nav_loyers", "Gestion des Loyers"), icon: Home, perm: "rent.access" },
    { href: "/dashboard/vehicles", label: t("nav_vehicles", "Gestion des Véhicules"), icon: Car, perm: "vehicles.access" },
    { href: "/dashboard/depots", label: t("nav_depots", "Gestion des Dépôts"), icon: Warehouse, adminOnly: true },
    { href: "/dashboard/users", label: t("nav_users", "Utilisateurs"), icon: Users, adminOnly: true },
    { href: "/dashboard/permissions", label: t("nav_permissions", "Permissions"), icon: Shield, adminOnly: true },
    { href: "/dashboard/settings", label: t("nav_settings", "Paramètres"), icon: Settings, adminOnly: true },
    { href: "/dashboard/platform", label: t("nav_platform", "Gestion de la plateforme"), icon: Landmark, adminOnly: true },
    { href: "/dashboard/super-admin", label: t("nav_super_admin", "Tableau de bord Super Admin"), icon: Crown, adminOnly: true },
    { href: "/dashboard/copilot", label: t("nav_copilot", "Assistant IA Copilot"), icon: Bot, highlight: true },
    { href: "/dashboard/support", label: t("nav_support", "Support & Assistance"), icon: Headphones },
  ];

  const userPermissions = userSession?.permissions || [];
  const visibleNavItems = allNavItems.filter(item => {
    if (isAdmin) return true;
    if (item.adminOnly) return false;
    if (item.perm) return userPermissions.includes(item.perm);
    return true;
  });

  return (
    <div className="flex min-h-screen relative overflow-hidden font-sans print:block print:overflow-visible print:h-auto print:bg-none print:shadow-none" dir={dir} style={{
      background: "radial-gradient(at 0% 0%, rgba(240, 244, 255, 1) 0, transparent 50%), radial-gradient(at 100% 0%, rgba(245, 239, 255, 1) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(235, 250, 255, 1) 0, transparent 50%), radial-gradient(at 0% 100%, rgba(240, 240, 255, 1) 0, transparent 50%), #ffffff"
    }}>
      {/* Sidebar - Precision Premium Dark (Sticky & Smooth Scrollable) */}
      <aside
        className={`sticky top-4 h-[calc(100vh-2rem)] w-72 shrink-0 self-start flex flex-col m-4 mr-0 rounded-[32px] backdrop-blur-2xl text-white shadow-[0_10px_50px_rgba(0,0,0,0.4)] transition-all duration-300 z-50 no-print print:hidden ${isPos ? "hidden" : ""}`}
        style={{ backgroundColor: 'rgba(2, 6, 23, 0.98)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
      >
        {/* Fixed Header Logo */}
        <div className="p-6 pb-2 shrink-0">
          <div className="flex items-center gap-3.5 mb-4 group cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-indigo-700 flex items-center justify-center shadow-[0_10px_25px_rgba(79,70,229,0.4)] group-hover:scale-105 transition-transform duration-300">
              <Database size={22} className="text-white" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-400 block leading-tight">
                GestionPro
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400/80 block">
                Enterprise 4K
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Button Container */}
        <div className="flex-1 min-h-0 px-3 py-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 bg-white/[0.02] border border-white/5 rounded-[28px] overflow-hidden flex flex-col shadow-inner">
            <nav className="flex-1 space-y-1.5 overflow-y-auto px-2.5 py-3 custom-scrollbar">
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-xs font-black transition-all duration-200 group relative ${isActive
                      ? "bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-500 text-white shadow-[0_8px_25px_rgba(79,70,229,0.4)] border-t border-white/10 scale-[1.01] z-10"
                      : item.highlight
                        ? "text-indigo-400 hover:bg-indigo-500/10"
                        : "text-slate-400/80 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <item.icon size={19} className={`shrink-0 transition-all duration-200 ${isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "group-hover:scale-110 group-hover:text-white"}`} />
                    <span className="tracking-wide truncate">{item.label}</span>

                    {isActive && (
                      <>
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_#fff]"></div>
                        <div className="absolute inset-0 rounded-2xl bg-indigo-400/10 blur-xl -z-10 animate-pulse"></div>
                      </>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Fixed Footer Logout */}
        <div className="p-4 shrink-0 mt-auto">
          <div className="bg-gradient-to-b from-white/[0.03] to-transparent rounded-2xl p-2 border border-white/5 backdrop-blur-sm">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-xl p-2.5 text-rose-400 font-extrabold text-xs transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50 group cursor-pointer"
            >
              <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span className="tracking-wide">{loggingOut ? "Déconnexion..." : (locale === "ar" ? "تسجيل الخروج" : "Se déconnecter")}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 min-w-0 relative overflow-y-auto print:block print:overflow-visible print:h-auto print:p-0 print:m-0 ${isPos ? "p-0 h-screen" : "p-6 lg:p-10"}`}>
        {/* Background purely decorative blobs */}
        {!isPos && (
          <div className="print:hidden">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 blur-[130px] rounded-full -translate-y-1/2 translate-x-1/2 -z-10 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 blur-[110px] rounded-full translate-y-1/2 -translate-x-1/2 -z-10"></div>
          </div>
        )}

        <div className="relative z-[60] mb-8 print:hidden no-print flex items-center justify-between gap-4">
          {!isPos && (
            <>
              <div className="flex-1 max-w-xl">
                <UnifiedSearch />
              </div>
              
              {/* Global Multi-Tenant Header Badge */}
              <div className="flex items-center gap-3 ml-auto">
                <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/80 border border-slate-200/80 shadow-xs backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-slate-700">
                    🏢 {userSession?.organization_name || "GESTION PRO GLOBAL"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                    {userSession?.plan === "trial" ? "Essai 14j" : "Global SaaS"}
                  </span>
                </div>

                {/* Language Switcher Dropdown */}
                <LanguageSwitcher />

                <NotificationBell />
              </div>
            </>
          )}
        </div>
        
        <div className="relative z-10">
          {children}
        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
        
        :root {
          --brand-primary: #6366f1;
          --brand-indigo: #4f46e5;
          --bg-main: #fcfdfe;
        }

        body {
          font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif;
          background-color: var(--bg-main);
          letter-spacing: -0.01em;
        }

        h1, h2, h3, h4, button, .font-black {
          font-family: 'Plus Jakarta Sans', 'Cairo', sans-serif;
          font-weight: 800;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.35);
          border-radius: 10px;
          transition: all 0.3s;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.8);
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.6);
        }

        ::selection {
          background: rgba(99, 102, 241, 0.2);
          color: #4f46e5;
        }
      `}</style>
    </div>
  );
}
