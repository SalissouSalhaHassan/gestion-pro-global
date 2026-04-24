"use client";

import { useEffect, useState } from "react";
import { 
  Plus, Search, Edit2, Trash2, Printer, DollarSign, Loader2, Package, Scale, CreditCard, Clock, AlertTriangle
} from "lucide-react";
import { useSession } from "next-auth/react";

// Types
export type CimentShipment = {
  id: string;
  client_tel: string;
  camion_no: string;
  transporteur: string;
  type_ciment: string;
  destination: string;
  chauffeur: string;
  chauffeur_tel: string;
  bons: string;
  arrivage: string;
  tonnage: number;
  pu: number;
  frais_ciment: number;
  frais_transport: number;
  tva_pourcentage: number;
  bic_pourcentage: number;
  total: number;
  montant_paye: number;
  statut_paiement: string;
  created_at: string;
};

import { CimentEntryModal, CimentPaymentModal } from "./CimentModals";

export default function CimentPage() {
  const { data: session } = useSession();
  const [shipments, setShipments] = useState<CimentShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCamion, setSearchCamion] = useState("");
  const [searchClient, setSearchClient] = useState("");

  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<CimentShipment | null>(null);

  const [stats, setStats] = useState({
    tonnageTotal: 0,
    totalFacture: 0,
    totalEncaisse: 0,
    resteAPayer: 0
  });

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchCamion) params.append("camion_no", searchCamion);
      if (searchClient) params.append("client_tel", searchClient);

      const res = await fetch(`/api/ciment/shipments?${params}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setShipments(data);
        
        let tTonnage = 0, tFacture = 0, tEncaisse = 0;
        data.forEach(s => {
          tTonnage += Number(s.tonnage || 0);
          tFacture += Number(s.total || 0);
          tEncaisse += Number(s.montant_paye || 0);
        });
        
        setStats({
          tonnageTotal: tTonnage,
          totalFacture: tFacture,
          totalEncaisse: tEncaisse,
          resteAPayer: tFacture - tEncaisse
        });
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [searchCamion, searchClient]);

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce chargement ?")) return;
    try {
      const res = await fetch(`/api/ciment/shipments/${id}`, { method: "DELETE" });
      if (res.ok) fetchShipments();
      else alert("Erreur lors de la suppression");
    } catch (error) {
      console.error(error);
    }
  };

  const openNewEntry = () => {
    setSelectedShipment(null);
    setIsEntryModalOpen(true);
  };

  const openEditEntry = (shipment: CimentShipment) => {
    setSelectedShipment(shipment);
    setIsEntryModalOpen(true);
  };

  const openPayment = (shipment: CimentShipment) => {
    setSelectedShipment(shipment);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            🏗️ Gestion des Chargements
          </h1>
          <p className="text-slate-400 mt-1 font-medium">Ciment, Logistique & Facturation</p>
        </div>
        <div className="relative z-10">
          <button 
            onClick={openNewEntry}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2 group"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform" />
            Nouveau Chargement
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard icon={<Scale size={24}/>} title="Tonnage Total" value={`${stats.tonnageTotal.toLocaleString('fr-FR')} t`} color="blue" />
        <StatCard icon={<DollarSign size={24}/>} title="Total Facturé" value={`${stats.totalFacture.toLocaleString('fr-FR')} FCFA`} color="purple" />
        <StatCard icon={<CreditCard size={24}/>} title="Total Encaissé" value={`${stats.totalEncaisse.toLocaleString('fr-FR')} FCFA`} color="emerald" />
        <StatCard icon={<Clock size={24}/>} title="Reste à Payer" value={`${stats.resteAPayer.toLocaleString('fr-FR')} FCFA`} color="amber" />
      </div>

      {/* SEARCH & TABLE */}
      <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl shadow-xl shadow-slate-200/50 p-6">
        
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="🔍 Tél Client..." 
              value={searchClient}
              onChange={(e) => setSearchClient(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
            />
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="🚚 N° Camion..." 
              value={searchCamion}
              onChange={(e) => setSearchCamion(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-slate-200/60 bg-white">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-4 font-bold rounded-tl-2xl">📅 Date</th>
                <th className="p-4 font-bold">👤 Client / Tél</th>
                <th className="p-4 font-bold">🚚 Camion</th>
                <th className="p-4 font-bold">📦 Type / Dest.</th>
                <th className="p-4 font-bold">⚖️ Tonnage</th>
                <th className="p-4 font-bold text-right">💰 Total TTC</th>
                <th className="p-4 font-bold text-right">💳 Payé</th>
                <th className="p-4 font-bold text-center">🔔 Statut</th>
                <th className="p-4 font-bold text-right rounded-tr-2xl">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
                  </td>
                </tr>
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    Aucun chargement trouvé.
                  </td>
                </tr>
              ) : (
                shipments.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500">
                      {new Date(s.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-slate-800">{s.client_tel}</span>
                    </td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold border border-slate-200">
                        {s.camion_no}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {s.type_ciment}
                    </td>
                    <td className="p-4 font-black text-slate-800">
                      {s.tonnage} t
                    </td>
                    <td className="p-4 text-right font-black text-slate-800">
                      {s.total?.toLocaleString('fr-FR')} F
                    </td>
                    <td className="p-4 text-right font-black text-emerald-600">
                      {s.montant_paye?.toLocaleString('fr-FR')} F
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${
                        s.statut_paiement === 'Payé' ? 'bg-emerald-100 text-emerald-700' :
                        s.statut_paiement === 'Partiel' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {s.statut_paiement}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => openPayment(s)} title="Paiements" className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors">
                        <CreditCard size={18} />
                      </button>
                      <button title="Imprimer" className="p-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors">
                        <Printer size={18} />
                      </button>
                      <button onClick={() => openEditEntry(s)} title="Modifier" className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                        <Edit2 size={18} />
                      </button>
                      {session?.user?.role === "ADMIN" && (
                        <button title="Supprimer" onClick={() => handleDelete(s.id)} className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      <CimentEntryModal 
        isOpen={isEntryModalOpen} 
        onClose={() => setIsEntryModalOpen(false)} 
        shipment={selectedShipment} 
        onSuccess={fetchShipments} 
      />

      {selectedShipment && (
        <CimentPaymentModal 
          isOpen={isPaymentModalOpen} 
          onClose={() => setIsPaymentModalOpen(false)} 
          shipmentId={selectedShipment.id} 
          onSuccess={fetchShipments} 
        />
      )}
    </div>
  );
}

function StatCard({ icon, title, value, color }: { icon: any, title: string, value: string, color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  };
  
  return (
    <div className="bg-slate-800 rounded-3xl p-6 border border-slate-700 shadow-xl relative overflow-hidden group">
      <div className={`absolute top-0 right-0 w-32 h-32 ${colors[color]} opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-20 transition-opacity`}></div>
      <div className="flex items-center gap-4 relative z-10">
        <div className={`p-3 rounded-2xl text-white ${colors[color]} shadow-lg`}>
          {icon}
        </div>
        <div>
          <p className="text-slate-400 font-bold text-sm tracking-wide uppercase">{title}</p>
          <p className="text-2xl font-black text-white mt-1">{value}</p>
        </div>
      </div>
    </div>
  );
}
