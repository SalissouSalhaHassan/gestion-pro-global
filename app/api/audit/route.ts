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

    let logs: any[] = [];
    let needsMigration = false;

    // 1. Primary: Try audit_logs
    try {
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

      const { data, error } = await query;
      if (error) {
        // Table or organization_id column missing
        needsMigration = true;
      } else {
        logs = data || [];
      }
    } catch (e) {
      needsMigration = true;
    }

    // 2. Fallback: If audit_logs table is missing or returned 0, load from activity_log for current organization
    if (needsMigration || logs.length === 0) {
      try {
        let actQuery = supabase
          .from("activity_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (session.organization_id) {
          actQuery = actQuery.eq("organization_id", session.organization_id);
        }
        if (search) {
          actQuery = actQuery.or(`details.ilike.%${search}%,username.ilike.%${search}%`);
        }

        const { data: actData } = await actQuery;
        if (actData && actData.length > 0 && logs.length === 0) {
          logs = actData.map((a: any) => {
            const actStr = (a.action || "").toUpperCase();
            const isDelete = actStr.includes("DELETE") || actStr.includes("SUPPR");
            const isCritical = isDelete || actStr.includes("CANCEL") || actStr.includes("REJET");
            const isPrice = actStr.includes("PRICE") || actStr.includes("REMISE");

            let mappedAction = "EVENT";
            if (isDelete) mappedAction = "DELETE_INVOICE";
            else if (isPrice) mappedAction = "PRICE_OVERRIDE";
            else mappedAction = a.action || "SYSTEM_EVENT";

            return {
              id: a.id,
              action_type: mappedAction,
              severity: isCritical ? "CRITICAL" : (isDelete ? "HIGH" : "MEDIUM"),
              module: (a.entity_type || "VENTES").toUpperCase(),
              description: a.details || `${a.action} sur ${a.entity_type}`,
              target_id: a.entity_id ? String(a.entity_id) : null,
              username: a.username || "Système",
              organization_id: a.organization_id,
              created_at: a.created_at,
            };
          });
        }
      } catch (actErr) {
        console.error("activity_log fallback error:", actErr);
      }
    }

    // Calculate Summary Stats
    const totalCount = logs.length;
    const criticalCount = logs.filter((l) => l.severity === "CRITICAL").length;
    const highCount = logs.filter((l) => l.severity === "HIGH").length;
    const deleteCount = logs.filter((l) => l.action_type === "DELETE_INVOICE" || (l.action_type || "").includes("DELETE")).length;
    const priceOverrideCount = logs.filter((l) => l.action_type === "PRICE_OVERRIDE").length;

    return NextResponse.json({
      logs,
      needsMigration,
      currentOrgId: session.organization_id,
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
    return NextResponse.json({
      logs: [],
      needsMigration: true,
      stats: { totalCount: 0, criticalCount: 0, highCount: 0, deleteCount: 0, priceOverrideCount: 0 },
      error: error.message
    }, { status: 200 });
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

    const payload: any = {
      action_type,
      severity,
      module,
      description,
      metadata: metadata || {},
      target_id: target_id ? String(target_id) : null,
      user_id: session.id ? Number(session.id) : null,
      username: session.username || "Système",
      created_at: new Date().toISOString(),
    };

    if (session.organization_id) {
      payload.organization_id = session.organization_id;
    }

    const { data, error } = await supabase
      .from("audit_logs")
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      // Fallback to activity_log
      await supabase.from("activity_log").insert({
        user_id: session.id ? Number(session.id) : null,
        username: session.username || "Système",
        action: action_type,
        entity_type: module,
        entity_id: target_id ? Number(target_id) || null : null,
        details: description,
        organization_id: session.organization_id || null,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(data || { ok: true }, { status: 201 });
  } catch (error: any) {
    console.error("Audit log POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
