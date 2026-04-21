import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContractService } from '@/lib/services/loyer.service';

// GET /api/loyers — Load all contracts
export async function GET() {
  try {
    const supabase = await createClient();
    const service = new ContractService(supabase);
    const contracts = await service.loadContracts();
    return NextResponse.json(contracts);
  } catch (error: any) {
    console.error('GET /api/loyers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/loyers — Create a new contract
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    const service = new ContractService(supabase);
    await service.saveContract(body);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/loyers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
