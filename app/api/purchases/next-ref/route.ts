import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    let query = supabase
      .from('achats')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (session.organization_id) {
      query = query.eq('organization_id', session.organization_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    const lastId = data && data.length > 0 ? data[0].id : 0;
    const nextId = lastId + 1;
    const year = new Date().getFullYear();
    const ref = `FAC-ACH-${year}-${String(nextId).padStart(4, '0')}`;

    return NextResponse.json({ ref });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
