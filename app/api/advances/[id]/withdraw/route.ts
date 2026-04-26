import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AdvanceService } from '@/lib/services/advance.service';
import { getServerSession } from '@/lib/auth_helper';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { amount, notes } = body;
    
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const supabase = await createClient();
    const advanceService = new AdvanceService(supabase);
    
    const result = await advanceService.withdrawAdvance(Number(id), amount, notes, session.username);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
