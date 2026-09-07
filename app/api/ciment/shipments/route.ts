import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientTel = searchParams.get("client_tel");
    const camionNo = searchParams.get("camion_no");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = supabase
      .from("gestion_ciment")
      .select("*")
      .order("created_at", { ascending: false });

    if (user.organization_id) {
      query = query.eq("organization_id", user.organization_id);
    }

    if (clientTel) {
      query = query.ilike("client_tel", `%${clientTel}%`);
    }
    if (camionNo) {
      query = query.ilike("camion_no", `%${camionNo}%`);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      // Add 23:59:59 to endDate if it's just a date
      const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
      query = query.lte("created_at", endDateTime);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Ciment Shipments GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      client_tel,
      camion_no,
      transporteur,
      type_ciment,
      destination,
      chauffeur,
      chauffeur_tel,
      bons,
      arrivage,
      tonnage,
      pu,
      frais_ciment,
      frais_transport,
      tva_pourcentage,
      bic_pourcentage
    } = body;

    if (!client_tel || !camion_no || !destination || !tonnage || !pu) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const ton = Number(tonnage) || 0;
    const price = Number(pu) || 0;
    const f_ciment = Number(frais_ciment) || 0;
    const f_transport = Number(frais_transport) || 0;
    const tva_p = Number(tva_pourcentage) || 19;
    const bic_p = Number(bic_pourcentage) || 2;

    if (ton <= 0 || price <= 0) {
      return NextResponse.json({ error: "Le tonnage et le P.U doivent être supérieurs à 0" }, { status: 400 });
    }

    // Backend Calculation Validation
    const base = (ton * price) + f_ciment + f_transport;
    const tva = base * tva_p / 100;
    const bic = base * bic_p / 100;
    const total = base + tva + bic;

    let payload: any = {
      client_tel,
      camion_no,
      transporteur,
      type_ciment,
      destination,
      chauffeur,
      chauffeur_tel,
      bons,
      arrivage,
      tonnage: ton,
      pu: price,
      frais_ciment: f_ciment,
      frais_transport: f_transport,
      tva_pourcentage: tva_p,
      bic_pourcentage: bic_p,
      total,
      utilisateur: user.username,
      user_id: user.id,
      organization_id: user.organization_id || "00000000-0000-0000-0000-000000000001",
      updated_at: new Date().toISOString()
    };

    if (id) {
      // Update
      let updateQuery = supabase
        .from("gestion_ciment")
        .update(payload)
        .eq("id", id);
      if (user.organization_id) {
        updateQuery = updateQuery.eq("organization_id", user.organization_id);
      }
      let { data, error } = await updateQuery
        .select()
        .single();
      
      // Fallback if user_id column in DB is UUID while session user.id is numeric
      if (error && (error.code === "22P02" || error.message?.includes("invalid input syntax for type uuid"))) {
        console.warn("Retrying ciment update with user_id: null due to UUID mismatch");
        payload.user_id = null;
        let retryQuery = supabase
          .from("gestion_ciment")
          .update(payload)
          .eq("id", id);
        if (user.organization_id) {
          retryQuery = retryQuery.eq("organization_id", user.organization_id);
        }
        const retryRes = await retryQuery.select().single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) throw error;
      return NextResponse.json({ success: true, id, message: "Chargement mis à jour" });
    } else {
      // Insert
      let { data, error } = await supabase
        .from("gestion_ciment")
        .insert({
          ...payload,
          montant_paye: 0,
          statut_paiement: "Non Payé"
        })
        .select()
        .single();
        
      // Fallback if user_id column in DB is UUID while session user.id is numeric
      if (error && (error.code === "22P02" || error.message?.includes("invalid input syntax for type uuid"))) {
        console.warn("Retrying ciment insert with user_id: null due to UUID mismatch");
        const retryRes = await supabase
          .from("gestion_ciment")
          .insert({
            ...payload,
            user_id: null,
            montant_paye: 0,
            statut_paiement: "Non Payé"
          })
          .select()
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) throw error;
      return NextResponse.json({ success: true, id: data.id, message: "Chargement créé avec succès" });
    }

  } catch (error: any) {
    console.error("Ciment Shipments POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
