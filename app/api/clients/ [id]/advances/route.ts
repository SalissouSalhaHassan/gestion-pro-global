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
    
    // Fetch only active advances (FIFO)
    const advances = await advanceService.getActiveAdvancesByClientId(Number(id));
    
    // Calculate total balance for convenience
    const totalBalance = advances.reduce((sum, adv) => sum + Number(adv.montant_restant), 0);
    
    return NextResponse.json({
        advances,
        totalBalance
    });
  } catch (error: any) {
    console.error("Error fetching client advances:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
