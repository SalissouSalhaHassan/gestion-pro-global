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
  Send,
  Printer,
  Copy,
  Check,
  CheckSquare,
  Square,
  Sparkles,
  Database
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import NewChequeModal from "@/components/cheques/NewChequeModal";
import ChequeActionModal from "@/components/cheques/ChequeActionModal";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

const SQL_MIGRATION_SCRIPT = `-- ==============================================================================
-- MIGRATION: cheques_effets (Check Clearing House & Commercial Papers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cheques_effets (
    id SERIAL PRIMARY KEY,
    type_operation VARCHAR(20) NOT NULL, -- 'A_ENCAISSER' (Client), 'EMIS' (Fournisseur)
    type_titre VARCHAR(30) NOT NULL DEFAULT 'CHEQUE', -- 'CHEQUE', 'EFFET', 'BILLET_A_ORDRE'
    numero_piece VARCHAR(100) NOT NULL,
    banque_emetteur VARCHAR(100) NOT NULL,
    emetteur_nom VARCHAR(150) NOT NULL,
    beneficiaire_nom VARCHAR(150) NOT NULL,
    montant NUMERIC(15, 2) NOT NULL DEFAULT 0,
    date_emission DATE NOT NULL DEFAULT CURRENT_DATE,
    date_echeance DATE NOT NULL,
    statut VARCHAR(30) NOT NULL DEFAULT 'EN_PORTEFEUILLE',
    client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
    fournisseur_id INTEGER REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
    facture_id INTEGER REFERENCES public.factures(id) ON DELETE SET NULL,
    date_encaissement TIMESTAMP WITH TIME ZONE,
    date_depot TIMESTAMP WITH TIME ZONE,
    bordereau_remise VARCHAR(100),
    motif_rejet TEXT,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Support migration if table already exists without organization_id
ALTER TABLE public.cheques_effets ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cheques_org ON public.cheques_effets (organization_id);
CREATE INDEX IF NOT EXISTS idx_cheques_type_op ON public.cheques_effets (type_operation);
CREATE INDEX IF NOT EXISTS idx_cheques_statut ON public.cheques_effets (statut);
CREATE INDEX IF NOT EXISTS idx_cheques_date_echeance ON public.cheques_effets (date_echeance);
CREATE INDEX IF NOT EXISTS idx_cheques_client ON public.cheques_effets (client_id);
CREATE INDEX IF NOT EXISTS idx_cheques_created_at ON public.cheques_effets (created_at DESC);

ALTER TABLE public.cheques_effets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read for all authenticated on cheques_effets"
  ON public.cheques_effets FOR SELECT USING (true);
CREATE POLICY "Enable write for all authenticated on cheques_effets"
  ON public.cheques_effets FOR ALL USING (true);
NOTIFY pgrst, 'reload schema';`;

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

function numberToFrenchWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "zéro";

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

  function chunkToWords(n: number): string {
    if (n === 0) return "";
    let str = "";
    const h = Math.floor(n / 100);
    const rest = n % 100;

    if (h > 0) {
      if (h === 1) str += "cent ";
      else str += units[h] + (rest === 0 ? " cents " : " cent ");
    }

    if (rest > 0) {
      if (rest < 10) {
        str += units[rest];
      } else if (rest >= 10 && rest < 20) {
        str += teens[rest - 10];
      } else {
        const d = Math.floor(rest / 10);
        const u = rest % 10;
        if (d === 7) {
          str += "soixante-" + teens[u];
        } else if (d === 8) {
          if (u === 0) str += "quatre-vingts";
          else str += "quatre-vingt-" + units[u];
        } else if (d === 9) {
          str += "quatre-vingt-" + teens[u];
        } else {
          if (u === 1 && d < 8) {
            str += tens[d] + "-et-un";
          } else if (u > 0) {
            str += tens[d] + "-" + units[u];
          } else {
            str += tens[d];
          }
        }
      }
    }
    return str.trim();
  }

  const intPart = Math.floor(Math.abs(amount));
  const billions = Math.floor(intPart / 1000000000);
  let remainder = intPart % 1000000000;
  const millions = Math.floor(remainder / 1000000);
  remainder = remainder % 1000000;
  const thousands = Math.floor(remainder / 1000);
  const unitsRest = remainder % 1000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(chunkToWords(billions) + (billions > 1 ? " milliards" : " milliard"));
  }
  if (millions > 0) {
    parts.push(chunkToWords(millions) + (millions > 1 ? " millions" : " million"));
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push("mille");
    else parts.push(chunkToWords(thousands) + " mille");
  }
  if (unitsRest > 0) {
    parts.push(chunkToWords(unitsRest));
  }

  const res = parts.join(" ").replace(/\s+/g, " ").trim();
  return res ? res.charAt(0).toUpperCase() + res.slice(1) : "Zéro";
}

