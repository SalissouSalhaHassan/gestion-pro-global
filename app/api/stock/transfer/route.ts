import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { action, transit_id, article_id, qty, source_depot, dest_depot, notes, reference } = body;

  const user = await getServerSession();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const isAdmin = await isAdminOrManager(user);
  const userDepot = user.emplacement;

  // ──────────────────────────────────────────────────────────────────
  // 1. RECEPTION (RECEIVING A TRANSFER)
  // ──────────────────────────────────────────────────────────────────
  if (action === "receive") {
     if (!transit_id) return NextResponse.json({ error: "ID de transit manquant" }, { status: 400 });

     try {
       // Fetch transit
       const { data: transit, error: errTransit } = await supabase.from("stock_transits").select("*").eq("id", transit_id).single();
       if (errTransit || !transit) throw new Error("Transit introuvable");

       if (transit.status !== "En Transit") {
          return NextResponse.json({ error: "Ce transfert a déjà été traité." }, { status: 400 });
       }

       // Auth Check: Must be Admin OR belong to Destination Depot
       if (userDepot && !isAdmin && userDepot.toLowerCase() !== transit.dest_depot.toLowerCase()) {
         return NextResponse.json({ error: `Action refusée: Vous n'êtes pas au dépôt ${transit.dest_depot}` }, { status: 403 });
       }

       const articlesDetails = transit.details as any[];
       
       for (const detail of articlesDetails) {
          const { article_id, qty } = detail;

          // Process Destination Stock IN
          const { data: destStock } = await supabase.from("stocks").select("quantite").eq("article_id", article_id).ilike("depot_nom", transit.dest_depot).maybeSingle();
          
          if (destStock) {
            await supabase.from("stocks").update({ quantite: Number(destStock.quantite) + qty }).eq("article_id", article_id).ilike("depot_nom", transit.dest_depot);
          } else {
            await supabase.from("stocks").insert({ article_id, depot_nom: transit.dest_depot, quantite: qty });
          }

          // Record Movement IN
          const destBefore = destStock ? Number(destStock.quantite) : 0;
          await supabase.from("mouvements").insert({
            article_id, type: 'transfert_entree', quantite: qty, entree: qty, sortie: 0,
            stock_avant: destBefore, stock_apres: destBefore + qty,
            depot: transit.dest_depot, date_mouvement: new Date().toISOString(), nr_doc: transit.reference, fournisseur_client: `De ${transit.source_depot}`,
            user_id: user.id, utilisateur: user.username
          });
       }

       // Update Transit Status
       await supabase.from("stock_transits").update({
          status: "Reçu",
          date_reception: new Date().toISOString(),
          received_by: user.username
       }).eq("id", transit_id);

       return NextResponse.json({ success: true, message: "Bons de réception validés avec succès." });

     } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
     }
  }

  // ──────────────────────────────────────────────────────────────────
  // 2. EXPEDITION (INITIATING A TRANSFER)
  // ──────────────────────────────────────────────────────────────────
  if (!article_id || !qty || qty <= 0 || !source_depot || !dest_depot) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  if (source_depot === dest_depot) {
    return NextResponse.json({ error: "Les dépôts doivent être différents" }, { status: 400 });
  }

  if (userDepot && !isAdmin && userDepot.toLowerCase() !== source_depot.toLowerCase()) {
    return NextResponse.json({ error: `Action refusée: Vous ne pouvez transférer que depuis le dépôt: ${userDepot}` }, { status: 403 });
  }

  try {
    const { data: sourceStock } = await supabase
      .from("stocks")
      .select("quantite")
      .eq("article_id", article_id)
      .ilike("depot_nom", source_depot)
      .maybeSingle();

    const currentSourceQty = sourceStock ? Number(sourceStock.quantite) : 0;
    if (currentSourceQty < qty) {
      return NextResponse.json({ error: `Stock insuffisant au dépôt source (Dispo: ${currentSourceQty})` }, { status: 400 });
    }

    // Deduct from Source
    const { error: errSource } = await supabase
      .from("stocks")
      .update({ quantite: currentSourceQty - qty })
      .eq("article_id", article_id)
      .ilike("depot_nom", source_depot);

    if (errSource) throw errSource;

    const refTrans = reference || `TRF-${new Date().getTime().toString().slice(-10)}`;
    const date = new Date().toISOString();

    // Record Movement OUT
    await supabase.from("mouvements").insert({
      article_id, type: 'transfert_sortie', quantite: -qty, entree: 0, sortie: qty,
      stock_avant: currentSourceQty, stock_apres: currentSourceQty - qty,
      depot: source_depot, date_mouvement: date, nr_doc: refTrans, fournisseur_client: `En transit vers ${dest_depot}`,
      user_id: user.id, utilisateur: user.username
    });

    // Create Transit Record
    const details = [{ article_id, qty, designation: "Article ID " + article_id }];
    
    await supabase.from("stock_transits").insert({
       reference: refTrans,
       source_depot,
       dest_depot,
       details,
       notes: notes || "Expédition standard",
       created_by: user.username
    });

    return NextResponse.json({ success: true, message: "Transfert initié. En attente de réception." });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
