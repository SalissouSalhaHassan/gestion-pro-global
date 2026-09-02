import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const money = (v: any) => Number(v || 0);

function statusOf(expected: number, paid: number) {
  if (paid >= expected && expected > 0) return "Payée";
  if (paid > 0) return "Partielle";
  return "Non Payée";
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

    // 1. Fetch Invoices (using exact database columns)
    let invoiceQuery = supabase
      .from("factures")
      .select("id, bl_number, date_facture, total_ht, total_ttc, montant_paye, montant_restant, statut, vendeur, clients(id, nom, tel, ref_client)")
      .neq("statut", "Annulée")
      .eq("is_deleted", false)
      .order("id", { ascending: false });

    if (start && end) {
      invoiceQuery = invoiceQuery.gte("date_facture", start).lte("date_facture", end);
    }
    if (cashier && cashier !== "Tous") {
      invoiceQuery = invoiceQuery.eq("vendeur", cashier);
    }

    const { data: invoicesRaw, error: invoicesError } = await invoiceQuery;
    if (invoicesError) {
      console.error("Invoices fetch error in finance:", invoicesError);
      throw invoicesError;
    }

    const invoices = invoicesRaw || [];

    // 2. Fetch Payments
    let payments: any[] = [];
    try {
      let paymentQuery = supabase
        .from("paiements")
        .select("id, date_operation, montant_regle, moyen_reglement, reference_paiement, factures(id, bl_number, total_ttc, clients(nom))")
        .order("id", { ascending: false });
      if (start && end) {
        paymentQuery = paymentQuery.gte("date_operation", start).lte("date_operation", `${end}T23:59:59.999Z`);
      }
      const { data: paymentsRaw } = await paymentQuery;
      payments = paymentsRaw || [];
    } catch (e) {
      console.warn("Payment fetch warning in finance:", e);
    }

    // 3. Fetch Expenses
    let expenses: any[] = [];
    try {
      let expQuery = supabase
        .from("depenses")
        .select("id, date_depense, montant, operateur, no_caisse");
      if (start && end) {
        expQuery = expQuery.gte("date_depense", start).lte("date_depense", `${end}T23:59:59.999Z`);
      }
      if (cashier && cashier !== "Tous") {
        expQuery = expQuery.eq("operateur", cashier);
      }
      const { data: expRaw } = await expQuery;
      expenses = expRaw || [];
    } catch (e) {
      console.warn("Expenses fetch warning in finance:", e);
    }

    // 4. Fetch Clients for debt analysis
    const { data: clientsRaw } = await supabase
      .from("clients")
      .select("id, nom, tel, credit_facture, credit_bl")
      .eq("is_deleted", false);

    const clients = clientsRaw || [];

    // Calculations
    const totalAttendu = invoices.reduce((acc, f) => acc + money(f.total_ttc), 0);
    const totalEncaisse = invoices.reduce((acc, f) => acc + money(f.montant_paye), 0);
    const totalImpaye = invoices.reduce((acc, f) => acc + Math.max(0, money(f.total_ttc) - money(f.montant_paye)), 0);
    const totalDepenses = expenses.reduce((acc, e) => acc + money(e.montant), 0);
    const soldeActuel = totalEncaisse - totalDepenses;

    const tauxRecouvrement = totalAttendu > 0 ? (totalEncaisse / totalAttendu) * 100 : 100;

    // Time-based calculations
    const todayStr = iso(now);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfWeekStr = iso(startOfWeek);
    const startOfMonthStr = iso(new Date(now.getFullYear(), now.getMonth(), 1));
    const startOfYearStr = iso(new Date(now.getFullYear(), 0, 1));

    const revenusAujourdhui = invoices
      .filter((f) => f.date_facture === todayStr)
      .reduce((acc, f) => acc + money(f.montant_paye), 0);

    const revenusCetteSemaine = invoices
      .filter((f) => f.date_facture >= startOfWeekStr)
      .reduce((acc, f) => acc + money(f.montant_paye), 0);

    const revenusCeMois = invoices
      .filter((f) => f.date_facture >= startOfMonthStr)
      .reduce((acc, f) => acc + money(f.montant_paye), 0);

    const revenusCetteAnnee = invoices
      .filter((f) => f.date_facture >= startOfYearStr)
      .reduce((acc, f) => acc + money(f.montant_paye), 0);

    // Client debt metrics
    const clientsPayesCount = clients.filter((c) => money(c.credit_facture) <= 0).length;
    const clientsImpayesCount = clients.filter((c) => money(c.credit_facture) > 0).length;

    // Mode of payment breakdown (derived from paiements table)
    const modeMap: Record<string, number> = {};
    payments.forEach((p) => {
      const mode = p.moyen_reglement || "Espèces";
      modeMap[mode] = (modeMap[mode] || 0) + money(p.montant_regle);
    });

    // If no payments recorded yet, default from invoices
    if (Object.keys(modeMap).length === 0 && totalEncaisse > 0) {
      modeMap["Espèces"] = totalEncaisse;
    }

    const modesDePaiement = Object.keys(modeMap).map((name) => ({
      name,
      value: Math.round(modeMap[name]),
    }));

    // Daily/Monthly timeline curve
    const timelineMap: Record<string, { label: string; encaisse: number; attendu: number; depenses: number }> = {};
    invoices.forEach((f) => {
      const d = f.date_facture || todayStr;
      if (!timelineMap[d]) {
        timelineMap[d] = { label: d, encaisse: 0, attendu: 0, depenses: 0 };
      }
      timelineMap[d].attendu += money(f.total_ttc);
      timelineMap[d].encaisse += money(f.montant_paye);
    });

    expenses.forEach((e) => {
      const d = e.date_depense || todayStr;
      if (!timelineMap[d]) {
        timelineMap[d] = { label: d, encaisse: 0, attendu: 0, depenses: 0 };
      }
      timelineMap[d].depenses += money(e.montant);
    });

    const evolutionEncaissements = Object.values(timelineMap)
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-15);

    // Rows for the commercial financial table
    const rows = invoices.map((f: any, idx: number) => {
      const client = Array.isArray(f.clients) ? f.clients[0] : f.clients;
      const expected = money(f.total_ttc);
      const paid = money(f.montant_paye);
      const reste = Math.max(0, expected - paid);
      const st = f.statut || statusOf(expected, paid);

      return {
        id: f.id,
        no: idx + 1,
        reference: f.bl_number || `FAC-${f.id}`,
        date: f.date_facture || todayStr,
        client: client?.nom || "Client Divers",
        clientTel: client?.tel || "",
        emplacement: "BOUTIQUE",
        vendeur: f.vendeur || "Admin",
        modePaiement: "Espèces",
        totalTTC: expected,
        montantPaye: paid,
        reste,
        statut: st,
      };
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalAttendu,
        totalEncaisse,
        totalImpaye,
        soldeActuel,
        tauxRecouvrement: Number(tauxRecouvrement.toFixed(2)),
        nombrePaiements: payments.length > 0 ? payments.length : invoices.length,
        clientsPayes: clientsPayesCount,
        clientsImpayes: clientsImpayesCount,
        revenusAujourdhui,
        revenusCetteSemaine,
        revenusCeMois,
        revenusCetteAnnee,
        totalDepenses,
      },
      charts: {
        evolution: evolutionEncaissements.length > 0 ? evolutionEncaissements : [{ label: todayStr, encaisse: totalEncaisse, attendu: totalAttendu, depenses: totalDepenses }],
        modesPaiement: modesDePaiement.length > 0 ? modesDePaiement : [{ name: "Espèces", value: totalEncaisse || 1 }],
      },
      rows,
      filters: {
        start,
        end,
        period,
        cashier: cashier || "Tous",
      },
    });
  } catch (err: any) {
    console.error("Finance API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
