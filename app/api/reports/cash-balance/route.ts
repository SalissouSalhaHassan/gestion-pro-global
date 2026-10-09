import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    
    // Role check (Admin + Manager)
    const isAdmin = await isAdminOrManager(user);

    let cashier: string | null;
    if (isAdmin) {
      cashier = searchParams.get("cashier");
      if (cashier === "Tous") cashier = null;
    } else {
      cashier = user.username || null;
    }

    const orgId = user.organization_id;

    // 1. Effective Payments (Paiements) - Exclude direct Credit balance entries
    let pQuery = supabase
      .from("paiements")
      .select(`
        id, date_operation, montant_regle, moyen_reglement, reference_paiement,
        factures!inner ( id, date_facture, bl_number, total_ttc, montant_paye, montant_restant, statut, vendeur, organization_id )
      `)
      .neq("moyen_reglement", "Crédit");

    if (orgId) pQuery = pQuery.eq("factures.organization_id", orgId);
    if (start) pQuery = pQuery.gte("date_operation", start);
    if (end) pQuery = pQuery.lte("date_operation", `${end}T23:59:59.999Z`);
    
    let pData: any[] | null = null;
    const { data: mainPData, error: pError } = await pQuery;
    pData = mainPData;
    if (pError) {
      console.error("Cash balance pQuery error:", pError);
      // Fallback: query paiements without inner join if relation issue occurs
      const fallbackQuery = await supabase
        .from("paiements")
        .select(`
          id, date_operation, montant_regle, moyen_reglement, reference_paiement,
          factures ( id, date_facture, bl_number, total_ttc, montant_paye, montant_restant, statut, vendeur )
        `)
        .neq("moyen_reglement", "Crédit")
        .gte("date_operation", start || "1970-01-01")
        .lte("date_operation", end ? `${end}T23:59:59.999Z` : "2099-12-31T23:59:59.999Z");
      pData = fallbackQuery.data;
    }

    // 2. Client Advances (Avances Clients)
    let aQuery = supabase
      .from("avances_clients")
      .select("id, date_avance, reference_paiement, client_id, montant_initial, montant_restant, utilisateur, moyen_paiement, statut, clients(nom)")
      .neq("statut", "Annulée");

    if (orgId) aQuery = aQuery.eq("organization_id", orgId);
    if (start) aQuery = aQuery.gte("date_avance", start);
    if (end) aQuery = aQuery.lte("date_avance", `${end}T23:59:59.999Z`);
    if (cashier) aQuery = aQuery.eq("utilisateur", cashier);
    
    const { data: aData } = await aQuery;

    // 3. Expenses (Dépenses)
    let eQuery = supabase.from("depenses").select("*");
    if (orgId) eQuery = eQuery.eq("organization_id", orgId);
    if (start) eQuery = eQuery.gte("date_depense", start);
    if (end) eQuery = eQuery.lte("date_depense", `${end}T23:59:59.999Z`);
    if (cashier) eQuery = eQuery.eq("operateur", cashier);
    
    const { data: eData } = await eQuery;

    // 4. Cement Payments (Ciment)
    let cimData: any[] = [];
    try {
      let cimQuery = supabase.from("ciment_paiements").select("*");
      if (orgId) cimQuery = cimQuery.eq("organization_id", orgId);
      if (start) cimQuery = cimQuery.gte("date_paiement", start);
      if (end) cimQuery = cimQuery.lte("date_paiement", `${end}T23:59:59.999Z`);
      if (cashier) cimQuery = cimQuery.eq("utilisateur", cashier);
      const { data } = await cimQuery;
      cimData = data || [];
    } catch (e) {}

    // 5. Active Invoices of the period (Factures du jour / de la période)
    let fQuery = supabase
      .from("factures")
      .select("id, date_facture, bl_number, total_ttc, montant_paye, montant_restant, vendeur, statut, clients(nom)")
      .neq("statut", "Annulée")
      .eq("is_deleted", false);

    if (orgId) fQuery = fQuery.eq("organization_id", orgId);
    if (start) fQuery = fQuery.gte("date_facture", start);
    if (end) fQuery = fQuery.lte("date_facture", `${end}T23:59:59.999Z`);
    if (cashier) fQuery = fQuery.eq("vendeur", cashier);

    const { data: fData } = await fQuery;

    // 6. Organization Users / Cashiers for filtering
    let uQuery = supabase.from("users").select("utilisateur, nom_prenom");
    if (orgId) uQuery = uQuery.eq("organization_id", orgId);
    const { data: uData } = await uQuery;
    const organizationCashiers = (uData || []).map((u) => u.utilisateur).filter(Boolean);

    // Mapping and combining transactions
    const entries: any[] = [];

    // Filter payments by cashier if scoped
    pData?.forEach((p: any) => {
      const fact = Array.isArray(p.factures) ? p.factures[0] : p.factures;
      if (cashier && fact?.vendeur && fact.vendeur !== cashier) return;

      let displayType = "Paiement Vente";
      const isAdvanceConsumption = String(p.moyen_reglement || "").toLowerCase().includes("avance");

      if (p.montant_regle < 0) {
        displayType = "Retrait Caisse";
      } else if (isAdvanceConsumption) {
        displayType = "Vente (Par Acompte Client)";
      } else if (fact) {
        displayType = `Vente (${p.moyen_reglement || "Caisse"})`;
      }

      entries.push({
        date: p.date_operation,
        ref: fact?.bl_number || p.reference_paiement || `REG-${p.id}`,
        type: displayType,
        moyen: p.moyen_reglement || "Espèces",
        entree: p.montant_regle > 0 ? p.montant_regle : 0,
        sortie: p.montant_regle < 0 ? Math.abs(p.montant_regle) : 0,
        user: fact?.vendeur || "Caisse",
        emplacement: "BOUTIQUE",
        isAdvanceConsumption,
      });
    });

    // Client Advance Deposits
    aData?.forEach((a: any) => {
      entries.push({
        date: a.date_avance,
        ref: a.reference_paiement || `DEPOT-${a.id}`,
        type: "Dépôt (Acompte Client)",
        moyen: a.moyen_paiement || "Espèces",
        entree: Number(a.montant_initial || 0),
        sortie: 0,
        user: a.utilisateur || "Caisse",
        emplacement: "BOUTIQUE",
        client: a.clients?.nom || null,
      });
    });

    // Expenses
    eData?.forEach((e: any) => {
      entries.push({
        date: e.date_depense,
        ref: e.no_caisse || `DEP-${e.id}`,
        type: "Dépense Caisse",
        moyen: "Espèces",
        entree: 0,
        sortie: Number(e.montant || 0),
        user: e.operateur || "Caisse",
        emplacement: e.emplacement || "BOUTIQUE",
      });
    });

    // Cement
    cimData?.forEach((cim: any) => {
      entries.push({
        date: cim.date_paiement,
        ref: cim.reference || `CIM-${cim.id}`,
        type: "Paiement Ciment",
        moyen: cim.moyen_paiement || "Espèces",
        entree: Number(cim.montant || 0),
        sortie: 0,
        user: cim.utilisateur || "Caisse",
        emplacement: "BOUTIQUE",
      });
    });

    // Credit sales remainder (Unpaid receivables)
    fData?.forEach((f: any) => {
      if (Number(f.montant_restant || 0) > 0.01) {
        entries.push({
          date: f.date_facture,
          ref: f.bl_number || `FA-${f.id}`,
          type: "Vente (À Crédit)",
          moyen: "Crédit",
          entree: Number(f.montant_restant || 0),
          sortie: 0,
          user: f.vendeur || "Caisse",
          emplacement: "BOUTIQUE",
          client: f.clients?.nom || "Client",
        });
      }
    });

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Financial Summaries
    // Cash Income = Actual cash received in cash drawer (excludes pure credit sales and advance internal balance consumes)
    const totalCashIncome = entries
      .filter((item) => item.moyen !== "Crédit" && !item.isAdvanceConsumption)
      .reduce((sum, item) => sum + item.entree, 0);

    const totalInvoiced = (fData || []).reduce((sum, f) => sum + Number(f.total_ttc || 0), 0);
    const totalUnpaid = (fData || []).reduce((sum, f) => sum + Number(f.montant_restant || 0), 0);
    const totalPaidInvoicesPeriod = (fData || []).reduce((sum, f) => sum + Number(f.montant_paye || 0), 0);
    const totalAdvancesPeriod = (aData || []).reduce((sum, a) => sum + Number(a.montant_initial || 0), 0);
    const totalCementPeriod = cimData.reduce((sum, c) => sum + Number(c.montant || 0), 0);
    const totalExpenses = entries.reduce((sum, item) => sum + item.sortie, 0);

    return NextResponse.json(
      {
        summary: {
          totalIncome: totalCashIncome,
          totalExpenses,
          totalUnpaid,
          netBalance: totalCashIncome - totalExpenses,
          reconciliation: {
            totalInvoiced,
            totalUnpaidPeriod: totalUnpaid,
            totalPaidInvoicesPeriod,
            totalPaidOlderInvoicesPeriod: 0,
            totalAdvancesPeriod,
            totalCementPeriod,
          },
        },
        entries,
        scoping: {
          isAdmin,
          cashier: cashier || "Tous",
          cashiers: organizationCashiers,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error: any) {
    console.error("Cash balance report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
