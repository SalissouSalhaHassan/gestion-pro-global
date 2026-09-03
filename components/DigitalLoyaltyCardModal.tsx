"use client";

import { useState } from "react";
import {
  X,
  Printer,
  MessageCircle,
  Sparkles,
  Award,
  Crown,
  CreditCard,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  Copy
} from "lucide-react";
import Barcode from "react-barcode";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

type ClientLoyalty = {
  id: string | number;
  nom: string;
  tel?: string | null;
  carte_fidelite_numero?: string | null;
  points_fidelite?: number;
  niveau_fidelite?: string;
};

type DigitalLoyaltyCardModalProps = {
  client: ClientLoyalty;
  onClose: () => void;
};

export default function DigitalLoyaltyCardModal({ client, onClose }: DigitalLoyaltyCardModalProps) {
  const [copied, setCopied] = useState(false);

  const cardNumber =
    client.carte_fidelite_numero ||
    `LOYAL-2026-${String(client.id).padStart(4, "0")}`;

  const points = Number(client.points_fidelite) || 0;
  const equivalentFCFA = points * 10;
  const tier = (client.niveau_fidelite || "BRONZE").toUpperCase();

  const getTierGradient = () => {
    switch (tier) {
      case "PLATINE":
        return "from-slate-900 via-purple-950 to-slate-900 border-purple-400/40 text-purple-200";
      case "OR":
        return "from-amber-950 via-yellow-900 to-amber-950 border-amber-400/40 text-amber-200";
      case "ARGENT":
        return "from-slate-800 via-slate-700 to-slate-900 border-slate-300/40 text-slate-200";
      default:
        return "from-amber-950/80 via-stone-900 to-stone-950 border-amber-600/30 text-amber-300";
    }
  };

  const getTierIcon = () => {
    if (tier === "PLATINE" || tier === "OR") return <Crown size={22} className="text-amber-400" />;
    return <Award size={22} className="text-indigo-400" />;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyNumber = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(cardNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleSendWhatsApp = () => {
    const message =
      `💳 *CARTE DE FIDÉLITÉ VIP - ETS SALISSOU SALHA*\n\n` +
      `Cher(e) *${client.nom}*,\n\n` +
      `Voici votre carte de fidélité officielle :\n` +
      `*N° Carte :* \`${cardNumber}\`\n` +
      `*Statut :* ⭐ ${tier}\n` +
      `*Solde de Points :* *${points.toLocaleString()} points*\n` +
      `*Valeur de remise immédiate :* *${equivalentFCFA.toLocaleString()} FCFA*\n\n` +
      `Présentez ce numéro ou le code-barres lors de vos prochains passages en caisse pour bénéficier de réductions immédiates !\n\n` +
      `Merci de votre fidélité !`;

    openWhatsAppDirect(client.tel || "", message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto print:border-none print:shadow-none animate-in zoom-in-95 duration-200">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="bg-slate-900 p-4 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-amber-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Passe de Fidélité Digital VIP
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Digital Card Preview Box */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* THE LUXURY 3D CARD */}
          <div
            className={`w-full aspect-[1.586/1] rounded-3xl p-6 sm:p-7 bg-gradient-to-br ${getTierGradient()} border shadow-2xl relative overflow-hidden flex flex-col justify-between text-white select-none`}
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            {/* Top Bar of Card */}
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-80 block">
                  GESTION PRO GLOBAL
                </span>
                <span className="text-xs font-extrabold text-white">
                  VIP PRIVILEGE CLUB
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/20">
                {getTierIcon()}
                <span className="text-xs font-black tracking-wider text-amber-300 font-mono">
                  {tier}
                </span>
              </div>
            </div>

            {/* Card Chip & Balance */}
            <div className="flex items-center justify-between relative z-10 py-2">
              <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-amber-300 via-yellow-200 to-amber-500 border border-amber-200/60 shadow-inner flex items-center justify-center">
                <div className="w-7 h-5 border border-amber-900/30 rounded-xs grid grid-cols-2 gap-0.5 opacity-60">
                  <div className="border-r border-amber-900/30" />
                  <div />
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-white/70 block">
                  Solde de Points
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-white">
                  {points.toLocaleString()} <span className="text-xs font-bold text-amber-400">PTS</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-300 block font-mono">
                  ≈ {formatCurrencyAmount(equivalentFCFA, "FCFA")}
                </span>
              </div>
            </div>

            {/* Bottom Bar: Client Name & Card Number */}
            <div className="space-y-1 relative z-10 border-t border-white/10 pt-3">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-[9px] uppercase font-bold text-white/60 block">
                    TITULAIRE DU COMPTE
                  </span>
                  <span className="text-sm font-black uppercase tracking-wider text-white">
                    {client.nom}
                  </span>
                </div>
                <span className="font-mono text-xs font-black tracking-widest text-amber-300/90">
                  {cardNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Barcode Strip For Fast Counter Scanning */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs text-center space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              Scannez le code au comptoir pour identifier le client
            </span>
            <div className="flex justify-center py-1">
              <Barcode
                value={cardNumber}
                width={1.6}
                height={42}
                fontSize={11}
                background="#ffffff"
                lineColor="#0f172a"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 print:hidden">
            <button
              onClick={handleSendWhatsApp}
              className="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle size={16} />
              <span>Envoyer sur WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="w-full sm:w-auto py-3 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>Imprimer A4 / Badge</span>
            </button>

            <button
              onClick={handleCopyNumber}
              className="w-full sm:w-auto p-3 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer flex items-center justify-center"
              title="Copier le numéro"
            >
              {copied ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
