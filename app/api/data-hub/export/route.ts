import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helper to escape CSV fields safely
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const orgId = session.organization_id || '00000000-0000-0000-0000-000000000001';
    const cleanOrgSlug = ((session.organization_name || (session as any).nom_prenom || "org") as string)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 15);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "invoices";
    const format = searchParams.get("format") || "csv";
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    // ═════════════════════════════════════════════════════════════════
    // 1. FULL DATABASE SNAPSHOT (JSON)
    // ═════════════════════════════════════════════════════════════════
    if (type === "full_snapshot") {
      let compQ = supabase.from("informations_entreprise").select("*");
      let artQ = supabase.from("articles").select("*").eq("is_deleted", false);
      let cliQ = supabase.from("clients").select("*").eq("is_deleted", false);
      let fourQ = supabase.from("fournisseurs").select("*").eq("is_deleted", false);
      let facQ = supabase.from("factures").select("*").eq("is_deleted", false);
      let facItQ = supabase.from("facture_items").select("*");
      let achQ = supabase.from("achats").select("*").eq("is_deleted", false);
      let depQ = supabase.from("depenses").select("*");
      let stQ = supabase.from("stocks").select("*");
      let mouvQ = supabase.from("mouvements").select("*").limit(2000);

      if (orgId) {
        compQ = compQ.eq("organization_id", orgId);
        artQ = artQ.eq("organization_id", orgId);
        cliQ = cliQ.eq("organization_id", orgId);
        fourQ = fourQ.eq("organization_id", orgId);
        facQ = facQ.eq("organization_id", orgId);
        facItQ = facItQ.eq("organization_id", orgId);
        achQ = achQ.eq("organization_id", orgId);
        depQ = depQ.eq("organization_id", orgId);
        stQ = stQ.eq("organization_id", orgId);
        mouvQ = mouvQ.eq("organization_id", orgId);
      }

      const [
        company,
        articles,
        clients,
        suppliers,
        factures,
        factureItems,
        achats,
        depenses,
        stocks,
        mouvements,
      ] = await Promise.all([
        compQ.maybeSingle(),
        artQ,
        cliQ,
        fourQ,
        facQ,
        facItQ,
        achQ,
        depQ,
        stQ,
        mouvQ,
      ]);

      const snapshot = {
        app: "Gestion Pro Global",
        version: "4K Enterprise Edition",
        exported_at: new Date().toISOString(),
        exported_by: session.username || "Admin",
        database_snapshot: {
          entreprise: company.data,
          articles_count: articles.data?.length || 0,
          clients_count: clients.data?.length || 0,
          suppliers_count: suppliers.data?.length || 0,
          factures_count: factures.data?.length || 0,
          articles: articles.data || [],
          clients: clients.data || [],
          fournisseurs: suppliers.data || [],
          factures: factures.data || [],
          facture_items: factureItems.data || [],
          achats: achats.data || [],
          depenses: depenses.data || [],
          stocks: stocks.data || [],
          mouvements: mouvements.data || [],
        },
      };

      const filename = `backup_gestion_pro_${cleanOrgSlug}_${new Date().toISOString().split("T")[0]}.json`;
      return new NextResponse(JSON.stringify(snapshot, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ═════════════════════════════════════════════════════════════════
    // 2. INVOICES / VENTES
    // ═════════════════════════════════════════════════════════════════
    if (type === "invoices") {
      let q = supabase
        .from("factures")
        .select("*, clients(nom, tel)")
        .eq("is_deleted", false)
        .order("date_facture", { ascending: false });

      if (orgId) q = q.eq("organization_id", orgId);
      if (start) q = q.gte("date_facture", start);
      if (end) q = q.lte("date_facture", end);

      const { data, error } = await q;
      if (error) throw error;

      const headers = [
        "Réf Facture (BL)",
        "Date",
        "Client",
        "Téléphone",
        "Total HT (FCFA)",
        "TVA (FCFA)",
        "Total TTC (FCFA)",
        "Montant Payé (FCFA)",
        "Reste Dû (FCFA)",
        "Mode Règlement",
        "Statut",
        "Vendeur",
        "Emplacement",
      ];

      const rows = (data || []).map((i: any) => [
        escapeCSV(i.bl_number),
        escapeCSV(i.date_facture),
        escapeCSV(i.clients?.nom || i.client_nom || "Client Comptoir"),
        escapeCSV(i.clients?.tel || i.client_tel || ""),
        escapeCSV(i.total_ht || 0),
        escapeCSV(i.total_tva || 0),
        escapeCSV(i.total_ttc || 0),
        escapeCSV(i.montant_paye || 0),
        escapeCSV(i.montant_restant || 0),
        escapeCSV(i.moyen_reglement || "Espèces"),
        escapeCSV(i.statut || "Non Payée"),
        escapeCSV(i.vendeur || ""),
        escapeCSV(i.emplacement || "BOUTIQUE"),
      ]);

      const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
      const filename = `ventes_factures_${cleanOrgSlug}_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ═════════════════════════════════════════════════════════════════
    // 3. ARTICLES & INVENTORY
    // ═════════════════════════════════════════════════════════════════
    if (type === "articles") {
      let artQ = supabase
        .from("articles")
        .select("id, reference, code_barre, designation, famille, p_achat_ht, p_vente_ttc, p_vente_ht, prix_gros, prix_special")
        .eq("organization_id", orgId)
        .eq("is_deleted", false)
        .order("designation");

      const [artsRes, stocksRes] = await Promise.all([
        artQ,
        supabase.from("stocks").select("article_id, quantite").eq("organization_id", orgId),
      ]);

      if (artsRes.error) throw artsRes.error;

      const arts = artsRes.data || [];
      const stocks = stocksRes.data || [];

      // Map stock quantities strictly by this organization's stocks
      const stockMap = new Map<number, number>();
      for (const s of stocks) {
        const cur = stockMap.get(s.article_id) || 0;
        stockMap.set(s.article_id, cur + (Number(s.quantite) || 0));
      }

      const headers = [
        "Référence",
        "Code Barre",
        "Désignation",
        "Famille / Catégorie",
        "Prix Achat HT (FCFA)",
        "Prix Vente Détail (FCFA)",
        "Prix Vente Gros (FCFA)",
        "Prix Spécial (FCFA)",
        "Stock Total",
        "Valeur Stock Achat (FCFA)",
      ];

      const rows = arts.map((a: any) => {
        const stockTotal = stockMap.get(a.id) || 0;
        const pAchat = Number(a.p_achat_ht) || 0;
        const valeurAchat = stockTotal * pAchat;

        return [
          escapeCSV(a.reference),
          escapeCSV(a.code_barre || ""),
          escapeCSV(a.designation),
          escapeCSV(a.famille || ""),
          escapeCSV(pAchat),
          escapeCSV(a.p_vente_ttc || a.p_vente_ht || 0),
          escapeCSV(a.prix_gros || "-"),
          escapeCSV(a.prix_special || "-"),
          escapeCSV(stockTotal),
          escapeCSV(valeurAchat),
        ];
      });

      const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
      const filename = `catalogue_articles_stocks_${cleanOrgSlug}_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ═════════════════════════════════════════════════════════════════
    // 4. CLIENTS & CRÉANCES
    // ═════════════════════════════════════════════════════════════════
    if (type === "clients") {
      let cliQ = supabase
        .from("clients")
        .select("*")
        .eq("is_deleted", false)
        .order("nom");

      if (orgId) cliQ = cliQ.eq("organization_id", orgId);
      const { data: clients, error } = await cliQ;

      if (error) throw error;

      const headers = [
        "Réf Client",
        "Nom du Client",
        "Téléphone",
        "Catégorie Tarifaire",
        "Dette Factures (FCFA)",
        "Dette Bons de Livraison (FCFA)",
        "Total Créance Due (FCFA)",
      ];

      const rows = (clients || []).map((c: any) => {
        const detteFacture = Number(c.credit_facture) || 0;
        const detteBL = Number(c.credit_bl) || 0;
        const totalDu = detteFacture + detteBL;

        return [
          escapeCSV(c.ref_client || `CL-${c.id}`),
          escapeCSV(c.nom),
          escapeCSV(c.tel || ""),
          escapeCSV(c.type_client || "Détail"),
          escapeCSV(detteFacture),
          escapeCSV(detteBL),
          escapeCSV(totalDu),
        ];
      });

      const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
      const filename = `fichier_clients_creances_${cleanOrgSlug}_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ═════════════════════════════════════════════════════════════════
    // 5. ACHATS & FOURNISSEURS
    // ═════════════════════════════════════════════════════════════════
    if (type === "purchases") {
      let q = supabase
        .from("achats")
        .select("*, fournisseurs(nom, telephone)")
        .eq("is_deleted", false)
        .order("date_achat", { ascending: false });

      if (orgId) q = q.eq("organization_id", orgId);
      if (start) q = q.gte("date_achat", start);
      if (end) q = q.lte("date_achat", end);

      const { data: achats, error } = await q;
      if (error) throw error;

      const headers = [
        "Réf Achat",
        "Date Achat",
        "Fournisseur",
        "Téléphone",
        "Total TTC (FCFA)",
        "Montant Réglé (FCFA)",
        "Dette Fournisseur (FCFA)",
        "Statut",
      ];

      const rows = (achats || []).map((a: any) => [
        escapeCSV(a.reference_facture || `ACH-${a.id}`),
        escapeCSV(a.date_achat),
        escapeCSV(a.fournisseurs?.nom || a.fournisseur_nom || "Fournisseur"),
        escapeCSV(a.fournisseurs?.telephone || ""),
        escapeCSV(a.montant_total || 0),
        escapeCSV(a.montant_paye || 0),
        escapeCSV(a.montant_restant || (Number(a.montant_total || 0) - Number(a.montant_paye || 0))),
        escapeCSV(a.statut || "Non Réglé"),
      ]);

      const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
      const filename = `achats_fournisseurs_${cleanOrgSlug}_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ═════════════════════════════════════════════════════════════════
    // 6. DÉPENSES
    // ═════════════════════════════════════════════════════════════════
    if (type === "expenses") {
      let q = supabase
        .from("depenses")
        .select("*")
        .order("date_depense", { ascending: false });

      if (orgId) q = q.eq("organization_id", orgId);
      if (start) q = q.gte("date_depense", start);
      if (end) q = q.lte("date_depense", end);

      const { data: depenses, error } = await q;
      if (error) throw error;

      const headers = ["Date Dépense", "Catégorie", "Montant (FCFA)", "Bénéficiaire", "Motif / Description"];

      const rows = (depenses || []).map((d: any) => [
        escapeCSV(d.date_depense),
        escapeCSV(d.categorie || "Général"),
        escapeCSV(d.montant || 0),
        escapeCSV(d.beneficiaire || ""),
        escapeCSV(d.motif || ""),
      ]);

      const csvContent = "\uFEFF" + [headers.map(escapeCSV).join(";"), ...rows.map(r => r.join(";"))].join("\r\n");
      const filename = `depenses_${cleanOrgSlug}_${new Date().toISOString().split("T")[0]}.csv`;

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: "Type d'export inconnu" }, { status: 400 });
  } catch (error: any) {
    console.error("Data Hub export error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
