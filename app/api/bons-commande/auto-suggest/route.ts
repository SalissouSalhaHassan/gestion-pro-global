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

    const [articlesRes, stocksRes] = await Promise.all([
      supabase.from('articles').select('id, reference, designation, p_achat_ht, p_vente_ttc').eq('is_deleted', false),
      supabase.from('stocks').select('article_id, quantite'),
    ]);

    const articles = articlesRes.data || [];
    const stocks = stocksRes.data || [];

    // Aggregate stock by article
    const stockMap: Record<number, number> = {};
    stocks.forEach((s) => {
      stockMap[s.article_id] = (stockMap[s.article_id] || 0) + (Number(s.quantite) || 0);
    });

    // Detect items needing reorder (Stock <= 5 units)
    const suggestions = articles
      .map((art) => {
        const currentStock = stockMap[art.id] || 0;
        return {
          article_id: art.id,
          reference: art.reference,
          designation: art.designation,
          current_stock: currentStock,
          prix_achat_unitaire: Number(art.p_achat_ht) || 0,
          // Reorder buffer: if stock is 0 -> suggest 25; if <= 5 -> suggest 20
          suggested_qty: currentStock <= 0 ? 25 : 20,
          status: currentStock <= 0 ? 'RUPTURE' : 'CRITIQUE',
        };
      })
      .filter((art) => art.current_stock <= 5)
      .sort((a, b) => a.current_stock - b.current_stock);

    return NextResponse.json({
      totalNeedingReorder: suggestions.length,
      suggestions,
    });
  } catch (error: any) {
    console.error("Auto-suggest reorder error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
