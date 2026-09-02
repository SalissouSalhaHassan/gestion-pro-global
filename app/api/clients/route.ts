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
      try {
        const { data, error } = await query.or(`created_by.eq.${user.id},id.eq.${DEFAULT_CLIENT_ID}`);
        if (!error) return NextResponse.json(data);
      } catch (e) {
        // Fallback without created_by filter
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json(data || []);
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

    const basePayload = {
      nom,
      email: email || null,
      tel: tel || telephone || null,
      adresse: adresse || null,
      ref_client: ref_client || null,
    };

    // Try inserting with created_by first
    const { data, error } = await supabase
      .from('clients')
      .insert([{ ...basePayload, created_by: user.id }])
      .select()
      .single();

    if (!error) {
      return NextResponse.json(data);
    }

    // Fallback: If created_by column does not exist in schema, insert without it
    if (error.message?.includes('created_by') || error.code === 'PGRST204' || error.message?.includes('schema cache')) {
      const { data: fallbackData, error: fallbackErr } = await supabase
        .from('clients')
        .insert([basePayload])
        .select()
        .single();

      if (fallbackErr) throw fallbackErr;
      return NextResponse.json(fallbackData);
    }

    throw error;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
