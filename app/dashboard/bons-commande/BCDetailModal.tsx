"use client";

import { useState } from "react";
import {
  X,
  Printer,
  MessageCircle,
  CheckCircle2,
  Truck,
  Calendar,
  Building2,
  User,
  Clock,
  ArrowRight,
  Loader2,
  PackageCheck,
  Phone,
  AlertCircle
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";
import { useLanguage } from "@/lib/i18n/context";

type BC = {
  id: number;
  numero_bc: string;
  date_commande: string;
  date_livraison_prevue?: string;
  fournisseur_nom: string;
  statut: string;
  total_ht: number;
  total_ttc: number;
  notes?: string;
  created_by?: string;
  items?: any[];
};

type BCDetailModalProps = {
  bc: BC;
  onClose: () => void;
  onRefresh: () => void;
};

export default function BCDetailModal({ bc, onClose, onRefresh }: BCDetailModalProps) {
  const { locale, dir } = useLanguage();
  const isAr = locale === "ar";
  const [receiving, setReceiving] = useState(false);
  const [supplierPhone, setSupplierPhone] = useState("");
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handlePrint = () => {
    window.print();
  };

  const executeSendWhatsApp = (phoneToSend: string) => {
    const itemsList = (bc.items || [])
      .map((it, idx) => `${idx + 1}. *${it.designation}* (Qté: *${it.quantite}* × ${Number(it.prix_achat_unitaire || 0).toLocaleString()} F)`)
      .join("\n");

    const message =
      `📄 *ORDRE DE COMMANDE FOURNISSEUR*\n\n` +
      `🏢 *Émetteur :* GESTION PRO GLOBAL\n` +
      `🔢 *Réf. Bon de Commande :* *${bc.numero_bc}*\n` +
      `🤝 *Fournisseur Partenaire :* *${bc.fournisseur_nom}*\n` +
      `📅 *Date d'émission :* ${new Date(bc.date_commande).toLocaleDateString("fr-FR")}\n` +
      (bc.date_livraison_prevue ? `🚚 *Date de livraison souhaitée :* *${new Date(bc.date_livraison_prevue).toLocaleDateString("fr-FR")}*\n` : "") +
      `\n📦 *ARTICLES COMMANDÉS :*\n${itemsList}\n\n` +
      `💰 *MONTANT ESTIMÉ TOTAL :* *${Number(bc.total_ttc || 0).toLocaleString("fr-FR")} FCFA*\n\n` +
      (bc.notes ? `📝 *Instructions :* ${bc.notes}\n\n` : "") +
      `Merci de nous confirmer la réception de cette commande et de nous indiquer vos délais d'expédition.`;

    openWhatsAppDirect(phoneToSend, message);
    setShowPhonePrompt(false);
  };

  const handleSendWhatsApp = () => {
    if (!supplierPhone) {
      setShowPhonePrompt(true);
    } else {
      executeSendWhatsApp(supplierPhone);
    }
  };

  const handleReceiveStock = async () => {
    if (!confirm(`Confirmer la réception physique de la commande ${bc.numero_bc} et l'entrée automatique en stock ?`)) {
      return;
    }

    try {
      setReceiving(true);
      setFeedbackMessage(null);
      const res = await fetch(`/api/bons-commande/${bc.id}/receive`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la réception");
      }

      setFeedbackMessage({ text: "Commande réceptionnée avec succès ! Les stocks ont été crédités.", type: "success" });
      setTimeout(() => {
        onRefresh();
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedbackMessage({ text: err.message, type: "error" });
    } finally {
      setReceiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white animate-fadeIn">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto print:border-none print:shadow-none animate-in zoom-in-95 duration-200">
        {/* Actions Bar (Hidden on Print) */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-5 text-white flex flex-wrap items-center justify-between gap-3 print:hidden border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Truck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                Bon de Commande {bc.numero_bc}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    bc.statut === "REÇU"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {bc.statut}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                Fournisseur: <span className="text-white font-bold">{bc.fournisseur_nom}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {bc.statut !== "REÇU" && (
              <button
                onClick={handleReceiveStock}
                disabled={receiving}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {receiving ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                <span>{isAr ? "تأكيد الاستلام وإدخال المخزون" : "Valider Réception & Stock"}</span>
              </button>
            )}

            <button
              onClick={handleSendWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <MessageCircle size={14} />
              <span>{isAr ? "واتساب المورد" : "WhatsApp Fournisseur"}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Printer size={14} />
              <span>{isAr ? "طباعة A4" : "Imprimer A4"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div className={`p-4 text-xs font-bold flex items-center gap-2 print:hidden ${
            feedbackMessage.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}>
            <CheckCircle2 size={16} />
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* WhatsApp Phone Prompt Box */}
        {showPhonePrompt && (
          <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-3 text-xs print:hidden">
            <div className="flex items-center gap-2 flex-1">
              <Phone size={16} className="text-emerald-600" />
              <span className="font-bold text-emerald-900">Numéro WhatsApp du Fournisseur :</span>
              <input
                type="tel"
                placeholder="Ex: 90000000 ou +227..."
                value={supplierPhone}
                onChange={(e) => setSupplierPhone(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-emerald-300 text-xs font-bold text-slate-800 bg-white"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => executeSendWhatsApp(supplierPhone)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer"
              >
                Envoyer
              </button>
              <button
                onClick={() => setShowPhonePrompt(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* PRINTABLE OFFICIAL A4 PURCHASE ORDER */}
        <div className="p-8 space-y-8 bg-white text-slate-900 font-sans print:p-4">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                BON DE COMMANDE
              </h2>
              <p className="text-xs font-mono font-bold text-indigo-600 mt-1">
                RÉFÉRENCE : {bc.numero_bc}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Date : {new Date(bc.date_commande).toLocaleDateString("fr-FR")}
              </p>
              {bc.date_livraison_prevue && (
                <p className="text-xs text-amber-700 font-bold mt-0.5">
                  Livraison souhaitée : {new Date(bc.date_livraison_prevue).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>

            <div className="text-right">
              <span className="text-sm font-black text-slate-900 uppercase">
                GESTION PRO GLOBAL
              </span>
              <p className="text-xs text-slate-500">Distribution & Commerce Général</p>
              <p className="text-xs text-slate-500">Niamey, Niger</p>
              <p className="text-xs text-slate-500 font-mono">Tél: +227 00 00 00 00</p>
            </div>
          </div>

          {/* Supplier Box */}
          <div className="grid grid-cols-2 gap-6">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                DESTINATAIRE (FOURNISSEUR)
              </span>
              <h4 className="text-sm font-black text-slate-900">{bc.fournisseur_nom}</h4>
              <p className="text-xs text-slate-500">Compte Fournisseur Partenaire</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                ÉMETTEUR & RESPONSABLE
              </span>
              <h4 className="text-sm font-black text-slate-900">
                {bc.created_by || "Direction des Achats"}
              </h4>
              <p className="text-xs text-slate-500">Système GestionPro Global</p>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase text-slate-900">
                  <th className="py-2.5">Réf.</th>
                  <th className="py-2.5">Désignation</th>
                  <th className="py-2.5 text-center">Quantité</th>
                  <th className="py-2.5 text-right">P.U Estimé</th>
                  <th className="py-2.5 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(bc.items || []).map((it, idx) => {
                  const lineTotal = Number(it.total_ligne) || Number(it.quantite) * Number(it.prix_achat_unitaire) || 0;
                  return (
                    <tr key={idx}>
                      <td className="py-3 font-mono font-bold text-slate-500">
                        {it.reference || `ART-${idx + 1}`}
                      </td>
                      <td className="py-3 font-bold text-slate-900">{it.designation}</td>
                      <td className="py-3 text-center font-bold text-slate-900 font-mono">
                        {it.quantite}
                      </td>
                      <td className="py-3 text-right font-mono text-slate-600">
                        {Number(it.prix_achat_unitaire || 0).toLocaleString("fr-FR")} F
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-slate-900">
                        {lineTotal.toLocaleString("fr-FR")} F
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-between items-start border-t border-slate-200 pt-6">
            <div className="max-w-md text-xs text-slate-500">
              <span className="font-bold text-slate-700 block mb-1">Notes & Conditions :</span>
              <p>{bc.notes || "Livraison selon les accords commerciaux en vigueur."}</p>
            </div>

            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Estimé HT :</span>
                <span className="font-bold font-mono">
                  {Number(bc.total_ht || 0).toLocaleString("fr-FR")} FCFA
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>TOTAL COMMANDE :</span>
                <span className="font-mono text-indigo-700">
                  {Number(bc.total_ttc || 0).toLocaleString("fr-FR")} FCFA
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-12 pt-8 text-center text-xs">
            <div className="border-t border-slate-300 pt-2">
              <span className="text-slate-400 font-bold block">Le Responsable des Achats</span>
              <span className="text-slate-600 italic">Signature & Cachet</span>
            </div>
            <div className="border-t border-slate-300 pt-2">
              <span className="text-slate-400 font-bold block">Accusé de Réception Fournisseur</span>
              <span className="text-slate-600 italic">Date & Bon pour Accord</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
