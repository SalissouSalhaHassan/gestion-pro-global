import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AdvanceService } from '@/lib/services/advance.service';
import { getServerSession } from '@/lib/auth_helper';

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const advanceService = new AdvanceService(supabase);
    const advances = await advanceService.getAllAdvances(session);
    return NextResponse.json(advances);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const advanceService = new AdvanceService(supabase);
    
    if (!body.client_id || !body.montant_initial) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newAdvance = await advanceService.createAdvance(body, session);
    return NextResponse.json(newAdvance, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
