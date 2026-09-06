import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const statut = searchParams.get('statut');
    const search = searchParams.get('search');

    // First attempt: try querying with organization_id if available
    let query = supabase
      .from('bons_commande')
      .select('*, items:bon_commande_items(*)')
      .order('created_at', { ascending: false });

    if (session.organization_id) {
      query = query.eq('organization_id', session.organization_id);
    }
    if (statut && statut !== 'ALL') {
      query = query.eq('statut', statut);
    }
    if (search) {
      query = query.or(`numero_bc.ilike.%${search}%,fournisseur_nom.ilike.%${search}%`);
    }

    let { data: bcs, error } = await query;

    // If error was caused by missing organization_id column in PostgreSQL, retry without it
    if (error && (error.code === 'PGRST204' || error.message?.includes('organization_id'))) {
      let fallbackQuery = supabase
        .from('bons_commande')
        .select('*, items:bon_commande_items(*)')
        .order('created_at', { ascending: false });

      if (statut && statut !== 'ALL') {
        fallbackQuery = fallbackQuery.eq('statut', statut);
      }
      if (search) {
        fallbackQuery = fallbackQuery.or(`numero_bc.ilike.%${search}%,fournisseur_nom.ilike.%${search}%`);
      }

      const res = await fallbackQuery;
      bcs = res.data;
      error = res.error;
    }

    if (error) {
      // Only treat genuine missing table error as uninitialized
      if (
        error.message?.includes('relation "bons_commande" does not exist') ||
        error.message?.includes('relation "public.bons_commande" does not exist') ||
        error.message?.includes("Could not find the 'bons_commande' table")
      ) {
        console.warn("Table bons_commande not yet created in Supabase. Returning empty array.");
        return NextResponse.json([]);
      }
      throw error;
    }

    return NextResponse.json(bcs || []);
  } catch (error: any) {
    console.error("Bons de commande GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { fournisseur_id, fournisseur_nom, date_livraison_prevue, notes, depot_id, items } = body;

    if (!fournisseur_nom || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Fournisseur et articles requis" }, { status: 400 });
    }

    // Auto-generate unique BC number (e.g., BC-2026-0001, BC-2026-0002)
    const year = new Date().getFullYear();
    let nextSeq = 1;

    try {
      // Find the maximum existing sequence number from existing bons_commande
      const { data: latestBc } = await supabase
        .from('bons_commande')
        .select('id, numero_bc')
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestBc) {
        const match = latestBc.numero_bc?.match(/BC-\d{4}-(\d+)/);
        const parsedNum = match ? parseInt(match[1], 10) : 0;
        nextSeq = Math.max((latestBc.id || 0) + 1, (parsedNum || 0) + 1);
      }
    } catch (e) {
      console.warn("Could not determine max BC sequence, starting at 1:", e);
      nextSeq = 1;
    }

    const total_ht = items.reduce((sum: number, it: any) => sum + (Number(it.quantite) * Number(it.prix_achat_unitaire) || 0), 0);
    const total_ttc = total_ht; // Standard HT / TTC

    // Retry loop in case of unique constraint collision (e.g. duplicate key on bons_commande_numero_bc_key)
    let newBc: any = null;
    let headerErr: any = null;
    let attempts = 0;

    while (attempts < 15 && !newBc) {
      attempts++;
      const currentNumeroBc = `BC-${year}-${String(nextSeq).padStart(4, '0')}`;

      // Base header payload
      const baseHeaderPayload: Record<string, any> = {
        numero_bc: currentNumeroBc,
        date_commande: new Date().toISOString().split('T')[0],
        date_livraison_prevue: date_livraison_prevue || null,
        fournisseur_id: fournisseur_id || null,
        fournisseur_nom,
        statut: 'BROUILLON',
        total_ht,
        total_ttc,
        notes: notes || '',
        depot_id: depot_id || null,
        created_by: session.username || 'Admin',
      };

      // Try inserting with organization_id first
      if (session.organization_id) {
        const { data, error } = await supabase
          .from('bons_commande')
          .insert({
            ...baseHeaderPayload,
            organization_id: session.organization_id,
          })
          .select()
          .single();
        newBc = data;
        headerErr = error;
      }

      // If no org_id or insertion failed due to missing organization_id column, retry without it
      if (!newBc && (!session.organization_id || (headerErr && (headerErr.code === 'PGRST204' || headerErr.message?.includes('organization_id'))))) {
        const { data, error } = await supabase
          .from('bons_commande')
          .insert(baseHeaderPayload)
          .select()
          .single();
        newBc = data;
        headerErr = error;
      }

      // If duplicate key error on numero_bc, increment sequence and retry immediately
      if (!newBc && headerErr && (
        headerErr.code === '23505' ||
        headerErr.message?.includes('bons_commande_numero_bc_key') ||
        headerErr.message?.includes('unique constraint')
      )) {
        console.warn(`numero_bc collision on ${currentNumeroBc}, retrying with next sequence...`);
        nextSeq++;
        continue;
      }

      // If any other error, stop retry loop
      if (headerErr) {
        break;
      }
    }

    if (headerErr) {
      const isMissingTable =
        headerErr.message?.includes('relation "bons_commande" does not exist') ||
        headerErr.message?.includes('relation "public.bons_commande" does not exist') ||
        (headerErr.code === 'PGRST204' && headerErr.message?.includes("'bons_commande' table"));

      if (isMissingTable) {
        return NextResponse.json({
          error: "La table 'bons_commande' n'est pas encore initialisée dans Supabase. Veuillez exécuter le script SQL dans l'éditeur Supabase SQL Editor pour activer ce module.",
          migrationRequired: true
        }, { status: 400 });
      }
      throw headerErr;
    }

    // Insert Items
    const baseItemsToInsert = items.map((it: any) => ({
      bon_commande_id: newBc.id,
      article_id: it.article_id || null,
      reference: it.reference || null,
      designation: it.designation,
      quantite: Number(it.quantite) || 1,
      prix_achat_unitaire: Number(it.prix_achat_unitaire) || 0,
      total_ligne: (Number(it.quantite) || 1) * (Number(it.prix_achat_unitaire) || 0),
    }));

    // Try with organization_id if present
    let itemsErr: any = null;
    if (session.organization_id) {
      const orgItems = baseItemsToInsert.map((item) => ({
        ...item,
        organization_id: session.organization_id,
      }));
      const res = await supabase.from('bon_commande_items').insert(orgItems);
      itemsErr = res.error;
    }

    // If insertion failed due to missing organization_id column or not provided, retry without it
    if (!session.organization_id || (itemsErr && (itemsErr.code === 'PGRST204' || itemsErr.message?.includes('organization_id')))) {
      const res = await supabase.from('bon_commande_items').insert(baseItemsToInsert);
      itemsErr = res.error;
    }

    if (itemsErr) throw itemsErr;

    return NextResponse.json({ success: true, data: newBc }, { status: 201 });
  } catch (error: any) {
    console.error("Bons de commande POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
