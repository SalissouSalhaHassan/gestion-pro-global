"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  X, 
  Printer, 
  Download, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileSpreadsheet, 
  Loader2, 
  Calendar, 
  Phone, 
  UserCircle,
  Building2,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  Search,
  Receipt,
  Wallet,
  Scale
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, isWithinInterval, parseISO } from "date-fns";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";

type ClientStatementModalProps = {
  clientId: number;
  clientNom: string;
  onClose: () => void;
};

type PeriodPreset = "all" | "this_month" | "last_month" | "this_year" | "custom";
type EventTypeFilter = "all" | "deposit" | "invoice" | "payment" | "withdraw";

export default function ClientStatementModal({ clientId, clientNom, onClose }: ClientStatementModalProps) {
  const { locale, dir } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<EventTypeFilter>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  useEffect(() => {
    async function fetchStatement() {
      try {
        setLoading(true);
        const res = await fetch(`/api/clients/${clientId}/statement`);
        if (!res.ok) throw new Error("Failed to fetch statement");
        const statementData = await res.json();
        setData(statementData);
      } catch (e) {
        console.error("Failed to load client statement", e);
      } finally {
        setLoading(false);
      }
    }
    fetchStatement();
  }, [clientId]);

  // Handle Preset Changes
  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "this_month") {
      setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (preset === "last_month") {
      const prev = subMonths(now, 1);
      setStartDate(format(startOfMonth(prev), "yyyy-MM-dd"));
      setEndDate(format(endOfMonth(prev), "yyyy-MM-dd"));
    } else if (preset === "this_year") {
      setStartDate(format(startOfYear(now), "yyyy-MM-dd"));
      setEndDate(format(now, "yyyy-MM-dd"));
    }
  };

  // Enterprise Calculation: Opening Balance (Report à nouveau) & Filtered Events
  const { openingBalance, filteredEvents, periodDebit, periodCredit, closingBalance } = useMemo(() => {
    if (!data || !data.events) {
      return { openingBalance: 0, filteredEvents: [], periodDebit: 0, periodCredit: 0, closingBalance: 0 };
    }

    const allEvents: any[] = data.events;
    let openBal = 0;
    const startObj = startDate ? new Date(startDate + "T00:00:00") : null;
    const endObj = endDate ? new Date(endDate + "T23:59:59.999") : null;

    // 1. Calculate opening balance for events strictly before startDate
    const currentPeriodEvents: any[] = [];
    allEvents.forEach((e) => {
      const eventDate = new Date(e.date);
      if (startObj && eventDate < startObj) {
        openBal += (Number(e.credit) - Number(e.debit));
      } else if (!endObj || eventDate <= endObj) {
        currentPeriodEvents.push(e);
      }
    });

    // 2. Filter by Type and Search Term
    const matched = currentPeriodEvents.filter((e) => {
      // Type Match
      let matchesType = true;
      if (typeFilter === "deposit") matchesType = e.type.includes("Dépôt");
      else if (typeFilter === "invoice") matchesType = e.type.includes("Facture");
      else if (typeFilter === "payment") matchesType = e.type.includes("Règlement") || e.type.includes("Utilisation");
      else if (typeFilter === "withdraw") matchesType = e.type.includes("Retrait") || e.type.includes("Annulation");

      // Search Match
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
        e.reference?.toLowerCase().includes(term) ||
        e.type?.toLowerCase().includes(term) ||
        e.notes?.toLowerCase().includes(term) ||
        e.utilisateur?.toLowerCase().includes(term) ||
        e.moyen_paiement?.toLowerCase().includes(term);

      return matchesType && matchesSearch;
    });

    // 3. Recalculate Period Running Balance
    let running = openBal;
    let pDebit = 0;
    let pCredit = 0;

    const eventsWithRunning = matched.map((e) => {
      const debit = Number(e.debit) || 0;
      const credit = Number(e.credit) || 0;
      pDebit += debit;
      pCredit += credit;
      running += (credit - debit);
      return {
        ...e,
        solde_courant: running
      };
    });

    return {
      openingBalance: openBal,
      filteredEvents: eventsWithRunning,
      periodDebit: pDebit,
      periodCredit: pCredit,
      closingBalance: running
    };
  }, [data, startDate, endDate, typeFilter, searchTerm]);

  // Actions: CSV, WhatsApp, PDF, Print

  const handleExportCSV = () => {
    if (!data || !data.events) return;
    const client = data.client;
    const headers = ["Date,Type d'opération,Référence,Mode,Débit (-),Crédit (+),Solde Courant,Agent,Notes"];
    
    const rows: string[] = [];
    if (openingBalance !== 0 && startDate) {
      rows.push(`"${startDate}","REPORT À NOUVEAU / SOLDE INITIAL","—","—",0,0,${openingBalance},"SYSTEM","Solde antérieur reporté"`);
    }

    filteredEvents.forEach((e: any) => {
      rows.push(
        `"${format(new Date(e.date), 'dd/MM/yyyy')}","${e.type}","${e.reference}","${e.moyen_paiement || '—'}",${e.debit},${e.credit},${e.solde_courant},"${e.utilisateur || ''}","${(e.notes || '').replace(/"/g, '""')}"`
      );
    });

    rows.push(`"","TOTAUX PÉRIODE","—","—",${periodDebit},${periodCredit},${closingBalance},"",""`);

    const content = "\ufeff" + headers.concat(rows).join("\n");
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Releve_Compte_${client.nom.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareWhatsApp = () => {
    if (!data) return;
    const client = data.client;
    const comp = data.company?.nom_entreprise || "GESTION PRO GLOBAL";
    const statusText = closingBalance > 0 
      ? `🟢 *Solde Créditeur (En votre faveur) :* +${formatCurrencyAmount(closingBalance)}`
      : closingBalance < 0 
        ? `🔴 *Solde Débiteur (Reste à payer) :* ${formatCurrencyAmount(Math.abs(closingBalance))}`
        : `⚪ *Compte Équilibré (Soldé) :* 0 FCFA`;

    const periodText = startDate && endDate 
      ? `Du ${startDate} au ${endDate}`
      : "Historique Comptable Complet";

    const msg = encodeURIComponent(
      `📊 *RELEVÉ DE COMPTE CLIENT - ${comp}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Client :* ${client.nom} (${client.ref_client || "—"})\n` +
      `📅 *Période :* ${periodText}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Report Antérieur :* ${formatCurrencyAmount(openingBalance)}\n` +
      `📥 *Total Dépôts & Règlements :* +${formatCurrencyAmount(periodCredit)}\n` +
      `🛒 *Total Factures & Ventes :* -${formatCurrencyAmount(periodDebit)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${statusText}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `_Édité le ${format(new Date(), 'dd/MM/yyyy HH:mm')} - Document officiel comptable._`
    );

    const phoneNum = client.tel ? client.tel.replace(/[^0-9]/g, "") : "";
    const url = phoneNum ? `https://wa.me/${phoneNum}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
  };

  const handleOpenPDF = () => {
    const url = `/api/clients/${clientId}/statement/pdf?start=${startDate}&end=${endDate}&lang=${locale}`;
    const w = window.open(url, "_blank");
    if (w) w.focus();
  };

  const handlePrint = () => {
    const url = `/api/clients/${clientId}/statement/pdf?start=${startDate}&end=${endDate}&lang=${locale}&autoPrint=true`;
    const w = window.open(url, "_blank");
    if (w) w.focus();
  };

  const company = data?.company;
  const client = data?.client;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 print:p-0 print:static print:inset-auto animate-in fade-in duration-200">

      {/* Modal Backdrop (hidden in print) */}
      <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm print:hidden" onClick={onClose}></div>

      {/* Modal Container */}
      <div 
        className="bg-white dark:bg-slate-900 rounded-[32px] print:rounded-none overflow-hidden relative z-10 w-full max-w-6xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[94vh] print:max-h-none print:shadow-none print:border-none print:w-full print:h-full transition-all"
        dir={dir}
      >
        {/* Top Operational Bar (hidden in print) */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap justify-between items-center bg-slate-50/70 dark:bg-slate-900/60 print:hidden gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Scale size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>{locale === "ar" ? "كشف حساب أستاذ مساعد عميل (Grand Livre)" : "Extrait de Compte & Grand Livre Client"}</span>
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-extrabold uppercase">
                  Enterprise
                </span>
              </h3>
              <p className="text-[10px] font-bold text-slate-400 tracking-wider">
                {locale === "ar" 
                  ? "تتبع الحركات المالية، الأمانات، الفواتير، والأرصدة المستمرة بدقة محاسبية متقدمة" 
                  : "Historique chronologique des flux financiers, acomptes, factures et soldes progressifs"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={handleShareWhatsApp}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60 rounded-xl font-black text-xs transition-all active:scale-95 shadow-xs cursor-pointer"
              title="Partager le relevé par WhatsApp"
            >
              <Share2 size={15} /> 
              <span>WhatsApp</span>
            </button>

            <button 
              onClick={handleExportCSV}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-black text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet size={15} className="text-emerald-600" /> 
              <span>Excel / CSV</span>
            </button>

            <button 
              onClick={handleOpenPDF}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60 rounded-xl font-black text-xs transition-all active:scale-95 shadow-xs cursor-pointer"
              title={locale === "ar" ? "فتح وتصدير مستند PDF رسمي" : "Ouvrir et exporter en PDF officiel"}
            >
              <Download size={15} /> 
              <span>{locale === "ar" ? "تصدير PDF" : "Exporter PDF"}</span>
            </button>

            <button 
              onClick={handlePrint}
              disabled={loading || !data}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs transition-all active:scale-95 shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Printer size={15} /> 
              <span>{locale === "ar" ? "طباعة A4" : "Imprimer A4"}</span>
            </button>

            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Control Center (hidden in print) */}
        <div className="px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 print:hidden space-y-3">
          {/* Preset Buttons & Date Inputs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">
                {locale === "ar" ? "الفترة:" : "Période :"}
              </span>
              {[
                { id: "all", label: locale === "ar" ? "كامل السجل" : "Tout l'historique" },
                { id: "this_month", label: locale === "ar" ? "هذا الشهر" : "Ce mois" },
                { id: "last_month", label: locale === "ar" ? "الشهر السابق" : "Mois précédent" },
                { id: "this_year", label: locale === "ar" ? "هذه السنة" : "Cette année" },
                { id: "custom", label: locale === "ar" ? "مخصص" : "Personnalisé" }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetChange(p.id as PeriodPreset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    periodPreset === p.id 
                      ? "bg-blue-600 text-white shadow-xs" 
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Range Inputs */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                <span className="text-[10px] text-slate-400 font-black uppercase">{locale === "ar" ? "من" : "Du"}</span>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPeriodPreset("custom");
                  }}
                  className="bg-transparent border-0 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                <span className="text-[10px] text-slate-400 font-black uppercase">{locale === "ar" ? "إلى" : "Au"}</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPeriodPreset("custom");
                  }}
                  className="bg-transparent border-0 text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Type Filter & Live Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">
                {locale === "ar" ? "نوع العملية:" : "Opération :"}
              </span>
              {[
                { id: "all", label: locale === "ar" ? "الكل" : "Toutes" },
                { id: "deposit", label: locale === "ar" ? "إيداعات وأمانات" : "Dépôts & Acomptes" },
                { id: "payment", label: locale === "ar" ? "تسويات فواتير" : "Règlements" },
                { id: "invoice", label: locale === "ar" ? "فواتير المبيعات" : "Factures" },
                { id: "withdraw", label: locale === "ar" ? "سحوبات واسترداد" : "Retraits" }
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id as EventTypeFilter)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    typeFilter === t.id 
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" 
                      : "bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Live Search */}
            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder={locale === "ar" ? "بحث برقم الفاتورة، المرجع، الملاحظات..." : "Rechercher réf, BL, libellé..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Printable Official Document Body */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:overflow-visible print:p-6 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-28 text-slate-400">
               <Loader2 className="animate-spin mb-3 text-blue-600" size={36} />
               <p className="text-xs font-black uppercase tracking-widest">
                 {locale === "ar" ? "جاري تدقيق وحساب كشف الحساب المالي..." : "Génération et calcul de l'extrait comptable..."}
               </p>
            </div>
          ) : !data ? (
            <div className="text-center py-24 text-slate-400">
               <AlertCircle size={48} className="mx-auto mb-4 text-rose-500" />
               <p className="text-base font-black">
                 {locale === "ar" ? "تعذر تحميل بيانات كشف الحساب." : "Impossible de charger le relevé de compte."}
               </p>
            </div>
          ) : (
            <div id="printable-statement" className="space-y-6">
              {/* Header for Screen & Print: Official Company & Client Header */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-3xl p-6 bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-800/40 dark:to-slate-900 print:bg-white print:border-slate-400 print:p-5">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-5 border-b border-slate-200 dark:border-slate-800 print:border-slate-300">
                  {/* Company Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                        {company?.nom_entreprise || "GESTION PRO GLOBAL"}
                      </h1>
                      <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md uppercase print:border print:border-black">
                        OFFICIEL
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
                      {company?.activite || "Commerce Général, Import-Export & Distribution Multi-dépôts"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {company?.adresse || "Siège Commercial"} {company?.ville ? `• ${company.ville}` : ""} {company?.pays ? `(${company.pays})` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] font-mono text-slate-500">
                      {company?.nif && <span><strong>NIF:</strong> {company.nif}</span>}
                      {company?.rccm && <span><strong>RCCM:</strong> {company.rccm}</span>}
                      {company?.telephone && <span><strong>Tél:</strong> {company.telephone}</span>}
                    </div>
                  </div>

                  {/* Document Title & Reference Block */}
                  <div className="text-left sm:text-right flex flex-col items-start sm:items-end">
                    <div className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest print:border print:border-slate-900">
                      RELEVÉ DE COMPTE CLIENT
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 mt-2">
                      REF DOC: REL-{client.id}-{format(new Date(), "yyyyMMdd")}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      {locale === "ar" ? "تاريخ الإصدار:" : "Édité le :"} {format(new Date(), "dd/MM/yyyy HH:mm")}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 mt-1 bg-blue-50 px-2 py-0.5 rounded">
                      {startDate && endDate 
                        ? `${locale === "ar" ? "الفترة:" : "Période :"} ${startDate} → ${endDate}`
                        : `${locale === "ar" ? "الفترة: كامل السجل" : "Période : Historique complet"}`
                      }
                    </span>
                  </div>
                </div>

                {/* Client Profile Box */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 print:border-slate-300">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-sm uppercase">
                      {client.nom?.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {locale === "ar" ? "بيانات العميل المستفيد" : "Compte Client"}
                      </div>
                      <div className="text-base font-black text-slate-900 dark:text-white uppercase">
                        {client.nom}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-6 bg-white dark:bg-slate-800/80 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700/60 print:border-slate-300">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {locale === "ar" ? "المرجع التعريفي" : "Code Référence"}
                      </span>
                      <span className="text-xs font-mono font-black text-slate-800 dark:text-white">
                        {client.ref_client || `CL-${client.id}`}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {locale === "ar" ? "رقم الهاتف" : "Téléphone"}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-white">
                        {client.tel || "—"}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {locale === "ar" ? "حالة المحفظة" : "Statut Portefeuille"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600">
                        <CheckCircle2 size={12} /> {locale === "ar" ? "نشط وموثق" : "Actif & Conforme"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* KPI Financial Metric Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-3">
                {/* 1. Opening Balance */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 print:bg-white print:border-slate-300">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {locale === "ar" ? "رصيد سابق (منقول)" : "Report à Nouveau"}
                    </span>
                    <Clock size={14} className="text-slate-400 print:hidden" />
                  </div>
                  <div className={`text-lg font-black ${openingBalance >= 0 ? 'text-slate-800 dark:text-white' : 'text-rose-600'}`}>
                    {openingBalance >= 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR").format(openingBalance)}
                    <span className="text-[10px] text-slate-400 font-bold ml-1">FCFA</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {startDate ? `${locale === "ar" ? "قبل" : "Avant"} ${startDate}` : `${locale === "ar" ? "بداية التعاملات" : "Origine"}`}
                  </span>
                </div>

                {/* 2. Credits (Dépôts & Paiements) */}
                <div className="bg-emerald-50/50 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 print:bg-white print:border-slate-300">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                      {locale === "ar" ? "إجمالي المقبوضات (+)" : "Total Crédits (+)"}
                    </span>
                    <ArrowDownLeft size={14} className="text-emerald-600 print:hidden" />
                  </div>
                  <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                    +{new Intl.NumberFormat("fr-FR").format(periodCredit)}
                    <span className="text-[10px] text-emerald-600/70 font-bold ml-1">FCFA</span>
                  </div>
                  <span className="text-[9px] text-emerald-600/80 font-medium">
                    {locale === "ar" ? "ودائع وأقساط مسددة" : "Acomptes & Règlements"}
                  </span>
                </div>

                {/* 3. Debits (Factures & Retraits) */}
                <div className="bg-rose-50/50 dark:bg-rose-500/5 p-4 rounded-2xl border border-rose-100 dark:border-rose-500/20 print:bg-white print:border-slate-300">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest">
                      {locale === "ar" ? "إجمالي المشتريات (-)" : "Total Débits (-)"}
                    </span>
                    <ArrowUpRight size={14} className="text-rose-600 print:hidden" />
                  </div>
                  <div className="text-lg font-black text-rose-700 dark:text-rose-400">
                    -{new Intl.NumberFormat("fr-FR").format(periodDebit)}
                    <span className="text-[10px] text-rose-600/70 font-bold ml-1">FCFA</span>
                  </div>
                  <span className="text-[9px] text-rose-600/80 font-medium">
                    {locale === "ar" ? "فواتير وسحوبات نقدية" : "Achats facturés & Retraits"}
                  </span>
                </div>

                {/* 4. Net Position / Solde de Clôture */}
                <div className={`p-4 rounded-2xl border print:border-slate-300 ${
                  closingBalance > 0 
                    ? "bg-blue-50/60 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-300"
                    : closingBalance < 0
                      ? "bg-amber-50/60 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-300"
                      : "bg-slate-50 dark:bg-slate-800 border-slate-200 text-slate-800"
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {locale === "ar" ? "الرصيد الختامي الصافي" : "Solde de Clôture"}
                    </span>
                    <Scale size={14} className="print:hidden" />
                  </div>
                  <div className="text-lg font-black">
                    {closingBalance > 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR").format(closingBalance)}
                    <span className="text-[10px] font-bold ml-1 opacity-80">FCFA</span>
                  </div>
                  <span className="text-[9px] font-bold block mt-0.5">
                    {closingBalance > 0 
                      ? (locale === "ar" ? "دائن (لصالح العميل)" : "Solde Créditeur (Avance)")
                      : closingBalance < 0
                        ? (locale === "ar" ? "مدين (مستحق على العميل)" : "Solde Débiteur (Dette)")
                        : (locale === "ar" ? "الحساب متوازن بالكامل" : "Compte Équilibré")
                    }
                  </span>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs print:border-slate-400 print:rounded-none">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider print:bg-slate-200 print:text-black">
                      <th className="px-4 py-3.5 text-center w-24 border-r border-slate-800 print:border-slate-400">
                        {locale === "ar" ? "التاريخ" : "Date"}
                      </th>
                      <th className="px-4 py-3.5 border-r border-slate-800 print:border-slate-400">
                        {locale === "ar" ? "نوع العملية" : "Opération"}
                      </th>
                      <th className="px-4 py-3.5 border-r border-slate-800 print:border-slate-400">
                        {locale === "ar" ? "المرجع" : "Référence"}
                      </th>
                      <th className="px-4 py-3.5 border-r border-slate-800 print:border-slate-400 text-center">
                        {locale === "ar" ? "طريقة الدفع" : "Mode"}
                      </th>
                      <th className="px-4 py-3.5 text-right border-r border-slate-800 print:border-slate-400 w-28">
                        {locale === "ar" ? "مدين (-)" : "Débit (-)"}
                      </th>
                      <th className="px-4 py-3.5 text-right border-r border-slate-800 print:border-slate-400 w-28">
                        {locale === "ar" ? "دائن (+)" : "Crédit (+)"}
                      </th>
                      <th className="px-4 py-3.5 text-right border-r border-slate-800 print:border-slate-400 w-32">
                        {locale === "ar" ? "الرصيد المستمر" : "Solde Progressif"}
                      </th>
                      <th className="px-4 py-3.5 max-w-[240px] print:max-w-none">
                        {locale === "ar" ? "البيان / ملاحظات" : "Libellé & Détails"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {/* Line 0: Opening Balance (Report à nouveau) if date filtered */}
                    {startDate && (
                      <tr className="bg-slate-100/70 dark:bg-slate-800/80 font-black text-slate-800 dark:text-white">
                        <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px] border-r border-slate-200 dark:border-slate-700 print:border-slate-300">
                          {startDate}
                        </td>
                        <td className="px-4 py-3 border-r border-slate-200 dark:border-slate-700 print:border-slate-300">
                          <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[9px] uppercase font-black">
                            REPORT
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] border-r border-slate-200 dark:border-slate-700 print:border-slate-300">
                          —
                        </td>
                        <td className="px-4 py-3 text-center text-slate-400 border-r border-slate-200 dark:border-slate-700 print:border-slate-300">
                          —
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 border-r border-slate-200 dark:border-slate-700 print:border-slate-300">
                          —
                        </td>
                        <td className="px-4 py-3 text-right text-slate-400 border-r border-slate-200 dark:border-slate-700 print:border-slate-300">
                          —
                        </td>
                        <td className={`px-4 py-3 text-right font-black border-r border-slate-200 dark:border-slate-700 print:border-slate-300 ${
                          openingBalance >= 0 ? "text-slate-900 dark:text-white" : "text-rose-600"
                        }`}>
                          {openingBalance >= 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR").format(openingBalance)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 italic">
                          {locale === "ar" ? "رصيد سابق منقول من العمليات السابقة" : "Report du solde antérieur à la période"}
                        </td>
                      </tr>
                    )}

                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-16 text-center text-slate-400 uppercase font-black text-xs">
                          {locale === "ar" ? "لا توجد أي حركات مالية مسجلة خلال الفترة المحددة." : "Aucune écriture comptable trouvée pour cette période."}
                        </td>
                      </tr>
                    ) : (
                      filteredEvents.map((e: any, idx: number) => {
                        const isCredit = Number(e.credit) > 0;
                        const isDebit = Number(e.debit) > 0;

                        return (
                          <tr 
                            key={e.id || idx} 
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                              idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-800/10' : 'bg-white dark:bg-slate-900'
                            }`}
                          >
                            <td className="px-4 py-3 text-center text-slate-500 font-mono text-[11px] border-r border-slate-100 dark:border-slate-800 print:border-slate-300">
                              {format(new Date(e.date), "dd/MM/yyyy")}
                            </td>

                            <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800 print:border-slate-300">
                              <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider inline-block ${
                                e.type.includes("Dépôt") 
                                  ? "bg-blue-50 text-blue-700 border border-blue-200/50" 
                                  : e.type.includes("Règlement") 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                                    : e.type.includes("Facture") 
                                      ? "bg-rose-50 text-rose-700 border border-rose-200/50"
                                      : "bg-amber-50 text-amber-700 border border-amber-200/50"
                              }`}>
                                {e.type}
                              </span>
                            </td>

                            <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-800 print:border-slate-300">
                              {e.reference}
                            </td>

                            <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 text-[11px] border-r border-slate-100 dark:border-slate-800 print:border-slate-300">
                              {e.moyen_paiement || "—"}
                            </td>

                            <td className="px-4 py-3 text-right font-black text-rose-600 border-r border-slate-100 dark:border-slate-800 print:border-slate-300">
                              {isDebit ? `-${new Intl.NumberFormat("fr-FR").format(e.debit)}` : "—"}
                            </td>

                            <td className="px-4 py-3 text-right font-black text-emerald-600 border-r border-slate-100 dark:border-slate-800 print:border-slate-300">
                              {isCredit ? `+${new Intl.NumberFormat("fr-FR").format(e.credit)}` : "—"}
                            </td>

                            <td className={`px-4 py-3 text-right font-black text-xs border-r border-slate-100 dark:border-slate-800 print:border-slate-300 ${
                              e.solde_courant > 0 
                                ? "text-blue-700 dark:text-blue-400" 
                                : e.solde_courant < 0 
                                  ? "text-rose-600" 
                                  : "text-slate-500"
                            }`}>
                              {e.solde_courant > 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR").format(e.solde_courant)}
                            </td>

                            <td className="px-4 py-3 text-slate-500 text-[11px] max-w-[240px] truncate print:max-w-none print:whitespace-normal" title={e.notes}>
                              <span>{e.notes || "—"}</span>
                              {e.utilisateur && (
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  {locale === "ar" ? "المسؤول:" : "Par:"} {e.utilisateur}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Totals Footer */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black uppercase text-xs print:bg-slate-200 print:text-black">
                      <td colSpan={4} className="px-4 py-3.5 text-right tracking-wider border-r border-white/10 print:border-slate-400">
                        {locale === "ar" ? "إجمالي الفترة والنتيجة الختامية :" : "TOTAUX DE LA PÉRIODE :"}
                      </td>
                      <td className="px-4 py-3.5 text-right text-rose-300 border-r border-white/10 print:border-slate-400 font-mono">
                        -{new Intl.NumberFormat("fr-FR").format(periodDebit)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-emerald-300 border-r border-white/10 print:border-slate-400 font-mono">
                        +{new Intl.NumberFormat("fr-FR").format(periodCredit)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-white font-mono text-sm border-r border-white/10 print:border-slate-400">
                        {closingBalance > 0 ? "+" : ""}{new Intl.NumberFormat("fr-FR").format(closingBalance)} FCFA
                      </td>
                      <td className="px-4 py-3.5 text-[10px] text-slate-300 print:text-black">
                        {closingBalance > 0 
                          ? (locale === "ar" ? "رصيد دائن لصالح العميل" : "Solde en faveur du client")
                          : closingBalance < 0 
                            ? (locale === "ar" ? "رصيد مدين على العميل" : "Créance à recouvrer")
                            : (locale === "ar" ? "حساب متوازن" : "Compte soldé")
                        }
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Legal Notice & Accounting Signatures Block (Shown in Print & Official Review) */}
              <div className="mt-8 pt-6 border-t border-slate-200 print:border-slate-400 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="space-y-12">
                  <div>
                    <p className="font-black text-slate-900 uppercase">
                      {locale === "ar" ? "توقيع ومصادقة العميل" : "Le Client (Bon pour accord)"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {locale === "ar" ? "أقر بصحة هذه الحركات والرصيد" : "Signature précédée de la mention"}
                    </p>
                  </div>
                  <div className="h-14 border-b border-dashed border-slate-300 print:border-slate-400 mx-4"></div>
                </div>

                <div className="space-y-12">
                  <div>
                    <p className="font-black text-slate-900 uppercase">
                      {locale === "ar" ? "أمين الصندوق / المحاسب" : "Visa Caissier / Comptable"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {locale === "ar" ? "تدقيق واعتماد السندات" : "Contrôle & Certification"}
                    </p>
                  </div>
                  <div className="h-14 border-b border-dashed border-slate-300 print:border-slate-400 mx-4"></div>
                </div>

                <div className="space-y-12">
                  <div>
                    <p className="font-black text-slate-900 uppercase">
                      {locale === "ar" ? "إدارة المؤسسة (الختم الرسمي)" : "Cachet & Direction Générale"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {locale === "ar" ? "الختم المالي الرسمي" : "Authentification officielle"}
                    </p>
                  </div>
                  <div className="h-14 border-b border-dashed border-slate-300 print:border-slate-400 mx-4"></div>
                </div>
              </div>

              {/* Legal Footer Note */}
              <div className="text-center text-[10px] text-slate-400 font-medium pt-3 print:pt-4">
                {locale === "ar" 
                  ? "كشف حساب مستخرج آلياً من نظام GESTION PRO GLOBAL المحاسبي. يعتبر وثيقة رسمية للمطابقة المالية والتسوية."
                  : "Extrait de compte certifié conforme aux écritures du système GESTION PRO GLOBAL. Document officiel faisant foi pour rapprochement financier."}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer (hidden in print) */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex justify-between items-center print:hidden">
          <div className="text-xs text-slate-400 font-bold hidden sm:block">
            {locale === "ar" 
              ? `إجمالي الحركات المحملة: ${filteredEvents.length} عملية` 
              : `Total écritures affichées : ${filteredEvents.length} opérations`}
          </div>

          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shadow-xs ml-auto"
          >
            {locale === "ar" ? "إغلاق" : "Fermer"}
          </button>
        </div>
      </div>
    </div>
  );
}
