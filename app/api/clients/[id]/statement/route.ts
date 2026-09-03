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
    const clientId = parseInt(rawId);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: `ID de client invalide: ${rawId}` }, { status: 400 });
    }

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

    // 3. Fetch Advances History (Withdrawals/Cancellations) - Graceful fallback if table not yet created
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
        } else if (histErr) {
          console.warn("Notice: avances_history not queryable yet:", histErr.message);
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
    // We join with factures to only get payments for this client's invoices
    const { data: payments, error: payErr } = await supabase
      .from("paiements")
      .select(`
        *,
        factures!inner(*)
      `)
      .eq("factures.client_id", clientId);

    if (payErr) throw new Error(payErr.message);

    // 6. Build Chronological Ledger Events
    const ledgerEvents: any[] = [];

    // Add Deposits (avances_clients records)
    advances?.forEach(adv => {
      ledgerEvents.push({
        id: `dep-${adv.id}`,
        date: adv.date_avance || adv.created_at || new Date().toISOString(),
        type: "Dépôt d'avance",
        reference: adv.reference_paiement || `DEP-${adv.id}`,
        moyen_paiement: adv.moyen_paiement || "Espèce",
        emplacement: adv.emplacement || "BOUTIQUE",
        debit: 0,
        credit: Number(adv.montant_initial),
        notes: adv.notes || `Dépôt initial via ${adv.moyen_paiement || 'Espèce'}`,
        utilisateur: adv.utilisateur
      });
    });

    // Add Withdrawals and Cancellations from history
    history.forEach(h => {
      if (h.action === "WITHDRAW") {
        ledgerEvents.push({
          id: `h-wdr-${h.id}`,
          date: h.date_action || new Date().toISOString(),
          type: "Retrait d'avance",
          reference: `ADV-${h.advance_id}`,
          moyen_paiement: "Espèce",
          emplacement: "BOUTIQUE",
          debit: Number(h.amount),
          credit: 0,
          notes: h.notes || "Retrait de fonds",
          utilisateur: h.utilisateur
        });
      } else if (h.action === "CANCEL") {
        ledgerEvents.push({
          id: `h-cnc-${h.id}`,
          date: h.date_action || new Date().toISOString(),
          type: "Annulation d'avance",
          reference: `ADV-${h.advance_id}`,
          moyen_paiement: "—",
          emplacement: "BOUTIQUE",
          debit: Number(h.amount),
          credit: 0,
          notes: h.notes || "Annulation du dépôt",
          utilisateur: h.utilisateur
        });
      }
    });

    // Add Invoices (debits)
    invoices?.forEach(inv => {
      ledgerEvents.push({
        id: `inv-${inv.id}`,
        date: inv.date_facture || inv.created_at || new Date().toISOString(),
        type: "Facture",
        reference: inv.bl_number || inv.num_facture || `FAC-${inv.id}`,
        moyen_paiement: inv.mode_paiement || "Facturation",
        emplacement: inv.depot || "BOUTIQUE",
        debit: Number(inv.total_ttc),
        credit: 0,
        notes: `Facturation vente ${inv.bl_number ? `(BL: ${inv.bl_number})` : ""}`,
        utilisateur: inv.vendeur
      });
    });

    // Add Payments (credits)
    payments?.forEach(p => {
      // Direct Cash/Cheque/Virement payments
      if (p.moyen_reglement !== "Avance") {
        ledgerEvents.push({
          id: `pay-${p.id}`,
          date: p.date_operation || p.created_at || new Date().toISOString(),
          type: "Règlement Facture",
          reference: p.factures?.bl_number || p.factures?.num_facture || `FAC-${p.facture_id}`,
          moyen_paiement: p.moyen_reglement || "Espèce",
          emplacement: "BOUTIQUE",
          debit: 0,
          credit: Number(p.montant_regle),
          notes: `Règlement facture via ${p.moyen_reglement}`,
          utilisateur: p.utilisateur
        });
      } else {
        // If payment is via Advance, we log two entries to balance it:
        // 1. Deduction from the advance balance (debit side of advance usage)
        ledgerEvents.push({
          id: `pay-adv-ded-${p.id}`,
          date: p.date_operation || p.created_at || new Date().toISOString(),
          type: "Utilisation d'avance",
          reference: p.factures?.bl_number || p.factures?.num_facture || `FAC-${p.facture_id}`,
          moyen_paiement: "Imputation Avance",
          emplacement: "BOUTIQUE",
          debit: Number(p.montant_regle),
          credit: 0,
          notes: `Imputation sur Facture ${p.factures?.bl_number || p.factures?.num_facture || p.facture_id}`,
          utilisateur: p.utilisateur
        });

        // 2. Receipt on the invoice (credit side of advance usage)
        ledgerEvents.push({
          id: `pay-adv-rec-${p.id}`,
          date: p.date_operation || p.created_at || new Date().toISOString(),
          type: "Règlement par Avance",
          reference: p.factures?.bl_number || p.factures?.num_facture || `FAC-${p.facture_id}`,
          moyen_paiement: "Imputation Avance",
          emplacement: "BOUTIQUE",
          debit: 0,
          credit: Number(p.montant_regle),
          notes: `Facture acquittée par solde d'avance`,
          utilisateur: p.utilisateur
        });
      }
    });

    // Sort events by date ascending
    ledgerEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate Running Balance
    let runningBalance = 0;
    const formattedEvents = ledgerEvents.map(e => {
      runningBalance += (e.credit - e.debit);
      return {
        ...e,
        solde_courant: runningBalance
      };
    });

    // Compute Client aggregates
    const totalDeposited = advances?.reduce((sum, a) => sum + Number(a.montant_initial), 0) || 0;
    const unusedAdvances = advances?.reduce((sum, a) => sum + Number(a.montant_restant), 0) || 0;
    const totalDebt = client.credit_facture || 0;
    const netPosition = unusedAdvances - totalDebt;

    return NextResponse.json({
      company: company || null,
      client: {
        id: client.id,
        nom: client.nom,
        tel: client.tel,
        ref_client: client.ref_client,
        credit_facture: totalDebt,
        credit_bl: client.credit_bl || 0,
        solde_avances: unusedAdvances,
        total_depose: totalDeposited,
        position_nette: netPosition
      },
      events: formattedEvents
    });

  } catch (error: any) {
    console.error("Error generating client statement:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
