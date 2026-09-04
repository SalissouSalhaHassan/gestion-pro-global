"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Search, Plus, UserCircle2, ArrowUpDown, Banknote, ShieldAlert, Loader2, X, Save, FileText, Printer, MessageCircle, Receipt } from "lucide-react";
import ClientListModal from "./ClientListModal";
import WhatsAppDebtModal from "@/components/WhatsAppDebtModal";
import ClientStatementModal from "@/components/clients/ClientStatementModal";
import { createClient } from "@/lib/supabase/client";
import { getClientSessionFromCookie, isAdminOrManagerSession, DEFAULT_CLIENT_ID } from "@/lib/client_helpers";

type Client = {
  id: string | number;
  ref_client: string | null;
  nom: string;
  tel: string | null;
  credit_facture: number;
  credit_bl: number;
  credit: number;
};

const supabase = createClient();

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Client>("nom");
  const [sortAsc, setSortAsc] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ nom: "", tel: "", ref_client: "", type_client: "Détail" });
  const [toast, setToast] = useState<{message: string, type: "success" | "error"} | null>(null);

  // ── Session & Role State ──
  const [userSession, setUserSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(true); // Default to true to avoid flash

  useEffect(() => {
    const session = getClientSessionFromCookie();
    setUserSession(session);
    setIsAdmin(isAdminOrManagerSession(session));
  }, []);
  
  // Debt Details State
  const [selectedClientForDebt, setSelectedClientForDebt] = useState<Client | null>(null);
  const [whatsAppDebtClient, setWhatsAppDebtClient] = useState<Client | null>(null);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [statementClient, setStatementClient] = useState<Client | null>(null);

  const sendWhatsAppReminder = (client: Client) => {
    setWhatsAppDebtClient(client);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nom) return;
    setSaving(true);
    try {
      // Auto-generate reference if empty
      let finalRef = formData.ref_client;
      if (!finalRef) {
        const year = new Date().getFullYear();
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        finalRef = `CL-${year}-${randomPart}`;
      }

      const { data, error } = await supabase
        .from("clients")
        .insert({
          nom: formData.nom,
          tel: formData.tel || null,
          ref_client: finalRef,
          type_client: formData.type_client || "Détail",
          credit_facture: 0,
          credit_bl: 0,
          montant_plafond: 0,
          prix_client: formData.type_client === "Gros" ? 2 : formData.type_client === "Revendeur" ? 3 : 1,
          pre_client: false,
          is_deleted: false,
          organization_id: userSession?.organization_id || "00000000-0000-0000-0000-000000000001",
        })
        .select()
        .single();
        
      if (error) throw error;
      
      console.log("✅ Client added:", data.id);

      if (data) {
        setClients(prev => [{
          id: data.id,
          ref_client: data.ref_client,
          nom: data.nom,
          tel: data.tel,
          credit_facture: 0,
          credit_bl: 0,
          credit: 0
        }, ...prev]);
      }
      
      setToast({ message: "Client ajouté avec succès !", type: "success" });
      setIsModalOpen(false);
      setFormData({ nom: "", tel: "", ref_client: "", type_client: "Détail" });
    } catch (err: any) {
      console.error(err);
      setToast({ message: err.message || "Erreur lors de l'ajout.", type: "error" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  useEffect(() => {
    async function loadClients() {
      try {
        let clientQuery = supabase
          .from("clients")
          .select("id, ref_client, nom, tel, credit_facture, credit_bl")
          .eq("is_deleted", false)
          .order("nom");

        if (userSession?.organization_id) {
          clientQuery = clientQuery.eq("organization_id", userSession.organization_id);
        }

        const { data, error } = await clientQuery;

        if (error) {
          console.error("❌ Clients fetch error:", error.message, error.details);
        } else {
          console.log("✅ Clients fetched:", data?.length || 0);
        }

        if (!error && data) {
          const mapped: Client[] = data.map((r: any) => {
            const cf = Number(r.credit_facture) || 0;
            const cb = Number(r.credit_bl) || 0;
            return {
              id: r.id,
              ref_client: r.ref_client || null,
              nom: String(r.nom || `Client ${r.id}`),
              tel: r.tel || "-",
              credit_facture: cf,
              credit_bl: cb,
              credit: cf + cb,
            };
          });
          setClients(mapped);
        }
      } catch (err) {
        console.error("Failed to load clients", err);
      } finally {
        setLoading(false);
      }
    }
    loadClients();
  }, [isAdmin, userSession]);

  const fetchClientInvoices = async (client: Client) => {
    setSelectedClientForDebt(client);
    setLoadingInvoices(true);
    setToast({ message: `Chargement de l'historique de ${client.nom}...`, type: "success" });
    try {
      let invQuery = supabase
        .from("factures")
        .select("id, bl_number, date_facture, total_ttc, montant_paye, montant_restant, statut")
        .eq("client_id", client.id)
        .eq("is_deleted", false);

      if (userSession?.organization_id) {
        invQuery = invQuery.eq("organization_id", userSession.organization_id);
      }

      const { data, error } = await invQuery
        .order("date_facture", { ascending: false })
        .limit(50);

      if (error) throw error;
      setClientInvoices(data || []);
    } catch (err) {
      console.error("Failed to load client invoices", err);
      setToast({ message: "Erreur lors du chargement des factures.", type: "error" });
    } finally {
      setLoadingInvoices(false);
    }
  };

  const { filteredClients, totalCredit, clientsInDebt } = useMemo(() => {
    let filtered = clients;
    if (query) {
      const q = query.toLowerCase();
      filtered = clients.filter(
        (c) =>
          c.nom.toLowerCase().includes(q) ||
          (c.ref_client && c.ref_client.toLowerCase().includes(q)) ||
          (c.tel && c.tel.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    const credit = clients.reduce((acc, curr) => acc + curr.credit, 0);
    const inDebtCount = clients.filter((c) => c.credit > 0).length;

    return { filteredClients: filtered, totalCredit: credit, clientsInDebt: inDebtCount };
  }, [clients, query, sortField, sortAsc]);

  const toggleSort = (field: keyof Client) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-xl shadow-lg font-bold text-white flex items-center gap-3 transition-all ${toast.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'}`}>
          {toast.message}
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
            <div className="p-3 bg-white/50 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
              <Users className="text-indigo-600" size={32} />
            </div>
            Base de Données Clients
          </h1>
          <p className="mt-2 text-slate-500 font-medium ml-1 italic font-outfit">
            Répertoire complet des partenaires et suivi dynamique des encours.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center gap-3 text-slate-600 bg-white border border-slate-200 px-6 py-4 rounded-[22px] font-black shadow-sm transition-all hover:bg-slate-50 active:scale-95"
          >
            <Printer size={20} />
            Imprimer Liste
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 text-white px-8 py-4 rounded-[22px] font-black shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 group bg-indigo-600 whitespace-nowrap"
          >
            <Plus size={22} className="transition-transform group-hover:rotate-90" />
            Nouveau Client
          </button>
        </div>
      </div>

      {isPrintModalOpen && (
        <ClientListModal onClose={() => setIsPrintModalOpen(false)} />
      )}

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {[
          { label: "Total Clients", value: clients.length, bg: "linear-gradient(135deg, #4f46e5, #7c3aed)", icon: Users, shadowColor: "rgba(79,70,229,0.3)" },
          { label: "Clients Endettés", value: clientsInDebt, bg: "linear-gradient(135deg, #f59e0b, #ef4444)", icon: ShieldAlert, shadowColor: "rgba(245,158,11,0.3)" },
          { label: "Crédit Total En Cours", value: `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(totalCredit)} F CFA`, bg: "linear-gradient(135deg, #ef4444, #991b1b)", icon: Banknote, shadowColor: "rgba(239,68,68,0.3)" },
        ].map((card, i) => (
          <div
            key={i}
            className="relative overflow-hidden p-8 rounded-[32px] text-white transition-all hover:scale-[1.03] cursor-pointer group"
            style={{ background: card.bg, boxShadow: `0 20px 40px ${card.shadowColor}` }}
          >
             <div className="absolute -right-4 -bottom-4 w-32 h-32 rounded-full blur-3xl group-hover:bg-white/20 transition-all bg-white/10"></div>
             <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md">
                   <card.icon size={22} />
                </div>
                <span className="text-sm font-black uppercase tracking-widest opacity-90">{card.label}</span>
              </div>
             </div>
             <div className="text-3xl font-black mt-2 tracking-tight line-clamp-1">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar (Search & Counters) */}
      <div className="p-2 rounded-[28px] shadow-xl shadow-slate-200/50 flex flex-col sm:flex-row justify-between items-center gap-4 border border-white/60 bg-white/40 backdrop-blur-xl">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher nom, référence, téléphone..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-slate-800 placeholder:text-slate-400 border border-slate-200/60 bg-slate-50/50 py-4 pl-14 pr-4 rounded-[22px]"
          />
        </div>
        
        <div className="hidden sm:flex items-center gap-2 px-6 flex-shrink-0 text-sm font-black text-indigo-600 bg-indigo-500/5 rounded-2xl py-4 border border-indigo-500/10 whitespace-nowrap">
          <span>{filteredClients.length} client(s) affiché(s)</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-[48px] border border-white/80 bg-white/60 backdrop-blur-3xl shadow-2xl shadow-indigo-100/40 flex flex-col overflow-hidden transition-all duration-300">
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh] custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-600 relative">
            <thead className="bg-slate-50/90 backdrop-blur-md text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-sm">
              <tr>
                <th 
                  className="cursor-pointer px-6 py-5 hover:bg-slate-200/50 transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("nom")}
                >
                  <div className="flex items-center gap-2">
                    Client <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th 
                  className="cursor-pointer px-6 py-5 hover:bg-slate-200/50 transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("ref_client")}
                >
                  <div className="flex items-center gap-2">
                    Référence <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th className="px-6 py-5 font-semibold">Téléphone</th>
                <th 
                  className="cursor-pointer px-6 py-5 text-right hover:bg-slate-200/50 transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("credit")}
                >
                  <div className="flex items-center justify-end gap-2">
                    Crédit <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th className="px-6 py-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
               {loading ? (
                // Loading Skeleton
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 animate-pulse">
                    <td className="px-6 py-6"><div className="flex items-center gap-3"><div className="h-10 w-10 bg-slate-200 rounded-full"></div><div className="h-4 w-32 bg-slate-200 rounded"></div></div></td>
                    <td className="px-6 py-6"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-6"><div className="h-6 w-24 bg-slate-200 rounded-xl ml-auto"></div></td>
                    <td className="px-6 py-6"><div className="h-8 w-12 bg-slate-200 rounded-full ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 max-w-sm mx-auto">
                      <div className="h-16 w-16 bg-slate-50 flex items-center justify-center rounded-2xl border border-slate-100 mb-4">
                        <Users className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-lg font-bold text-slate-700">Aucun client trouvé</p>
                      <p className="mt-1 text-sm font-medium text-slate-500 mb-6">
                        Commencez par ajouter votre premier client ou modifiez votre recherche.
                      </p>
                      <button
                        onClick={() => setIsModalOpen(true)}
                        className="inline-flex items-center gap-2 font-bold shadow-sm hover:shadow-md transition-all active:translate-y-0"
                        style={{ background: "#2563EB", color: "white", borderRadius: "10px", padding: "10px 20px" }}
                      >
                        <Plus size={16} strokeWidth={3} />
                        Ajouter un client
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const hasDebt = client.credit > 0;
                  return (
                    <tr 
                      key={client.id} 
                      className="group transition-colors duration-200 border-b border-slate-100 last:border-0 hover:bg-[#F3F4F6]"
                    >
                      <td className="px-6 py-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 flex-shrink-0 rounded-full flex items-center justify-center border-2 font-bold shadow-sm ${
                            hasDebt ? "bg-white border-red-500 text-red-600" : "bg-white border-blue-500 text-blue-600"
                          }`}>
                            {client.nom.charAt(0).toUpperCase()}
                          </div>
                          <div className="font-bold text-slate-900">{client.nom}</div>
                        </div>
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-slate-500 font-medium">
                        {client.ref_client || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-slate-600 font-medium">
                        {client.tel}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        {hasDebt ? (
                          <span 
                            onClick={() => fetchClientInvoices(client)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs font-bold shadow-sm cursor-pointer hover:scale-105 transition-transform active:scale-95" 
                            style={{ background: "#EF4444" }}
                            title="Cliquez لفتح تفاصيل الديون"
                          >
                            <ShieldAlert size={14} />
                            {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(client.credit)} F CFA
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-emerald-700 bg-emerald-50 text-xs font-bold border border-emerald-100">
                            0,00 F CFA
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          {hasDebt && (
                            <button
                              onClick={() => sendWhatsAppReminder(client)}
                              className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm"
                              title="Rappel WhatsApp"
                            >
                              <MessageCircle size={18} />
                            </button>
                          )}
                          <button
                            onClick={() => setStatementClient(client)}
                            className="p-2 rounded-xl transition-all shadow-sm group border bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white"
                            title="Relevé de Compte 4K & Balance Âgée"
                          >
                            <Receipt size={18} className="group-hover:scale-110 transition-transform" />
                          </button>
                          <button
                            onClick={() => fetchClientInvoices(client)}
                            className={`p-2 rounded-xl transition-all shadow-sm group border ${
                              hasDebt 
                                ? "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-600 hover:text-white" 
                                : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-200 hover:text-slate-600"
                            }`}
                            title="Historique des Factures"
                          >
                            <FileText size={18} className="group-hover:scale-110 transition-transform" />
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

      {/* ── Client Debt Modal ── */}
      {selectedClientForDebt && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedClientForDebt(null)}></div>
          <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-8 pb-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">Historique des Factures</h2>
                <p className="text-slate-500 font-bold mt-1">
                  Client: <span className="text-indigo-600 underline underline-offset-4">{selectedClientForDebt.nom}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedClientForDebt(null)}
                className="p-3 bg-slate-100/80 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="mb-8 p-6 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                <div>
                  <p className="text-indigo-600 text-xs font-black uppercase tracking-widest mb-1">Solde Actuel (Crédit Total)</p>
                  <p className={`text-3xl font-black tracking-tight ${selectedClientForDebt.credit > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(selectedClientForDebt.credit)} F CFA
                  </p>
                </div>
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${selectedClientForDebt.credit > 0 ? "bg-rose-500 shadow-rose-200" : "bg-emerald-500 shadow-emerald-200"}`}>
                  <FileText size={28} />
                </div>
              </div>

              <button
                onClick={() => {
                  const cl = selectedClientForDebt;
                  setSelectedClientForDebt(null);
                  setStatementClient(cl);
                }}
                className="mb-8 w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
              >
                <Receipt size={18} />
                <span>Ouvrir le Relevé de Compte 4K & Balance Âgée</span>
              </button>

              {loadingInvoices ? (
                <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40">
                  <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
                  <p className="font-black text-slate-600 uppercase tracking-tighter">Récupération des factures...</p>
                </div>
              ) : clientInvoices.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
                  <p className="font-black text-slate-600 italic">Aucune facture trouvée pour ce client.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Dernières Factures ({clientInvoices.length})</p>
                    <span className="text-[10px] font-black py-1 px-3 bg-slate-100 rounded-full text-slate-500 uppercase">Limit 50</span>
                  </div>
                  <div className="space-y-3">
                    {clientInvoices.map((inv) => (
                      <div key={inv.id} className="p-5 rounded-3xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all group">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors uppercase">
                            #{inv.bl_number}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            inv.statut === 'Payée' ? 'bg-emerald-100 text-emerald-600' : 
                            inv.statut === 'Non Payée' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {inv.statut}
                          </span>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="flex flex-col">
                             <span className="text-[10px] text-slate-400 font-black uppercase">Date</span>
                             <span className="text-sm font-bold text-slate-700">{new Date(inv.date_facture).toLocaleDateString()}</span>
                           </div>
                           <div className="flex flex-col">
                             <span className="text-[10px] text-slate-400 font-black uppercase">Total TTC</span>
                             <span className="text-sm font-bold text-slate-700">{new Intl.NumberFormat().format(inv.total_ttc)} F</span>
                           </div>
                           <div className="flex flex-col ml-auto text-right">
                             <span className={`text-[10px] font-black uppercase ${inv.montant_restant > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                               {inv.montant_restant > 0 ? "Reste à Payer" : "Payée"}
                             </span>
                             <span className={`text-sm font-black ${inv.montant_restant > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                               {new Intl.NumberFormat().format(inv.montant_restant)} F
                             </span>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setSelectedClientForDebt(null)}
                className="px-10 py-4 bg-slate-900 text-white rounded-[22px] font-black shadow-xl shadow-slate-200 hover:scale-105 active:scale-95 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="border-b border-slate-100 bg-[#F8FAFC] px-6 py-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-3">
                <span className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <UserCircle2 size={24} strokeWidth={2.5} />
                </span>
                Nouveau Client
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors">
                <X size={20} className="stroke-2" />
              </button>
            </div>
            
            <form onSubmit={handleAddClient} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nom du Client <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.nom}
                  onChange={(e) => setFormData({...formData, nom: e.target.value})}
                  className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  style={{ background: "#F9FAFB", borderRadius: "12px", padding: "14px 16px", border: "1px solid transparent" }}
                  placeholder="Ex: Entreprise ABC"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Téléphone</label>
                  <input
                    type="text"
                    value={formData.tel}
                    onChange={(e) => setFormData({...formData, tel: e.target.value})}
                    className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    style={{ background: "#F9FAFB", borderRadius: "12px", padding: "14px 16px", border: "1px solid transparent" }}
                    placeholder="Ex: 0555..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Référence</label>
                  <input
                    type="text"
                    value={formData.ref_client}
                    onChange={(e) => setFormData({...formData, ref_client: e.target.value})}
                    className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    style={{ background: "#F9FAFB", borderRadius: "12px", padding: "14px 16px", border: "1px solid transparent" }}
                    placeholder="Auto-générée si vide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Catégorie Tarifaire (Tarif appliqué)</label>
                <select
                  value={formData.type_client}
                  onChange={(e) => setFormData({...formData, type_client: e.target.value})}
                  className="block w-full text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold cursor-pointer"
                  style={{ background: "#F9FAFB", borderRadius: "12px", padding: "14px 16px", border: "1px solid #e2e8f0" }}
                >
                  <option value="Détail">Détail (Prix Public Standard)</option>
                  <option value="Gros">Gros (Tarif Grossiste & Commandes en volume)</option>
                  <option value="Revendeur">Revendeur (Tarif Spécial Partenaires)</option>
                </select>
              </div>
              
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:hover:-translate-y-0"
                  style={{ background: "linear-gradient(135deg, #2563EB, #1D4ED8)" }}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} />}
                  {saving ? "Ajout..." : "Ajouter Client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Debt Reminder Modal */}
      {whatsAppDebtClient && (
        <WhatsAppDebtModal
          client={whatsAppDebtClient}
          onClose={() => setWhatsAppDebtClient(null)}
        />
      )}

      {/* Client Statement & Aging Balance Studio Modal */}
      {statementClient && (
        <ClientStatementModal
          isOpen={Boolean(statementClient)}
          clientId={statementClient.id}
          clientNom={statementClient.nom}
          clientTel={statementClient.tel}
          onClose={() => setStatementClient(null)}
        />
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        
        body {
          font-family: 'Outfit', sans-serif;
        }
      `}</style>
    </div>
  );
}
