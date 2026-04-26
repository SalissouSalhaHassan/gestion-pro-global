"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ShoppingCart, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Calculator, 
  User, 
  Warehouse, 
  FileText, 
  Package, 
  Loader2, 
  CheckCircle2,
  ChevronDown,
  Search,
  X
} from "lucide-react";

type Supplier = { id: number; nom: string };
type Depot = { id: number; nom: string };
type Article = { id: number; designation: string; unite: string; p_achat_ht: number };
type PurchaseItem = {
  article_id: number;
  designation: string;
  unite: string;
  quantite: number;
  prix_unitaire_ht: number;
  montant_ligne: number;
};

export default function NewPurchasePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState<number | "">("");
  const [selectedDepot, setSelectedDepot] = useState<string>("Dépôt Principal");
  const [refFacture, setRefFacture] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Input fields for current item
  const [currentArticle, setCurrentArticle] = useState<Article | null>(null);
  const [currentQty, setCurrentQty] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [articleSearch, setArticleSearch] = useState("");
  const [isArticleListOpen, setIsArticleListOpen] = useState(false);

  // Totals fields
  const [remisePercent, setRemisePercent] = useState(0);
  const [taxePercent, setTaxePercent] = useState(0);
  const [transport, setTransport] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [suppRes, depRes, artRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/depots"),
        fetch("/api/articles")
      ]);
      setSuppliers(await suppRes.json());
      const depData = await depRes.json();
      setDepots(depData);
      if (depData.length > 0) setSelectedDepot(depData[0].nom);
      
      const artData = await artRes.json();
      setArticles(Array.isArray(artData) ? artData : (artData.items || []));
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredArticles = useMemo(() => {
    if (!articleSearch) return [];
    return articles.filter(a => a.designation.toLowerCase().includes(articleSearch.toLowerCase())).slice(0, 10);
  }, [articleSearch, articles]);

  const subTotal = useMemo(() => items.reduce((acc, item) => acc + item.montant_ligne, 0), [items]);
  const remiseAmount = (subTotal * remisePercent) / 100;
  const taxeAmount = ((subTotal - remiseAmount) * taxePercent) / 100;
  const totalAmount = subTotal - remiseAmount + taxeAmount + transport;
  const resteAPayer = totalAmount - paidAmount;

  const handleAddLine = () => {
    if (!currentArticle || currentQty <= 0 || currentPrice < 0) return;
    
    const newItem: PurchaseItem = {
      article_id: Number(currentArticle.id),
      designation: currentArticle.designation,
      unite: currentArticle.unite,
      quantite: currentQty,
      prix_unitaire_ht: currentPrice,
      montant_ligne: currentQty * currentPrice
    };

    setItems([...items, newItem]);
    setCurrentArticle(null);
    setArticleSearch("");
    setCurrentQty(1);
    setCurrentPrice(0);
  };

  const handleRemoveLine = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedSupplier || items.length === 0) {
      alert("Veuillez sélectionner un fournisseur et ajouter au moins un article.");
      return;
    }

    setSaving(true);
    try {
      const purchaseData = {
        fournisseur_id: selectedSupplier,
        fournisseur_nom: suppliers.find(s => s.id === Number(selectedSupplier))?.nom,
        numero_facture: refFacture || `FAC-${Date.now()}`,
        date_achat: new Date().toISOString().split('T')[0],
        sous_total: subTotal,
        remise: remiseAmount,
        taxe: taxeAmount,
        transport: transport,
        montant_total: totalAmount,
        montant_paye: paidAmount,
        statut: paidAmount >= totalAmount ? "Payée" : paidAmount > 0 ? "Partiellement Payée" : "Non Payée",
        notes,
        depot_nom: selectedDepot,
        items
      };

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseData)
      });

      if (!res.ok) throw new Error("Failed to save purchase");

      router.push("/dashboard/purchases");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'enregistrement de l'achat.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="h-[80vh] flex flex-col items-center justify-center text-slate-400">
      <Loader2 className="animate-spin mb-4" size={40} />
      <p className="font-bold">Chargement des données...</p>
    </div>
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-all font-black text-sm uppercase tracking-widest mb-4">
            <ArrowLeft size={16} /> Retour
          </button>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
            <div className="p-3 bg-white/50 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
              <ShoppingCart className="text-indigo-600" size={32} />
            </div>
            Enregistrement d'un Achat
          </h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving || items.length === 0}
          className="flex items-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-3xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
          Valider & Enregistrer
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Panel: Info & Items */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Info Card */}
          <div className="bg-white/60 backdrop-blur-xl rounded-[40px] border border-white p-8 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                <User size={12} /> Fournisseur
              </label>
              <select 
                value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-white border-slate-100 rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
              >
                <option value="">Sélectionner un fournisseur...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                <Warehouse size={12} /> Dépôt de destination
              </label>
              <select 
                value={selectedDepot} onChange={e => setSelectedDepot(e.target.value)}
                className="w-full bg-white border-slate-100 rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
              >
                {depots.map(d => <option key={d.id} value={d.nom}>{d.nom}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                <FileText size={12} /> Référence Facture
              </label>
              <input 
                type="text" placeholder="Ex: FAC-2024-001"
                value={refFacture} onChange={e => setRefFacture(e.target.value)}
                className="w-full bg-white border-slate-100 rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                <FileText size={12} /> Notes
              </label>
              <input 
                type="text" placeholder="Observation..."
                value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full bg-white border-slate-100 rounded-2xl p-4 font-bold focus:ring-4 focus:ring-indigo-50 transition-all"
              />
            </div>
          </div>

          {/* Item Entry Form */}
          <div className="bg-indigo-600 rounded-[40px] p-8 shadow-xl shadow-indigo-100 space-y-6">
            <div className="flex items-center gap-2 text-indigo-200 font-black text-xs uppercase tracking-widest">
              <Plus size={14} /> Ajouter un article
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative">
                <input 
                  type="text" placeholder="Rechercher un article..."
                  value={articleSearch} 
                  onChange={e => {
                    setArticleSearch(e.target.value);
                    setIsArticleListOpen(true);
                  }}
                  className="w-full bg-white/10 border-white/20 text-white placeholder:text-indigo-200 rounded-2xl p-4 font-bold focus:ring-4 focus:ring-white/10 transition-all"
                />
                {isArticleListOpen && filteredArticles.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl overflow-hidden z-50">
                    {filteredArticles.map(art => (
                      <button 
                        key={art.id}
                        onClick={() => {
                          setCurrentArticle(art);
                          setArticleSearch(art.designation);
                          setCurrentPrice(art.p_achat_ht || 0);
                          setIsArticleListOpen(false);
                        }}
                        className="w-full text-left px-6 py-4 hover:bg-indigo-50 font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                      >
                        {art.designation} <span className="text-slate-400 text-xs ml-2">({art.unite})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <input 
                  type="number" placeholder="Qté"
                  value={currentQty} onChange={e => setCurrentQty(Number(e.target.value))}
                  className="w-full bg-white/10 border-white/20 text-white placeholder:text-indigo-200 rounded-2xl p-4 font-bold focus:ring-4 focus:ring-white/10 transition-all"
                />
              </div>
              <div className="relative">
                <input 
                  type="number" placeholder="Prix Unit."
                  value={currentPrice} onChange={e => setCurrentPrice(Number(e.target.value))}
                  className="w-full bg-white/10 border-white/20 text-white placeholder:text-indigo-200 rounded-2xl p-4 font-bold focus:ring-4 focus:ring-white/10 transition-all"
                />
              </div>
            </div>
            <button 
              onClick={handleAddLine}
              className="w-full bg-white text-indigo-600 px-6 py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-50 transition-all"
            >
              Ajouter à la liste
            </button>
          </div>

          {/* Items Table */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Désignation</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Unité</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">P.U</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Qté</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-300 font-bold">Aucun article ajouté</td>
                  </tr>
                ) : (
                  items.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-black text-slate-700">{item.designation}</td>
                      <td className="px-8 py-5 text-slate-500 font-bold">{item.unite}</td>
                      <td className="px-8 py-5 text-right font-bold text-slate-900">{new Intl.NumberFormat("fr-FR").format(item.prix_unitaire_ht)}</td>
                      <td className="px-8 py-5 text-center font-black text-indigo-600">{item.quantite}</td>
                      <td className="px-8 py-5 text-right font-black text-slate-900">{new Intl.NumberFormat("fr-FR").format(item.montant_ligne)}</td>
                      <td className="px-8 py-5 text-right">
                        <button onClick={() => handleRemoveLine(index)} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel: Totals */}
        <div className="space-y-8">
          <div className="bg-white rounded-[48px] border border-slate-100 p-10 shadow-xl space-y-8">
            <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest">
              <Calculator size={14} /> Récapitulatif
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-slate-500 font-bold">
                <span>Sous-Total</span>
                <span>{new Intl.NumberFormat("fr-FR").format(subTotal)} F</span>
              </div>
              
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500 font-bold">Remise (%)</span>
                <input 
                  type="number" value={remisePercent} onChange={e => setRemisePercent(Number(e.target.value))}
                  className="w-24 bg-slate-50 border-none rounded-xl p-2 text-right font-bold focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500 font-bold">Taxe (%)</span>
                <input 
                  type="number" value={taxePercent} onChange={e => setTaxePercent(Number(e.target.value))}
                  className="w-24 bg-slate-50 border-none rounded-xl p-2 text-right font-bold focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500 font-bold">Transport</span>
                <input 
                  type="number" value={transport} onChange={e => setTransport(Number(e.target.value))}
                  className="w-32 bg-slate-50 border-none rounded-xl p-2 text-right font-bold focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-xl font-black text-slate-900 uppercase tracking-tighter">Total à payer</span>
                <span className="text-3xl font-black text-indigo-600">{new Intl.NumberFormat("fr-FR").format(totalAmount)} F</span>
              </div>

              <div className="bg-emerald-50 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center text-emerald-700 font-black text-xs uppercase tracking-widest">
                  <span>Montant Payé</span>
                  <CheckCircle2 size={14} />
                </div>
                <input 
                  type="number" value={paidAmount} onChange={e => setPaidAmount(Number(e.target.value))}
                  className="w-full bg-white border-none rounded-2xl p-4 text-2xl font-black text-emerald-600 focus:ring-4 focus:ring-emerald-100 transition-all text-right"
                />
              </div>

              <div className={`rounded-3xl p-6 flex justify-between items-center ${resteAPayer > 0 ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"}`}>
                <span className="font-black text-xs uppercase tracking-widest">Reste à payer</span>
                <span className="text-xl font-black">{new Intl.NumberFormat("fr-FR").format(resteAPayer)} F</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[40px] p-10 text-white space-y-4">
            <h4 className="font-black flex items-center gap-2">
              <AlertCircle size={16} className="text-indigo-400" /> Aide
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Vérifiez bien le dépôt de destination avant de valider. Les stocks et les prix moyens pondérés (PMP) seront mis à jour instantanément après l'enregistrement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
