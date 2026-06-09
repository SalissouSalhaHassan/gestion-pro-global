import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function GET() {
  try {
    console.log('GET /api/articles called');
    const supabase = await createClient();
    const user = await getServerSession();
    console.log('User session:', user ? user.username : 'NULL');
    
    if (!user) {
      console.log('Unauthorized access attempt to /api/articles');
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const isAdmin = await isAdminOrManager(user);
    const userDepot = user.emplacement;
    
    // Fetch all non-deleted articles with their stock records
    const { data, error } = await supabase
      .from("articles")
      .select("*, stocks(quantite, depot_nom)")
      .eq("is_deleted", false);

    if (error) throw error;

    let articles = data || [];
    console.log(`Total articles found in DB: ${articles.length}`);

    // Add total quantity sum to each article for mobile compatibility
    articles = articles.map((art: any) => {
      let relevantStocks = art.stocks || [];
      if (!isAdmin && userDepot && userDepot !== "Tous") {
        relevantStocks = relevantStocks.filter((s: any) => String(s.depot_nom || "").toLowerCase() === userDepot.toLowerCase());
      }
      const totalQty = relevantStocks.reduce((sum: number, s: any) => sum + (Number(s.quantite) || 0), 0);
      return { ...art, quantite: totalQty };
    });

    // VENDEUR: Filter to only show articles that have stock in their assigned depot
    if (!isAdmin && userDepot && userDepot !== "Tous") {
      console.log(`Filtering for depot: ${userDepot}`);
      articles = articles.filter((art: any) => art.quantite > 0);
      console.log(`Articles remaining after filtering: ${articles.length}`);
    }

    const response = NextResponse.json({ 
      items: articles, 
      role: isAdmin ? "admin" : "vendeur",
      depot: userDepot || "Tous"
    });

    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  } catch (error: any) {
    const errorResponse = NextResponse.json({ error: error.message }, { status: 500 });
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    return errorResponse;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { 
      reference, 
      designation, 
      code_barre, 
      p_achat_ht, 
      p_vente_ttc, 
      unite, 
      categorie_id,
      initial_stock, 
      depot_nom
    } = body;

    if (!reference || !designation) {
      const supabase = await createClient();
      const session = await getServerSession();
      console.log('DEBUG: Received GET /api/articles', { sessionFound: !!session, userId: session?.id });
      if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      return NextResponse.json({ error: "Référence et désignation sont requises" }, { status: 400 });
    }

    const user = await getServerSession();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // 2. Insert Article with created_by
    const { data: article, error: artError } = await supabase
      .from("articles")
      .insert({
        reference,
        designation,
        code_barre,
        p_achat_ht: Number(p_achat_ht) || 0,
        p_vente_ttc: Number(p_vente_ttc) || 0,
        unite: unite || "Unité",
        categorie_id: categorie_id || null,
        is_deleted: false
      })
      .select()
      .single();

    if (artError) {
      if (artError.code === "23505") {
        return NextResponse.json({ error: "Cette référence ou ce code barre existe déjà." }, { status: 409 });
      }
      throw artError;
    }

    // 3. Initialize Stock record
    let targetDepot = (!depot_nom || depot_nom === "Tous") ? user.emplacement : depot_nom;
    
    if (!targetDepot) {
       // Fallback to first available depot if user has no assignment
       const { data: d } = await supabase.from("depots").select("nom").eq("is_active", true).limit(1).maybeSingle();
       targetDepot = d?.nom;
       if (!targetDepot) {
         return NextResponse.json({ error: "Aucun dépôt actif trouvé. Veuillez en créer un dans Gestion des Dépôts." }, { status: 400 });
       }
    }
    
    if (Number(initial_stock) > 0) {
      const { error: stockError } = await supabase
        .from("stocks")
        .insert({
          article_id: article.id,
          depot_nom: targetDepot,
          quantite: Number(initial_stock) || 0
        });

      if (stockError) {
        console.error("Failed to initialize stock:", stockError);
      }
      
      await supabase.from("mouvements").insert({
        article_id: article.id,
        date_mouvement: new Date().toISOString(),
        type: "ENTRÉE INITIALE",
        quantite: Number(initial_stock),
        entree: Number(initial_stock),
        sortie: 0,
        stock_avant: 0,
        stock_apres: Number(initial_stock),
        depot: targetDepot,
        utilisateur: user.username,
        user_id: user.id,
        nr_doc: `INIT-${article.id}`,
        fournisseur_client: "Stock Initial"
      });
    }

    const response = NextResponse.json({ ok: true, article });
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error("Article Creation Error:", error);
    const errorResponse = NextResponse.json({ error: error.message || "Erreur lors de la création de l'article." }, { status: 500 });
    errorResponse.headers.set('Access-Control-Allow-Origin', '*');
    return errorResponse;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
