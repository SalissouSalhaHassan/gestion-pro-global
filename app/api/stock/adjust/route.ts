import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { article_id, qty_adj, depot_nom, notes } = body;

  if (!article_id || qty_adj === undefined || !depot_nom) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  // 1. Auth check
  const user = await getServerSession();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = await isAdminOrManager(user);
  const userDepot = user.emplacement;

  // Security check: Employee can only adjust their own depot
  if (userDepot && !isAdmin && userDepot.toLowerCase() !== depot_nom.toLowerCase()) {
    return NextResponse.json({ error: `Vous n'avez pas accès au dépôt: ${depot_nom}` }, { status: 403 });
  }

  // Security: Sellers can only adjust their own depot (already enforced above)

  try {
    const { data: stockEntry, error: sError } = await supabase
      .from("stocks")
      .select("quantite")
      .eq("article_id", article_id)
      .eq("depot_nom", depot_nom)
      .maybeSingle();

    if (sError) throw sError;

    const stockAvant = stockEntry ? Number(stockEntry.quantite) : 0;
    const stockApres = stockAvant + Number(qty_adj);

    if (stockApres < 0 && Number(qty_adj) < 0) {
      return NextResponse.json({ error: `Opération refusée : le stock deviendrait négatif (${stockApres.toFixed(2)})` }, { status: 400 });
    }

    // 3. Update Stocks
    let stockUpdateError;
    if (stockEntry) {
      const { error } = await supabase
        .from("stocks")
        .update({ quantite: stockApres })
        .eq("article_id", article_id)
        .eq("depot_nom", depot_nom);
      stockUpdateError = error;
    } else {
      const { error } = await supabase
        .from("stocks")
        .insert({ article_id, depot_nom, quantite: stockApres });
      stockUpdateError = error;
    }

    if (stockUpdateError) throw stockUpdateError;

    // 4. Record Movement
    const movType = Number(qty_adj) > 0 ? "ajustement_entree" : "ajustement_sortie";
    const ref = `ADJ-${new Date().getTime().toString().slice(-10)}`;
    
    const { error: mError } = await supabase
      .from("mouvements")
      .insert({
        article_id,
        type: movType,
        quantite: Number(qty_adj),
        entree: Number(qty_adj) > 0 ? Number(qty_adj) : 0,
        sortie: Number(qty_adj) < 0 ? Math.abs(Number(qty_adj)) : 0,
        stock_avant: stockAvant,
        stock_apres: stockApres,
        depot: depot_nom,
        date_mouvement: new Date().toISOString(),
        nr_doc: ref,
        fournisseur_client: "Ajustement Manuel Web",
        user_id: user.id,
        utilisateur: user.username
      });

    if (mError) throw mError;

    return NextResponse.json({ success: true, newStock: stockApres });

  } catch (err: any) {
    console.error("Adjustment Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

