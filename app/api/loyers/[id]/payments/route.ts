import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContractService } from '@/lib/services/loyer.service';

// GET /api/loyers/:id/payments — Get payments for a specific contract
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const service = new ContractService(supabase);
    const payments = await service.loadPaymentsForContract(parseInt(id));
    return NextResponse.json(payments);
  } catch (error: any) {
    console.error('GET /api/loyers/[id]/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/loyers/:id/payments — Create a payment for a contract
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const service = new ContractService(supabase);

    // Ensure contrat_id is set
    body.contrat_id = parseInt(id);
    await service.savePayment(body);

    // Update contract status to Actif after payment
    await service.updateContractStatus(parseInt(id), 'Actif');

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/loyers/[id]/payments error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
