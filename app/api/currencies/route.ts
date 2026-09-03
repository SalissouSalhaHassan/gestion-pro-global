import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';
import { DEFAULT_RATES } from '@/lib/utils/currency_forex';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: currencies, error } = await supabase
      .from('devises')
      .select('*')
      .order('code');

    if (error || !currencies || currencies.length === 0) {
      return NextResponse.json(DEFAULT_RATES);
    }

    return NextResponse.json(currencies);
  } catch (error: any) {
    console.error("Currencies GET error:", error);
    return NextResponse.json(DEFAULT_RATES);
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { code, taux_vers_cfa } = body;

    if (!code || taux_vers_cfa === undefined) {
      return NextResponse.json({ error: "Code et taux requis" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('devises')
      .update({
        taux_vers_cfa: Number(taux_vers_cfa),
        updated_at: new Date().toISOString(),
      })
      .eq('code', code)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Currencies PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
