import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { AdvanceService } from "@/lib/services/advance.service";

type CheckoutItem = {
  id: number | string;
  quantite: number;
  prix?: number;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getServerSession();

    if (!user) {
      return NextResponse.json(
        { error: "Authentification requise." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      invoiceId?: number | string;
      clientId?: number | string;
      depotName?: string;
      moyenReglement?: string;
      emplacement?: string;
      items?: CheckoutItem[];
    };

    const items = Array.isArray(body.items)
      ? body.items
          .map((item) => ({
            id: item.id,
            quantite: Number(item.quantite),
            prix: Number(item.prix || 0),
          }))
          .filter(
            (item) => !!item.id && item.quantite > 0
          )
      : [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Le ticket ne contient aucun article." },
        { status: 400 }
      );
    }

    const clientId = Number(body.clientId ?? 1) || 1;
    const depotName = body.depotName?.trim() || "Boutique";
    const moyenReglement = body.moyenReglement?.trim() || "Espece";

    // ─── INVENTORY GUARD: PRE-VALIDATION ───
    const isAdmin = await isAdminOrManager(user);
    const itemIds = items.map(it => it.id);
    
    // Fetch current stock for these items in the specific depot
    const { data: stockLevels, error: stockErr } = await supabase
      .from("stocks")
      .select("article_id, quantite")
      .eq("depot_nom", depotName)
      .in("article_id", itemIds);

    if (stockErr) console.error("Stock check error:", stockErr);

    const stockMap = (stockLevels || []).reduce((acc: any, curr: any) => {
      acc[curr.article_id] = Number(curr.quantite);
      return acc;
    }, {});

    const insufficientItems = [];
    for (const item of items) {
      const available = stockMap[item.id] || 0;
      if (item.quantite > available) {
        insufficientItems.push({
          id: item.id,
          requested: item.quantite,
          available: available
        });
      }
    }

    if (insufficientItems.length > 0 && !isAdmin) {
      // For normal users, block the sale
      return NextResponse.json({
        error: "Stock insuffisant",
        details: insufficientItems.map(it => `Article ID ${it.id}: Requis ${it.requested}, Disponible ${it.available}`).join(", ")
      }, { status: 400 });
    }
    // Note: Admins/Managers are allowed to proceed even with insufficient stock, per requirements.

    let result;
    let invoiceId: number | null = null;
    
    if (body.invoiceId) {
      // MODE: UPDATE EXISTING INVOICE
      const { data, error } = await supabase.rpc("update_invoice_from_pos_safe", {
        p_invoice_id: Number(body.invoiceId),
        p_client_id: clientId,
        p_vendeur: user.username ?? "Caisse",
        p_moyen_reglement: moyenReglement === "Avance" ? "Crédit" : moyenReglement,
        p_depot_nom: depotName,
        p_items: items,
        p_user_id_text: user.id,
      });
      if (error) throw error;
      invoiceId = Number(body.invoiceId);
    } else {
      // MODE: NEW SALE
      const { data, error } = await supabase.rpc("checkout_pos_sale", {
        p_client_id: clientId,
        p_vendeur: user.username ?? "Caisse",
        p_emplacement: body.emplacement ?? null,
        p_moyen_reglement: moyenReglement === "Avance" ? "Crédit" : moyenReglement,
        p_depot_nom: depotName,
        p_items: items,
        p_user_id: user.id,
      });
      if (error) throw error;
      result = data;
    }

    let extractedId: number | null = null;
    
    // Robustly extract the Invoice ID
    if (invoiceId) extractedId = invoiceId;
    else if (typeof result === "number") extractedId = result;
    else if (typeof result === "string") extractedId = Number(result);
    else if (Array.isArray(result) && result.length > 0) {
       extractedId = Number(result[0].id || result[0].invoice_id || result[0]);
    }
    else if (typeof result === "object" && result !== null) {
       extractedId = Number(result.id || result.invoice_id);
    }

    // DATA ISOLATION is handled by emplacement/depot filters

    // ─── POST-CHECKOUT SETTLEMENT LOGIC ───

    if (extractedId && !isNaN(extractedId)) {
      // 1. CREDIT HANDLING
      if (moyenReglement === "Crédit") {
        const { data: fact } = await supabase.from("factures").select("total_ttc").eq("id", extractedId).single();
        await supabase.from("factures").update({ 
           statut: "Non Payée",
           mode_paiement: "Crédit",
           montant_paye: 0,
           montant_restant: fact?.total_ttc || 0
        }).eq("id", extractedId);
      } 
      
      // 2. ADVANCE (AVANCE) HANDLING - FIFO Logic
      else if (moyenReglement === "Avance") {
        const { data: fact } = await supabase.from("factures").select("total_ttc").eq("id", extractedId).single();
        const totalToSettle = Number(fact?.total_ttc || 0);
        
        if (totalToSettle > 0) {
          const advanceService = new AdvanceService(supabase);
          const advances = await advanceService.getActiveAdvancesByClientId(clientId);
          
          let remainingToSettle = totalToSettle;
          
          for (const adv of advances) {
            if (remainingToSettle <= 0) break;
            
            const amountFromThisAdvance = Math.min(Number(adv.montant_restant), remainingToSettle);
            
            if (amountFromThisAdvance > 0) {
              // Deduct from advance
              await advanceService.withdrawAdvance(
                adv.id, 
                amountFromThisAdvance, 
                `Paiement Facture POS #${extractedId}`, 
                user.username || "Système"
              );
              
              // Record in paiements table
              await supabase.from("paiements").insert({
                facture_id: extractedId,
                date_operation: new Date().toISOString().split('T')[0],
                montant_regle: amountFromThisAdvance,
                moyen_reglement: "Avance",
                avance_client_id: adv.id,
                utilisateur: user.username || "Système",
                user_id: user.id,
                regle: true
              });
              
              remainingToSettle -= amountFromThisAdvance;
            }
          }
          
          // Mark invoice as fully or partially paid based on remainingToSettle
          const finalMountPaye = totalToSettle - remainingToSettle;
          await supabase.from("factures").update({
            statut: remainingToSettle === 0 ? "Payée" : "Partiellement Payée",
            mode_paiement: "Avance",
            montant_paye: finalMountPaye,
            montant_restant: remainingToSettle
          }).eq("id", extractedId);
        }
      }
    }


    return NextResponse.json({
      ok: true,
      sale: result,
      invoice_id: extractedId
    });
  } catch (error: any) {
    console.error("Checkout Error:", error);
    const message = error?.message || error?.details || "Erreur inattendue pendant l'encaissement.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
