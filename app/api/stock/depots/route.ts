import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  
  // Use the dedicated 'depots' table as the primary source of truth.
  const { data, error } = await supabase
    .from("depots")
    .select("id, nom")
    .eq("is_active", true)
    .order("nom");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
