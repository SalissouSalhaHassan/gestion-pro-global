import { NextResponse } from 'next/server';
import { getServerSession, isSuperAdmin } from '@/lib/auth_helper';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!isSuperAdmin(session) && session.organization_id !== id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const supabase = getAdminClient();

    const [orgRes, subRes, usersRes, facturesRes] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', id).single(),
      supabase.from('subscriptions').select('*').eq('organization_id', id).maybeSingle(),
      supabase.from('users').select('id, utilisateur, nom_prenom, role_name, is_active').eq('organization_id', id),
      supabase.from('factures').select('id, total_ttc').eq('organization_id', id),
    ]);

    if (orgRes.error || !orgRes.data) {
      return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
    }

    const org = orgRes.data;
    const sub = subRes.data || { plan: 'pro', status: 'active', max_users: 15, max_depots: 5 };
    const users = usersRes.data || [];
    const factures = facturesRes.data || [];
    const totalVolume = factures.reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);

    return NextResponse.json({
      organization: {
        ...org,
        subscription: sub,
        users,
        usersCount: users.length,
        invoicesCount: factures.length,
        totalVolume,
      },
    });
  } catch (error: any) {
    console.error("Platform org GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    
    // Only superadmin can modify platform-level settings for any tenant
    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: "Accès refusé. Réservé au Super Administrateur." }, { status: 403 });
    }

    const supabase = getAdminClient();
    const body = await request.json();
    const {
      is_active,
      name,
      country,
      currency,
      phone,
      email,
      plan,
      status,
      max_users,
      max_depots,
      extend_days,
      new_admin_password,
    } = body;

    // 1. Update Organization Table if fields provided
    const orgUpdates: any = {};
    if (typeof is_active === 'boolean') orgUpdates.is_active = is_active;
    if (name) orgUpdates.name = name.trim();
    if (country) orgUpdates.country = country.trim();
    if (currency) orgUpdates.currency = currency.trim();
    if (phone !== undefined) orgUpdates.phone = phone?.trim() || null;
    if (email !== undefined) orgUpdates.email = email?.trim() || null;

    if (Object.keys(orgUpdates).length > 0) {
      orgUpdates.updated_at = new Date().toISOString();
      const { error: orgErr } = await supabase
        .from('organizations')
        .update(orgUpdates)
        .eq('id', id);
      if (orgErr) throw orgErr;
    }

    // 2. Update Subscriptions Table if fields provided
    const subUpdates: any = {};
    if (plan) subUpdates.plan = plan;
    if (status) subUpdates.status = status;
    if (max_users !== undefined) subUpdates.max_users = Number(max_users);
    if (max_depots !== undefined) subUpdates.max_depots = Number(max_depots);

    if (extend_days && Number(extend_days) > 0) {
      const newPeriodEnd = new Date();
      newPeriodEnd.setDate(newPeriodEnd.getDate() + Number(extend_days));
      subUpdates.current_period_end = newPeriodEnd.toISOString();
      subUpdates.status = 'active';
    }

    if (Object.keys(subUpdates).length > 0) {
      subUpdates.updated_at = new Date().toISOString();
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('organization_id', id)
        .maybeSingle();

      if (existingSub) {
        await supabase
          .from('subscriptions')
          .update(subUpdates)
          .eq('organization_id', id);
      } else {
        await supabase.from('subscriptions').insert({
          organization_id: id,
          plan: plan || 'pro',
          status: status || 'active',
          max_users: max_users || 15,
          max_depots: max_depots || 5,
          ...subUpdates,
        });
      }
    }

    // 3. Optional update of admin user password
    if (new_admin_password && new_admin_password.trim().length >= 4) {
      await supabase
        .from('users')
        .update({ mot_de_passe: new_admin_password.trim() })
        .eq('organization_id', id);
    }

    return NextResponse.json({ success: true, message: "Organisation mise à jour avec succès" });
  } catch (error: any) {
    console.error("Platform org PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    if (!isSuperAdmin(session)) {
      return NextResponse.json({ error: "Accès refusé. Réservé au Super Administrateur." }, { status: 403 });
    }

    const supabase = getAdminClient();

    // 1. Fetch organization to verify it exists and is not root
    const { data: org, error: fetchErr } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !org) {
      return NextResponse.json({ error: "Organisation introuvable" }, { status: 404 });
    }

    // 2. Protect primary root organization
    const isRoot =
      id === '00000000-0000-0000-0000-000000000001' ||
      org.slug === 'gestion-pro-global' ||
      org.name?.toLowerCase().includes('gestion pro global');

    if (isRoot) {
      return NextResponse.json(
        { error: "Impossible de supprimer l'organisation principale du système." },
        { status: 403 }
      );
    }

    // 3. Cascade cleanup of dependent tables
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', id);

    if (users && users.length > 0) {
      const userIds = users.map((u: any) => u.id);
      await supabase.from('user_warehouses').delete().in('user_id', userIds);
      await supabase.from('activity_log').delete().in('user_id', userIds);
      await supabase.from('users').delete().eq('organization_id', id);
    }

    await supabase.from('subscriptions').delete().eq('organization_id', id);
    await supabase.from('depots').delete().eq('organization_id', id);
    await supabase.from('informations_entreprise').delete().eq('organization_id', id);
    await supabase.from('activity_log').delete().eq('organization_id', id);

    try { await supabase.from('articles').delete().eq('organization_id', id); } catch (e) {}
    try { await supabase.from('factures').delete().eq('organization_id', id); } catch (e) {}
    try { await supabase.from('clients').delete().eq('organization_id', id); } catch (e) {}
    try { await supabase.from('fournisseurs').delete().eq('organization_id', id); } catch (e) {}
    try { await supabase.from('bons_commande').delete().eq('organization_id', id); } catch (e) {}
    try { await supabase.from('cheques_et_effets').delete().eq('organization_id', id); } catch (e) {}

    const { error: delError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (delError) throw delError;

    return NextResponse.json({
      success: true,
      message: `Organisation ${org.name} supprimée avec succès.`,
    });
  } catch (error: any) {
    console.error("Platform org DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
