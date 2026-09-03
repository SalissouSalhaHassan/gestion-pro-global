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
  PackageCheck
} from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

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
  const [receiving, setReceiving] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const itemsList = (bc.items || [])
      .map((it, idx) => `${idx + 1}. *${it.designation}* (Qté: ${it.quantite})`)
      .join("\n");

    const message =
      `*BON DE COMMANDE FOURNISSEUR*\n` +
      `*Réf :* ${bc.numero_bc}\n` +
      `*Fournisseur :* ${bc.fournisseur_nom}\n` +
      `*Date :* ${new Date(bc.date_commande).toLocaleDateString("fr-FR")}\n` +
      (bc.date_livraison_prevue ? `*Livraison souhaitée :* ${new Date(bc.date_livraison_prevue).toLocaleDateString("fr-FR")}\n` : "") +
      `\n*Articles commandés :*\n${itemsList}\n\n` +
      `*Total Estimé :* ${Number(bc.total_ttc || 0).toLocaleString()} FCFA\n\n` +
      `Merci de confirmer la réception de cet ordre de commande et les délais de livraison.`;

    openWhatsAppDirect("", message);
  };

  const handleReceiveStock = async () => {
    if (!confirm(`Confirmer la réception physique de la commande ${bc.numero_bc} et l'entrée automatique en stock ?`)) {
      return;
    }

    try {
      setReceiving(true);
      const res = await fetch(`/api/bons-commande/${bc.id}/receive`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur lors de la réception");
      }

      alert("Commande réceptionnée avec succès ! Les stocks ont été crédités.");
      onRefresh();
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReceiving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto print:border-none print:shadow-none animate-in zoom-in-95 duration-200">
        {/* Actions Bar (Hidden on Print) */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Truck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                Bon de Commande {bc.numero_bc}
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
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
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {receiving ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                <span>Valider Réception & Stock</span>
              </button>
            )}

            <button
              onClick={handleSendWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle size={14} />
              <span>WhatsApp Fournisseur</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>Imprimer A4</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PRINTABLE A4 PURCHASE ORDER */}
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
              <h4 className="text-sm font-bold text-slate-900">{bc.created_by || "Direction des Achats"}</h4>
              <p className="text-xs text-slate-500">Statut : <span className="font-bold text-indigo-700">{bc.statut}</span></p>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] border-b border-slate-200">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Réf</th>
                  <th className="px-4 py-3">Désignation de l'Article</th>
                  <th className="px-4 py-3 text-center">Quantité</th>
                  <th className="px-4 py-3 text-right">Prix Achat Estimé</th>
                  <th className="px-4 py-3 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(bc.items || []).map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{it.reference || "-"}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{it.designation}</td>
                    <td className="px-4 py-3 text-center font-black font-mono">{it.quantite}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">
                      {formatCurrencyAmount(it.prix_achat_unitaire, "FCFA")}
                    </td>
                    <td className="px-4 py-3 text-right font-black font-mono text-slate-900">
                      {formatCurrencyAmount(it.total_ligne, "FCFA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Total & Notes */}
          <div className="flex justify-between items-start pt-4">
            <div className="max-w-md text-xs text-slate-500 space-y-1">
              <span className="font-bold text-slate-700 block">Notes & Conditions :</span>
              <p>{bc.notes || "Livraison avec bordereau de livraison exigée. Règlement à réception après contrôle de conformité."}</p>
            </div>

            <div className="w-72 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Total HT :</span>
                <span>{formatCurrencyAmount(bc.total_ht, "FCFA")}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-indigo-900 border-t border-indigo-100 pt-2">
                <span>Total TTC :</span>
                <span>{formatCurrencyAmount(bc.total_ttc, "FCFA")}</span>
              </div>
            </div>
          </div>

          {/* Signature Box */}
          <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-200 text-xs">
            <div className="text-center space-y-12">
              <span className="font-bold text-slate-600 block">VISA DIRECTION / ACHATS</span>
              <div className="h-16 border-b border-dashed border-slate-300"></div>
              <span className="text-[10px] text-slate-400">Signature et Cachet</span>
            </div>
            <div className="text-center space-y-12">
              <span className="font-bold text-slate-600 block">ACCUSÉ RÉCEPTION FOURNISSEUR</span>
              <div className="h-16 border-b border-dashed border-slate-300"></div>
              <span className="text-[10px] text-slate-400">Bon pour accord & Date</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
