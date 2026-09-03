"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Award,
  Crown,
  Sparkles,
  Search,
  Filter,
  CreditCard,
  Gift,
  TrendingUp,
  RefreshCw,
  Users,
  ChevronRight,
  ShieldCheck,
  Coins,
  Loader2
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import DigitalLoyaltyCardModal from "@/components/DigitalLoyaltyCardModal";

type LoyalClient = {
  id: string | number;
  nom: string;
  tel?: string | null;
  carte_fidelite_numero?: string | null;
  points_fidelite?: number;
  niveau_fidelite?: string;
};

type LoyaltyStats = {
  totalClientsWithPoints: number;
  totalPointsOutstanding: number;
  totalPointsAwarded: number;
  totalPointsRedeemed: number;
  totalDiscountsGrantedCFA: number;
  tierCounts: {
    PLATINE: number;
    OR: number;
    ARGENT: number;
    BRONZE: number;
  };
};

export default function LoyaltyClubPage() {
  const { locale, dir } = useLanguage();
  const [clients, setClients] = useState<LoyalClient[]>([]);
  const [stats, setStats] = useState<LoyaltyStats>({
    totalClientsWithPoints: 0,
    totalPointsOutstanding: 0,
    totalPointsAwarded: 0,
    totalPointsRedeemed: 0,
    totalDiscountsGrantedCFA: 0,
    tierCounts: { PLATINE: 0, OR: 0, ARGENT: 0, BRONZE: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [selectedClientForCard, setSelectedClientForCard] = useState<LoyalClient | null>(null);

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/loyalty");
      const data = await res.json();
      setClients(data.topLoyalClients || []);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoyaltyData();
  }, []);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const matchTier = tierFilter === "ALL" || (c.niveau_fidelite || "BRONZE") === tierFilter;
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        c.nom.toLowerCase().includes(q) ||
        (c.tel && c.tel.includes(q)) ||
        (c.carte_fidelite_numero && c.carte_fidelite_numero.toLowerCase().includes(q));
      return matchTier && matchSearch;
    });
  }, [clients, tierFilter, search]);

  const getTierBadge = (tier: string = "BRONZE") => {
    switch (tier.toUpperCase()) {
      case "PLATINE":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
            <Crown size={12} className="text-purple-600" />
            PLATINE VIP
          </span>
        );
      case "OR":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
            <Crown size={12} className="text-amber-600" />
            MEMBRE OR ⭐
          </span>
        );
      case "ARGENT":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-slate-200 text-slate-800 border border-slate-300">
            <Award size={12} className="text-slate-600" />
            ARGENT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
            BRONZE
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12 font-sans" dir={dir}>
      {/* 4K Hero Header */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Crown size={14} />
                VIP LOYALTY PRIVILEGE CLUB 4K
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                FIDÉLISATION CLIENTS & CASHBACK
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "نادي الولاء وبطاقات العضوية الرقمية (Loyalty VIP)" : "Programme de Fidélité & Cartes VIP"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "مكافأة الزبائن الدائمين بنقاط الشراء، إصدار بطاقات VIP الرقمية، والخصم المباشر في الكاشير"
                : "Attribuez des points cashback à chaque achat, émettez des cartes numériques et stimulez la récurrence"}
            </p>
          </div>

          <button
            onClick={fetchLoyaltyData}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm self-start md:self-auto"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>{locale === "ar" ? "تحديث السجلات" : "Actualiser"}</span>
          </button>
        </div>
      </div>

      {/* 4 KPIs Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "نقاط متداولة حالياً" : "Points en Circulation"}
            </span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Coins size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">
            {stats.totalPointsOutstanding.toLocaleString()} <span className="text-xs font-bold text-slate-400">PTS</span>
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "أرصدة نقاط جاهزة للاستبدال" : "Solde cumulé chez les clients"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "خصومات ممنوحة للعملاء" : "Remises Accordées"}
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Gift size={18} />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono">
            {formatCurrencyAmount(stats.totalDiscountsGrantedCFA, "FCFA")}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "قيمة الخصومات المستبدلة فعلياً" : "Pouvoir d'achat restitué"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "عملاء يحملون نقاطاً" : "Adhérents Actifs"}
            </span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {stats.totalClientsWithPoints}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "عملاء مؤهلين لبرنامج الولاء" : "Comptes fidélité alimentés"}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "نخبة VIP والذهب" : "Élite Or & Platine"}
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Crown size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700 font-mono">
            {stats.tierCounts.OR + stats.tierCounts.PLATINE}
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {locale === "ar" ? "أكبر المشترين في المتجر" : "Clients à plus forte valeur"}
          </p>
        </div>
      </div>

      {/* Program Rules Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 border border-amber-200/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-600" />
            Règles du Programme de Récompense
          </h3>
          <p className="text-xs text-amber-900 font-medium">
            Chaque <span className="font-bold">1 000 FCFA d'achat = 1 Point de fidélité</span> • Chaque <span className="font-bold">100 Points = 1 000 FCFA de remise</span> déductible immédiatement en caisse !
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 font-mono">Bronze: 0+</span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 font-mono">Argent: 500+</span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 font-mono">Or: 1500+</span>
          <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 font-mono">Platine: 5000+</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث باسم العميل أو رقم الهاتف أو رقم البطاقة..." : "Rechercher par nom, téléphone ou N° carte..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Tier Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs">
          {["ALL", "PLATINE", "OR", "ARGENT", "BRONZE"].map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                tierFilter === t
                  ? "bg-white text-slate-900 shadow-xs font-black"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t === "ALL" ? (locale === "ar" ? "كافة الفئات" : "Toutes") : t}
            </button>
          ))}
        </div>
      </div>

      {/* Loyal Clients Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">{locale === "ar" ? "العميل" : "Client"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "رقم البطاقة" : "N° Carte"}</th>
                <th className="px-6 py-4">{locale === "ar" ? "الرتبة" : "Rang VIP"}</th>
                <th className="px-6 py-4 text-center">{locale === "ar" ? "النقاط" : "Solde Points"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "القيمة النقدية (CFA)" : "Valeur Cashback"}</th>
                <th className="px-6 py-4 text-right">{locale === "ar" ? "البطاقة الرقمية" : "Carte Digitale"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Loader2 className="animate-spin mb-3 text-amber-500" size={36} />
                      <p className="font-bold text-slate-600 text-xs">
                        Chargement des adhérents VIP...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-slate-400 font-bold">
                    Aucun client trouvé dans cette catégorie.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client, idx) => {
                  const pts = Number(client.points_fidelite) || 0;
                  const cfa = pts * 10;

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-mono text-[11px] font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{client.nom}</div>
                        <div className="text-[11px] text-slate-400">{client.tel || "Pas de tél"}</div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-indigo-700 text-xs">
                        {client.carte_fidelite_numero || `LOYAL-2026-${client.id}`}
                      </td>
                      <td className="px-6 py-4">
                        {getTierBadge(client.niveau_fidelite)}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-black text-amber-700 text-sm">
                        {pts.toLocaleString()} <span className="text-[10px] font-bold text-slate-400">pts</span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-black text-emerald-600">
                        {formatCurrencyAmount(cfa, "FCFA")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedClientForCard(client)}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-500 text-amber-800 hover:text-slate-950 font-black text-xs transition-all flex items-center gap-1.5 ml-auto cursor-pointer shadow-2xs border border-amber-200"
                        >
                          <CreditCard size={14} />
                          <span>Passe VIP</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digital VIP Card Modal */}
      {selectedClientForCard && (
        <DigitalLoyaltyCardModal
          client={selectedClientForCard}
          onClose={() => setSelectedClientForCard(null)}
        />
      )}
    </div>
  );
}
