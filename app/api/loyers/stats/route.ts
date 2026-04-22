import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const supabase = await createClient();

    // 1. Total Revenue
    let query = supabase
      .from('contrat_paiements')
      .select('montant, date_paiement, mode_paiement');
    
    if (startDate) query = query.gte('date_paiement', startDate);
    if (endDate) query = query.lte('date_paiement', endDate);

    const { data: payments, error: payError } = await query;

    if (payError) throw payError;

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.montant), 0);

    // 2. Revenue by Month (Last 12 months)
    const monthlyRevenue: Record<string, number> = {};
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
      monthlyRevenue[key] = 0;
    }

    payments.forEach(p => {
      const d = new Date(p.date_paiement);
      const key = d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
      if (monthlyRevenue[key] !== undefined) {
        monthlyRevenue[key] += Number(p.montant);
      }
    });

    // 3. Revenue by Mode
    const modeRevenue: Record<string, number> = {};
    payments.forEach(p => {
      const mode = p.mode_paiement || 'Inconnu';
      modeRevenue[mode] = (modeRevenue[mode] || 0) + Number(p.montant);
    });

    // 4. Contract Stats
    const { data: contracts, error: contractError } = await supabase
      .from('contrats')
      .select('statut, loyer_mensuel');

    if (contractError) throw contractError;

    const totalContracts = contracts.length;
    const activeContracts = contracts.filter(c => c.statut === 'Actif').length;
    const expiredContracts = contracts.filter(c => c.statut === 'Expiré').length;
    const totalPotentialMonthly = contracts
      .filter(c => c.statut === 'Actif')
      .reduce((sum, c) => sum + Number(c.loyer_mensuel), 0);

    return NextResponse.json({
      totalRevenue,
      monthlyRevenue: Object.entries(monthlyRevenue).reverse().map(([name, value]) => ({ name, value })),
      modeRevenue: Object.entries(modeRevenue).map(([name, value]) => ({ name, value })),
      contracts: {
        total: totalContracts,
        active: activeContracts,
        expired: expiredContracts,
      },
      potentialMonthly: totalPotentialMonthly
    });

  } catch (error: any) {
    console.error('Stats API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
