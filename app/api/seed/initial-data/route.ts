import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  try {
    // 1. Seed Default Client (ID 1)
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("id", 1)
      .single();

    if (!existingClient) {
      const { error: clientErr } = await supabase.from("clients").insert({
        id: 1,
        ref_client: "CLIENT-0001",
        nom: "CLIENT COMPTANT",
        is_deleted: false
      });
      if (clientErr) throw clientErr;
      console.log("Seeded default client ID 1");
    }

    // 2. Seed Default Depot (Principal)
    const { data: existingDepot } = await supabase
      .from("depots")
      .select("id")
      .eq("nom", "Principal")
      .single();

    if (!existingDepot) {
      const { error: depotErr } = await supabase.from("depots").insert({
        nom: "Principal",
        emplacement: "Point de vente",
        is_active: true
      });
      if (depotErr) throw depotErr;
      console.log("Seeded default depot 'Principal'");
    }

    return NextResponse.json({ 
      success: true, 
      message: "Données initiales (Client 1 & Dépôt Principal) vérifiées/ajoutées avec succès !" 
    });

  } catch (err: any) {
    console.error("Initial Seed Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
