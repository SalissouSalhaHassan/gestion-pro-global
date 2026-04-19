import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AdvanceService } from '@/lib/services/advance.service';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // In Next.js 15+, params is a Promise
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, notes, username } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const supabase = await createClient();
    const advanceService = new AdvanceService(supabase);
    
    const result = await advanceService.withdrawAdvance(Number(id), amount, notes, username);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
