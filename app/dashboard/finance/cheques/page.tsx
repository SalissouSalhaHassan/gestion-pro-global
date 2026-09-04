"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  Download,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Send
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import NewChequeModal from "@/components/cheques/NewChequeModal";
import ChequeActionModal from "@/components/cheques/ChequeActionModal";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

interface ChequeItem {
  id: number;
  type_operation: "A_ENCAISSER" | "EMIS";
  type_titre: "CHEQUE" | "EFFET" | "BILLET_A_ORDRE";
  numero_piece: string;
  banque_emetteur: string;
  emetteur_nom: string;
  beneficiaire_nom: string;
  montant: number;
  date_emission: string;
  date_echeance: string;
  statut: "EN_PORTEFEUILLE" | "DEPOSE_BANQUE" | "ENCAISSE" | "REJETE" | "ANNULE";
  client_id?: number | null;
  fournisseur_id?: number | null;
  bordereau_remise?: string | null;
  motif_rejet?: string | null;
  notes?: string | null;
  client?: { nom: string; tel?: string; adresse?: string } | null;
  fournisseur?: { nom: string; tel?: string } | null;
}

export default function ChequesEffetsPage() {
  const { t, dir } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [cheques, setCheques] = useState<ChequeItem[]>([]);
  const [kpis, setKpis] = useState({
    totalEnPortefeuille: 0,
    countEnPortefeuille: 0,
    totalEchusRetard: 0,
    countEchusRetard: 0,
    totalEcheanceSemaine: 0,
    countEcheanceSemaine: 0,
    totalEncaisses: 0,
    countEncaisses: 0,
  });

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedCheque, setSelectedCheque] = useState<ChequeItem | null>(null);

  const fetchCheques = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cheques?type=${typeFilter}&status=${statusFilter}`);
      const data = await res.json();
      if (res.ok) {
        setCheques(data.cheques || []);
        if (data.kpis) setKpis(data.kpis);
      }
    } catch (err) {
      console.error("Failed to fetch cheques:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheques();
  }, [typeFilter, statusFilter]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const getDueBadge = (dueDateStr: string, statut: string) => {
    if (statut === "ENCAISSE" || statut === "ANNULE") return null;

    const due = new Date(dueDateStr);
    const today = new Date(todayStr);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse">
          <AlertTriangle size={12} />
          <span>Échu ({Math.abs(diffDays)}j de retard)</span>
        </span>
      );
    } else if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
          <Clock size={12} />
          <span>Échéance Aujourd'hui</span>
        </span>
      );
    } else if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
          <Clock size={12} />
          <span>Dans {diffDays}j</span>
        </span>
      );
    }
    return null;
  };

  // Filtered by search query
  const filteredCheques = useMemo(() => {
    if (!searchQuery.trim()) return cheques;
    const q = searchQuery.toLowerCase();
    return cheques.filter((c) =>
      c.numero_piece?.toLowerCase().includes(q) ||
      c.banque_emetteur?.toLowerCase().includes(q) ||
      c.emetteur_nom?.toLowerCase().includes(q) ||
      c.beneficiaire_nom?.toLowerCase().includes(q) ||
      c.client?.nom?.toLowerCase().includes(q)
    );
  }, [cheques, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16" dir={dir}>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-6 rounded-[32px] border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-indigo-800 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <CreditCard size={28} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Chèques, Traites & Effets 4K
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Coffre-fort des effets de commerce, remises en banque et radar anti-impayés
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCheques}
            disabled={loading}
            className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
            title="Rafraîchir"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus size={18} />
            <span>Nouveau Chèque / Traite</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: En Portefeuille */}
        <div className="p-5 rounded-[26px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              En Portefeuille (Coffre)
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {kpis.totalEnPortefeuille.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-bold text-slate-500">FCFA</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 font-medium">
            {kpis.countEnPortefeuille} titre(s) en attente
          </div>
        </div>

        {/* KPI 2: Retard / Échus */}
        <div className="p-5 rounded-[26px] bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Radar Retard / Échus
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center">
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400">
            {kpis.totalEchusRetard.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-bold text-rose-600/70">FCFA</span>
          </div>
          <div className="text-xs text-rose-600/80 mt-1 font-semibold">
            {kpis.countEchusRetard} chèque(s) dépassé(s)
          </div>
        </div>

        {/* KPI 3: Échéances 7 Jours */}
        <div className="p-5 rounded-[26px] bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
              Échéances à 7 Jours
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-800 dark:text-amber-400">
            {kpis.totalEcheanceSemaine.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-bold text-amber-700/70">FCFA</span>
          </div>
          <div className="text-xs text-amber-700/80 mt-1 font-medium">
            {kpis.countEcheanceSemaine} titre(s) encaissable(s)
          </div>
        </div>

        {/* KPI 4: Encaissés */}
        <div className="p-5 rounded-[26px] bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
              Total Encaissé
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-800 dark:text-emerald-400">
            {kpis.totalEncaisses.toLocaleString("fr-FR")}{" "}
            <span className="text-xs font-bold text-emerald-700/70">FCFA</span>
          </div>
          <div className="text-xs text-emerald-700/80 mt-1 font-medium">
            {kpis.countEncaisses} titre(s) validé(s)
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par n° de chèque, banque, client, tireur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Operation Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold">
            {[
              { key: "ALL", label: "Tous" },
              { key: "A_ENCAISSER", label: "À Encaisser" },
              { key: "EMIS", label: "Émis" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  typeFilter === f.key
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="EN_PORTEFEUILLE">En Portefeuille</option>
            <option value="DEPOSE_BANQUE">Déposé en Banque</option>
            <option value="ENCAISSE">Encaissé</option>
            <option value="REJETE">Rejeté / Impayé</option>
          </select>
        </div>
      </div>

      {/* Cheques Table */}
      <div className="rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-500 uppercase font-bold tracking-wider">
              <tr>
                <th className="py-4 px-6">Pièce & Banque</th>
                <th className="py-4 px-6">Tireur (Émetteur)</th>
                <th className="py-4 px-6">Bénéficiaire</th>
                <th className="py-4 px-6">Montant Nominal</th>
                <th className="py-4 px-6">Échéance & Radar</th>
                <th className="py-4 px-6">Statut</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredCheques.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <CreditCard size={42} className="text-slate-300 dark:text-slate-700" />
                      <p className="text-base font-semibold text-slate-600 dark:text-slate-400">
                        Aucun chèque ou effet de commerce trouvé
                      </p>
                      <button
                        onClick={() => setIsNewModalOpen(true)}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        + Enregistrer le premier chèque
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCheques.map((c) => {
                  const dueBadge = getDueBadge(c.date_echeance, c.statut);
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => setSelectedCheque(c)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                            {c.type_titre === "CHEQUE" ? "CHQ" : c.type_titre === "EFFET" ? "TRA" : "BLT"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span>{c.numero_piece}</span>
                              {c.type_operation === "A_ENCAISSER" ? (
                                <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded font-bold">
                                  Client
                                </span>
                              ) : (
                                <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded font-bold">
                                  Émis
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                              <Building2 size={12} />
                              {c.banque_emetteur}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="text-slate-900 dark:text-white font-semibold">
                          {c.emetteur_nom}
                        </div>
                        {c.client?.tel && (
                          <div className="text-xs text-slate-400">
                            Tél: {c.client.tel}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-6">
                        <div className="text-slate-700 dark:text-slate-300">
                          {c.beneficiaire_nom}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="font-extrabold text-base text-slate-900 dark:text-white">
                          {Number(c.montant).toLocaleString("fr-FR")}{" "}
                          <span className="text-xs font-semibold text-slate-500">FCFA</span>
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {new Date(c.date_echeance).toLocaleDateString("fr-FR")}
                          </span>
                          {dueBadge}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                            c.statut === "ENCAISSE"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : c.statut === "DEPOSE_BANQUE"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                              : c.statut === "REJETE"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                          }`}
                        >
                          {c.statut === "EN_PORTEFEUILLE" && "En Portefeuille"}
                          {c.statut === "DEPOSE_BANQUE" && "Déposé en Banque"}
                          {c.statut === "ENCAISSE" && "Encaissé"}
                          {c.statut === "REJETE" && "Rejeté / Impayé"}
                          {c.statut === "ANNULE" && "Annulé"}
                        </span>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {c.client?.tel && (
                            <button
                              onClick={() => {
                                const formatted = Number(c.montant).toLocaleString("fr-FR") + " FCFA";
                                const text = `Bonjour ${c.emetteur_nom},\nNous vous rappelons l'échéance du chèque N° ${c.numero_piece} de ${formatted} (Banque: ${c.banque_emetteur}) au ${c.date_echeance}.\nCordialement.`;
                                openWhatsAppDirect(c.client!.tel!, text);
                              }}
                              title="Message WhatsApp rapide"
                              className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            >
                              <Send size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedCheque(c)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:border-indigo-500 hover:text-indigo-600 transition-colors shadow-sm"
                          >
                            Gérer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Cheque Modal */}
      <NewChequeModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={fetchCheques}
      />

      {/* Cheque Action / Details Modal */}
      {selectedCheque && (
        <ChequeActionModal
          isOpen={Boolean(selectedCheque)}
          cheque={selectedCheque}
          onClose={() => setSelectedCheque(null)}
          onSuccess={fetchCheques}
        />
      )}
    </div>
  );
}
