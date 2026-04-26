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
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = await createClient();
    const advanceService = new AdvanceService(supabase);
    
    const cancelledAdvance = await advanceService.cancelAdvance(Number(id), session.username);
    
    return NextResponse.json(cancelledAdvance);
  } catch (error: any) {
    console.error("Error cancelling advance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
