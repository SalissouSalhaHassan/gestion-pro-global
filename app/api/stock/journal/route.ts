import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const revalidate = 0;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const dateStr = searchParams.get("date") || new Date().toISOString().split('T')[0];
  const depot = searchParams.get("depot");
  const search = searchParams.get("search");
  const categoryId = searchParams.get("categoryId");

  const user = await getServerSession();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // 1. Start building the articles query
  let articlesQuery = supabase
    .from("articles")
    .select("id, reference, designation, unite, categorie_id")
    .eq("is_deleted", false);

  if (search) {
    articlesQuery = articlesQuery.or(`reference.ilike.%${search}%,designation.ilike.%${search}%`);
  }
  if (categoryId) {
    articlesQuery = articlesQuery.eq("categorie_id", categoryId);
  }

  const { data: articles, error: artError } = await articlesQuery.order("designation");
  if (artError) return NextResponse.json({ error: artError.message }, { status: 500 });

  // 2. Define the time range for the selected day
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const results = await Promise.all(articles.map(async (art) => {
    // 3. Fetch all movements for this article on the selected date
    let mvtQuery = supabase
      .from("mouvements")
      .select("quantite, stock_avant, stock_apres, date_mouvement")
      .eq("article_id", art.id)
      .gte("date_mouvement", startOfDay)
      .lte("date_mouvement", endOfDay)
      .order("date_mouvement", { ascending: false });

    if (depot && depot !== "Tous") {
      mvtQuery = mvtQuery.eq("depot", depot);
    }

    const { data: mvts } = await mvtQuery;

    let variation = 0;
    let apres = 0;
    let avant = 0;

    if (mvts && mvts.length > 0) {
      // Variation is the sum of all quantite (which includes +/-)
      variation = mvts.reduce((sum, m) => sum + Number(m.quantite || 0), 0);
      
      // Après is the stock_apres of the LATEST movement of the day
      apres = Number(mvts[0].stock_apres || 0);
      
      // Avant is Après - Variation
      avant = apres - variation;
    } else {
      // No movements today. Find the last movement BEFORE today.
      let lastMvtQuery = supabase
        .from("mouvements")
        .select("stock_apres")
        .eq("article_id", art.id)
        .lt("date_mouvement", startOfDay)
        .order("date_mouvement", { ascending: false })
        .limit(1);

      if (depot && depot !== "Tous") {
        lastMvtQuery = lastMvtQuery.eq("depot", depot);
      }

      const { data: lastMvts } = await lastMvtQuery;

      if (lastMvts && lastMvts.length > 0) {
        avant = Number(lastMvts[0].stock_apres || 0);
        apres = avant;
        variation = 0;
      } else {
        // No movements ever before today. Check first movement ever.
        let firstMvtQuery = supabase
            .from("mouvements")
            .select("stock_avant")
            .eq("article_id", art.id)
            .order("date_mouvement", { ascending: true })
            .limit(1);
        
        if (depot && depot !== "Tous") {
            firstMvtQuery = firstMvtQuery.eq("depot", depot);
        }

        const { data: firstMvts } = await firstMvtQuery;
        
        if (firstMvts && firstMvts.length > 0) {
            avant = Number(firstMvts[0].stock_avant || 0);
            apres = avant;
        } else {
            // No movements at all. Check current stock if today, else 0.
            if (dateStr === new Date().toISOString().split('T')[0]) {
                const { data: currentStock } = await supabase
                    .from("stocks")
                    .select("quantite")
                    .eq("article_id", art.id)
                    .maybeSingle();
                
                avant = Number(currentStock?.quantite || 0);
                apres = avant;
            } else {
                avant = 0;
                apres = 0;
            }
        }
        variation = 0;
      }
    }

    return {
      id: art.id,
      reference: art.reference,
      designation: art.designation,
      unite: art.unite,
      avant,
      variation,
      apres
    };
  }));

  return NextResponse.json({
    date: dateStr,
    depot: depot || "Tous",
    items: results
  });
}
