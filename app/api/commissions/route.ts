import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminClient = getAdminClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const url = new URL(request.url);
    const month = url.searchParams.get("month") || new Date().toISOString().slice(0, 7); // e.g. "2026-09"

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    const startOfMonth = `${month}-01T00:00:00Z`;
    const endOfMonth = `${month}-31T23:59:59Z`;

    // 1. Fetch users, monthly targets, invoices, and payouts in parallel
    const [usersRes, targetsRes, invoicesRes, payoutsRes] = await Promise.all([
      adminClient
        .from('users')
        .select(`
          id,
          utilisateur,
          nom_prenom,
          emplacement,
          roles!fk_users_role_id (
            role_name
          )
        `)
        .eq('organization_id', orgId)
        .order('nom_prenom'),
      supabase.from('objectifs_vendeurs').select('*').eq('mois_annee', month),
      supabase
        .from('factures')
        .select('id, created_by, total_ttc, date_facture, statut')
        .eq('organization_id', orgId)
        .gte('date_facture', startOfMonth)
        .lte('date_facture', endOfMonth),
      supabase.from('commissions_versements').select('*').eq('mois_annee', month),
    ]);

    const users = usersRes.data || [];
    const targets = targetsRes.data || [];
    const invoices = invoicesRes.data || [];
    const payouts = payoutsRes.data || [];

    // 2. Aggregate sales per user
    const performanceList = users.map((user: any) => {
      const userInvoices = invoices.filter((inv) => String(inv.created_by) === String(user.id));
      const totalVentes = userInvoices.reduce((sum, inv) => sum + (Number(inv.total_ttc) || 0), 0);
      const targetObj = targets.find((t) => String(t.user_id) === String(user.id));

      const objectifCA = Number(targetObj?.objectif_ca) || 2500000; // Default 2.5M FCFA if not set
      const tauxCommission = Number(targetObj?.taux_commission) || 2.0; // Default 2%
      const primeBonus = Number(targetObj?.prime_bonus_atteinte) || 0;

      const pctAtteinte = objectifCA > 0 ? Math.round((totalVentes / objectifCA) * 100) : 0;
      const isTargetReached = pctAtteinte >= 100;

      const commissionBase = Math.round((totalVentes * tauxCommission) / 100);
      const commissionTotale = commissionBase + (isTargetReached ? primeBonus : 0);

      const userPayouts = payouts.filter((p) => String(p.user_id) === String(user.id));
      const montantPaye = userPayouts.reduce((sum, p) => sum + (Number(p.montant_paye) || 0), 0);
      const soldeRestant = Math.max(0, commissionTotale - montantPaye);

      return {
        userId: user.id,
        nom: user.nom_prenom || user.utilisateur,
        role: user.roles?.role_name || user.role_name || 'Vendeur',
        emplacement: user.emplacement,
        totalVentes,
        nombreFactures: userInvoices.length,
        objectifCA,
        tauxCommission,
        primeBonus,
        pctAtteinte,
        isTargetReached,
        commissionBase,
        commissionTotale,
        montantPaye,
        soldeRestant,
        targetId: targetObj?.id || null,
      };
    });

    // Sort by total sales descending (Leaderboard)
    performanceList.sort((a, b) => b.totalVentes - a.totalVentes);

    // Global KPIs
    const totalCompanySales = performanceList.reduce((sum, p) => sum + p.totalVentes, 0);
    const totalCommissionsDue = performanceList.reduce((sum, p) => sum + p.commissionTotale, 0);
    const totalCommissionsPaid = performanceList.reduce((sum, p) => sum + p.montantPaye, 0);
    const totalCommissionsRemaining = performanceList.reduce((sum, p) => sum + p.soldeRestant, 0);

    return NextResponse.json({
      month,
      kpis: {
        totalCompanySales,
        totalCommissionsDue,
        totalCommissionsPaid,
        totalCommissionsRemaining,
        sellersCount: performanceList.length,
        topPerformer: performanceList[0] || null,
      },
      performances: performanceList,
    });
  } catch (error: any) {
    console.error("Commissions GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { user_id, mois_annee, objectif_ca, taux_commission, prime_bonus_atteinte, notes } = body;

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";

    // Verify user belongs to the same organization
    const { data: targetUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', Number(user_id))
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: "Vendeur introuvable dans votre organisation" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('objectifs_vendeurs')
      .upsert(
        {
          user_id: Number(user_id),
          mois_annee,
          objectif_ca: Number(objectif_ca) || 0,
          taux_commission: Number(taux_commission) || 0,
          prime_bonus_atteinte: Number(prime_bonus_atteinte) || 0,
          notes: notes || null,
          organization_id: orgId,
        },
        { onConflict: 'user_id,mois_annee' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, target: data });
  } catch (error: any) {
    console.error("Commissions POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
