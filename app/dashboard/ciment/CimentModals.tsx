import React, { useState, useEffect } from "react";
import { X, Search, Plus, CreditCard, Trash2, Loader2, AlertCircle } from "lucide-react";
import type { CimentShipment } from "./page";

/* ═══════════════════════════════════════════════════════════════════
   CIMENT ENTRY MODAL
   ═══════════════════════════════════════════════════════════════════ */
export function CimentEntryModal({
  isOpen, onClose, shipment, onSuccess
}: {
  isOpen: boolean; onClose: () => void; shipment?: CimentShipment | null; onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CimentShipment>>({
    client_tel: "", camion_no: "", transporteur: "", type_ciment: "", destination: "",
    chauffeur: "", chauffeur_tel: "", bons: "", arrivage: "", tonnage: 0, pu: 0,
    frais_ciment: 0, frais_transport: 0, tva_pourcentage: 19, bic_pourcentage: 2
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stockSelectorOpen, setStockSelectorOpen] = useState(false);
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [totalCalculated, setTotalCalculated] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (shipment) {
        setFormData({ ...shipment });
      } else {
        setFormData({
          client_tel: "", camion_no: "", transporteur: "", type_ciment: "", destination: "",
          chauffeur: "", chauffeur_tel: "", bons: "", arrivage: "", tonnage: 0, pu: 0,
          frais_ciment: 0, frais_transport: 0, tva_pourcentage: 19, bic_pourcentage: 2
        });
      }
      setError(null);
    }
  }, [isOpen, shipment]);

  useEffect(() => {
    // Calculate Totals automatically
    const base = (Number(formData.tonnage) * Number(formData.pu)) + Number(formData.frais_ciment) + Number(formData.frais_transport);
    const tva = base * Number(formData.tva_pourcentage) / 100;
    const bic = base * Number(formData.bic_pourcentage) / 100;
    setTotalCalculated(base + tva + bic);
  }, [formData.tonnage, formData.pu, formData.frais_ciment, formData.frais_transport, formData.tva_pourcentage, formData.bic_pourcentage]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProductSelect = (product: any) => {
    setFormData(prev => ({
      ...prev,
      type_ciment: product.designation,
      destination: `${product.designation} [${product.depot_nom || 'Stock'}]`,
      pu: product.p_vente_ht
    }));
    setStockSelectorOpen(false);
  };

  const handleClientSelect = (client: any) => {
    setFormData(prev => ({
      ...prev,
      client_tel: client.nom + (client.tel ? ` / ${client.tel}` : "")
    }));
    setClientSelectorOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/ciment/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, id: shipment?.id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur d'enregistrement");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <span className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Plus size={24}/></span>
            {shipment ? "Modifier le Chargement" : "Nouveau Chargement"}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center gap-3 font-bold">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Sec 1: Client & Logistics */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-6 h-1 bg-blue-500 rounded-full"></span>
                  Client & Produit
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Téléphone/Nom Client *</label>
                    <div className="flex gap-2">
                      <input required type="text" name="client_tel" value={formData.client_tel || ""} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium" />
                      <button type="button" onClick={() => setClientSelectorOpen(true)} className="px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0">
                        <Search size={20} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Ciment / Destination *</label>
                    <div className="flex gap-2">
                      <input required readOnly type="text" name="destination" value={formData.destination || ""} className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-500" placeholder="Cliquez sur la loupe..." />
                      <button type="button" onClick={() => setStockSelectorOpen(true)} className="px-4 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors">
                        <Search size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-6 h-1 bg-amber-500 rounded-full"></span>
                  Logistique
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">N° Camion *</label>
                    <input required type="text" name="camion_no" value={formData.camion_no || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Transporteur</label>
                    <input type="text" name="transporteur" value={formData.transporteur || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Chauffeur</label>
                    <input type="text" name="chauffeur" value={formData.chauffeur || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tél Chauffeur</label>
                    <input type="text" name="chauffeur_tel" value={formData.chauffeur_tel || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>

            {/* Sec 2: Finances */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-6 h-1 bg-emerald-500 rounded-full"></span>
                  Tarification & Taxes
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tonnage (t) *</label>
                    <input required type="number" step="0.01" name="tonnage" value={formData.tonnage || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Prix Unitaire (HT) *</label>
                    <input required type="number" step="0.01" name="pu" value={formData.pu || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Frais Ciment</label>
                    <input type="number" step="0.01" name="frais_ciment" value={formData.frais_ciment || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Frais Transport</label>
                    <input type="number" step="0.01" name="frais_transport" value={formData.frais_transport || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">TVA (%)</label>
                    <input type="number" step="0.01" name="tva_pourcentage" value={formData.tva_pourcentage || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">BIC (%)</label>
                    <input type="number" step="0.01" name="bic_pourcentage" value={formData.bic_pourcentage || ""} onChange={handleChange} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-900 rounded-2xl text-white">
                <p className="text-sm text-slate-400 font-bold uppercase mb-1">Total TTC à Payer</p>
                <p className="text-4xl font-black text-emerald-400">{totalCalculated.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} <span className="text-lg">FCFA</span></p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-8 py-3 font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2">
              {saving && <Loader2 size={20} className="animate-spin" />}
              {saving ? "Enregistrement..." : "Confirmer"}
            </button>
          </div>
        </form>
      </div>

      {stockSelectorOpen && (
        <StockSelectorModal onClose={() => setStockSelectorOpen(false)} onSelect={handleProductSelect} />
      )}

      {clientSelectorOpen && (
        <ClientSelectorModal onClose={() => setClientSelectorOpen(false)} onSelect={handleClientSelect} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CLIENT SELECTOR MODAL
   ═══════════════════════════════════════════════════════════════════ */
export function ClientSelectorModal({ onClose, onSelect }: { onClose: () => void; onSelect: (client: any) => void }) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        if (Array.isArray(data)) setClients(data);
      } catch (err) {
        console.error("Error fetching clients:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  const filtered = clients.filter(c => 
    c.nom?.toLowerCase().includes(search.toLowerCase()) || 
    c.tel?.toLowerCase().includes(search.toLowerCase()) ||
    c.ref_client?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-black text-slate-800">Sélectionner un Client</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X size={24} /></button>
        </div>
        
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par nom, téléphone..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filtered.map(c => (
                <button 
                  key={c.id}
                  onClick={() => onSelect(c)}
                  className="flex justify-between items-center p-4 bg-white hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-2xl transition-all text-left group"
                >
                  <div>
                    <p className="font-bold text-slate-800 text-lg group-hover:text-blue-700">{c.nom}</p>
                    <p className="text-sm font-bold text-slate-400 mt-1">{c.tel || "Pas de téléphone"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Solde Débiteur</p>
                    <p className={`font-black text-sm mt-1 ${c.credit_facture > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {Number(c.credit_facture || 0).toLocaleString('fr-FR')} F
                    </p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-center p-8 text-slate-500 font-bold">Aucun client trouvé.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STOCK SELECTOR MODAL
   ═══════════════════════════════════════════════════════════════════ */
export function StockSelectorModal({ onClose, onSelect }: { onClose: () => void; onSelect: (product: any) => void }) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchCementStock = async () => {
      try {
        const res = await fetch("/api/articles");
        const data = await res.json();
        if (Array.isArray(data)) {
          setProducts(data);
        } else if (data && Array.isArray(data.items)) {
          setProducts(data.items);
        }
      } catch (err) {
        console.error("Error fetching stock:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCementStock();
  }, []);

  const filtered = products.filter(p => 
    p.designation?.toLowerCase().includes(search.toLowerCase()) || 
    p.reference?.toLowerCase().includes(search.toLowerCase()) ||
    (p.famille && p.famille.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-black text-slate-800">Sélectionner un Produit</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X size={24} /></button>
        </div>
        
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par nom, référence..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
             <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filtered.map(p => {
                const totalStock = p.stocks?.reduce((acc: number, s: any) => acc + Number(s.quantite || 0), 0) || 0;
                // Just use the first depot for simplified display
                const depot = p.stocks?.[0]?.depot_nom || 'Magasin';
                
                return (
                  <button 
                    key={p.id}
                    onClick={() => onSelect({ ...p, depot_nom: depot })}
                    className="flex justify-between items-center p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-2xl transition-all text-left"
                  >
                    <div>
                      <p className="font-bold text-slate-800 text-lg">{p.designation}</p>
                      <p className="text-xs font-bold text-slate-400 uppercase mt-1">Dépôt: {depot}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-600">{p.p_vente_ht} FCFA</p>
                      <p className="text-xs font-bold text-slate-500 mt-1">Stock: {totalStock}</p>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-center p-8 text-slate-500 font-bold">Aucun produit trouvé.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAYMENT MODAL
   ═══════════════════════════════════════════════════════════════════ */
export function CimentPaymentModal({
  isOpen, onClose, shipmentId, onSuccess
}: {
  isOpen: boolean; onClose: () => void; shipmentId: string; onSuccess: () => void;
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payForm, setPayForm] = useState({ montant: "", moyen: "Espèces", reference: "" });

  const fetchPayments = async () => {
    try {
      const res = await fetch(`/api/ciment/payments?shipmentId=${shipmentId}`);
      const data = await res.json();
      if (Array.isArray(data)) setPayments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && shipmentId) {
      setLoading(true);
      fetchPayments();
      setError(null);
      setPayForm({ montant: "", moyen: "Espèces", reference: "" });
    }
  }, [isOpen, shipmentId]);

  if (!isOpen) return null;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/ciment/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payForm, shipmentId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de paiement");

      setPayForm({ montant: "", moyen: "Espèces", reference: "" });
      fetchPayments();
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePay = async (id: string) => {
    if (!confirm("Supprimer ce paiement ? (Les avances clients seront remboursées le cas échéant)")) return;
    try {
      const res = await fetch(`/api/ciment/payments/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchPayments();
        onSuccess();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur");
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-900 text-white">
          <h2 className="text-xl font-black flex items-center gap-3">
            <CreditCard size={24} className="text-emerald-400" />
            Suivi des Règlements
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full transition-colors"><X size={24} /></button>
        </div>

        <div className="p-8 bg-slate-50">
          <form onSubmit={handlePay} className="flex flex-col md:flex-row gap-4">
            <input required type="number" placeholder="Montant (FCFA)" value={payForm.montant} onChange={(e) => setPayForm({...payForm, montant: e.target.value})} className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold" />
            <select value={payForm.moyen} onChange={(e) => setPayForm({...payForm, moyen: e.target.value})} className="px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none">
              <option>Espèces</option>
              <option>Chèque</option>
              <option>Virement</option>
              <option>Avance Client</option>
            </select>
            <input type="text" placeholder="Référence..." value={payForm.reference} onChange={(e) => setPayForm({...payForm, reference: e.target.value})} className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium" />
            
            <button type="submit" disabled={saving} className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-all flex items-center gap-2">
              {saving ? <Loader2 className="animate-spin w-5 h-5" /> : "Payer"}
            </button>
          </form>

          {error && <div className="mt-4 p-4 bg-rose-50 text-rose-600 font-bold rounded-xl border border-rose-200 text-sm">{error}</div>}
          
          {payForm.moyen === "Avance Client" && (
            <p className="mt-4 text-sm font-bold text-blue-600 bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-2">
              <AlertCircle size={18} />
              Le solde disponible de l'avance client sera vérifié et déduit automatiquement.
            </p>
          )}
        </div>

        <div className="p-8">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Historique des Paiements</h3>
          {loading ? (
             <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold">Date</th>
                    <th className="p-4 font-bold">Montant</th>
                    <th className="p-4 font-bold">Moyen</th>
                    <th className="p-4 font-bold">Réf</th>
                    <th className="p-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {payments.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Aucun paiement.</td></tr>}
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td className="p-4 text-slate-600">{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</td>
                      <td className="p-4 font-black text-emerald-600">{Number(p.montant).toLocaleString('fr-FR')} F</td>
                      <td className="p-4"><span className="px-3 py-1 bg-slate-100 rounded-lg text-slate-600 font-bold text-xs">{p.moyen_paiement}</span></td>
                      <td className="p-4 text-slate-500">{p.reference || '-'}</td>
                      <td className="p-4 text-right">
                        <button onClick={() => handleDeletePay(p.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
