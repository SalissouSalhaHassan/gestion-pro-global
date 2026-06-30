"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  ArrowLeftRight, 
  ArrowRight, 
  Plus, 
  Search, 
  RefreshCw, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock, 
  Truck, 
  AlertCircle, 
  X, 
  ChevronRight, 
  Loader2, 
  MapPin, 
  Trash2, 
  Printer, 
  Layers
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StockTransferModal from "../../mouvements/StockTransferModal";

const supabase = createClient();

type TransferItem = {
  id: number;
  transfert_id: number;
  article_id: number;
  quantite: number;
  articles?: {
    reference: string;
    designation: string;
    unite?: string;
  } | null;
};

type TransferRecord = {
  id: number;
  reference: string;
  depot_depart_id: number;
  depot_arrivee_id: number;
  statut: 'Demande' | 'Valide' | 'Prepare' | 'Expedie' | 'Recu' | 'Confirme';
  date_transfert: string;
  created_by: number;
  created_at: string;
  depot_depart?: { nom: string } | null;
  depot_arrivee?: { nom: string } | null;
  users?: { utilisateur: string } | null;
  transferts_etapes?: {
    id: number;
    statut: string;
    utilisateur: string;
    date_etape: string;
    remarque: string;
  }[];
};

export default function TransitPage() {
  const [transfers, setTransfers] = useState<TransferRecord[]>([]);
  const [depots, setDepots] = useState<{ id: number; nom: string }[]>([]);
  const [articles, setArticles] = useState<{ id: number; reference: string; designation: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");

  // New Transfer Form Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formSourceDepot, setFormSourceDepot] = useState("");
  const [formDestDepot, setFormDestDepot] = useState("");
  const [formItems, setFormItems] = useState<{ article_id: number; quantite: number; reference: string; designation: string }[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [selectedQty, setSelectedQty] = useState("1");
  const [formNotes, setFormNotes] = useState("");
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Transfer Detail Modal State
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRecord | null>(null);
  const [selectedTransferItems, setSelectedTransferItems] = useState<TransferItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [transitioningStatus, setTransitioningStatus] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [printRef, setPrintRef] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Fetch transfers
      await fetchTransfers();

      // Fetch depots
      const resDepots = await fetch("/api/stock/depots");
      const depotsData = await resDepots.json();
      if (Array.isArray(depotsData)) {
        setDepots(depotsData);
        
        // Find default source depot from session cookie
        const cookie = document.cookie.split('; ').find(row => row.startsWith('gp_session='));
        if (cookie) {
          try {
            const session = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
            const isAdmin = session?.admin === "Oui" || session?.role === 1 || session?.role === "1";
            const allowed = session?.depots ? session.depots.split(",").map((d: any) => d.trim().toLowerCase()) : [];
            
            if (!isAdmin && allowed.length > 0) {
              const match = depotsData.find(d => allowed.includes(d.nom.toLowerCase()));
              if (match) {
                setFormSourceDepot(String(match.id));
              }
            } else if (!isAdmin && session.emplacement) {
              const match = depotsData.find(d => d.nom.toLowerCase() === session.emplacement.toLowerCase());
              if (match) {
                setFormSourceDepot(String(match.id));
              }
            }
          } catch (e) { console.error(e); }
        }
      }

      // Fetch articles
      const { data: articlesData } = await supabase
        .from("articles")
        .select("id, reference, designation")
        .eq("is_deleted", false)
        .order("designation");
      if (articlesData) setArticles(articlesData);

    } catch (err) {
      console.error("Error loading initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransfers = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/transfers");
      if (res.ok) {
        const data = await res.json();
        setTransfers(data || []);
      }
    } catch (err) {
      console.error("Error fetching transfers:", err);
    } finally {
      setRefreshing(false);
    }
  };

  // Status metrics
  const metrics = useMemo(() => {
    const counts = { pending: 0, transit: 0, completed: 0 };
    transfers.forEach(t => {
      if (t.statut === 'Demande' || t.statut === 'Valide' || t.statut === 'Prepare') counts.pending++;
      else if (t.statut === 'Expedie') counts.transit++;
      else if (t.statut === 'Recu' || t.statut === 'Confirme') counts.completed++;
    });
    return counts;
  }, [transfers]);

  // Filter transfers
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const matchesSearch = 
        t.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.depot_depart?.nom || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.depot_arrivee?.nom || "").toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === "Tous") return matchesSearch;
      if (statusFilter === "Demandes") return matchesSearch && ['Demande', 'Valide', 'Prepare'].includes(t.statut);
      if (statusFilter === "Transit") return matchesSearch && t.statut === 'Expedie';
      if (statusFilter === "Termines") return matchesSearch && ['Recu', 'Confirme'].includes(t.statut);
      return matchesSearch;
    });
  }, [transfers, searchQuery, statusFilter]);

  const handleAddArticleToForm = () => {
    if (!selectedArticleId || Number(selectedQty) <= 0) return;
    const art = articles.find(a => a.id === Number(selectedArticleId));
    if (!art) return;

    // Check if already in list
    const exists = formItems.find(fi => fi.article_id === art.id);
    if (exists) {
      setFormItems(prev => prev.map(fi => fi.article_id === art.id ? { ...fi, quantite: fi.quantite + Number(selectedQty) } : fi));
    } else {
      setFormItems(prev => [...prev, {
        article_id: art.id,
        reference: art.reference,
        designation: art.designation,
        quantite: Number(selectedQty)
      }]);
    }

    setSelectedArticleId("");
    setSelectedQty("1");
  };

  const handleRemoveArticleFromForm = (id: number) => {
    setFormItems(prev => prev.filter(fi => fi.article_id !== id));
  };

  const handleCreateTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSourceDepot || !formDestDepot || formItems.length === 0) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setSubmittingTransfer(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depot_depart_id: formSourceDepot,
          depot_arrivee_id: formDestDepot,
          items: formItems,
          notes: formNotes
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur lors de la création du transfert.");
      }

      setIsCreateModalOpen(false);
      setFormSourceDepot("");
      setFormDestDepot("");
      setFormItems([]);
      setFormNotes("");
      
      // Reload
      await fetchTransfers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleViewDetails = async (transfer: TransferRecord) => {
    setSelectedTransfer(transfer);
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("transfert_items")
        .select("*, articles(reference, designation, unite)")
        .eq("transfert_id", transfer.id);
      if (!error && data) {
        setSelectedTransferItems(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleWorkflowAction = async (action: string) => {
    if (!selectedTransfer) return;
    
    let confirmMsg = "";
    if (action === 'validate') confirmMsg = "Voulez-vous valider cette demande de transfert ?";
    if (action === 'prepare') confirmMsg = "Confirmez-vous que les articles sont prêts pour le transfert ?";
    if (action === 'ship') confirmMsg = "Voulez-vous expédier ce transfert ? Le stock sera immédiatement déduit du dépôt de départ.";
    if (action === 'receive') confirmMsg = "Confirmez-vous la réception des articles ? Le stock sera ajouté au dépôt de destination.";
    if (action === 'confirm') confirmMsg = "Voulez-vous clôturer définitivement ce transfert ?";

    if (confirmMsg && !confirm(confirmMsg)) return;

    setTransitioningStatus(true);
    try {
      const res = await fetch(`/api/transfers/${selectedTransfer.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, remarque: actionNotes })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "L'action a échoué.");
      }

      setActionNotes("");
      setSelectedTransfer(null);
      await fetchTransfers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTransitioningStatus(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Demande': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Valide': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Prepare': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Expedie': return 'bg-purple-100 text-purple-800 border-purple-200 animate-pulse';
      case 'Recu': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Confirme': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Demande': return 'Demande';
      case 'Valide': return 'Validé';
      case 'Prepare': return 'Préparé';
      case 'Expedie': return 'Expédié (En Transit)';
      case 'Recu': return 'Reçu';
      case 'Confirme': return 'Confirmé (Fermé)';
      default: return status;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Truck size={32} className="text-white" />
           </div>
           <div>
             <h1 className="text-3xl font-black text-slate-900 tracking-tight font-outfit">Suivi des Expéditions</h1>
             <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Workflow des transits inter-dépôts</p>
           </div>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
          <button onClick={fetchTransfers} className="p-3 hover:bg-slate-50 text-slate-400 rounded-xl transition-colors">
            <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-[#6366f1] text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-200"
          >
            <Plus size={16} />
            Nouveau Transfert
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Demandes & Préparations</p>
            <p className="text-2xl font-black text-slate-800">{metrics.pending}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Truck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">En Transit (Expédiés)</p>
            <p className="text-2xl font-black text-slate-800">{metrics.transit}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Reçus / Archivés</p>
            <p className="text-2xl font-black text-slate-800">{metrics.completed}</p>
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-white border border-slate-100 shadow-sm rounded-[32px] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par référence..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
          {["Tous", "Demandes", "Transit", "Termines"].map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${statusFilter === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              {tab === "Tous" ? "Tous" : tab === "Demandes" ? "Demandes" : tab === "Transit" ? "En Transit" : "Reçus & Clôturés"}
            </button>
          ))}
        </div>
      </div>

      {/* TRANSFERS LIST */}
      <div className="bg-white border border-slate-100 shadow-xl rounded-[32px] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#6366f1] mb-3" size={40} />
            <p className="text-sm font-bold text-slate-400">Chargement des transferts...</p>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <AlertCircle className="mx-auto text-slate-300" size={48} />
            <p className="text-sm font-bold text-slate-400 italic">Aucun transfert de stock trouvé.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="p-5">Référence</th>
                  <th className="p-5">Dépôt Départ</th>
                  <th className="p-5">Dépôt Arrivée</th>
                  <th className="p-5">Statut</th>
                  <th className="p-5">Date</th>
                  <th className="p-5">Créé par</th>
                  <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm font-bold text-slate-700">
                {filteredTransfers.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 text-indigo-600 font-extrabold">{t.reference}</td>
                    <td className="p-5">
                      <div className="flex items-center gap-2 text-slate-800">
                        <MapPin size={14} className="text-slate-300" />
                        <span>{t.depot_depart?.nom || `Dépôt #${t.depot_depart_id}`}</span>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-2 text-slate-800">
                        <MapPin size={14} className="text-slate-300" />
                        <span>{t.depot_arrivee?.nom || `Dépôt #${t.depot_arrivee_id}`}</span>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${getStatusBadgeClass(t.statut)}`}>
                        {getStatusLabel(t.statut)}
                      </span>
                    </td>
                    <td className="p-5 text-slate-400 font-medium">
                      {new Date(t.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric'
                      })}
                    </td>
                    <td className="p-5 text-slate-500 font-bold">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-slate-300" />
                        <span>{t.users?.utilisateur || 'Système'}</span>
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setPrintRef(t.reference)}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors active:scale-95"
                          title="Imprimer le bon"
                        >
                          <Printer size={16} />
                        </button>
                        <button 
                          onClick={() => handleViewDetails(t)}
                          className="flex items-center gap-1 bg-slate-900 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs transition-all active:scale-95"
                        >
                          Gérer <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE TRANSFER REQUEST MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] w-full max-w-2xl border border-slate-100 shadow-2xl p-8 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-slate-900">Demander un Transfert</h3>
                <p className="text-xs font-bold text-slate-400">Créez une demande de transfert de stock inter-dépôts</p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTransferSubmit} className="space-y-6 flex-1">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dépôt de Départ (Source)</label>
                  <select 
                    value={formSourceDepot}
                    onChange={(e) => setFormSourceDepot(e.target.value)}
                    required
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all appearance-none"
                  >
                    <option value="">Sélectionner le départ...</option>
                    {depots.map(d => (
                      <option key={d.id} value={d.id} disabled={Number(formDestDepot) === d.id}>{d.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dépôt d'Arrivée (Cible)</label>
                  <select 
                    value={formDestDepot}
                    onChange={(e) => setFormDestDepot(e.target.value)}
                    required
                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all appearance-none"
                  >
                    <option value="">Sélectionner l'arrivée...</option>
                    {depots.map(d => (
                      <option key={d.id} value={d.id} disabled={Number(formSourceDepot) === d.id}>{d.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ARTICLE PICKER */}
              <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Ajouter des Articles</p>
                <div className="grid grid-cols-12 gap-3 items-end">
                  <div className="col-span-8 space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Article</label>
                    <select
                      value={selectedArticleId}
                      onChange={(e) => setSelectedArticleId(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all"
                    >
                      <option value="">Sélectionner l'article...</option>
                      {articles.map(a => (
                        <option key={a.id} value={a.id}>[{a.reference}] {a.designation}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3 space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quantité</label>
                    <input 
                      type="number"
                      min="1"
                      value={selectedQty}
                      onChange={(e) => setSelectedQty(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all text-center"
                    />
                  </div>
                  <div className="col-span-1">
                    <button
                      type="button"
                      onClick={handleAddArticleToForm}
                      className="w-full bg-slate-900 text-white p-3 rounded-xl hover:bg-indigo-600 transition-colors active:scale-95 flex items-center justify-center"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* Form Items List */}
                {formItems.length > 0 && (
                  <div className="border border-slate-200 bg-white rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                    <table className="w-full text-xs font-bold text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400 font-outfit">
                          <th className="p-3">Référence</th>
                          <th className="p-3">Désignation</th>
                          <th className="p-3 text-center">Quantité</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-600">
                        {formItems.map(fi => (
                          <tr key={fi.article_id} className="border-b border-slate-50 last:border-0">
                            <td className="p-3 text-indigo-600 font-extrabold">{fi.reference}</td>
                            <td className="p-3 uppercase">{fi.designation}</td>
                            <td className="p-3 text-center text-slate-800 text-sm font-black">{fi.quantite}</td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveArticleFromForm(fi.article_id)}
                                className="text-rose-500 hover:text-rose-700 p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes / Remarques</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Notes sur la provenance ou le but du transfert..."
                  className="w-full bg-[#f8fafc] border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/25 transition-all min-h-[80px]"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-4 rounded-2xl font-black transition-all active:scale-95"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingTransfer || formItems.length === 0}
                  className="flex-1 bg-[#6366f1] text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {submittingTransfer ? <Loader2 className="animate-spin mx-auto" size={20} /> : "Soumettre la Demande"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER DETAIL & WORKFLOW TRANSITIONS MODAL */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] w-full max-w-3xl border border-slate-100 shadow-2xl p-8 max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black text-slate-900">Transfert {selectedTransfer.reference}</h3>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black border ${getStatusBadgeClass(selectedTransfer.statut)}`}>
                    {getStatusLabel(selectedTransfer.statut)}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-400">Suivi et validation du transfert inter-dépôts</p>
              </div>
              <button 
                onClick={() => setSelectedTransfer(null)}
                className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Dépôt Départ</p>
                <p className="text-sm font-black text-slate-800 flex items-center gap-1">
                  <MapPin size={14} className="text-slate-400" />
                  {selectedTransfer.depot_depart?.nom}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Dépôt Arrivée</p>
                <p className="text-sm font-black text-slate-800 flex items-center gap-1">
                  <MapPin size={14} className="text-slate-400" />
                  {selectedTransfer.depot_arrivee?.nom}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Date Initiale</p>
                <p className="text-sm font-black text-slate-800 flex items-center gap-1">
                  <Calendar size={14} className="text-slate-400" />
                  {new Date(selectedTransfer.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            {/* ITEMS LIST */}
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Articles à Transférer</p>
              {loadingItems ? (
                <div className="flex py-6 justify-center">
                  <Loader2 className="animate-spin text-[#6366f1]" size={24} />
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-xs font-bold text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="p-4">Référence</th>
                        <th className="p-4">Désignation</th>
                        <th className="p-4 text-center">Quantité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTransferItems.map(item => (
                        <tr key={item.id} className="border-b border-slate-50 last:border-0 bg-white">
                          <td className="p-4 text-indigo-600 font-extrabold">{item.articles?.reference}</td>
                          <td className="p-4 uppercase">{item.articles?.designation}</td>
                          <td className="p-4 text-center text-sm font-black text-slate-800">
                            {item.quantite} <span className="text-[10px] text-slate-400 font-medium italic ml-0.5">{item.articles?.unite || 'U'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TIMELINE / ETAPES */}
            <div className="mb-6 bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-1.5">
                <Layers size={14} />
                Timeline Logistique
              </p>
              <div className="space-y-4">
                {selectedTransfer.transferts_etapes && selectedTransfer.transferts_etapes.length > 0 ? (
                  selectedTransfer.transferts_etapes.map((etape, index) => (
                    <div key={etape.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 text-[10px] font-bold">
                          {index + 1}
                        </div>
                        {index < selectedTransfer.transferts_etapes!.length - 1 && (
                          <div className="w-px h-10 bg-slate-200 my-1"></div>
                        )}
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-black text-slate-800">{getStatusLabel(etape.statut)}</p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            {new Date(etape.date_etape).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <p className="text-xs text-slate-500 font-medium italic">"{etape.remarque}"</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Par: {etape.utilisateur}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic font-bold">Aucun historique d'étapes.</p>
                )}
              </div>
            </div>

            {/* WORKFLOW OPERATIONS */}
            {selectedTransfer.statut !== 'Confirme' && (
              <div className="border border-indigo-50 bg-indigo-50/20 rounded-2xl p-5 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Actions Logistiques</p>
                
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-indigo-600/70 ml-1">Commentaire / Remarque (Facultatif)</label>
                  <input
                    type="text"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Remarques spécifiques sur l'opération..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedTransfer.statut === 'Demande' && (
                    <button
                      onClick={() => handleWorkflowAction('validate')}
                      disabled={transitioningStatus}
                      className="flex-1 bg-amber-600 text-white py-3.5 px-4 rounded-xl text-xs font-black active:scale-95 transition-all shadow-md shadow-amber-600/10"
                    >
                      Valider la Demande
                    </button>
                  )}

                  {selectedTransfer.statut === 'Valide' && (
                    <button
                      onClick={() => handleWorkflowAction('prepare')}
                      disabled={transitioningStatus}
                      className="flex-1 bg-indigo-600 text-white py-3.5 px-4 rounded-xl text-xs font-black active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                    >
                      Marquer Prêt
                    </button>
                  )}

                  {selectedTransfer.statut === 'Prepare' && (
                    <button
                      onClick={() => handleWorkflowAction('ship')}
                      disabled={transitioningStatus}
                      className="flex-1 bg-purple-600 text-white py-3.5 px-4 rounded-xl text-xs font-black active:scale-95 transition-all shadow-md shadow-purple-600/10"
                    >
                      Expédier (Départ Stock)
                    </button>
                  )}

                  {selectedTransfer.statut === 'Expedie' && (
                    <button
                      onClick={() => handleWorkflowAction('receive')}
                      disabled={transitioningStatus}
                      className="flex-1 bg-emerald-600 text-white py-3.5 px-4 rounded-xl text-xs font-black active:scale-95 transition-all shadow-md shadow-emerald-600/10"
                    >
                      Recevoir (Arrivée Stock)
                    </button>
                  )}

                  {selectedTransfer.statut === 'Recu' && (
                    <button
                      onClick={() => handleWorkflowAction('confirm')}
                      disabled={transitioningStatus}
                      className="flex-1 bg-slate-900 text-white py-3.5 px-4 rounded-xl text-xs font-black active:scale-95 transition-all shadow-md"
                    >
                      Confirmer & Clôturer
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER TRANSFER PRINT MODAL */}
      {printRef && (
        <StockTransferModal 
          transferRef={printRef}
          onClose={() => setPrintRef(null)}
        />
      )}

    </div>
  );
}
