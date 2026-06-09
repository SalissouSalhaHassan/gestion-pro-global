"use client";
// Rapport Groupé par Bien — v2 — 2026-06-09
import { useEffect, useState, useMemo } from "react";
import { X, Printer, Loader2, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type RapportProps = {
  onClose: () => void;
};

type ContractRow = {
  id: number;
  locataire_nom_complet: string;
  locataire_telephone?: string;
  loyer_mensuel: number;
  bien_loue_details: string;
  quartier?: string;
  type_bien?: string;
  statut: string;
  retards?: number;
  total_paye?: number;
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

export default function LoyerReportModal({ onClose }: RapportProps) {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [company, setCompany] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<"A4" | "A5">("A4");
  const [filterStatut, setFilterStatut] = useState<"Tous" | "Actif" | "Expiré">("Tous");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Company info
        const { data: compData } = await supabase
          .from("informations_entreprise")
          .select("*")
          .limit(1);
        setCompany(compData?.[0] ?? null);

        // All contracts via API
        const res = await fetch("/api/loyers");
        if (!res.ok) throw new Error("Erreur chargement contrats");
        const data: ContractRow[] = await res.json();
        setContracts(data);
      } catch (err: any) {
        setError(err.message || "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter by statut
  const filtered = useMemo(() => {
    if (filterStatut === "Tous") return contracts;
    return contracts.filter((c) => c.statut === filterStatut);
  }, [contracts, filterStatut]);

  // Group by bien_loue_details (property name)
  const grouped = useMemo(() => {
    const map = new Map<string, ContractRow[]>();
    for (const c of filtered) {
      const key = (c.bien_loue_details || "Autre").trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [filtered]);

  const today = new Date();
  const totalImpaye = filtered.reduce((s, c) => s + (c.retards || 0), 0);
  const totalMensuel = filtered.reduce((s, c) => s + (c.loyer_mensuel || 0), 0);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center">
          <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
          <p className="font-bold text-slate-600">Préparation du rapport...</p>
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

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 md:p-8 bg-slate-900/70 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none">
      
      {/* ── Action Bar (hidden on print) ── */}
      <div className="fixed top-5 right-5 flex flex-col items-end gap-3 print:hidden z-[110]">
        {/* Format selector */}
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur p-1.5 rounded-2xl shadow-lg border border-white/30">
          {(["A4", "A5"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPrintFormat(f)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                printFormat === f
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Statut filter */}
        <div className="flex items-center gap-1 bg-white/90 backdrop-blur p-1.5 rounded-2xl shadow-lg border border-white/30">
          {(["Tous", "Actif", "Expiré"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatut(s)}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${
                filterStatut === s
                  ? s === "Tous"
                    ? "bg-slate-800 text-white"
                    : s === "Actif"
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-500 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Print & Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="bg-indigo-600 text-white px-5 py-3 rounded-2xl font-black shadow-xl shadow-indigo-500/30 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
          >
            <Printer size={18} /> Imprimer
          </button>
          <button
            onClick={onClose}
            className="bg-white text-slate-400 p-3 rounded-2xl shadow-lg border border-slate-100 hover:text-rose-500 transition-colors"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* ── Paper ── */}
      <div
        id="printable-report"
        className={`bg-white shadow-2xl print:shadow-none print:rounded-none print:w-full mt-4 mb-16 print:mt-0 print:mb-0 ${
          printFormat === "A5"
            ? "w-full max-w-[148mm] rounded-[20px]"
            : "w-full max-w-[210mm] rounded-[28px]"
        }`}
      >
        <div className="p-6 md:p-8 text-black font-sans">

          {/* ── En-tête société ── */}
          <div className="text-center mb-3">
            <h1 className="text-xl font-black uppercase tracking-tight">
              {company?.nom_entreprise || "GestionPro"}
            </h1>
            {company?.adresse && (
              <p className="text-xs font-semibold text-gray-600 mt-0.5">{company.adresse}</p>
            )}
            {company?.telephone && (
              <p className="text-xs text-gray-500">Tél: {company.telephone}</p>
            )}
            <div className="w-full h-[2px] bg-black mt-2" />
          </div>

          {/* ── Titre rapport ── */}
          <div className="bg-gray-200 border border-black text-center py-2 px-4 mb-4">
            <h2 className="text-base font-black uppercase tracking-[0.18em]">
              ÉTAT DES LOCATAIRES — LISTE GÉNÉRALE
            </h2>
            <p className="text-[10px] text-gray-600 font-semibold mt-0.5">
              {filterStatut !== "Tous" ? `Filtre : ${filterStatut} — ` : ""}
              Imprimé le {today.toLocaleDateString("fr-FR")} à{" "}
              {today.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          {/* ── Sections par bien ── */}
          {grouped.size === 0 ? (
            <p className="text-center text-gray-500 font-bold py-8">
              Aucun contrat trouvé.
            </p>
          ) : (
            Array.from(grouped.entries()).map(([bien, rows], gi) => {
              const totalBien = rows.reduce((s, r) => s + r.loyer_mensuel, 0);
              const impayes = rows.filter((r) => (r.retards ?? 0) > 0);
              return (
                <div key={gi} className="mb-6 avoid-break">
                  {/* Section title */}
                  <h3 className="text-sm font-black underline mb-1">
                    Liste de{" "}
                    {rows[0]?.type_bien
                      ? rows[0].type_bien.toLowerCase() + "s"
                      : "biens"}{" "}
                    — {bien}
                    {rows[0]?.quartier ? ` (${rows[0].quartier})` : ""}
                  </h3>

                  {/* Table */}
                  <table className="w-full border border-black border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-blue-100 border-b border-black">
                        <th className="border-r border-black px-2 py-1 text-center font-black w-8">N°</th>
                        <th className="border-r border-black px-2 py-1 text-left font-black">Noms</th>
                        <th className="border-r border-black px-2 py-1 text-right font-black w-24">Prix (F)</th>
                        <th className="px-2 py-1 text-center font-black w-28">Contacts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, ri) => {
                        const isImpaye = (r.retards ?? 0) > 0;
                        return (
                          <tr
                            key={r.id}
                            className={`border-b border-black last:border-b-0 ${
                              isImpaye ? "text-red-600" : "text-black"
                            }`}
                          >
                            <td className="border-r border-black px-2 py-1 text-center font-bold">
                              {ri + 1}
                            </td>
                            <td className="border-r border-black px-2 py-1 font-semibold">
                              {r.locataire_nom_complet}
                              {r.statut === "Expiré" && (
                                <span className="ml-1 text-[9px] font-black text-amber-600">[EXPIRÉ]</span>
                              )}
                            </td>
                            <td className="border-r border-black px-2 py-1 text-right font-bold">
                              {fmt(r.loyer_mensuel)}
                            </td>
                            <td className="px-2 py-1 text-center">
                              {r.locataire_telephone || ""}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Subtotal row */}
                      <tr className="bg-gray-100 border-t-2 border-black">
                        <td colSpan={2} className="border-r border-black px-2 py-1 font-black text-[10px] text-right uppercase">
                          Sous-total ({rows.length} locataire{rows.length > 1 ? "s" : ""})
                        </td>
                        <td className="border-r border-black px-2 py-1 text-right font-black">
                          {fmt(totalBien)}
                        </td>
                        <td className="px-2 py-1 text-center text-[10px] font-bold text-red-600">
                          {impayes.length > 0 ? `${impayes.length} impayé(s)` : "✓ À jour"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })
          )}

          {/* ── Récapitulatif global ── */}
          <div className="mt-6 border border-black">
            <div className="bg-gray-200 border-b border-black px-3 py-1.5">
              <span className="text-sm font-black uppercase tracking-wide">RÉCAPITULATIF GÉNÉRAL</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-black text-center text-[11px]">
              <div className="px-3 py-2">
                <p className="font-black text-gray-500 uppercase text-[9px] mb-0.5">Total Locataires</p>
                <p className="text-lg font-black">{filtered.length}</p>
              </div>
              <div className="px-3 py-2">
                <p className="font-black text-gray-500 uppercase text-[9px] mb-0.5">Total Loyers / Mois</p>
                <p className="text-lg font-black">{fmt(totalMensuel)} F</p>
              </div>
              <div className="px-3 py-2">
                <p className="font-black text-red-500 uppercase text-[9px] mb-0.5">Total Impayés</p>
                <p className={`text-lg font-black ${totalImpaye > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {totalImpaye > 0 ? `${fmt(totalImpaye)} F` : "Rien"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Légende ── */}
          <div className="mt-4 flex items-center gap-6 text-[9px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-red-100 border border-red-400 rounded-sm" />
              Locataire avec impayés
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-white border border-black rounded-sm" />
              Locataire à jour
            </span>
          </div>

          {/* ── Pied de page ── */}
          <div className="mt-6 text-center text-[9px] text-gray-400 border-t border-gray-200 pt-3">
            <p>
              Document généré le {today.toLocaleDateString("fr-FR")} par GestionPro •{" "}
              {grouped.size} propriété{grouped.size > 1 ? "s" : ""} •{" "}
              {filtered.length} locataire{filtered.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* ── Print CSS ── */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
            background: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-report,
          #printable-report * {
            visibility: visible !important;
          }
          #printable-report {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 8mm !important;
            margin: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          @page {
            size: ${printFormat === "A5" ? "A5 portrait" : "A4 portrait"};
            margin: 0;
          }
          .avoid-break {
            page-break-inside: avoid;
          }
          .bg-blue-100 { background-color: #dbeafe !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-gray-200 { background-color: #e5e7eb !important; }
        }
      `}</style>
    </div>
  );
}
