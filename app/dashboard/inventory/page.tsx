"use client";

import { useEffect, useState, useRef } from "react";
import { 
  ScanLine, 
  MapPin, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  PackageSearch,
  Camera,
  X,
  Keyboard
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

type InventoryItem = {
  article_id: number;
  reference: string;
  designation: string;
  quantite_avant: number;
  quantite_apres: string; // Keep as string for input
  prix_achat: number;
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedDepot, setSelectedDepot] = useState("");
  const [depots, setDepots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    fetchDepots();
  }, []);

  const fetchDepots = async () => {
    try {
      const res = await fetch("/api/stock/depots");
      const data = await res.json();
      if (Array.isArray(data)) {
        const names = data.map((d: any) => d.nom || d.nom_depot || d).filter(Boolean);
        setDepots(names);
        if (names.length > 0 && !selectedDepot) {
           setSelectedDepot(names[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch depots:", err);
    }
  };

  // Fetch stocks when Depot changes
  useEffect(() => {
    if (selectedDepot) {
      fetchStockForInventory();
    }
  }, [selectedDepot]);

  const fetchStockForInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/stock", window.location.origin);
      if (selectedDepot && selectedDepot !== "Tous") {
        url.searchParams.set("depot", selectedDepot);
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data?.error || "Erreur de chargement du stock.");
      }
      
      const itemsList = Array.isArray(data) ? data : (data?.items || []);
      
      const mappedItems: InventoryItem[] = itemsList.map((i: any) => ({
        article_id: i.id,
        reference: i.reference || i.code_barre || `ID_${i.id}`,
        designation: i.designation || "Article sans nom",
        quantite_avant: Number(i.quantite) || 0,
        quantite_apres: String(i.quantite || 0),
        prix_achat: Number(i.p_achat_ht) || 0,
      }));
      setItems(mappedItems);
    } catch (err: any) {
      console.error("Failed to fetch inventory stock:", err);
      setError(err.message || "Erreur de chargement du stock.");
    } finally {
      setLoading(false);
    }
  };

  // Keyboard Scanner or Manual Search
  const handleManualSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
       const code = e.currentTarget.value.trim();
       if (code) {
         processBarcode(code);
         e.currentTarget.value = "";
       }
    }
  };

  const processBarcode = (code: string) => {
    setLastScanned(code);
    const itemIndex = items.findIndex(i => i.reference.toLowerCase() === code.toLowerCase() || i.article_id.toString() === code);
    
    if (itemIndex >= 0) {
      // Scroll to row and focus input
      const rowId = `item-row-${items[itemIndex].article_id}`;
      const inputEl = document.getElementById(`input-${items[itemIndex].article_id}`);
      
      document.getElementById(rowId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      inputEl?.focus();
      if(inputEl instanceof HTMLInputElement) inputEl.select();
    } else {
      setError(`Article introuvable pour le code: ${code}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  // Setup Camera Scanner
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    if (scannerActive) {
      scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 100 }, rememberLastUsedCamera: true },
        false
      );
      
      scanner.render(
        (decodedText) => {
           // Success
           processBarcode(decodedText);
           // Optional: play beep sound here
        },
        (error) => {
           // Ignore continuous failed scans
        }
      );
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scannerActive]);

  const handleUpdateDiff = (id: number, val: string) => {
    setItems(items.map(item => item.article_id === id ? { ...item, quantite_apres: val } : item));
  };

  const submitInventory = async () => {
    const modifications = items.filter(i => {
      const parsed = Number(i.quantite_apres);
      return !isNaN(parsed) && parsed !== i.quantite_avant;
    });

    if (modifications.length === 0) {
      setError("Aucune différence de stock détectée.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!confirm(`Vous êtes sur le point de valider un inventaire avec ${modifications.length} écarts. Continuer ?`)) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        depot_nom: selectedDepot,
        notes: "Jeu d'inventaire Physique",
        items: modifications
      };

      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de soumission");

      setSuccess("L'inventaire a été clôturé avec succès et le stock mis à jour.");
      fetchStockForInventory();
      setTimeout(() => setSuccess(null), 5000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalDifferences = items.reduce((acc, current) => {
     const parsed = Number(current.quantite_apres);
     if(!isNaN(parsed)) return acc + Math.abs(parsed - current.quantite_avant);
     return acc;
  }, 0);

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
               <ScanLine size={24} className="text-white" />
             </div>
             <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Cession d'Inventaire</h1>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Audit Physique du Stock</span>
             </div>
           </div>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           <MapPin size={20} className="text-indigo-500 ml-2" />
           <select 
             value={selectedDepot}
             onChange={(e) => setSelectedDepot(e.target.value)}
             className="bg-transparent border-none font-black text-slate-800 text-sm focus:ring-0 cursor-pointer pr-4"
           >
              {depots.map(d => <option key={d} value={d}>{d}</option>)}
           </select>
        </div>
      </div>

      {/* ERROR & SUCCESS MESSAGES */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl shadow-sm mb-6 font-bold text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl shadow-sm mb-6 font-bold text-sm">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SIDE BAR SCANNER & STATS */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-white">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Camera size={18} className="text-indigo-500" />
                 Scan Rapide
              </h3>
              
              {!scannerActive ? (
                <button 
                  onClick={() => setScannerActive(true)}
                  className="w-full py-8 border-2 border-dashed border-indigo-200 bg-indigo-50 text-indigo-600 rounded-2xl font-bold text-sm hover:bg-indigo-100 transition-colors flex flex-col items-center gap-3"
                >
                  <ScanLine size={32} />
                  Activer la caméra
                </button>
              ) : (
                <div className="space-y-4">
                  <div id="reader" className="w-full rounded-2xl overflow-hidden bg-black aspect-video border-2 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.3)]"></div>
                  <button 
                    onClick={() => setScannerActive(false)}
                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 flex justify-center gap-2"
                  >
                    <X size={14} /> Stop Scanner
                  </button>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Keyboard size={14} /> Douchette ou Clavier
                </p>
                <input 
                   type="text"
                   placeholder="Code-barre + Entrée"
                   onKeyDown={handleManualSearch}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:font-semibold"
                />
              </div>
           </div>

           <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-6 shadow-2xl text-white">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Récapitulatif</h3>
              <div className="flex justify-between items-end mb-4">
                <span className="text-sm font-semibold opacity-80">Écarts détectés</span>
                <span className="text-3xl font-black">{totalDifferences}</span>
              </div>
              <div className="flex justify-between items-end pb-6 border-b border-white/10 mb-6">
                <span className="text-sm font-semibold opacity-80">Articles scannés</span>
                <span className="text-xl font-black text-indigo-300">{items.length > 0 ? "Ouvert" : "0"}</span>
              </div>
              
              <button 
                onClick={submitInventory}
                disabled={saving || totalDifferences === 0}
                className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-50 flex justify-center items-center gap-2 transition-all active:scale-95"
              >
                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                Clôturer & Ajuster
              </button>
           </div>
        </div>

        {/* MAIN TABLE */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-full min-h-[600px] flex flex-col">
             
             <div className="flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full text-left" ref={tableRef}>
                   <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">Article</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">En Machine</th>
                        <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-indigo-500 border-b border-slate-200">Qté Comptée</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200">Écart</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {loading ? (
                        <tr>
                           <td colSpan={4} className="py-20 text-center">
                              <RefreshCw size={32} className="animate-spin text-indigo-500 mx-auto mb-4" />
                              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Extraction du stock...</p>
                           </td>
                        </tr>
                     ) : items.length === 0 ? (
                        <tr>
                           <td colSpan={4} className="py-20 text-center text-slate-500">
                             <PackageSearch className="w-16 h-16 mx-auto mb-4 opacity-20" />
                             Aucun article trouvé dans ce dépôt.
                           </td>
                        </tr>
                     ) : (
                        items.map((item) => {
                          const parsedCurrent = Number(item.quantite_apres);
                          const isInvalid = isNaN(parsedCurrent);
                          const diff = isInvalid ? 0 : parsedCurrent - item.quantite_avant;
                          const isScanned = lastScanned && (lastScanned.toLowerCase() === item.reference.toLowerCase() || lastScanned === item.article_id.toString());
                          
                          return (
                            <tr key={item.article_id} id={`item-row-${item.article_id}`} className={`transition-colors ${isScanned ? "bg-indigo-50/60" : "hover:bg-slate-50/50"}`}>
                               <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                     <span className="font-black text-slate-800 text-sm">{item.designation}</span>
                                     <code className="text-[10px] font-bold text-slate-400 mt-1">{item.reference || `ID_${item.article_id}`}</code>
                                  </div>
                               </td>
                               <td className="px-6 py-4 text-right">
                                  <span className="font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg tabular-nums">
                                     {item.quantite_avant}
                                  </span>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="flex justify-center">
                                    <input 
                                       id={`input-${item.article_id}`}
                                       type="number" 
                                       value={item.quantite_apres}
                                       min="0"
                                       step="0.01"
                                       onChange={(e) => handleUpdateDiff(item.article_id, e.target.value)}
                                       className={`w-28 text-center text-lg font-black rounded-xl py-2 px-3 border shadow-inner transition-all outline-none focus:ring-4 ${diff !== 0 ? (diff > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 focus:ring-emerald-500/20' : 'bg-rose-50 border-rose-200 text-rose-700 focus:ring-rose-500/20') : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-400 focus:ring-indigo-500/20'}`}
                                    />
                                  </div>
                               </td>
                               <td className="px-6 py-4 text-right font-black tabular-nums">
                                  {diff > 0 ? (
                                    <span className="text-emerald-500 bg-emerald-50 px-2 py-1 rounded-md">+{diff}</span>
                                  ) : diff < 0 ? (
                                    <span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-md">{diff}</span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                               </td>
                            </tr>
                          );
                        })
                     )}
                   </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
