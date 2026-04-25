import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('voitures')
      .update({ is_deleted: true })
      .eq('id', id);
      
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Vehicles DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
