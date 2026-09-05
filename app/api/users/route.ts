import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession, isAdminOrManager, isSuperAdmin } from '@/lib/auth_helper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès refusé: Réservé aux administrateurs' }, { status: 403 });
    }

    const isSuper = isSuperAdmin(session);
    const orgId = session.organization_id || '00000000-0000-0000-0000-000000000001';

    // 1. Fetch Roles
    const { data: rolesData } = await supabase
      .from('roles')
      .select('id, role_name')
      .order('id');

    // 2. Fetch Depots scoped to the organization
    let depotQuery = supabase
      .from('depots')
      .select('id, nom')
      .eq('is_deleted', false)
      .order('nom');

    if (!isSuper) {
      depotQuery = depotQuery.eq('organization_id', orgId);
    } else {
      depotQuery = depotQuery.eq('organization_id', orgId);
    }
    const { data: depotsData } = await depotQuery;

    // 3. Fetch Users with warehouses (Strictly scoped by organization_id)
    let userQuery = supabase
      .from('users')
      .select(`
        id,
        utilisateur,
        nom_prenom,
        emplacement,
        admin,
        langue,
        ref_per,
        organization_id,
        created_at,
        roles!fk_users_role_id (
          role_name
        ),
        user_warehouses (
          depot_id,
          depots (
            nom
          )
        )
      `)
      .order('created_at', { ascending: false });

    // Enforce tenant isolation: Regular organization admins MUST ONLY see their own organization's users
    if (!isSuper) {
      userQuery = userQuery.eq('organization_id', orgId);
    } else {
      // Super admin viewing their own organization users or specific org
      const url = new URL(request.url);
      const requestedOrg = url.searchParams.get('organization_id');
      if (requestedOrg) {
        userQuery = userQuery.eq('organization_id', requestedOrg);
      } else {
        userQuery = userQuery.eq('organization_id', orgId);
      }
    }

    const { data: usersData, error: userErr } = await userQuery;
    if (userErr) throw userErr;

    return NextResponse.json({
      success: true,
      roles: rolesData || [],
      depots: depotsData || [],
      users: usersData || [],
      currentOrgId: orgId,
      isSuperAdmin: isSuper,
    });
  } catch (error: any) {
    console.error('Users GET API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const isSuper = isSuperAdmin(session);
    const orgId = session.organization_id || '00000000-0000-0000-0000-000000000001';

    const body = await request.json();
    const { id, utilisateur, nom_prenom, role_id, emplacement, admin, langue, ref_per, mot_de_passe, depots } = body;

    if (!utilisateur || (!id && !mot_de_passe)) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    const userData: any = {
      utilisateur,
      nom_prenom: nom_prenom || '',
      role_id: role_id ? parseInt(role_id) : null,
      emplacement: emplacement || '',
      admin: admin || 'Non',
      langue: langue || 'fr',
      ref_per: ref_per || '',
      organization_id: orgId,
    };

    if (mot_de_passe) {
      userData.mot_de_passe = mot_de_passe;
    }

    let savedUserId = id ? Number(id) : null;

    if (savedUserId) {
      // Verify target user belongs to this organization
      if (!isSuper) {
        const { data: existing } = await supabase
          .from('users')
          .select('id, organization_id')
          .eq('id', savedUserId)
          .eq('organization_id', orgId)
          .maybeSingle();

        if (!existing) {
          return NextResponse.json({ error: 'Utilisateur introuvable dans votre organisation' }, { status: 403 });
        }
      }

      const { error: updateErr } = await supabase
        .from('users')
        .update(userData)
        .eq('id', savedUserId);
      if (updateErr) throw updateErr;
    } else {
      const { data: created, error: insertErr } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();
      if (insertErr) throw insertErr;
      savedUserId = created.id;
    }

    // Update user_warehouses
    if (savedUserId) {
      await supabase.from('user_warehouses').delete().eq('user_id', savedUserId);
      if (Array.isArray(depots) && depots.length > 0) {
        const warehouseInserts = depots.map((depotId: number) => ({
          user_id: savedUserId,
          depot_id: depotId,
          organization_id: orgId,
        }));
        await supabase.from('user_warehouses').insert(warehouseInserts);
      }
    }

    return NextResponse.json({ success: true, userId: savedUserId });
  } catch (error: any) {
    console.error('Users POST API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

    const targetId = Number(id);
    if (Number(session.id) === targetId) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 });
    }

    const isSuper = isSuperAdmin(session);
    const orgId = session.organization_id || '00000000-0000-0000-0000-000000000001';

    // Verify ownership
    if (!isSuper) {
      const { data: existing } = await supabase
        .from('users')
        .select('id, organization_id')
        .eq('id', targetId)
        .eq('organization_id', orgId)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: 'Utilisateur introuvable dans votre organisation' }, { status: 403 });
      }
    }

    // Delete user warehouses first
    await supabase.from('user_warehouses').delete().eq('user_id', targetId);

    const { error: delErr } = await supabase
      .from('users')
      .delete()
      .eq('id', targetId);

    if (delErr) throw delErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Users DELETE API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
