import { create } from 'zustand'

export type Article = {
  id: number;
  reference: string;
  designation: string;
  p_vente_ttc: number;
}

export type CartItem = Article & {
  quantite: number;
}

interface CartStore {
  cart: CartItem[];
  addItem: (article: Article) => void;
  removeItem: (id: number) => void;
  updateQuantity: (id: number, quantite: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  cart:[],
  
  addItem: (article) => {
    const currentCart = get().cart;
    const existingItem = currentCart.find(item => item.id === article.id);
    if (existingItem) {
      set({ cart: currentCart.map(item => item.id === article.id ? { ...item, quantite: item.quantite + 1 } : item) });
    } else {
      set({ cart:[...currentCart, { ...article, quantite: 1 }] });
    }
  },
  
  removeItem: (id) => set((state) => ({ cart: state.cart.filter(item => item.id !== id) })),
  
  updateQuantity: (id, quantite) => set((state) => ({
    cart: state.cart.map(item => item.id === id ? { ...item, quantite: Math.max(1, quantite) } : item)
  })),
  
  clearCart: () => set({ cart:[] }),
  
  total: () => get().cart.reduce((sum, item) => sum + ((item.p_vente_ttc || 0) * item.quantite), 0)
}))