"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Search, Plus, ArrowUpDown, Banknote, Calendar, BadgeCheck, Loader2, Eye, Printer as PrintIcon, Edit3, Trash2, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import InvoiceModal from "./InvoiceModal";
import EditInvoiceModal from "./EditInvoiceModal";
import PaymentModal from "./PaymentModal";
import { format } from "date-fns";

type Invoice = {
  id: string | number;
  bl_number: string;
  date_facture: string;
  client_nom: string;
  total_ttc: number;
  montant_paye: number;
  moyen_reglement: string | null;
  montant_restant: number;
  client_id?: number | string | null;
};

const supabase = createClient();

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Invoice>("date_facture");
  const [sortAsc, setSortAsc] = useState(false); // default desc for dates
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | number | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | number | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<any | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadInvoices();
  }, [refreshKey]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("factures")
        .select(`
          id, bl_number, date_facture, total_ttc, montant_paye, mode_paiement, client_id,
          clients ( nom )
        `)
        .eq("is_deleted", false)
        .order("date_facture", { ascending: false })
        .limit(200);

      if (error) throw error;

      if (data) {
        const mapped: Invoice[] = data.map((r: any) => ({
          id: r.id,
          bl_number: r.bl_number || `F-${r.id}`,
          date_facture: r.date_facture,
          client_nom: r.clients?.nom || "Client Divers",
          total_ttc: Number(r.total_ttc) || 0,
          montant_paye: Number(r.montant_paye) || 0,
          moyen_reglement: r.mode_paiement || null,
          montant_restant: Math.max(0, (Number(r.total_ttc) || 0) - (Number(r.montant_paye) || 0)),
          client_id: r.client_id,
        }));
        setInvoices(mapped);
      }
    } catch (err) {
      console.error("Failed to load invoices", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string | number) => {
    if (!confirm("🚨 ATTENTION: Supprimer cette facture ajustera AUTOMATIQUEMENT le stock. Voulez-vous continuer ?")) return;
    
    try {
      setLoading(true);
      // Call the safe delete RPC
      const { error } = await supabase.rpc('delete_invoice_safe', { p_invoice_id: invoiceId });
      
      if (error) {
        // Fallback if RPC isn't defined yet - simple soft delete
        console.warn("RPC delete_invoice_safe not found, falling back to simple soft delete.");
        const { error: softErr } = await supabase
          .from("factures")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("id", invoiceId);
        if (softErr) throw softErr;
      }
      
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("Error deleting invoice:", err);
      alert("Erreur lors de la suppression.");
    } finally {
      setLoading(false);
    }
  };

  const { filteredInvoices, totalRevenue, pendingRevenue } = useMemo(() => {
    let filtered = invoices;
    if (query) {
      const q = query.toLowerCase();
      filtered = invoices.filter(
        (i) =>
          i.bl_number.toLowerCase().includes(q) ||
          i.client_nom.toLowerCase().includes(q) ||
          (i.moyen_reglement && i.moyen_reglement.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle Date sorting safely
      if (sortField === "date_facture") {
        const da = new Date(aVal as string).getTime();
        const db = new Date(bVal as string).getTime();
        return sortAsc ? da - db : db - da;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

    const total = invoices.reduce((acc, curr) => acc + curr.total_ttc, 0);
    const pending = invoices.reduce((acc, curr) => acc + curr.montant_restant, 0);

    return { filteredInvoices: filtered, totalRevenue: total, pendingRevenue: pending };
  }, [invoices, query, sortField, sortAsc]);

  const toggleSort = (field: keyof Invoice) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // when changing field, default to desc
    }
  };

  return (
    <div className="space-y-10 max-w-7xl mx-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
            <div className="p-3 bg-white/50 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
              <FileText className="text-indigo-600" size={32} />
            </div>
            Gestion des Factures
          </h1>
          <p className="mt-2 text-slate-500 font-medium ml-1">
            Historique complet des ventes, tickets de caisse et factures.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/pos")}
          className="flex items-center gap-3 text-white px-8 py-4 rounded-[22px] font-black shadow-xl shadow-indigo-500/30 transition-all hover:scale-105 active:scale-95 group bg-indigo-600 whitespace-nowrap"
        >
          <Plus size={22} className="transition-transform group-hover:rotate-90" />
          Nouvelle Facture
        </button>
      </div>

      {/* KPIs Cards */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {[
          { label: "Total Factures", value: invoices.length, bg: "linear-gradient(135deg, #4f46e5, #7c3aed)", icon: FileText, shadowColor: "rgba(79,70,229,0.3)" },
          { label: "Chiffre d'Affaires Total", value: `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(totalRevenue)} F CFA`, bg: "linear-gradient(135deg, #f59e0b, #ef4444)", icon: Banknote, shadowColor: "rgba(245,158,11,0.3)" },
          { label: "Montants en Attente", value: `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(pendingRevenue)} F CFA`, bg: "linear-gradient(135deg, #10b981, #34d399)", icon: Calendar, shadowColor: "rgba(16,185,129,0.3)" },
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
             <div className="text-2xl font-black mt-2 tracking-tight line-clamp-1">{card.value}</div>
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
            placeholder="Rechercher ID, client, statut, etc..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="block w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-slate-800 placeholder:text-slate-400 border border-slate-200/60 bg-slate-50/50 py-4 pl-14 pr-4 rounded-[22px]"
          />
        </div>
        
        <div className="hidden sm:flex items-center gap-2 px-6 flex-shrink-0 text-sm font-black text-indigo-600 bg-indigo-500/5 rounded-2xl py-4 border border-indigo-500/10 whitespace-nowrap">
          <span>{filteredInvoices.length} facture(s) affichée(s)</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-[48px] border border-white/80 bg-white/60 backdrop-blur-3xl shadow-2xl shadow-indigo-100/40 flex flex-col overflow-hidden transition-all duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th 
                  className="cursor-pointer px-6 py-5 hover:bg-slate-200/50 transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("bl_number")}
                >
                  <div className="flex items-center gap-2">
                    N° Facture <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th 
                  className="cursor-pointer px-6 py-5 hover:bg-slate-200/50 transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("date_facture")}
                >
                  <div className="flex items-center gap-2">
                    Date <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th 
                  className="cursor-pointer px-6 py-5 hover:bg-slate-200/50 transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("client_nom")}
                >
                  <div className="flex items-center gap-2">
                    Client <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th className="px-6 py-5 text-center whitespace-nowrap">Paiement</th>
                <th 
                  className="cursor-pointer px-6 py-5 text-right hover:bg-slate-200/50 transition-colors whitespace-nowrap"
                  onClick={() => toggleSort("total_ttc")}
                >
                  <div className="flex items-center justify-end gap-2">
                    Total TTC <ArrowUpDown size={14} className="text-slate-400" />
                  </div>
                </th>
                <th className="px-6 py-5 text-center whitespace-nowrap">Statut</th>
                <th className="px-6 py-5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                // Loading Skeleton
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 animate-pulse">
                    <td className="px-6 py-6"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-6"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-6"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                    <td className="px-6 py-6"><div className="h-6 w-20 bg-slate-200 rounded-full mx-auto"></div></td>
                    <td className="px-6 py-6"><div className="h-4 w-24 bg-slate-200 rounded ml-auto"></div></td>
                    <td className="px-6 py-6"><div className="h-6 w-20 bg-slate-200 rounded-full mx-auto"></div></td>
                    <td className="px-6 py-6"><div className="h-8 w-12 bg-slate-200 rounded-full ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 max-w-sm mx-auto">
                      <div className="h-16 w-16 bg-slate-50 flex items-center justify-center rounded-2xl border border-slate-100 mb-4">
                        <FileText className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-lg font-bold text-slate-700">Aucune facture trouvée</p>
                      <p className="mt-1 text-sm font-medium text-slate-500 mb-6">
                        Commencez par créer votre première facture ou modifiez vos critères de recherche.
                      </p>
                      <button
                        onClick={() => router.push("/dashboard/pos")}
                        className="inline-flex items-center gap-2 font-bold shadow-sm hover:shadow-md transition-all active:translate-y-0"
                        style={{ background: "#2563EB", color: "white", borderRadius: "10px", padding: "10px 20px" }}
                      >
                        <Plus size={16} strokeWidth={3} />
                        Créer une facture
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isFullyPaid = inv.montant_restant <= 0;
                  const isPartiallyPaid = inv.montant_restant > 0 && inv.montant_paye > 0;
                  const isUnpaid = inv.montant_paye <= 0;

                  return (
                    <tr 
                      key={inv.id} 
                      className="group transition-colors duration-200 border-b border-slate-100 last:border-0 hover:bg-[#F3F4F6]"
                    >
                      <td className="px-6 py-5 whitespace-nowrap font-extrabold text-slate-900 tracking-tight">
                        {inv.bl_number}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-slate-500 font-medium">
                        {formatDate(inv.date_facture)}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap font-bold text-slate-700">
                        {inv.client_nom}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center text-slate-600 font-medium text-sm">
                        {inv.moyen_reglement ? (
                          <span className="inline-block bg-white border border-slate-200 shadow-sm rounded-lg px-2.5 py-1">
                            {inv.moyen_reglement}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right font-black text-slate-900">
                        {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(inv.total_ttc)} F CFA
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-center font-bold">
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs shadow-sm" style={{ background: "#10B981" }}>
                            <BadgeCheck size={14} /> Payée
                          </span>
                        ) : isPartiallyPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs shadow-sm" style={{ background: "#F59E0B" }}>
                            Partielle
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-xs shadow-sm" style={{ background: "#EF4444" }}>
                            Non Payée
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedInvoiceId(inv.id)}
                            className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all"
                            title="Visualiser"
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                             onClick={() => setSelectedInvoiceId(inv.id)}
                             className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                             title="Imprimer"
                          >
                            <PrintIcon size={18} />
                          </button>
                          <button 
                             onClick={() => router.push(`/dashboard/pos?invoiceId=${inv.id}`)}
                             className="p-2 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"
                             title="Modifier dans POS"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button 
                             onClick={() => setPaymentInvoice(inv)}
                             className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all border border-emerald-100"
                             title="Règlement"
                          >
                            <CreditCard size={18} />
                          </button>
                          <button 
                             onClick={() => handleDeleteInvoice(inv.id)}
                             className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all"
                             title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {selectedInvoiceId && (
        <InvoiceModal 
          invoiceId={selectedInvoiceId} 
          onClose={() => setSelectedInvoiceId(null)} 
        />
      )}

      {/* Edit Invoice Modal */}
      {editInvoiceId && (
        <EditInvoiceModal
          invoiceId={editInvoiceId}
          onClose={() => setEditInvoiceId(null)}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
        />
      )}

      {/* Payment Modal */}
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
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
