import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getServerSession();
    if (!user) {
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

    // VENDEUR: Filter to only show articles that have stock in their assigned depot
    if (!isAdmin && userDepot && userDepot !== "Tous") {
      articles = articles.filter((art: any) => {
        if (!Array.isArray(art.stocks) || art.stocks.length === 0) return false;
        return art.stocks.some((s: any) => 
          String(s.depot_nom || "").toLowerCase() === userDepot.toLowerCase() &&
          Number(s.quantite || 0) > 0
        );
      });
    }

    return NextResponse.json({ 
      items: articles, 
      role: isAdmin ? "admin" : "vendeur",
      depot: userDepot || "Tous"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    return NextResponse.json({ ok: true, article });
  } catch (error: any) {
    console.error("Article Creation Error:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de la création de l'article." }, { status: 500 });
  }
}

