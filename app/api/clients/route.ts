import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession, isAdminOrManager } from '@/lib/auth_helper';

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(user);
    
    // Fetch specifically id, nom and ref_client
    let query = supabase
      .from('clients')
      .select('id, nom, ref_client')
      .order('nom', { ascending: true });

    // Clients are shared - no per-user isolation needed

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { nom, email, telephone, adresse, ref_client } = body;

    const { data, error } = await supabase
      .from('clients')
      .insert([{
        nom,
        email,
        telephone,
        adresse,
        ref_client
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

