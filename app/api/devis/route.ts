import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    let query = supabase
      .from("devis")
      .select("*, devis_items(*), clients(nom, tel, adresse)")
      .order("date_devis", { ascending: false })
      .order("id", { ascending: false });

    if (session.organization_id) {
      query = query.eq("organization_id", session.organization_id);
    }

    if (search) {
      query = query.or(`numero_devis.ilike.%${search}%,client_nom.ilike.%${search}%`);
    }

    if (status && status !== "all") {
      query = query.eq("statut", status);
    }

    if (start) query = query.gte("date_devis", start);
    if (end) query = query.lte("date_devis", `${end}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Devis GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { items, ...devisData } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Veuillez ajouter au moins un article." }, { status: 400 });
    }

    // Auto-generate Devis Reference if not provided
    let numeroDevis = devisData.numero_devis;
    if (!numeroDevis) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      numeroDevis = `DEV-${year}-${rand}`;
    }

    // Calculate totals
    let totalHT = 0;
    let totalTVA = 0;
    let totalTTC = 0;

    items.forEach((it: any) => {
      const qte = Number(it.qte) || 1;
      const pu = Number(it.pu_ht) || 0;
      const remise = Number(it.remise_pourcentage) || 0;
      const tauxTva = Number(it.taux_tva) || 0;

      const ligneBrute = qte * pu;
      const ligneHT = ligneBrute * (1 - remise / 100);
      const ligneTVA = ligneHT * (tauxTva / 100);
      const ligneTTC = ligneHT + ligneTVA;

      totalHT += ligneHT;
      totalTVA += ligneTVA;
      totalTTC += ligneTTC;
    });

    // 1. Insert Devis
    const { data: newDevis, error: devisErr } = await supabase
      .from("devis")
      .insert({
        numero_devis: numeroDevis,
        client_id: devisData.client_id || null,
        client_nom: devisData.client_nom || "Client Comptoir",
        client_tel: devisData.client_tel || "",
        client_adresse: devisData.client_adresse || "",
        date_devis: devisData.date_devis || new Date().toISOString().split("T")[0],
        date_validite: devisData.date_validite || null,
        total_ht: totalHT,
        total_tva: totalTVA,
        total_ttc: totalTTC,
        statut: devisData.statut || "En attente",
        vendeur: session.username || "Commercial",
        notes: devisData.notes || "",
        conditions_reglement: devisData.conditions_reglement || "Paiement à la commande",
        organization_id: session.organization_id || "00000000-0000-0000-0000-000000000001",
      })
      .select()
      .single();

    if (devisErr) {
      if (
        devisErr.message &&
        (devisErr.message.includes("does not exist") ||
          devisErr.message.includes("schema cache") ||
          devisErr.code === "42P01" ||
          devisErr.code === "PGRST205")
      ) {
        return NextResponse.json(
          {
            error: "La table 'public.devis' n'est pas encore initialisée dans Supabase. Veuillez exécuter le script SQL dans Supabase SQL Editor.",
            code: "DEVIS_TABLE_MISSING",
          },
          { status: 400 }
        );
      }
      throw new Error(devisErr.message);
    }

    // 2. Insert Devis Items
    const itemsToInsert = items.map((it: any) => {
      const qte = Number(it.qte) || 1;
      const pu = Number(it.pu_ht) || 0;
      const remise = Number(it.remise_pourcentage) || 0;
      const tauxTva = Number(it.taux_tva) || 0;
      const ligneBrute = qte * pu;
      const ligneHT = ligneBrute * (1 - remise / 100);
      const ligneTVA = ligneHT * (tauxTva / 100);
      const ligneTTC = ligneHT + ligneTVA;

      return {
        devis_id: newDevis.id,
        article_id: it.article_id || null,
        reference: it.reference || "",
        description: it.description || it.designation || "Article",
        qte,
        pu_ht: pu,
        remise_pourcentage: remise,
        taux_tva: tauxTva,
        total_ligne_ht: ligneHT,
        total_ligne_ttc: ligneTTC,
        organization_id: session.organization_id || "00000000-0000-0000-0000-000000000001",
      };
    });

    let { error: itemsErr } = await supabase.from("devis_items").insert(itemsToInsert);
    if (itemsErr && itemsErr.message && itemsErr.message.includes("organization_id")) {
      const fallbackItems = itemsToInsert.map(({ organization_id, ...rest }: any) => rest);
      const retry = await supabase.from("devis_items").insert(fallbackItems);
      itemsErr = retry.error;
    }
    if (itemsErr) throw new Error(itemsErr.message);

    return NextResponse.json(newDevis, { status: 201 });
  } catch (error: any) {
    console.error("Devis POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
