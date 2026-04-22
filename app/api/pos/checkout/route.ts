import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { AdvanceService } from "@/lib/services/advance.service";

type CheckoutItem = {
  id: number | string;
  quantite: number;
  prix?: number;
};

type PriceChangePayload = {
  articleId: number | string;
  designation?: string;
  oldPrice?: number;
  newPrice?: number;
  quantity?: number;
  changedAt?: string;
  changedBy?: string;
  reason?: string;
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
  depot_id?: number | string | null;
  depot_origine?: string | null;
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

function isMissingRpcSignature(error: { message?: string } | null | undefined, rpcName: string) {
  const message = String(error?.message || "");
  return (
    message.includes(`Could not find the function public.${rpcName}`) ||
    message.includes(`Could not find the function ${rpcName}`)
  );
}

async function reconcileInvoicePricing(params: {
  supabase: any;
  invoiceId: number;
  items: CheckoutItem[];
}) {
  const { supabase, invoiceId, items } = params;
  if (!invoiceId || !Array.isArray(items) || items.length === 0) return null;

  const { data: existingItems, error: existingItemsError } = await supabase
    .from("facture_items")
    .select("id, article_id, qte, pu_ht, pu_ttc, total_item_ht, total_item_ttc, taux_tva_item, montant_tva_item")
    .eq("facture_id", invoiceId)
    .order("id", { ascending: true });

  if (existingItemsError) throw existingItemsError;

  const articleIds = Array.from(
    new Set(
      items
        .map((item) => Number(item.id))
        .filter((value) => Number.isFinite(value))
    )
  );

  const { data: articleRows, error: articleRowsError } = await supabase
    .from("articles")
    .select("id, taxe, p_vente_ht, p_vente_ttc")
    .in("id", articleIds);

  if (articleRowsError) throw articleRowsError;

  const groupedItems = new Map<string, any[]>();
  for (const row of (existingItems || [])) {
    const key = String(row.article_id);
    const list = groupedItems.get(key) || [];
    list.push(row);
    groupedItems.set(key, list);
  }

  const articleMap = new Map<string, any>();
  for (const row of (articleRows || [])) {
    articleMap.set(String(row.id), row);
  }

  for (const item of items) {
    const list = groupedItems.get(String(item.id)) || [];
    const existingRow = list.shift();
    groupedItems.set(String(item.id), list);
    if (!existingRow) continue;

    const qte = Number(item.quantite || existingRow.qte || 0);
    const article = articleMap.get(String(item.id));
    const tauxTva = Number(article?.taxe ?? existingRow.taux_tva_item ?? 0);
    const requestedPrice = Number(item.prix);
    const puTtc = Number.isFinite(requestedPrice) && requestedPrice >= 0
      ? requestedPrice
      : Number(existingRow.pu_ttc ?? article?.p_vente_ttc ?? article?.p_vente_ht ?? 0);
    const puHt = 1 + tauxTva / 100 === 0 ? puTtc : puTtc / (1 + tauxTva / 100);
    const totalItemTtc = qte * puTtc;
    const totalItemHt = qte * puHt;
    const montantTva = totalItemTtc - totalItemHt;

    const { error: updateItemError } = await supabase
      .from("facture_items")
      .update({
        qte,
        pu_ht: puHt,
        pu_ttc: puTtc,
        total_item_ht: totalItemHt,
        total_item_ttc: totalItemTtc,
        taux_tva_item: tauxTva,
        montant_tva_item: montantTva,
      })
      .eq("id", existingRow.id);

    if (updateItemError) throw updateItemError;
  }

  const { data: finalItems, error: finalItemsError } = await supabase
    .from("facture_items")
    .select("total_item_ht, total_item_ttc")
    .eq("facture_id", invoiceId);

  if (finalItemsError) throw finalItemsError;

  const totals = (finalItems || []).reduce(
    (acc: { ht: number; ttc: number }, row: any) => {
      acc.ht += Number(row.total_item_ht || 0);
      acc.ttc += Number(row.total_item_ttc || 0);
      return acc;
    },
    { ht: 0, ttc: 0 }
  );

  const totalTva = totals.ttc - totals.ht;

  const { error: updateInvoiceError } = await supabase
    .from("factures")
    .update({
      total_ht: totals.ht,
      total_ttc: totals.ttc,
      total_tva: totalTva,
      nbr_art: items.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (updateInvoiceError) throw updateInvoiceError;

  return {
    totalHT: totals.ht,
    totalTTC: totals.ttc,
    totalTVA: totalTva,
  };
}

async function syncInvoicePaymentsAndStatus(params: {
  supabase: any;
  invoiceId: number;
  totalTTC: number;
  moyenReglement: string;
  isEditMode: boolean;
}) {
  const { supabase, invoiceId, totalTTC, moyenReglement, isEditMode } = params;
  const { data: payments, error: paymentsError } = await supabase
    .from("paiements")
    .select("id, montant_regle, moyen_reglement")
    .eq("facture_id", invoiceId)
    .order("id", { ascending: true });

  if (paymentsError) throw paymentsError;

  const paymentRows = Array.isArray(payments) ? payments : [];
  const isDebtMode = moyenReglement === "Crédit" || moyenReglement === "Avance";
  const nonCreditRows = paymentRows.filter(
    (payment) => !String(payment.moyen_reglement || "").toLowerCase().includes("redit")
  );

  if (!isDebtMode && nonCreditRows.length === 1 && !isEditMode) {
    const { error: paymentUpdateError } = await supabase
      .from("paiements")
      .update({ montant_regle: totalTTC })
      .eq("id", nonCreditRows[0].id);

    if (paymentUpdateError) throw paymentUpdateError;
    nonCreditRows[0].montant_regle = totalTTC;
  }

  const totalPaid = paymentRows.reduce((sum: number, payment: any) => {
    if (String(payment.moyen_reglement || "").toLowerCase().includes("redit")) {
      return sum;
    }
    return sum + Number(payment.montant_regle || 0);
  }, 0);

  const status =
    totalPaid >= totalTTC
      ? "Payée"
      : totalPaid > 0
        ? "Partiellement Payée"
        : "Non Payée";

  const { error: invoiceUpdateError } = await supabase
    .from("factures")
    .update({
      montant_paye: totalPaid,
      montant_restant: Math.max(0, totalTTC - totalPaid),
      statut: status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  if (invoiceUpdateError) throw invoiceUpdateError;

  return { totalPaid, status };
}

async function logPriceChangeAudit(params: {
  supabase: any;
  invoiceId: number;
  documentNumber: string;
  priceChanges: PriceChangePayload[];
  userId: string | number | null;
  username: string;
  depotId: number | null;
  depotName: string;
}) {
  const { supabase, invoiceId, documentNumber, priceChanges, userId, username, depotId, depotName } = params;
  if (!Array.isArray(priceChanges) || priceChanges.length === 0) return;

  for (const entry of priceChanges) {
    const articleId = Number(entry.articleId);
    if (!Number.isFinite(articleId)) continue;

    const changeDate = String(entry.changedAt || new Date().toISOString());
    const details = [
      entry.designation || `Article ${articleId}`,
      `Prix ${Number(entry.oldPrice || 0).toFixed(2)} -> ${Number(entry.newPrice || 0).toFixed(2)}`,
      `Qté ${Number(entry.quantity || 0)}`,
      entry.reason ? `Motif: ${entry.reason}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const basePayload = {
      article_id: articleId,
      nr_doc: documentNumber || `FACT-${invoiceId}`,
      date_mouvement: changeDate,
      fournisseur_client: details,
      entree: 0,
      sortie: 0,
      quantite: 0,
      pv: Number(entry.newPrice || 0),
      prix: Number(entry.oldPrice || 0),
      type: "MODIF_PRIX_POS",
      utilisateur: username || entry.changedBy || "Système",
      user_id: userId == null ? null : Number(userId),
    };

    let insertError: any = null;

    if (depotId != null) {
      const response = await supabase.from("mouvements").insert({
        ...basePayload,
        depot_id: depotId,
      });
      insertError = response.error;
    }

    if (insertError || depotId == null) {
      const fallback = await supabase.from("mouvements").insert({
        ...basePayload,
        depot: depotName,
      });
      if (fallback.error) {
        console.warn("Price change audit insert failed:", fallback.error);
      }
    }
  }
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
      priceChanges?: PriceChangePayload[];
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

    const priceChanges = Array.isArray(body.priceChanges) ? body.priceChanges : [];

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
    const normalizedPaymentMethod =
      moyenReglement === "Avance" || moyenReglement === "Crédit"
        ? "Crédit"
        : moyenReglement;
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

    const matchedDepot = Array.isArray(depotsRows)
      ? (depotsRows as DepotRow[]).find((d) => normalizeDepotName(String(d.nom || "")) === requestedDepotKey)
      : null;

    const canonicalDepotName = matchedDepot?.nom || depotName;
    const effectiveDepotId = matchedDepot?.id ? Number(matchedDepot.id) : null;
    const numericUserId = Number(user.id);
    const rpcUserId = Number.isFinite(numericUserId) ? numericUserId : null;
    const rpcUserIdText = user.id == null ? null : String(user.id);

    const requestedInvoiceId = body.invoiceId ? Number(body.invoiceId) : null;
    let originalInvoiceItems: EditInvoiceItemRow[] = [];

    if (requestedInvoiceId) {
      const { data: invoiceItems, error: invoiceItemsError } = await supabase
        .from("facture_items")
        .select("article_id, qte, depot_id") // Switched to depot_id
        .eq("facture_id", requestedInvoiceId);

      if (invoiceItemsError) {
        throw invoiceItemsError;
      }

      originalInvoiceItems = Array.isArray(invoiceItems) ? (invoiceItems as any[]) : [];
    }

    if (!matchedDepot) {
      // Create depot if missing? (Safe-guard)
      const { data: newDepot, error: insErr } = await supabase.from("depots").insert({ 
        nom: canonicalDepotName, 
        emplacement: "Point de vente", 
        is_active: true 
      }).select("id").single();
      
      if (!insErr && newDepot) {
        // We'll need this ID
      }
    }

    // ─── INVENTORY GUARD: PRE-VALIDATION ───
    const itemIds = items.map(it => it.id);
    
    // Fetch current stock for these items in the specific depot
    const { data: stockLevels, error: stockErr } = await supabase
      .from("stocks")
      .select("article_id, quantite, depot_id")
      .in("article_id", itemIds)
      .eq("depot_id", effectiveDepotId);

    if (stockErr) console.error("Stock check error:", stockErr);

    const stockMap = ((stockLevels as any[] | null | undefined) || []).reduce<Record<string, number>>((acc, curr) => {
      const key = String(curr.article_id);
      acc[key] = Number(acc[key] || 0) + Number(curr.quantite || 0);
      return acc;
    }, {});

    if (requestedInvoiceId && originalInvoiceItems.length > 0) {
      for (const originalItem of originalInvoiceItems) {
        if (Number(originalItem.depot_id) !== effectiveDepotId) {
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
      let { data, error } = await supabase.rpc("update_invoice_from_pos_safe", {
        p_invoice_id: Number(body.invoiceId),
        p_client_id: clientId,
        p_vendeur: user.username ?? "Caisse",
        p_emplacement: body.emplacement ?? null,
        p_moyen_reglement: normalizedPaymentMethod,
        p_depot_id: effectiveDepotId, // Switched to ID
        p_items: items,
        p_user_id_text: rpcUserIdText,
      });
      if (error && isMissingRpcSignature(error, "update_invoice_from_pos_safe")) {
        ({ data, error } = await supabase.rpc("update_invoice_from_pos_safe", {
          p_invoice_id: Number(body.invoiceId),
          p_client_id: clientId,
          p_vendeur: user.username ?? "Caisse",
          p_emplacement: body.emplacement ?? null,
          p_moyen_reglement: normalizedPaymentMethod,
          p_depot_nom: canonicalDepotName,
          p_items: items,
          p_user_id_text: rpcUserIdText,
        }));
      }
      if (error) throw error;
      result = data;
      invoiceId = Number(body.invoiceId);
    } else {
      // MODE: NEW SALE
      let { data, error } = await supabase.rpc("checkout_pos_sale", {
        p_client_id: clientId,
        p_vendeur: user.username ?? "Caisse",
        p_emplacement: body.emplacement ?? null,
        p_moyen_reglement: normalizedPaymentMethod,
        p_depot_id: effectiveDepotId, // Switched to ID
        p_items: items,
        p_user_id: rpcUserId,
      });
      if (error && isMissingRpcSignature(error, "checkout_pos_sale")) {
        ({ data, error } = await supabase.rpc("checkout_pos_sale", {
          p_client_id: clientId,
          p_vendeur: user.username ?? "Caisse",
          p_emplacement: body.emplacement ?? null,
          p_moyen_reglement: normalizedPaymentMethod,
          p_depot_nom: canonicalDepotName,
          p_items: items,
          p_user_id: rpcUserId,
        }));
      }
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

    let reconciledTotalTTC: number | null = null;

    if (extractedId && !isNaN(extractedId)) {
      const reconciliation = await reconcileInvoicePricing({
        supabase,
        invoiceId: extractedId,
        items,
      });
      reconciledTotalTTC = reconciliation?.totalTTC ?? null;
    }

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
      const { data: finalInvoiceRow } = await supabase
        .from("factures")
        .select("bl_number, total_ttc")
        .eq("id", extractedId)
        .single();

      const finalTotalTTC = Number(finalInvoiceRow?.total_ttc || reconciledTotalTTC || totalTTC || 0);

      await syncInvoicePaymentsAndStatus({
        supabase,
        invoiceId: extractedId,
        totalTTC: finalTotalTTC,
        moyenReglement,
        isEditMode: !!requestedInvoiceId,
      });

      await logPriceChangeAudit({
        supabase,
        invoiceId: extractedId,
        documentNumber: String(finalInvoiceRow?.bl_number || extractedId),
        priceChanges,
        userId: rpcUserIdText,
        username: user.username || "Système",
        depotId: effectiveDepotId,
        depotName: canonicalDepotName,
      });
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
