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
    const depot = searchParams.get("depot");
    const status = searchParams.get("status");
    const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";

    let query = supabase
      .from("stock_transits")
      .select("*")
      .eq("organization_id", orgId)
      .order("date_expedition", { ascending: false });

    if (depot && depot !== "Tous") {
       // Filter transfers where depot is source or destination
       query = query.or(`source_depot.ilike.%${depot}%,dest_depot.ilike.%${depot}%`);
    }

    if (status && status !== "Tous") {
       query = query.eq("status", status);
    }

    const { data: transits, error } = await query;

    if (error) throw error;

    return NextResponse.json(transits || []);

  } catch (error: any) {
    console.error("Transits Fetch API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
