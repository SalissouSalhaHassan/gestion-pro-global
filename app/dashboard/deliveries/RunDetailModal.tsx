"use client";

import { useState } from "react";
import {
  X,
  Printer,
  MessageCircle,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  AlertCircle,
  Navigation,
  Loader2
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

type DeliveryPackage = {
  id: number;
  client_nom: string;
  client_tel: string | null;
  adresse_livraison: string;
  montant_a_encaisser: number;
  statut_livraison: string;
  heure_livraison: string | null;
  nom_receptionnaire: string | null;
};

type DeliveryRun = {
  id: number;
  reference: string;
  chauffeur_nom: string;
  chauffeur_tel: string | null;
  vehicule_matricule: string | null;
  statut: string;
  zone_livraison: string | null;
  total_colis: number;
  total_montant_a_encaisser: number;
  total_encaisse: number;
  created_at: string;
  colis: DeliveryPackage[];
};

type RunDetailModalProps = {
  run: DeliveryRun;
  onClose: () => void;
  onUpdated: () => void;
};

export default function RunDetailModal({ run, onClose, onUpdated }: RunDetailModalProps) {
  const [activeRun, setActiveRun] = useState<DeliveryRun>(run);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deliveringColisId, setDeliveringColisId] = useState<number | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/deliveries/${activeRun.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveRun({ ...activeRun, statut: newStatus });
        onUpdated();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleMarkDelivered = async (colisId: number) => {
    const receiverName = prompt("Nom de la personne ayant réceptionné le colis :");
    if (receiverName === null) return;

    try {
      setDeliveringColisId(colisId);
      const res = await fetch(`/api/deliveries/colis/${colisId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom_receptionnaire: receiverName }),
      });
      const data = await res.json();
      if (data.success) {
        const updatedColisList = activeRun.colis.map((c) =>
          c.id === colisId ? { ...c, statut_livraison: "LIVRE", nom_receptionnaire: receiverName } : c
        );
        setActiveRun({ ...activeRun, colis: updatedColisList });
        onUpdated();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeliveringColisId(null);
    }
  };

  const handleSendWhatsAppDriver = () => {
    let msg = `🚚 *FEUILLE DE ROUTE CHAUFFEUR - ${activeRun.reference}*\n`;
    msg += `Chauffeur: *${activeRun.chauffeur_nom}*\n`;
    if (activeRun.vehicule_matricule) msg += `Véhicule: *${activeRun.vehicule_matricule}*\n`;
    if (activeRun.zone_livraison) msg += `Zone: *${activeRun.zone_livraison}*\n`;
    msg += `Nombre de Colis: *${activeRun.colis.length}*\n`;
    msg += `Total à Encaisser: *${Number(activeRun.total_montant_a_encaisser).toLocaleString()} FCFA*\n\n`;
    msg += `📋 *LISTE DES DESTINATIONS :*\n`;

    activeRun.colis.forEach((c, idx) => {
      msg += `\n*#${idx + 1} - ${c.client_nom}*\n`;
      msg += `📍 Adresse: ${c.adresse_livraison}\n`;
      if (c.client_tel) msg += `📞 Tél: ${c.client_tel}\n`;
      if (Number(c.montant_a_encaisser) > 0) {
        msg += `💰 *À ENCAISSER: ${Number(c.montant_a_encaisser).toLocaleString()} FCFA*\n`;
      } else {
        msg += `✅ *DÉJÀ PAYÉ*\n`;
      }
    });

    msg += `\n_Bonne route et soyez prudents !_`;

    openWhatsAppDirect(activeRun.chauffeur_tel || "", msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto print:border-none print:shadow-none animate-in zoom-in-95 duration-200">
        {/* Header (Hidden on Print) */}
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600 text-white">
              <Truck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                  {activeRun.reference}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  {activeRun.statut}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Chauffeur : {activeRun.chauffeur_nom} • Véhicule : {activeRun.vehicule_matricule || "Non spécifié"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Printable Delivery Manifest Document */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:p-0">
          {/* Printable Official Header */}
          <div className="border-b-2 border-slate-900 pb-5 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                Bordereau de Livraison / Feuille de Route
              </h1>
              <span className="font-mono text-xs font-black text-indigo-700 block mt-0.5">
                RÉFÉRENCE : {activeRun.reference}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">
                Date d'émission : {new Date(activeRun.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-slate-800 block">GESTION PRO GLOBAL</span>
              <span className="text-[10px] text-slate-500 block">Service Logistique & Expéditions</span>
              <span className="text-xs font-bold text-slate-700 block mt-1">
                Zone : {activeRun.zone_livraison || "Toute la ville"}
              </span>
            </div>
          </div>

          {/* Chauffeur & Financial Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Chauffeur</span>
              <span className="text-sm font-bold text-slate-900 block">{activeRun.chauffeur_nom}</span>
              <span className="text-xs text-slate-500 font-mono">{activeRun.chauffeur_tel || "Sans tél"}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-black text-slate-400 block">Véhicule</span>
              <span className="text-sm font-bold text-slate-900 block font-mono">
                {activeRun.vehicule_matricule || "Tricycle / Moto"}
              </span>
              <span className="text-xs text-slate-500">{activeRun.colis?.length || 0} Colis à livrer</span>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <span className="text-[10px] uppercase font-black text-amber-600 block">
                Total à Encaisser (COD)
              </span>
              <span className="text-base font-black text-amber-800 font-mono block">
                {formatCurrencyAmount(activeRun.total_montant_a_encaisser, "FCFA")}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold block">
                Encaissé : {formatCurrencyAmount(activeRun.total_encaisse, "FCFA")}
              </span>
            </div>
          </div>

          {/* Delivery Points Table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Destinataire</th>
                  <th className="px-4 py-3">Adresse de Livraison</th>
                  <th className="px-4 py-3 text-right">À Encaisser</th>
                  <th className="px-4 py-3 text-center">Statut (POD)</th>
                  <th className="px-4 py-3 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeRun.colis?.map((colis, idx) => {
                  const isDelivered = colis.statut_livraison === "LIVRE";
                  return (
                    <tr key={colis.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{colis.client_nom}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{colis.client_tel}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 font-medium">{colis.adresse_livraison}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {Number(colis.montant_a_encaisser) > 0 ? (
                          <span className="text-amber-700">
                            {formatCurrencyAmount(colis.montant_a_encaisser, "FCFA")}
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">Payé</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isDelivered ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={11} /> Livré ({colis.nom_receptionnaire || "OK"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                            <Clock size={11} /> En Attente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right print:hidden">
                        {!isDelivered && (
                          <button
                            onClick={() => handleMarkDelivered(colis.id)}
                            disabled={deliveringColisId === colis.id}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-all cursor-pointer shadow-2xs"
                          >
                            {deliveringColisId === colis.id ? "..." : "Valider Livraison"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Printable Signature Box */}
          <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs print:grid">
            <div className="text-center border-t border-dashed border-slate-300 pt-3">
              <span className="font-bold text-slate-600 block">Visa / Signature du Chauffeur</span>
            </div>
            <div className="text-center border-t border-dashed border-slate-300 pt-3">
              <span className="font-bold text-slate-600 block">Visa Responsable Expéditions / Magasinier</span>
            </div>
          </div>

          {/* Action Bar (Hidden on Print) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 print:hidden">
            {/* Status progression button */}
            <div className="flex items-center gap-2">
              {activeRun.statut === "EN_PREPARATION" && (
                <button
                  onClick={() => handleStatusChange("EN_ROUTE")}
                  disabled={updatingStatus}
                  className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Navigation size={14} />
                  <span>Lancer la Tournée (En Route)</span>
                </button>
              )}
              {activeRun.statut === "EN_ROUTE" && (
                <button
                  onClick={() => handleStatusChange("TERMINEE")}
                  disabled={updatingStatus}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Clôturer la Tournée (Terminée)</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleSendWhatsAppDriver}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <MessageCircle size={15} />
                <span>Envoyer au Chauffeur (WhatsApp)</span>
              </button>

              <button
                onClick={handlePrint}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Printer size={15} />
                <span>Imprimer Feuille de Route</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
