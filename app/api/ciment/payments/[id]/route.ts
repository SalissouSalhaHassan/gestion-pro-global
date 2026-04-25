import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { isGreaterOrEqual, round } from "@/lib/utils/finance";

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const paymentId = params.id;
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(user);
    if (!isAdmin) return NextResponse.json({ error: "Action réservée aux administrateurs" }, { status: 403 });

    if (!paymentId) return NextResponse.json({ error: "ID manquant" }, { status: 400 });

    // 1. Get payment details
    const { data: payData, error: errPay } = await supabase
      .from("ciment_paiements")
      .select("*")
      .eq("id", paymentId)
      .single();
    
    if (errPay || !payData) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

    const shipmentId = payData.ciment_id;
    const moyen = payData.moyen_paiement;

    // 2. Rollback Avance Client if needed
    if (moyen === "Avance Client") {
      const refNew = `CIM-PAY-${paymentId.slice(0, 8)}`;
      const refOld = `PAY-CIMENT-${shipmentId.slice(0, 8)}`; // Fallback for legacy

      // Find usages in the main paiements table
      const { data: usages, error: errUsages } = await supabase
        .from("paiements")
        .select("id, avance_client_id, montant_regle")
        .in("reference_paiement", [refNew, refOld])
        .ilike("notes", `%${shipmentId}%`);

      if (!errUsages && usages) {
        for (const u of usages) {
          const uMnt = Number(u.montant_regle);
          const advId = u.avance_client_id;

          // Get current advance state
          const { data: adv } = await supabase.from("avances_clients").select("montant_restant, montant_initial").eq("id", advId).single();
          if (adv) {
            const newRem = round(Number(adv.montant_restant) + uMnt);
            const newStat = isGreaterOrEqual(newRem, Number(adv.montant_initial)) ? "Disponible" : "Partiellement utilisée";
            
            // Refund
            await supabase.from("avances_clients").update({ montant_restant: newRem, statut: newStat }).eq("id", advId);
          }
          
          // Delete usage log
          await supabase.from("paiements").delete().eq("id", u.id);
        }
      }
    }

    // 3. Delete from ciment_paiements
    const { error: errDel } = await supabase.from("ciment_paiements").delete().eq("id", paymentId);
    if (errDel) throw errDel;

    // 4. Recalculate Shipment totals
    const { data: allPays } = await supabase.from("ciment_paiements").select("montant").eq("ciment_id", shipmentId);
    const totalPaid = (allPays || []).reduce((sum, p) => sum + Number(p.montant || 0), 0);

    const { data: ship } = await supabase.from("gestion_ciment").select("total").eq("id", shipmentId).single();
    const totalShipment = Number(ship?.total || 0);

    let status = "Non Payé";
    if (isGreaterOrEqual(totalPaid, totalShipment)) status = "Payé";
    else if (totalPaid > 0) status = "Partiel";

    await supabase.from("gestion_ciment").update({ montant_paye: totalPaid, statut_paiement: status }).eq("id", shipmentId);

    return NextResponse.json({ success: true, message: "Paiement supprimé" });

  } catch (error: any) {
    console.error("Ciment Payment DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
