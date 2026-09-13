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
    const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";
    
    // Fetch all client columns for list and details
    let query = supabase
      .from('clients')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_deleted', false)
      .order('nom', { ascending: true });

    // ── CLIENT ISOLATION: Dépôt users only see their own clients + default client ──
    if (!isAdmin) {
      try {
        let isolatedQuery = supabase
          .from('clients')
          .select('*')
          .eq('organization_id', orgId)
          .eq('is_deleted', false);
        const { data, error } = await isolatedQuery.or(`created_by.eq.${user.id},id.eq.${DEFAULT_CLIENT_ID}`);
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
    const {
      nom,
      email,
      telephone,
      tel,
      gsm,
      fax,
      site,
      site_web,
      adresse,
      contact,
      personne_contact,
      ice,
      rc,
      patente,
      nif,
      art_imp,
      n_compte,
      compte_bancaire,
      montant_plafond,
      pre_client,
      pre_paiement,
      prix_client,
      commerciale,
      nom_commercial,
      type_client,
      ref_client,
      organization_id,
    } = body;

    const orgId = user.organization_id || organization_id || '00000000-0000-0000-0000-000000000001';

    let finalRef = ref_client;
    if (!finalRef) {
      const year = new Date().getFullYear();
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      finalRef = `CL-${year}-${randomPart}`;
    }

    const basePayload: Record<string, any> = {
      nom,
      email: email || null,
      tel: tel || telephone || null,
      gsm: gsm || null,
      fax: fax || null,
      site: site || site_web || null,
      adresse: adresse || null,
      contact: contact || personne_contact || null,
      ice: ice || null,
      rc: rc || null,
      patente: patente || null,
      nif: nif || null,
      art_imp: art_imp || null,
      n_compte: n_compte || compte_bancaire || null,
      montant_plafond: typeof montant_plafond === 'number' ? montant_plafond : (parseFloat(montant_plafond) || 0),
      pre_client: pre_client === true || pre_paiement === true,
      prix_client: prix_client ? Number(prix_client) : 1,
      commerciale: commerciale || nom_commercial || null,
      type_client: type_client || 'Détail',
      ref_client: finalRef,
      organization_id: orgId,
      is_deleted: false,
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
