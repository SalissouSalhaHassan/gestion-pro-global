import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';
import { ContractService } from '@/lib/services/loyer.service';

// GET /api/loyers/payments — Load all payments with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = {
      locataire: searchParams.get('locataire') || undefined,
      mois: searchParams.get('mois') || undefined,
      mode: searchParams.get('mode') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
    };

    const supabase = await createClient();
    const session = await getServerSession();
    const service = new ContractService(supabase);
    const payments = await service.loadPayments(filters, session?.organization_id);
    return NextResponse.json(payments);
  } catch (error: any) {
    console.error('GET /api/loyers/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
