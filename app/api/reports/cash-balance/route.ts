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
    
    // Use centralized role check (Admin + Manager)
    const isAdmin = await isAdminOrManager(user);

    // Strict scoping: sellers ALWAYS see only their own data.
    // Admins/Managers can filter by a specific cashier or see all.
    let cashier: string | null;
    if (isAdmin) {
      cashier = searchParams.get("cashier");
      if (cashier === "Tous") cashier = null;
    } else {
      // Sellers are locked to their own username — no override possible.
      cashier = user.username || null;
    }

    // We will perform multiple queries and combine them in JS to replicate the UNION ALL logic
    
    // 1. Effective Payments (Paiements)
    let pQuery = supabase
      .from("paiements")
      .select(`
        date_operation, montant_regle, moyen_reglement, utilisateur,
        factures ( bl_number, total_ttc, montant_restant, statut, emplacement, vendeur ),
        avances_clients ( reference_paiement, emplacement, utilisateur )
      `);
    if (start) pQuery = pQuery.gte("date_operation", start);
    if (end) pQuery = pQuery.lte("date_operation", end);
    if (cashier) pQuery = pQuery.eq("utilisateur", cashier);
    
    const { data: pData } = await pQuery;

    // 2. Client Advances (Avances Clients)
    let aQuery = supabase
      .from("avances_clients")
      .select("date_avance, reference_paiement, client_id, montant_initial, utilisateur, moyen_paiement, emplacement, statut")
      .neq("statut", "Annulée");
    if (start) aQuery = aQuery.gte("date_avance", start);
    if (end) aQuery = aQuery.lte("date_avance", end);
    if (cashier) aQuery = aQuery.eq("utilisateur", cashier);
    
    const { data: aData } = await aQuery;

    // 3. Rent Payments (Admin/Manager ONLY — sellers don't manage rent)
    let rentData: any[] = [];
    if (isAdmin) {
      try {
        let rQuery = supabase.from("contrat_paiements").select("*, contrats(locataire_nom_complet)");
        if (start) rQuery = rQuery.gte("date_paiement", start);
        if (end) rQuery = rQuery.lte("date_paiement", end);
        const { data } = await rQuery;
        rentData = data || [];
      } catch(e) {}
    }

    // 4. Expenses (Depenses)
    let eQuery = supabase.from("depenses").select("*");
    if (start) eQuery = eQuery.gte("date_depense", start);
    if (end) eQuery = eQuery.lte("date_depense", end);
    if (cashier) eQuery = eQuery.eq("operateur", cashier);
    
    const { data: eData } = await eQuery;

    // 5. Cement Payments (Ciment) - only admin or the user's own records
    let cimData: any[] = [];
    try {
        let cimQuery = supabase.from("ciment_paiements").select("*");
        if (start) cimQuery = cimQuery.gte("date_paiement", start);
        if (end) cimQuery = cimQuery.lte("date_paiement", end);
        if (cashier) cimQuery = cimQuery.eq("utilisateur", cashier);
        const { data } = await cimQuery;
        cimData = data || [];
    } catch(e) {}

    // 6. Unpaid Invoices (Factures Non Payées / Ventes Crédit)
    let fData: any[] = [];
    try {
        let fQuery = supabase
          .from("factures")
          .select("date_facture, bl_number, total_ttc, vendeur, emplacement, statut, clients ( nom )")
          .in("statut", ["Non Payée", "Non payée", "Non payee", "Non Payee"]);
        if (start) fQuery = fQuery.gte("date_facture", start);
        if (end) fQuery = fQuery.lte("date_facture", end);
        if (cashier) fQuery = fQuery.eq("vendeur", cashier);
        const { data } = await fQuery;
        fData = data || [];
    } catch(e) {}

    // MAPPING AND COMBINING
    const entries: any[] = [];

    pData?.forEach(p => {
       const fact = Array.isArray(p.factures) ? p.factures[0] : p.factures;
       const adv = Array.isArray(p.avances_clients) ? p.avances_clients[0] : p.avances_clients;
       
       let displayType = "Paiement";
       if (p.montant_regle < 0) displayType = "Retrait";
       else if (fact) displayType = "Vente (Caisse)";
       else if (adv) displayType = "Avance Client";

       let entreeValue = p.montant_regle > 0 ? p.montant_regle : 0;
       if (p.moyen_reglement === "Crédit" && fact) {
         entreeValue = Number(fact.total_ttc || 0);
       }

       entries.push({
          date: p.date_operation,
          ref: fact?.bl_number || adv?.reference_paiement || "TRANS",
          type: displayType,
          moyen: p.moyen_reglement,
          entree: entreeValue,
          sortie: p.montant_regle < 0 ? Math.abs(p.montant_regle) : 0,
          user: p.utilisateur,
          emplacement: fact?.emplacement || adv?.emplacement || ""
       });
    });

    aData?.forEach(a => {
       entries.push({
          date: a.date_avance,
          ref: a.reference_paiement,
          type: "Dépôt (Avance)",
          moyen: a.moyen_paiement,
          entree: a.montant_initial,
          sortie: 0,
          user: a.utilisateur,
          emplacement: a.emplacement
       });
    });

    rentData?.forEach(r => {
        entries.push({
           date: r.date_paiement,
           ref: `Loyer-${r.id}`,
           type: "Paiement Loyer",
           moyen: r.mode_paiement,
           entree: r.montant,
           sortie: 0,
           user: "Admin",
           emplacement: ""
        });
    });

    eData?.forEach(e => {
        entries.push({
           date: e.date_depense,
           ref: e.no_caisse || "DEPENSE",
           type: "Dépense (Administrative)",
           moyen: "Espèces",
           entree: 0,
           sortie: e.montant,
           user: e.operateur,
           emplacement: e.emplacement
        });
    });

    cimData?.forEach(cim => {
        entries.push({
            date: cim.date_paiement,
            ref: cim.reference || `CIM-${cim.id.slice(0, 8)}`,
            type: "Paiement Ciment",
            moyen: cim.moyen_paiement,
            entree: cim.montant,
            sortie: 0,
            user: cim.utilisateur,
            emplacement: ""
        });
    });

    fData?.forEach(f => {
        const clientName = f.clients?.nom || "Client";
        entries.push({
            date: f.date_facture,
            ref: f.bl_number || "INV",
            type: "Vente (Crédit)",
            moyen: "Crédit",
            entree: Number(f.total_ttc || 0),
            sortie: 0,
            user: f.vendeur,
            emplacement: f.emplacement || "",
            client: clientName
        });
    });

    // Sorting
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Summaries
    const totalIncome = entries
      .filter(item => item.moyen !== "Crédit")
      .reduce((sum, item) => sum + item.entree, 0);

    const fUnpaid = fData?.reduce((sum, f) => sum + Number(f.total_ttc || 0), 0) || 0;
    const uniqueInvoicesMap = new Map<string, number>();
    pData?.forEach(p => {
       const fact = Array.isArray(p.factures) ? p.factures[0] : p.factures;
       if (fact && p.moyen_reglement === "Crédit") {
         uniqueInvoicesMap.set(fact.bl_number, Number(fact.montant_restant || 0));
       }
    });
    const pUnpaid = Array.from(uniqueInvoicesMap.values()).reduce((sum, val) => sum + val, 0);
    const totalUnpaid = fUnpaid + pUnpaid;

    const totalExpenses = entries.reduce((sum, item) => sum + item.sortie, 0);

    return NextResponse.json({
      summary: {
        totalIncome,
        totalExpenses,
        totalUnpaid,
        netBalance: totalIncome - totalExpenses
      },
      entries,
      scoping: {
        isAdmin,
        cashier: cashier || "Tous"
      }
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
