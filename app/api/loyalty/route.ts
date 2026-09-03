import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const [clientsRes, txRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id, nom, tel, carte_fidelite_numero, points_fidelite, niveau_fidelite')
        .eq('is_deleted', false)
        .order('points_fidelite', { ascending: false }),
      supabase
        .from('transactions_points_fidelite')
        .select('points, equivalent_fcfa, type_transaction'),
    ]);

    const clients = clientsRes.data || [];
    const transactions = txRes.data || [];

    const totalPointsOutstanding = clients.reduce((sum, c) => sum + (Number(c.points_fidelite) || 0), 0);
    const totalPointsAwarded = transactions
      .filter((t) => t.type_transaction === 'GAIN')
      .reduce((sum, t) => sum + (Number(t.points) || 0), 0);
    const totalPointsRedeemed = transactions
      .filter((t) => t.type_transaction === 'UTILISATION')
      .reduce((sum, t) => sum + (Number(t.points) || 0), 0);
    const totalDiscountsGrantedCFA = transactions
      .filter((t) => t.type_transaction === 'UTILISATION')
      .reduce((sum, t) => sum + (Number(t.equivalent_fcfa) || 0), 0);

    // Tier counts
    const tierCounts = {
      PLATINE: clients.filter((c) => c.niveau_fidelite === 'PLATINE').length,
      OR: clients.filter((c) => c.niveau_fidelite === 'OR').length,
      ARGENT: clients.filter((c) => c.niveau_fidelite === 'ARGENT').length,
      BRONZE: clients.filter((c) => !c.niveau_fidelite || c.niveau_fidelite === 'BRONZE').length,
    };

    return NextResponse.json({
      stats: {
        totalClientsWithPoints: clients.filter((c) => (Number(c.points_fidelite) || 0) > 0).length,
        totalPointsOutstanding,
        totalPointsAwarded,
        totalPointsRedeemed,
        totalDiscountsGrantedCFA,
        tierCounts,
      },
      topLoyalClients: clients.slice(0, 50),
    });
  } catch (error: any) {
    console.error("Loyalty GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
