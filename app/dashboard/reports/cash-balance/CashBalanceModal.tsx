"use client";

import { useEffect, useState } from "react";
import { 
  X, 
  Printer, 
  Loader2, 
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar,
  User,
  ShieldCheck,
  FileText,
  MapPin,
  ClipboardList
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type CashBalanceModalProps = {
  filters: { start: string; end: string; cashier: string };
  onClose: () => void;
};

export default function CashBalanceModal({ filters, onClose }: CashBalanceModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [pageSize, setPageSize] = useState<'A4' | 'A5' | 'Ticket'>('A4');
  const [docType, setDocType] = useState<'Journal' | 'Bilan Recap'>('Journal');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        try {
          const compRes = await fetch("/api/settings/company");
          if (compRes.ok) {
            const compJson = await compRes.json();
            if (compJson.company) {
              setCompany(compJson.company);
            }
          }
        } catch (e) {
          console.warn("Failed fetching /api/settings/company in CashBalanceModal:", e);
        }

        if (!company) {
          const { data: comp } = await supabase
            .from("informations_entreprise")
            .select("*")
            .limit(1)
            .maybeSingle();
          if (comp) setCompany(comp);
        }

        const params = new URLSearchParams({
            start: filters.start,
            end: filters.end,
            cashier: filters.cashier
        });
        const res = await fetch(`/api/reports/cash-balance?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        setData(json);

      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [filters]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="font-bold text-slate-600 font-outfit text-sm">Génération du rapport financier...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-900/60 backdrop-blur-md overflow-hidden print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* Action Bar */}
      <div className="absolute top-6 right-6 flex items-center gap-3 print:hidden z-[110]">
        <button 
          onClick={handlePrint}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3 rounded-2xl font-black shadow-xl shadow-indigo-500/30 flex items-center gap-2 transition-all text-sm cursor-pointer"
        >
          <Printer size={18} />
          Imprimer le Bilan
        </button>
        <button 
          onClick={onClose}
          className="bg-white text-slate-500 hover:text-rose-600 p-3 rounded-2xl shadow-lg border border-slate-100 transition-all cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Report Paper Component */}
      <div className={`bg-white h-auto overflow-y-auto custom-scrollbar shadow-2xl print:shadow-none print:rounded-none print:w-full print:h-auto print:overflow-visible transition-all duration-500 ${
        pageSize === 'A4' ? 'max-w-[210mm]' : pageSize === 'Ticket' ? 'max-w-[80mm]' : 'max-w-[148mm]'
      } w-full rounded-[40px] border border-slate-100 print:border-none`}>
              <div id="printable-report" className="p-8 text-slate-900 bg-white font-sans leading-tight relative">
          
          {/* HEADER */}
          <div className="pb-4 border-b border-black">
            <h1 className="text-xl font-bold uppercase tracking-tight text-black">
              {company?.nom_entreprise || "ENTREPRISE"}
            </h1>
            <p className="text-xs uppercase text-slate-800 mt-0.5">
              {company?.adresse || ""}
            </p>
            {company?.telephone && (
              <p className="text-[11px] text-slate-800">
                Tél: {company.telephone}
              </p>
            )}
            {company?.email && (
              <p className="text-[11px] text-slate-800">
                Email: {company.email}
              </p>
            )}
            <p className="text-[11px] text-slate-800">
              NIF: {company?.nif || "-"} | RC: {company?.rc || "-"}
            </p>
          </div>

          {/* TITLE BAR */}
          <div className="my-4 py-2 bg-[#f1f1f1] text-center">
            <h2 className="text-base font-bold uppercase tracking-wide text-black">
              BILAN DE CAISSE
            </h2>
          </div>

          {/* CRITÈRES DU RAPPORT */}
          <div className="mb-4 text-xs">
            <h3 className="font-bold underline mb-1.5 text-black">
              Critères du Rapport
            </h3>
            <div className="grid grid-cols-2 gap-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-800">Période :</span>
                <span className="font-bold text-black">
                  {new Date(filters.start).toLocaleDateString("fr-FR")} → {new Date(filters.end).toLocaleDateString("fr-FR")}
                </span>
              </div>
              <div></div>
              <div className="flex items-center gap-2">
                <span className="text-slate-800">Caissier :</span>
                <span className="font-bold text-black">
                  {filters.cashier || "Tous"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-800">Type de Bilan :</span>
                <span className="font-bold text-black">
                  Total / Complet
                </span>
              </div>
            </div>
          </div>

          {/* 1. TABLEAU DES RECETTES & MOUVEMENTS */}
          <div className="mb-6">
            <h3 className="font-bold text-xs mb-1.5 text-black">
              Détail des Recettes & Mouvements (Factures, Dépôts, Loyers)
            </h3>
            <table className="w-full text-left border-collapse border border-black text-[11px]">
              <thead>
                <tr className="bg-[#e5e5e5] border-b border-black text-black font-bold">
                  <th className="p-1.5 border border-black">Date</th>
                  <th className="p-1.5 border border-black">Type</th>
                  <th className="p-1.5 border border-black">Réf. Doc</th>
                  <th className="p-1.5 border border-black">Client / Tiers</th>
                  <th className="p-1.5 border border-black text-right">Total Doc</th>
                  <th className="p-1.5 border border-black text-right">Montant</th>
                  <th className="p-1.5 border border-black text-right">Reste</th>
                  <th className="p-1.5 border border-black">Caissier</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const recettes = (data?.entries || []).filter((e: any) => Number(e.entree || 0) > 0);
                  if (recettes.length === 0) {
                    return (
                      <tr>
                        <td colSpan={8} className="p-2 text-center text-slate-500 border border-black">
                          Aucune recette sur cette période
                        </td>
                      </tr>
                    );
                  }
                  return recettes.map((r: any, idx: number) => {
                    const totalDoc = r.total_doc ? Number(r.total_doc) : 0;
                    const reste = r.reste ? Number(r.reste) : 0;
                    const amount = Number(r.entree || 0);

                    return (
                      <tr key={idx} className="border-b border-black">
                        <td className="p-1.5 border border-black font-normal">
                          {new Date(r.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="p-1.5 border border-black font-normal">
                          {r.type}
                        </td>
                        <td className="p-1.5 border border-black font-normal">
                          {r.ref}
                        </td>
                        <td className="p-1.5 border border-black font-normal">
                          {r.client || "-"}
                        </td>
                        <td className="p-1.5 border border-black text-right font-normal">
                          {totalDoc > 0 ? new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(totalDoc) : "-"}
                        </td>
                        <td className="p-1.5 border border-black text-right font-bold">
                          {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(amount)}
                        </td>
                        <td className="p-1.5 border border-black text-right font-normal">
                          {reste > 0 ? new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(reste) : "-"}
                        </td>
                        <td className="p-1.5 border border-black font-normal">
                          {r.user || "Caisse"}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* 2. TABLEAU DES DÉPENSES */}
          <div className="mb-6">
            <h3 className="font-bold text-xs mb-1.5 text-black">
              Détail des Dépenses
            </h3>
            <table className="w-full text-left border-collapse border border-black text-[11px]">
              <thead>
                <tr className="bg-[#e5e5e5] border-b border-black text-black font-bold">
                  <th className="p-1.5 border border-black w-24">Date</th>
                  <th className="p-1.5 border border-black w-24">N° Caisse</th>
                  <th className="p-1.5 border border-black">Libellé</th>
                  <th className="p-1.5 border border-black w-32">Opérateur</th>
                  <th className="p-1.5 border border-black text-right w-32">Montant</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const depenses = (data?.entries || []).filter((e: any) => Number(e.sortie || 0) > 0);
                  if (depenses.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} className="p-2 text-center text-slate-500 border border-black">
                          Aucune dépense sur cette période
                        </td>
                      </tr>
                    );
                  }
                  return depenses.map((d: any, idx: number) => {
                    const amount = Number(d.sortie || 0);
                    return (
                      <tr key={idx} className="border-b border-black">
                        <td className="p-1.5 border border-black font-normal">
                          {new Date(d.date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="p-1.5 border border-black font-normal">
                          {d.ref || "1"}
                        </td>
                        <td className="p-1.5 border border-black font-normal">
                          {d.type || d.libelle || "Dépense Caisse"}
                        </td>
                        <td className="p-1.5 border border-black font-normal">
                          {d.user || "Caisse"}
                        </td>
                        <td className="p-1.5 border border-black text-right font-bold">
                          {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(amount)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* 3. TOTALS & SUMMARY BOXES */}
          <div className="flex justify-end mb-12">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-end gap-3">
                <span className="font-bold text-black uppercase tracking-tight">TOTAL ENCAISSÉ (CFA) :</span>
                <div className="w-44 p-1.5 border border-black text-right font-bold bg-white text-black">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(data?.summary?.totalIncome || 0)}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <span className="font-bold text-black uppercase tracking-tight">TOTAL DÉPENSES (CFA) :</span>
                <div className="w-44 p-1.5 border border-black text-right font-bold bg-white text-black">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(data?.summary?.totalExpenses || 0)}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <span className="font-bold text-black uppercase tracking-tight">SOLDE DE CAISSE (CFA) :</span>
                <div className="w-44 p-1.5 border border-black text-right font-bold bg-[#c7e5c9] text-emerald-900">
                  {new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2 }).format(data?.summary?.netBalance || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* 4. CACHET ET SIGNATURE */}
          <div className="flex justify-end pt-6">
            <div className="w-64 text-center">
              <div className="border-b border-black mb-1.5 pb-1"></div>
              <span className="text-xs font-bold text-black">Cachet et Signature</span>
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
        
        @media print {
          body * {
            visibility: hidden;
            background: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-report, #printable-report * {
            visibility: visible;
          }
          #printable-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: ${pageSize === 'Ticket' ? '4mm' : '10mm'} !important;
            margin: 0 !important;
            font-family: 'Outfit', sans-serif !important;
          }
          @page {
            size: ${pageSize === 'Ticket' ? '80mm 200mm' : pageSize === 'A4' ? 'A4 portrait' : 'A5 portrait'};
            margin: 0;
          }
          .bg-slate-900 { background-color: #0f172a !important; color: #fff !important; }
          .bg-indigo-600 { background-color: #4f46e5 !important; color: #fff !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          .bg-amber-50 { background-color: #fef3c7 !important; }
          .bg-indigo-50 { background-color: #eef2ff !important; }
          .text-emerald-600 { color: #059669 !important; }
          .text-rose-600 { color: #e11d48 !important; }
          .text-amber-600 { color: #d97706 !important; }
        }
      `}</style>
    </div>
  );
}

function Phone({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.19-1.32a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    )
}
