import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.username) {
      return NextResponse.json({ error: 'Session expirée ou non autorisée' }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: 'Mot de passe requis' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const trimmedUser = String(session.username).trim();

    // Check direct username & password match
    let query = supabase
      .from('users')
      .select('id, utilisateur, nom_prenom, organization_id')
      .ilike('utilisateur', trimmedUser)
      .eq('mot_de_passe', password);

    if (session.organization_id) {
      query = query.eq('organization_id', session.organization_id);
    }

    const { data: user, error } = await query.maybeSingle();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Mot de passe incorrect' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Authentification réussie',
      user: {
        id: user.id,
        username: user.utilisateur,
        name: user.nom_prenom,
      },
    });
  } catch (error: any) {
    console.error('Verify password error:', error);
    return NextResponse.json({ error: error.message || 'Erreur interne' }, { status: 500 });
  }
}
