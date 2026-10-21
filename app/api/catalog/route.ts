import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getServerSession } from '@/lib/auth_helper';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    
    // Check if user is logged in to match their current active organization
    let sessionOrgId: string | null = null;
    try {
      const session = await getServerSession();
      if (session?.organization_id) {
        sessionOrgId = session.organization_id;
      }
    } catch (_) {}

    // Priority: Explicit URL param ?org=... -> Session Org -> Default
    const orgId = searchParams.get('org') || searchParams.get('organization_id') || sessionOrgId || '00000000-0000-0000-0000-000000000001';

    // 1. Fetch Company Info (Scoped to Tenant)
    let compQuery = supabase
      .from('informations_entreprise')
      .select('nom_entreprise, telephone, adresse, email, logo_url, capital_social');
    if (orgId) compQuery = compQuery.eq('organization_id', orgId);
    const { data: rawCompany } = await compQuery.maybeSingle();

    let whatsappNumber = rawCompany?.telephone || "";
    if (rawCompany?.capital_social && rawCompany.capital_social.startsWith("{")) {
      try {
        const meta = JSON.parse(rawCompany.capital_social);
        if (meta.telephone_whatsapp && typeof meta.telephone_whatsapp === "string" && meta.telephone_whatsapp.trim()) {
          whatsappNumber = meta.telephone_whatsapp.trim();
        }
      } catch (_) {}
    }

    const company = rawCompany ? {
      nom_entreprise: rawCompany.nom_entreprise,
      telephone: whatsappNumber,
      telephone_appel: rawCompany.telephone,
      adresse: rawCompany.adresse,
      email: rawCompany.email,
      logo_url: rawCompany.logo_url,
    } : null;

    // 2. Fetch Articles with Stock (Scoped to Tenant)
    let query = supabase
      .from('articles')
      .select('id, reference, designation, famille, p_vente_ttc, prix_gros, prix_special, image_path, code_barre, article_par_colis')
      .eq('is_deleted', false)
      .order('designation');

    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    if (category && category !== 'ALL') {
      query = query.eq('famille', category);
    }
    if (search) {
      query = query.or(`designation.ilike.%${search}%,reference.ilike.%${search}%`);
    }

    let articlesRes: any = await query;
    if (articlesRes.error && (articlesRes.error.message?.includes("prix_gros") || articlesRes.error.code === "PGRST204")) {
      let fallbackQuery = supabase
        .from('articles')
        .select('id, reference, designation, famille, p_vente_ttc, image_path, code_barre, article_par_colis')
        .eq('is_deleted', false)
        .order('designation');
      if (orgId) fallbackQuery = fallbackQuery.eq('organization_id', orgId);
      if (category && category !== 'ALL') fallbackQuery = fallbackQuery.eq('famille', category);
      if (search) fallbackQuery = fallbackQuery.or(`designation.ilike.%${search}%,reference.ilike.%${search}%`);
      articlesRes = await fallbackQuery;
    }

    let stockQ = supabase.from('stocks').select('article_id, quantite');
    if (orgId) stockQ = stockQ.eq('organization_id', orgId);
    const stocksRes = await stockQ;

    if (articlesRes.error) throw articlesRes.error;

    const stocks = stocksRes.data || [];
    const stockMap: Record<number, number> = {};
    stocks.forEach((s: any) => {
      stockMap[s.article_id] = (stockMap[s.article_id] || 0) + (Number(s.quantite) || 0);
    });

    const products = (articlesRes.data || []).map((art: any) => {
      const stock = stockMap[art.id] || 0;
      return {
        ...art,
        stock_total: stock,
        is_in_stock: stock > 0,
      };
    });

    // Unique categories
    const categories = Array.from(
      new Set(products.map((p: any) => p.famille).filter(Boolean))
    );

    return NextResponse.json({
      company: company || {
        nom_entreprise: "Gestion Pro Global",
        telephone: "+227 00 00 00 00",
        adresse: "Niamey, Niger",
      },
      categories,
      products,
    });
  } catch (error: any) {
    console.error("Public catalog API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
