"use client";

import { useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, TrendingUp, Wallet, Users, Printer, Loader2,
  Download, Search,
  Filter, AlertCircle, CheckCircle2, FileText, FileSpreadsheet, Percent,
  ShieldAlert, ArrowUpDown, RefreshCw,
  BookOpen, Layers, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type CompanyInfo = {
  nom_entreprise?: string;
  telephone?: string;
  adresse?: string;
};

type ContractReport = {
  [key: string]: unknown;
  id: number;
  locataire_nom_complet?: string;
  ref_locataire?: string;
  locataire_telephone?: string;
  bien_loue_details?: string;
  type_bien?: string;
  quartier?: string;
  loyer_mensuel?: number;
  caution?: number;
  annee_debut?: number;
  mois_debut?: number;
  statut?: string;
  total_paye?: number;
  retards?: number;
  mois_impayes?: string;
  echeance?: string;
  etat_calcule?: string;
  last_payment_date?: string | null;
  expected_amount?: number;
};

type PaymentReport = {
  [key: string]: unknown;
  id: number;
  contrat_id: number;
  date_paiement: string;
  montant?: number;
  mode_paiement?: string;
  description?: string;
  nom_de_mois?: string;
  qte_mois?: number;
  periode_debut?: string;
  periode_fin?: string;
};

type ReportCell = string | number | null | undefined;
type ReportRow = Record<string, ReportCell>;

// Helper to format numbers as currency/numbers
function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function cellNumber(value: ReportCell) {
  return Number(value || 0);
}

function cellText(value: ReportCell) {
  if (value === null || typeof value === "undefined") return "";
  return String(value);
}

function getClientSessionUser() {
  if (typeof document === "undefined") return "Administrateur";
  const cookie = document.cookie.split("; ").find(row => row.startsWith("gp_session="));
  if (!cookie) return "Administrateur";
  try {
    const session = JSON.parse(decodeURIComponent(cookie.split("=")[1]));
    return session?.username || session?.utilisateur || session?.email || "Administrateur";
  } catch {
    return "Administrateur";
  }
}

// French Month names
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

// Helper to format month display for rows
function getRowMonthDisplay(r: any, filterMonth: string, filterYear: string) {
  if (filterMonth && filterMonth !== "All") {
    const mIdx = parseInt(filterMonth) - 1;
    const y = filterYear && filterYear !== "All" ? filterYear : new Date().getFullYear().toString();
    return `${MONTHS_FR[mIdx]} ${y}`;
  }
  if (r.last_payment_date) {
    const d = new Date(r.last_payment_date);
    return `${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
  }
  if (r.mois_debut && r.annee_debut) {
    return `${MONTHS_FR[r.mois_debut - 1]} ${r.annee_debut}`;
  }
  return "—";
}

// Report Types Configuration
const REPORT_TYPES = [
  { id: "A", name: "Situation des Locataires", desc: "État général des locataires par bien immobilier" },
  { id: "B", name: "Situation des Paiements", desc: "Suivi détaillé des versements de loyer par période" },
  { id: "C", name: "Revenus Mensuels", desc: "Synthèse des revenus perçus et attendus par mois" },
  { id: "D", name: "Revenus Annuels", desc: "Synthèse globale des revenus par exercice annuel" },
  { id: "E", name: "Loyers Impayés", desc: "Liste des locataires en retard de paiement" },
  { id: "F", name: "Historique des Paiements", desc: "Journal chronologique de toutes les transactions" },
  { id: "G", name: "Occupation des Biens", desc: "Taux d'occupation et disponibilité des logements" },
  { id: "H", name: "Rentabilité des Biens", desc: "Analyse financière de la rentabilité par bien" },
  { id: "I", name: "Journal des Encaissements", desc: "Grand livre de caisse et banque pour les loyers" },
  { id: "J", name: "Tableau Général Immobilier", desc: "Tableau de bord de synthèse comptable et foncière" }
];

export default function LoyerReportsPage() {
  const router = useRouter();
  
  // Core Data States
  const [contracts, setContracts] = useState<ContractReport[]>([]);
  const [payments, setPayments] = useState<PaymentReport[]>([]);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<string>("Administrateur");

  // Active Report
  const [activeReportId, setActiveReportId] = useState<string>("A");

  // Advanced Filters States
  const [filterTypeBien, setFilterTypeBien] = useState<string>("All");
  const [filterQuartier, setFilterQuartier] = useState<string>("");
  const [filterStatusPaiement, setFilterStatusPaiement] = useState<string>("All"); // All, Paid, Unpaid, Partial
  const [filterMonth, setFilterMonth] = useState<string>("All"); // All or 1-12
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString()); // All or year
  const [filterProprietaire, setFilterProprietaire] = useState<string>("");
  const [filterLocataire, setFilterLocataire] = useState<string>("");
  const [filterAmountMin, setFilterAmountMin] = useState<string>("");
  const [filterAmountMax, setFilterAmountMax] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Table Control States
  const [sortField, setSortField] = useState<string>("");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;
  const [showPrintPreview, setShowPrintPreview] = useState<boolean>(false);

  // Print Settings
  const [printLayout, setPrintLayout] = useState<'portrait' | 'landscape'>('landscape');

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch contracts
      const contractsRes = await fetch("/api/loyers");
      const contractsData = await contractsRes.json();
      setContracts(Array.isArray(contractsData) ? contractsData : []);

      // 2. Fetch payments
      const paymentsRes = await fetch("/api/loyers/payments");
      const paymentsData = await paymentsRes.json();
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);

      // 3. Fetch Company Info
      const { data: compData } = await supabase.from("informations_entreprise").select("*").single();
      if (compData) setCompany(compData);

      // 4. Fetch Current User
      const sessionUser = getClientSessionUser();
      setCurrentUser(sessionUser);
      const { data: { user } } = await supabase.auth.getUser();
      if (sessionUser === "Administrateur" && user?.email) {
        setCurrentUser(user.email.split("@")[0]);
      }
    } catch (error) {
      console.error("Error loading reports data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Get Unique Quartiers for filtering
  const quartiers = useMemo(() => {
    const list = contracts.map(c => c.quartier).filter(Boolean);
    return Array.from(new Set(list)) as string[];
  }, [contracts]);

  // Reset Filters helper
  const handleResetFilters = () => {
    setFilterTypeBien("All");
    setFilterQuartier("");
    setFilterStatusPaiement("All");
    setFilterMonth("All");
    setFilterYear(new Date().getFullYear().toString());
    setFilterProprietaire("");
    setFilterLocataire("");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  // --- Dynamic calculations per contract for the selected period ---
  const processedContracts = useMemo(() => {
    const now = new Date();
    const currentYearReal = now.getFullYear();
    const currentMonthReal = now.getMonth() + 1;

    const targetYear = filterYear === "All" ? currentYearReal : parseInt(filterYear);
    let targetMonth = filterMonth === "All" ? 12 : parseInt(filterMonth);

    // If month is "All" and we're looking at current year, clamp to current month
    if (filterMonth === "All" && targetYear === currentYearReal) {
      targetMonth = currentMonthReal;
    }

    return contracts.map(c => {
      const startYear = c.annee_debut || 2024;
      const startMonth = c.mois_debut || 1;

      // Months elapsed from contract start up to target period (clamped so we don't expect future rents)
      let elapsedMonths = (targetYear - startYear) * 12 + (targetMonth - startMonth + 1);
      
      // Clamp to current real month if target is in the future
      if (targetYear > currentYearReal || (targetYear === currentYearReal && targetMonth > currentMonthReal)) {
        elapsedMonths = (currentYearReal - startYear) * 12 + (currentMonthReal - startMonth + 1);
      }
      
      const monthsToCalculate = Math.max(0, elapsedMonths);
      const expectedAmount = monthsToCalculate * (c.loyer_mensuel || 0);

      // Filter payments made up to target period
      const periodPayments = payments.filter(p => {
        if (p.contrat_id !== c.id) return false;
        const pDate = new Date(p.date_paiement);
        // Include payment if it's within target period
        if (filterYear !== "All" && pDate.getFullYear() > targetYear) return false;
        if (filterMonth !== "All" && pDate.getFullYear() === targetYear && (pDate.getMonth() + 1) > targetMonth) return false;
        return true;
      });

      const totalPaid = periodPayments.reduce((sum, p) => sum + (p.montant || 0), 0);
      const retards = Math.max(0, expectedAmount - totalPaid);
      const unpaidMonthsCount = Math.floor(retards / (c.loyer_mensuel || 1));

      // Calculate state for target period/month
      let rowState: "Payé" | "Partiel" | "Impayé" | "À vérifier" = "Payé";
      if ((c.loyer_mensuel || 0) <= 0) {
        rowState = "À vérifier";
      } else {
        if (filterMonth !== "All" && filterYear !== "All") {
          // If a specific month and year are selected, we evaluate payments for that specific month
          const targetM = parseInt(filterMonth);
          const targetY = parseInt(filterYear);
          const monthPayments = payments.filter(p => {
            if (p.contrat_id !== c.id) return false;
            const pDate = new Date(p.date_paiement);
            return pDate.getFullYear() === targetY && (pDate.getMonth() + 1) === targetM;
          });
          const monthPaid = monthPayments.reduce((sum, p) => sum + (p.montant || 0), 0);
          
          if (monthPaid >= (c.loyer_mensuel || 0)) {
            rowState = "Payé";
          } else if (monthPaid > 0) {
            rowState = "Partiel";
          } else {
            rowState = "Impayé";
          }
        } else {
          // If annual or global, we check the overall balance up to the period
          if (retards === 0) {
            rowState = "Payé";
          } else if (totalPaid > 0) {
            rowState = "Partiel";
          } else {
            rowState = "Impayé";
          }
        }
      }

      // Format unpaid months
      let moisImpayesText = "À jour";
      if (unpaidMonthsCount > 0) {
        const unpaidYears: Record<number, number> = {};
        let currentYearIter = startYear;
        let currentMonthIter = startMonth;
        let monthsToSkip = Math.floor(totalPaid / (c.loyer_mensuel || 1));
        let remainingToCount = unpaidMonthsCount;

        while (remainingToCount > 0) {
          if (monthsToSkip > 0) {
            monthsToSkip--;
          } else {
            unpaidYears[currentYearIter] = (unpaidYears[currentYearIter] || 0) + 1;
            remainingToCount--;
          }
          currentMonthIter++;
          if (currentMonthIter > 12) {
            currentMonthIter = 1;
            currentYearIter++;
          }
          if (currentYearIter > targetYear + 5) break;
        }

        moisImpayesText = Object.entries(unpaidYears)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([y, count]) => `${y}: ${count}m`)
          .join(", ");
      }

      const lastPayment = periodPayments.length > 0 ? periodPayments[0] : null;

      return {
        ...c,
        total_paye: totalPaid,
        retards: retards,
        unpaid_months_count: unpaidMonthsCount,
        mois_impayes: moisImpayesText,
        etat_calcule: rowState,
        last_payment_date: lastPayment ? lastPayment.date_paiement : null,
        expected_amount: expectedAmount
      };
    });
  }, [contracts, payments, filterYear, filterMonth]);

  // Apply Advanced Filters to Contracts Dataset
  const filteredContracts = useMemo(() => {
    return processedContracts.filter(c => {
      // 1. Search Term (Locataire name or bien details or reference)
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchesSearch = [c.locataire_nom_complet, c.bien_loue_details, c.ref_locataire, c.quartier]
          .some(v => (v || "").toLowerCase().includes(s));
        if (!matchesSearch) return false;
      }

      // 2. Type Bien
      if (filterTypeBien !== "All" && c.type_bien !== filterTypeBien) return false;

      // 3. Quartier
      if (filterQuartier && c.quartier !== filterQuartier) return false;

      // 4. Status Paiement
      if (filterStatusPaiement !== "All") {
        if (filterStatusPaiement === "Paid" && c.etat_calcule !== "Payé") return false;
        if (filterStatusPaiement === "Unpaid" && c.etat_calcule !== "Impayé") return false;
        if (filterStatusPaiement === "Partial" && c.etat_calcule !== "Partiel") return false;
      }

      // 5. Tenant Name
      if (filterLocataire && !(c.locataire_nom_complet || "").toLowerCase().includes(filterLocataire.toLowerCase())) return false;

      // 6. Owner / property manager text filter. Some databases do not have a dedicated owner column yet,
      // so the filter also checks property description as a practical fallback.
      if (filterProprietaire) {
        const dynamicContract = c as ContractReport;
        const ownerNeedle = filterProprietaire.toLowerCase();
        const ownerHaystack = [
          dynamicContract["proprietaire"],
          dynamicContract["propriétaire"],
          dynamicContract["nom_proprietaire"],
          dynamicContract["bailleur"],
          dynamicContract["owner"],
          c.bien_loue_details,
        ].some(v => (v || "").toString().toLowerCase().includes(ownerNeedle));
        if (!ownerHaystack) return false;
      }

      // 7. Rent Amount range
      if (filterAmountMin && Number(c.loyer_mensuel || 0) < parseFloat(filterAmountMin)) return false;
      if (filterAmountMax && Number(c.loyer_mensuel || 0) > parseFloat(filterAmountMax)) return false;

      return true;
    });
  }, [processedContracts, searchTerm, filterTypeBien, filterQuartier, filterStatusPaiement, filterLocataire, filterProprietaire, filterAmountMin, filterAmountMax]);

  // Apply Advanced Filters to Payments Dataset
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Find associated contract
      const c = contracts.find(con => con.id === p.contrat_id);
      if (!c) return false;

      // 1. Search Term
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchesSearch = [c.locataire_nom_complet, c.bien_loue_details, c.ref_locataire, p.mode_paiement, p.description]
          .some(v => (v || "").toLowerCase().includes(s));
        if (!matchesSearch) return false;
      }

      // 2. Type Bien
      if (filterTypeBien !== "All" && c.type_bien !== filterTypeBien) return false;

      // 3. Quartier
      if (filterQuartier && c.quartier !== filterQuartier) return false;

      // 4. Period filters
      const pDate = new Date(p.date_paiement);
      if (filterYear !== "All" && pDate.getFullYear().toString() !== filterYear) return false;
      if (filterMonth !== "All" && (pDate.getMonth() + 1).toString() !== filterMonth) return false;

      // 5. Tenant filter
      if (filterLocataire && !(c.locataire_nom_complet || "").toLowerCase().includes(filterLocataire.toLowerCase())) return false;

      // 6. Owner / property manager text filter
      if (filterProprietaire) {
        const dynamicContract = c as ContractReport;
        const ownerNeedle = filterProprietaire.toLowerCase();
        const ownerHaystack = [
          dynamicContract["proprietaire"],
          dynamicContract["propriétaire"],
          dynamicContract["nom_proprietaire"],
          dynamicContract["bailleur"],
          dynamicContract["owner"],
          c.bien_loue_details,
        ].some(v => (v || "").toString().toLowerCase().includes(ownerNeedle));
        if (!ownerHaystack) return false;
      }

      // 7. Amount Min/Max
      if (filterAmountMin && Number(p.montant || 0) < parseFloat(filterAmountMin)) return false;
      if (filterAmountMax && Number(p.montant || 0) > parseFloat(filterAmountMax)) return false;

      return true;
    });
  }, [payments, contracts, searchTerm, filterTypeBien, filterQuartier, filterYear, filterMonth, filterLocataire, filterProprietaire, filterAmountMin, filterAmountMax]);

  // --- KPI Card Statistics ---
  const kpis = useMemo(() => {
    const totalTenants = filteredContracts.length;
    const paidTenants = filteredContracts.filter(c => c.etat_calcule === "Payé").length;
    const unpaidTenants = filteredContracts.filter(c => c.etat_calcule === "Impayé").length;
    const partialTenants = filteredContracts.filter(c => c.etat_calcule === "Partiel").length;

    // Monthly revenue (payments in target month/year)
    const targetYearStr = filterYear === "All" ? new Date().getFullYear().toString() : filterYear;
    const targetMonthStr = filterMonth === "All" ? (new Date().getMonth() + 1).toString() : filterMonth;
    
    const monthlyRev = payments
      .filter(p => {
        const d = new Date(p.date_paiement);
        return d.getFullYear().toString() === targetYearStr && (d.getMonth() + 1).toString() === targetMonthStr;
      })
      .reduce((sum, p) => sum + (p.montant || 0), 0);

    // Annual revenue (payments in target year)
    const annualRev = payments
      .filter(p => {
        const d = new Date(p.date_paiement);
        return d.getFullYear().toString() === targetYearStr;
      })
      .reduce((sum, p) => sum + (p.montant || 0), 0);

    // Remaining (Total unpaid of filtered contracts)
    const remainingUnpaid = filteredContracts.reduce((sum, c) => sum + (c.retards || 0), 0);
    const totalCollected = filteredContracts.reduce((sum, c) => sum + (c.total_paye || 0), 0);
    const totalExpected = totalCollected + remainingUnpaid;
    
    const recoveryRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    return {
      totalTenants,
      paidTenants,
      unpaidTenants,
      partialTenants,
      monthlyRev,
      annualRev,
      remainingUnpaid,
      totalCollected,
      totalExpected,
      recoveryRate
    };
  }, [filteredContracts, payments, filterYear, filterMonth]);

  // --- Chart / Analytic Data Structures ---
  const chartsData = useMemo(() => {
    // 1. Monthly revenue over last 6 months (based on payments)
    const monthlyMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' });
      monthlyMap[label] = 0;
    }

    payments.forEach(p => {
      const d = new Date(p.date_paiement);
      const label = d.toLocaleString('fr-FR', { month: 'short', year: '2-digit' });
      if (monthlyMap[label] !== undefined) {
        monthlyMap[label] += Number(p.montant);
      }
    });

    const monthlyRevenue = Object.entries(monthlyMap).map(([name, value]) => ({ name, value }));

    // 2. Paid / Unpaid Distribution
    const distribution = [
      { name: "Payés", value: kpis.paidTenants, color: "#10b981" },
      { name: "Partiels", value: kpis.partialTenants, color: "#f59e0b" },
      { name: "Impayés", value: kpis.unpaidTenants, color: "#ef4444" }
    ].filter(d => d.value > 0);

    // 3. Top 10 tenants
    const tenantMap: Record<string, number> = {};
    payments.forEach(p => {
      // find contract name
      const c = contracts.find(con => con.id === p.contrat_id);
      if (c) {
        const name = c.locataire_nom_complet || "Locataire";
        tenantMap[name] = (tenantMap[name] || 0) + Number(p.montant);
      }
    });

    const topTenants = Object.entries(tenantMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // 4. Payment modes revenue
    const modeMap: Record<string, number> = {};
    payments.forEach(p => {
      const mode = p.mode_paiement || "Autre";
      modeMap[mode] = (modeMap[mode] || 0) + Number(p.montant);
    });

    const modeRevenue = Object.entries(modeMap).map(([name, value]) => ({ name, value }));

    return {
      monthlyRevenue,
      distribution,
      topTenants,
      modeRevenue
    };
  }, [payments, contracts, kpis]);

  // --- Dynamic Table Data building based on active report selection ---
  const reportTableData = useMemo(() => {
    let rows: ReportRow[] = [];
    
    switch (activeReportId) {
      case "A": // Situation des Locataires
      case "E": // Loyers Impayés
      case "G": // Occupation des Biens
      case "H": // Rentabilité des Biens
      case "J": // Tableau Général Immobilier
        // Filter contracts for Report E to only show unpaid/partial
        rows = filteredContracts.map((c, idx) => ({
          idx: idx + 1,
          id: c.id,
          ref: c.ref_locataire,
          nom: c.locataire_nom_complet,
          telephone: c.locataire_telephone || "—",
          bien: c.bien_loue_details,
          type: c.type_bien || "Maison",
          loyer: Number(c.loyer_mensuel || 0),
          paid: c.total_paye,
          retards: c.retards,
          mois_impayes: c.mois_impayes,
          etat: c.etat_calcule,
          echeance: c.echeance || "—",
          last_payment: c.last_payment_date ? new Date(c.last_payment_date).toLocaleDateString("fr-FR") : "—",
          caution: c.caution || 0,
          quartier: c.quartier || "—",
          statut_contrat: c.statut
        }));

        if (activeReportId === "E") {
          rows = rows.filter(r => cellNumber(r.retards) > 0);
          // Re-index
          rows.forEach((r, i) => r.idx = i + 1);
        }
        break;

      case "B": // Situation des Paiements
      case "F": // Historique des Paiements
      case "I": // Journal des Encaissements
        rows = filteredPayments.map((p, idx) => {
          const c = contracts.find(con => con.id === p.contrat_id);
          return {
            idx: idx + 1,
            id: p.id,
            date: new Date(p.date_paiement).toLocaleDateString("fr-FR"),
            nom: c?.locataire_nom_complet || "—",
            ref: c?.ref_locataire || "—",
            bien: c?.bien_loue_details || "—",
            periode: p.periode_debut && p.periode_fin ? `${new Date(p.periode_debut).toLocaleDateString("fr-FR")} au ${new Date(p.periode_fin).toLocaleDateString("fr-FR")}` : (p.nom_de_mois || "—"),
            qte: p.qte_mois || 1,
            montant: p.montant,
            mode: p.mode_paiement,
            libelle: p.description || `Versement loyer - ${c?.locataire_nom_complet}`,
            recu: `#${String(p.id).padStart(6, '0')}`
          };
        });
        break;

      case "C": { // Revenus Mensuels
        // Group expected and paid by month-year
        const monthlyGroups: Record<string, { expected: number; paid: number; count: number; label: string; dateSort: Date }> = {};
        
        // Loop last 12 months
        const today = new Date();
        for (let i = 11; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
          monthlyGroups[key] = { expected: 0, paid: 0, count: 0, label, dateSort: d };
        }

        // Expected calculation per month
        contracts.forEach(c => {
          const sYr = c.annee_debut || 2024;
          const sMn = c.mois_debut || 1;
          
          Object.entries(monthlyGroups).forEach(([key, group]) => {
            const [y, m] = key.split("-").map(Number);
            const startD = new Date(sYr, sMn - 1, 1);
            const targetD = new Date(y, m - 1, 1);
            if (targetD >= startD && c.statut === "Actif") {
              group.expected += Number(c.loyer_mensuel);
            }
          });
        });

        // Paid calculation per month
        payments.forEach(p => {
          const pDate = new Date(p.date_paiement);
          const key = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
          if (monthlyGroups[key]) {
            monthlyGroups[key].paid += Number(p.montant);
            monthlyGroups[key].count += 1;
          }
        });

        rows = Object.entries(monthlyGroups)
          .map(([, data], idx) => {
            const reste = Math.max(0, data.expected - data.paid);
            const recovery = data.expected > 0 ? (data.paid / data.expected) * 100 : 100;
            return {
              idx: idx + 1,
              mois: data.label,
              count: data.count,
              expected: data.expected,
              paid: data.paid,
              reste,
              recovery: recovery.toFixed(1) + "%",
              dateSort: data.dateSort.getTime()
            };
          })
          .sort((a, b) => Number(b.dateSort || 0) - Number(a.dateSort || 0));
        break;
      }

      case "D": { // Revenus Annuels
        const annualGroups: Record<string, { expected: number; paid: number; count: number }> = {
          "2024": { expected: 0, paid: 0, count: 0 },
          "2025": { expected: 0, paid: 0, count: 0 },
          "2026": { expected: 0, paid: 0, count: 0 },
          "2027": { expected: 0, paid: 0, count: 0 },
        };

        contracts.forEach(c => {
          const sYr = c.annee_debut || 2024;
          Object.keys(annualGroups).forEach(y => {
            const yr = parseInt(y);
            if (yr >= sYr && c.statut === "Actif") {
              // rough monthly count depending on start
              const monthsInYear = yr === sYr ? (12 - (c.mois_debut || 1) + 1) : 12;
              annualGroups[y].expected += (Number(c.loyer_mensuel || 0) * monthsInYear);
            }
          });
        });

        payments.forEach(p => {
          const y = new Date(p.date_paiement).getFullYear().toString();
          if (annualGroups[y]) {
            annualGroups[y].paid += Number(p.montant);
            annualGroups[y].count += 1;
          }
        });

        rows = Object.entries(annualGroups).map(([year, data], idx) => {
          const reste = Math.max(0, data.expected - data.paid);
          const recovery = data.expected > 0 ? (data.paid / data.expected) * 100 : 100;
          return {
            idx: idx + 1,
            annee: year,
            count: data.count,
            expected: data.expected,
            paid: data.paid,
            reste,
            recovery: recovery.toFixed(1) + "%"
          };
        }).reverse();
        break;
      }
    }

    // Apply sorting
    if (sortField) {
      rows.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === "number" && typeof valB === "number") {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc 
          ? String(valA).localeCompare(String(valB)) 
          : String(valB).localeCompare(String(valA));
      });
    }

    return rows;
  }, [activeReportId, filteredContracts, filteredPayments, contracts, payments, sortAsc, sortField]);

  // Pagination logic
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return reportTableData.slice(startIndex, startIndex + pageSize);
  }, [reportTableData, currentPage]);

  const totalPages = Math.ceil(reportTableData.length / pageSize) || 1;

  // Change active report handler
  const handleReportChange = (id: string) => {
    setActiveReportId(id);
    setSortField("");
    setCurrentPage(1);
    // Suggest default print layout based on report content density
    if (["A", "E", "J", "H"].includes(id)) {
      setPrintLayout("landscape");
    } else {
      setPrintLayout("portrait");
    }
  };

  // --- Export Excel (HTML Trick) ---
  const handleExportExcel = () => {
    const activeReport = REPORT_TYPES.find(r => r.id === activeReportId);
    const filename = `${activeReport?.name.replace(/ /g, "_")}_${new Date().toISOString().slice(0,10)}`;
    
    // Build basic HTML Table
    let tableHtml = `<table border="1"><thead><tr>`;
    
    // headers
    const cols = getReportHeaders();
    cols.forEach(col => {
      tableHtml += `<th style="background-color: #1e3a8a; color: #ffffff; font-weight: bold;">${col.label}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;

    // rows
    reportTableData.forEach(row => {
      tableHtml += `<tr>`;
      cols.forEach(col => {
        let val = row[col.key];
        if (col.key === "loyer" || col.key === "paid" || col.key === "retards" || col.key === "montant" || col.key === "expected" || col.key === "reste" || col.key === "caution") {
          val = val ? fmt(cellNumber(val)) + " F" : "0 F";
        }
        tableHtml += `<td>${val || "—"}</td>`;
      });
      tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table>`;

    const blob = new Blob([`
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/></head>
      <body>${tableHtml}</body>
      </html>
    `], { type: "application/vnd.ms-excel" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.xls`;
    link.click();
  };

  // --- Export CSV ---
  const handleExportCSV = () => {
    const activeReport = REPORT_TYPES.find(r => r.id === activeReportId);
    const filename = `${activeReport?.name.replace(/ /g, "_")}_${new Date().toISOString().slice(0,10)}`;
    const cols = getReportHeaders();
    
    const csvHeaders = cols.map(c => c.label).join(";");
    const csvRows = reportTableData.map(row => 
      cols.map(col => {
        let val = row[col.key];
        if (col.key === "loyer" || col.key === "paid" || col.key === "retards" || col.key === "montant" || col.key === "expected" || col.key === "reste" || col.key === "caution") {
          val = cellNumber(val);
        }
        return `"${cellText(val).replace(/"/g, '""')}"`;
      }).join(";")
    );

    const csvContent = "\uFEFF" + [csvHeaders, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  // Dynamic headers based on active report
  function getReportHeaders() {
    switch (activeReportId) {
      case "A":
        return [
          { key: "idx", label: "N°", width: "50px" },
          { key: "ref", label: "Référence", width: "100px" },
          { key: "nom", label: "Nom Locataire" },
          { key: "telephone", label: "Téléphone", width: "120px" },
          { key: "bien", label: "Bien Immobilier" },
          { key: "type", label: "Type", width: "100px" },
          { key: "loyer", label: "Loyer", width: "100px", align: "right" },
          { key: "etat", label: "État", width: "100px", align: "center" }
        ];
      case "B":
        return [
          { key: "idx", label: "N°", width: "50px" },
          { key: "date", label: "Date Dépôt", width: "100px" },
          { key: "nom", label: "Locataire" },
          { key: "bien", label: "Bien Immobilier" },
          { key: "periode", label: "Mois / Période" },
          { key: "montant", label: "Montant", width: "120px", align: "right" },
          { key: "mode", label: "Mode de paiement", width: "130px" }
        ];
      case "C":
        return [
          { key: "idx", label: "N°", width: "50px" },
          { key: "mois", label: "Mois" },
          { key: "count", label: "Nbr Paiements", width: "120px", align: "center" },
          { key: "expected", label: "Loyers Exigibles", width: "150px", align: "right" },
          { key: "paid", label: "Loyers Perçus", width: "150px", align: "right" },
          { key: "reste", label: "Reste à recouvrer", width: "150px", align: "right" },
          { key: "recovery", label: "Taux Recouvr.", width: "120px", align: "center" }
        ];
      case "D":
        return [
          { key: "idx", label: "N°", width: "50px" },
          { key: "annee", label: "Année" },
          { key: "count", label: "Nbr Paiements", width: "120px", align: "center" },
          { key: "expected", label: "Loyers Exigibles", width: "150px", align: "right" },
          { key: "paid", label: "Loyers Perçus", width: "150px", align: "right" },
          { key: "reste", label: "Reste à recouvrer", width: "150px", align: "right" },
          { key: "recovery", label: "Taux Recouvr.", width: "120px", align: "center" }
        ];
      case "E":
        return [
          { key: "idx", label: "N°", width: "50px" },
          { key: "nom", label: "Locataire" },
          { key: "telephone", label: "Téléphone", width: "120px" },
          { key: "bien", label: "Bien Immobilier" },
          { key: "loyer", label: "Loyer Mensuel", width: "110px", align: "right" },
          { key: "paid", label: "Total Versé", width: "110px", align: "right" },
          { key: "retards", label: "Solde Dû", width: "110px", align: "right" },
          { key: "mois_impayes", label: "Mois Impayés" },
          { key: "last_payment", label: "Dernier Versement", width: "130px", align: "center" }
        ];
      case "F":
        return [
          { key: "recu", label: "N° Reçu", width: "100px" },
          { key: "date", label: "Date", width: "100px" },
          { key: "nom", label: "Locataire" },
          { key: "bien", label: "Bien Immobilier" },
          { key: "libelle", label: "Libellé de l'Écriture" },
          { key: "montant", label: "Montant", width: "120px", align: "right" },
          { key: "mode", label: "Moyen", width: "100px" }
        ];
      case "G":
        return [
          { key: "bien", label: "Bien Immobilier" },
          { key: "type", label: "Type", width: "100px" },
          { key: "quartier", label: "Quartier", width: "120px" },
          { key: "loyer", label: "Loyer Mensuel", width: "120px", align: "right" },
          { key: "nom", label: "Locataire Actuel" },
          { key: "telephone", label: "Contact", width: "120px" },
          { key: "statut_contrat", label: "Statut Occupation", width: "140px", align: "center" }
        ];
      case "H":
        return [
          { key: "bien", label: "Bien Loué" },
          { key: "type", label: "Type", width: "100px" },
          { key: "quartier", label: "Quartier" },
          { key: "loyer", label: "Loyer Mensuel", width: "130px", align: "right" },
          { key: "paid", label: "Cumul Encaissé", width: "150px", align: "right" },
          { key: "statut_contrat", label: "État", width: "100px", align: "center" }
        ];
      case "I":
        return [
          { key: "date", label: "Date", width: "100px" },
          { key: "recu", label: "N° Pièce/Reçu", width: "110px" },
          { key: "nom", label: "Locataire / Tiers" },
          { key: "libelle", label: "Libellé de l'écriture comptable" },
          { key: "mode", label: "Moyen", width: "120px" },
          { key: "montant", label: "Débit (Versement)", width: "150px", align: "right" }
        ];
      case "J":
        return [
          { key: "idx", label: "N°", width: "50px" },
          { key: "ref", label: "Référence", width: "100px" },
          { key: "nom", label: "Nom Locataire" },
          { key: "telephone", label: "Téléphone", width: "110px" },
          { key: "bien", label: "Bien Loué" },
          { key: "type", label: "Type", width: "90px" },
          { key: "loyer", label: "Loyer Mensuel", width: "110px", align: "right" },
          { key: "paid", label: "Total Payé", width: "110px", align: "right" },
          { key: "retards", label: "Solde Reste", width: "110px", align: "right" },
          { key: "etat", label: "État", width: "90px", align: "center" }
        ];
      default:
        return [];
    }
  }

  // --- Sub-grouping logic for printing to match administrative style ---
  const printGroups = useMemo(() => {
    if (activeReportId !== "A" && activeReportId !== "E" && activeReportId !== "J") return [];
    
    // Group rows by property details (bien_loue_details)
    const map = new Map<string, ReportRow[]>();
    reportTableData.forEach(row => {
      const key = String(row.bien || "Autre").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    
    return Array.from(map.entries());
  }, [reportTableData, activeReportId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        <p className="text-slate-500 font-bold animate-pulse text-lg">Préparation des états comptables...</p>
      </div>
    );
  }

  const activeReport = REPORT_TYPES.find(r => r.id === activeReportId);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 print:p-0 print:space-y-0">
      
      {/* ── SCREEN HEADER (Hidden on print) ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => router.push("/dashboard/loyers")} className="rounded-2xl h-12 border-slate-200 hover:bg-slate-50 shadow-sm px-6 font-bold text-slate-600">
            <ArrowLeft size={18} className="mr-2" /> Retour
          </Button>
          <div>
            <h1 className="text-3xl xl:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <TrendingUp className="text-blue-600" size={32} />
              Centre de Reporting Avancé
            </h1>
            <p className="text-slate-400 font-black mt-1 uppercase text-[10px] tracking-widest flex items-center gap-1.5">
              <Layers size={12} /> États Financiers & Situation Immobilière • {company?.nom_entreprise || "ETS SOUNO"}
            </p>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={handleResetFilters} variant="outline" className="rounded-xl h-11 px-4 font-bold border-slate-200 text-slate-600">
            <RefreshCw size={15} className="mr-2" /> Réinitialiser
          </Button>

          <Button onClick={handleExportExcel} className="rounded-xl h-11 px-4 font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200">
            <FileSpreadsheet size={15} className="mr-2" /> Excel
          </Button>

          <Button
            onClick={() => {
              setPrintLayout("portrait");
              setTimeout(() => window.print(), 100);
            }}
            className="rounded-xl h-11 px-4 font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 shadow-sm border border-blue-200"
          >
            <FileText size={15} className="mr-2" /> PDF A4 Portrait
          </Button>

          <Button
            onClick={() => {
              setPrintLayout("landscape");
              setTimeout(() => window.print(), 100);
            }}
            className="rounded-xl h-11 px-4 font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 shadow-sm border border-blue-200"
          >
            <FileText size={15} className="mr-2" /> PDF A4 Paysage
          </Button>

          <Button
            onClick={() => {
              setTimeout(() => window.print(), 100);
            }}
            className="rounded-xl h-11 px-5 font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
          >
            <Printer size={16} className="mr-2" /> Imprimer
          </Button>
        </div>
      </div>

      {/* ── KPI STATISTICS CARDS (Hidden on print) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 print:hidden">
        {[
          { label: "Locataires", value: kpis.totalTenants, icon: Users, color: "text-blue-600", bg: "bg-blue-50/50" },
          { label: "Encaissé", value: `${fmt(kpis.annualRev)} F`, icon: Wallet, color: "text-emerald-600", bg: "bg-emerald-50/50" },
          { label: "Reste Dû", value: `${fmt(kpis.remainingUnpaid)} F`, icon: ShieldAlert, color: "text-rose-600", bg: "bg-rose-50/50" },
          { label: "Mensuel", value: `${fmt(kpis.monthlyRev)} F`, icon: DollarSign, color: "text-indigo-600", bg: "bg-indigo-50/50" },
          { label: "À jour", value: kpis.paidTenants, icon: CheckCircle2, color: "text-teal-600", bg: "bg-teal-50/50" },
          { label: "Retards", value: kpis.unpaidTenants, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50/50" },
          { label: "Taux Recov.", value: `${kpis.recoveryRate.toFixed(1)}%`, icon: Percent, color: "text-purple-600", bg: "bg-purple-50/50" }
        ].map((card, idx) => (
          <div key={idx} className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${card.bg} ${card.color}`}>
                <card.icon size={14} />
              </div>
            </div>
            <p className="text-sm md:text-base font-black text-slate-800 tracking-tight mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── STATUS & PRINT PREVIEW CONTROL BAR (Hidden on print) ── */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 font-bold">
          <div>
            Période filtrée :{" "}
            <span className="text-slate-800 font-black">
              {filterMonth !== "All" ? `${MONTHS_FR[parseInt(filterMonth) - 1]} ` : ""}
              {filterYear !== "All" ? filterYear : "Année courante"}
            </span>
          </div>
          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
          <div>
            Résultats trouvés :{" "}
            <span className="text-slate-800 font-black">{reportTableData.length}</span>
          </div>
          <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
          <div>
            Locataires récupérés :{" "}
            <span className="text-indigo-600 font-black">{filteredContracts.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowPrintPreview(!showPrintPreview)}
            variant={showPrintPreview ? "default" : "outline"}
            className={`rounded-xl h-9 text-xs font-bold ${
              showPrintPreview ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            {showPrintPreview ? "Masquer l'aperçu" : "Aperçu avant impression"}
          </Button>
        </div>
      </div>

      {/* ── CORE ERP MODULE GRID (Hidden on print) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 print:hidden">
        
        {/* Left Column: Report Selector & Advanced Filters */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* 1. Report Selector */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-md">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
              <BookOpen size={14} /> 1. Sélection du Rapport
            </h3>
            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleReportChange(type.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 border flex flex-col gap-0.5 group ${
                    activeReportId === type.id
                      ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-slate-50/50 hover:bg-slate-50 border-slate-100 text-slate-700"
                  }`}
                >
                  <span className="text-xs font-black tracking-wide flex items-center gap-1.5">
                    <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                      activeReportId === type.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600 group-hover:bg-blue-500 group-hover:text-white"
                    }`}>
                      {type.id}
                    </span>
                    {type.name}
                  </span>
                  <span className={`text-[9px] font-medium leading-tight ${activeReportId === type.id ? "text-blue-100" : "text-slate-400"}`}>
                    {type.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Advanced Filters Panel */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-md">
            <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Filter size={14} /> 2. Filtres Avancés
              </h3>
              <Button onClick={handleResetFilters} variant="link" className="text-[10px] p-0 font-bold h-auto text-blue-600">
                Effacer
              </Button>
            </div>
            
            <div className="space-y-3.5">
              
              {/* Type Bien */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Type de Bien</label>
                <Select value={filterTypeBien} onValueChange={setFilterTypeBien}>
                  <SelectTrigger className="w-full h-9 rounded-lg border-slate-200 bg-slate-50/50 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Tous les types</SelectItem>
                    <SelectItem value="Maison">Maison</SelectItem>
                    <SelectItem value="Boutique">Boutique</SelectItem>
                    <SelectItem value="Terrain">Terrain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quartier */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Secteur / Quartier</label>
                <Select value={filterQuartier} onValueChange={setFilterQuartier}>
                  <SelectTrigger className="w-full h-9 rounded-lg border-slate-200 bg-slate-50/50 text-xs font-bold">
                    <SelectValue placeholder="Tous les quartiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Tous</SelectItem>
                    {quartiers.map(q => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Statut Paiement */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Statut Paiement</label>
                <Select value={filterStatusPaiement} onValueChange={setFilterStatusPaiement}>
                  <SelectTrigger className="w-full h-9 rounded-lg border-slate-200 bg-slate-50/50 text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Tous</SelectItem>
                    <SelectItem value="Paid">Payé (À jour)</SelectItem>
                    <SelectItem value="Partial">Partiel</SelectItem>
                    <SelectItem value="Unpaid">Impayé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Period selection */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Mois</label>
                  <Select value={filterMonth} onValueChange={setFilterMonth}>
                    <SelectTrigger className="w-full h-9 rounded-lg border-slate-200 bg-slate-50/50 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">Tous</SelectItem>
                      {MONTHS_FR.map((m, idx) => (
                        <SelectItem key={idx} value={(idx + 1).toString()}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Année</label>
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="w-full h-9 rounded-lg border-slate-200 bg-slate-50/50 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">Toutes</SelectItem>
                      {["2024", "2025", "2026", "2027"].map(y => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tenant Search */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Locataire</label>
                <Input
                  value={filterLocataire}
                  onChange={(e) => setFilterLocataire(e.target.value)}
                  placeholder="Recherche locataire..."
                  className="h-9 text-xs rounded-lg bg-slate-50/50 border-slate-200"
                />
              </div>

              {/* Owner Search */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Propriétaire</label>
                <Input
                  value={filterProprietaire}
                  onChange={(e) => setFilterProprietaire(e.target.value)}
                  placeholder="Nom propriétaire..."
                  className="h-9 text-xs rounded-lg bg-slate-50/50 border-slate-200"
                />
              </div>

              {/* Min/Max Rent */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Loyers Min</label>
                  <Input
                    type="number"
                    value={filterAmountMin}
                    onChange={(e) => setFilterAmountMin(e.target.value)}
                    placeholder="Min"
                    className="h-9 text-xs rounded-lg bg-slate-50/50 border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Loyers Max</label>
                  <Input
                    type="number"
                    value={filterAmountMax}
                    onChange={(e) => setFilterAmountMax(e.target.value)}
                    placeholder="Max"
                    className="h-9 text-xs rounded-lg bg-slate-50/50 border-slate-200"
                  />
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Right Column: Active report display & Interactive Table */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Main ERP table display card */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
            {/* Header info */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-6 bg-blue-600 rounded-full" />
                  <h2 className="text-xl font-black text-slate-900">{activeReport?.name}</h2>
                </div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{activeReport?.desc}</p>
              </div>

              {/* Instant table search */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input
                  placeholder="Recherche rapide..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="pl-9 h-10 bg-white border-slate-200 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            {/* Interactive Grid Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider">
                    {getReportHeaders().map(col => (
                      <th
                        key={col.key}
                        onClick={() => {
                          if (sortField === col.key) {
                            setSortAsc(!sortAsc);
                          } else {
                            setSortField(col.key);
                            setSortAsc(true);
                          }
                        }}
                        style={{ width: col.width }}
                        className={`px-5 py-4 cursor-pointer hover:bg-slate-100 hover:text-slate-700 transition-colors font-black text-[9px] uppercase tracking-widest ${
                          col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          <ArrowUpDown size={10} className="text-slate-400/50" />
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={getReportHeaders().length} className="text-center py-20 text-slate-400 font-bold">
                        Aucune ligne trouvée pour ces critères.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        {getReportHeaders().map(col => {
                          const raw = row[col.key];
                          let val: ReactNode = cellText(raw) || "—";

                          // Format rendering
                          if (["loyer", "paid", "retards", "montant", "expected", "reste", "caution"].includes(col.key)) {
                            const isLoss = col.key === "retards" || col.key === "reste";
                            val = (
                              <span className={`font-black ${
                                col.key === "paid" ? "text-emerald-600" : isLoss && cellNumber(raw) > 0 ? "text-rose-600" : "text-slate-800"
                              }`}>
                                {fmt(cellNumber(raw))} F
                              </span>
                            );
                          }

                          if (col.key === "etat" || col.key === "statut_contrat") {
                            const st = cellText(raw);
                            const isPaid = st === "Payé" || st === "Actif" || st === "✓ À jour";
                            const isPartial = st === "Partiel";
                            val = (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                isPaid ? "bg-emerald-50 text-emerald-600" : isPartial ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  isPaid ? "bg-emerald-500" : isPartial ? "bg-amber-500" : "bg-rose-500"
                                }`} />
                                {st}
                              </span>
                            );
                          }

                          if (col.key === "ref") {
                            val = <span className="font-mono font-bold text-slate-500">{cellText(raw) || "—"}</span>;
                          }

                          if (col.key === "nom") {
                            val = <span className="font-black text-slate-900">{cellText(raw) || "—"}</span>;
                          }

                          return (
                            <td key={col.key} className={`px-5 py-3.5 ${
                              col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""
                            }`}>
                              {val || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Controls */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 bg-slate-50/20">
              <span>Total : <span className="font-black text-slate-700">{reportTableData.length}</span> lignes</span>
              <div className="flex items-center gap-2">
                <Button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  variant="outline"
                  className="h-8 rounded-lg text-xs"
                >
                  Précédent
                </Button>
                <span className="font-mono text-slate-700">Page {currentPage} sur {totalPages}</span>
                <Button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  variant="outline"
                  className="h-8 rounded-lg text-xs"
                >
                  Suivant
                </Button>
              </div>
            </div>

          </div>

          {/* Visual Analysis Section (Charts / Recharts) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 1. Monthly revenue evolution */}
            <div className="bg-[#0f172a] rounded-[40px] p-6 shadow-2xl relative overflow-hidden border border-white/5">
              <h3 className="text-sm font-black text-white mb-6 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                Évolution des Encaissements
              </h3>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartsData.monthlyRevenue}>
                    <defs>
                      <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} tickLine={false} tickFormatter={(v) => `${v/1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '10px' }} />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorPaid)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Top 5 Locataires by billing */}
            <div className="bg-white rounded-[40px] p-6 border border-slate-100 shadow-md">
              <h3 className="text-sm font-black text-slate-800 mb-5 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                Top Locataires (Paiements cumulés)
              </h3>
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {chartsData.topTenants.slice(0, 5).map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="font-black text-slate-700 text-xs flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-black">{idx+1}</span>
                      {t.name}
                    </span>
                    <span className="font-black text-emerald-600 text-xs">{fmt(t.value)} F</span>
                  </div>
                ))}
                {chartsData.topTenants.length === 0 && (
                  <p className="text-center text-slate-400 py-10">Aucun paiement trouvé.</p>
                )}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* ── FOOTER ANALYTIC INFO (Hidden on print) ── */}
      <div className="text-center print:hidden">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">GestionPro Comptabilité Foncière v2.1 • {new Date().getFullYear()}</p>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* ── HIGH FIDELITY PRINTABLE ADMINISTRATIVE REPORT VIEW (Only in @media print or preview) ── */}
      <div 
        id="printable-section" 
        className={`${
          showPrintPreview 
            ? `block border-2 border-slate-300 p-8 my-6 mx-auto shadow-2xl bg-white ${printLayout === 'landscape' ? 'max-w-[297mm]' : 'max-w-[210mm]'}` 
            : "hidden"
        } print:block bg-white text-black font-sans w-full p-2`}
      >
        
        {/* 1. Header Details */}
        <div className="flex justify-between items-start mb-4 border-b border-black pb-3">
          <div className="flex items-center gap-3">
            {/* SVG Logo */}
            <div className="w-12 h-12 border-2 border-black flex items-center justify-center rotate-6">
              <span className="text-[10px] font-black text-center leading-tight">ETS<br/>SOUNO</span>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase leading-none">ETS SOUNO</h1>
              <p className="text-xs font-black text-slate-700 mt-1">MARADI-NIGER</p>
              <p className="text-[9px] font-bold text-slate-500">Tél: 98 41 03 99 / 96 97 01 57</p>
            </div>
          </div>
          <div className="text-right text-[10px] font-bold text-slate-500 space-y-1">
            <p>Imprimé le : <span className="font-black text-black">{new Date().toLocaleDateString("fr-FR")} à {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span></p>
            <p>Généré par : <span className="font-black text-black">{currentUser}</span></p>
            <p>Période : <span className="font-black text-black">
              {filterMonth !== "All" ? MONTHS_FR[parseInt(filterMonth) - 1] + " " : ""}
              {filterYear !== "All" ? filterYear : "GLOBAL"}
            </span></p>
          </div>
        </div>

        {/* 2. Banner Header */}
        <div className="border-4 border-black p-3 text-center mb-6 bg-slate-50">
          <h2 className="text-xl font-black uppercase tracking-[0.15em] text-black">
            {["A", "E", "J"].includes(activeReportId) ? "SITUATION DES LOCATAIRES ET DES LOYERS" : activeReport?.name}
          </h2>
          <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-widest">
            {["A", "E", "J"].includes(activeReportId) ? "Rapport Général" : "Rapport Administratif"}
          </p>
        </div>

        {/* 3. Render Grouped Data specifically for Reports A, E, J (Matches image format exactly) */}
        {["A", "E", "J"].includes(activeReportId) ? (
          <div>
            {printGroups.map(([bienName, rows], gi) => {
              const totalBien = rows.reduce((s, r) => s + cellNumber(r.loyer), 0);
              const paidCount = rows.filter(r => cellText(r.etat) === "Payé").length;
              const partialCount = rows.filter(r => cellText(r.etat) === "Partiel").length;
              const unpaidCount = rows.filter(r => cellText(r.etat) === "Impayé").length;

              return (
                <div key={gi} className="mb-6 avoid-break">
                  {/* Category Title */}
                  <h3 className="text-xs font-black underline uppercase text-slate-900 mb-2">
                    Liste de {rows[0]?.type ? `${cellText(rows[0].type).toLowerCase()}s` : "biens"} — {bienName} {rows[0]?.quartier ? `(${rows[0].quartier})` : ""}
                  </h3>

                  {/* Group Table */}
                  <table className="w-full border-2 border-black border-collapse text-[10px] table-fixed">
                    <thead>
                      <tr className="bg-blue-800 text-white border-b-2 border-black">
                        <th className="border-r border-black p-2 text-center font-black w-[5%]">N°</th>
                        <th className="border-r border-black p-2 text-left font-black w-[35%]">Noms</th>
                        <th className="border-r border-black p-2 text-center w-[15%] font-black">Mois</th>
                        <th className="border-r border-black p-2 text-right w-[15%] font-black">Prix (F)</th>
                        <th className="border-r border-black p-2 text-center w-[15%] font-black">État</th>
                        <th className="p-2 text-center w-[15%] font-black">Contacts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, ri) => (
                        <tr key={ri} className="border-b border-black font-semibold text-slate-800">
                          <td className="border-r border-black p-2 text-center font-black">{ri + 1}</td>
                          <td className="border-r border-black p-2 font-black text-black">
                            {r.nom} 
                            {r.statut_contrat === "Expiré" && <span className="ml-1 text-[8px] font-black text-amber-600">[EXPIRÉ]</span>}
                          </td>
                          <td className="border-r border-black p-2 text-center font-bold">
                            {getRowMonthDisplay(r, filterMonth, filterYear)}
                          </td>
                          <td className="border-r border-black p-2 text-right font-black text-black">{fmt(cellNumber(r.loyer))}</td>
                          <td className="border-r border-black p-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                              cellText(r.etat) === "Payé" 
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300" 
                                : cellText(r.etat) === "Partiel" 
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : cellText(r.etat) === "À vérifier"
                                    ? "bg-slate-100 text-slate-800 border border-slate-300"
                                    : "bg-red-100 text-red-800 border border-red-300"
                            }`}>
                              {cellText(r.etat)}
                            </span>
                          </td>
                          <td className="p-2 text-center font-bold">{cellText(r.telephone) || "—"}</td>
                        </tr>
                      ))}
                      {/* Group Sub-total */}
                      <tr className="bg-slate-50 border-t-2 border-black font-black text-black">
                        <td colSpan={3} className="border-r border-black p-2 text-right uppercase text-[9px]">
                          SOUS-TOTAL ({rows.length} LOCATAIRE{rows.length > 1 ? "S" : ""})
                        </td>
                        <td className="border-r border-black p-2 text-right font-black text-blue-800">
                          {fmt(totalBien)}
                        </td>
                        <td className="border-r border-black p-2 text-center text-[9px] text-emerald-700 bg-emerald-50">
                          {paidCount} Payé(s) {partialCount > 0 ? `, ${partialCount} Partiel(s)` : ""}
                        </td>
                        <td className="p-2 text-center text-[9px] text-rose-700 bg-rose-50">
                          {unpaidCount} Impayé(s)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        ) : (
          /* General printable tables for other reports */
          <table className="w-full border-2 border-black border-collapse text-[10px] mb-6">
            <thead>
              <tr className="bg-blue-800 text-white border-b-2 border-black">
                {getReportHeaders().map(col => (
                  <th key={col.key} className="border-r border-black p-2 font-black uppercase">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportTableData.map((row, idx) => (
                <tr key={idx} className="border-b border-black font-semibold">
                  {getReportHeaders().map(col => {
                    let val = row[col.key];
                    if (["loyer", "paid", "retards", "montant", "expected", "reste", "caution"].includes(col.key)) {
                      val = val ? fmt(cellNumber(val)) + " F" : "—";
                    }
                    return (
                      <td key={col.key} className="border-r border-black p-2">
                        {val || "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 4. Bottom Grand Summary Banner (Matches image style exactly) */}
        <div className="mt-8 border-2 border-black bg-slate-50">
          <div className="bg-slate-900 border-b border-black px-4 py-2 text-white">
            <span className="text-xs font-black uppercase tracking-wider">RECAPITULATIF GENERAL ET ETAT COMPTABLE</span>
          </div>
          <div className="grid grid-cols-5 divide-x divide-black text-center text-[10px] font-black text-slate-800 py-3">
            <div>
              <p className="text-slate-400 uppercase text-[8px] mb-1">TOTAL LOCATAIRES</p>
              <p className="text-base font-black text-black">{kpis.totalTenants}</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase text-[8px] mb-1">MONTANT TOTAL EXIGIBLE</p>
              <p className="text-base font-black text-blue-800">{fmt(kpis.totalExpected)} F</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase text-[8px] mb-1">TOTAL PAYÉ (REÇU)</p>
              <p className="text-base font-black text-emerald-600">{fmt(kpis.totalCollected)} F</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase text-[8px] mb-1">TOTAL IMPAYÉS (SOLDE DÛ)</p>
              <p className="text-base font-black text-rose-600">{fmt(kpis.remainingUnpaid)} F</p>
            </div>
            <div>
              <p className="text-slate-400 uppercase text-[8px] mb-1">TAUX DE RECOUVREMENT</p>
              <p className="text-base font-black text-blue-700">{kpis.recoveryRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-16 grid grid-cols-2 gap-20 px-8 text-center text-xs font-black">
          <div>
            <p className="border-b-2 border-black pb-1 mb-16 uppercase">Le Comptable (Bailleur)</p>
            <p className="text-[10px] text-slate-400 italic font-bold">ETS SOUNO - Cachet Officiel</p>
          </div>
          <div>
            <p className="border-b-2 border-black pb-1 mb-16 uppercase">Visa Contrôle Audit</p>
            <p className="text-[10px] text-slate-400 italic font-bold">(Signature autorisée)</p>
          </div>
        </div>

        {/* Print footer */}
        <div className="mt-12 text-center text-[9px] text-slate-400 border-t border-slate-200 pt-3">
          Document administratif de gestion immobilière et comptable • ETS SOUNO Maradi • Page 1 sur 1
        </div>

      </div>

      {/* Global CSS for Print Layout (Overrides all styles on window.print()) */}
      <style jsx global>{`
        @media print {
          /* 1. Hide all non-printable UI elements */
          aside,
          header,
          nav,
          footer,
          .print\:hidden,
          .relative.z-\[60\].mb-8,
          .space-y-8 > *:not(#printable-section) {
            display: none !important;
          }

          /* 2. Reset ancestor containers to allow natural multi-page flow and avoid height collapse */
          html, body, #__next, [dir="ltr"], main,
          body > div,
          body > div > div,
          body > div > main,
          main > div,
          div.space-y-8 {
            display: block !important;
            position: static !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: none !important;
            box-shadow: none !important;
          }

          /* 3. Style the printable section using relative flow */
          #printable-section {
            display: block !important;
            position: relative !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            visibility: visible !important;
          }

          /* 4. Ensure elements inside print section remain visible */
          #printable-section,
          #printable-section * {
            visibility: visible !important;
            background: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          @page {
            size: ${printLayout === 'landscape' ? 'A4 landscape' : 'A4 portrait'};
            margin: 10mm 10mm 12mm 10mm;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            page-break-inside: auto !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          /* Retain print colors */
          .bg-blue-800 { background-color: #1e40af !important; color: #ffffff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          .bg-slate-900 { background-color: #0f172a !important; color: #ffffff !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          .bg-emerald-100 { background-color: #d1fae5 !important; }
          .bg-amber-100 { background-color: #fef3c7 !important; }
          .bg-red-100 { background-color: #fee2e2 !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-rose-600 { color: #e11d48 !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
        }
      `}</style>

    </div>
  );
}

