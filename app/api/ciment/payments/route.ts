import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const shipmentId = searchParams.get("shipmentId");
    
    if (!shipmentId) return NextResponse.json({ error: "shipmentId manquant" }, { status: 400 });

    const { data, error } = await supabase
      .from("ciment_paiements")
      .select("*")
      .eq("ciment_id", shipmentId)
      .order("date_paiement", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { shipmentId, montant, moyen, reference, date } = body;

    const amount = Number(montant);
    if (!shipmentId || amount <= 0 || !moyen) {
      return NextResponse.json({ error: "Données de paiement invalides" }, { status: 400 });
    }

    const paymentId = uuidv4();
    const datePay = date || new Date().toISOString().split('T')[0];

    // AVANCE CLIENT LOGIC
    if (moyen === "Avance Client") {
      // 1. Get client tel from shipment
      const { data: shipment, error: errShip } = await supabase
        .from("gestion_ciment")
        .select("client_tel")
        .eq("id", shipmentId)
        .single();
      
      if (errShip || !shipment) return NextResponse.json({ error: "Chargement introuvable" }, { status: 404 });
      const clientTel = shipment.client_tel;

      // 2. Get client ID
      const { data: client, error: errClient } = await supabase
        .from("clients")
        .select("id")
        .or(`tel.eq.${clientTel},nom.eq.${clientTel}`)
        .limit(1)
        .single();
      
      if (errClient || !client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
      const clientId = client.id;

      // 3. Get available advances
      const { data: advances, error: errAdv } = await supabase
        .from("avances_clients")
        .select("id, montant_restant")
        .eq("client_id", clientId)
        .in("statut", ["Disponible", "Partiellement utilisée"])
        .order("date_avance", { ascending: true });
        
      if (errAdv) throw errAdv;

      const totalAvailable = (advances || []).reduce((sum, a) => sum + Number(a.montant_restant || 0), 0);
      if (amount > totalAvailable + 0.01) {
        return NextResponse.json({ error: `Solde insuffisant. Disponible: ${totalAvailable} FCFA` }, { status: 400 });
      }

      // 4. Deduct advances sequentially
      let remainingToPay = amount;
      for (const adv of advances || []) {
        if (remainingToPay <= 0) break;
        
        const advRem = Number(adv.montant_restant);
        const deduct = Math.min(remainingToPay, advRem);
        const newRem = advRem - deduct;
        const newStat = newRem < 0.01 ? "Utilisée" : "Partiellement utilisée";
        
        // Update advance
        const { error: errUpd } = await supabase
          .from("avances_clients")
          .update({ montant_restant: newRem, statut: newStat })
          .eq("id", adv.id);
        if (errUpd) throw errUpd;

        // Log usage
        const usageId = uuidv4();
        const { error: errUsage } = await supabase
          .from("paiements")
          .insert({
            id: usageId,
            avance_client_id: adv.id,
            date_operation: datePay,
            montant_regle: deduct,
            moyen_reglement: "Usage",
            reference_paiement: `CIM-PAY-${paymentId.slice(0, 8)}`,
            utilisateur: user.username,
            notes: `Paiement Chargement Ciment ID: ${shipmentId}`
          });
        if (errUsage) throw errUsage;

        remainingToPay -= deduct;
      }
    }

    // Insert ciment_paiements
    const { error: errPay } = await supabase
      .from("ciment_paiements")
      .insert({
        id: paymentId,
        ciment_id: shipmentId,
        date_paiement: datePay,
        montant: amount,
        moyen_paiement: moyen,
        reference: reference || "",
        utilisateur: user.username,
        user_id: user.id
      });
    
    if (errPay) throw errPay;

    // Recalculate Totals
    const { data: allPays, error: errAll } = await supabase
      .from("ciment_paiements")
      .select("montant")
      .eq("ciment_id", shipmentId);
    
    const totalPaid = (allPays || []).reduce((sum, p) => sum + Number(p.montant || 0), 0);

    // Get total from shipment to update status
    const { data: ship2 } = await supabase.from("gestion_ciment").select("total").eq("id", shipmentId).single();
    const totalShipment = Number(ship2?.total || 0);

    let status = "Non Payé";
    if (totalPaid >= totalShipment - 0.1) status = "Payé";
    else if (totalPaid > 0) status = "Partiel";

    const { error: errUpdShip } = await supabase
      .from("gestion_ciment")
      .update({ montant_paye: totalPaid, statut_paiement: status })
      .eq("id", shipmentId);
      
    if (errUpdShip) throw errUpdShip;

    return NextResponse.json({ success: true, message: "Paiement enregistré" });

  } catch (error: any) {
    console.error("Ciment Payment POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
