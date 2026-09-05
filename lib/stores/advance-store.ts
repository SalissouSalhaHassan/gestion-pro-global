import { create } from 'zustand';
import { Advance } from '../services/advance.service';

interface AdvanceState {
  advances: Advance[];
  isLoading: boolean;
  error: string | null;
  fetchAdvances: () => Promise<void>;
  addAdvance: (advance: Omit<Advance, 'id' | 'statut' | 'montant_restant'>) => Promise<void>;
  withdraw: (id: number, amount: number, notes?: string, username?: string) => Promise<void>;
  updateAdvance: (id: number, data: Partial<Advance>) => Promise<void>;
  cancelAdvance: (id: number) => Promise<void>;
}

export const useAdvanceStore = create<AdvanceState>((set, get) => ({
  advances: [],
  isLoading: false,
  error: null,

  fetchAdvances: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/advances');
      if (!res.ok) throw new Error('Failed to fetch advances');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.advances) ? data.advances : []);
      set({ advances: list, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addAdvance: async (advance) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advance),
      });
      if (!res.ok) throw new Error('Failed to create advance');
      const newAdvance = await res.json();
      set((state) => ({
        advances: [newAdvance, ...state.advances],
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  withdraw: async (id, amount, notes, username) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/advances/${id}/withdraw`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, notes, username }),
      });
      if (!res.ok) throw new Error('Failed to withdraw');
      const updatedAdvance = await res.json();
      set((state) => ({
        advances: state.advances.map(a => a.id === id ? updatedAdvance : a),
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateAdvance: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/advances/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update advance');
      const updatedAdvance = await res.json();
      set((state) => ({
        advances: state.advances.map(a => a.id === id ? { ...a, ...updatedAdvance } : a),
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  cancelAdvance: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`/api/advances/${id}/cancel`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('Failed to cancel advance');
      const updatedAdvance = await res.json();
      set((state) => ({
        advances: state.advances.map(a => a.id === id ? { ...a, ...updatedAdvance } : a),
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));
