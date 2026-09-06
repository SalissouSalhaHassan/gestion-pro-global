"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Download, 
  Loader2, 
  FileText, 
  Calendar, 
  User, 
  MapPin, 
  Phone, 
  Mail,
  Info,
  Package,
  ClipboardList,
  MessageCircle,
  QrCode,
  ShieldCheck
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type InvoiceModalProps = {
  invoiceId: string | number;
  initialInvoice?: any;
  onClose: () => void;
};

export default function InvoiceModal({ invoiceId, initialInvoice, onClose }: InvoiceModalProps) {
  const [loading, setLoading] = useState(!initialInvoice);
  const [invoice, setInvoice] = useState<any>(initialInvoice || null);
  const [items, setItems] = useState<any[]>(
    initialInvoice?.facture_items || initialInvoice?.items || []
  );
  const [payments, setPayments] = useState<any[]>(initialInvoice?.paiements || []);
  const [company, setCompany] = useState<any>(initialInvoice?.company || null);
  const [mode, setMode] = useState<'Invoice' | 'BL'>('Invoice');
  const [printFormat, setPrintFormat] = useState<'A4' | 'A5' | 'Ticket'>('A4');
  const [error, setError] = useState<string | null>(null);

  const resolveUnitPrice = (item: any) => {
    const qty = Number(item?.qte || 0);
    const totalTtc = Number(item?.total_item_ttc || 0);
    const puTtc = Number(item?.pu_ttc || 0);
    const puHt = Number(item?.pu_ht || 0);
    const derivedUnitPrice = qty > 0 ? totalTtc / qty : 0;

    if (derivedUnitPrice > 0 && Math.abs(derivedUnitPrice - puTtc) > 0.0001) {
      return derivedUnitPrice;
    }

    return puTtc || puHt || derivedUnitPrice;
  };

  const numberToWordsFr = (total: number) => {
    if (total === 0) return "zéro";
    const ones = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

    const convert = (n: number): string => {
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 70) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return tens[t] + (r === 1 ? ' et ' : (r > 0 ? '-' : '')) + ones[r];
      }
      if (n < 80) return "soixante-" + convert(n - 60);
      if (n < 100) {
        const t = Math.floor(n / 10);
        const r = n % 10;
        return (t === 8 ? "quatre-vingt" : "quatre-vingt-") + (r > 0 ? (t === 8 ? "-" : "") + convert(r) : "");
      }
      if (n < 1000) {
        const c = Math.floor(n / 100);
        const r = n % 100;
        return (c === 1 ? "cent" : ones[c] + " cent") + (r > 0 ? " " + convert(r) : "");
      }
      const m = Math.floor(n / 1000);
      const r = n % 1000;
      return (m === 1 ? "mille" : convert(m) + " mille") + (r > 0 ? " " + convert(r) : "");
    };

    return convert(Math.floor(total)).charAt(0).toUpperCase() + convert(Math.floor(total)).slice(1);
  };

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        if (!initialInvoice) {
          setLoading(true);
        }
        
        // Ensure invoiceId is a valid number
        const numericId = typeof invoiceId === 'string' ? Number(invoiceId) : invoiceId;
        
        if (!numericId || isNaN(numericId)) {
          throw new Error(`ID de facture invalide: ${invoiceId}`);
        }

        // ONE single optimized API call (fetches invoice + items + payments + company info concurrently)
        const response = await fetch(`/api/invoices/${numericId}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `Erreur ${response.status}: Impossible de charger la facture`);
        }
        
        const inv = await response.json();
        if (!isMounted) return;
        
        if (inv.company) {
          setCompany(inv.company);
        }

        const clientRow = Array.isArray(inv.clients) ? inv.clients[0] : inv.clients;
        setInvoice({
          ...inv,
          client_nom: clientRow?.nom || inv.client_nom || "Client Divers",
          client_adresse: clientRow?.adresse || inv.client_adresse || "",
          client_telephone: clientRow?.tel || clientRow?.gsm || inv.client_telephone || "",
          client_email: clientRow?.email || inv.client_email || "",
        });

        // Set items directly from pre-resolved facture_items
        const rawItems = inv.facture_items || inv.items || [];
        const mappedItems = rawItems.map((item: any) => ({
          ...item,
          description: item.description || item.designation || "Article",
          code_art: item.code_art || item.reference || "-",
          depot_origine: item.depot_origine || item.depots?.nom || item.depot?.nom || inv.emplacement || "",
          display_unit_price: resolveUnitPrice(item),
        }));
        setItems(mappedItems);

        // Set payments
        if (Array.isArray(inv.paiements)) {
          setPayments(inv.paiements);
        }
      } catch (err: any) {
        console.error("❌ Error fetching invoice details:", err);
        if (isMounted) {
          setError(err.message || "Erreur lors du chargement de la facture");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (invoiceId) fetchData();

    return () => {
      isMounted = false;
    };
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!invoice) return;
    
    const clientTel = invoice.client_telephone || "";
    // Remove non-numeric characters for WhatsApp link
    const cleanTel = clientTel.replace(/\D/g, '');
    
    const message = `*ETS SALISSOU SALHA*\n\nBonjour ${invoice.client_nom},\n\nVoici votre facture *${invoice.bl_number}* du ${new Date(invoice.date_facture).toLocaleDateString("fr-FR")}.\n\n*Détails:*\n- Total TTC: ${Number(invoice.total_ttc).toLocaleString()} F CFA\n- Montant Payé: ${Number(invoice.montant_paye).toLocaleString()} F CFA\n- Reste à payer: ${Number(invoice.montant_restant).toLocaleString()} F CFA\n\nMerci de votre confiance !`;
    
    const encodedMsg = encodeURIComponent(message);
    const waUrl = cleanTel ? `https://wa.me/${cleanTel}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
    
    window.open(waUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="font-bold text-slate-600">Préparation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center max-w-md">
          <X className="text-red-500 mb-4" size={40} />
          <p className="font-bold text-slate-800 text-center mb-4">{error}</p>
          <button 
            onClick={onClose}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar (Hidden on Print) */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3 print:hidden z-[110]">
        {/* Format Selector */}
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur p-2 rounded-2xl shadow-lg border border-white/20">
          {(['A4', 'A5', 'Ticket'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setPrintFormat(fmt)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                printFormat === fmt 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>

        {/* Mode Selector (Invoice vs BL) */}
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur p-2 rounded-2xl shadow-lg border border-white/20">
          <button
            onClick={() => setMode('Invoice')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              mode === 'Invoice' 
              ? 'bg-emerald-600 text-white shadow-md' 
              : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <FileText size={14} />
            Facture
          </button>
          <button
            onClick={() => setMode('BL')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
              mode === 'BL' 
              ? 'bg-orange-600 text-white shadow-md' 
              : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <ClipboardList size={14} />
            Bon de Livraison
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleWhatsAppShare}
            className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-emerald-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <MessageCircle size={20} />
            WhatsApp
          </button>
          <button 
            onClick={handlePrint}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-indigo-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <Printer size={20} />
            Imprimer
          </button>
          <button 
            onClick={onClose}
            className="bg-white text-slate-400 p-3 rounded-2xl shadow-lg border border-slate-100 hover:text-rose-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Paper Component */}
      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible ${
        printFormat === 'Ticket' ? 'w-[320px] rounded-lg' : 
        printFormat === 'A5' ? 'w-[145mm] rounded-[24px]' : 
        'w-full max-w-[190mm] rounded-[32px]'
      }`}>
        
        <div id="printable-invoice" className="p-4 md:p-6 text-black font-sans leading-tight">
          
          {/* TOP LOGO/INFO */}
          <div className="mb-2">
            <h1 className="text-xl font-black uppercase tracking-tight">{company?.nom_entreprise || "ETS SALISSOU SALHA"}</h1>
            <p className="text-xs font-black uppercase mt-0.5">{company?.adresse || ""}</p>
            <div className="text-[10px] font-medium mt-0.5">
              <p>Tél: {company?.telephone || ""} | NIF: {company?.nif || ""} | RC: {company?.rc || ""}</p>
            </div>
            <div className="w-full h-[1.5px] bg-black mt-2"></div>
          </div>

          {/* SUBTITLE BOX */}
          <div className="bg-[#ebebeb] p-1.5 text-center mb-4 border border-black">
            <h2 className="text-lg font-black uppercase tracking-[0.2em]">{mode === 'Invoice' ? 'RECU DE VENTE' : 'BON DE LIVRAISON'}</h2>
          </div>

          {/* TWO COLUMN DETAILS */}
          <div className="flex justify-between items-start mb-4 text-[11px]">
            <div className="w-1/2 pr-2">
              <h3 className="font-black text-sm mb-1 border-b border-black pb-0.5">{mode === 'Invoice' ? 'Détails de la Vente' : 'Détails du Bon'}</h3>
              <div className="grid grid-cols-[80px_1fr] gap-x-1 gap-y-0.5">
                <span className="font-black">{mode === 'Invoice' ? 'Reçu N°:' : 'BL N°:'}</span> <span>{invoice.bl_number}</span>
                <span className="font-black">{mode === 'Invoice' ? 'Date:' : 'Date BL:'}</span> <span>{new Date(invoice.date_facture).toLocaleDateString("fr-FR")}</span>
                <span className="font-black">Vendeur:</span> <span>{invoice.vendeur || "Admin"}</span>
                {mode === 'Invoice' && (
                  <>
                    <span className="font-black">Point de Vente:</span> <span>{invoice.emplacement || "N/A"}</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-1/2 pl-2">
              <h3 className="font-black text-sm mb-1 border-b border-black pb-0.5">Client</h3>
              <p className="font-black text-sm">{invoice.client_nom || "Client Divers"}</p>
              {invoice.client_adresse && <p className="font-medium text-[10px]">{invoice.client_adresse}</p>}
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div className="mb-3">
            <table className="w-full border border-black border-collapse table-fixed">
              <thead>
                <tr className="bg-[#ebebeb] border-b border-black text-[11px]">
                  {mode === 'Invoice' ? (
                    <>
                      <th className="border-r border-black p-1 text-left font-black w-[55%]">Description</th>
                      <th className="border-r border-black p-1 text-center w-[15%] font-black">Qté</th>
                      <th className="border-r border-black p-1 text-right w-[15%] font-black">PU</th>
                      <th className="p-1 text-right w-[15%] font-black">Total</th>
                    </>
                  ) : (
                    <>
                      <th className="border-r border-black p-1 text-center w-[18%] font-black">Code Art.</th>
                      <th className="border-r border-black p-1 text-left w-[52%] font-black">Désignation</th>
                      <th className="border-r border-black p-1 text-center w-[15%] font-black text-[10px]">Dépôt</th>
                      <th className="p-1 text-center w-[15%] font-black text-[10px]">Qté</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="font-medium text-[11px]">
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-black last:border-b-0">
                    {mode === 'Invoice' ? (
                      <>
                        <td className="border-r border-black p-1 break-words leading-tight">{item.description || item.designation || "Article"}</td>
                        <td className="border-r border-black p-1 text-center font-bold">{Number(item.qte).toFixed(2)}</td>
                        <td className="border-r border-black p-1 text-right">{Number(item.display_unit_price ?? item.pu_ttc ?? item.pu_ht).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="p-1 text-right font-bold">{Number(item.total_item_ttc).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </>
                    ) : (
                      <>
                        <td className="border-r border-black p-1 text-center text-[9px] break-all leading-tight">{item.code_art || "-"}</td>
                        <td className="border-r border-black p-1 break-words leading-tight">{item.description || item.designation || "Article"}</td>
                        <td className="border-r border-black p-1 text-center text-[9px] break-words leading-tight">{item.depot_origine || item.depots?.nom || invoice?.emplacement || "-"}</td>
                        <td className="p-1 text-center font-bold">{Number(item.qte).toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mode === 'Invoice' ? (
            <>
              <p className="italic mb-3 text-[10px] font-medium leading-tight">
                Arrêtée à la somme de : <span className="font-black uppercase">{numberToWordsFr(invoice.total_ttc)}</span> francs CFA.
              </p>

              {(() => {
                const actualPaid = payments ? payments.filter(p => !p.moyen_reglement?.toLowerCase().includes('redit')).reduce((acc, curr) => acc + Number(curr.montant_regle), 0) : 0;
                const actualRemaining = Math.max(0, Number(invoice.total_ttc) - actualPaid);
                
                return (
                  <div className="flex flex-row w-full mb-4 border border-black min-h-[40px]">
                    <div className="flex-1 border-r border-black p-1 text-center bg-[#ebebeb] flex flex-col justify-center overflow-hidden">
                      <span className="font-black uppercase text-[8px] leading-none shrink-0">TOTAL</span>
                      <span className="text-[11px] font-[900] mt-0.5 truncate">{Number(invoice.total_ttc).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex-1 border-r border-black p-1 text-center bg-[#f9f9f9] flex flex-col justify-center overflow-hidden">
                      <span className="font-black uppercase text-[8px] leading-none shrink-0">MONTANT PAYÉ</span>
                      <span className="text-[11px] font-[900] mt-0.5 truncate">{actualPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex-1 p-1 text-center bg-white flex flex-col justify-center overflow-hidden">
                      <span className="font-black uppercase text-[8px] leading-none shrink-0">RESTE À PAYER</span>
                      <span className="text-[11px] font-[900] mt-0.5 truncate">{actualRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-4">
                <h4 className="font-black uppercase text-xs mb-1 underline">Historique des Versements</h4>
                <table className="w-full border border-black border-collapse text-[10px] table-fixed">
                  <thead>
                    <tr className="bg-[#ebebeb] border-b border-black">
                      <th className="border-r border-black p-0.5 w-[30%] font-black">Date</th>
                      <th className="border-r border-black p-0.5 w-[40%] font-black">Moyen</th>
                      <th className="p-0.5 w-[30%] font-black">Versement</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold">
                    {payments.length > 0 ? (
                      payments.map((p, i) => (
                        <tr key={i} className="border-b border-black last:border-b-0">
                          <td className="border-r border-black p-0.5 text-center">{new Date(p.date_operation).toLocaleDateString("fr-FR")}</td>
                          <td className="border-r border-black p-0.5 text-center break-words leading-tight">{p.moyen_reglement || "Espèce"}</td>
                          <td className="p-0.5 text-right px-2 whitespace-nowrap">
                            {p.moyen_reglement?.toLowerCase().includes('redit') ? "0,00" : Number(p.montant_regle).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-b border-black italic"><td colSpan={3} className="p-1 text-center">Aucun versement</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures, SSL QR Code & Official Stamp Area */}
              <div className="mt-8 flex justify-between items-end text-[10px] font-black px-2">
                <div className="text-center w-[150px] border-t border-black pt-2">
                  Signature du Client
                </div>

                {/* QR Code de Vérification SSL */}
                {company?.show_qr_code !== false && (
                  <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-slate-300 bg-white text-center shadow-2xs">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/invoice/${invoice.id}` : `https://gestionpro.app/invoice/${invoice.id}`)}`}
                      alt="QR Code SSL" 
                      className="w-14 h-14 object-contain"
                    />
                    <span className="text-[7px] font-black text-slate-600 uppercase tracking-tight mt-0.5 flex items-center gap-0.5">
                      <ShieldCheck size={9} className="text-emerald-600 inline" />
                      Vérifié SSL
                    </span>
                  </div>
                )}

                <div className="text-center w-[200px] flex flex-col items-center">
                  {company?.cachet_url ? (
                    <div className="relative mb-1">
                      <img
                        src={company.cachet_url}
                        alt="Cachet Officiel"
                        className="h-20 max-w-[170px] object-contain rotate-[-3deg]"
                      />
                    </div>
                  ) : company?.show_stamp !== false ? (
                    <div className="w-24 h-16 rounded-lg border-2 border-dashed border-indigo-700 text-indigo-700 flex flex-col items-center justify-center rotate-[-3deg] mb-1">
                      <span className="text-[7px] font-black uppercase truncate max-w-[85px]">{company?.nom_entreprise?.slice(0, 15) || "DIRECTION"}</span>
                      <span className="text-[6px] font-extrabold uppercase">CACHET OFFICIEL</span>
                      <span className="text-[5px] font-bold">{company?.adresse?.split(",")[0]?.toUpperCase() || "DIRECTION"}</span>
                    </div>
                  ) : (
                    <div className="h-12"></div>
                  )}
                  <div className="w-full border-t border-black pt-1">
                    Cachet & Direction Générale
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-12 flex justify-between items-end text-[10px] font-black px-2">
              <div className="text-center w-[140px] border-t border-black pt-2">
                Signature du Livreur
              </div>

              {/* QR Code de Vérification SSL (BL) */}
              {company?.show_qr_code !== false && (
                <div className="flex flex-col items-center justify-center p-1.5 rounded-lg border border-slate-300 bg-white text-center shadow-2xs">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/invoice/${invoice.id}` : `https://gestionpro.app/invoice/${invoice.id}`)}`}
                    alt="QR Code SSL" 
                    className="w-12 h-12 object-contain"
                  />
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-tight mt-0.5 flex items-center gap-0.5">
                    <ShieldCheck size={8} className="text-emerald-600 inline" />
                    Vérifié SSL
                  </span>
                </div>
              )}

              <div className="text-center w-[180px] flex flex-col items-center">
                {company?.cachet_url && (
                  <img
                    src={company.cachet_url}
                    alt="Cachet"
                    className="h-16 max-w-[150px] object-contain mb-1 rotate-[-2deg]"
                  />
                )}
                <div className="w-full border-t border-black pt-2">
                  <span>Cachet et Signature du Client</span>
                  <span className="italic font-bold block mt-0.5 text-[9px]">(Reçu en bon état)</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes de bas de page & pagination */}
          <div className="mt-6 pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-500">
            <span className="italic max-w-[80%]">{company?.notes_pied_facture || "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 48h."}</span>
            <span className="ticket-hide font-bold text-slate-400">Page 1/1</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; background: none !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice {
            position: absolute; left: 0; top: 0; 
            width: 100% !important;
            padding: ${printFormat === 'Ticket' ? '0' : '5mm'} !important;
            margin: 0 !important; border: none !important;
          }
          .ticket-hide { display: ${printFormat === 'Ticket' ? 'none' : 'block'} !important; }
          @page { 
            size: ${printFormat === 'Ticket' ? '80mm auto' : printFormat === 'A5' ? 'A5 portrait' : 'A4 portrait'}; 
            margin: 0; 
          }
          .bg-[#ebebeb] { background-color: #ebebeb !important; }
          .bg-[#f9f9f9] { background-color: #f9f9f9 !important; }
          .bg-[#f0f0f0] { background-color: #f0f0f0 !important; }
        }
      `}</style>
    </div>
  );
}
