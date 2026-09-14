import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager, getAllowedDepots } from "@/lib/auth_helper";

// Use the Edge runtime for high-performance reporting and scalability
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const articleId = searchParams.get("articleId");
    const depotId = searchParams.get("depotId");
    const depotName = searchParams.get("depot");
    const search = searchParams.get("search");
    const limit = Number(searchParams.get("limit") || 2000);
    const offset = Number(searchParams.get("offset") || 0);

    // 1. Auth check
    const user = await getServerSession();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const isAdmin = await isAdminOrManager(user);
    const userDepot = user.emplacement;
    const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";

    // 2. Build Query (Strictly filtered by organization_id)
    let query = supabase
      .from("mouvements")
      .select(`
        id, 
        nr_doc, 
        date_mouvement, 
        fournisseur_client, 
        stock_avant, 
        entree, 
        sortie, 
        stock_apres, 
        type, 
        depot,
        utilisateur, 
        user_id,
        article_id,
        articles ( reference, designation, p_achat_ht, p_vente_ttc )
      `)
      .eq("organization_id", orgId)
      .order("date_mouvement", { ascending: false })
      .range(offset, offset + limit - 1);

    const allowedDepots = getAllowedDepots(user);

    // Security: Sellers only see movements in their allowed depots.
    if (!isAdmin) {
      const depotsToFilter = allowedDepots.length > 0 ? allowedDepots : (userDepot ? [userDepot] : []);
      if (depotsToFilter.length > 0) {
        query = query.in("depot", depotsToFilter);
      }
    } 
    
    if (depotName && depotName !== "Tous") {
      if (!isAdmin) {
        const isAuthorized = allowedDepots.some(d => d.toLowerCase() === depotName.toLowerCase()) || 
                            (userDepot && userDepot.toLowerCase() === depotName.toLowerCase());
        if (!isAuthorized) {
          return NextResponse.json({ error: "Non autorisé pour ce dépôt" }, { status: 403 });
        }
      }
      query = query.eq("depot", depotName);
    } else if (depotId && depotId !== "Tous") {
      if (!isAdmin) {
        const isAuthorized = allowedDepots.some(d => d.toLowerCase() === String(depotId).toLowerCase()) || 
                            (userDepot && userDepot.toLowerCase() === String(depotId).toLowerCase());
        if (!isAuthorized) {
          return NextResponse.json({ error: "Non autorisé pour ce dépôt" }, { status: 403 });
        }
      }
      query = query.eq("depot", depotId);
    }

    // Date Filters
    if (startDate) query = query.gte("date_mouvement", `${startDate}T00:00:00`);
    if (endDate) query = query.lte("date_mouvement", `${endDate}T23:59:59`);

    // Article Filter
    if (articleId) query = query.eq("article_id", articleId);

    // Search
    if (search) {
      const { data: matchedArticles } = await supabase
        .from("articles")
        .select("id")
        .eq("organization_id", orgId)
        .or(`designation.ilike.%${search}%,reference.ilike.%${search}%`);
      
      const matchedIds = matchedArticles?.map((a: any) => a.id) || [];
      
      if (matchedIds.length > 0) {
        query = query.or(`nr_doc.ilike.%${search}%,fournisseur_client.ilike.%${search}%,article_id.in.(${matchedIds.join(",")})`);
      } else {
        query = query.or(`nr_doc.ilike.%${search}%,fournisseur_client.ilike.%${search}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error("Movements query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawList = (data || []) as any[];
    if (rawList.length === 0) {
      return NextResponse.json([]);
    }

    // Check if any movements are missing valid stock_avant / stock_apres
    const needsReconstruction = rawList.some(
      (m: any) =>
        m.stock_avant === null ||
        m.stock_apres === null ||
        (Number(m.stock_avant || 0) === 0 &&
          Number(m.stock_apres || 0) === 0 &&
          (Number(m.entree || 0) !== 0 || Number(m.sortie || 0) !== 0 || Number(m.quantite || 0) !== 0))
    );

    if (!needsReconstruction) {
      return NextResponse.json(rawList);
    }

    // Fetch physical current stock from stocks table for reconciliation
    const articleIds = Array.from(new Set(rawList.map((m: any) => m.article_id).filter(Boolean)));
    const sMap: Record<string, number> = {};

    if (articleIds.length > 0) {
      let stQuery = supabase
        .from("stocks")
        .select("article_id, depot_nom, quantite")
        .in("article_id", articleIds);
      if (orgId) {
        stQuery = stQuery.eq("organization_id", orgId);
      }
      const { data: stData } = await stQuery;
      if (stData) {
        stData.forEach((st: any) => {
          const key = `${st.article_id}-${(st.depot_nom || "default").trim().toLowerCase()}`;
          sMap[key] = Number(st.quantite || 0);
          sMap[`${st.article_id}`] = (sMap[`${st.article_id}`] || 0) + Number(st.quantite || 0);
        });
      }
    }

    // Group by article_id and depot
    const byArticleDepot: Record<string, any[]> = {};
    rawList.forEach((m: any) => {
      const artId = m.article_id || (m.articles as any)?.id || "1";
      const dep = (m.depot || "default").trim().toLowerCase();
      const key = `${artId}-${dep}`;
      if (!byArticleDepot[key]) byArticleDepot[key] = [];
      byArticleDepot[key].push(m);
    });

    const reconciled: any[] = [];

    Object.entries(byArticleDepot).forEach(([key, list]) => {
      // Sort chronologically ascending (Earliest first)
      list.sort((a, b) => {
        const dateA = new Date(a.date_mouvement).getTime();
        const dateB = new Date(b.date_mouvement).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return Number(a.id || 0) - Number(b.id || 0);
      });

      const artId = key.split("-")[0];
      const curStock = sMap[key] ?? sMap[artId] ?? 0;

      // Extract variations
      const variations = list.map((m) => {
        const inQty = Number(m.entree || 0);
        const outQty = Number(m.sortie || 0);
        let v = inQty > 0 ? inQty : (outQty > 0 ? -outQty : Number(m.quantite || 0));
        const tLower = (m.type || "").toLowerCase();
        if ((tLower.includes("vente") || tLower.includes("sortie")) && v > 0) {
          v = -v;
        } else if ((tLower.includes("achat") || tLower.includes("initiale") || tLower.includes("entree")) && v < 0) {
          v = Math.abs(v);
        }
        return v;
      });

      // Check if DB already has non-zero valid stock_avant & stock_apres
      const hasValidDbStock = list.every(
        (m) =>
          m.stock_apres !== null &&
          m.stock_avant !== null &&
          (Number(m.stock_apres) !== 0 || Number(m.stock_avant) !== 0)
      );

      if (hasValidDbStock) {
        list.forEach((m, idx) => {
          const v = variations[idx] !== 0 ? variations[idx] : Number(m.stock_apres) - Number(m.stock_avant);
          m.quantite = v;
          if (v > 0) {
            m.entree = v;
            m.sortie = 0;
          } else {
            m.entree = 0;
            m.sortie = Math.abs(v);
          }
          reconciled.push(m);
        });
      } else {
        // Calculate backward from current physical stock
        let runningStock = curStock;
        for (let i = list.length - 1; i >= 0; i--) {
          const m = list[i];
          const v = variations[i];
          const apres = runningStock;
          const avant = runningStock - v;
          runningStock = avant;

          m.stock_avant = avant;
          m.stock_apres = apres;
          m.quantite = v;
          if (v > 0) {
            m.entree = v;
            m.sortie = 0;
          } else {
            m.entree = 0;
            m.sortie = Math.abs(v);
          }
        }
        list.forEach((m) => reconciled.push(m));
      }
    });

    // Re-sort latest first for visual display
    reconciled.sort((a, b) => {
      const dateA = new Date(a.date_mouvement).getTime();
      const dateB = new Date(b.date_mouvement).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return Number(b.id || 0) - Number(a.id || 0);
    });

    return NextResponse.json(reconciled);
  } catch (err: any) {
    console.error("Edge Movements API Error:", err);
    return NextResponse.json({ error: "Erreur serveur Edge" }, { status: 500 });
  }
}
