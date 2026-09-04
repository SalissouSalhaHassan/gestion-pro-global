"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShoppingBag,
  Search,
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Trash2,
  X,
  Share2,
  Sparkles,
  Layers,
  ArrowRight,
  Package,
  Building2,
  Store,
  Tag,
  ShieldCheck,
  Truck,
  Eye,
  SlidersHorizontal,
  Coins,
  Copy,
  ExternalLink,
  ChevronRight,
  Clock,
  Check
} from "lucide-react";
import { formatCurrencyAmount, convertCurrency, SUPPORTED_CURRENCIES } from "@/lib/utils/currency";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

type Product = {
  id: number;
  reference: string;
  designation: string;
  famille?: string;
  p_vente_ttc: number;
  prix_gros?: number | null;
  prix_special?: number | null;
  image_path?: string | null;
  code_barre?: string | null;
  article_par_colis?: number | null;
  stock_total: number;
  is_in_stock: boolean;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type CompanyInfo = {
  nom_entreprise: string;
  telephone: string;
  adresse: string;
  email?: string;
  logo_url?: string;
};

const CATEGORY_GRADIENTS = [
  "from-blue-600 via-indigo-600 to-violet-700",
  "from-emerald-600 via-teal-600 to-cyan-700",
  "from-amber-500 via-orange-600 to-rose-600",
  "from-fuchsia-600 via-purple-600 to-indigo-700",
  "from-slate-700 via-slate-800 to-zinc-900",
  "from-rose-600 via-pink-600 to-purple-700",
];

export default function PublicCatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [company, setCompany] = useState<CompanyInfo>({
    nom_entreprise: "Gestion Pro Global",
    telephone: "+227 00 00 00 00",
    adresse: "Niamey, Niger",
  });
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [filterInStockOnly, setFilterInStockOnly] = useState(false);
  const [filterWholesaleOnly, setFilterWholesaleOnly] = useState(false);

  // Currency conversion
  const [selectedCurrency, setSelectedCurrency] = useState<string>("FCFA");

  // Cart Drawer & Quick View
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Checkout Info (persisted in localStorage for repeated orders)
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  // Load saved client profile from localStorage
  useEffect(() => {
    try {
      const savedName = localStorage.getItem("gp_catalog_customer_name");
      const savedPhone = localStorage.getItem("gp_catalog_customer_phone");
      const savedAddress = localStorage.getItem("gp_catalog_customer_address");
      if (savedName) setCustomerName(savedName);
      if (savedPhone) setCustomerPhone(savedPhone);
      if (savedAddress) setDeliveryAddress(savedAddress);
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/catalog");
        const data = await res.json();
        setProducts(data.products || []);
        setCategories(data.categories || []);
        if (data.company) setCompany(data.company);
      } catch (e) {
        console.error("Failed to load public catalog", e);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === "ALL" || p.famille === selectedCategory;
      const matchSearch =
        !search ||
        p.designation.toLowerCase().includes(search.toLowerCase()) ||
        p.reference.toLowerCase().includes(search.toLowerCase()) ||
        (p.code_barre && p.code_barre.toLowerCase().includes(search.toLowerCase()));
      const matchStock = !filterInStockOnly || p.is_in_stock;
      const matchWholesale = !filterWholesaleOnly || (p.prix_gros && Number(p.prix_gros) > 0);
      return matchCat && matchSearch && matchStock && matchWholesale;
    });
  }, [products, selectedCategory, search, filterInStockOnly, filterWholesaleOnly]);

  // Cart operations
  const addToCart = (product: Product, qty: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalCartAmountFCFA = cart.reduce(
    (sum, item) => sum + item.quantity * Number(item.product.p_vente_ttc || 0),
    0
  );

  const totalCartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const displayPrice = (amountFCFA: number) => {
    if (selectedCurrency === "FCFA") {
      return formatCurrencyAmount(amountFCFA, "FCFA");
    }
    const converted = convertCurrency(amountFCFA, "FCFA", selectedCurrency);
    return formatCurrencyAmount(converted, selectedCurrency);
  };

  const handleShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }
  };

  const handleSendWhatsAppOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      alert("Veuillez renseigner votre nom et votre numéro de téléphone.");
      return;
    }
    if (cart.length === 0) {
      alert("Votre panier est vide.");
      return;
    }

    // Persist for next orders
    try {
      localStorage.setItem("gp_catalog_customer_name", customerName);
      localStorage.setItem("gp_catalog_customer_phone", customerPhone);
      localStorage.setItem("gp_catalog_customer_address", deliveryAddress);
    } catch (e) {}

    const itemsText = cart
      .map((it, idx) => {
        const unitPriceStr = Number(it.product.p_vente_ttc).toLocaleString("fr-FR");
        const lineTotalStr = (it.quantity * Number(it.product.p_vente_ttc)).toLocaleString("fr-FR");
        return `${idx + 1}. *${it.product.designation}* (Réf: ${it.product.reference})\n   ↳ Qté : *${it.quantity}* × ${unitPriceStr} F = *${lineTotalStr} FCFA*`;
      })
      .join("\n\n");

    const message =
      `🛍️ *NOUVELLE COMMANDE EN LIGNE - ${company.nom_entreprise.toUpperCase()}*\n\n` +
      `👤 *Client :* ${customerName}\n` +
      `📱 *Téléphone :* ${customerPhone}\n` +
      (deliveryAddress ? `📍 *Adresse de livraison :* ${deliveryAddress}\n` : "") +
      (orderNotes ? `📝 *Notes particulières :* ${orderNotes}\n` : "") +
      `\n📋 *ARTICLES COMMANDÉS :*\n\n${itemsText}\n\n` +
      `💰 *TOTAL À RÉGLER :* *${totalCartAmountFCFA.toLocaleString("fr-FR")} FCFA*\n\n` +
      `⚡ Prière de confirmer la réception de ma commande et le délai de livraison. Merci !`;

    openWhatsAppDirect(company.telephone || "", message);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* 1. Header Bar - Glassmorphism Luxury Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-2xl border-b border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 border border-white/20">
              <Store size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {company.nom_entreprise}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Vérifié
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                <span>Catalogue Officiel & B2B/B2C</span>
                {company.adresse && <span>• {company.adresse}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Currency Selector */}
            <div className="relative hidden md:flex items-center">
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-bold text-slate-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
              >
                <option value="FCFA" className="bg-slate-900 text-white">FCFA (XOF)</option>
                <option value="NGN" className="bg-slate-900 text-white">NGN (₦)</option>
                <option value="EUR" className="bg-slate-900 text-white">EUR (€)</option>
                <option value="USD" className="bg-slate-900 text-white">USD ($)</option>
              </select>
              <Coins size={14} className="absolute right-2.5 pointer-events-none text-slate-400" />
            </div>

            {/* Direct WhatsApp Pill */}
            {company.telephone && (
              <button
                onClick={() => openWhatsAppDirect(company.telephone, `Bonjour ${company.nom_entreprise}, je consulte votre catalogue et j'aimerais avoir des informations.`)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all cursor-pointer"
                title="Contacter sur WhatsApp"
              >
                <MessageCircle size={15} />
                <span>Assistance Directe</span>
              </button>
            )}

            {/* Share Link Button */}
            <button
              onClick={handleShareLink}
              className="p-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Partager le lien du catalogue"
            >
              {linkCopied ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
              <span className="hidden sm:inline">
                {linkCopied ? "Lien copié !" : "Partager"}
              </span>
            </button>

            {/* Cart Trigger Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer border border-white/15 active:scale-95"
            >
              <ShoppingBag size={18} />
              <span className="hidden sm:inline">Panier</span>
              {totalCartItemsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse">
                  {totalCartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section - Ultra-Modern Mesh Background */}
      <section className="relative overflow-hidden pt-12 pb-16 px-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-white/5">
        {/* Ambient Glowing Orbs */}
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-5 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/15 text-indigo-300 text-xs font-bold backdrop-blur-xl shadow-inner">
            <Sparkles size={14} className="text-amber-400 animate-spin" />
            <span>Catalogue Direct Grossiste & Détail • Synchronisé en Direct</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            Commandez vos produits en direct au{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              Meilleur Tarif
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-medium">
            Explorez notre stock certifié en temps réel, bénéficiez de tarifs dégressifs pour commerçants et passez commande en 1 clic via WhatsApp.
          </p>

          {/* Luxury Search Engine Bar */}
          <div className="max-w-2xl mx-auto pt-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-md opacity-25 group-hover:opacity-60 transition duration-300"></div>
              <div className="relative flex items-center bg-slate-900/90 rounded-2xl border border-white/20 p-1.5 shadow-2xl backdrop-blur-xl">
                <Search size={20} className="ml-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par article, référence, désignation, code-barres..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-3 bg-transparent text-white placeholder:text-slate-400 text-sm font-semibold focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Filter Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-semibold">
              <button
                onClick={() => setFilterInStockOnly(!filterInStockOnly)}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  filterInStockOnly
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                ✓ En Stock Immédiat
              </button>
              <button
                onClick={() => setFilterWholesaleOnly(!filterWholesaleOnly)}
                className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  filterWholesaleOnly
                    ? "bg-purple-500/20 border-purple-500/60 text-purple-300 shadow-sm"
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                🏷️ Tarif Gros Disponible
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Value Proposition / Trust Pillars Bar */}
      <div className="border-b border-white/5 bg-slate-900/40 py-4 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-3 p-2 text-slate-300">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Truck size={18} />
            </div>
            <div>
              <span className="font-bold block text-white">Livraison Express</span>
              <span className="text-[11px] text-slate-400">Expédition rapide sécurisée</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 text-slate-300">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <ShieldCheck size={18} />
            </div>
            <div>
              <span className="font-bold block text-white">Produits Certifiés</span>
              <span className="text-[11px] text-slate-400">Garantie d'authenticité</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 text-slate-300">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
              <Tag size={18} />
            </div>
            <div>
              <span className="font-bold block text-white">Tarifs Dégressifs</span>
              <span className="text-[11px] text-slate-400">Prix de gros sur volume</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 text-slate-300">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <MessageCircle size={18} />
            </div>
            <div>
              <span className="font-bold block text-white">WhatsApp Direct</span>
              <span className="text-[11px] text-slate-400">Devis & commande instantanée</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Category Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
              selectedCategory === "ALL"
                ? "bg-white text-slate-950 shadow-lg shadow-white/10 font-black"
                : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10"
            }`}
          >
            <Layers size={14} />
            <span>Tous les articles ({products.length})</span>
          </button>
          {categories.map((cat) => {
            const countInCat = products.filter((p) => p.famille === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedCategory === cat
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-black border border-indigo-400"
                    : "bg-slate-900 text-slate-300 hover:bg-slate-800 border border-white/10"
                }`}
              >
                <span>{cat}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/10">
                  {countInCat}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Products Grid Showcase */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        {loading ? (
          <div className="py-28 text-center text-slate-400 font-bold text-sm flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Chargement du catalogue en temps réel...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-28 text-center space-y-3 bg-slate-900/50 rounded-3xl border border-white/10 p-8 max-w-md mx-auto">
            <Package size={52} className="mx-auto text-slate-500" />
            <p className="font-black text-white text-lg">Aucun article trouvé</p>
            <p className="text-xs text-slate-400">
              Essayez de modifier votre recherche ou réinitialisez les filtres.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setSelectedCategory("ALL");
                setFilterInStockOnly(false);
                setFilterWholesaleOnly(false);
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, idx) => {
              const inCartItem = cart.find((it) => it.product.id === product.id);
              const gradientBg = CATEGORY_GRADIENTS[idx % CATEGORY_GRADIENTS.length];
              const hasWholesale = product.prix_gros && Number(product.prix_gros) > 0 && Number(product.prix_gros) < Number(product.p_vente_ttc);
              const wholesaleDiscount = hasWholesale
                ? Math.round(((Number(product.p_vente_ttc) - Number(product.prix_gros)) / Number(product.p_vente_ttc)) * 100)
                : 0;

              return (
                <div
                  key={product.id}
                  className="bg-slate-900 rounded-[28px] border border-white/10 overflow-hidden shadow-xl hover:shadow-2xl hover:border-indigo-500/50 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between group relative"
                >
                  {/* Top Media Showcase */}
                  <div
                    onClick={() => setQuickViewProduct(product)}
                    className="relative h-48 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950/40 flex items-center justify-center p-4 overflow-hidden cursor-pointer border-b border-white/5"
                  >
                    {/* Background Decorative Mesh */}
                    <div className="absolute inset-0 bg-radial from-white/5 to-transparent pointer-events-none opacity-50" />

                    {product.image_path ? (
                      <img
                        src={product.image_path}
                        alt={product.designation}
                        className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-2xl"
                      />
                    ) : (
                      <div className={`w-20 h-20 rounded-3xl bg-gradient-to-tr ${gradientBg} text-white flex flex-col items-center justify-center shadow-2xl shadow-indigo-900/50 group-hover:scale-110 transition-transform duration-500 border border-white/20`}>
                        <Package size={34} className="drop-shadow" />
                        <span className="text-[9px] font-black tracking-wider uppercase opacity-90 mt-1">
                          {product.famille ? product.famille.slice(0, 3) : "PRO"}
                        </span>
                      </div>
                    )}

                    {/* Stock Status Pill */}
                    <div className="absolute top-3.5 left-3.5">
                      {product.is_in_stock ? (
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 backdrop-blur-md flex items-center gap-1 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          En stock
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md">
                          Sur commande
                        </span>
                      )}
                    </div>

                    {/* Quick View Button on Hover */}
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="px-3.5 py-1.5 rounded-xl bg-white text-slate-950 text-xs font-black shadow-xl flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                        <Eye size={14} />
                        <span>Aperçu rapide</span>
                      </span>
                    </div>

                    {/* Category or Packaging badge */}
                    {product.famille && (
                      <div className="absolute top-3.5 right-3.5">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-slate-950/70 text-slate-300 border border-white/10 backdrop-blur-md">
                          {product.famille}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                          {product.reference}
                        </span>
                        {product.article_par_colis && Number(product.article_par_colis) > 1 && (
                          <span className="text-[10px] text-slate-400">
                            Colis de {product.article_par_colis}
                          </span>
                        )}
                      </div>

                      <h3
                        onClick={() => setQuickViewProduct(product)}
                        className="font-bold text-sm text-white line-clamp-2 hover:text-indigo-300 transition-colors cursor-pointer"
                        title={product.designation}
                      >
                        {product.designation}
                      </h3>
                    </div>

                    {/* Pricing Block */}
                    <div className="space-y-3 pt-1 border-t border-white/5">
                      <div className="flex items-baseline justify-between pt-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                            Prix Unitaire :
                          </span>
                          <span className="text-lg font-black font-mono text-white">
                            {displayPrice(product.p_vente_ttc)}
                          </span>
                        </div>

                        {hasWholesale && (
                          <div className="text-right">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-black border border-purple-500/30">
                              -{wholesaleDiscount}% Gros
                            </span>
                            <span className="text-xs font-black font-mono text-purple-400 block mt-0.5">
                              {displayPrice(product.prix_gros!)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Interactive Add to Cart or Stepper */}
                      {inCartItem ? (
                        <div className="flex items-center justify-between bg-indigo-950/60 border border-indigo-500/40 rounded-2xl p-1">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="w-9 h-9 rounded-xl bg-slate-900 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            <Minus size={15} />
                          </button>
                          <div className="text-center">
                            <span className="font-mono font-black text-sm text-white px-2">
                              {inCartItem.quantity}
                            </span>
                            <span className="block text-[9px] text-slate-400 uppercase font-bold">
                              au panier
                            </span>
                          </div>
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="w-9 h-9 rounded-xl bg-slate-900 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20 border border-white/10 active:scale-98"
                        >
                          <Plus size={16} />
                          <span>Ajouter au panier</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 6. Quick View Product Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-slate-900 rounded-[32px] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase">
                  {quickViewProduct.reference}
                </span>
                {quickViewProduct.famille && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 text-slate-300">
                    {quickViewProduct.famille}
                  </span>
                )}
              </div>
              <button
                onClick={() => setQuickViewProduct(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <div className="w-full sm:w-48 h-48 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-center p-4 shrink-0">
                  {quickViewProduct.image_path ? (
                    <img
                      src={quickViewProduct.image_path}
                      alt={quickViewProduct.designation}
                      className="max-h-full max-w-full object-contain drop-shadow"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                      <Package size={40} />
                    </div>
                  )}
                </div>

                <div className="space-y-3 flex-1">
                  <h3 className="text-xl font-bold text-white">
                    {quickViewProduct.designation}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-slate-400 block mb-0.5">Prix Détail TTC</span>
                      <span className="text-base font-black text-white font-mono">
                        {displayPrice(quickViewProduct.p_vente_ttc)}
                      </span>
                    </div>

                    {quickViewProduct.prix_gros && Number(quickViewProduct.prix_gros) > 0 && (
                      <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                        <span className="text-purple-300 block mb-0.5">Tarif Grossiste</span>
                        <span className="text-base font-black text-purple-400 font-mono">
                          {displayPrice(quickViewProduct.prix_gros)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                    {quickViewProduct.code_barre && (
                      <span>Code-barres : <strong className="font-mono text-white">{quickViewProduct.code_barre}</strong></span>
                    )}
                    {quickViewProduct.article_par_colis && (
                      <span>Conditionnement : <strong className="text-white">{quickViewProduct.article_par_colis} unités / colis</strong></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button inside modal */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  onClick={() => setQuickViewProduct(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    addToCart(quickViewProduct, 1);
                    setQuickViewProduct(null);
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Ajouter au Panier</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Slide-Out Shopping Cart Drawer 4K */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border-l border-white/15 h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-slideLeft">
            {/* Drawer Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Votre Panier Direct</h3>
                  <p className="text-[11px] text-slate-400">{totalCartItemsCount} article(s) sélectionnés</p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <ShoppingBag size={48} className="mx-auto text-slate-600" />
                  <p className="font-bold text-slate-300 text-sm">Votre panier est encore vide</p>
                  <p className="text-xs text-slate-500">
                    Parcourez les articles et cliquez sur "Ajouter au panier".
                  </p>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer mt-2"
                  >
                    Retour aux produits
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 p-1">
                          {item.product.image_path ? (
                            <img
                              src={item.product.image_path}
                              alt={item.product.designation}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <Package size={20} className="text-indigo-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-white truncate">
                            {item.product.designation}
                          </h4>
                          <span className="text-[11px] font-mono text-indigo-300 font-bold block">
                            {displayPrice(item.product.p_vente_ttc)}
                          </span>
                        </div>
                      </div>

                      {/* Stepper & Delete */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="text-xs font-mono font-bold text-white px-2">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Footer & Checkout Form */}
            {cart.length > 0 && (
              <div className="p-5 border-t border-white/10 bg-slate-950/80 space-y-4">
                {/* Total Summary */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Nombre d'articles :</span>
                    <span className="font-bold text-white">{totalCartItemsCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-1 border-t border-white/5">
                    <span className="font-bold text-slate-300">Total Commande :</span>
                    <span className="font-black text-xl text-white font-mono">
                      {displayPrice(totalCartAmountFCFA)}
                    </span>
                  </div>
                </div>

                {/* Direct WhatsApp Checkout Form */}
                <form onSubmit={handleSendWhatsAppOrder} className="space-y-2.5 pt-2">
                  <input
                    type="text"
                    required
                    placeholder="Votre nom complet *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <input
                    type="tel"
                    required
                    placeholder="Votre numéro de téléphone (WhatsApp) *"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <input
                    type="text"
                    placeholder="Adresse / Quartier de livraison (Optionnel)"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 mt-2"
                  >
                    <MessageCircle size={18} />
                    <span>Envoyer ma commande sur WhatsApp</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Footer */}
      <footer className="border-t border-white/10 bg-slate-950 py-10 px-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-bold text-slate-300 block">{company.nom_entreprise}</span>
            <span>Système de vente et distribution officiel • Tous droits réservés 2026</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-400 border border-white/10">
              Propulsé par GestionPro Global Enterprise
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
