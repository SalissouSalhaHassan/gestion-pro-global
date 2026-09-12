import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";
import { AdvanceService } from "@/lib/services/advance.service";
import { isGreaterOrEqual, round } from "@/lib/utils/finance";
import { awardLoyaltyPoints } from "@/lib/services/loyalty.service";

type CheckoutItem = {
  id: number | string;
  quantite: number;
  prix?: number;
  depot_origine?: string | null;
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
        acc.ht = round(acc.ht + Number(row.total_item_ht || 0));
        acc.ttc = round(acc.ttc + Number(row.total_item_ttc || 0));
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
    isGreaterOrEqual(totalPaid, totalTTC)
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
      organization_id: (params as any).organizationId || "00000000-0000-0000-0000-000000000001",
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
            depot_origine: item.depot_origine ? String(item.depot_origine).trim() : null,
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
    let requestedScopeDepots = uniqueNames(splitDepotList(user.depots, user.emplacement));
    
    // SPECIFIC RULE: KADER cannot use 'BOUTIQUE' in POS
    if (String(user.username || "").toLowerCase() === "kader") {
      requestedScopeDepots = requestedScopeDepots.filter(d => d.toLowerCase() !== "boutique");
    }

    if (!isAdmin) {
      if (
        requestedScopeDepots.length === 0 ||
        !requestedScopeDepots.some(
          (name) =>
            normalizeDepotName(name) === requestedDepotKey ||
            !!findBestDepotMatch(name, [depotName]) ||
            !!findBestDepotMatch(depotName, [name])
        )
      ) {
        return NextResponse.json({ error: `Permission refusée pour le dépôt: ${depotName}` }, { status: 403 });
      }
    }

    // ─── PARALLEL PRE-FLIGHT (Parallel Execution: App Settings, Depots, Stocks, Articles, Client) ───
    const itemIds = items.map((it) => Number(it.id));
    const requestedInvoiceId = body.invoiceId ? Number(body.invoiceId) : null;

    let depotsQuery = supabase
      .from("depots")
      .select("id, nom, emplacement")
      .eq("is_active", true);
    if (user.organization_id) depotsQuery = depotsQuery.eq("organization_id", user.organization_id);

    let stockLevelsQuery = supabase
      .from("stocks")
      .select("id, article_id, quantite, depot_nom")
      .in("article_id", itemIds);
    if (user.organization_id) stockLevelsQuery = stockLevelsQuery.eq("organization_id", user.organization_id);

    let articlesQuery = supabase
      .from("articles")
      .select("id, designation, nom, reference, code_barre, taxe, p_vente_ht, p_vente_ttc")
      .in("id", itemIds);

    let clientQuery = clientId > 1
      ? (user.organization_id
          ? supabase.from("clients").select("id, nom, tel, gsm, adresse, email").eq("id", clientId).eq("organization_id", user.organization_id).maybeSingle()
          : supabase.from("clients").select("id, nom, tel, gsm, adresse, email").eq("id", clientId).maybeSingle())
      : Promise.resolve({ data: { id: 1, nom: "CLIENT COMPTANT", tel: "", gsm: "", adresse: "", email: "" } });

    let invItemsQuery = requestedInvoiceId
      ? (user.organization_id
          ? supabase.from("facture_items").select("article_id, qte, depot_origine").eq("facture_id", requestedInvoiceId).eq("organization_id", user.organization_id)
          : supabase.from("facture_items").select("article_id, qte, depot_origine").eq("facture_id", requestedInvoiceId))
      : Promise.resolve({ data: [] });

    // Execute ALL pre-flight reads concurrently in ONE network roundtrip!
    const [settingsRes, depotsRes, stockLevelsRes, articlesRes, clientRes, invItemsRes] = await Promise.all([
      supabase.from("app_settings").select("allow_negative_stock").maybeSingle(),
      depotsQuery,
      stockLevelsQuery,
      articlesQuery,
      clientQuery,
      invItemsQuery,
    ]);

    const allowNegative = settingsRes?.data?.allow_negative_stock ?? false;
    const depotsRows = (depotsRes?.data as DepotRow[]) || [];
    const matchedDepot = depotsRows.find((d) => normalizeDepotName(String(d.nom || "")) === requestedDepotKey) || null;
    const canonicalDepotName = matchedDepot?.nom || depotName;
    const effectiveDepotId = matchedDepot?.id ? Number(matchedDepot.id) : null;
    const clientData = clientRes?.data || { id: clientId, nom: "CLIENT COMPTANT", tel: "", gsm: "", adresse: "", email: "" };
    const stockLevels = stockLevelsRes?.data || [];
    const artRows = articlesRes?.data || [];
    const originalInvoiceItems = (invItemsRes?.data as EditInvoiceItemRow[]) || [];

    const numericUserId = Number(user.id);
    const rpcUserId = Number.isFinite(numericUserId) ? numericUserId : null;
    const rpcUserIdText = user.id == null ? null : String(user.id);

    // ─── INVENTORY GUARD: PRE-VALIDATION ───
    const stockMapByDepot: Record<string, number> = {};
    ((stockLevels as any[] | null | undefined) || []).forEach((curr) => {
      const key = `${curr.article_id}_${normalizeDepotName(curr.depot_nom || "")}`;
      stockMapByDepot[key] = (stockMapByDepot[key] || 0) + Number(curr.quantite || 0);
    });

    if (requestedInvoiceId && originalInvoiceItems.length > 0) {
      for (const originalItem of originalInvoiceItems) {
        const origDepot = originalItem.depot_origine || canonicalDepotName;
        const key = `${originalItem.article_id}_${normalizeDepotName(origDepot)}`;
        stockMapByDepot[key] = (stockMapByDepot[key] || 0) + Number(originalItem.qte || 0);
      }
    }

    const insufficientItems = [];
    for (const item of items) {
      const itemDepot = (item as any).depot_origine || canonicalDepotName;
      const key = `${item.id}_${normalizeDepotName(itemDepot)}`;
      const available = stockMapByDepot[key] ?? 0;
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

    let result;
    let invoiceId: number | null = null;
    let extractedId: number | null = null;
    let createdInvoiceData: any = null;
    let lineItemsToInsertList: any[] = [];
    
    if (body.invoiceId) {
      // MODE: UPDATE EXISTING INVOICE
      let rpcSuccess = false;
      try {
        let { data, error } = await supabase.rpc("update_invoice_from_pos_safe", {
          p_invoice_id: Number(body.invoiceId),
          p_client_id: clientId,
          p_vendeur: user.username ?? "Caisse",
          p_emplacement: body.emplacement ?? user.emplacement ?? null,
          p_moyen_reglement: normalizedPaymentMethod,
          p_depot_id: effectiveDepotId,
          p_items: items,
          p_user_id_text: rpcUserIdText,
        });
        if (error && isMissingRpcSignature(error, "update_invoice_from_pos_safe")) {
          ({ data, error } = await supabase.rpc("update_invoice_from_pos_safe", {
            p_invoice_id: Number(body.invoiceId),
            p_client_id: clientId,
            p_vendeur: user.username ?? "Caisse",
            p_emplacement: body.emplacement ?? user.emplacement ?? null,
            p_moyen_reglement: normalizedPaymentMethod,
            p_depot_nom: canonicalDepotName,
            p_items: items,
            p_user_id_text: rpcUserIdText,
          }));
        }
        if (!error && data) {
          result = data;
          rpcSuccess = true;
        }
      } catch (err) {
        console.warn("Update RPC failed, continuing with direct DB fallback...", err);
      }
      invoiceId = Number(body.invoiceId);
    } else {
      // MODE: NEW SALE (Fast Direct DB Transaction - Zero Unneeded RPC Overhead)
      console.log("⚡ Executing fast direct database checkout transaction...");

      // 1. Calculate totals in-memory
      const artMap = new Map<number, any>();
      (artRows || []).forEach((a: any) => artMap.set(Number(a.id), a));

      let calcTotalHT = 0;
      let calcTotalTTC = 0;
      const lineItemsToInsert: any[] = [];

      for (const item of items) {
        const article = artMap.get(Number(item.id));
        const qte = Number(item.quantite || 1);
        const requestedPrice = Number(item.prix);
        const puTtc = Number.isFinite(requestedPrice) && requestedPrice >= 0
          ? requestedPrice
          : Number(article?.p_vente_ttc || article?.p_vente_ht || 0);
        const tauxTva = Number(article?.taxe || 0);
        const puHt = (1 + tauxTva / 100) === 0 ? puTtc : puTtc / (1 + (tauxTva / 100));
        const totalItemTtc = round(puTtc * qte);
        const totalItemHt = round(puHt * qte);
        const montantTva = totalItemTtc - totalItemHt;

        calcTotalHT += totalItemHt;
        calcTotalTTC += totalItemTtc;

        const itemDescription = article?.designation || article?.nom || (item as any)?.nom || (item as any)?.designation || (item as any)?.description || "Article";
        const itemCodeArt = article?.reference || (item as any)?.reference || (item as any)?.code_barre || null;

        const itemDepot = (item as any).depot_origine || canonicalDepotName;
        const matchedItemDepot = Array.isArray(depotsRows)
          ? (depotsRows as DepotRow[]).find((d) => normalizeDepotName(String(d.nom || "")) === normalizeDepotName(itemDepot))
          : null;
        const itemDepotId = matchedItemDepot?.id ? Number(matchedItemDepot.id) : effectiveDepotId;

        lineItemsToInsert.push({
          article_id: Number(item.id),
          code_art: itemCodeArt,
          description: itemDescription,
          qte,
          pu_ht: puHt,
          pu_ttc: puTtc,
          total_item_ht: totalItemHt,
          total_item_ttc: totalItemTtc,
          taux_tva_item: tauxTva,
          montant_tva_item: montantTva,
          depot_id: itemDepotId,
        });
      }

      calcTotalHT = round(calcTotalHT);
      calcTotalTTC = round(calcTotalTTC);
      const calcTotalTva = round(calcTotalTTC - calcTotalHT);

      const isDebt = moyenReglement === "Crédit" || moyenReglement === "Avance";
      let initialPaye = isDebt ? cashVersement : calcTotalTTC;
      
      // Advance withdrawal logic if moyenReglement is Avance
      let advancePaymentsToInsert: any[] = [];
      if (moyenReglement === "Avance") {
        let remainingToSettle = calcTotalTTC - cashVersement;
        if (remainingToSettle > 0) {
          try {
            const advanceService = new AdvanceService(supabase);
            const advances = await advanceService.getActiveAdvancesByClientId(clientId);
            for (const adv of advances) {
              if (remainingToSettle <= 0) break;
              const amountFromThisAdvance = Math.min(Number(adv.montant_restant), remainingToSettle);
              if (amountFromThisAdvance > 0) {
                await advanceService.withdrawAdvance(
                  adv.id,
                  amountFromThisAdvance,
                  `Paiement Facture POS (Caisse)`,
                  user.username || "Système"
                );
                advancePaymentsToInsert.push({
                  montant_regle: amountFromThisAdvance,
                  moyen_reglement: "Avance",
                  avance_client_id: adv.id,
                });
                remainingToSettle -= amountFromThisAdvance;
                initialPaye += amountFromThisAdvance;
              }
            }
          } catch (advErr) {
            console.warn("Advance settlement error:", advErr);
          }
        }
      }

      const initialRestant = Math.max(0, round(calcTotalTTC - initialPaye));
      const statut = initialRestant === 0 ? "Payée" : initialPaye > 0 ? "Partiellement Payée" : "Non Payée";

      // Generate invoice number
      const year = new Date().getFullYear();
      const randRef = Math.random().toString(36).substring(2, 7).toUpperCase();
      const blNumber = `FA-${year}-${randRef}`;

      // 2. Prepare Payloads
      const invoicePayload: any = {
        client_id: clientId,
        vendeur: user.username ?? "Caisse",
        date_facture: new Date().toISOString().split("T")[0],
        total_ht: calcTotalHT,
        total_ttc: calcTotalTTC,
        total_tva: calcTotalTva,
        montant_paye: initialPaye,
        montant_restant: initialRestant,
        statut,
        bl_number: blNumber,
        organization_id: user.organization_id || "00000000-0000-0000-0000-000000000001",
      };

      if (canonicalDepotName) invoicePayload.emplacement = canonicalDepotName;

      // Prepare items, movements, and payments payloads
      const mouvementsPayload = items.map((item: any) => {
        const qte = Number(item.quantite || 1);
        const itemDepot = (item as any).depot_origine || canonicalDepotName;
        return {
          article_id: Number(item.id),
          nr_doc: blNumber,
          date_mouvement: new Date().toISOString(),
          fournisseur_client: `Vente Client #${clientId} (${itemDepot})`,
          entree: 0,
          sortie: qte,
          quantite: -qte,
          pv: item.prix || 0,
          type: "VENTE_POS",
          depot: itemDepot,
          utilisateur: user.username ?? "Caisse",
          organization_id: user.organization_id || "00000000-0000-0000-0000-000000000001",
        };
      });

      const paymentsToInsert: any[] = [];
      if (initialPaye > 0 && !isDebt) {
        paymentsToInsert.push({
          date_operation: new Date().toISOString().split("T")[0],
          montant_regle: initialPaye,
          moyen_reglement: normalizedPaymentMethod,
          reference_paiement: `REG-${blNumber}`,
          utilisateur: user.username || "Système",
          user_id: user.id,
          regle: true,
          organization_id: user.organization_id || "00000000-0000-0000-0000-000000000001",
        });
      } else if (cashVersement > 0 && isDebt) {
        paymentsToInsert.push({
          date_operation: new Date().toISOString().split("T")[0],
          montant_regle: cashVersement,
          moyen_reglement: "Espèce",
          reference_paiement: `REG-${blNumber}`,
          utilisateur: user.username || "Système",
          user_id: user.id,
          regle: true,
          organization_id: user.organization_id || "00000000-0000-0000-0000-000000000001",
        });
      }

      for (const advP of advancePaymentsToInsert) {
        paymentsToInsert.push({
          date_operation: new Date().toISOString().split("T")[0],
          montant_regle: advP.montant_regle,
          moyen_reglement: "Avance",
          reference_paiement: `ADV-${advP.avance_client_id}`,
          avance_client_id: advP.avance_client_id,
          utilisateur: user.username || "Système",
          user_id: user.id,
          regle: true,
          organization_id: user.organization_id || "00000000-0000-0000-0000-000000000001",
        });
      }

      // --- 3. ATOMIC POS SALE EXECUTION (Primary Path) ---
      let atomicExecuted = false;
      let createdInvoice: any = null;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc("atomic_process_pos_sale", {
          p_invoice: invoicePayload,
          p_items: lineItemsToInsert,
          p_movements: mouvementsPayload,
          p_payments: paymentsToInsert,
        });

        if (!rpcErr && rpcRes && rpcRes.id) {
          createdInvoice = rpcRes;
          atomicExecuted = true;
          console.log("⚡ Atomic POS checkout executed successfully (ACID & Race-condition free)");
        } else if (rpcErr) {
          console.warn("Atomic POS RPC not available or failed, using graceful fallback:", rpcErr.message);
        }
      } catch (ex) {
        console.warn("Atomic POS RPC exception, using graceful fallback:", ex);
      }

      // --- 4. DIRECT FALLBACK EXECUTION (if RPC not yet applied in DB) ---
      if (!atomicExecuted) {
        let { data: fallbackInvoice, error: invError } = await supabase
          .from("factures")
          .insert([invoicePayload])
          .select("id, bl_number, date_facture, total_ht, total_ttc, total_tva, montant_paye, montant_restant, statut, client_id, vendeur, organization_id")
          .single();

        while (invError && invError.message) {
          const match = invError.message.match(/Could not find the '([^']+)' column of 'factures'/i);
          if (match && match[1] && invoicePayload[match[1]] !== undefined) {
            delete invoicePayload[match[1]];
            const retryRes = await supabase
              .from("factures")
              .insert([invoicePayload])
              .select("id, bl_number, date_facture, total_ht, total_ttc, total_tva, montant_paye, montant_restant, statut, client_id, vendeur, organization_id")
              .single();
            fallbackInvoice = retryRes.data;
            invError = retryRes.error;
          } else {
            break;
          }
        }

        if (invError) throw invError;
        if (!fallbackInvoice) throw new Error("Erreur: Impossible de créer la facture.");
        createdInvoice = fallbackInvoice;

        const itemsPayload = lineItemsToInsert.map((li: any) => ({
          ...li,
          facture_id: createdInvoice.id,
          organization_id: user.organization_id || "00000000-0000-0000-0000-000000000001",
        }));

        const stockMapForLookup = new Map<string, { id: any; quantite: number }>();
        ((stockLevels as any[] | null | undefined) || []).forEach((curr) => {
          const key = `${curr.article_id}_${normalizeDepotName(curr.depot_nom || "")}`;
          stockMapForLookup.set(key, { id: curr.id, quantite: Number(curr.quantite || 0) });
        });

        const parallelTasks: any[] = [
          supabase.from("facture_items").insert(itemsPayload),
        ];

        for (const item of items) {
          const qte = Number(item.quantite || 1);
          const itemDepot = (item as any).depot_origine || canonicalDepotName;
          const key = `${item.id}_${normalizeDepotName(itemDepot)}`;
          const existingStock = stockMapForLookup.get(key);

          if (existingStock?.id) {
            let updateStockQ = supabase
              .from("stocks")
              .update({ quantite: existingStock.quantite - qte })
              .eq("id", existingStock.id);
            if (user.organization_id) {
              updateStockQ = updateStockQ.eq("organization_id", user.organization_id);
            }
            parallelTasks.push(updateStockQ);
          } else {
            parallelTasks.push(
              supabase.from("stocks").insert([{
                article_id: Number(item.id),
                depot_nom: itemDepot,
                quantite: -qte,
                organization_id: user.organization_id || "00000000-0000-0000-0000-000000000001",
              }])
            );
          }
        }

        parallelTasks.push(supabase.from("mouvements").insert(mouvementsPayload));

        const directPayments = paymentsToInsert.map((p) => ({
          ...p,
          facture_id: createdInvoice.id,
          reference_paiement: `REG-${createdInvoice.id}`,
        }));

        if (directPayments.length > 0) {
          parallelTasks.push(supabase.from("paiements").insert(directPayments));
        }

        await Promise.all(parallelTasks);
      }

      // Fire non-blocking audits & rewards
      Promise.allSettled([
        logPriceChangeAudit({
          supabase,
          invoiceId: createdInvoice.id,
          documentNumber: blNumber,
          priceChanges,
          userId: rpcUserIdText,
          username: user.username || "Système",
          depotId: effectiveDepotId,
          depotName: canonicalDepotName,
        }),
        clientId && Number(clientId) > 1 && calcTotalTTC > 0
          ? awardLoyaltyPoints(clientId, createdInvoice.id, calcTotalTTC)
          : Promise.resolve(),
      ]).catch(console.error);

      // Construct instant hydrated invoice object
      const returnedInvoice = {
        ...createdInvoice,
        moyen_reglement: normalizedPaymentMethod,
        client_nom: clientData.nom || "Client Comptant",
        clients: clientData,
        items: lineItemsToInsert,
        paiements: paymentsToInsert,
      };

      return NextResponse.json({
        ok: true,
        sale: { id: createdInvoice.id, numero: blNumber },
        invoice_id: createdInvoice.id,
        invoice: returnedInvoice,
        debug: {
          extractedId: createdInvoice.id,
          isFastDirect: true,
        }
      });
    }

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
      const { data: invoices, error: fallbackErr } = await supabase
        .from("factures")
        .select("id")
        .eq("client_id", clientId)
        .order("id", { ascending: false })
        .limit(1);
      
      if (!fallbackErr && invoices && invoices.length > 0) {
        extractedId = Number(invoices[0].id);
      }
    }

    // ─── POST-CHECKOUT SETTLEMENT LOGIC (ONLY FOR EDIT EXISTING INVOICE) ───
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

      // 1. CREDIT/AVANCE INITIALIZATION
      if (isDebtMode) {
        await supabase.from("paiements")
          .update({ montant_regle: 0 })
          .eq("facture_id", extractedId)
          .ilike("moyen_reglement", "crédit");
      }

      // 2. CASH PARTIAL PAYMENT
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

        const totalPaid = round(totalTTC - (remainingToSettle > 0 ? remainingToSettle : 0));
        await supabase.from("factures").update({
          statut: isGreaterOrEqual(totalPaid, totalTTC) ? "Payée" : (totalPaid > 0 ? "Partiellement Payée" : "Non Payée"),
          montant_paye: totalPaid,
          montant_restant: Math.max(0, round(totalTTC - totalPaid))
        }).eq("id", extractedId);
      } else if (moyenReglement === "Crédit") {
        await supabase.from("factures").update({
          statut: cashVersement >= totalTTC ? "Payée" : (cashVersement > 0 ? "Partiellement Payée" : "Non Payée"),
          montant_paye: cashVersement,
          montant_restant: Math.max(0, totalTTC - cashVersement)
        }).eq("id", extractedId);
      }
      const { data: finalInvoiceRow } = await supabase
        .from("factures")
        .select("*, clients(nom, adresse, tel, gsm, email)")
        .eq("id", extractedId)
        .single();

      const finalTotalTTC = Number(finalInvoiceRow?.total_ttc || reconciledTotalTTC || totalTTC || 0);

      await syncInvoicePaymentsAndStatus({
        supabase,
        invoiceId: extractedId,
        totalTTC: finalTotalTTC,
        moyenReglement,
        isEditMode: true,
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

      if (clientId && Number(clientId) > 1 && finalTotalTTC > 0) {
        await awardLoyaltyPoints(clientId, extractedId, finalTotalTTC);
      }
    }

    let returnedInvoice: any = null;
    if (extractedId) {
      const { data: invRow } = await supabase
        .from("factures")
        .select("*, clients(nom, adresse, tel, gsm, email)")
        .eq("id", extractedId)
        .maybeSingle();
      returnedInvoice = invRow;
    }

    return NextResponse.json({
      ok: true,
      sale: result || { id: extractedId },
      invoice_id: extractedId,
      invoice: returnedInvoice,
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
