import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';
import { applyUserScope } from '@/lib/utils/scoping';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: "ID de client invalide" }, { status: 400 });
    }

    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const supabase = await createClient();

    let query = supabase
      .from('factures')
      .select('id, bl_number, date_facture, total_ttc, montant_paye, montant_restant, statut, notes')
      .eq('client_id', clientId)
      .eq('is_deleted', false)
      .neq('statut', 'Payée')
      .gt('montant_restant', 0)
      .order('date_facture', { ascending: true });

    // Apply scoping if needed
    query = applyUserScope(query as any, session, 'factures');

    const { data: unpaidInvoices, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      invoices: unpaidInvoices || [],
      count: unpaidInvoices?.length || 0
    });
  } catch (err: any) {
    console.error("Error fetching client unpaid invoices:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
