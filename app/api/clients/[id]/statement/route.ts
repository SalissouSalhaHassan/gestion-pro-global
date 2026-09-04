import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id: rawId } = await params;
    const clientId = parseInt(rawId, 10);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: `ID de client invalide: ${rawId}` }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start") || "";
    const endDate = searchParams.get("end") || "";

    // 1. Fetch Client Details
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    }

    // 1.1 Fetch Company Details
    const { data: company } = await supabase
      .from("informations_entreprise")
      .select("*")
      .limit(1)
      .single();

    // 2. Fetch Client Advances
    const { data: advances, error: advErr } = await supabase
      .from("avances_clients")
      .select("*")
      .eq("client_id", clientId);

    if (advErr) throw new Error(advErr.message);

    // 3. Fetch Advances History (Withdrawals/Cancellations)
    let history: any[] = [];
    if (advances && advances.length > 0) {
      try {
        const advanceIds = advances.map(a => a.id);
        const { data: histData, error: histErr } = await supabase
          .from("avances_history")
          .select("*")
          .in("advance_id", advanceIds);

        if (!histErr && histData) {
          history = histData;
        }
      } catch (histCatch) {
        console.warn("Notice: avances_history fetch failed gracefully:", histCatch);
      }
    }

    // 4. Fetch Client Invoices
    const { data: invoices, error: invErr } = await supabase
      .from("factures")
      .select("*")
      .eq("client_id", clientId)
      .neq("statut", "Annulée");

    if (invErr) throw new Error(invErr.message);

    // 5. Fetch Client Invoice Payments
    const { data: payments, error: payErr } = await supabase
      .from("paiements")
      .select(`
        *,
        factures!inner(*)
      `)
      .eq("factures.client_id", clientId);

    if (payErr) throw new Error(payErr.message);

    // 6. Build Chronological Ledger Events
    const rawEvents: any[] = [];

    // Add Deposits (avances_clients records)
    advances?.forEach(adv => {
      rawEvents.push({
        id: `dep-${adv.id}`,
        date: adv.date_avance || adv.created_at || new Date().toISOString(),
        type: "Dépôt d'avance",
        reference: adv.reference_paiement || `DEP-${adv.id}`,
        moyen_paiement: adv.moyen_paiement || "Espèce",
        emplacement: adv.emplacement || "BOUTIQUE",
        debit: 0,
        credit: Number(adv.montant_initial) || 0,
        notes: adv.notes || `Dépôt initial via ${adv.moyen_paiement || 'Espèce'}`,
        utilisateur: adv.utilisateur
      });
    });

    // Add Withdrawals and Cancellations from history
    history.forEach(h => {
      if (h.action === "WITHDRAW") {
        rawEvents.push({
          id: `h-wdr-${h.id}`,
          date: h.date_action || new Date().toISOString(),
          type: "Retrait d'avance",
          reference: `ADV-${h.advance_id}`,
          moyen_paiement: "Espèce",
          emplacement: "BOUTIQUE",
          debit: Number(h.amount) || 0,
          credit: 0,
          notes: h.notes || "Retrait de fonds",
          utilisateur: h.utilisateur
        });
      } else if (h.action === "CANCEL") {
        rawEvents.push({
          id: `h-cnc-${h.id}`,
          date: h.date_action || new Date().toISOString(),
          type: "Annulation d'avance",
          reference: `ADV-${h.advance_id}`,
          moyen_paiement: "—",
          emplacement: "BOUTIQUE",
          debit: Number(h.amount) || 0,
          credit: 0,
          notes: h.notes || "Annulation du dépôt",
          utilisateur: h.utilisateur
        });
      }
    });

    // Add Invoices (debits)
    invoices?.forEach(inv => {
      const invPayments = payments?.filter(p => Number(p.facture_id) === Number(inv.id)) || [];
      const advancePaidAmount = invPayments
        .filter(p => p.moyen_reglement === "Avance")
        .reduce((sum, p) => sum + Number(p.montant_regle || 0), 0);
      const hasAdvancePayment = advancePaidAmount > 0;

      let typeLabel = "Facture";
      let modeLabel = inv.mode_paiement || "Facturation";
      let notesLabel = `Facturation vente ${inv.bl_number ? `(BL: ${inv.bl_number})` : ""}`;

      if (hasAdvancePayment) {
        if (advancePaidAmount >= Number(inv.total_ttc)) {
          typeLabel = "Règlement Facture (par Avance)";
          modeLabel = "Imputation Avance";
          notesLabel = `Facture acquittée par acompte client ${inv.bl_number ? `(BL: ${inv.bl_number})` : ""}`;
        } else {
          typeLabel = "Facture / Règlement partiel Avance";
          modeLabel = "Mixte / Avance";
          notesLabel = `Facture acquittée partiellement par acompte (${advancePaidAmount.toLocaleString()} FCFA) ${inv.bl_number ? `(BL: ${inv.bl_number})` : ""}`;
        }
      }

      rawEvents.push({
        id: `inv-${inv.id}`,
        date: inv.date_facture || inv.created_at || new Date().toISOString(),
        type: typeLabel,
        reference: inv.bl_number || inv.num_facture || `FAC-${inv.id}`,
        moyen_paiement: modeLabel,
        emplacement: inv.depot || "BOUTIQUE",
        debit: Number(inv.total_ttc) || 0,
        credit: 0,
        notes: notesLabel,
        utilisateur: inv.vendeur,
        statut_facture: inv.statut,
        montant_restant: Number(inv.montant_restant) || 0,
      });
    });

    // Add External Payments (Cash, Cheque, Virement)
    payments?.forEach(p => {
      if (p.moyen_reglement !== "Avance") {
        rawEvents.push({
          id: `pay-${p.id}`,
          date: p.date_operation || p.created_at || new Date().toISOString(),
          type: "Règlement Facture",
          reference: p.factures?.bl_number || p.factures?.num_facture || `FAC-${p.facture_id}`,
          moyen_paiement: p.moyen_reglement || "Espèce",
          emplacement: "BOUTIQUE",
          debit: 0,
          credit: Number(p.montant_regle) || 0,
          notes: `Règlement facture via ${p.moyen_reglement || 'Espèce'}`,
          utilisateur: p.utilisateur
        });
      }
    });

    // Sort all events by date ascending
    rawEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 7. Partition into Opening Balance & Period Events
    let openingBalance = 0;
    const periodEvents: any[] = [];
    const startObj = startDate ? new Date(startDate + "T00:00:00") : null;
    const endObj = endDate ? new Date(endDate + "T23:59:59.999") : null;

    rawEvents.forEach(e => {
      const eDate = new Date(e.date);
      if (startObj && eDate < startObj) {
        openingBalance += (e.credit - e.debit);
      } else if (!endObj || eDate <= endObj) {
        periodEvents.push(e);
      }
    });

    // 8. Calculate Running Balance for Period Events
    let runningBalance = openingBalance;
    let totalDebitPeriod = 0;
    let totalCreditPeriod = 0;

    const formattedEvents = periodEvents.map(e => {
      totalDebitPeriod += e.debit;
      totalCreditPeriod += e.credit;
      runningBalance += (e.credit - e.debit);
      return {
        ...e,
        solde_courant: runningBalance
      };
    });

    // 9. Aging Balance (Balance Âgée) of Unpaid Invoices
    const now = new Date();
    const balanceAgee = {
      range_0_30: 0,
      range_31_60: 0,
      range_61_90: 0,
      range_over_90: 0,
      count_0_30: 0,
      count_31_60: 0,
      count_61_90: 0,
      count_over_90: 0,
      total_unpaid: 0,
    };

    invoices?.forEach(inv => {
      const remaining = Number(inv.montant_restant) || 0;
      if (remaining > 0 && inv.statut !== "Annulée") {
        balanceAgee.total_unpaid += remaining;
        const invDate = new Date(inv.date_facture || inv.created_at);
        const ageDays = Math.floor((now.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24));

        if (ageDays <= 30) {
          balanceAgee.range_0_30 += remaining;
          balanceAgee.count_0_30 += 1;
        } else if (ageDays <= 60) {
          balanceAgee.range_31_60 += remaining;
          balanceAgee.count_31_60 += 1;
        } else if (ageDays <= 90) {
          balanceAgee.range_61_90 += remaining;
          balanceAgee.count_61_90 += 1;
        } else {
          balanceAgee.range_over_90 += remaining;
          balanceAgee.count_over_90 += 1;
        }
      }
    });

    // 10. Client aggregates
    const totalDeposited = advances?.reduce((sum, a) => sum + Number(a.montant_initial || 0), 0) || 0;
    const unusedAdvances = advances?.reduce((sum, a) => sum + Number(a.montant_restant || 0), 0) || 0;
    const totalDebt = Number(client.credit_facture || 0) + Number(client.credit_bl || 0);
    const netPosition = unusedAdvances - totalDebt;

    return NextResponse.json({
      company: company || null,
      client: {
        id: client.id,
        nom: client.nom,
        tel: client.tel,
        ref_client: client.ref_client,
        type_client: client.type_client,
        credit_facture: client.credit_facture || 0,
        credit_bl: client.credit_bl || 0,
        solde_avances: unusedAdvances,
        total_depose: totalDeposited,
        total_dette: totalDebt,
        position_nette: netPosition,
        montant_plafond: client.montant_plafond || 0,
      },
      summary: {
        solde_initial: openingBalance,
        total_debit: totalDebitPeriod,
        total_credit: totalCreditPeriod,
        solde_final: runningBalance,
        date_debut: startDate || null,
        date_fin: endDate || null,
      },
      balance_agee: balanceAgee,
      events: formattedEvents,
      total_events_count: formattedEvents.length,
    });

  } catch (error: any) {
    console.error("Error generating client statement:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
