import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AdvanceService } from '@/lib/services/advance.service';

// UPDATE
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();
    const advanceService = new AdvanceService(supabase);
    
    // Only update allowed fields (e.g., date, note, references. If modifying amount, ensure logical consistency)
    const updatedAdvance = await advanceService.updateAdvance(Number(id), body);
    
    return NextResponse.json(updatedAdvance);
  } catch (error: any) {
    console.error("Error updating advance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const advanceService = new AdvanceService(supabase);
    
    await advanceService.deleteAdvance(Number(id));
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting advance:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
