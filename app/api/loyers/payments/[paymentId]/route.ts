import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContractService } from '@/lib/services/loyer.service';

// PUT /api/loyers/payments/:paymentId — Update a payment
export async function PUT(request: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const { paymentId } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const service = new ContractService(supabase);
    await service.updatePayment(parseInt(paymentId), body);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT /api/loyers/payments/[paymentId] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/loyers/payments/:paymentId — Delete a payment
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ paymentId: string }> }) {
  try {
    const { paymentId } = await params;
    const supabase = await createClient();
    const service = new ContractService(supabase);
    await service.deletePayment(parseInt(paymentId));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/loyers/payments/[paymentId] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