export default function ChequesEffetsPage() {
  const { t, dir } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [cheques, setCheques] = useState<ChequeItem[]>([]);
  const [dbNeedsSetup, setDbNeedsSetup] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isBordereauModalOpen, setIsBordereauModalOpen] = useState(false);
  const [selectedBankForBordereau, setSelectedBankForBordereau] = useState<string>("ALL");
  const [selectedChequeIds, setSelectedChequeIds] = useState<number[]>([]);
  const [depositAccountRIB, setDepositAccountRIB] = useState<string>("");
  const [bordereauRef, setBordereauRef] = useState<string>(() => {
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `BDR-${d}-${Math.floor(100 + Math.random() * 900)}`;
  });
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [receiptCheque, setReceiptCheque] = useState<ChequeItem | null>(null);

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

  const fetchCompanyInfo = async () => {
    try {
      const res = await fetch("/api/settings/company");
      if (res.ok) {
        const data = await res.json();
        if (data.company) {
          setCompanyInfo(data.company);
          if (data.company.compte_bancaire || data.company.rib) {
            setDepositAccountRIB(data.company.compte_bancaire || data.company.rib);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load company info:", err);
    }
  };

  const fetchCheques = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cheques?type=${typeFilter}&status=${statusFilter}`);
      const data = await res.json();
      if (res.ok) {
        setCheques(data.cheques || []);
        if (data.kpis) setKpis(data.kpis);
        setDbNeedsSetup(false);
      } else {
        if (data.error && (data.error.includes("cheques_effets") || data.error.includes("does not exist") || data.error.includes("42P01"))) {
          setDbNeedsSetup(true);
        }
      }
    } catch (err) {
      console.error("Failed to fetch cheques:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheques();
    fetchCompanyInfo();
  }, [typeFilter, statusFilter]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_SCRIPT);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
  };

  const exportToCSV = () => {
    if (filteredCheques.length === 0) return;
    const headers = [
      "ID",
      "Type Opération",
      "Titre",
      "Numéro Pièce",
      "Banque",
      "Tireur (Émetteur)",
      "Bénéficiaire",
      "Montant Nominal (FCFA)",
      "Date Émission",
      "Date Échéance",
      "Statut",
      "Bordereau Remise",
      "Motif Rejet"
    ];

    const rows = filteredCheques.map((c) => [
      c.id,
      c.type_operation,
      c.type_titre,
      `"${(c.numero_piece || "").replace(/"/g, '""')}"`,
      `"${(c.banque_emetteur || "").replace(/"/g, '""')}"`,
      `"${(c.emetteur_nom || "").replace(/"/g, '""')}"`,
      `"${(c.beneficiaire_nom || "").replace(/"/g, '""')}"`,
      c.montant,
      c.date_emission,
      c.date_echeance,
      c.statut,
      `"${(c.bordereau_remise || "").replace(/"/g, '""')}"`,
      `"${(c.motif_rejet || "").replace(/"/g, '""')}"`
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `registre_cheques_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  // Cheques for remittance slip
  const bordereauCheques = useMemo(() => {
    return cheques.filter((c) => {
      const isBankMatch = selectedBankForBordereau === "ALL" || c.banque_emetteur === selectedBankForBordereau;
      const isStatusMatch = c.statut === "EN_PORTEFEUILLE" || c.statut === "DEPOSE_BANQUE";
      return isBankMatch && isStatusMatch && c.type_operation === "A_ENCAISSER";
    });
  }, [cheques, selectedBankForBordereau]);

  const uniqueBanks = useMemo(() => {
    const list = cheques.map((c) => c.banque_emetteur).filter(Boolean);
    return Array.from(new Set(list));
  }, [cheques]);

  // Sync selected cheques when available cheques or selected bank changes
  useEffect(() => {
    setSelectedChequeIds(bordereauCheques.map((c) => c.id));
  }, [selectedBankForBordereau, cheques]);

  const chequesToPrint = useMemo(() => {
    return bordereauCheques.filter((c) => selectedChequeIds.includes(c.id));
  }, [bordereauCheques, selectedChequeIds]);

  const totalRemiseAmount = useMemo(() => {
    return chequesToPrint.reduce((sum, c) => sum + (Number(c.montant) || 0), 0);
  }, [chequesToPrint]);

  const toggleSelectAllCheques = () => {
    if (selectedChequeIds.length === bordereauCheques.length) {
      setSelectedChequeIds([]);
    } else {
      setSelectedChequeIds(bordereauCheques.map((c) => c.id));
    }
  };

  const toggleChequeSelection = (id: number) => {
    setSelectedChequeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16" dir={dir}>
      {/* SCREEN-ONLY DASHBOARD CONTENT (COMPLETELY HIDDEN ON PRINT) */}
      <div className="space-y-6 screen-only print:hidden no-print">
        {/* Database Missing Banner if needed */}
      {dbNeedsSetup && (
        <div className="p-5 rounded-[28px] bg-gradient-to-r from-amber-500/15 via-indigo-500/10 to-transparent border border-amber-500/30 dark:border-amber-500/20 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
              <Database size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Module Chèques & Effets : Table en attente d'initialisation
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                La table <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 font-mono text-amber-800 dark:text-amber-300">cheques_effets</code> n'est pas encore créée dans votre base Supabase. Copiez le script SQL en 1-clic pour l'exécuter dans votre console.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopySql}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all"
            >
              {sqlCopied ? <Check size={16} /> : <Copy size={16} />}
              <span>{sqlCopied ? "SQL Copié !" : "Copier SQL (1-Clic)"}</span>
            </button>
            <button
              onClick={() => setIsSqlModalOpen(true)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Voir le script
            </button>
          </div>
        </div>
      )}

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

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchCheques}
            disabled={loading}
            className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"
            title="Rafraîchir"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>

          <button
            onClick={exportToCSV}
            disabled={filteredCheques.length === 0}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-bold text-sm shadow-sm transition-all disabled:opacity-50"
            title="Exporter en CSV"
          >
            <Download size={17} />
            <span className="hidden sm:inline">Exporter CSV</span>
          </button>

          <button
            onClick={() => {
              setSelectedChequeIds(bordereauCheques.map((c) => c.id));
              setIsBordereauModalOpen(true);
            }}
            disabled={cheques.length === 0}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-sm shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Printer size={17} />
            <span>Bordereau de Remise Bancaire</span>
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-sm shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus size={18} />
            <span>Nouveau Chèque</span>
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
                            onClick={() => setReceiptCheque(c)}
                            title="Imprimer Récépissé / Décharge Client"
                            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-500 hover:text-indigo-600 transition-colors shadow-sm cursor-pointer"
                          >
                            <Printer size={15} />
                          </button>
                          <button
                            onClick={() => setSelectedCheque(c)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:border-indigo-500 hover:text-indigo-600 transition-colors shadow-sm cursor-pointer"
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
          onPrintReceipt={(cheque) => {
            setSelectedCheque(null);
            setReceiptCheque(cheque);
          }}
        />
      )}

      {/* SQL Migration Helper Modal */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn" dir={dir}>
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50 to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Script SQL : Module Chèques & Effets
                  </h3>
                  <p className="text-xs text-slate-500">
                    Copiez et collez ce script dans l'Éditeur SQL de votre tableau de bord Supabase
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSqlModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs bg-slate-950 text-slate-200">
              <pre className="whitespace-pre-wrap">{SQL_MIGRATION_SCRIPT}</pre>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
              <span className="text-xs text-slate-500">
                Fichier source : migrations/20260904_cheques_and_effets.sql
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all"
                >
                  {sqlCopied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{sqlCopied ? "Copié avec succès !" : "Copier le Script SQL"}</span>
                </button>
                <button
                  onClick={() => setIsSqlModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-xs"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bordereau de Remise Bancaire Printable Modal */}
      {isBordereauModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn bordereau-modal-overlay print:static print:p-0 print:bg-white print:backdrop-blur-none" dir={dir}>
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] bordereau-modal-card print:border-none print:shadow-none print:rounded-none print:max-w-full print:max-h-none print:bg-white print:overflow-visible">
            
            {/* Modal Control Header (Hidden on Print) */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-slate-50 dark:from-slate-900 dark:to-indigo-950/30 no-print print:hidden bordereau-modal-header">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30 shrink-0">
                  <Printer size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    Bordereau de Remise Bancaire
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase">
                      Format A4 4K
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bordereau officiel d'encaissement bancaire • {chequesToPrint.length} sélectionné(s) • Total: {totalRemiseAmount.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedBankForBordereau}
                  onChange={(e) => setSelectedBankForBordereau(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  title="Filtrer par Banque"
                >
                  <option value="ALL">Toutes les banques</option>
                  {uniqueBanks.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={depositAccountRIB}
                  onChange={(e) => setDepositAccountRIB(e.target.value)}
                  placeholder="RIB / N° Compte Dépôt"
                  className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
                  title="N° de Compte ou RIB à créditer"
                />

                <button
                  onClick={toggleSelectAllCheques}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
                  title="Cocher / Décocher tout"
                >
                  {selectedChequeIds.length === bordereauCheques.length ? "Tout décocher" : "Tout cocher"}
                </button>

                <button
                  onClick={() => window.print()}
                  disabled={chequesToPrint.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Printer size={16} />
                  <span>Imprimer Bordereau (A4)</span>
                </button>

                <button
                  onClick={() => setIsBordereauModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Quick Cheque Toggle Bar on Screen (Hidden on Print) */}
            {bordereauCheques.length > 1 && (
              <div className="px-6 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 text-xs flex flex-wrap items-center gap-3 no-print print:hidden">
                <span className="font-bold text-slate-500">Sélectionner les pièces :</span>
                {bordereauCheques.map((c) => {
                  const isChecked = selectedChequeIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggleChequeSelection(c.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all ${
                        isChecked
                          ? "bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold dark:bg-indigo-950/70 dark:text-indigo-300"
                          : "bg-white text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {isChecked ? <CheckSquare size={13} className="text-indigo-600" /> : <Square size={13} />}
                      <span>{c.numero_piece}</span>
                      <span className="text-[10px] opacity-75">({Number(c.montant).toLocaleString("fr-FR")} F)</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Printable Remittance Sheet Body */}
            <div className="p-8 overflow-y-auto flex-1 bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible print:h-auto print:max-h-none print:w-full print:block" id="printable-bordereau">
              <div className="max-w-4xl mx-auto bg-white text-slate-900 border-2 border-slate-900 p-8 rounded-2xl print:border-2 print:border-black print:p-5 print:rounded-none print:max-w-full">
                
                {/* Header: Company Profile + Bank Slip Title & Ref */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 mb-5">
                  <div className="flex items-center gap-4">
                    {companyInfo?.logo_url ? (
                      <img src={companyInfo.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-xl print:w-14 print:h-14" />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl print:border print:border-black">
                        {companyInfo?.nom_entreprise ? companyInfo.nom_entreprise.charAt(0).toUpperCase() : "G"}
                      </div>
                    )}
                    <div>
                      <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                        {companyInfo?.nom_entreprise || "GESTION PRO GLOBAL"}
                      </h1>
                      <p className="text-xs text-slate-600 font-medium">
                        {companyInfo?.adresse || "Siège Social"}
                      </p>
                      <div className="flex flex-wrap gap-x-3 text-[11px] text-slate-500 font-medium mt-0.5">
                        {companyInfo?.telephone && <span>Tél : <strong className="text-slate-800">{companyInfo.telephone}</strong></span>}
                        {companyInfo?.email && <span>Email : <strong className="text-slate-800">{companyInfo.email}</strong></span>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500 font-bold mt-1">
                        {companyInfo?.nif && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">NIF : {companyInfo.nif}</span>}
                        {companyInfo?.rc && <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">RCCM : {companyInfo.rc}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right border-l-2 border-slate-200 pl-6 print:border-slate-400">
                    <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider mb-1.5">
                      Bordereau Bancaire Officiel
                    </span>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                      Remise de Chèques & Effets
                    </h2>
                    <p className="text-xs font-mono font-bold text-indigo-700 print:text-black">
                      Réf : {bordereauRef}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Date : <strong className="text-slate-900">{new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</strong>
                    </p>
                  </div>
                </div>

                {/* Account & Bank Remittance Metadata Box */}
                <div className="grid grid-cols-3 gap-3 p-3.5 mb-5 bg-slate-50 border border-slate-300 rounded-xl text-xs print:bg-white print:border-black">
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">Titulaire du Compte (Remettant) :</span>
                    <p className="font-black text-slate-900 text-xs mt-0.5 uppercase">
                      {companyInfo?.nom_entreprise || "GESTION PRO GLOBAL / ENTREPRISE"}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">Banque Réceptrice & Dépôt :</span>
                    <p className="font-black text-slate-900 text-xs mt-0.5">
                      {selectedBankForBordereau === "ALL" ? "COMPTE BANCAIRE PRINCIPAL" : selectedBankForBordereau}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 uppercase text-[10px] block">Compte à créditer (RIB) :</span>
                    <p className="font-mono font-black text-slate-900 text-xs mt-0.5">
                      {depositAccountRIB || companyInfo?.compte_bancaire || "Compte Courant Commercial"}
                    </p>
                  </div>
                </div>

                {/* Table of Cheques */}
                <table className="w-full text-xs text-left border-collapse border border-slate-900 mb-5">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-extrabold border-b-2 border-slate-900 print:bg-slate-200">
                      <th className="p-2 border border-slate-900 text-center w-10">N°</th>
                      <th className="p-2 border border-slate-900">N° de Chèque</th>
                      <th className="p-2 border border-slate-900">Banque du Tireur</th>
                      <th className="p-2 border border-slate-900">Tireur (Émetteur)</th>
                      <th className="p-2 border border-slate-900 text-center">Échéance</th>
                      <th className="p-2 border border-slate-900 text-right">Montant (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chequesToPrint.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                          Aucun chèque sélectionné pour ce bordereau de remise
                        </td>
                      </tr>
                    ) : (
                      chequesToPrint.map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-300 print:border-black">
                          <td className="p-2 border border-slate-900 text-center font-bold">{idx + 1}</td>
                          <td className="p-2 border border-slate-900 font-mono font-black text-slate-900">{item.numero_piece}</td>
                          <td className="p-2 border border-slate-900 font-semibold">{item.banque_emetteur}</td>
                          <td className="p-2 border border-slate-900 font-medium">{item.emetteur_nom}</td>
                          <td className="p-2 border border-slate-900 text-center text-slate-700">{new Date(item.date_echeance).toLocaleDateString("fr-FR")}</td>
                          <td className="p-2 border border-slate-900 text-right font-mono font-black text-slate-900">
                            {Number(item.montant).toLocaleString("fr-FR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900 print:bg-slate-100">
                      <td colSpan={4} className="p-2.5 text-left uppercase border border-slate-900 text-[11px]">
                        Nombre de pièce(s) remise(s) : <strong className="text-indigo-800 print:text-black">{chequesToPrint.length} pièce(s)</strong>
                      </td>
                      <td className="p-2.5 text-right uppercase border border-slate-900 text-[11px]">
                        Total Général :
                      </td>
                      <td className="p-2.5 text-right font-mono text-sm text-indigo-900 print:text-black border border-slate-900">
                        {totalRemiseAmount.toLocaleString("fr-FR")} FCFA
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Amount in Full Words */}
                <div className="p-3.5 mb-5 bg-slate-50 border border-slate-300 rounded-xl text-xs print:bg-white print:border-black">
                  <span className="font-bold text-slate-500 uppercase text-[10px] block">Montant total en toutes lettres :</span>
                  <p className="font-bold text-slate-900 text-xs italic mt-0.5">
                    Arrêté le présent bordereau à la somme totale de : <span className="underline uppercase not-italic font-black">{numberToFrenchWords(totalRemiseAmount)} Francs CFA</span>.
                  </p>
                </div>

                {/* Legal Mention */}
                <p className="text-[10px] text-slate-500 italic mb-5 text-center print:text-black">
                  * Remis à l'encaissement sous réserve de bonne fin, d'existence de la provision effective et de compensation interbancaire.
                </p>

                {/* Signatures & Bank Stamp Box */}
                <div className="grid grid-cols-2 gap-6 pt-2 text-xs">
                  <div className="border-2 border-slate-900 p-4 rounded-xl min-h-[140px] flex flex-col justify-between print:border-black">
                    <div>
                      <span className="font-black text-slate-900 uppercase tracking-wide block text-[11px]">
                        Cadre Réservé au Déposant / Remettant
                      </span>
                      <span className="text-[10px] text-slate-500 italic block mt-0.5">
                        Mention manuscrite « Bon pour remise de {chequesToPrint.length} chèque(s) »
                      </span>
                    </div>
                    <div className="flex items-end justify-between pt-4">
                      <span className="text-[10px] text-slate-400 font-semibold">Date & Signature :</span>
                      {companyInfo?.cachet_url && (
                        <img src={companyInfo.cachet_url} alt="Cachet Entreprise" className="h-14 object-contain opacity-85 rotate-[-3deg]" />
                      )}
                    </div>
                  </div>

                  <div className="border-2 border-slate-900 p-4 rounded-xl min-h-[140px] flex flex-col justify-between print:border-black">
                    <div>
                      <span className="font-black text-slate-900 uppercase tracking-wide block text-[11px]">
                        Cadre Réservé à l'Établissement Bancaire
                      </span>
                      <span className="text-[10px] text-slate-500 italic block mt-0.5">
                        Date de réception, visa du guichetier & cachet de la banque
                      </span>
                    </div>
                    <div className="flex items-end justify-between pt-4">
                      <span className="text-[10px] text-slate-400 font-semibold">Reçu le : ____/____/2026</span>
                      <span className="text-[10px] text-slate-400 font-semibold">Cachet & Visa Guichet</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Cheque Receipt / Décharge Modal */}
      {receiptCheque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn bordereau-modal-overlay print:static print:p-0 print:bg-white" dir={dir}>
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] bordereau-modal-card print:border-none print:shadow-none print:rounded-none print:max-w-full print:max-h-none print:bg-white print:overflow-visible">
            {/* Header bar (hidden on print) */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-900 dark:to-emerald-950/30 no-print print:hidden bordereau-modal-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/30">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Récépissé de Décharge de Chèque
                  </h3>
                  <p className="text-xs text-slate-500">
                    Preuve officielle de remise du chèque pour le client ou le dossier comptable
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Imprimer Récépissé (A4)</span>
                </button>
                <button
                  onClick={() => setReceiptCheque(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Receipt Body */}
            <div className="p-8 overflow-y-auto flex-1 bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible print:h-auto print:max-h-none print:w-full print:block" id="printable-receipt">
              <div className="border-2 border-slate-900 p-6 rounded-2xl print:border-2 print:border-black print:p-5 print:rounded-none">
                {/* Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    {companyInfo?.logo_url ? (
                      <img src={companyInfo.logo_url} alt="Logo" className="w-12 h-12 object-contain rounded-lg" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                        {companyInfo?.nom_entreprise ? companyInfo.nom_entreprise.charAt(0).toUpperCase() : "G"}
                      </div>
                    )}
                    <div>
                      <h2 className="text-base font-black uppercase text-slate-900">
                        {companyInfo?.nom_entreprise || "GESTION PRO GLOBAL"}
                      </h2>
                      <p className="text-xs text-slate-600 font-medium">{companyInfo?.adresse || "Siège Social"}</p>
                      <p className="text-xs text-slate-600 font-medium">{companyInfo?.telephone && `Tél: ${companyInfo.telephone}`} {companyInfo?.email && `• ${companyInfo.email}`}</p>
                      <p className="text-[10px] text-slate-500 font-bold">{companyInfo?.nif && `NIF: ${companyInfo.nif}`} {companyInfo?.rc && `• RCCM: ${companyInfo.rc}`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 rounded bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider mb-1">
                      Décharge Officielle
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-900">N° REC-CHQ-{receiptCheque.id}-{receiptCheque.numero_piece}</p>
                    <p className="text-xs text-slate-600">Date : {new Date().toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>

                <h3 className="text-center font-black text-sm uppercase tracking-wider text-slate-900 mb-4 bg-slate-100 py-1.5 rounded border border-slate-200 print:bg-slate-100">
                  ATTESTATION DE RÉCEPTION DE CHÈQUE / EFFET DE COMMERCE
                </h3>

                <div className="space-y-3 text-xs mb-6">
                  <p>
                    Nous soussignés, <strong>{companyInfo?.nom_entreprise || "GESTION PRO GLOBAL"}</strong>, certifions avoir reçu ce jour de la part de :
                  </p>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 print:bg-white print:border-black">
                    <p className="font-bold text-slate-900 text-sm">{receiptCheque.emetteur_nom} {receiptCheque.client?.nom && receiptCheque.client.nom !== receiptCheque.emetteur_nom ? `(${receiptCheque.client.nom})` : ""}</p>
                    {receiptCheque.client?.tel && <p className="text-xs text-slate-600">Téléphone : {receiptCheque.client.tel}</p>}
                  </div>

                  <p>Le règlement par chèque / effet dont les caractéristiques sont consignées ci-dessous :</p>

                  <table className="w-full text-xs border-collapse border border-slate-900">
                    <tbody>
                      <tr className="border-b border-slate-900">
                        <td className="p-2 border border-slate-900 font-bold bg-slate-100 w-1/3">Type de Titre</td>
                        <td className="p-2 border border-slate-900 font-bold">{receiptCheque.type_titre === "CHEQUE" ? "Chèque Bancaire" : receiptCheque.type_titre === "EFFET" ? "Lettre de Change / Traite" : "Billet à Ordre"}</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="p-2 border border-slate-900 font-bold bg-slate-100">Numéro du Titre</td>
                        <td className="p-2 border border-slate-900 font-mono font-black">{receiptCheque.numero_piece}</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="p-2 border border-slate-900 font-bold bg-slate-100">Banque Émettrice</td>
                        <td className="p-2 border border-slate-900 font-semibold">{receiptCheque.banque_emetteur}</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="p-2 border border-slate-900 font-bold bg-slate-100">Date d'Échéance</td>
                        <td className="p-2 border border-slate-900 font-bold">{new Date(receiptCheque.date_echeance).toLocaleDateString("fr-FR")}</td>
                      </tr>
                      <tr className="border-b border-slate-900">
                        <td className="p-2 border border-slate-900 font-bold bg-slate-100">Montant en chiffres</td>
                        <td className="p-2 border border-slate-900 font-mono font-black text-sm text-indigo-900 print:text-black">
                          {Number(receiptCheque.montant).toLocaleString("fr-FR")} FCFA
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-900 font-bold bg-slate-100">Montant en toutes lettres</td>
                        <td className="p-2 border border-slate-900 italic font-bold">
                          {numberToFrenchWords(Number(receiptCheque.montant))} Francs CFA
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {receiptCheque.notes && (
                    <p className="text-[11px] text-slate-600 italic">
                      Motif / Référence : {receiptCheque.notes}
                    </p>
                  )}

                  <p className="text-[10px] text-slate-500 italic pt-2">
                    * Ce récépissé est délivré sous réserve de bonne fin et d'encaissement effectif des fonds par l'établissement bancaire.
                  </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t-2 border-slate-900 text-xs">
                  <div className="border border-slate-300 p-3 rounded-xl min-h-[110px] flex flex-col justify-between print:border-black">
                    <span className="font-bold text-slate-900 uppercase text-[10px]">Le Client / Déposant</span>
                    <span className="text-[9px] text-slate-400 italic">Nom et Signature</span>
                  </div>
                  <div className="border border-slate-300 p-3 rounded-xl min-h-[110px] flex flex-col justify-between print:border-black">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 uppercase text-[10px]">Pour l'Entreprise (Visa Caisse)</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-[9px] text-slate-400 italic">Cachet & Signature</span>
                      {companyInfo?.cachet_url && (
                        <img src={companyInfo.cachet_url} alt="Cachet" className="h-10 object-contain opacity-85" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Global Print CSS for 4K Output */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide everything not part of the printed document */
          .screen-only,
          .no-print,
          .print\\:hidden,
          [class*="print:hidden"],
          aside,
          nav,
          header,
          footer,
          [role="navigation"],
          .bordereau-modal-header,
          button,
          select,
          input {
            display: none !important;
          }

          /* Reset all parent wrappers so modal backdrop and scrollbars disappear */
          #__next,
          main,
          div[dir],
          .fixed.inset-0,
          .bordereau-modal-overlay {
            position: static !important;
            display: block !important;
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          .bordereau-modal-card {
            position: static !important;
            display: block !important;
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }

          #printable-bordereau,
          #printable-receipt {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            page-break-after: avoid !important;
          }

          /* Clean non-breaking rows */
          table {
            page-break-inside: auto !important;
            width: 100% !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
        }
      `}</style>
    </div>
  );
}
