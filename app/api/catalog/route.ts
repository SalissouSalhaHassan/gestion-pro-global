import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

function getAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = getAdminClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // 1. Fetch Company Info
    const { data: company } = await supabase
      .from('informations_entreprise')
      .select('nom_entreprise, telephone, adresse, email, logo_url')
      .maybeSingle();

    // 2. Fetch Articles with Stock
    let query = supabase
      .from('articles')
      .select('id, reference, designation, famille, p_vente_ttc, prix_gros, prix_special, image_path')
      .eq('is_deleted', false)
      .order('designation');

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
        .select('id, reference, designation, famille, p_vente_ttc, image_path')
        .eq('is_deleted', false)
        .order('designation');
      if (category && category !== 'ALL') fallbackQuery = fallbackQuery.eq('famille', category);
      if (search) fallbackQuery = fallbackQuery.or(`designation.ilike.%${search}%,reference.ilike.%${search}%`);
      articlesRes = await fallbackQuery;
    }

    const stocksRes = await supabase.from('stocks').select('article_id, quantite');

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
