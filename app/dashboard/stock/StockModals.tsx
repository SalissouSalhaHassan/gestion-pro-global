"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  ArrowRightLeft, 
  Settings2, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Minus,
  Database,
  Loader2,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Box,
  Package,
  Barcode,
  Tag,
  DollarSign,
  Layers,
  RefreshCw,
  Info,
  Save
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */
type StockItem = {
  id: number;
  reference: string;
  designation: string;
  quantite: number;
  unite: string;
  image_path: string | null;
};

type AdjustmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: StockItem | null;
  depot: string;
  onSuccess: () => void;
};

type TransferModalProps = {
  isOpen: boolean;
  onClose: () => void;
  item: StockItem | null;
  sourceDepot: string;
  onSuccess: () => void;
};

/* ═══════════════════════════════════════════════════════════════════
   ADJUSTMENT MODAL
   ═══════════════════════════════════════════════════════════════════ */

export function AdjustmentModal({ isOpen, onClose, item, depot, onSuccess }: AdjustmentModalProps) {
  const [qtyAdj, setQtyAdj] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selectedDepot, setSelectedDepot] = useState(depot === "Tous" ? "" : depot);
  const [depotsList, setDepotsList] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedDepot(depot === "Tous" ? "" : depot);
      if (depot === "Tous") {
        fetchDepots();
      }
    }
  }, [isOpen, depot]);

  const fetchDepots = async () => {
    try {
      const res = await fetch("/api/stock/depots");
      const data = await res.json();
      if (Array.isArray(data)) setDepotsList(data);
    } catch (err) {}
  };

  if (!isOpen || !item) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/stock/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_id: item.id,
          qty_adj: Number(qtyAdj),
          depot_nom: selectedDepot,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'ajustement");

      onSuccess();
      onClose();
      setQtyAdj("");
      setNotes("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const newQty = item.quantite + (Number(qtyAdj) || 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-indigo-600 p-8 text-white relative">
           <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-6 h-6" />
           </button>
           <h3 className="text-2xl font-black tracking-tight">Ajustement Manuel</h3>
           {depot !== "Tous" && (
             <p className="text-indigo-100 font-medium italic mt-1 opacity-80">Régularisation du stock pour : {depot}</p>
           )}
        </div>

        <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
           <div className="overflow-y-auto custom-scrollbar flex-1 p-6 sm:p-8 space-y-6">
           
           {/* Item Profile */}
           <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="w-16 h-16 bg-white rounded-xl shadow-sm flex items-center justify-center p-2 border border-slate-50">
                 {item.image_path ? (
                   <img src={item.image_path} className="w-full h-full object-contain" />
                 ) : <Box className="w-8 h-8 text-slate-200" />}
              </div>
              <div className="flex-1">
                 <h4 className="font-extrabold text-slate-800 line-clamp-1">{item.designation}</h4>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.reference}</p>
              </div>
              <div className="text-right">
                 <span className="text-sm font-black text-slate-400 uppercase block mb-1">Actuel</span>
                 <span className="text-2xl font-black text-slate-900 leading-none">{item.quantite} <span className="text-xs uppercase opacity-30">{item.unite}</span></span>
              </div>
           </div>

           {/* Adjustment Input */}
           {depot === "Tous" && (
             <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dépôt Cible</label>
                <select 
                  className="w-full p-4 bg-slate-50 border-2 border-indigo-100 focus:border-indigo-300 rounded-2xl outline-none font-black text-indigo-700 appearance-none text-center cursor-pointer"
                  value={selectedDepot}
                  onChange={(e) => setSelectedDepot(e.target.value)}
                  required
                >
                   <option value="" disabled>Sélectionner le dépôt à ajuster...</option>
                   {depotsList.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
             </div>
           )}

           <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité à Ajuster</label>
                 <div className="relative group">
                    <Settings2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      autoFocus
                      type="number" 
                      step="any"
                      placeholder="+ ou -"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-black text-xl text-slate-700 placeholder:font-normal placeholder:text-sm"
                      value={qtyAdj}
                      onChange={(e) => setQtyAdj(e.target.value)}
                      required
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nouveau Solde</label>
                 <div className={`w-full py-4 px-6 rounded-2xl flex items-center justify-center font-black text-2xl transition-colors ${newQty < 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    {newQty.toFixed(2)}
                 </div>
              </div>
           </div>

           {/* Notes */}
           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes / Raison</label>
              <textarea 
                className="w-full p-4 bg-slate-50 border-transparent border focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-semibold text-slate-600 text-sm min-h-[100px]"
                placeholder="Ex: Inventaire périodique, correction erreur..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
           </div>

           {error && (
             <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 font-bold text-sm animate-shake">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                {error}
             </div>
           )}

           <button 
             disabled={saving || !qtyAdj || Number(qtyAdj) === 0 || newQty < 0 || !selectedDepot}
             className="w-full py-4 sm:py-5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-slate-100 disabled:to-slate-100 disabled:text-slate-400 text-white rounded-full font-black text-lg transition-all shadow-xl shadow-indigo-200 disabled:shadow-none flex items-center justify-center gap-3"
           >
             {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : "Valider l'Ajustement"}
           </button>

        </div>
      </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TRANSFER MODAL
   ═══════════════════════════════════════════════════════════════════ */

export function TransferModal({ isOpen, onClose, item, sourceDepot, onSuccess }: TransferModalProps) {
  const [qty, setQty] = useState<string>("");
  const [actualSource, setActualSource] = useState(sourceDepot === "Tous" ? "" : sourceDepot);
  const [destDepot, setDestDepot] = useState("");
  const [depots, setDepots] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActualSource(sourceDepot === "Tous" ? "" : sourceDepot);
      fetchDepots();
    }
  }, [isOpen, sourceDepot]);

  const fetchDepots = async () => {
    try {
      const res = await fetch("/api/stock/depots");
      const data = await res.json();
      if (Array.isArray(data)) {
        setDepots(data);
      }
    } catch (err) {
      console.error("Error fetching depots:", err);
    }
  };

  if (!isOpen || !item) return null;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/stock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_id: item.id,
          qty: Number(qty),
          source_depot: actualSource,
          dest_depot: destDepot
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec du transfert");

      onSuccess();
      onClose();
      setQty("");
      setDestDepot("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-emerald-600 p-8 text-white relative">
           <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-6 h-6" />
           </button>
           <h3 className="text-2xl font-black tracking-tight">Transfert de Stock</h3>
           <p className="text-emerald-100 font-medium italic mt-1 opacity-80">Déplacement de marchandises entre dépôts</p>
        </div>

        <form onSubmit={handleTransfer} className="flex flex-col flex-1 overflow-hidden">
           <div className="overflow-y-auto custom-scrollbar flex-1 p-6 sm:p-8 space-y-6">
           
           {/* Item Card */}
           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center p-2">
                    <Package className="w-8 h-8 text-emerald-500/30" />
                 </div>
                 <div>
                    <h4 className="font-bold text-slate-800">{item.designation}</h4>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{item.reference}</p>
                 </div>
              </div>
              <div className="text-right">
                 <span className="text-sm font-black text-emerald-600">{item.quantite} <span className="opacity-40">{item.unite}</span></span>
              </div>
           </div>

           {/* Transfer Logic Visual */}
           <div className="grid grid-cols-11 items-center gap-2">
              <div className="col-span-5 space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Départ (Source)</label>
                 {sourceDepot === "Tous" ? (
                   <select 
                     className="w-full p-4 bg-slate-50 border-2 border-slate-200 focus:border-emerald-300 rounded-2xl outline-none font-black text-slate-700 appearance-none text-center cursor-pointer"
                     value={actualSource}
                     onChange={(e) => setActualSource(e.target.value)}
                     required
                   >
                      <option value="" disabled>Origine...</option>
                      {depots.filter(d => d !== destDepot).map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
                 ) : (
                   <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl font-bold text-slate-500 text-center">
                      {actualSource}
                   </div>
                 )}
              </div>
              <div className="col-span-1 flex justify-center pt-6">
                 <ArrowRightLeft className="w-6 h-6 text-slate-300" />
              </div>
              <div className="col-span-5 space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Arrivée (Cible)</label>
                 <select 
                   className="w-full p-4 bg-emerald-50 border-2 border-emerald-100 focus:border-emerald-300 rounded-2xl outline-none font-black text-emerald-700 appearance-none text-center cursor-pointer"
                   value={destDepot}
                   onChange={(e) => setDestDepot(e.target.value)}
                   required
                 >
                  <option value="" disabled>Destination...</option>
                  {depots.filter(d => d !== actualSource).map(d => <option key={d} value={d}>{d}</option>)}
               </select>
              </div>
           </div>

           <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantité à Transférer</label>
              <div className="relative group">
                 <input 
                   type="number" 
                   step="any"
                   placeholder="Ex: 50"
                   className="w-full p-5 bg-slate-50 border-transparent border focus:border-emerald-200 focus:bg-white rounded-[2rem] outline-none transition-all font-black text-3xl text-center text-emerald-600 placeholder:font-normal placeholder:text-lg"
                   value={qty}
                   onChange={(e) => setQty(e.target.value)}
                   required
                 />
              </div>
           </div>

           {error && (
             <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                {error}
             </div>
           )}

           <button 
             disabled={saving || !qty || !destDepot || !actualSource || destDepot === actualSource || Number(qty) > item.quantite}
             className="w-full py-4 sm:py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-100 disabled:to-slate-100 disabled:text-slate-400 text-white rounded-full font-black text-xl transition-all shadow-xl shadow-emerald-200 disabled:shadow-none flex items-center justify-center gap-3 uppercase tracking-wider"
           >
             {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmer le Transfert"}
           </button>

        </div>
      </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ADD ARTICLE MODAL
   ═══════════════════════════════════════════════════════════════════ */

type AddArticleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentDepot: string;
};

export function AddArticleModal({ isOpen, onClose, onSuccess, currentDepot }: AddArticleModalProps) {
  const [formData, setFormData] = useState({
    reference: "",
    designation: "",
    code_barre: "",
    p_achat_ht: "",
    p_vente_ttc: "",
    unite: "Unité",
    categorie_id: "",
    initial_stock: "0"
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (!formData.reference) {
         setFormData(prev => ({ ...prev, reference: "REF-" + Math.random().toString(36).substring(2, 8).toUpperCase() }));
      }
      if (!formData.code_barre) {
         setFormData(prev => ({ ...prev, code_barre: generateBarcode() }));
      }
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/stock/categories");
      const data = await res.json();
      if (Array.isArray(data)) setCategories(data);
    } catch (err) {}
  };

  const generateBarcode = () => {
    const prefix = "613"; 
    const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const last = Math.floor(Math.random() * 10).toString();
    return prefix + random + last;
  };

  const handleManualGenBarcode = () => {
    setFormData(prev => ({ ...prev, code_barre: generateBarcode() }));
  };

  const handleManualGenRef = () => {
    setFormData(prev => ({ ...prev, reference: "REF-" + Math.random().toString(36).substring(2, 8).toUpperCase() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          depot_nom: currentDepot
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la création");

      onSuccess();
      onClose();
      // Reset form
      setFormData({
        reference: "",
        designation: "",
        code_barre: "",
        p_achat_ht: "",
        p_vente_ttc: "",
        unite: "Unité",
        categorie_id: "",
        initial_stock: "0"
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all">
      <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
        <div className="bg-slate-900 p-8 text-white relative">
           <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-6 h-6" />
           </button>
           <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <Plus className="w-8 h-8 text-emerald-500" />
              Nouveau Produit
           </h3>
           <p className="text-slate-400 font-medium italic mt-1">Créez un nouvel article et initialisez son stock.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
           <div className="overflow-y-auto custom-scrollbar flex-1 p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                    Référence <span>(Auto-générée si vide)</span>
                  </label>
                  <div className="relative group">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                    <input 
                      type="text" 
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-200 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                      value={formData.reference}
                      onChange={(e) => setFormData({...formData, reference: e.target.value})}
                      placeholder="Ex: REF-001"
                      required
                    />
                    <button 
                      type="button"
                      onClick={handleManualGenRef}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-slate-100 rounded-lg shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
                      title="Générer une référence"
                    >
                       <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex justify-between">
                    Code Barre <span>(Auto-généré)</span>
                  </label>
                  <div className="relative group">
                    <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-slate-900 transition-colors" />
                    <input 
                      type="text" 
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-transparent focus:border-slate-200 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                      value={formData.code_barre}
                      onChange={(e) => setFormData({...formData, code_barre: e.target.value})}
                      placeholder="Code EAN-13"
                    />
                    <button 
                      type="button"
                      onClick={handleManualGenBarcode}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white border border-slate-100 rounded-lg shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors"
                      title="Générer un code barre"
                    >
                       <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Designation / Nom du Produit</label>
                <div className="relative group">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                  <input 
                    type="text" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-800"
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="Ex: Coca Cola 1.5L"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix Achat HT</label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="number" 
                      step="any"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl outline-none transition-all font-bold text-slate-700"
                      value={formData.p_achat_ht}
                      onChange={(e) => setFormData({...formData, p_achat_ht: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prix Vente TTC</label>
                  <div className="relative group">
                    <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                      type="number" 
                      step="any"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-emerald-100 focus:bg-white rounded-2xl outline-none transition-all font-bold text-emerald-600"
                      value={formData.p_vente_ttc}
                      onChange={(e) => setFormData({...formData, p_vente_ttc: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unité</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-slate-200 rounded-2xl outline-none font-bold text-slate-700 appearance-none bg-no-repeat bg-[right_1rem_center]"
                    value={formData.unite}
                    onChange={(e) => setFormData({...formData, unite: e.target.value})}
                  >
                    <option value="Unité">Unité</option>
                    <option value="Colis">Colis</option>
                    <option value="Litre">Litre</option>
                    <option value="Kg">Kg</option>
                    <option value="Carton">Carton</option>
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Catégorie</label>
                  <select 
                    className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                    value={formData.categorie_id}
                    onChange={(e) => setFormData({...formData, categorie_id: e.target.value})}
                  >
                    <option value="">Aucune catégorie</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.nom}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 space-y-3">
                 <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-emerald-600" />
                    <span className="font-black text-emerald-800 text-sm italic uppercase tracking-tighter">Initialisation du Stock</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex-1">
                       <label className="text-[9px] font-black text-emerald-600/60 uppercase ml-1">Quantité Initiale dans : <b>{currentDepot}</b></label>
                       <input 
                        type="number" 
                        className="w-full bg-white border border-emerald-200 p-3 rounded-xl font-black text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={formData.initial_stock}
                        onChange={(e) => setFormData({...formData, initial_stock: e.target.value})}
                       />
                    </div>
                 </div>
              </div>
              {error && <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 font-bold text-sm">{error}</div>}
              <div className="pt-4">
                <button 
                  disabled={saving || !formData.designation}
                  className="w-full py-5 bg-slate-900 text-white rounded-full font-black text-xl flex items-center justify-center gap-3 mb-6"
                >
                  {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                  {saving ? "Création..." : "Créer le Produit"}
                </button>
              </div>
           </div>
        </form>
      </div>
    </div>
  );
}
