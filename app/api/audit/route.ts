import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get("severity");
    const module = searchParams.get("module");
    const actionType = searchParams.get("action_type");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");

    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (session.organization_id) {
      query = query.eq("organization_id", session.organization_id);
    }

    if (severity && severity !== "ALL") query = query.eq("severity", severity);
    if (module && module !== "ALL") query = query.eq("module", module);
    if (actionType && actionType !== "ALL") query = query.eq("action_type", actionType);
    if (search) query = query.or(`description.ilike.%${search}%,username.ilike.%${search}%`);

    const { data: logs, error } = await query;
    if (error) throw error;

    // Calculate Summary Stats
    const totalCount = logs?.length || 0;
    const criticalCount = logs?.filter((l) => l.severity === "CRITICAL").length || 0;
    const highCount = logs?.filter((l) => l.severity === "HIGH").length || 0;
    const deleteCount = logs?.filter((l) => l.action_type === "DELETE_INVOICE").length || 0;
    const priceOverrideCount = logs?.filter((l) => l.action_type === "PRICE_OVERRIDE").length || 0;

    return NextResponse.json({
      logs: logs || [],
      stats: {
        totalCount,
        criticalCount,
        highCount,
        deleteCount,
        priceOverrideCount,
      },
    });
  } catch (error: any) {
    console.error("Audit logs GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { action_type, severity = "MEDIUM", module = "VENTES", description, metadata, target_id } = body;

    if (!action_type || !description) {
      return NextResponse.json({ error: "action_type et description requis" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("audit_logs")
      .insert({
        action_type,
        severity,
        module,
        description,
        metadata: metadata || {},
        target_id: target_id ? String(target_id) : null,
        user_id: session.id ? Number(session.id) : null,
        username: session.username || "Système",
        organization_id: session.organization_id || "00000000-0000-0000-0000-000000000001",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Audit log POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
