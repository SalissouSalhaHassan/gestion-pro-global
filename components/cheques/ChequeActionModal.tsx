"use client";

import { useState } from "react";
import {
  X,
  CreditCard,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  ArrowRight,
  Sparkles,
  FileCheck,
  Undo2,
  MessageSquare,
  ShieldAlert,
  Clock,
  Printer
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/context";
import { openWhatsAppDirect, formatPhoneForWhatsApp } from "@/lib/utils/whatsapp";

interface ChequeActionModalProps {
  isOpen: boolean;
  cheque: any;
  onClose: () => void;
  onSuccess: () => void;
  onPrintReceipt?: (cheque: any) => void;
}

export default function ChequeActionModal({
  isOpen,
  cheque,
  onClose,
  onSuccess,
  onPrintReceipt,
}: ChequeActionModalProps) {
  const { dir } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"DEPOSIT" | "ENCAISSER" | "REJET" | "WHATSAPP" | "DETAILS">("DETAILS");

  // Deposit state
  const [bordereauRemise, setBordereauRemise] = useState("");
  const [dateDepot, setDateDepot] = useState(new Date().toISOString().slice(0, 10));

  // Encaissement state
  const [dateEncaissement, setDateEncaissement] = useState(new Date().toISOString().slice(0, 10));

  // Rejet state
  const [motifRejet, setMotifRejet] = useState("Défaut de provision (Sans provision)");
  const [customMotif, setCustomMotif] = useState("");

  if (!isOpen || !cheque) return null;

  const handleAction = async (action: string, payload: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cheques/${cheque.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'opération");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement cette pièce du coffre-fort ?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cheques/${cheque.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression");

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppSend = (type: "DUE_REMINDER" | "REJET_ALERT") => {
    const clientPhone = cheque.client?.tel || "";
    if (!clientPhone) {
      alert("Aucun numéro de téléphone n'est enregistré pour ce client.");
      return;
    }

    const formattedAmount = Number(cheque.montant).toLocaleString("fr-FR") + " FCFA";
    let text = "";

    if (type === "DUE_REMINDER") {
      text = `Bonjour Cher(e) ${cheque.emetteur_nom},\n\nNous vous rappelons que votre chèque N° *${cheque.numero_piece}* d'un montant de *${formattedAmount}* (Banque : *${cheque.banque_emetteur}*) arrive à échéance le *${new Date(cheque.date_echeance).toLocaleDateString("fr-FR")}*.\n\nMerci de bien vouloir vous assurer de l'approvisionnement du compte pour son encaissement serein.\n\nCordialement,\n*Direction Financière*`;
    } else {
      text = `URGENT - AVIS D'IMPAYÉ / REJET DE CHÈQUE\n\nBonjour M./Mme ${cheque.emetteur_nom},\n\nNous vous informons par la présente que votre chèque N° *${cheque.numero_piece}* d'un montant de *${formattedAmount}* tiré sur *${cheque.banque_emetteur}* a été rejeté par la banque pour le motif suivant :\n👉 *${cheque.motif_rejet || motifRejet}*.\n\nPrière de procéder à la régularisation immédiate (espèces, virement instantané ou nouveau chèque certifié) sous 24h.\n\nService Recouvrement`;
    }

    openWhatsAppDirect(clientPhone, text);
  };

  const isOverdue = cheque.date_echeance < new Date().toISOString().slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn" dir={dir}>
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[28px] shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-indigo-50/40 dark:from-slate-900 dark:to-indigo-950/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
              <CreditCard size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {cheque.type_titre === "CHEQUE" ? "Chèque" : cheque.type_titre === "EFFET" ? "Traite" : "Billet à Ordre"} : {cheque.numero_piece}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  cheque.statut === "ENCAISSE"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : cheque.statut === "DEPOSE_BANQUE"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                    : cheque.statut === "REJETE"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                }`}>
                  {cheque.statut}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Banque : <span className="font-semibold text-slate-700 dark:text-slate-300">{cheque.banque_emetteur}</span> • Échéance : <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(cheque.date_echeance).toLocaleDateString("fr-FR")}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onPrintReceipt && (
              <button
                type="button"
                onClick={() => onPrintReceipt(cheque)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all shadow-sm"
                title="Imprimer Récépissé / Décharge"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">Imprimer Reçu</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action Tabs Bar */}
        <div className="flex items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-6 overflow-x-auto text-xs font-semibold gap-2">
          <button
            onClick={() => setActiveTab("DETAILS")}
            className={`py-3 px-3 border-b-2 transition-all ${
              activeTab === "DETAILS"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Vue d'ensemble
          </button>
          {cheque.statut === "EN_PORTEFEUILLE" && (
            <button
              onClick={() => setActiveTab("DEPOSIT")}
              className={`py-3 px-3 border-b-2 transition-all ${
                activeTab === "DEPOSIT"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Déposer en Banque
            </button>
          )}
          {(cheque.statut === "EN_PORTEFEUILLE" || cheque.statut === "DEPOSE_BANQUE") && (
            <button
              onClick={() => setActiveTab("ENCAISSER")}
              className={`py-3 px-3 border-b-2 transition-all ${
                activeTab === "ENCAISSER"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Encaisser (Créditer)
            </button>
          )}
          {cheque.statut !== "REJETE" && (
            <button
              onClick={() => setActiveTab("REJET")}
              className={`py-3 px-3 border-b-2 transition-all ${
                activeTab === "REJET"
                  ? "border-rose-600 text-rose-600 dark:text-rose-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Déclarer Rejet
            </button>
          )}
          <button
            onClick={() => setActiveTab("WHATSAPP")}
            className={`py-3 px-3 border-b-2 transition-all ${
              activeTab === "WHATSAPP"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            WhatsApp Client
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl text-rose-700 dark:text-rose-300 text-sm flex items-center gap-2.5">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB: DETAILS */}
          {activeTab === "DETAILS" && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Montant Nominal</span>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {Number(cheque.montant).toLocaleString("fr-FR")} <span className="text-sm font-semibold">FCFA</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Émetteur / Tireur</span>
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {cheque.emetteur_nom}
                  </div>
                  {cheque.client?.tel && (
                    <div className="text-xs text-slate-500">
                      Tél: {cheque.client.tel}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-1">Date d'Émission</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{cheque.date_emission}</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-1">Date d'Échéance</span>
                  <span className={`font-semibold ${isOverdue && cheque.statut !== 'ENCAISSE' ? 'text-rose-600 font-bold' : 'text-slate-900 dark:text-white'}`}>
                    {cheque.date_echeance} {isOverdue && cheque.statut !== 'ENCAISSE' && "(ÉCHU)"}
                  </span>
                </div>
                {cheque.bordereau_remise && (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 col-span-2">
                    <span className="text-slate-500 block mb-1">Bordereau de Remise en Banque</span>
                    <span className="font-semibold text-blue-600">{cheque.bordereau_remise}</span>
                  </div>
                )}
                {cheque.motif_rejet && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 col-span-2">
                    <span className="text-rose-600 font-bold block mb-1">Motif du Rejet Bancaire</span>
                    <span className="text-rose-700 dark:text-rose-300 font-medium">{cheque.motif_rejet}</span>
                  </div>
                )}
              </div>

              {cheque.notes && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">Notes :</span>
                  {cheque.notes}
                </div>
              )}

              {onPrintReceipt && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onPrintReceipt(cheque)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Printer size={16} />
                    <span>Imprimer le Récépissé / Décharge Client</span>
                  </button>
                </div>
              )}

              {/* Reset to Portfolio if deposited or rejected */}
              {(cheque.statut === "DEPOSE_BANQUE" || cheque.statut === "REJETE") && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleAction("REMETTRE_EN_PORTEFEUILLE")}
                    disabled={loading}
                    className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    <Undo2 size={14} />
                    <span>Annuler l'état et remettre en portefeuille</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: DEPOSIT */}
          {activeTab === "DEPOSIT" && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
                <p className="font-semibold text-sm mb-1">Remise en Banque</p>
                <p>Indiquez le numéro du bordereau de remise fourni lors du dépôt au guichet de votre banque.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  N° Bordereau de Remise
                </label>
                <input
                  type="text"
                  placeholder="Ex: BORD-2026/0914"
                  value={bordereauRemise}
                  onChange={(e) => setBordereauRemise(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Date du Dépôt
                </label>
                <input
                  type="date"
                  value={dateDepot}
                  onChange={(e) => setDateDepot(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAction("DEPOSE_BANQUE", { bordereau_remise: bordereauRemise, date_action: dateDepot })}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold text-sm shadow-md shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
              >
                <FileCheck size={18} />
                <span>Confirmer le Dépôt en Banque</span>
              </button>
            </div>
          )}

          {/* TAB: ENCAISSER */}
          {activeTab === "ENCAISSER" && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-300">
                <p className="font-semibold text-sm mb-1">Confirmation d'Encaissement</p>
                <p>Confirmez que la banque a crédité les fonds sur votre compte bancaire.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Date de Valeur / Crédit en Compte
                </label>
                <input
                  type="date"
                  value={dateEncaissement}
                  onChange={(e) => setDateEncaissement(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => handleAction("ENCAISSE", { date_action: dateEncaissement })}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-sm shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                <span>Marquer Comme Encaissé ({Number(cheque.montant).toLocaleString("fr-FR")} FCFA)</span>
              </button>
            </div>
          )}

          {/* TAB: REJET */}
          {activeTab === "REJET" && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-100 dark:border-rose-900/40 text-xs text-rose-900 dark:text-rose-300">
                <p className="font-semibold text-sm mb-1">Constat de Rejet / Impayé</p>
                <p>Enregistrez le motif du refus bancaire. Vous pourrez ensuite alerter immédiatement le client par WhatsApp.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Motif du Rejet
                </label>
                <select
                  value={motifRejet}
                  onChange={(e) => setMotifRejet(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none mb-2"
                >
                  <option value="Défaut de provision (Sans provision)">Défaut de provision (Sans provision)</option>
                  <option value="Signature non conforme ou manquante">Signature non conforme ou manquante</option>
                  <option value="Compte clôturé ou bloqué">Compte clôturé ou bloqué</option>
                  <option value="Opposition pour perte ou vol">Opposition pour perte ou vol</option>
                  <option value="Date erronée ou chèque prescrit">Date erronée ou chèque prescrit</option>
                  <option value="AUTRE">Autre motif personnalisé</option>
                </select>

                {motifRejet === "AUTRE" && (
                  <input
                    type="text"
                    placeholder="Précisez le motif..."
                    value={customMotif}
                    onChange={(e) => setCustomMotif(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                )}
              </div>

              <button
                type="button"
                onClick={() => handleAction("REJETE", { motif_rejet: motifRejet === "AUTRE" ? customMotif : motifRejet })}
                disabled={loading}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-semibold text-sm shadow-md shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
              >
                <ShieldAlert size={18} />
                <span>Déclarer le Rejet et Marquer Impayé</span>
              </button>
            </div>
          )}

          {/* TAB: WHATSAPP */}
          {activeTab === "WHATSAPP" && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300">
                <p className="font-semibold text-sm mb-1">Notification WhatsApp Instantanée</p>
                <p>
                  Destinataire : <span className="font-bold">{cheque.emetteur_nom}</span> ({cheque.client?.tel || "Pas de numéro"})
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleWhatsAppSend("DUE_REMINDER")}
                  className="w-full p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 hover:bg-emerald-100/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200 text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold block text-sm">Rappel d'Échéance Approchante</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Rappelle poliment au tireur la date d'échéance et le montant du chèque
                    </span>
                  </div>
                  <MessageSquare size={20} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={() => handleWhatsAppSend("REJET_ALERT")}
                  className="w-full p-3.5 rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50/50 hover:bg-rose-100/70 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200 text-left transition-colors flex items-center justify-between group"
                >
                  <div>
                    <span className="font-bold block text-sm">Avis Formel de Rejet Bancaire</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Met en demeure le client de régler sous 24h suite au chèque impayé
                    </span>
                  </div>
                  <ShieldAlert size={20} className="text-rose-600 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Delete */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 size={15} />
            <span>Supprimer la pièce</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
