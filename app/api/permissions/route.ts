import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET: Fetch all roles, all permissions (grouped), and role_permissions mapping
export async function GET() {
  const supabase = await createClient();

  try {
    // 1. Fetch all roles
    const { data: roles, error: rolesErr } = await supabase
      .from("roles")
      .select("id, role_name, description")
      .order("role_name");

    if (rolesErr) throw rolesErr;

    // 2. Fetch all permissions
    const { data: permissions, error: permsErr } = await supabase
      .from("permissions")
      .select("id, permission_key, description")
      .order("description");

    if (permsErr) throw permsErr;

    // 3. Fetch all role_permissions mappings
    const { data: rolePerms, error: rpErr } = await supabase
      .from("role_permissions")
      .select("role_id, permission_id");

    if (rpErr) throw rpErr;

    // 4. Group permissions by category (same logic as Python)
    const categoryMap: Record<string, string> = {
      sale: "Ventes & Facturation",
      stock: "Gestion de Stock",
      client: "Clients & Crédits",
      supplier: "Fournisseurs & Achats",
      expense: "Dépenses & Caisse",
      report: "Rapports & Statistiques",
      admin: "Administration & Paramètres",
      user: "Utilisateurs & Profils",
      pos: "Point de Vente (POS)",
      deposit: "Acomptes & Avances",
      vehicles: "Gestion Parc & Véhicules",
      rent: "Gestion des Loyers",
      cement: "Gestion du Ciment",
    };

    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions || []) {
      const key = p.permission_key.toLowerCase();
      const prefix = key.includes(".") ? key.split(".")[0] : "other";
      const category = categoryMap[prefix] || "Autres";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(p);
    }

    // 5. Build role->permission_ids map
    const rolePermMap: Record<number, number[]> = {};
    for (const rp of rolePerms || []) {
      if (!rolePermMap[rp.role_id]) rolePermMap[rp.role_id] = [];
      rolePermMap[rp.role_id].push(rp.permission_id);
    }

    // Count users per role
    const { data: userCounts } = await supabase
      .from("users")
      .select("role_id");

    const roleCounts: Record<number, number> = {};
    for (const u of userCounts || []) {
      if (u.role_id) {
        roleCounts[u.role_id] = (roleCounts[u.role_id] || 0) + 1;
      }
    }

    return NextResponse.json({
      roles: roles || [],
      groupedPermissions: grouped,
      rolePermissions: rolePermMap,
      roleCounts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Update permissions for a role
export async function PUT(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { role_id, permission_ids } = body;

  if (!role_id) {
    return NextResponse.json({ error: "role_id requis" }, { status: 400 });
  }

  try {
    // 1. Delete existing permissions for this role
    const { error: delErr } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", role_id);

    if (delErr) throw delErr;

    // 2. Insert new permissions
    if (permission_ids && permission_ids.length > 0) {
      const rows = permission_ids.map((pid: number) => ({
        role_id,
        permission_id: pid,
      }));
      const { error: insErr } = await supabase
        .from("role_permissions")
        .insert(rows);

      if (insErr) throw insErr;
    }

    return NextResponse.json({
      success: true,
      message: `${permission_ids?.length || 0} permissions mises à jour.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
