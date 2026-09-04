import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    
    // 1. Total active vehicles (Scoped by organization)
    let totalVeh = 0;
    let totalValue = 0;
    let alerts = 0;
    let totalExpenses = 0;

    try {
      const { count } = await supabase
        .from('voitures')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_deleted', false);
      totalVeh = count || 0;
    } catch {}

    try {
      const { data: valData } = await supabase
        .from('voitures')
        .select('prix_achat')
        .eq('organization_id', orgId)
        .eq('is_deleted', false);
      totalValue = valData?.reduce((sum, v) => sum + (Number(v.prix_achat) || 0), 0) || 0;
    } catch {}

    try {
      const { count: alertCount } = await supabase
        .from('voitures')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .eq('is_deleted', false)
        .or(`date_expiration.lt.${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()},date_assurance_exp.lt.${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}`);
      alerts = alertCount || 0;
    } catch {}

    try {
      const { data: expData } = await supabase
        .from('vehicle_records')
        .select('amount')
        .eq('organization_id', orgId);
      totalExpenses = expData?.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) || 0;
    } catch {}

    return NextResponse.json({
      total_vehicles: totalVeh,
      total_value: totalValue,
      alerts,
      total_expenses: totalExpenses
    });
  } catch (error: any) {
    console.error('Vehicle stats GET error:', error);
    return NextResponse.json({
      total_vehicles: 0,
      total_value: 0,
      alerts: 0,
      total_expenses: 0
    });
  }
}
