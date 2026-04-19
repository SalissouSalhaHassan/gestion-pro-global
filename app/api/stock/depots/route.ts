import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  
  // As there's no defined 'depots' table in this schema, 
  // we extract active depot names directly from assigned users and existing stock records.
  
  const [usersRes, stocksRes] = await Promise.all([
    supabase.from("users").select("emplacement").not("emplacement", "is", null),
    supabase.from("stocks").select("depot_nom").not("depot_nom", "is", null)
  ]);

  const uniqueDepots = new Set<string>();

  if (usersRes.data) {
    usersRes.data.forEach((u: any) => uniqueDepots.add(u.emplacement));
  }
  if (stocksRes.data) {
    stocksRes.data.forEach((s: any) => uniqueDepots.add(s.depot_nom));
  }

  // Ensure 'Global', 'Principal', 'Boutique' exist as sensible fallback options
  // if no data is found (especially during setup).
  if (uniqueDepots.size === 0) {
    uniqueDepots.add("Boutique");
    uniqueDepots.add("Dépôt Principal");
  }

  // Sort them
  const sortedDepots = Array.from(uniqueDepots).sort((a, b) => a.localeCompare(b));

  return NextResponse.json(sortedDepots);
}
