"use client";

import { useEffect, useState, use } from "react";
import { formatCurrencyAmount } from "@/lib/utils/currency";
import { formatDateTime } from "@/lib/utils/datetime";
import {
  FileText,
  Printer,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Smartphone,
  Share2,
} from "lucide-react";
import CheckoutDemoModal from "@/components/CheckoutDemoModal";

export default function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;
  
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    // Fetch public invoice details
    fetch(`/api/invoices/${invoiceId}`)
      .then((r) => r.json())
      .then((data) => {
        setInvoice(data.invoice || data);
      })
      .catch((err) => {
        console.error("Failed to load public invoice", err);
      })
      .finally(() => setLoading(false));
  }, [invoiceId]);

  const mockTotal = Number(invoice?.total_ttc || 150000);
  const mockPaid = Number(invoice?.montant_paye || 150000);
  const mockReste = Math.max(0, mockTotal - mockPaid);
  const isPaid = mockReste <= 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutDemoModal
          invoiceId={invoiceId}
          amount={mockReste > 0 ? mockReste : mockTotal}
          clientName={invoice?.clients?.nom || "Client"}
          currency="FCFA"
          onSuccess={() => {
            setShowCheckout(false);
            if (invoice) setInvoice({ ...invoice, montant_paye: mockTotal, reste_a_payer: 0 });
          }}
          onClose={() => setShowCheckout(false)}
        />
      )}

      {/* Main Invoice Card */}
      <div className="w-full max-w-2xl bg-white text-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-sm">
                GP
              </span>
              <span className="font-extrabold text-base tracking-tight text-white">
                {invoice?.company_name || "GESTION PRO GLOBAL"}
              </span>
            </div>
            <h1 className="text-2xl font-black text-white">Facture #{invoiceId}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Émise le {formatDateTime(invoice?.date_creation || new Date(), "fr")}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end">
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                isPaid
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              {isPaid ? <CheckCircle2 size={14} /> : <Clock size={14} />}
              {isPaid ? "Facture Payée" : "En Attente de Règlement"}
            </span>
            <div className="text-2xl font-black text-emerald-400 mt-2 font-mono">
              {formatCurrencyAmount(mockTotal, "FCFA", "fr")}
            </div>
          </div>
        </div>

        {/* Client & Company Details */}
        <div className="p-6 sm:p-8 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/50">
          <div>
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              Facturé à :
            </span>
            <h3 className="text-base font-black text-slate-900 mt-1">
              {invoice?.clients?.nom || invoice?.client_nom || "Client Partenaire"}
            </h3>
            {invoice?.clients?.tel && (
              <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                <Phone size={12} /> {invoice.clients.tel}
              </p>
            )}
          </div>

          <div className="sm:text-right">
            <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
              Moyen de Paiement :
            </span>
            <div className="text-sm font-black text-slate-800 mt-1">
              {invoice?.mode_paiement || "Espèce / Mobile Money"}
            </div>
            <div className="text-xs font-bold text-slate-500 mt-0.5">
              Ref: FAC-{invoiceId}-2026
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-600">Total Net TTC</span>
            <span className="font-black text-slate-900">{formatCurrencyAmount(mockTotal, "FCFA", "fr")}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-600">Montant Déjà Réglé</span>
            <span className="font-black text-emerald-600">{formatCurrencyAmount(mockPaid, "FCFA", "fr")}</span>
          </div>
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-base">
            <span className="font-black text-slate-900">Reste à Payer</span>
            <span className={`font-black ${mockReste > 0 ? "text-amber-600" : "text-slate-400"}`}>
              {formatCurrencyAmount(mockReste, "FCFA", "fr")}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => window.print()}
            className="w-full sm:flex-1 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-extrabold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Printer size={16} />
            Imprimer la Facture
          </button>

          {!isPaid && (
            <button
              onClick={() => setShowCheckout(true)}
              className="w-full sm:flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <CreditCard size={16} />
              Payer en Ligne (Mobile Money / Carte)
            </button>
          )}
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 font-medium mt-6 flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-emerald-500" />
        Portail de Facturation Sécurisé • GestionPro Global Cloud
      </div>
    </div>
  );
}
