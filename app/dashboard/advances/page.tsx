"use client";

import { useEffect, useState, useMemo } from "react";
import { useAdvanceStore } from "@/lib/stores/advance-store";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Wallet,
  X,
  User,
  ArrowDownToLine,
  Pencil,
  Ban,
  AlertTriangle,
  Printer,
  Clock,
  Filter,
  MapPin,
  FileSpreadsheet,
  Download,
  Loader2,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Building2,
  CreditCard,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Phone,
  Calendar,
  Receipt,
} from "lucide-react";
import AdvanceReceiptModal from "./AdvanceReceiptModal";
import DepositListModal from "./DepositListModal";
import HistoryModal from "./HistoryModal";
import ClientStatementModal from "./ClientStatementModal";
import ImputeAdvanceModal from "./ImputeAdvanceModal";

export default function AdvancesPage() {
  const { t, locale, dir } = useLanguage();
  const { advances, fetchAdvances, isLoading, addAdvance, withdraw, updateAdvance, cancelAdvance } =
    useAdvanceStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [clients, setClients] = useState<any[]>([]);

  // -- MODALS STATE --
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [historyAdvanceId, setHistoryAdvanceId] = useState<number | null>(null);
  const [printAdvanceId, setPrintAdvanceId] = useState<number | null>(null);
  const [printCustomData, setPrintCustomData] = useState<any | null>(null);
  const [printMode, setPrintMode] = useState<'single' | 'statement' | 'withdraw' | 'imputation'>('single');
  const [imputeAdvance, setImputeAdvance] = useState<any | null>(null);
  const [isGlobalPrintOpen, setIsGlobalPrintOpen] = useState(false);
  const [activeView, setActiveView] = useState<"individual" | "client-summary">("individual");
  const [selectedClientIdForStatement, setSelectedClientIdForStatement] = useState<number | null>(null);
  const [selectedClientNomForStatement, setSelectedClientNomForStatement] = useState<string>("");

  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
  const [createClientData, setCreateClientData] = useState({
    nom: "",
    tel: "",
    ref_client: "",
  });

  // -- SELECTION STATE --
  const [selectedAdvance, setSelectedAdvance] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [filterSeller, setFilterSeller] = useState("Tous");

  // -- FORM STATES --
  const [createData, setCreateData] = useState({
    client_id: "",
    montant_initial: "",
    moyen_paiement: "Espece",
    reference_paiement: "",
    notes: "",
    date_avance: new Date().toISOString().split("T")[0],
  });

  const [editData, setEditData] = useState({
    moyen_paiement: "Espece",
    reference_paiement: "",
    notes: "",
    date_avance: new Date().toISOString().split("T")[0],
  });

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [withdrawPaymentMethod, setWithdrawPaymentMethod] = useState("Espece");

  useEffect(() => {
    fetchAdvances();
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch((e) => console.error("Could not load clients", e));

    const cookie = document.cookie.split("; ").find((row) => row.startsWith("gp_session="));
    if (cookie) {
      try {
        const session = JSON.parse(decodeURIComponent(cookie.split("=")[1]));
        setUserSession(session);
      } catch (e) {
        console.error(e);
      }
    }
  }, [fetchAdvances]);

  const isAdmin = userSession?.admin === "Oui" || userSession?.role === 1 || userSession?.role === "1";

  // Helper to safely extract client info with multiple fallbacks
  const getClientInfo = (adv: any) => {
    const rawClients = adv?.clients;
    const clientFromStore = clients.find((c) => Number(c.id) === Number(adv?.client_id));
    const clientObj = Array.isArray(rawClients) ? rawClients[0] : (rawClients || clientFromStore);

    const nom = clientObj?.nom || (adv?.client_id ? `Client #${adv.client_id}` : (locale === "ar" ? "عميل غير محدد" : "Client Inconnu"));
    const clientRef = clientObj?.ref_client || "";
    const displayRef = adv?.reference_paiement || clientRef || (adv?.id ? `DEP-${String(adv.id).padStart(4, '0')}` : "—");
    const tel = clientObj?.tel || "";

    return { nom, clientRef, displayRef, tel, clientObj };
  };

  const filteredAdvances = useMemo(() => {
    return advances.filter((a) => {
      const { nom: clientName, clientRef, displayRef } = getClientInfo(a);
      const matchesSearch =
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        displayRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.reference_paiement && a.reference_paiement.toLowerCase().includes(searchTerm.toLowerCase())) ||
        a.statut?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeller = filterSeller === "Tous" || a.utilisateur === filterSeller;
      const matchesStatus = statusFilter === "Tous" || a.statut === statusFilter;
      return matchesSearch && matchesSeller && matchesStatus;
    });
  }, [advances, clients, searchTerm, filterSeller, statusFilter]);

  const uniqueSellers = Array.from(new Set(advances.map((a) => a.utilisateur).filter(Boolean)));

  const clientSummaries = useMemo(() => {
    return clients
      .map((client) => {
        const clientAdvances = advances.filter(
          (a) => Number(a.client_id) === Number(client.id) && a.statut !== "Annulée"
        );
        const totalDeposited = clientAdvances.reduce((sum, a) => sum + Number(a.montant_initial), 0);
        const soldeAvances = clientAdvances.reduce((sum, a) => sum + Number(a.montant_restant), 0);
        const creditFacture = Number(client.credit_facture) || 0;
        const positionNette = soldeAvances - creditFacture;
        return {
          ...client,
          total_depose: totalDeposited,
          solde_avances: soldeAvances,
          credit_facture: creditFacture,
          position_nette: positionNette,
          has_activity: totalDeposited > 0 || creditFacture > 0,
        };
      })
      .filter((c) => c.has_activity);
  }, [clients, advances]);

  const filteredClientSummaries = useMemo(() => {
    return clientSummaries.filter((c) => {
      return (
        c.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.ref_client && c.ref_client.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.tel && c.tel.includes(searchTerm))
      );
    });
  }, [clientSummaries, searchTerm]);

  // -- TOTALS --
  const totalDepositedSum = advances
    .filter((a) => a.statut !== "Annulée")
    .reduce((sum, a) => sum + Number(a.montant_initial), 0);
  const totalRemainingSum = advances
    .filter((a) => a.statut !== "Annulée")
    .reduce((sum, a) => sum + Number(a.montant_restant), 0);
  const totalConsumedSum = totalDepositedSum - totalRemainingSum;

  // -- HANDLERS --
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (!createData.client_id || !createData.montant_initial) return;
      const autoRef = createData.reference_paiement || `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await addAdvance({
        client_id: Number(createData.client_id),
        montant_initial: Number(createData.montant_initial),
        date_avance: createData.date_avance,
        moyen_paiement: createData.moyen_paiement,
        reference_paiement: autoRef,
        notes: createData.notes,
      });
      setIsCreateModalOpen(false);
      fetchAdvances();
      setCreateData({
        client_id: "",
        montant_initial: "",
        moyen_paiement: "Espece",
        reference_paiement: "",
        notes: "",
        date_avance: new Date().toISOString().split("T")[0],
      });
    } catch (error) {
      alert("Erreur lors de la création.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createClientData.nom) return;
    setIsSubmitting(true);
    try {
      let finalRef = createClientData.ref_client;
      if (!finalRef) {
        const year = new Date().getFullYear();
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        finalRef = `CL-${year}-${randomPart}`;
      }

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: createClientData.nom,
          tel: createClientData.tel || null,
          ref_client: finalRef,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur lors de la création.");
      }

      const newClient = await res.json();
      setClients((prev) => [newClient, ...prev]);
      setCreateData((prev) => ({ ...prev, client_id: String(newClient.id) }));
      setIsCreateClientModalOpen(false);
      setCreateClientData({ nom: "", tel: "", ref_client: "" });
    } catch (error: any) {
      alert(error.message || "Erreur lors de la création du client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const amt = Number(withdrawAmount);
      if (!amt || amt <= 0 || amt > Number(selectedAdvance.montant_restant)) {
        alert(locale === "ar" ? "المبلغ غير صالح أو يتجاوز الرصيد." : "Montant invalide ou supérieur au solde disponible.");
        setIsSubmitting(false);
        return;
      }

      const noteText = `${withdrawNotes ? withdrawNotes + " " : ""}(${locale === "ar" ? "طريقة الدفع: " : "Mode: "}${withdrawPaymentMethod})`;
      await withdraw(selectedAdvance.id, amt, noteText, userSession?.username);
      
      const remainingAfter = Math.max(0, Number(selectedAdvance.montant_restant) - amt);
      const advId = selectedAdvance.id;

      setIsWithdrawModalOpen(false);
      setSelectedAdvance(null);
      fetchAdvances();

      // Open withdrawal receipt immediately for printing
      setPrintCustomData({
        type: 'WITHDRAW',
        amount: amt,
        notes: noteText,
        advance_remaining: remainingAfter
      });
      setPrintMode('withdraw');
      setPrintAdvanceId(advId);
    } catch (error) {
      alert(locale === "ar" ? "حدث خطأ أثناء تنفيذ السحب." : "Erreur lors du retrait.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImputeSuccess = (result: any) => {
    setImputeAdvance(null);
    fetchAdvances();

    // Trigger printing voucher for invoice imputation
    setPrintCustomData({
      type: 'IMPUTATION',
      amount: result.applied_amount,
      invoice_ref: result.invoice_ref,
      invoice_remaining: result.invoice_remaining,
      advance_remaining: result.advance_remaining
    });
    setPrintMode('imputation');
    setPrintAdvanceId(result.advance_id);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateAdvance(selectedAdvance.id, editData);
      setIsEditModalOpen(false);
      setSelectedAdvance(null);
    } catch (error) {
      alert("Erreur lors de la modification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubmit = async () => {
    setIsSubmitting(true);
    try {
      await cancelAdvance(selectedAdvance.id);
      setIsDeleteModalOpen(false);
      setSelectedAdvance(null);
    } catch (error) {
      alert("Erreur lors de l'annulation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Client,Ref,Date,Montant Initial,Montant Restant,Moyen,Emplacement,Vendeur,Statut"];
    const rows = filteredAdvances.map((a) => {
      const { nom: clientNom, displayRef } = getClientInfo(a);
      return `"${clientNom}","${displayRef}","${a.date_avance}",${a.montant_initial},${
        a.montant_restant
      },"${a.moyen_paiement}","${a.emplacement || "Général"}","${a.utilisateur}","${a.statut}"`;
    });
    const content = headers.concat(rows).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `advances_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareAdvanceWhatsApp = (adv: any) => {
    const { nom: clientNom, displayRef } = getClientInfo(adv);
    const text = encodeURIComponent(
      `💰 *Reçu de Dépôt / Acompte - GestionPro Global*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Client :* ${clientNom}\n` +
        `🔢 *Référence :* ${displayRef}\n` +
        `📅 *Date :* ${adv.date_avance}\n` +
        `💵 *Montant Déposé :* ${formatCurrencyAmount(Number(adv.montant_initial))}\n` +
        `💳 *Solde Restant :* ${formatCurrencyAmount(Number(adv.montant_restant))}\n` +
        `🏢 *Dépôt / Agence :* ${adv.emplacement || "BOUTIQUE"}\n` +
        `🔢 *Mode de Paiement :* ${adv.moyen_paiement || "Espèce"}\n` +
        `✅ *Statut :* ${adv.statut}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Merci pour votre confiance !_`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-[32px] p-6 lg:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-xs font-black tracking-wider flex items-center gap-1.5 shadow-md">
                <Wallet size={14} />
                CUSTOMER WALLET & CASH ADVANCES
              </span>
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-500/30">
                <Sparkles size={12} className="text-amber-400" />
                {clientSummaries.length} {locale === "ar" ? "محفظة عميل نشطة" : "Comptes Actifs"}
              </span>
            </div>

            <h1 className="text-2xl lg:text-3xl font-black text-white">
              {locale === "ar" ? "إدارة الودائع والأرصدة المسبقة للعملاء" : "Dépôts & Avances Clients"}
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 font-medium mt-1">
              {locale === "ar"
                ? "إيداع الأرصدة، شحن المحافظ المالية للعملاء، والاستهلاك التلقائي في الفواتير والـ POS"
                : "Gestion centralisée des acomptes, soldes prépayés et imputation automatique sur factures"}
            </p>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportToCSV}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              title="Exporter CSV"
            >
              <FileSpreadsheet size={15} className="text-emerald-400" />
              <span>{locale === "ar" ? "تصدير" : "Exporter"}</span>
            </button>

            <button
              onClick={() => setIsGlobalPrintOpen(true)}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Printer size={15} />
              <span>{locale === "ar" ? "طباعة الكشف" : "Imprimer Relevé"}</span>
            </button>

            <button
              onClick={() => setIsCreateClientModalOpen(true)}
              className="p-3 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <Plus size={15} />
              <span>{locale === "ar" ? "عميل جديد" : "Nouveau Client"}</span>
            </button>

            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-black text-xs shadow-xl shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{locale === "ar" ? "تسجيل إيداع جديد" : "Nouveau Dépôt"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top 3 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "إجمالي الودائع المقبوضة" : "Total Dépôts Encaissés"}
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{formatCurrencyAmount(totalDepositedSum)}</div>
          <div className="text-xs text-slate-500 font-bold mt-1.5 flex items-center gap-1">
            <Layers size={13} className="text-blue-500" />
            <span>{advances.length} {locale === "ar" ? "عملية إيداع مسجلة" : "avances enregistrées"}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "الرصيد المتاح الجاهز للاستخدام" : "Solde Actif Disponible"}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">{formatCurrencyAmount(totalRemainingSum)}</div>
          <div className="text-xs text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
            <CheckCircle2 size={13} />
            <span>{locale === "ar" ? "جاهز للخصم على المبيعات" : "Utilisable en caisse et facturation"}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              {locale === "ar" ? "المبالغ المستهلكة في الفواتير" : "Total Consommé sur Factures"}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Wallet size={18} />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600">{formatCurrencyAmount(totalConsumedSum)}</div>
          <div className="text-xs text-slate-500 font-bold mt-1.5">
            {locale === "ar" ? "تم تحويلها لمبيعات فعلية" : "Imputé avec succès sur les ventes"}
          </div>
        </div>
      </div>

      {/* Tabs Selector & Search Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Segmented Tab Controls */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1">
            <button
              onClick={() => setActiveView("individual")}
              className={`px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeView === "individual"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers size={14} />
              <span>{locale === "ar" ? "سجل الإيداعات الفردية" : "Journal des Acomptes"}</span>
            </button>

            <button
              onClick={() => setActiveView("client-summary")}
              className={`px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeView === "client-summary"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User size={14} />
              <span>{locale === "ar" ? "كشف محافظ العملاء (صافي الرصيد)" : "Synthèse Portefeuilles Clients"}</span>
            </button>
          </div>

          <div className="text-xs font-extrabold text-slate-500">
            {activeView === "individual" ? (
              <>
                Total : <span className="text-blue-600">{filteredAdvances.length}</span> {locale === "ar" ? "إيداع" : "acomptes"}
              </>
            ) : (
              <>
                Total : <span className="text-blue-600">{filteredClientSummaries.length}</span> {locale === "ar" ? "عميل" : "clients"}
              </>
            )}
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                locale === "ar"
                  ? "بحث باسم العميل، الهاتف، أو رقم الإيصال..."
                  : "Rechercher par nom client, téléphone, référence..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {activeView === "individual" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="Tous">{locale === "ar" ? "كافة الحالات" : "Tous les statuts"}</option>
              <option value="Disponible">Disponible (Dispo)</option>
              <option value="Partiellement utilisée">Partiellement Utilisée</option>
              <option value="Épuisée">Épuisée (Consommée)</option>
              <option value="Annulée">Annulée</option>
            </select>
          )}

          {isAdmin && activeView === "individual" && (
            <select
              value={filterSeller}
              onChange={(e) => setFilterSeller(e.target.value)}
              className="px-3 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="Tous">{locale === "ar" ? "كافة الكاشيرية" : "Tous les vendeurs"}</option>
              {uniqueSellers.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Table: Individual Advances Feed */}
      {activeView === "individual" ? (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{locale === "ar" ? "العميل" : "Client"}</th>
                  <th className="py-3.5 px-4 text-center">{locale === "ar" ? "التاريخ" : "Date"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "المبلغ الأولي" : "Montant Initial"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "الرصيد المتبقي" : "Solde Restant"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "الفرع / الدكان" : "Dépôt / Agence"}</th>
                  <th className="py-3.5 px-4 text-center">{locale === "ar" ? "الحالة" : "Statut"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <Loader2 size={32} className="animate-spin mx-auto text-blue-600 mb-2" />
                      <span>{locale === "ar" ? "جاري تحميل سجل الأرصدة..." : "Chargement des acomptes..."}</span>
                    </td>
                  </tr>
                ) : filteredAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <Wallet size={36} className="mx-auto text-slate-300 mb-2" />
                      <span>{locale === "ar" ? "لا توجد ودائع أو أرصدة مسبقة مطابقة." : "Aucun acompte trouvé."}</span>
                    </td>
                  </tr>
                ) : (
                  filteredAdvances.map((adv) => {
                    const isAvailable = adv.statut === "Disponible";
                    const isPartial = adv.statut === "Partiellement utilisée";
                    const isCanceled = adv.statut === "Annulée";

                    return (
                      <tr key={adv.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          {(() => {
                            const { nom: clientNom, clientRef, displayRef } = getClientInfo(adv);
                            return (
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs uppercase shadow-xs">
                                  {clientNom.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-black text-slate-900">
                                    {clientNom}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5">
                                    <span className="text-slate-400">REF:</span>
                                    <span className="text-slate-800 font-extrabold">{displayRef}</span>
                                    {clientRef && clientRef !== displayRef && (
                                      <span className="text-blue-600 text-[9px] bg-blue-50 px-1 py-0.2 rounded border border-blue-200/50">
                                        {clientRef}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-600">
                          {format(new Date(adv.date_avance), "dd/MM/yyyy")}
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-slate-500 text-xs">
                          {formatCurrencyAmount(Number(adv.montant_initial))}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="font-black text-blue-600 text-sm">
                            {formatCurrencyAmount(Number(adv.montant_restant))}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-bold text-slate-700">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                            {adv.emplacement || "BOUTIQUE"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isAvailable
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                : isPartial
                                ? "bg-amber-100 text-amber-700 border border-amber-300"
                                : isCanceled
                                ? "bg-rose-100 text-rose-700 border border-rose-300"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {adv.statut}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleShareAdvanceWhatsApp(adv)}
                              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
                              title="Envoyer reçu via WhatsApp"
                            >
                              <MessageSquare size={14} />
                            </button>

                            <button
                              onClick={() => {
                                setPrintMode('single');
                                setPrintCustomData(null);
                                setPrintAdvanceId(adv.id);
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title={locale === "ar" ? "طباعة الوصل" : "Imprimer Reçu"}
                            >
                              <Printer size={14} />
                            </button>

                            <button
                              onClick={() => setHistoryAdvanceId(adv.id)}
                              className="p-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                              title={locale === "ar" ? "سجل الحركات" : "Historique & Audit"}
                            >
                              <Clock size={14} />
                            </button>

                            {(isAvailable || isPartial) && Number(adv.montant_restant) > 0 && (
                              <>
                                <button
                                  onClick={() => setImputeAdvance(adv)}
                                  className="p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
                                  title={locale === "ar" ? "استخدام في فاتورة" : "Imputer sur Facture"}
                                >
                                  <Receipt size={14} />
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedAdvance(adv);
                                    setWithdrawAmount("");
                                    setWithdrawNotes("");
                                    setWithdrawPaymentMethod("Espece");
                                    setIsWithdrawModalOpen(true);
                                  }}
                                  className="p-2 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
                                  title={locale === "ar" ? "سحب / استرداد أموال" : "Effectuer un retrait"}
                                >
                                  <ArrowDownToLine size={14} />
                                </button>
                              </>
                            )}

                            {isAvailable && (
                              <button
                                onClick={() => {
                                  setSelectedAdvance(adv);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                title="Annuler"
                              >
                                <Ban size={14} />
                              </button>
                            )}
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
      ) : (
        /* View 2: Client Summary Ledger */
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">{locale === "ar" ? "العميل" : "Client"}</th>
                  <th className="py-3.5 px-4">{locale === "ar" ? "الهاتف" : "Téléphone"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "إجمالي الودائع" : "Total Déposé"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "رصيد الأمانات" : "Solde d'avances"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "ديون الفواتير" : "Dette Factures"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "الوضعية الصافية" : "Position Nette"}</th>
                  <th className="py-3.5 px-4 text-right">{locale === "ar" ? "كشف الحساب" : "Relevé"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <Loader2 size={32} className="animate-spin mx-auto text-blue-600 mb-2" />
                      <span>{locale === "ar" ? "جاري الحساب..." : "Chargement des soldes..."}</span>
                    </td>
                  </tr>
                ) : filteredClientSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-slate-400">
                      <User size={36} className="mx-auto text-slate-300 mb-2" />
                      <span>{locale === "ar" ? "لا يوجد عملاء لديهم أرصدة مسبقة." : "Aucun compte client trouvé."}</span>
                    </td>
                  </tr>
                ) : (
                  filteredClientSummaries.map((c) => {
                    const isPositive = c.position_nette >= 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-black text-slate-900">{c.nom}</div>
                          <div className="font-mono text-[10px] text-slate-400">REF: {c.ref_client || "—"}</div>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-bold text-slate-600">{c.tel || "—"}</td>

                        <td className="py-3.5 px-4 text-right font-bold text-slate-500 text-xs">
                          {formatCurrencyAmount(c.total_depose)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-blue-600 text-sm">
                          {formatCurrencyAmount(c.solde_avances)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-bold text-rose-600 text-xs">
                          {formatCurrencyAmount(c.credit_facture)}
                        </td>

                        <td className={`py-3.5 px-4 text-right font-black text-sm ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isPositive ? "+" : ""}
                          {formatCurrencyAmount(c.position_nette)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedClientIdForStatement(c.id);
                              setSelectedClientNomForStatement(c.nom);
                            }}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-black transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <FileSpreadsheet size={13} />
                            <span>{locale === "ar" ? "الكشف" : "Relevé"}</span>
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
      )}

      {/* --- INTEGRATED MODALS --- */}
      {historyAdvanceId && (
        <HistoryModal advanceId={historyAdvanceId} onClose={() => setHistoryAdvanceId(null)} />
      )}

      {printAdvanceId && (
        <AdvanceReceiptModal 
          advanceId={printAdvanceId} 
          initialMode={printMode}
          customOperationData={printCustomData}
          onClose={() => {
            setPrintAdvanceId(null);
            setPrintCustomData(null);
            setPrintMode('single');
          }} 
        />
      )}

      {imputeAdvance && (
        <ImputeAdvanceModal
          advance={imputeAdvance}
          onClose={() => setImputeAdvance(null)}
          onSuccess={handleImputeSuccess}
        />
      )}

      {isGlobalPrintOpen && (
        <DepositListModal onClose={() => setIsGlobalPrintOpen(false)} />
      )}

      {selectedClientIdForStatement && (
        <ClientStatementModal
          clientId={selectedClientIdForStatement}
          clientNom={selectedClientNomForStatement}
          onClose={() => {
            setSelectedClientIdForStatement(null);
            setSelectedClientNomForStatement("");
          }}
        />
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Wallet size={16} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {locale === "ar" ? "تسجيل إيداع / أمانة جديدة للعميل" : "Nouveau Dépôt / Acompte Client"}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    {locale === "ar" ? "العميل" : "Client"} *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCreateClientModalOpen(true)}
                    className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> {locale === "ar" ? "إضافة عميل جديد" : "Créer Client"}
                  </button>
                </div>
                <select
                  required
                  value={createData.client_id}
                  onChange={(e) => setCreateData({ ...createData, client_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>
                    Sélectionner un client...
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} {c.tel ? `(${c.tel})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "المبلغ (FCFA)" : "Montant Déposé"} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Ex: 100000"
                    value={createData.montant_initial}
                    onChange={(e) => setCreateData({ ...createData, montant_initial: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base font-black text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "طريقة الدفع" : "Mode de Paiement"}
                  </label>
                  <select
                    value={createData.moyen_paiement}
                    onChange={(e) => setCreateData({ ...createData, moyen_paiement: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    <option value="Espece">Espèce</option>
                    <option value="Cheque">Chèque</option>
                    <option value="Virement">Virement Bancaire</option>
                    <option value="Mobile Money">Mobile Money (Wave/Orange/Moov)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "تاريخ العملية" : "Date de Dépôt"}
                  </label>
                  <input
                    type="date"
                    value={createData.date_avance}
                    onChange={(e) => setCreateData({ ...createData, date_avance: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === "ar" ? "رقم المرجع / الوصل" : "Référence / N° Reçu"}
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: REC-2026-001"
                    value={createData.reference_paiement}
                    onChange={(e) => setCreateData({ ...createData, reference_paiement: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {locale === "ar" ? "إلغاء" : "Annuler"}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>{locale === "ar" ? "تأكيد الإيداع" : "Confirmer le Dépôt"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Client Modal */}
      {isCreateClientModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <User size={16} />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {locale === "ar" ? "إضافة عميل جديد" : "Créer un Nouveau Client"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateClientModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateClientSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "اسم العميل الكامل" : "Nom & Prénom / Société"} *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ex: Elhadj Mamane"
                  value={createClientData.nom}
                  onChange={(e) => setCreateClientData({ ...createClientData, nom: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "رقم الهاتف" : "Téléphone"}
                </label>
                <input
                  type="text"
                  placeholder="Ex: +227 90 00 00 00"
                  value={createClientData.tel}
                  onChange={(e) => setCreateClientData({ ...createClientData, tel: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateClientModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {locale === "ar" ? "إلغاء" : "Annuler"}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  <span>{locale === "ar" ? "حفظ العميل" : "Enregistrer le Client"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {isWithdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-amber-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold">
                  <ArrowDownToLine size={16} />
                </div>
                <h3 className="text-base font-black text-amber-950">
                  {locale === "ar" ? "سحب / استرداد من الأمانة" : "Retrait de Fonds"}
                </h3>
              </div>
              <button
                onClick={() => setIsWithdrawModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-6 space-y-4">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80">
                <span className="text-[11px] font-black text-amber-700 uppercase block">
                  {locale === "ar" ? "الرصيد المتبقي المتاح للسحب" : "Solde Actuel Disponible"}
                </span>
                <span className="text-xl font-black text-amber-950 mt-0.5 block">
                  {formatCurrencyAmount(Number(selectedAdvance?.montant_restant))}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "المبلغ المراد سحبه (FCFA)" : "Montant à Retirer"} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  max={selectedAdvance?.montant_restant}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-base font-black text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "طريقة استرداد / دفع المبلغ" : "Mode de Remboursement"}
                </label>
                <select
                  value={withdrawPaymentMethod}
                  onChange={(e) => setWithdrawPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                >
                  <option value="Espece">{locale === "ar" ? "نقداً (Espèce)" : "Espèce"}</option>
                  <option value="Virement">{locale === "ar" ? "تحويل بنكي" : "Virement Bancaire"}</option>
                  <option value="Cheque">{locale === "ar" ? "شيك" : "Chèque"}</option>
                  <option value="Mobile Money">Mobile Money (Wave/Orange/Moov)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === "ar" ? "سبب أو ملاحظات السحب (اختياري)" : "Motif / Notes (Optionnel)"}
                </label>
                <input
                  type="text"
                  placeholder={locale === "ar" ? "مثال: استرداد بناءً على طلب العميل" : "Ex: Remboursement demandé par le client"}
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {locale === "ar" ? "إلغاء" : "Annuler"}
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
                  <span>{locale === "ar" ? "تأكيد السحب" : "Confirmer le Retrait"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {locale === "ar" ? "إلغاء هذا الإيداع؟" : "Annuler cet Acompte ?"}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {locale === "ar"
                  ? "سيتم تمييز الإيداع كملغي وإيقاف إمكانية استخدامه في الفواتير."
                  : "Cette action annulera l'avance et la rendra inutilisable pour les factures."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {locale === "ar" ? "تراجع" : "Fermer"}
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={isSubmitting}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                {locale === "ar" ? "تأكيد الإلغاء" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
