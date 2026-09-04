import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  
  const { depot_nom, notes, items } = body;

  if (!depot_nom || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Données d'inventaire invalides" }, { status: 400 });
  }

  // Auth & Security check
  const user = await getServerSession();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = await isAdminOrManager(user);
  if (user.emplacement && !isAdmin && user.emplacement.toLowerCase() !== depot_nom.toLowerCase()) {
    return NextResponse.json({ error: `Non autorisé pour le dépôt: ${depot_nom}` }, { status: 403 });
  }

  try {
    // Calculate total values
    const valeurAvant = items.reduce((sum, item) => sum + (Number(item.quantite_avant) * Number(item.prix_achat || 0)), 0);
    const valeurApres = items.reduce((sum, item) => sum + (Number(item.quantite_apres) * Number(item.prix_achat || 0)), 0);
    const diffValeur = valeurApres - valeurAvant;

    const orgId = user.organization_id || '00000000-0000-0000-0000-000000000001';

    // 1. Create Inventaires session
    const { data: invSession, error: invError } = await supabase
      .from("inventaires")
      .insert({
        date_inventaire: new Date().toISOString(),
        notes: notes || `Géré par ${user.username}`,
        valeur_stock_avant: valeurAvant,
        valeur_stock_apres: valeurApres,
        difference_valeur: diffValeur,
        statut: 'Clôturé',
        depot_nom: depot_nom,
        organization_id: orgId
      })
      .select("id")
      .single();

    if (invError) throw invError;
    const invId = invSession.id;

    // 2. Prepare Items and 3. Adjust Stocks
    const invItemsToInsert = [];
    
    for (const entry of items) {
       const qtyDiff = Number(entry.quantite_apres) - Number(entry.quantite_avant);
       
       invItemsToInsert.push({
         inventaire_id: invId,
         article_id: entry.article_id,
         code_article: entry.reference,
         description: entry.designation,
         quantite_avant: Number(entry.quantite_avant),
         quantite_apres: String(entry.quantite_apres),
         difference_qte: qtyDiff,
         prix_achat: Number(entry.prix_achat) || 0,
         organization_id: orgId
       });

       // Skip stock adjustment if no difference
       if (qtyDiff !== 0) {
          // Check stock record
          let stockCheck = supabase
            .from("stocks")
            .select("quantite")
            .eq("article_id", entry.article_id)
            .eq("depot_nom", depot_nom);
          if (orgId) stockCheck = stockCheck.eq("organization_id", orgId);
          const { data: sEntry } = await stockCheck.maybeSingle();

          const stockApres = (sEntry ? Number(sEntry.quantite) : 0) + qtyDiff;

          // Update stock table
          if (sEntry) {
            let stockUpd = supabase
              .from("stocks")
              .update({ quantite: stockApres })
              .eq("article_id", entry.article_id)
              .eq("depot_nom", depot_nom);
            if (orgId) stockUpd = stockUpd.eq("organization_id", orgId);
            await stockUpd;
          } else {
            await supabase.from("stocks").insert({ article_id: entry.article_id, depot_nom, quantite: Math.max(0, stockApres), organization_id: orgId });
          }

          // Insert Movement Ledger entry
          const movType = qtyDiff > 0 ? "ajustement_entree" : "ajustement_sortie";
          await supabase.from("mouvements").insert({
            article_id: entry.article_id,
            type: movType,
            quantite: Math.abs(qtyDiff),
            entree: qtyDiff > 0 ? qtyDiff : 0,
            sortie: qtyDiff < 0 ? Math.abs(qtyDiff) : 0,
            stock_avant: sEntry ? Number(sEntry.quantite) : 0,
            stock_apres: stockApres,
            depot: depot_nom,
            date_mouvement: new Date().toISOString(),
            nr_doc: `INV-${invId.toString().padStart(6, '0')}`,
            fournisseur_client: "Jeu d'Inventaire Physique",
            user_id: user.id,
            utilisateur: user.username,
            created_by: user.id,
            organization_id: orgId
          });
       }
    }

    // Insert all inventory log items
    const { error: itemsError } = await supabase.from("inventaire_items").insert(invItemsToInsert);
    if (itemsError) throw itemsError;

    return NextResponse.json({ success: true, invSessionId: invId });

  } catch (err: any) {
    console.error("Inventory Submission Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
