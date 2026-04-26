"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Wallet, 
  History, 
  Plus, 
  Trash2, 
  Save, 
  Calendar, 
  User, 
  FileText, 
  Loader2, 
  CheckCircle2,
  DollarSign,
  CreditCard,
  AlertCircle
} from "lucide-react";

type Payment = {
  id: number;
  date_operation: string;
  montant_regle: number;
  moyen_reglement: string;
  reference_paiement: string;
};

type Purchase = {
  id: number;
  numero_facture: string;
  date_achat: string;
  fournisseur_nom: string;
  montant_total: number;
  montant_paye: number;
  statut: string;
  paiements: Payment[];
};

export default function PurchasePaymentsPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState("Espèces");
  const [reference, setReference] = useState("");

  useEffect(() => {
    fetchPurchase();
  }, [params.id]);

  const fetchPurchase = async () => {
    try {
      const res = await fetch(`/api/purchases/${params.id}`);
      const data = await res.json();
      setPurchase(data);
      setAmount(data.montant_total - data.montant_paye);
    } catch (error) {
      console.error("Failed to fetch purchase", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/purchases/${params.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method, reference }),
      });

      if (!res.ok) throw new Error("Failed to add payment");

      setAmount(0);
      setReference("");
      fetchPurchase();
    } catch (error) {
      console.error(error);
      alert("Erreur lors de l'enregistrement du paiement.");
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

  if (!purchase) return <div className="text-center py-20 font-black text-slate-400 text-2xl">Achat introuvable.</div>;

  const due = purchase.montant_total - purchase.montant_paye;

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 transition-all font-black text-sm uppercase tracking-widest mb-4">
            <ArrowLeft size={16} /> Retour
          </button>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 flex items-center gap-4">
            <div className="p-3 bg-white/50 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
              <Wallet className="text-indigo-600" size={32} />
            </div>
            Règlements Achat
          </h1>
          <p className="mt-2 text-slate-500 font-medium ml-1">
            Gérez les paiements pour la facture <span className="text-indigo-600 font-black">{purchase.numero_facture}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Info Column */}
        <div className="space-y-6">
          <div className="bg-white/60 backdrop-blur-xl rounded-[40px] border border-white p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-2 text-slate-400 font-black text-xs uppercase tracking-widest">
              <AlertCircle size={14} /> État du compte
            </div>
            
            <div className="p-6 bg-slate-900 rounded-[32px] text-white space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Facture</p>
                <p className="text-2xl font-black">{new Intl.NumberFormat("fr-FR").format(purchase.montant_total)} F</p>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total Payé</p>
                  <p className="text-xl font-black text-emerald-400">{new Intl.NumberFormat("fr-FR").format(purchase.montant_paye)} F</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-400">Reste à Payer</p>
                  <p className="text-xl font-black text-rose-400">{new Intl.NumberFormat("fr-FR").format(due)} F</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white border border-slate-50 rounded-2xl">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><User size={18} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Fournisseur</p>
                  <p className="font-black text-slate-900">{purchase.fournisseur_nom}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-white border border-slate-50 rounded-2xl">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Calendar size={18} /></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Date Facture</p>
                  <p className="font-black text-slate-900">{new Date(purchase.date_achat).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleAddPayment} className="bg-indigo-600 rounded-[40px] p-10 shadow-xl shadow-indigo-100 text-white space-y-6">
            <h3 className="text-xl font-black flex items-center gap-3">
              <Plus size={24} /> Nouveau Paiement
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-200 ml-2">Montant à régler</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-300" size={18} />
                  <input 
                    type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                    className="w-full bg-white/10 border-white/20 text-white placeholder:text-indigo-200 rounded-2xl p-4 pl-12 text-2xl font-black focus:ring-4 focus:ring-white/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-200 ml-2">Moyen de règlement</label>
                <select 
                  value={method} onChange={e => setMethod(e.target.value)}
                  className="w-full bg-white/10 border-white/20 text-white rounded-2xl p-4 font-black focus:ring-4 focus:ring-white/10 transition-all appearance-none"
                >
                  <option className="text-slate-900" value="Espèces">Espèces</option>
                  <option className="text-slate-900" value="Chèque">Chèque</option>
                  <option className="text-slate-900" value="Virement">Virement</option>
                  <option className="text-slate-900" value="Mobile Money">Mobile Money</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-indigo-200 ml-2">Référence / N° Pièce</label>
                <input 
                  type="text" placeholder="Ex: CHQ-8822"
                  value={reference} onChange={e => setReference(e.target.value)}
                  className="w-full bg-white/10 border-white/20 text-white placeholder:text-indigo-200 rounded-2xl p-4 font-black focus:ring-4 focus:ring-white/10"
                />
              </div>
            </div>

            <button 
              type="submit" disabled={saving || amount <= 0}
              className="w-full bg-white text-indigo-600 px-8 py-5 rounded-[24px] font-black shadow-xl hover:bg-indigo-50 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
              Valider le Paiement
            </button>
          </form>
        </div>

        {/* History Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/80 backdrop-blur-2xl rounded-[48px] border border-white shadow-xl overflow-hidden min-h-[600px] flex flex-col">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><History size={24} /></div>
                Historique des Règlements
              </h3>
            </div>
            
            <div className="flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">Date</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">Moyen</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">Référence</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 text-right">Montant</th>
                    <th className="px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {purchase.paiements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-slate-300 font-bold">Aucun règlement enregistré</td>
                    </tr>
                  ) : (
                    purchase.paiements.map(payment => (
                      <tr key={payment.id} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-10 py-6 text-slate-500 font-bold">{new Date(payment.date_operation).toLocaleDateString("fr-FR")}</td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-50 text-slate-400 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors"><CreditCard size={14} /></div>
                            <span className="font-black text-slate-700">{payment.moyen_reglement}</span>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-slate-500 font-black">{payment.reference_paiement || "-"}</td>
                        <td className="px-10 py-6 text-right font-black text-emerald-600">
                          {new Intl.NumberFormat("fr-FR").format(payment.montant_regle)} F
                        </td>
                        <td className="px-10 py-6 text-right">
                          <button className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {purchase.statut === "Payée" && (
              <div className="m-10 p-8 bg-emerald-50 rounded-[32px] border border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-4 text-emerald-700 font-black">
                  <div className="p-3 bg-white rounded-2xl shadow-sm"><CheckCircle2 size={24} /></div>
                  <div>
                    <p className="text-lg">Facture Entièrement Réglée</p>
                    <p className="text-xs opacity-70">Aucun solde restant pour cette facture.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
