import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const cashier = searchParams.get("cashier");

    // We will perform multiple queries and combine them in JS to replicate the UNION ALL logic
    
    // 1. Effective Payments (Paiements)
    let pQuery = supabase
      .from("paiements")
      .select(`
        date_operation, montant_regle, moyen_reglement, utilisateur,
        factures ( bl_number, total_ttc, montant_restant, statut, emplacement ),
        avances_clients ( reference_paiement, emplacement )
      `);
    if (start) pQuery = pQuery.gte("date_operation", start);
    if (end) pQuery = pQuery.lte("date_operation", end);
    if (cashier && cashier !== "Tous") pQuery = pQuery.eq("utilisateur", cashier);
    
    const { data: pData } = await pQuery;

    // 2. Client Advances (Avances Clients)
    let aQuery = supabase
      .from("avances_clients")
      .select("date_avance, reference_paiement, client_id, montant_initial, utilisateur, moyen_paiement, emplacement, statut")
      .neq("statut", "Annulée");
    if (start) aQuery = aQuery.gte("date_avance", start);
    if (end) aQuery = aQuery.lte("date_avance", end);
    if (cashier && cashier !== "Tous") aQuery = aQuery.eq("utilisateur", cashier);
    
    const { data: aData } = await aQuery;

    // 3. Rent Payments (If table exists)
    let rentData: any[] = [];
    try {
        let rQuery = supabase.from("contrat_paiements").select("*, contrats(locataire_nom_complet)");
        if (start) rQuery = rQuery.gte("date_paiement", start);
        if (end) rQuery = rQuery.lte("date_paiement", end);
        const { data } = await rQuery;
        rentData = data || [];
    } catch(e) {}

    // 4. Expenses (Depenses)
    let eQuery = supabase.from("depenses").select("*");
    if (start) eQuery = eQuery.gte("date_depense", start);
    if (end) eQuery = eQuery.lte("date_depense", end);
    if (cashier && cashier !== "Tous") eQuery = eQuery.eq("operateur", cashier);
    
    const { data: eData } = await eQuery;

    // MAPPING AND COMBINING
    const entries: any[] = [];

    pData?.forEach(p => {
       entries.push({
          date: p.date_operation,
          ref: p.factures?.bl_number || p.avances_clients?.reference_paiement || "TRANS",
          type: p.montant_regle < 0 ? "Retrait" : "Paiement",
          moyen: p.moyen_reglement,
          entree: p.montant_regle > 0 ? p.montant_regle : 0,
          sortie: p.montant_regle < 0 ? Math.abs(p.montant_regle) : 0,
          user: p.utilisateur,
          emplacement: p.factures?.emplacement || p.avances_clients?.emplacement || ""
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

    // Sorting
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Summaries
    const totalIncome = entries.reduce((sum, item) => sum + item.entree, 0);
    const totalExpenses = entries.reduce((sum, item) => sum + item.sortie, 0);

    return NextResponse.json({
      summary: {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses
      },
      entries
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
