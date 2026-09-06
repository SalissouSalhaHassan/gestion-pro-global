import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizeDepotName(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";

    // 1. Fetch Depots strictly scoped by organization_id
    const { data: depots, error: depotsError } = await supabase
      .from("depots")
      .select("*")
      .eq("organization_id", orgId)
      .eq("is_deleted", false)
      .order("nom");

    if (depotsError) throw depotsError;

    // 2. Fetch Users for responsible selection (scoped by organization)
    const { data: users } = await supabase
      .from("users")
      .select("utilisateur, nom_prenom")
      .eq("organization_id", orgId)
      .order("utilisateur");

    // 3. Fetch Stock summaries with complete article details for accurate cost & sale value
    const { data: stockData, error: stockErr } = await supabase
      .from("stocks")
      .select(`
        id,
        quantite,
        depot_nom,
        depot_id,
        article_id,
        articles (
          id,
          reference,
          code_barre,
          nom,
          designation,
          p_achat_ht,
          p_achat_ttc,
          p_vente_ht,
          p_vente_ttc,
          qte_min
        )
      `)
      .eq("organization_id", orgId);

    if (stockErr) {
      console.warn("Could not fetch stocks with articles join, attempting fallback:", stockErr);
    }

    // Build map of stocks per depot using both depot_id and normalized depot_nom
    const stockMapById = new Map<number, any[]>();
    const stockMapByNorm = new Map<string, any[]>();

    const allStocks = Array.isArray(stockData) ? stockData : [];
    const globalArticleIds = new Set<number>();
    let globalStockValue = 0;
    let globalSaleValue = 0;
    let globalUnits = 0;
    let globalAlerts = 0;

    for (const st of allStocks) {
      const art = Array.isArray(st.articles) ? st.articles[0] : st.articles;
      const qty = Number(st.quantite || 0);
      const unitCost = Number(art?.p_achat_ht ?? art?.p_achat_ttc ?? 0);
      const unitPrice = Number(art?.p_vente_ht ?? art?.p_vente_ttc ?? 0);
      const valCost = qty * unitCost;
      const valSale = qty * unitPrice;
      const qteMin = Number(art?.qte_min || 0);
      const isLow = qteMin > 0 && qty <= qteMin;
      const isNeg = qty < 0;

      if (st.article_id) globalArticleIds.add(Number(st.article_id));
      globalUnits += qty;
      globalStockValue += valCost;
      globalSaleValue += valSale;
      if (isLow || isNeg) globalAlerts += 1;

      const itemInfo = {
        id: st.id,
        article_id: st.article_id,
        reference: art?.reference || art?.code_barre || "-",
        designation: art?.designation || art?.nom || "Article",
        quantite: qty,
        prix_achat: unitCost,
        prix_vente: unitPrice,
        valeur_achat: valCost,
        valeur_vente: valSale,
        qte_min: qteMin,
        is_low_stock: isLow,
        is_negative: isNeg,
      };

      if (st.depot_id) {
        const idKey = Number(st.depot_id);
        if (!stockMapById.has(idKey)) stockMapById.set(idKey, []);
        stockMapById.get(idKey)!.push(itemInfo);
      }

      const normKey = normalizeDepotName(st.depot_nom || "");
      if (normKey) {
        if (!stockMapByNorm.has(normKey)) stockMapByNorm.set(normKey, []);
        stockMapByNorm.get(normKey)!.push(itemInfo);
      }
    }

    // Enrich each depot with real stock metrics and article items
    const enrichedDepots = (depots || []).map((d: any) => {
      const normDNom = normalizeDepotName(d.nom || "");
      // Match by ID first, fallback to normalized name
      const matchedItems = stockMapById.get(Number(d.id)) || stockMapByNorm.get(normDNom) || [];

      // Deduplicate items if multiple records exist for same article in depot
      const itemsByArticleId = new Map<number, any>();
      for (const it of matchedItems) {
        if (!itemsByArticleId.has(it.article_id)) {
          itemsByArticleId.set(it.article_id, { ...it });
        } else {
          const existing = itemsByArticleId.get(it.article_id);
          existing.quantite += it.quantite;
          existing.valeur_achat += it.valeur_achat;
          existing.valeur_vente += it.valeur_vente;
          existing.is_negative = existing.quantite < 0;
          existing.is_low_stock = existing.qte_min > 0 && existing.quantite <= existing.qte_min;
        }
      }

      const depotItems = Array.from(itemsByArticleId.values()).sort(
        (a, b) => Math.abs(b.valeur_achat) - Math.abs(a.valeur_achat)
      );

      const distinctArticlesCount = depotItems.filter((it) => it.quantite !== 0).length;
      const totalUnits = depotItems.reduce((sum, it) => sum + it.quantite, 0);
      const totalCostValue = depotItems.reduce((sum, it) => sum + it.valeur_achat, 0);
      const totalSaleValue = depotItems.reduce((sum, it) => sum + it.valeur_vente, 0);
      const lowStockCount = depotItems.filter((it) => it.is_low_stock).length;
      const negativeStockCount = depotItems.filter((it) => it.is_negative).length;

      return {
        ...d,
        articles_count: distinctArticlesCount,
        total_units: totalUnits,
        total_value: totalCostValue,
        total_sale_value: totalSaleValue,
        low_stock_count: lowStockCount,
        negative_stock_count: negativeStockCount,
        items: depotItems,
      };
    });

    return NextResponse.json({
      depots: enrichedDepots,
      users: (users || []).map((u: any) => u.nom_prenom || u.utilisateur),
      currentOrgId: orgId,
      summary: {
        total_depots: enrichedDepots.length,
        active_depots: enrichedDepots.filter((d: any) => d.is_active).length,
        global_stock_value: Math.round(globalStockValue),
        global_sale_value: Math.round(globalSaleValue),
        global_units: Math.round(globalUnits),
        global_references: globalArticleIds.size,
        global_alerts: globalAlerts,
      },
    });
  } catch (error: any) {
    console.error("Depots GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { id, nom, emplacement, responsable, telephone, adresse, is_active = true } = body;

    if (!nom || !nom.trim()) {
      return NextResponse.json({ error: "Le nom du dépôt est requis" }, { status: 400 });
    }

    const payload: any = {
      nom: nom.trim(),
      emplacement: emplacement ? emplacement.trim() : nom.trim(),
      responsable: responsable ? responsable.trim() : null,
      telephone: telephone ? telephone.trim() : null,
      adresse: adresse ? adresse.trim() : (emplacement ? emplacement.trim() : null),
      is_active: Boolean(is_active),
      organization_id: orgId,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      // Update existing depot (ensure it belongs to this org)
      const { data, error } = await supabase
        .from("depots")
        .update(payload)
        .eq("id", id)
        .eq("organization_id", orgId)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Insert new depot
      payload.created_at = new Date().toISOString();
      payload.is_deleted = false;
      const { data, error } = await supabase
        .from("depots")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }
  } catch (error: any) {
    console.error("Depots POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const orgId = session.organization_id || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    // Soft delete
    const { error } = await supabase
      .from("depots")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Depots DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
