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
    
    let query = supabase
      .from("articles")
      .select("*, stocks(quantite)")
      .eq("is_deleted", false);
    // Articles are global registry, no need to restrict by created_by.

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
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
    const targetDepot = (!depot_nom || depot_nom === "Tous") ? "Boutique" : depot_nom;
    
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

