import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
  });
}

function generateSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${base || 'org'}-${randomSuffix}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const effectiveOrgName = (body.orgName || body.companyName || body.name || "").trim();
    const effectiveAdminUsername = (body.adminUsername || body.adminName || body.username || "admin").trim();
    const effectivePassword = body.password || "admin1234";
    const country = body.country?.trim() || "Niger";
    const currency = body.currency?.trim() || "FCFA";
    const email = body.email?.trim() || null;
    const phone = body.phone?.trim() || null;
    const plan = body.plan || "pro";

    if (!effectiveOrgName || !effectiveAdminUsername || !effectivePassword) {
      return NextResponse.json(
        { error: 'Le nom de l’entreprise, l’identifiant et le mot de passe sont obligatoires.' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    // 1. Resolve unique username for admin user
    let finalAdminUsername = effectiveAdminUsername;
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('utilisateur', finalAdminUsername)
      .maybeSingle();

    if (existingUser) {
      // If the username is already taken (very common when typing "admin"),
      // intelligently resolve it with the organization brand name
      const words = effectiveOrgName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter((w: string) => !['ets', 'ste', 'sarl', 'sa', 'eurl', 'groupe', 'cie'].includes(w) && w.length > 1);

      const mainKeyword = words[0] || effectiveOrgName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      const cleanKeyword = mainKeyword.replace(/[^a-z0-9]/g, '').slice(0, 15) || 'org';

      let candidate = effectiveAdminUsername.toLowerCase() === 'admin' 
        ? `admin_${cleanKeyword}` 
        : `${effectiveAdminUsername}_${cleanKeyword}`;

      // Check if candidate is also taken
      const { data: candidateCheck } = await supabase
        .from('users')
        .select('id')
        .eq('utilisateur', candidate)
        .maybeSingle();

      if (candidateCheck) {
        candidate = `${candidate}_${Math.floor(100 + Math.random() * 900)}`;
      }

      finalAdminUsername = candidate;
    }

    // 2. Create Organization
    const slug = generateSlug(effectiveOrgName);
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: effectiveOrgName,
        slug,
        country: country?.trim() || 'International',
        currency: currency?.trim() || 'FCFA',
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        is_active: true
      })
      .select()
      .single();

    if (orgError || !newOrg) {
      console.error('Error creating organization:', orgError);
      return NextResponse.json(
        { error: 'Échec de la création de l’organisation: ' + (orgError?.message || '') },
        { status: 500 }
      );
    }

    // 3. Create Subscription (14-day Free Trial or chosen plan)
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);

    await supabase.from('subscriptions').insert({
      organization_id: newOrg.id,
      plan: plan || 'pro',
      status: 'active',
      trial_ends_at: trialEnd.toISOString(),
      current_period_end: trialEnd.toISOString(),
      max_users: plan === 'enterprise' ? 9999 : plan === 'pro' ? 25 : 5,
      max_depots: plan === 'enterprise' ? 9999 : plan === 'pro' ? 10 : 2
    });

    // 4. Create Default Warehouse (BOUTIQUE)
    const depotName = `BOUTIQUE_${newOrg.slug.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 30)}`;
    const { data: newDepot, error: depotError } = await supabase
      .from('depots')
      .insert({
        nom: depotName,
        emplacement: depotName,
        adresse: 'Siège Principal',
        organization_id: newOrg.id
      })
      .select()
      .single();

    if (depotError) {
      console.warn('Depot creation warning:', depotError);
    }

    // 5. Setup Company Info
    try {
      const { data: maxInfo } = await supabase
        .from('informations_entreprise')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextId = ((maxInfo?.id as number) || 0) + 1;

      await supabase.from('informations_entreprise').insert({
        id: nextId,
        nom_entreprise: effectiveOrgName,
        pays: country?.trim() || 'International',
        telephone: phone?.trim() || null,
        email: email?.trim() || null,
        notes_pied_facture: 'Merci pour votre confiance.',
        organization_id: newOrg.id
      });
    } catch (infoErr) {
      console.warn('Company info setup warning:', infoErr);
    }

    // 6. Create Admin User
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        utilisateur: finalAdminUsername,
        mot_de_passe: effectivePassword,
        nom_prenom: effectiveOrgName,
        admin: 'Oui',
        role_id: 1, // Admin role
        emplacement: newDepot?.nom || 'BOUTIQUE',
        organization_id: newOrg.id
      })
      .select()
      .single();

    if (userError || !newUser) {
      console.error('Error creating admin user:', userError);
      return NextResponse.json(
        { error: 'Échec de la création du compte administrateur: ' + (userError?.message || '') },
        { status: 500 }
      );
    }

    // 7. Link User to Primary Warehouse
    if (newDepot && newUser) {
      try {
        await supabase.from('user_warehouses').insert({
          user_id: newUser.id,
          depot_id: newDepot.id,
          organization_id: newOrg.id
        });
      } catch (uwErr) {
        console.warn('User warehouse link warning:', uwErr);
      }
    }

    // 8. Log Registration in Activity Log
    try {
      await supabase.from('activity_log').insert({
        user_id: newUser.id,
        username: newUser.utilisateur,
        action: 'ORGANIZATION_REGISTER',
        details: `Création de l’organisation ${newOrg.name} avec forfait ${plan}.`,
        organization_id: newOrg.id
      });
    } catch (actErr) {
      console.warn('Activity log warning:', actErr);
    }

    // 9. Build Session Payload
    const sessionData = {
      id: newUser.id,
      username: newUser.utilisateur,
      role: newUser.role_id,
      admin: newUser.admin,
      emplacement: newDepot?.nom || 'BOUTIQUE',
      depots: newDepot?.nom || 'BOUTIQUE',
      organization_id: newOrg.id,
      organization_name: newOrg.name,
      plan: plan || 'trial',
      permissions: ['ALL']
    };

    const res = NextResponse.json({
      success: true,
      organization: newOrg,
      user: { id: newUser.id, username: newUser.utilisateur },
      credentials: {
        orgName: newOrg.name,
        username: newUser.utilisateur,
        password: effectivePassword,
        phone: phone,
      },
      session: sessionData
    });

    // Only set login cookie if not created by Super Admin from the platform console
    if (!body.fromAdminPlatform) {
      res.cookies.set('gp_session', encodeURIComponent(JSON.stringify(sessionData)), {
        path: '/',
        maxAge: 86400,
        sameSite: 'lax',
        httpOnly: false
      });
    }

    return res;
  } catch (err: any) {
    console.error('Registration exception:', err);
    return NextResponse.json(
      { error: err.message || 'Une erreur inattendue est survenue.' },
      { status: 500 }
    );
  }
}
