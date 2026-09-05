import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AdvanceService } from '@/lib/services/advance.service';
import { getServerSession } from '@/lib/auth_helper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const clientId = parseInt(id, 10);
    if (isNaN(clientId)) {
      return NextResponse.json({ error: "ID client invalide" }, { status: 400 });
    }

    const session = await getServerSession();
    const supabase = await createClient();
    const advanceService = new AdvanceService(supabase);
    
    // Fetch only active advances (FIFO)
    const advances = await advanceService.getActiveAdvancesByClientId(clientId, session || undefined);
    
    // Calculate total balance for convenience
    const totalBalance = (advances || []).reduce((sum: number, adv: any) => sum + Number(adv.montant_restant || 0), 0);
    
    return NextResponse.json({
        advances: advances || [],
        totalBalance
    });
  } catch (error: any) {
    console.error("Error fetching client advances:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
