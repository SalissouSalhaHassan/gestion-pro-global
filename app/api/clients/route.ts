import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession, isAdminOrManager } from '@/lib/auth_helper';
import { DEFAULT_CLIENT_ID } from '@/lib/client_helpers';

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(user);
    
    // Fetch specifically id, nom, ref_client, tel, credit_facture, and credit_bl
    let query = supabase
      .from('clients')
      .select('id, nom, ref_client, tel, credit_facture, credit_bl')
      .order('nom', { ascending: true });

    // ── CLIENT ISOLATION: Dépôt users only see their own clients + default client ──
    if (!isAdmin) {
      query = query.or(`created_by.eq.${user.id},id.eq.${DEFAULT_CLIENT_ID}`);
    }

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
    const { nom, email, telephone, tel, adresse, ref_client } = body;

    const { data, error } = await supabase
      .from('clients')
      .insert([{
        nom,
        email,
        tel: tel || telephone || null,
        adresse,
        ref_client,
        created_by: user.id  // Track which user created this client
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
