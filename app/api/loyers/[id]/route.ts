import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContractService } from '@/lib/services/loyer.service';

// GET /api/loyers/:id — Get contract details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const service = new ContractService(supabase);
    const contract = await service.getContractDetails(parseInt(id));
    if (!contract) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(contract);
  } catch (error: any) {
    console.error('GET /api/loyers/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/loyers/:id — Update a contract
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const service = new ContractService(supabase);
    await service.saveContract(body, parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PUT /api/loyers/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/loyers/:id — Soft-delete a contract
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const service = new ContractService(supabase);
    await service.deleteContract(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/loyers/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
