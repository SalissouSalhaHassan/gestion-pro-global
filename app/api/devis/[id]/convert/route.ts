import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await params;
    const devisId = parseInt(rawId);
    if (isNaN(devisId)) {
      return NextResponse.json({ error: "ID de devis invalide" }, { status: 400 });
    }

    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // 1. Fetch Devis with items
    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select("*, devis_items(*)")
      .eq("id", devisId)
      .single();

    if (devisErr || !devis) {
      return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
    }

    if (devis.statut === "Converti") {
      return NextResponse.json(
        { error: "Ce devis a déjà été converti en facture.", invoiceId: devis.facture_id },
        { status: 400 }
      );
    }

    // 2. Generate new Invoice / BL Number
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    const blNumber = `FA-${year}-${rand}`;

    // 3. Insert into factures
    const { data: invoice, error: invErr } = await supabase
      .from("factures")
      .insert({
        client_id: devis.client_id,
        date_facture: new Date().toISOString().split("T")[0],
        bl_number: blNumber,
        total_ht: devis.total_ht,
        total_tva: devis.total_tva,
        total_ttc: devis.total_ttc,
        montant_paye: 0,
        montant_restant: devis.total_ttc,
        statut: "Non Payée",
        vendeur: session.username || devis.vendeur || "Vente",
        emplacement: "BOUTIQUE",
        is_deleted: false,
        notes: `Converti depuis le devis ${devis.numero_devis}. ${devis.notes || ""}`,
      })
      .select()
      .single();

    if (invErr) throw new Error(invErr.message);

    // 4. Insert into facture_items and deduct stock
    const items = devis.devis_items || [];
    if (items.length > 0) {
      const factureItems = items.map((it: any) => ({
        facture_id: invoice.id,
        article_id: it.article_id,
        description: it.description,
        qte: it.qte,
        pu_ht: it.pu_ht,
        remise_item_pourcentage: it.remise_pourcentage || 0,
        taux_tva_item: it.taux_tva || 0,
        total_item_ht: it.total_ligne_ht,
        total_item_ttc: it.total_ligne_ttc,
      }));

      const { error: fItemsErr } = await supabase.from("facture_items").insert(factureItems);
      if (fItemsErr) console.warn("Notice inserting facture items:", fItemsErr);

      // Deduct stock for items with article_id
      for (const it of items) {
        if (it.article_id) {
          try {
            // Find existing stock
            const { data: stockRow } = await supabase
              .from("stocks")
              .select("id, quantite")
              .eq("article_id", it.article_id)
              .maybeSingle();

            const currentQty = Number(stockRow?.quantite || 0);
            const newQty = currentQty - Number(it.qte);

            if (stockRow) {
              await supabase
                .from("stocks")
                .update({ quantite: newQty })
                .eq("id", stockRow.id);
            }

            // Register Stock Movement
            await supabase.from("mouvements").insert({
              article_id: it.article_id,
              date_mouvement: new Date().toISOString(),
              type: "vente",
              quantite_avant: currentQty,
              quantite_mvt: -Number(it.qte),
              quantite_apres: newQty,
              nr_doc: blNumber,
              motif: `Vente convertie depuis devis ${devis.numero_devis}`,
              utilisateur: session.username || "Système",
              emplacement: "BOUTIQUE",
            });
          } catch (stkErr) {
            console.warn("Notice updating stock during conversion:", stkErr);
          }
        }
      }
    }

    // 5. Update Devis status to 'Converti' and set facture_id
    await supabase
      .from("devis")
      .update({
        statut: "Converti",
        facture_id: invoice.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", devisId);

    return NextResponse.json({
      success: true,
      message: `Devis ${devis.numero_devis} converti avec succès en Facture ${blNumber}.`,
      invoiceId: invoice.id,
      blNumber: invoice.bl_number,
    });
  } catch (error: any) {
    console.error("Devis conversion error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
