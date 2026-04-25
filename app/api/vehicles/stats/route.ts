import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // 1. Total active vehicles
    const { count: totalVeh, error: err1 } = await supabase
      .from('voitures')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);
      
    // 2. Total fleet value
    const { data: valData, error: err2 } = await supabase
      .from('voitures')
      .select('prix_achat')
      .eq('is_deleted', false);
      
    // 3. Active document alerts
    const { count: alerts, error: err3 } = await supabase
      .from('voitures')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .or(`date_expiration.lt.${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()},date_assurance_exp.lt.${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}`);
      
    // 4. Total records expenses
    const { data: expData, error: err4 } = await supabase
      .from('vehicle_records')
      .select('amount');
      
    if (err1 || err2 || err3 || err4) throw err1 || err2 || err3 || err4;
    
    const totalValue = valData?.reduce((sum, v) => sum + (Number(v.prix_achat) || 0), 0) || 0;
    const totalExpenses = expData?.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) || 0;
    
    return NextResponse.json({
      total_vehicles: totalVeh || 0,
      total_value: totalValue,
      alerts: alerts || 0,
      total_expenses: totalExpenses
    });
  } catch (error: any) {
    console.error('Vehicle stats GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
