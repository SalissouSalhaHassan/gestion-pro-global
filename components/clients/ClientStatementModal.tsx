"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  FileText,
  Printer,
  Calendar,
  DollarSign,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  User,
  Building2,
  Wallet,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
  Download
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

interface ClientStatementModalProps {
  isOpen: boolean;
  clientId: string | number;
  clientNom: string;
  clientTel?: string | null;
  onClose: () => void;
}

export default function ClientStatementModal({
  isOpen,
  clientId,
  clientNom,
  clientTel,
  onClose,
}: ClientStatementModalProps) {
  const { dir } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Date filters
  const [preset, setPreset] = useState<"ALL" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM">("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const handlePresetChange = (newPreset: "ALL" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM") => {
    setPreset(newPreset);
    const now = new Date();
    if (newPreset === "ALL") {
      setStartDate("");
      setEndDate("");
    } else if (newPreset === "MONTH") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (newPreset === "QUARTER") {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (newPreset === "YEAR") {
      const firstDay = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      const lastDay = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
      setStartDate(firstDay);
      setEndDate(lastDay);
    }
  };

  const fetchStatement = async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      let url = `/api/clients/${clientId}/statement`;
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);
      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Impossible de charger le relevé");

      setData(result);
    } catch (err: any) {
      console.error("Statement fetch error:", err);
      setError(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && clientId) {
      fetchStatement();
    }
  }, [isOpen, clientId, startDate, endDate]);

  if (!isOpen) return null;

  const handlePrint = () => {
    let url = `/api/clients/${clientId}/statement/pdf?autoPrint=true`;
    if (startDate) url += `&start=${startDate}`;
    if (endDate) url += `&end=${endDate}`;
    window.open(url, "_blank");
  };

  const handleWhatsAppSend = () => {
    const phone = data?.client?.tel || clientTel;
    if (!phone) {
      alert("Numéro de téléphone introuvable pour ce client.");
      return;
    }

    const netDebt = data?.client?.total_dette || 0;
    const formattedDebt = netDebt.toLocaleString("fr-FR") + " FCFA";
    const unusedAdv = (data?.client?.solde_avances || 0).toLocaleString("fr-FR") + " FCFA";

    let text = `Bonjour Cher(e) ${data?.client?.nom || clientNom},\n\nVoici le point de situation de votre compte chez *${data?.company?.nom || "GESTION PRO GLOBAL"}* :\n\n`;
    text += `💰 *Solde Dû Actuel :* ${formattedDebt}\n`;
    if (data?.client?.solde_avances > 0) {
      text += `🏦 *Acomptes / Avances disponibles :* ${unusedAdv}\n`;
    }

    if (data?.balance_agee?.total_unpaid > 0) {
      text += `\n📊 *Répartition de vos factures en attente :*\n`;
      if (data.balance_agee.range_0_30 > 0) text += `• 0-30j : ${data.balance_agee.range_0_30.toLocaleString("fr-FR")} FCFA\n`;
      if (data.balance_agee.range_31_60 > 0) text += `• 31-60j : ${data.balance_agee.range_31_60.toLocaleString("fr-FR")} FCFA\n`;
      if (data.balance_agee.range_61_90 > 0) text += `• 61-90j : ${data.balance_agee.range_61_90.toLocaleString("fr-FR")} FCFA\n`;
      if (data.balance_agee.range_over_90 > 0) text += `• +90j (Urgent) : ${data.balance_agee.range_over_90.toLocaleString("fr-FR")} FCFA\n`;
    }

    text += `\nPour toute question ou pour obtenir votre relevé officiel détaillé, n'hésitez pas à nous contacter.\n\nCordialement,\n*Direction Financière*`;

    openWhatsAppDirect(phone, text);
  };

  const filteredEvents = (data?.events || []).filter((e: any) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      e.reference?.toLowerCase().includes(q) ||
      e.type?.toLowerCase().includes(q) ||
      e.notes?.toLowerCase().includes(q) ||
      e.moyen_paiement?.toLowerCase().includes(q)
    );
  });

  const balanceAgee = data?.balance_agee || {
    range_0_30: 0,
    range_31_60: 0,
    range_61_90: 0,
    range_over_90: 0,
    total_unpaid: 0,
  };

  const totalUnpaid = balanceAgee.total_unpaid || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn" dir={dir}>
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-7 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
              <FileText size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Relevé de Compte Client 4K
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                  {data?.client?.ref_client || "Réf. Client"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Client : <span className="font-bold text-slate-800 dark:text-slate-200">{data?.client?.nom || clientNom}</span>
                {data?.client?.tel && <span> • Tél: {data.client.tel}</span>}
                {data?.client?.type_client && <span> • Catégorie: {data.client.type_client}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleWhatsAppSend}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all"
              title="Envoyer le point de situation par WhatsApp"
            >
              <MessageSquare size={16} />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all"
              title="Imprimer le relevé officiel A4 / Exporter en PDF"
            >
              <Printer size={16} />
              <span>Imprimer A4</span>
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filters & Presets Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/40 text-xs font-semibold">
          <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
            {[
              { key: "ALL", label: "Tout l'historique" },
              { key: "MONTH", label: "Ce Mois" },
              { key: "QUARTER", label: "Ce Trimestre" },
              { key: "YEAR", label: "Cette Année" },
              { key: "CUSTOM", label: "Personnalisé" },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePresetChange(p.key as any)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  preset === p.key
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === "CUSTOM" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs"
              />
              <span className="text-slate-400">à</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs"
              />
            </div>
          )}

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrer les écritures..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-7 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <RefreshCw size={32} className="animate-spin text-indigo-600" />
              <p className="text-sm font-semibold">Génération du relevé de compte en temps réel...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
              <AlertTriangle size={20} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Solde Initial */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                    Solde Initial
                  </span>
                  <div className="text-xl font-extrabold text-slate-800 dark:text-slate-200 mt-1">
                    {Number(data?.summary?.solde_initial || 0).toLocaleString("fr-FR")}{" "}
                    <span className="text-xs font-semibold text-slate-400">FCFA</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Avant la période</span>
                </div>

                {/* Total Facturé (Débit) */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-700 dark:text-indigo-300">
                      Total Facturé (Achats)
                    </span>
                    <ArrowDownRight size={16} className="text-indigo-600" />
                  </div>
                  <div className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-1">
                    {Number(data?.summary?.total_debit || 0).toLocaleString("fr-FR")}{" "}
                    <span className="text-xs font-semibold text-indigo-500">FCFA</span>
                  </div>
                  <span className="text-[10px] text-indigo-500">Débit sur la période</span>
                </div>

                {/* Total Règlements (Crédit) */}
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">
                      Total Règlements (Payé)
                    </span>
                    <ArrowUpRight size={16} className="text-emerald-600" />
                  </div>
                  <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                    {Number(data?.summary?.total_credit || 0).toLocaleString("fr-FR")}{" "}
                    <span className="text-xs font-semibold text-emerald-500">FCFA</span>
                  </div>
                  <span className="text-[10px] text-emerald-500">Crédit sur la période</span>
                </div>

                {/* Solde Dû Global Net */}
                <div className={`p-4 rounded-2xl border ${
                  (data?.client?.total_dette || 0) > 0
                    ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50"
                    : "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] uppercase tracking-wider font-bold ${
                      (data?.client?.total_dette || 0) > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
                    }`}>
                      Dette Nette Globale
                    </span>
                    {(data?.client?.total_dette || 0) > 0 ? (
                      <ShieldAlert size={16} className="text-rose-600" />
                    ) : (
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    )}
                  </div>
                  <div className={`text-xl font-black mt-1 ${
                    (data?.client?.total_dette || 0) > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
                  }`}>
                    {Number(data?.client?.total_dette || 0).toLocaleString("fr-FR")}{" "}
                    <span className="text-xs font-semibold opacity-75">FCFA</span>
                  </div>
                  <span className="text-[10px] opacity-75">
                    {(data?.client?.solde_avances || 0) > 0
                      ? `Avance dispo: ${Number(data.client.solde_avances).toLocaleString()} FCFA`
                      : "Créance totale client"}
                  </span>
                </div>
              </div>

              {/* Aging Balance Radar (Balance Âgée) */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/20 dark:from-slate-850 dark:to-indigo-950/20 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-indigo-600" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                      Radar de Recouvrement (Balance Âgée des Factures Non Soldées)
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    Total Impayé : {balanceAgee.total_unpaid.toLocaleString("fr-FR")} FCFA
                  </span>
                </div>

                {/* Segmented Color Bar */}
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${(balanceAgee.range_0_30 / totalUnpaid) * 100}%` }}
                    className="bg-emerald-500 transition-all"
                    title={`0-30j: ${balanceAgee.range_0_30.toLocaleString()} FCFA`}
                  />
                  <div
                    style={{ width: `${(balanceAgee.range_31_60 / totalUnpaid) * 100}%` }}
                    className="bg-amber-400 transition-all"
                    title={`31-60j: ${balanceAgee.range_31_60.toLocaleString()} FCFA`}
                  />
                  <div
                    style={{ width: `${(balanceAgee.range_61_90 / totalUnpaid) * 100}%` }}
                    className="bg-orange-500 transition-all"
                    title={`61-90j: ${balanceAgee.range_61_90.toLocaleString()} FCFA`}
                  />
                  <div
                    style={{ width: `${(balanceAgee.range_over_90 / totalUnpaid) * 100}%` }}
                    className="bg-rose-600 transition-all"
                    title={`>90j: ${balanceAgee.range_over_90.toLocaleString()} FCFA`}
                  />
                </div>

                {/* Segment Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/40">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>0 à 30 jours (Normal)</span>
                    </div>
                    <div className="font-extrabold text-slate-800 dark:text-white">
                      {balanceAgee.range_0_30.toLocaleString("fr-FR")} FCFA
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-900/40">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <span>31 à 60 jours</span>
                    </div>
                    <div className="font-extrabold text-slate-800 dark:text-white">
                      {balanceAgee.range_31_60.toLocaleString("fr-FR")} FCFA
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/40">
                    <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 font-bold mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      <span>61 à 90 jours (Alerte)</span>
                    </div>
                    <div className="font-extrabold text-slate-800 dark:text-white">
                      {balanceAgee.range_61_90.toLocaleString("fr-FR")} FCFA
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/40">
                    <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                      <span>+ 90 jours (Critique)</span>
                    </div>
                    <div className="font-extrabold text-rose-700 dark:text-rose-400">
                      {balanceAgee.range_over_90.toLocaleString("fr-FR")} FCFA
                    </div>
                  </div>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                      <tr>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4">Type & Réf.</th>
                        <th className="py-3.5 px-4">Description / Mode</th>
                        <th className="py-3.5 px-4 text-right">Débit (Achat)</th>
                        <th className="py-3.5 px-4 text-right">Crédit (Payé)</th>
                        <th className="py-3.5 px-4 text-right">Solde Progressif</th>
                        <th className="py-3.5 px-4">Opérateur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredEvents.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            Aucune écriture trouvée pour cette période.
                          </td>
                        </tr>
                      ) : (
                        filteredEvents.map((e: any) => (
                          <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">
                              {new Date(e.date).toLocaleDateString("fr-FR")}{" "}
                              <span className="text-[10px] text-slate-400">
                                {new Date(e.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-bold text-slate-900 dark:text-white block">
                                {e.reference}
                              </span>
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                                {e.type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              <div>{e.notes || "—"}</div>
                              <span className="text-[10px] text-slate-400 font-semibold">{e.moyen_paiement}</span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                              {e.debit > 0 ? `${Number(e.debit).toLocaleString("fr-FR")} F` : "—"}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600">
                              {e.credit > 0 ? `${Number(e.credit).toLocaleString("fr-FR")} F` : "—"}
                            </td>
                            <td className={`py-3 px-4 text-right font-extrabold whitespace-nowrap ${
                              e.solde_courant < 0 ? "text-rose-600" : e.solde_courant > 0 ? "text-emerald-600" : "text-slate-600"
                            }`}>
                              {Number(e.solde_courant).toLocaleString("fr-FR")} F
                            </td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">
                              {e.utilisateur || "Admin"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Total écritures : <span className="font-bold text-slate-700 dark:text-slate-300">{data?.events?.length || 0}</span>
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
