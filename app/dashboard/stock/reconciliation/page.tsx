"use client";

import { useEffect, useState } from "react";
import { 
  ClipboardCheck, 
  Search, 
  Save, 
  AlertTriangle, 
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Package
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ReconciliationItem = {
  id: number;
  reference: string;
  designation: string;
  system_qte: number;
  physical_qte: number;
  difference: number;
};

export default function InventoryReconciliation() {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepotId, setSelectedDepotId] = useState<number | null>(null);
  const [depots, setDepots] = useState<{id: number, nom: string}[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let orgId: string | null = null;
    try {
      const match = document.cookie.split("; ").find((c) => c.startsWith("gp_session="));
      if (match) {
        const decoded = decodeURIComponent(match.split("=")[1]);
        const data = JSON.parse(decoded);
        if (data.organization_id) {
          orgId = data.organization_id;
          setCurrentOrgId(data.organization_id);
        }
      }
    } catch {}
    fetchDepots(orgId);
  }, []);

  useEffect(() => {
    if (selectedDepotId) {
      fetchStock();
    }
  }, [selectedDepotId, currentOrgId]);

  const fetchDepots = async (org?: string | null) => {
    const activeOrg = org || currentOrgId;
    let q = supabase.from("depots").select("id, nom").eq("is_active", true);
    if (activeOrg) q = q.eq("organization_id", activeOrg);
    const { data } = await q;
    if (data) setDepots(data);
  };

  const fetchStock = async (org?: string | null) => {
    const activeOrg = org || currentOrgId;
    setLoading(true);
    try {
      let artQ = supabase
        .from("articles")
        .select(`
          id, reference, designation
        `)
        .eq("is_deleted", false);
      if (activeOrg) artQ = artQ.eq("organization_id", activeOrg);

      const { data, error } = await artQ;

      if (data) {
        // Fetch all stocks for these articles scoped by organization
        let stockQ = supabase.from("stocks").select("article_id, quantite, depot_nom");
        if (activeOrg) stockQ = stockQ.eq("organization_id", activeOrg);
        const { data: allStocks } = await stockQ;
        
        const mapped = data.map((art: any) => {
          const systemQte = (allStocks || [])
            .filter((s: any) => s.article_id === art.id && (s.depot_nom === depots.find(d => d.id === selectedDepotId)?.nom))
            .reduce((acc, curr) => acc + Number(curr.quantite), 0);
            
          return {
            id: art.id,
            reference: art.reference,
            designation: art.designation,
            system_qte: Number(systemQte),
            physical_qte: Number(systemQte),
            difference: 0
          };
        });
        setItems(mapped);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhysicalChange = (id: number, val: string) => {
    const qte = Number(val) || 0;
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          physical_qte: qte,
          difference: qte - item.system_qte
        };
      }
      return item;
    }));
  };

  const handleSave = async () => {
    const changes = items.filter(item => item.difference !== 0);
    if (changes.length === 0) return;

    setSaving(true);
    try {
      for (const change of changes) {
        // 1. Update stock using depot name and organization_id
        const depotName = depots.find(d => d.id === selectedDepotId)?.nom;
        let stockUpdate = supabase
          .from("stocks")
          .update({ quantite: change.physical_qte })
          .eq("article_id", change.id)
          .eq("depot_nom", depotName);
        if (currentOrgId) stockUpdate = stockUpdate.eq("organization_id", currentOrgId);

        const { error: stockErr } = await stockUpdate;
        if (stockErr) throw stockErr;

        // 2. Record movement with organization_id
        await supabase.from("mouvements").insert({
          article_id: change.id,
          depot_id: selectedDepotId,
          type: "INVENTAIRE",
          quantite: change.difference,
          stock_avant: change.system_qte,
          stock_apres: change.physical_qte,
          nr_doc: "INV-" + new Date().toISOString().split('T')[0],
          date_mouvement: new Date().toISOString(),
          fournisseur_client: "Ajustement Inventaire",
          ...(currentOrgId ? { organization_id: currentOrgId } : {})
        });
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchStock();
    } catch (err) {
      alert("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter(i => 
    i.reference.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/stock" className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
            <ArrowLeft className="w-6 h-6 text-slate-400" />
          </Link>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-indigo-600" />
            Jerd الدوري (Reconciliation)
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
           <select 
             className="p-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
             value={selectedDepotId || ""}
             onChange={(e) => setSelectedDepotId(Number(e.target.value))}
           >
              <option value="" disabled>Sélectionner un dépôt...</option>
              {depots.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
           </select>

           <button 
             onClick={handleSave}
             disabled={saving || !selectedDepotId || items.filter(i => i.difference !== 0).length === 0}
             className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:bg-slate-200 transition-all shadow-lg shadow-indigo-200"
           >
             {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
             Enregistrer le Jerd
           </button>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-6 h-6" />
          Inventaire enregistré avec succès !
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-4">
           <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                placeholder="Rechercher un article..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              {filteredItems.length} Articles
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Article</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock Système</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock Physique</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Différence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">Chargement du stock...</p>
                  </td>
                </tr>
              ) : filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-white transition-colors">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{item.designation}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.reference}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-black text-slate-900">
                    {item.system_qte}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="number"
                      className="w-24 p-2 bg-white border-2 border-slate-100 rounded-xl text-center font-black text-indigo-600 focus:border-indigo-500 outline-none transition-all"
                      value={item.physical_qte}
                      onChange={(e) => handlePhysicalChange(item.id, e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black ${
                      item.difference === 0 ? 'bg-slate-100 text-slate-400' :
                      item.difference > 0 ? 'bg-emerald-50 text-emerald-600' :
                      'bg-rose-50 text-rose-600'
                    }`}>
                      {item.difference > 0 ? '+' : ''}{item.difference}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
