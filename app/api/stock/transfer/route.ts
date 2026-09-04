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
  const orgId = user.organization_id || "00000000-0000-0000-0000-000000000001";
  const userDepot = user.emplacement;

  // ──────────────────────────────────────────────────────────────────
  // 1. RECEPTION (RECEIVING A TRANSFER)
  // ──────────────────────────────────────────────────────────────────
  if (action === "receive") {
     if (!transit_id) return NextResponse.json({ error: "ID de transit manquant" }, { status: 400 });

     try {
       // Fetch transit (Scoped by organization)
       const { data: transit, error: errTransit } = await supabase
         .from("stock_transits")
         .select("*")
         .eq("id", transit_id)
         .eq("organization_id", orgId)
         .single();
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

          // Process Destination Stock IN (Scoped by organization)
          const { data: destStock } = await supabase
            .from("stocks")
            .select("quantite")
            .eq("organization_id", orgId)
            .eq("article_id", article_id)
            .ilike("depot_nom", transit.dest_depot)
            .maybeSingle();
          
          if (destStock) {
            await supabase
              .from("stocks")
              .update({ quantite: Number(destStock.quantite) + qty })
              .eq("organization_id", orgId)
              .eq("article_id", article_id)
              .ilike("depot_nom", transit.dest_depot);
          } else {
            await supabase.from("stocks").insert({ article_id, depot_nom: transit.dest_depot, quantite: qty, organization_id: orgId });
          }

          // Record Movement IN (Stamped with organization_id)
          const destBefore = destStock ? Number(destStock.quantite) : 0;
          await supabase.from("mouvements").insert({
            article_id, type: 'transfert_entree', quantite: qty, entree: qty, sortie: 0,
            stock_avant: destBefore, stock_apres: destBefore + qty,
            depot: transit.dest_depot, date_mouvement: new Date().toISOString(), nr_doc: transit.reference, fournisseur_client: `De ${transit.source_depot}`,
            user_id: user.id, utilisateur: user.username,
            organization_id: orgId
          });
       }

       // Update Transit Status
       await supabase.from("stock_transits").update({
          status: "Reçu",
          date_reception: new Date().toISOString(),
          received_by: user.username
       }).eq("id", transit_id).eq("organization_id", orgId);

       return NextResponse.json({
         success: true,
         message: "Bons de réception validés avec succès.",
         reference: transit.reference
       });

     } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
     }
  }

  // ──────────────────────────────────────────────────────────────────
  // 1b. CANCELLATION (CANCELING A TRANSFER)
  // ──────────────────────────────────────────────────────────────────
  if (action === "cancel") {
    if (!transit_id) return NextResponse.json({ error: "ID de transit manquant" }, { status: 400 });

    try {
      const { data: transit, error: errTransit } = await supabase
        .from("stock_transits")
        .select("*")
        .eq("id", transit_id)
        .eq("organization_id", orgId)
        .single();
      if (errTransit || !transit) throw new Error("Transit introuvable");

      if (transit.status !== "En Transit") {
         return NextResponse.json({ error: "Seuls les transferts 'En Transit' peuvent être annulés." }, { status: 400 });
      }

      // Auth Check: Admin or Source Depot user
      if (userDepot && !isAdmin && userDepot.toLowerCase() !== transit.source_depot.toLowerCase()) {
        return NextResponse.json({ error: `Action refusée: Seul le dépôt source (${transit.source_depot}) peut annuler.` }, { status: 403 });
      }

      const articlesDetails = transit.details as any[];
      
      for (const detail of articlesDetails) {
         const { article_id, qty } = detail;

         // Return Stock to Source Depot (Scoped by organization)
         const { data: sourceStock } = await supabase
           .from("stocks")
           .select("quantite")
           .eq("organization_id", orgId)
           .eq("article_id", article_id)
           .ilike("depot_nom", transit.source_depot)
           .maybeSingle();
         
         const beforeQty = sourceStock ? Number(sourceStock.quantite) : 0;
         const afterQty = beforeQty + qty;

         await supabase
           .from("stocks")
           .update({ quantite: afterQty })
           .eq("organization_id", orgId)
           .eq("article_id", article_id)
           .ilike("depot_nom", transit.source_depot);

         // Record Cancellation Movement (Stamped with organization_id)
         await supabase.from("mouvements").insert({
           article_id, type: 'transfert_annule', quantite: qty, entree: qty, sortie: 0,
           stock_avant: beforeQty, stock_apres: afterQty,
           depot: transit.source_depot, date_mouvement: new Date().toISOString(), nr_doc: transit.reference, fournisseur_client: `Annulation transit vers ${transit.dest_depot}`,
           user_id: user.id, utilisateur: user.username,
           organization_id: orgId
         });
      }

      // Update Transit Status
      await supabase.from("stock_transits").update({
         status: "Annulé",
         notes: (transit.notes || "") + " (Annulé le " + new Date().toLocaleDateString() + ")"
      }).eq("id", transit_id).eq("organization_id", orgId);

      return NextResponse.json({ success: true, message: "Transfert annulé. Stock retourné au dépôt source." });

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
      .eq("organization_id", orgId)
      .eq("article_id", article_id)
      .ilike("depot_nom", source_depot)
      .maybeSingle();

    const currentSourceQty = sourceStock ? Number(sourceStock.quantite) : 0;
    if (currentSourceQty < qty) {
      return NextResponse.json({ error: `Stock insuffisant au dépôt source (Dispo: ${currentSourceQty})` }, { status: 400 });
    }

    // Deduct from Source (Scoped by organization)
    const { error: errSource } = await supabase
      .from("stocks")
      .update({ quantite: currentSourceQty - qty })
      .eq("organization_id", orgId)
      .eq("article_id", article_id)
      .ilike("depot_nom", source_depot);

    if (errSource) throw errSource;

    const refTrans = reference || `TRF-${new Date().getTime().toString().slice(-10)}`;
    const date = new Date().toISOString();

    // Record Movement OUT (Stamped with organization_id)
    await supabase.from("mouvements").insert({
      article_id, type: 'transfert_sortie', quantite: -qty, entree: 0, sortie: qty,
      stock_avant: currentSourceQty, stock_apres: currentSourceQty - qty,
      depot: source_depot, date_mouvement: date, nr_doc: refTrans, fournisseur_client: `En transit vers ${dest_depot}`,
      user_id: user.id, utilisateur: user.username,
      organization_id: orgId
    });

    // Create Transit Record (Stamped with organization_id)
    // Fetch article designation for transit record
    const { data: artRow } = await supabase
      .from("articles")
      .select("designation")
      .eq("id", article_id)
      .eq("organization_id", orgId)
      .single();
    const details = [{ article_id, qty, designation: artRow?.designation || "Article ID " + article_id }];
    
    await supabase.from("stock_transits").insert({
       reference: refTrans,
       source_depot,
       dest_depot,
       details,
       notes: notes || "Expédition standard",
       created_by: user.username,
       organization_id: orgId
    });

    return NextResponse.json({
      success: true,
      message: "Transfert initié. En attente de réception.",
      reference: refTrans
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
