"use client";

import { useEffect, useState } from "react";
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  FileText, 
  Package, 
  Users, 
  AlertCircle,
  Calendar,
  Building,
  RefreshCw,
  Clock,
  ArrowLeft
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import Link from "next/link";

interface DeletedInvoice {
  id: number;
  bl_number: string;
  date_facture: string;
  total_ttc: number;
  statut: string;
  deleted_at: string;
  vendeur: string;
  emplacement: string;
  clients?: { nom: string } | null;
}

interface DeletedArticle {
  id: number;
  reference: string;
  designation: string;
  p_vente_ttc: number;
  updated_at: string;
}

interface DeletedClient {
  id: number;
  nom: string;
  tel: string;
  adresse: string;
  updated_at: string;
}

export default function CorbeillePage() {
  const { t, locale } = useLanguage();
  const [activeTab, setActiveTab] = useState<"invoices" | "articles" | "clients">("invoices");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const [invoices, setInvoices] = useState<DeletedInvoice[]>([]);
  const [articles, setArticles] = useState<DeletedArticle[]>([]);
  const [clients, setClients] = useState<DeletedClient[]>([]);

  const fetchCorbeille = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/corbeille?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Erreur lors du chargement de la corbeille");
      const data = await res.json();
      setInvoices(data.invoices || []);
      setArticles(data.articles || []);
      setClients(data.clients || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorbeille();
  }, []);

  const handleRestore = async (type: "facture" | "article" | "client", id: number) => {
    const confirmMsg = locale === "ar"
      ? "هل أنت متأكد من استعادة هذا العنصر إلى النظام؟"
      : "Voulez-vous vraiment restaurer cet élément ?";
    if (!confirm(confirmMsg)) return;

    setActionLoading(id);
    try {
      const res = await fetch("/api/corbeille", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de restauration");

      alert(locale === "ar" ? "تمت الاستعادة بنجاح ✅" : "Élément restauré avec succès ✅");
      fetchCorbeille();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Filters
  const filteredInvoices = invoices.filter(i => 
    i.bl_number?.toLowerCase().includes(query.toLowerCase()) ||
    i.clients?.nom?.toLowerCase().includes(query.toLowerCase()) ||
    i.vendeur?.toLowerCase().includes(query.toLowerCase())
  );

  const filteredArticles = articles.filter(a =>
    a.reference?.toLowerCase().includes(query.toLowerCase()) ||
    a.designation?.toLowerCase().includes(query.toLowerCase())
  );

  const filteredClients = clients.filter(c =>
    c.nom?.toLowerCase().includes(query.toLowerCase()) ||
    c.tel?.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30">
            <Trash2 size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {locale === "ar" ? "سلة المحذوفات (Corbeille)" : "Corbeille & Historique Supprimé"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700">
                {invoices.length + articles.length + clients.length} {locale === "ar" ? "عنصر" : "éléments"}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-500 mt-1">
              {locale === "ar" 
                ? "عرض واسترجاع الفواتير والأصناف المحذوفة أو تتبع العمليات السابقة" 
                : "Consultez et restaurez les factures, articles ou clients supprimés en toute sécurité."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/invoices"
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>{locale === "ar" ? "العودة للفواتير" : "Retour aux Factures"}</span>
          </Link>
          <button
            onClick={fetchCorbeille}
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── TABS & SEARCH ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "invoices"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText size={16} />
            <span>{locale === "ar" ? "الفواتير الملغاة / المحذوفة" : "Factures Supprimées"}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === "invoices" ? "bg-white/20" : "bg-slate-200"}`}>
              {invoices.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("articles")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "articles"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Package size={16} />
            <span>{locale === "ar" ? "المنتجات المحذوفة" : "Articles Supprimés"}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === "articles" ? "bg-white/20" : "bg-slate-200"}`}>
              {articles.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("clients")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "clients"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users size={16} />
            <span>{locale === "ar" ? "العملاء المحذوفون" : "Clients Supprimés"}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${activeTab === "clients" ? "bg-white/20" : "bg-slate-200"}`}>
              {clients.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={locale === "ar" ? "بحث في المحذوفات..." : "Rechercher dans la corbeille..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
        </div>
      </div>

      {/* ── CONTENT TABLE ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 font-bold flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-rose-500" />
            <span>{locale === "ar" ? "جاري تحميل عناصر سلة المحذوفات..." : "Chargement de la corbeille..."}</span>
          </div>
        ) : activeTab === "invoices" ? (
          filteredInvoices.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-bold">
              <Trash2 size={40} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
              <p>{locale === "ar" ? "سلة فواتير المبيعات فارغة، لا توجد فواتير محذوفة." : "Aucune facture dans la corbeille."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">N° Facture</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Montant TTC</th>
                    <th className="py-3 px-4">Point de Vente</th>
                    <th className="py-3 px-4">Vendeur</th>
                    <th className="py-3 px-4">Date Suppression</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                          {inv.bl_number || `FA-${inv.id}`}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold">{inv.clients?.nom || "Client Divers"}</td>
                      <td className="py-3 px-4 font-black">{formatCurrencyAmount(inv.total_ttc)}</td>
                      <td className="py-3 px-4 text-slate-600">{inv.emplacement || "Boutique"}</td>
                      <td className="py-3 px-4 text-slate-600">{inv.vendeur || "Admin"}</td>
                      <td className="py-3 px-4 text-slate-400 font-normal">
                        {inv.deleted_at ? new Date(inv.deleted_at).toLocaleString() : "Récemment"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRestore("facture", inv.id)}
                          disabled={actionLoading === inv.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 ml-auto transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          <RotateCcw size={14} className={actionLoading === inv.id ? "animate-spin" : ""} />
                          <span>{locale === "ar" ? "استعادة" : "Restaurer"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === "articles" ? (
          filteredArticles.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-bold">
              <Package size={40} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
              <p>{locale === "ar" ? "لا توجد منتجات محذوفة في السلة." : "Aucun article dans la corbeille."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Référence</th>
                    <th className="py-3 px-4">Désignation</th>
                    <th className="py-3 px-4">Prix Vente TTC</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                  {filteredArticles.map((art) => (
                    <tr key={art.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{art.reference}</td>
                      <td className="py-3 px-4 font-black">{art.designation}</td>
                      <td className="py-3 px-4 font-black text-emerald-600">{formatCurrencyAmount(art.p_vente_ttc)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRestore("article", art.id)}
                          disabled={actionLoading === art.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 ml-auto transition-all cursor-pointer shadow-xs"
                        >
                          <RotateCcw size={14} />
                          <span>{locale === "ar" ? "استعادة" : "Restaurer"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredClients.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-bold">
              <Users size={40} className="mx-auto mb-2 text-slate-300 stroke-[1.5]" />
              <p>{locale === "ar" ? "لا يوجد عملاء محذوفون في السلة." : "Aucun client dans la corbeille."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Nom Client</th>
                    <th className="py-3 px-4">Téléphone</th>
                    <th className="py-3 px-4">Adresse</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                  {filteredClients.map((c) => (
                    <tr key={c.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4 font-black">{c.nom}</td>
                      <td className="py-3 px-4 text-slate-600">{c.tel || "—"}</td>
                      <td className="py-3 px-4 text-slate-600">{c.adresse || "—"}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRestore("client", c.id)}
                          disabled={actionLoading === c.id}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 ml-auto transition-all cursor-pointer shadow-xs"
                        >
                          <RotateCcw size={14} />
                          <span>{locale === "ar" ? "استعادة" : "Restaurer"}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
