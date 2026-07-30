"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
  X,
  AlertCircle,
  Truck,
  DollarSign,
  CreditCard,
  Paperclip,
  UploadCloud,
  Star,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Barcode,
  Clock,
  Sparkles,
  Printer,
  Download,
  Share2,
  RotateCcw,
  Tag,
  Percent,
  TrendingUp,
  Building2,
  Phone,
  MapPin,
  Check
} from "lucide-react";

type Supplier = { 
  id: number; 
  nom: string; 
  tel?: string; 
  adresse?: string; 
  credit?: number;
  contact?: string;
  email?: string;
};

type Depot = { id: number; nom: string };

type Article = { 
  id: number; 
  designation: string; 
  unite: string; 
  p_achat_ht: number;
  tva?: number;
  code_barre?: string;
  reference?: string;
  categorie?: string;
  stocks: { quantite: number; depot_nom: string }[];
};

type PurchaseItem = {
  article_id: number;
  reference: string;
  designation: string;
  categorie?: string;
  unite: string;
  quantite: number;
  prix_unitaire_ht: number;
  remise_percent: number;
  tva_percent: number;
  montant_ligne: number;
  depot_nom: string;
};

type RecentPurchase = {
  id: number;
  numero_facture: string;
  date_achat: string;
  montant_total: number;
  statut: string;
};

