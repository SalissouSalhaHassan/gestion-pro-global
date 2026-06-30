import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager, getAllowedDepots } from "@/lib/auth_helper";

export async function GET() {
  const supabase = await createClient();
  const user = await getServerSession();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = await isAdminOrManager(user);
  const allowedDepots = getAllowedDepots(user);
  const userDepot = user.emplacement || "";

  // Use the dedicated 'depots' table as the primary source of truth.
  let query = supabase
    .from("depots")
    .select("id, nom")
    .eq("is_active", true)
    .order("nom");

  if (!isAdmin) {
    const depotsToFilter = allowedDepots.length > 0 ? allowedDepots : (userDepot ? [userDepot] : []);
    if (depotsToFilter.length > 0) {
      query = query.in("nom", depotsToFilter);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
