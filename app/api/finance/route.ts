import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (v: any) => Number(v || 0);

function inRange(dateValue: string | null | undefined, start?: string | null, end?: string | null) {
  if (!dateValue) return false;
  const d = dateValue.slice(0, 10);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

function bucketLabel(dateValue: string, period: string) {
  const d = new Date(dateValue);
  if (period === "annee") return String(d.getFullYear());
  if (period === "mois") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (period === "semaine") {
    const first = new Date(d.getFullYear(), 0, 1);
    const days = Math.floor((d.getTime() - first.getTime()) / 86400000);
    return `S${String(Math.ceil((days + first.getDay() + 1) / 7)).padStart(2, "0")}`;
  }
  return dateValue.slice(0, 10);
}

function statusOf(expected: number, paid: number) {
  if (paid >= expected && expected > 0) return "Payé";
  if (paid > 0) return "Partiel";
  return "Impayé";
}

function groupSum(rows: any[], key: string, valueKey = "montantPaye") {
  const map = new Map<string, number>();
  rows.forEach((r) => map.set(r[key] || "Non défini", (map.get(r[key] || "Non défini") || 0) + money(r[valueKey])));
  return Array.from(map, ([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const start = searchParams.get("start") || iso(new Date(now.getFullYear(), now.getMonth(), 1));
    const end = searchParams.get("end") || iso(now);
    const period = searchParams.get("period") || "jour";
    const isPrivileged = await isAdminOrManager(session);
    const cashier = isPrivileged ? searchParams.get("cashier") : session.username;

    let invoiceQuery = supabase
      .from("factures")
      .select("id, bl_number, date_facture, total_ttc, montant_paye, montant_restant, statut, mode_paiement, vendeur, emplacement, clients(nom)")
      .neq("statut", "Annulée")
      .gte("date_facture", start)
      .lte("date_facture", end)
      .order("date_facture", { ascending: false });
    if (cashier && cashier !== "Tous") invoiceQuery = invoiceQuery.eq("vendeur", cashier);
    const { data: invoices, error: invoicesError } = await invoiceQuery;
    if (invoicesError) throw invoicesError;

    let paymentQuery = supabase
      .from("paiements")
      .select("id, date_operation, montant_regle, moyen_reglement, utilisateur, reference_paiement, factures(bl_number, date_facture, total_ttc, emplacement, vendeur, clients(nom))")
      .neq("moyen_reglement", "Crédit")
      .gte("date_operation", start)
      .lte("date_operation", end)
      .order("date_operation", { ascending: false });
    if (cashier && cashier !== "Tous") paymentQuery = paymentQuery.eq("utilisateur", cashier);
    const { data: payments } = await paymentQuery;

    let expenses: any[] = [];
    try {
      let q = supabase.from("depenses").select("date_depense, montant, operateur, emplacement").gte("date_depense", start).lte("date_depense", end);
      if (cashier && cashier !== "Tous") q = q.eq("operateur", cashier);
      const { data } = await q;
      expenses = data || [];
    } catch {}

    const rows = (invoices || []).map((f: any, index: number) => {
      const client = Array.isArray(f.clients) ? f.clients[0] : f.clients;
      const expected = money(f.total_ttc);
      const paid = money(f.montant_paye);
      const status = statusOf(expected, paid);
      return {
        no: index + 1,
        reference: f.bl_number || `F-${f.id}`,
        eleve: client?.nom || "Client / élève",
        classe: f.emplacement || "Général",
        niveau: f.emplacement || "Standard",
        secteur: f.emplacement || "Général",
        montantAttendu: expected,
        montantPaye: paid,
        reste: Math.max(0, expected - paid),
        statut: status,
        date: f.date_facture,
        modePaiement: f.mode_paiement || "Non défini",
        caissier: f.vendeur || "Non défini",
        referencePaiement: f.bl_number || `F-${f.id}`,
        observation: status === "Impayé" ? "A relancer" : status === "Partiel" ? "Solde ouvert" : "Soldé",
      };
    });

    const totalExpected = rows.reduce((s, r) => s + r.montantAttendu, 0);
    const totalPaid = rows.reduce((s, r) => s + r.montantPaye, 0);
    const totalUnpaid = rows.reduce((s, r) => s + r.reste, 0);
    const expensesTotal = expenses.reduce((s, e) => s + money(e.montant), 0);
    const paidStudents = new Set(rows.filter((r) => r.statut === "Payé").map((r) => r.eleve)).size;
    const unpaidStudents = new Set(rows.filter((r) => r.statut !== "Payé").map((r) => r.eleve)).size;

    const today = iso(now);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    const monthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    const yearStart = iso(new Date(now.getFullYear(), 0, 1));
    const paymentRows = payments || [];

    const revenueFor = (from: string, to = today) =>
      paymentRows.filter((p: any) => inRange(p.date_operation, from, to)).reduce((s: number, p: any) => s + money(p.montant_regle), 0);

    const evolutionMap = new Map<string, number>();
    paymentRows.forEach((p: any) => {
      const label = bucketLabel(p.date_operation, period);
      evolutionMap.set(label, (evolutionMap.get(label) || 0) + money(p.montant_regle));
    });

    const modeMap = new Map<string, number>();
    paymentRows.forEach((p: any) => {
      const mode = p.moyen_reglement || "Espèces";
      modeMap.set(mode, (modeMap.get(mode) || 0) + money(p.montant_regle));
    });

    const monthlyGrowth = totalExpected > 0 ? ((totalPaid - totalExpected / 2) / Math.max(1, totalExpected / 2)) * 100 : 0;
    const recoveryRate = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;
    const averageDaily = paymentRows.length ? totalPaid / Math.max(1, new Set(paymentRows.map((p: any) => p.date_operation?.slice(0, 10))).size) : 0;

    return NextResponse.json({
      filters: { start, end, period, cashier: cashier || "Tous", isPrivileged },
      summary: {
        totalExpected,
        totalPaid,
        totalUnpaid,
        balance: totalPaid - expensesTotal,
        recoveryRate,
        paymentCount: paymentRows.length,
        paidStudents,
        unpaidStudents,
        revenueToday: revenueFor(today),
        revenueWeek: revenueFor(iso(weekStart)),
        revenueMonth: revenueFor(monthStart),
        revenueYear: revenueFor(yearStart),
      },
      charts: {
        evolution: Array.from(evolutionMap, ([name, value]) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name)),
        repartition: ["Payé", "Partiel", "Impayé"].map((name) => ({ name, value: rows.filter((r) => r.statut === name).length })),
        byClass: groupSum(rows, "classe"),
        byLevel: groupSum(rows, "niveau"),
        bySector: groupSum(rows, "secteur"),
        modes: Array.from(modeMap, ([name, value]) => ({ name, value: Math.round(value) })),
        comparison: [{ name: "Période", attendu: Math.round(totalExpected), encaisse: Math.round(totalPaid) }],
      },
      analysis: {
        monthlyGrowth,
        revenueForecast: Math.round(averageDaily * 30),
        delayRisk: rows.filter((r) => r.statut !== "Payé").length,
        receivables: Math.round(totalUnpaid),
        treasuryForecast: Math.round(totalPaid - expensesTotal + averageDaily * 15),
        paymentRate: recoveryRate,
        topClasses: groupSum(rows, "classe").slice(0, 5),
        topStudents: groupSum(rows, "eleve").slice(0, 5),
        topCashiers: groupSum(rows, "caissier").slice(0, 5),
      },
      alerts: [
        { type: "Retards importants", count: rows.filter((r) => r.statut === "Impayé").length, level: "danger" },
        { type: "Échéances proches", count: rows.filter((r) => r.statut === "Partiel").length, level: "warning" },
        { type: "Montants anormaux", count: rows.filter((r) => r.montantAttendu > totalExpected / Math.max(1, rows.length) * 2).length, level: "info" },
        { type: "Double paiement", count: 0, level: "success" },
      ],
      rows,
      reports: [
        "Rapport Journalier", "Rapport Hebdomadaire", "Rapport Mensuel", "Rapport Annuel", "Rapport des Élèves",
        "Rapport des Classes", "Rapport des Niveaux", "Rapport des Secteurs", "Rapport des Modes de Paiement",
        "Rapport des Retards", "Rapport des Soldes", "Rapport des Annulations", "Rapport des Remises",
        "Rapport des Bourses", "Rapport des Encaissements", "Rapport Comptable", "Grand Livre",
        "Balance Financière", "Rapport de Trésorerie"
      ],
      security: ["Super Admin", "Directeur", "Comptable", "Caissier", "Consultation"],
    });
  } catch (error: any) {
    console.error("Finance API Error:", error);
    return NextResponse.json({ error: error.message || "Erreur finance" }, { status: 500 });
  }
}