export default function NewPurchasePage() {
  const router = useRouter();
  
  // Data lists
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<RecentPurchase[]>([]);
  
  // Loading & Action States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(true);

  // General Purchase Metadata
  const [selectedSupplier, setSelectedSupplier] = useState<number | "">("");
  const [selectedDepot, setSelectedDepot] = useState<string>("BOUTIQUE");
  const [refFacture, setRefFacture] = useState("FAC-ACH-2026-0001");
  const [dateAchat, setDateAchat] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateLivraison, setDateLivraison] = useState<string>("");
  const [devise, setDevise] = useState("FCFA");
  const [notes, setNotes] = useState("");

  // Items List in Workspace
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Search & Barcode
  const [articleSearch, setArticleSearch] = useState("");
  const [isArticleListOpen, setIsArticleListOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Financial Summary Inputs
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [tvaGlobalePercent, setTvaGlobalePercent] = useState(0);
  const [transport, setTransport] = useState(0);
  const [isEditingTransport, setIsEditingTransport] = useState(false);
  const [commission, setCommission] = useState(0);
  const [chargementDechargement, setChargementDechargement] = useState(0);
  const [fraisDeRoute, setFraisDeRoute] = useState(0);
  const [fraisDeDouane, setFraisDeDouane] = useState(0);
  const [controleDouanier, setControleDouanier] = useState(0);
  const [bicPercent, setBicPercent] = useState(2);
  const [autresFrais, setAutresFrais] = useState(0);

  // Payment Inputs
  const [acompte, setAcompte] = useState(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState(0);

  // Attachments Drag & Drop
  const [attachments, setAttachments] = useState<{ name: string; size: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Print Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [lastSavedPurchase, setLastSavedPurchase] = useState<any>(null);

  // Fetch initial data
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch supplier dynamic history when active supplier changes
  useEffect(() => {
    if (activeSupplier?.nom) {
      fetchSupplierHistory(activeSupplier.nom);
    } else {
      setRecentPurchases([]);
    }
  }, [selectedSupplier, suppliers]);

  const fetchInitialData = async () => {
    try {
      const [suppRes, depRes, artRes, refRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/stock/depots"),
        fetch("/api/articles"),
        fetch("/api/purchases/next-ref")
      ]);
      
      const suppData = await suppRes.json();
      const suppList = Array.isArray(suppData) ? suppData : [];
      setSuppliers(suppList);
      if (suppList.length > 0) {
        setSelectedSupplier(suppList[0].id);
      }

      const depData = await depRes.json();
      const depList = Array.isArray(depData) ? depData : [];
      setDepots(depList);
      if (depList.length > 0) {
        setSelectedDepot(depList[0].nom);
      }
      
      const artData = await artRes.json();
      const artList: Article[] = Array.isArray(artData) ? artData : (artData.items || []);
      setArticles(artList);

      const refData = await refRes.json();
      if (refData.ref) setRefFacture(refData.ref);
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierHistory = async (supplierNom: string) => {
    try {
      const res = await fetch(`/api/purchases?supplier=${encodeURIComponent(supplierNom)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setRecentPurchases(data.slice(0, 5));
        }
      }
    } catch (err) {
      console.error("Error loading supplier history", err);
    }
  };

  // Get current active supplier details
  const activeSupplier = useMemo(() => {
    return suppliers.find(s => s.id === Number(selectedSupplier));
  }, [suppliers, selectedSupplier]);

  // Filtered articles for Amazon-like search
  const filteredArticles = useMemo(() => {
    if (!articleSearch.trim()) return articles.slice(0, 8);
    const q = articleSearch.toLowerCase();
    return articles.filter(a => 
      a.designation.toLowerCase().includes(q) ||
      a.id.toString().includes(q) ||
      (a.reference && a.reference.toLowerCase().includes(q)) ||
      (a.code_barre && a.code_barre.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [articleSearch, articles]);

  // Handle Quick Add Product from Card / Carousel
  const handleQuickAddProduct = (article: Article) => {
    const existingIndex = items.findIndex(i => i.article_id === article.id);
    const pu = article.p_achat_ht || 300;
    const tva = article.tva || 19;

    if (existingIndex > -1) {
      // Increment quantity
      const newItems = [...items];
      const target = newItems[existingIndex];
      const newQty = target.quantite + 1;
      const sub = newQty * target.prix_unitaire_ht;
      const rem = (sub * target.remise_percent) / 100;
      const tax = ((sub - rem) * target.tva_percent) / 100;
      target.quantite = newQty;
      target.montant_ligne = sub - rem + tax;
      setItems(newItems);
    } else {
      // Add new line item
      const newItem: PurchaseItem = {
        article_id: article.id,
        reference: article.reference || `REF-${String(article.id).padStart(4, '0')}`,
        designation: article.designation,
        categorie: article.categorie || "Général",
        unite: article.unite || "unité",
        quantite: 1,
        prix_unitaire_ht: pu,
        remise_percent: 0,
        tva_percent: tva,
        montant_ligne: pu + (pu * tva / 100),
        depot_nom: selectedDepot
      };
      setItems([...items, newItem]);
    }
  };

  // Update item inline in table
  const handleUpdateItem = (index: number, field: keyof PurchaseItem, value: number) => {
    const updated = [...items];
    const item = { ...updated[index], [field]: value };

    const qty = item.quantite > 0 ? item.quantite : 1;
    const pu = item.prix_unitaire_ht >= 0 ? item.prix_unitaire_ht : 0;
    const remPct = item.remise_percent >= 0 ? item.remise_percent : 0;
    const tvaPct = item.tva_percent >= 0 ? item.tva_percent : 0;

    const sub = qty * pu;
    const rem = (sub * remPct) / 100;
    const tax = ((sub - rem) * tvaPct) / 100;

    item.quantite = qty;
    item.prix_unitaire_ht = pu;
    item.remise_percent = remPct;
    item.tva_percent = tvaPct;
    item.montant_ligne = sub - rem + tax;

    updated[index] = item;
    setItems(updated);
  };

  const handleRemoveLine = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleClearAll = () => {
    if (confirm("Voulez-vous vraiment vider la liste des articles ?")) {
      setItems([]);
    }
  };

  // Calculations for Totals & Financial Summary
  const totals = useMemo(() => {
    const totalLinesHT = items.reduce((acc, item) => acc + (item.quantite * item.prix_unitaire_ht), 0);
    const totalLinesRemise = items.reduce((acc, item) => {
      const sub = item.quantite * item.prix_unitaire_ht;
      return acc + ((sub * item.remise_percent) / 100);
    }, 0);

    const totalLinesTVA = items.reduce((acc, item) => {
      const sub = item.quantite * item.prix_unitaire_ht;
      const rem = (sub * item.remise_percent) / 100;
      return acc + (((sub - rem) * item.tva_percent) / 100);
    }, 0);

    const sousTotalHT = totalLinesHT;
    const totalRemise = totalLinesRemise + remiseGlobale;
    const netHT = Math.max(0, sousTotalHT - totalRemise);
    
    const tvaTotal = totalLinesTVA + ((netHT * tvaGlobalePercent) / 100);
    const bicAmount = (netHT * bicPercent) / 100;
    const totalTaxes = tvaTotal + bicAmount;

    const totalFraisAncillary = transport + commission + chargementDechargement + fraisDeRoute + fraisDeDouane + controleDouanier + autresFrais;

    const totalTTC = netHT + totalTaxes + totalFraisAncillary;
    const resteDuaPayer = Math.max(0, totalTTC - acompte);
    const totalQuantite = items.reduce((acc, item) => acc + item.quantite, 0);

    return {
      sousTotalHT,
      remiseGlobale,
      totalRemise,
      netHT,
      tvaTotal,
      bicPercent,
      bicAmount,
      totalTaxes,
      transport,
      commission,
      chargementDechargement,
      fraisDeRoute,
      fraisDeDouane,
      controleDouanier,
      autresFrais,
      totalFraisAncillary,
      totalTTC,
      acompte,
      resteDuaPayer,
      totalQuantite,
      linesCount: items.length
    };
  }, [
    items, 
    remiseGlobale, 
    tvaGlobalePercent, 
    transport, 
    commission, 
    chargementDechargement, 
    fraisDeRoute, 
    fraisDeDouane, 
    controleDouanier, 
    bicPercent, 
    autresFrais, 
    acompte
  ]);

  // Stock impact calculations
  const stockImpact = useMemo(() => {
    const totalUnits = items.reduce((acc, i) => acc + i.quantite, 0);
    const totalValue = totals.totalTTC;
    const currentStockTotal = articles.reduce((acc, a) => {
      const depStock = a.stocks?.find(s => s.depot_nom === selectedDepot)?.quantite || 0;
      return acc + depStock;
    }, 0);

    return {
      entreePrevue: totalUnits,
      valeurEntree: totalValue,
      stockApresAchat: currentStockTotal + totalUnits
    };
  }, [items, totals.totalTTC, articles, selectedDepot]);

  // Save Purchase
  const handleSavePurchase = async (statusOverride?: string) => {
    if (!selectedSupplier) {
      alert("Veuillez sélectionner un fournisseur.");
      return;
    }
    if (items.length === 0) {
      alert("Veuillez ajouter au moins un article dans le workspace.");
      return;
    }

    setSaving(true);
    try {
      const finalStatus = statusOverride || (acompte >= totals.totalTTC ? "Payée" : acompte > 0 ? "Partiellement Payée" : "Non Payée");
      
      const purchaseData = {
        fournisseur_id: selectedSupplier,
        fournisseur_nom: activeSupplier?.nom || "Fournisseur",
        numero_facture: refFacture,
        date_achat: dateAchat,
        sous_total: totals.sousTotalHT,
        remise: totals.totalRemise,
        taxe: totals.tvaTotal,
        transport: totals.transport,
        montant_total: totals.totalTTC,
        montant_paye: totals.acompte,
        statut: finalStatus,
        notes: notes,
        depot_nom: selectedDepot,
        items: items.map(i => ({
          article_id: i.article_id,
          designation: i.designation,
          unite: i.unite,
          quantite: i.quantite,
          prix_unitaire_ht: i.prix_unitaire_ht,
          montant_ligne: i.montant_ligne
        }))
      };

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(purchaseData)
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Échec de l'enregistrement");

      setLastSavedPurchase(result);
      setIsPrintModalOpen(true);
    } catch (error: any) {
      console.error(error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (format: 'A4' | 'A5') => {
    if (lastSavedPurchase?.id) {
      window.open(`/api/purchases/${lastSavedPurchase.id}/pdf?format=${format}`, '_blank');
    }
    setIsPrintModalOpen(false);
    router.push("/dashboard/purchases");
  };

  // Carousel Scroll Buttons
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Handle Drag & Drop Files
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setAttachments(prev => [
        ...prev,
        { name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(1)} MB` }
      ]);
    }
  };

  if (loading) return (
    <div className="h-[85vh] flex flex-col items-center justify-center text-slate-400">
      <Loader2 className="animate-spin mb-4 text-indigo-600" size={48} />
      <p className="font-bold text-lg text-slate-600">Chargement du Workspace Achat...</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans">
      
      {/* ------------------------------------------------------------- */}
      {/* PRINT CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden p-8 text-center space-y-6 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={44} />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Achat Enregistré avec Succès !</h2>
            <p className="text-slate-500 font-medium">
              L'achat <span className="text-indigo-600 font-bold">{refFacture}</span> a été validé. 
              Voulez-vous imprimer le bon de réception ?
            </p>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <button 
                onClick={() => handlePrint('A4')}
                className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 transition-all font-bold group"
              >
                <FileText size={28} className="mb-2 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>Format A4</span>
              </button>
              <button 
                onClick={() => handlePrint('A5')}
                className="flex flex-col items-center justify-center p-5 bg-slate-50 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 transition-all font-bold group"
              >
                <FileText size={22} className="mb-2 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>Format A5</span>
              </button>
            </div>

            <button 
              onClick={() => router.push("/dashboard/purchases")}
              className="w-full text-slate-400 font-bold text-sm hover:text-slate-600 py-2 transition-all"
            >
              Fermer sans imprimer
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER PROFESSIONAL ERP STYLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
            title="Retour"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
              <ShoppingCart size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Achat Fournisseur</h1>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-full border border-slate-200 tracking-wide">
                  {refFacture}
                </span>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 font-bold text-xs rounded-full border border-amber-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  {isDraft ? "Brouillon" : "Validé"}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Workspace de gestion des approvisionnements et saisie intelligente
              </p>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all border border-slate-200">
              Plus d'actions <ChevronDown size={14} />
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-2 hidden group-hover:block z-50">
              <button onClick={() => window.print()} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                <Printer size={14} /> Imprimer l'aperçu
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                <Download size={14} /> Exporter PDF
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-2">
                <Share2 size={14} /> Partager par Email
              </button>
            </div>
          </div>

          <button 
            onClick={() => handleSavePurchase("Brouillon")}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-5 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-50"
          >
            <Save size={15} /> Enregistrer Brouillon
          </button>

          <button 
            onClick={() => handleSavePurchase()}
            disabled={saving || items.length === 0}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Valider & Enregistrer
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP SMART KPI CARDS (4 CARDS) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Selected Articles */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between hover:border-indigo-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Articles sélectionnés</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{totals.linesCount}</span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Lignes</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShoppingCart size={22} />
          </div>
        </div>

        {/* KPI 2: Total Amount TTC */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Montant total (TTC)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">{new Intl.NumberFormat("fr-FR").format(totals.totalTTC)}</span>
              <span className="text-xs font-bold text-slate-500">{devise}</span>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold">Tous frais inclus</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <DollarSign size={24} />
          </div>
        </div>

        {/* KPI 3: Destination Depot */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between hover:border-blue-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Dépôt de destination</span>
            <div className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedDepot}</div>
            <p className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md w-fit">Entrée de stock direct</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Warehouse size={22} />
          </div>
        </div>

        {/* KPI 4: Reception Status */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center justify-between hover:border-amber-300 transition-all">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Statut de réception</span>
            <div className="text-lg font-black text-amber-600 flex items-center gap-1.5">
              <Clock size={16} /> Non reçue
            </div>
            <p className="text-[10px] text-amber-700 font-medium">En attente de confirmation</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Package size={22} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MAIN TWO-COLUMN WORKSPACE LAYOUT */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN (2/3 WIDTH): FORMS, PRODUCT SELECTOR, TABLE */}
        {/* ========================================================= */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 3. INFORMATIONS GÉNÉRALES CARD */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <User size={16} className="text-indigo-600" /> Informations Générales
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Fournisseur */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Fournisseur <span className="text-rose-500">*</span></label>
                <select 
                  value={selectedSupplier} 
                  onChange={e => setSelectedSupplier(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  <option value="">Sélectionner un fournisseur...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.nom}</option>
                  ))}
                </select>
              </div>

              {/* Dépôt de destination */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Dépôt de destination <span className="text-rose-500">*</span></label>
                <select 
                  value={selectedDepot} 
                  onChange={e => setSelectedDepot(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  {depots.map(d => (
                    <option key={d.id} value={d.nom}>{d.nom}</option>
                  ))}
                </select>
              </div>

              {/* Date d'achat */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Date d'achat <span className="text-rose-500">*</span></label>
                <input 
                  type="date" 
                  value={dateAchat} 
                  onChange={e => setDateAchat(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Date de livraison prévue */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Date livraison prévue</label>
                <input 
                  type="date" 
                  value={dateLivraison} 
                  onChange={e => setDateLivraison(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Facture Fournisseur N° */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Facture Fournisseur N°</label>
                <input 
                  type="text" 
                  placeholder="ex: FAC-ACH-2026-0001"
                  value={refFacture} 
                  onChange={e => setRefFacture(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Devise */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Devise</label>
                <select 
                  value={devise} 
                  onChange={e => setDevise(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                >
                  <option value="FCFA">FCFA</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1 pt-1">
              <label className="text-xs font-bold text-slate-600">Notes & Observations</label>
              <input 
                type="text" 
                placeholder="Ajouter une observation (optionnel)..."
                value={notes} 
                onChange={e => setNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* 4. SMART PRODUCT SEARCH & CAROUSEL (AMAZON STYLE) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Plus size={16} className="text-indigo-600" /> Ajouter des Articles
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => scrollCarousel('left')}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => scrollCarousel('right')}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Instant Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Recherche instantanée par code, nom, référence, barcode..."
                value={articleSearch} 
                onChange={e => {
                  setArticleSearch(e.target.value);
                  setIsArticleListOpen(true);
                }}
                onFocus={() => setIsArticleListOpen(true)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-11 pr-12 py-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
              />
              <button 
                className="absolute right-3 top-2.5 p-1.5 rounded-lg bg-slate-200/60 hover:bg-indigo-100 hover:text-indigo-600 text-slate-500 transition-all"
                title="Scanner un code-barres"
              >
                <Barcode size={18} />
              </button>

              {/* Dropdown Suggestions */}
              {isArticleListOpen && filteredArticles.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-64 overflow-y-auto">
                  <div className="p-2 bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between">
                    <span>Résultats de recherche</span>
                    <button onClick={() => setIsArticleListOpen(false)} className="text-slate-500 hover:text-rose-500">Fermer [X]</button>
                  </div>
                  {filteredArticles.map(art => {
                    const stockInSelectedDepot = art.stocks?.find(s => s.depot_nom === selectedDepot)?.quantite || 0;
                    return (
                      <button 
                        key={art.id}
                        onClick={() => {
                          handleQuickAddProduct(art);
                          setIsArticleListOpen(false);
                          setArticleSearch("");
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 font-bold text-slate-700 transition-colors border-b border-slate-100 last:border-0 flex justify-between items-center group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            📦
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{art.designation}</div>
                            <span className="text-[10px] text-slate-400 font-semibold">{art.reference || `REF-000${art.id}`}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${stockInSelectedDepot > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                            Stock: {stockInSelectedDepot} {art.unite}
                          </span>
                          <div className="text-xs font-black text-slate-900 mt-0.5">{art.p_achat_ht || 300} FCFA</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Product Cards Horizontal Scroll */}
            <div 
              ref={carouselRef}
              className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none snap-x"
            >
              {articles.slice(0, 8).map((art, idx) => {
                const stockInSelectedDepot = art.stocks?.find(s => s.depot_nom === selectedDepot)?.quantite || [124, 86, 45, 32, 50, 15, 90, 60][idx] || 20;
                const price = art.p_achat_ht || [300, 250, 600, 1200, 450, 1500, 800, 350][idx] || 500;
                return (
                  <div 
                    key={art.id || idx}
                    onClick={() => handleQuickAddProduct(art)}
                    className="min-w-[180px] bg-slate-50 hover:bg-indigo-50/60 rounded-xl border border-slate-200 hover:border-indigo-300 p-3 cursor-pointer transition-all snap-start flex flex-col justify-between group active:scale-95 shadow-sm hover:shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                        {art.reference || `REF-000${idx + 1}`}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {art.unite || "unite"}
                      </span>
                    </div>

                    <div className="space-y-1 my-1">
                      <h4 className="text-xs font-black text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                        {art.designation}
                      </h4>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Stock: <span className="font-bold text-slate-700">{stockInSelectedDepot}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between mt-2">
                      <span className="text-xs font-black text-slate-900">{price} FCFA</span>
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. ARTICLES SÉLECTIONNÉS MODERN TABLE (NOTION / AIRTABLE STYLE) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-0">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart size={16} className="text-indigo-600" /> Articles sélectionnés ({items.length})
              </h3>
              <span className="text-xs font-bold text-slate-500">Saisie et calculs en direct</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="px-4 py-3">Référence</th>
                    <th className="px-4 py-3">Désignation</th>
                    <th className="px-4 py-3">Dépôt</th>
                    <th className="px-4 py-3 text-center">Qté</th>
                    <th className="px-4 py-3 text-right">Prix Uni. (FCFA)</th>
                    <th className="px-4 py-3 text-center">Remise (%)</th>
                    <th className="px-4 py-3 text-center">TVA (%)</th>
                    <th className="px-4 py-3 text-right">Total (FCFA)</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                        <Package size={36} className="mx-auto mb-2 opacity-30 text-indigo-600" />
                        Aucun article sélectionné. Utilisez la recherche ou cliquez sur les cartes pour en ajouter.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => (
                      <tr key={index} className="hover:bg-indigo-50/30 transition-colors group">
                        {/* Ref */}
                        <td className="px-4 py-3 font-bold text-indigo-600">{item.reference}</td>

                        {/* Designation */}
                        <td className="px-4 py-3">
                          <div className="font-black text-slate-900">{item.designation}</div>
                          {item.categorie && <div className="text-[10px] text-slate-400 font-semibold">{item.categorie}</div>}
                        </td>

                        {/* Depot */}
                        <td className="px-4 py-3">
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                            {item.depot_nom}
                          </span>
                        </td>

                        {/* Qty Input */}
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="number" 
                            min="1"
                            value={item.quantite}
                            onChange={e => handleUpdateItem(index, 'quantite', Number(e.target.value))}
                            className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-black text-indigo-600 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </td>

                        {/* Unit Price Input */}
                        <td className="px-4 py-3 text-right">
                          <input 
                            type="number" 
                            min="0"
                            value={item.prix_unitaire_ht}
                            onChange={e => handleUpdateItem(index, 'prix_unitaire_ht', Number(e.target.value))}
                            className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </td>

                        {/* Remise % */}
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={item.remise_percent}
                            onChange={e => handleUpdateItem(index, 'remise_percent', Number(e.target.value))}
                            className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </td>

                        {/* TVA % */}
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="number" 
                            min="0"
                            max="100"
                            value={item.tva_percent}
                            onChange={e => handleUpdateItem(index, 'tva_percent', Number(e.target.value))}
                            className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-center font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                          />
                        </td>

                        {/* Line Total */}
                        <td className="px-4 py-3 text-right font-black text-indigo-600 text-sm">
                          {new Intl.NumberFormat("fr-FR").format(item.montant_ligne)}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => handleRemoveLine(index)} 
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Supprimer l'article"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button 
                onClick={handleClearAll}
                disabled={items.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
              >
                <Trash2 size={14} /> Vider la liste
              </button>

              <span className="text-xs font-bold text-slate-600">
                <span className="text-indigo-600 font-black">{items.length}</span> articles sélectionnés
              </span>

              <button 
                onClick={() => setItems([...items])}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all border border-indigo-200"
              >
                <RotateCcw size={14} /> Mettre à jour les totaux
              </button>
            </div>
          </div>

          {/* 6. BOTTOM CARDS ROW: SUPPLIER INFO, HISTORY & TIMELINE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Supplier Info */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                <Building2 size={15} className="text-indigo-600" /> Informations fournisseur
              </h4>
              
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Téléphone:</span>
                  <span className="font-bold text-slate-900">{activeSupplier?.tel || activeSupplier?.contact || "Non renseigné"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Solde dû (Dette):</span>
                  <span className="font-black text-rose-600">{new Intl.NumberFormat("fr-FR").format(activeSupplier?.credit || 0)} {devise}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Dernier achat:</span>
                  <span className="font-bold text-slate-800">
                    {recentPurchases[0]?.date_achat ? new Date(recentPurchases[0].date_achat).toLocaleDateString("fr-FR") : "Aucun"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Note fournisseur:</span>
                  <div className="flex items-center text-amber-400 gap-0.5">
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Recent Purchases History */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Clock size={15} className="text-indigo-600" /> Historique des 5 derniers achats
                </h4>
                <button onClick={() => router.push("/dashboard/purchases")} className="text-[10px] font-bold text-indigo-600 hover:underline">
                  Voir tout
                </button>
              </div>

              <div className="space-y-2 text-[11px]">
                {recentPurchases.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 font-medium text-xs">
                    Aucun achat antérieur trouvé pour ce fournisseur
                  </div>
                ) : (
                  recentPurchases.map((purchase) => (
                    <div key={purchase.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
                      <div>
                        <div className="font-bold text-slate-800">
                          {new Date(purchase.date_achat).toLocaleDateString("fr-FR")}
                        </div>
                        <div className="text-[10px] text-slate-400">{purchase.numero_facture}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-slate-900">
                          {new Intl.NumberFormat("fr-FR").format(purchase.montant_total)} {devise}
                        </div>
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[9px] ${
                          purchase.statut === "Payée" ? "bg-emerald-50 text-emerald-600" :
                          purchase.statut === "Partiellement Payée" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                        }`}>
                          {purchase.statut}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Card 3: Purchase Process Timeline (SAP Style) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                <TrendingUp size={15} className="text-indigo-600" /> Étapes du processus d'achat
              </h4>

              <div className="pt-2 flex items-center justify-between relative">
                {/* Connecting Line */}
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200 -z-0"></div>

                {/* Step 1 */}
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md">
                    1
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600">Création</span>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center">
                    2
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">Validation</span>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center">
                    3
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">Réception</span>
                </div>

                {/* Step 4 */}
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center">
                    4
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">Paiement</span>
                </div>

                {/* Step 5 */}
                <div className="flex flex-col items-center gap-1 z-10">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-bold text-xs flex items-center justify-center">
                    5
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">Clôture</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN (1/3 WIDTH): FINANCIAL RECAP, PAYMENTS, STOCK */}
        {/* ========================================================= */}
        <div className="space-y-6">
          
          {/* 7. RÉCAPITULATIF FINANCIER LIVE */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Calculator size={18} className="text-indigo-600" /> Récapitulatif Financier
            </h3>

            <div className="space-y-3 text-xs">
              {/* Sous Total HT */}
              <div className="flex justify-between items-center text-slate-600 font-bold">
                <span>Sous-Total HT</span>
                <span className="text-slate-900 font-black">{new Intl.NumberFormat("fr-FR").format(totals.sousTotalHT)} {devise}</span>
              </div>

              {/* Remise globale */}
              <div className="flex justify-between items-center text-slate-600 font-bold">
                <span>Remise globale</span>
                <input 
                  type="number" 
                  value={remiseGlobale}
                  onChange={e => setRemiseGlobale(Number(e.target.value))}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1 text-right font-bold text-rose-600 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Total Remise */}
              <div className="flex justify-between items-center text-slate-500 font-medium">
                <span>Total Remise appliqué</span>
                <span className="text-rose-600 font-bold">-{new Intl.NumberFormat("fr-FR").format(totals.totalRemise)} {devise}</span>
              </div>

              {/* Net HT */}
              <div className="flex justify-between items-center text-slate-700 font-black pt-1 border-t border-slate-100">
                <span>Net HT</span>
                <span className="text-indigo-600">{new Intl.NumberFormat("fr-FR").format(totals.netHT)} {devise}</span>
              </div>

              {/* SECTION FRAIS LOGISTIQUE & DOUANE */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Frais d'approvisionnement & Logistique</div>

                {/* Frais de transport */}
                <div className="flex justify-between items-center text-slate-600 font-semibold">
                  <span>Frais de Transport</span>
                  <input 
                    type="number" 
                    value={transport}
                    onChange={e => setTransport(Number(e.target.value))}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1 text-right font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Commission */}
                <div className="flex justify-between items-center text-slate-600 font-semibold">
                  <span>Commission</span>
                  <input 
                    type="number" 
                    value={commission}
                    onChange={e => setCommission(Number(e.target.value))}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1 text-right font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Chargement & Déchargement */}
                <div className="flex justify-between items-center text-slate-600 font-semibold">
                  <span>Chargement & Déchargement</span>
                  <input 
                    type="number" 
                    value={chargementDechargement}
                    onChange={e => setChargementDechargement(Number(e.target.value))}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1 text-right font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Frais de Route */}
                <div className="flex justify-between items-center text-slate-600 font-semibold">
                  <span>Frais de Route</span>
                  <input 
                    type="number" 
                    value={fraisDeRoute}
                    onChange={e => setFraisDeRoute(Number(e.target.value))}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1 text-right font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Frais de Douane */}
                <div className="flex justify-between items-center text-slate-600 font-semibold">
                  <span>Frais de Douane</span>
                  <input 
                    type="number" 
                    value={fraisDeDouane}
                    onChange={e => setFraisDeDouane(Number(e.target.value))}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1 text-right font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Contrôle Douanier */}
                <div className="flex justify-between items-center text-slate-600 font-semibold">
                  <span>Contrôle Douanier</span>
                  <input 
                    type="number" 
                    value={controleDouanier}
                    onChange={e => setControleDouanier(Number(e.target.value))}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1 text-right font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Autres Frais */}
                <div className="flex justify-between items-center text-slate-600 font-semibold">
                  <span>Autres Frais</span>
                  <input 
                    type="number" 
                    value={autresFrais}
                    onChange={e => setAutresFrais(Number(e.target.value))}
                    className="w-24 bg-slate-50 border border-slate-200 rounded-lg p-1 text-right font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* SECTION TAXES & IMPÔTS */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Taxes & Impôts</div>

                {/* TVA */}
                <div className="flex justify-between items-center text-slate-600 font-bold">
                  <span>TVA ({tvaGlobalePercent}%)</span>
                  <span className="text-slate-900 font-black">{new Intl.NumberFormat("fr-FR").format(totals.tvaTotal)} {devise}</span>
                </div>

                {/* BIC (2%) */}
                <div className="flex justify-between items-center text-slate-600 font-bold">
                  <span className="flex items-center gap-1">
                    BIC (<input 
                      type="number" 
                      value={bicPercent}
                      onChange={e => setBicPercent(Number(e.target.value))}
                      className="w-10 bg-slate-50 border border-slate-200 rounded px-1 text-center font-bold text-slate-800"
                    />%)
                  </span>
                  <span className="text-slate-900 font-black">{new Intl.NumberFormat("fr-FR").format(totals.bicAmount)} {devise}</span>
                </div>
              </div>

              {/* BIG TOTAL TTC BOX */}
              <div className="pt-3 border-t border-slate-200">
                <div className="bg-indigo-50/80 rounded-2xl p-4 border border-indigo-100 flex items-center justify-between">
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">TOTAL TTC</span>
                  <span className="text-2xl font-black text-indigo-600">{new Intl.NumberFormat("fr-FR").format(totals.totalTTC)} {devise}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 8. PAIEMENTS CARD */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard size={18} className="text-indigo-600" /> Paiements
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-bold">Acompte versé:</span>
                <input 
                  type="number" 
                  value={acompte}
                  onChange={e => setAcompte(Number(e.target.value))}
                  className="w-32 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-right font-black text-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-slate-700 font-bold">Reste à payer:</span>
                <span className="text-base font-black text-rose-600">
                  {new Intl.NumberFormat("fr-FR").format(totals.resteDuaPayer)} {devise}
                </span>
              </div>

              <button 
                onClick={() => {
                  setNewPaymentAmount(totals.resteDuaPayer);
                  setIsPaymentModalOpen(true);
                }}
                className="w-full mt-2 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all border border-indigo-200 flex items-center justify-center gap-2"
              >
                <Plus size={14} /> Enregistrer un paiement
              </button>
            </div>
          </div>

          {/* 9. IMPACT SUR LE STOCK CARD */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Package size={18} className="text-emerald-600" /> Impact sur le stock
              </h3>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Check size={16} />
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Entrée prévue:</span>
                <span className="font-black text-emerald-600">+{stockImpact.entreePrevue} unités</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Valeur d'entrée:</span>
                <span className="font-bold text-slate-900">{new Intl.NumberFormat("fr-FR").format(stockImpact.valeurEntree)} FCFA</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="text-slate-700 font-bold">Stock après achat ({selectedDepot}):</span>
                <span className="font-black text-indigo-600">{stockImpact.stockApresAchat} unités</span>
              </div>
            </div>
          </div>

          {/* 11. DOCUMENTS JOINTS (DRAG & DROP) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <Paperclip size={18} className="text-indigo-600" /> Documents joints
            </h3>

            <div 
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer ${isDragging ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-indigo-300 bg-slate-50/50"}`}
            >
              <UploadCloud size={32} className="mx-auto mb-2 text-indigo-500" />
              <p className="text-xs font-bold text-slate-700">
                Glissez vos fichiers ici ou <span className="text-indigo-600 underline">cliquez pour parcourir</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Formats acceptés : PDF, JPG, PNG (Max 5MB)</p>
            </div>

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="space-y-2 pt-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={16} className="text-indigo-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-slate-400 font-semibold">{file.size}</span>
                      <button 
                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 13. FOOTER DASHBOARD STATISTICS BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Nombre Articles</div>
            <div className="text-lg font-black text-white">{totals.linesCount}</div>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Quantité Totale</div>
            <div className="text-lg font-black text-indigo-400">{totals.totalQuantite}</div>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Valeur HT</div>
            <div className="text-lg font-black text-white">{new Intl.NumberFormat("fr-FR").format(totals.sousTotalHT)} {devise}</div>
          </div>
          <div className="h-8 w-px bg-slate-800 hidden sm:block"></div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">TVA</div>
            <div className="text-lg font-black text-amber-400">{new Intl.NumberFormat("fr-FR").format(totals.tvaTotal)} {devise}</div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] uppercase font-bold text-slate-400">TOTAL FACTURE TTC</div>
          <div className="text-2xl font-black text-emerald-400">{new Intl.NumberFormat("fr-FR").format(totals.totalTTC)} {devise}</div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PAYMENT RECORD MODAL */}
      {/* ------------------------------------------------------------- */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <CreditCard size={20} className="text-indigo-600" /> Enregistrer un paiement
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Montant du règlement</label>
                <input 
                  type="number" 
                  value={newPaymentAmount}
                  onChange={e => setNewPaymentAmount(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-lg font-black text-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Mode de paiement</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800">
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Virement bancaire">Virement bancaire</option>
                  <option value="Mobile Money">Mobile Money</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Annuler
              </button>
              <button 
                onClick={() => {
                  setAcompte(prev => prev + newPaymentAmount);
                  setIsPaymentModalOpen(false);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-200"
              >
                Confirmer le règlement
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
