import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AdvanceService } from '@/lib/services/advance.service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const advanceService = new AdvanceService(supabase);
    
    const history = await advanceService.getAdvanceHistory(Number(id));
    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
