"use client";

import { useState } from "react";
import { X, CheckCircle2, Wallet, MessageCircle, Printer, Loader2 } from "lucide-react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { openWhatsAppDirect } from "@/lib/utils/whatsapp";

type PayoutModalProps = {
  seller: any;
  month: string;
  onClose: () => void;
  onPaid: () => void;
};

export default function PayoutModal({ seller, month, onClose, onPaid }: PayoutModalProps) {
  const [amount, setAmount] = useState<number>(seller.soldeRestant || seller.commissionTotale || 0);
  const [paymentMethod, setPaymentMethod] = useState("Espèces");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [payoutSuccess, setPayoutSuccess] = useState<any>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      alert("Montant invalide");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/commissions/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: seller.userId,
          mois_annee: month,
          montant_paye: amount,
          moyen_paiement: paymentMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de paiement");

      setPayoutSuccess(data.payout);
      onPaid();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSendWhatsApp = () => {
    const msg =
      `💰 *REÇU DE COMMISSION - GESTION PRO GLOBAL*\n\n` +
      `Bénéficiaire : *${seller.nom}*\n` +
      `Période : *${month}*\n` +
      `Chiffre d'Affaires Réalisé : *${Number(seller.totalVentes).toLocaleString()} FCFA*\n` +
      `Commission Versée : *${Number(amount).toLocaleString()} FCFA*\n` +
      `Mode : *${paymentMethod}*\n` +
      `Référence : \`${payoutSuccess?.reference_recu || "REG-PAID"}\`\n\n` +
      `Félicitations pour vos performances commerciales !`;

    openWhatsAppDirect(phone || "", msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500 text-slate-950">
              <Wallet size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-white">
                Règlement de Commission
              </h3>
              <p className="text-[11px] text-slate-400 font-bold">{seller.nom}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={16} />
          </button>
        </div>

        {payoutSuccess ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900">Règlement Validé avec Succès !</h4>
              <p className="text-xs text-slate-500 font-mono mt-1">
                Réf : {payoutSuccess.reference_recu}
              </p>
              <div className="text-xl font-black text-emerald-600 font-mono mt-2">
                {formatCurrencyAmount(amount, "FCFA")}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <input
                type="text"
                placeholder="Téléphone / WhatsApp de l'employé"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-center"
              />
              <button
                onClick={handleSendWhatsApp}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm"
              >
                <MessageCircle size={15} />
                <span>Envoyer le Reçu sur WhatsApp</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handlePay} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block font-bold text-[10px] uppercase">Commission Due</span>
                <span className="font-black text-slate-900 font-mono">
                  {formatCurrencyAmount(seller.commissionTotale, "FCFA")}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold text-[10px] uppercase">Solde à Payer</span>
                <span className="font-black text-amber-700 font-mono">
                  {formatCurrencyAmount(seller.soldeRestant, "FCFA")}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                Montant à Verser (FCFA) *
              </label>
              <input
                type="number"
                min="100"
                max={seller.soldeRestant || seller.commissionTotale}
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-mono font-black text-slate-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-black uppercase text-slate-600 block mb-1.5">
                Mode de Paiement
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-800 bg-white"
              >
                <option value="Espèces">Espèces (Caisse)</option>
                <option value="Mobile Money">Mobile Money (Airtel / Moov / Orange)</option>
                <option value="Virement">Virement Bancaire</option>
                <option value="Chèque">Chèque</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-600"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md flex items-center gap-1.5"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
                <span>Confirmer le Versement</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
