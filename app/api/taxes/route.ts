import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    const orgId = session?.organization_id || "00000000-0000-0000-0000-000000000001";

    const { data: taxSettings } = await supabase
      .from('parametres_fiscaux')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();

    return NextResponse.json(
      taxSettings || {
        id: 1,
        taux_tva_defaut: 19.0,
        tva_activee: true,
        nif: '',
        rccm: '',
        centre_impots: 'DGI Niamey',
      }
    );
  } catch (error: any) {
    console.error("Taxes GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";

    const body = await request.json();
    const { taux_tva_defaut, tva_activee, nif, rccm, centre_impots } = body;

    const { data: existing } = await supabase
      .from('parametres_fiscaux')
      .select('id')
      .eq('organization_id', orgId)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('parametres_fiscaux')
        .update({
          taux_tva_defaut: Number(taux_tva_defaut) || 19.0,
          tva_activee: Boolean(tva_activee),
          nif: nif || '',
          rccm: rccm || '',
          centre_impots: centre_impots || 'DGI Niamey',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('organization_id', orgId)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('parametres_fiscaux')
        .insert({
          taux_tva_defaut: Number(taux_tva_defaut) || 19.0,
          tva_activee: Boolean(tva_activee),
          nif: nif || '',
          rccm: rccm || '',
          centre_impots: centre_impots || 'DGI Niamey',
          organization_id: orgId,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Taxes PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
