import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  try {
    const { data: clients, error } = await supabase.from("clients").select("id, nom").limit(5);
    if (error) throw error;

    const hasId1 = clients?.some(c => Number(c.id) === 1);
    
    return NextResponse.json({
      clients,
      hasId1,
      recommendation: hasId1 ? "ID 1 exists. Check if another ID is being sent." : "ID 1 is MISSING. You need to seed a default client."
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
