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
  Tag
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

type Product = {
  id: number;
  reference: string;
  designation: string;
  famille?: string;
  p_vente_ttc: number;
  prix_gros?: number;
  prix_special?: number;
  image_path?: string;
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
};

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

  // Cart Drawer
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout Info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

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
        p.reference.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, search]);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
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

  const totalCartAmount = cart.reduce(
    (sum, item) => sum + item.quantity * Number(item.product.p_vente_ttc || 0),
    0
  );

  const totalCartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleShareLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }
  };

  const handleSendWhatsAppOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) {
      alert("Veuillez renseigner votre nom et votre numéro de téléphone.");
      return;
    }
    if (cart.length === 0) {
      alert("Votre panier est vide.");
      return;
    }

    const itemsText = cart
      .map(
        (it, idx) =>
          `${idx + 1}. *${it.product.designation}*\n   ↳ Quantité: *${it.quantity}* | Prix unitaire: ${Number(it.product.p_vente_ttc).toLocaleString()} F | Total: *${(it.quantity * Number(it.product.p_vente_ttc)).toLocaleString()} F CFA*`
      )
      .join("\n\n");

    const message =
      `🛍️ *NOUVELLE COMMANDE EN LIGNE - ${company.nom_entreprise.toUpperCase()}*\n\n` +
      `👤 *Client :* ${customerName}\n` +
      `📱 *Téléphone :* ${customerPhone}\n` +
      (deliveryAddress ? `📍 *Adresse / Ville :* ${deliveryAddress}\n` : "") +
      (orderNotes ? `📝 *Notes :* ${orderNotes}\n` : "") +
      `\n🛒 *DÉTAIL DES ARTICLES :*\n\n${itemsText}\n\n` +
      `💰 *MONTANT TOTAL COMMANDE :* *${totalCartAmount.toLocaleString()} F CFA*\n\n` +
      `Merci de confirmer la disponibilité et les modalités de livraison/paiement !`;

    openWhatsAppDirect(company.telephone || "", message);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
              <Store size={22} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                {company.nom_entreprise}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Catalogue Officiel & Commandes Directes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleShareLink}
              className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Partager le catalogue"
            >
              <Share2 size={15} />
              <span className="hidden sm:inline">
                {linkCopied ? "Lien copié !" : "Partager"}
              </span>
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag size={18} />
              <span className="hidden sm:inline">Mon Panier</span>
              {totalCartItemsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  {totalCartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white py-12 sm:py-16 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-4 relative z-10">
          <span className="px-3.5 py-1.5 rounded-full bg-white/10 text-emerald-300 text-xs font-bold border border-white/15 inline-flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-400" />
            Stock Synchronisé en Temps Réel
          </span>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Découvrez nos produits & commandez en direct
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
            Sélectionnez vos articles préférés et transmettez votre commande en 1 clic sur WhatsApp pour un traitement et une livraison express.
          </p>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto pt-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Rechercher un article, une référence..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 text-xs sm:text-sm font-bold shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/30"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. Category Pills */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("ALL")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCategory === "ALL"
                ? "bg-slate-900 text-white shadow-md font-black"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
            }`}
          >
            Tous les articles ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-md font-black"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Products Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {loading ? (
          <div className="py-24 text-center text-slate-400 font-bold text-sm">
            Chargement du catalogue en cours...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 text-center space-y-2">
            <Package size={48} className="mx-auto text-slate-300" />
            <p className="font-black text-slate-700 text-base">Aucun article trouvé</p>
            <p className="text-xs text-slate-500">
              Essayez un autre mot-clé ou sélectionnez une autre catégorie.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const inCartItem = cart.find((it) => it.product.id === product.id);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between group"
                >
                  {/* Top Image or Gradient Box */}
                  <div className="relative h-44 bg-gradient-to-tr from-slate-100 to-indigo-50/50 flex items-center justify-center p-4 overflow-hidden">
                    {product.image_path ? (
                      <img
                        src={product.image_path}
                        alt={product.designation}
                        className="h-full w-full object-contain group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Package size={32} />
                      </div>
                    )}

                    {/* Stock status badge */}
                    <div className="absolute top-3 left-3">
                      {product.is_in_stock ? (
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/15 text-emerald-700 border border-emerald-500/20 backdrop-blur-md">
                          En stock
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/15 text-amber-700 border border-amber-500/20 backdrop-blur-md">
                          Sur commande
                        </span>
                      )}
                    </div>

                    {product.famille && (
                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-white/80 text-slate-600 border border-slate-200 backdrop-blur-md">
                          {product.famille}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block">
                        {product.reference}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 line-clamp-2 mt-0.5">
                        {product.designation}
                      </h3>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 block">
                            Prix Unitaire :
                          </span>
                          <span className="text-base font-black font-mono text-slate-900">
                            {formatCurrencyAmount(product.p_vente_ttc, "FCFA")}
                          </span>
                        </div>

                        {product.prix_gros && Number(product.prix_gros) > 0 && (
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-purple-600 block">
                              Tarif Gros :
                            </span>
                            <span className="text-xs font-black font-mono text-purple-700">
                              {formatCurrencyAmount(product.prix_gros, "FCFA")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Add to Cart Actions */}
                      {inCartItem ? (
                        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-2xl p-1">
                          <button
                            onClick={() => updateQuantity(product.id, -1)}
                            className="p-1.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-mono font-black text-xs text-indigo-900 px-2">
                            {inCartItem.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, 1)}
                            className="p-1.5 rounded-xl bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                          <Plus size={15} />
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

      {/* 5. Slide-Out Shopping Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-600 text-white">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Votre Panier</h3>
                  <p className="text-[11px] text-slate-500">{totalCartItemsCount} article(s)</p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 p-5 overflow-y-auto divide-y divide-slate-100 space-y-3">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-2 text-slate-400">
                  <ShoppingBag size={40} className="mx-auto text-slate-300" />
                  <p className="font-bold text-xs">Votre panier est vide</p>
                  <p className="text-[11px]">Parcourez le catalogue pour ajouter des articles.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="pt-3 first:pt-0 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Package size={20} className="text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {item.product.designation}
                      </h4>
                      <p className="text-[10px] font-mono font-bold text-slate-500">
                        {formatCurrencyAmount(item.product.p_vente_ttc, "FCFA")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-slate-200 rounded-xl">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-900"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="font-mono text-xs font-black px-1.5">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="px-2 py-1 text-slate-500 hover:text-slate-900"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-300 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Customer Details & WhatsApp Checkout */}
            {cart.length > 0 && (
              <form
                onSubmit={handleSendWhatsAppOrder}
                className="p-5 border-t border-slate-200 bg-slate-50 space-y-4"
              >
                {/* Total */}
                <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600">Total Commande :</span>
                  <span className="text-lg font-black font-mono text-indigo-700">
                    {formatCurrencyAmount(totalCartAmount, "FCFA")}
                  </span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    required
                    placeholder="Votre Nom Complet *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Votre Téléphone / WhatsApp *"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Ville / Adresse de livraison (Optionnel)"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <MessageCircle size={18} />
                  <span>Envoyer la commande via WhatsApp (1-Clic)</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
