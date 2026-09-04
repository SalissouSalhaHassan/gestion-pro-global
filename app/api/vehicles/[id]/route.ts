import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    
    const { error } = await supabase
      .from('voitures')
      .update({ is_deleted: true })
      .eq('id', id)
      .eq('organization_id', orgId);
      
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Vehicles DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
