import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { AdvanceService } from "@/lib/services/advance.service";

type CheckoutItem = {
  id: number | string;
  quantite: number;
  prix?: number;
};

type DepotRow = {
  id: number | string;
  nom: string | null;
  emplacement?: string | null;
};

type StockRow = {
  article_id: number | string;
  quantite: number | string | null;
  depot_nom: string | null;
};

type EditInvoiceItemRow = {
  article_id: number | string;
  qte: number | string | null;
  depot_origine: string | null;
};

function normalizeDepotName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function splitDepotList(...values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => String(value ?? "").split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function uniqueNames(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function findBestDepotMatch(target: string, candidates: string[]) {
  const normalizedTarget = normalizeDepotName(target);
  const uniqueCandidates = uniqueNames(candidates).map((candidate) => ({
    raw: candidate,
    key: normalizeDepotName(candidate),
  }));

  if (!normalizedTarget || uniqueCandidates.length === 0) return null;

  const exact = uniqueCandidates.find((candidate) => candidate.key === normalizedTarget);
  if (exact) return exact.raw;

  const targetTokens = normalizedTarget
    .split(" ")
    .filter((token) => token.length > 2 && token !== "depot");

  let bestMatch: { raw: string; score: number } | null = null;

  for (const candidate of uniqueCandidates) {
    let score = 0;

    if (candidate.key.includes(normalizedTarget) || normalizedTarget.includes(candidate.key)) {
      score += 10;
    }

    for (const token of targetTokens) {
      if (candidate.key.includes(token)) {
        score += 3;
      }
    }

    if (normalizedTarget.includes("boutique") && candidate.key.includes("boutique")) score += 6;
    if (normalizedTarget.includes("principal") && candidate.key.includes("principal")) score += 6;
    if (normalizedTarget.includes("magasin") && candidate.key.includes("magasin")) score += 6;

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { raw: candidate.raw, score };
    }
  }

  if (bestMatch && bestMatch.score > 0) {
    return bestMatch.raw;
  }

  return uniqueCandidates.length === 1 ? uniqueCandidates[0].raw : null;
}

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
      versement?: number; // Add versement (cash part)
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
    const depotName = body.depotName?.trim() || user.emplacement || "";
    
    if (!depotName) {
      return NextResponse.json({ error: "Aucun dépôt spécifié pour cette vente. Veuillez sélectionner un dépôt valide." }, { status: 400 });
    }

    const moyenReglement = body.moyenReglement?.trim() || "Espece";
    const cashVersement = Number(body.versement || 0);
    const requestedDepotKey = normalizeDepotName(depotName);

    // ─── SECURITY: WAREHOUSE SCOPING ───
    const isAdmin = await isAdminOrManager(user);
    const requestedScopeDepots = uniqueNames(splitDepotList(user.depots, user.emplacement));
    if (
      !isAdmin &&
      requestedScopeDepots.length > 0 &&
      !requestedScopeDepots.some(
        (name) =>
          normalizeDepotName(name) === requestedDepotKey ||
          !!findBestDepotMatch(name, [depotName]) ||
          !!findBestDepotMatch(depotName, [name])
      )
    ) {
       return NextResponse.json({ error: `Permission refusée pour le dépôt: ${depotName}` }, { status: 403 });
    }

    // ─── SYSTEM SETTINGS: STOCK POLICY ───
    const { data: settings } = await supabase.from("app_settings").select("allow_negative_stock").maybeSingle();
    const allowNegative = settings?.allow_negative_stock ?? false;

    // ─── SELF-HEALING: ENSURE DEFAULT CLIENT AND DEPOT EXIST ───
    if (clientId === 1) {
      const { data: c1 } = await supabase.from("clients").select("id").eq("id", 1).single();
      if (!c1) {
        await supabase.from("clients").insert({
          id: 1, 
          nom: "CLIENT COMPTANT", 
          ref_client: "COMPTANT", 
          is_deleted: false 
        });
      }
    }
    
    const { data: depotsRows } = await supabase
      .from("depots")
      .select("id, nom, emplacement")
      .eq("is_active", true);

    const canonicalDepotName =
      (Array.isArray(depotsRows)
        ? (depotsRows as DepotRow[]).find((d) => normalizeDepotName(String(d.nom || "")) === requestedDepotKey)?.nom
        : null) || depotName;

    const requestedInvoiceId = body.invoiceId ? Number(body.invoiceId) : null;
    let originalInvoiceItems: EditInvoiceItemRow[] = [];

    if (requestedInvoiceId) {
      const { data: invoiceItems, error: invoiceItemsError } = await supabase
        .from("facture_items")
        .select("article_id, qte, depot_origine")
        .eq("facture_id", requestedInvoiceId);

      if (invoiceItemsError) {
        throw invoiceItemsError;
      }

      originalInvoiceItems = Array.isArray(invoiceItems) ? (invoiceItems as EditInvoiceItemRow[]) : [];
    }

    if (!depotsRows || depotsRows.length === 0) {
      await supabase.from("depots").insert({ 
        nom: canonicalDepotName, 
        emplacement: "Point de vente", 
        is_active: true 
      });
    }

    // ─── INVENTORY GUARD: PRE-VALIDATION ───
    const itemIds = items.map(it => it.id);
    
    // Fetch current stock for these items and match the depot after normalization.
    const { data: stockLevels, error: stockErr } = await supabase
      .from("stocks")
      .select("article_id, quantite, depot_nom")
      .in("article_id", itemIds);

    if (stockErr) console.error("Stock check error:", stockErr);

    const stockDepotNames = uniqueNames(
      ((stockLevels as StockRow[] | null | undefined) || []).map((stock) => stock.depot_nom)
    );
    const invoiceDepotNames = uniqueNames(
      originalInvoiceItems.map((item) => item.depot_origine)
    );

    if (invoiceDepotNames.length > 1) {
      return NextResponse.json(
        { error: "Cette facture utilise plusieurs dépôts. La modification POS ne supporte qu'un seul dépôt." },
        { status: 400 }
      );
    }

    const resolvedDepotName =
      findBestDepotMatch(canonicalDepotName, stockDepotNames) ||
      findBestDepotMatch(depotName, stockDepotNames) ||
      canonicalDepotName;
    const effectiveDepotName =
      invoiceDepotNames.length === 1
        ? (
            findBestDepotMatch(invoiceDepotNames[0], [
              resolvedDepotName,
              canonicalDepotName,
              depotName,
              ...stockDepotNames,
            ]) || invoiceDepotNames[0]
          )
        : resolvedDepotName;
    const effectiveDepotKey = normalizeDepotName(effectiveDepotName);

    const allowedDepotNames = uniqueNames(splitDepotList(user.depots, user.emplacement));
    if (
      !isAdmin &&
      allowedDepotNames.length > 0 &&
      !allowedDepotNames.some(
        (name) =>
          normalizeDepotName(name) === effectiveDepotKey ||
          !!findBestDepotMatch(name, [effectiveDepotName]) ||
          !!findBestDepotMatch(effectiveDepotName, [name])
      )
    ) {
      return NextResponse.json({ error: `Permission refusée pour le dépôt: ${effectiveDepotName}` }, { status: 403 });
    }

    const stockMap = (stockLevels as StockRow[] | null | undefined || []).reduce<Record<string, number>>((acc, curr) => {
      if (normalizeDepotName(String(curr.depot_nom || "")) !== effectiveDepotKey) return acc;
      const key = String(curr.article_id);
      acc[key] = Number(acc[key] || 0) + Number(curr.quantite || 0);
      return acc;
    }, {});

    if (requestedInvoiceId && originalInvoiceItems.length > 0) {
      for (const originalItem of originalInvoiceItems) {
        if (normalizeDepotName(String(originalItem.depot_origine || "")) !== effectiveDepotKey) {
          continue;
        }

        const key = String(originalItem.article_id);
        stockMap[key] = Number(stockMap[key] || 0) + Number(originalItem.qte || 0);
      }
    }

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

    // Block if stock policy doesn't allow negative balances and insufficient items exist
    if (insufficientItems.length > 0 && !allowNegative && !isAdmin) {
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
        p_emplacement: body.emplacement ?? null,
        p_moyen_reglement: moyenReglement === "Avance" ? "Crédit" : moyenReglement,
        p_depot_nom: effectiveDepotName,
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
        p_moyen_reglement: (moyenReglement === "Avance" || moyenReglement === "Crédit") ? "Crédit" : moyenReglement,
        p_depot_nom: effectiveDepotName,
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

    // FALLBACK: If still no ID, fetch the latest invoice for this client and depot
    if (!extractedId || isNaN(extractedId)) {
      console.warn("⚠️ Could not extract invoice ID from RPC result. Attempting fallback...", result);
      const { data: invoices, error: fallbackErr } = await supabase
        .from("factures")
        .select("id")
        .eq("client_id", clientId)
        .order("id", { ascending: false })
        .limit(1);
      
      if (fallbackErr) {
        console.warn("⚠️ Fallback query failed:", fallbackErr);
      } else if (invoices && invoices.length > 0) {
        console.log("✅ Fallback: Using latest invoice ID:", invoices[0].id);
        extractedId = Number(invoices[0].id);
      } else {
        console.error("❌ CRITICAL: Fallback query returned no data");
      }
    }

    // ─── POST-CHECKOUT SETTLEMENT LOGIC ───

    if (extractedId && !isNaN(extractedId)) {
      const isDebtMode = moyenReglement === "Crédit" || moyenReglement === "Avance";
      const { data: fact } = await supabase.from("factures").select("total_ttc").eq("id", extractedId).single();
      const totalTTC = Number(fact?.total_ttc || 0);

      // 1. CREDIT/AVANCE INITIALIZATION (Ensure the auto-generated credit record is zeroed)
      if (isDebtMode) {
        // Prevent double counting: Set auto-generated 'Crédit' payment to 0
        await supabase.from("paiements")
          .update({ montant_regle: 0 })
          .eq("facture_id", extractedId)
          .ilike("moyen_reglement", "crédit");
      }

      // 2. CASH PARTIAL PAYMENT (If any versement provided in debt modes)
      if (isDebtMode && cashVersement > 0) {
        await supabase.from("paiements").insert({
          facture_id: extractedId,
          date_operation: new Date().toISOString().split('T')[0],
          montant_regle: cashVersement,
          moyen_reglement: "Espèce",
          utilisateur: user.username || "Système",
          user_id: user.id,
          regle: true
        });
      }
      
      // 3. ADVANCE (AVANCE) SPECIFIC SETTLEMENT
      if (moyenReglement === "Avance") {
        let remainingToSettle = totalTTC - cashVersement;
        
        if (remainingToSettle > 0) {
          const advanceService = new AdvanceService(supabase);
          const advances = await advanceService.getActiveAdvancesByClientId(clientId);
          
          for (const adv of advances) {
            if (remainingToSettle <= 0) break;
            
            const amountFromThisAdvance = Math.min(Number(adv.montant_restant), remainingToSettle);
            
            if (amountFromThisAdvance > 0) {
              await advanceService.withdrawAdvance(
                adv.id, 
                amountFromThisAdvance, 
                `Paiement Facture POS #${extractedId}`, 
                user.username || "Système"
              );
              
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
        }

        // Finalize invoice totals after Cash + Advance
        const totalPaid = totalTTC - (remainingToSettle > 0 ? remainingToSettle : 0);
        await supabase.from("factures").update({
          statut: totalPaid >= totalTTC ? "Payée" : (totalPaid > 0 ? "Partiellement Payée" : "Non Payée"),
          montant_paye: totalPaid,
          montant_restant: Math.max(0, totalTTC - totalPaid)
        }).eq("id", extractedId);
      } else if (moyenReglement === "Crédit") {
        // Just Update with Cash part if any
        await supabase.from("factures").update({
          statut: cashVersement >= totalTTC ? "Payée" : (cashVersement > 0 ? "Partiellement Payée" : "Non Payée"),
          montant_paye: cashVersement,
          montant_restant: Math.max(0, totalTTC - cashVersement)
        }).eq("id", extractedId);
      }
    }

    return NextResponse.json({
      ok: true,
      sale: result || { id: extractedId },
      invoice_id: extractedId,
      debug: {
        extractedId,
        result,
        invoiceId
      }
    });
  } catch (error: any) {
    console.error("Checkout Error:", error);
    const message = error?.message || error?.details || "Erreur inattendue pendant l'encaissement.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
