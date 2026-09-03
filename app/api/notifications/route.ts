import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    const notifications: any[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // 1. Stock Alerts (Low stock & Out of Stock)
    const { data: lowStockProducts } = await supabase
      .from("articles")
      .select("id, designation, reference, qte_min, stocks(quantite)")
      .eq("is_deleted", false)
      .limit(50);

    if (lowStockProducts) {
      lowStockProducts.forEach((p: any) => {
        const totalStock = p.stocks?.reduce((acc: number, s: any) => acc + (Number(s.quantite) || 0), 0) || 0;
        const min = Number(p.qte_min) || 5;
        if (totalStock <= min) {
          notifications.push({
            id: `stock-${p.id}`,
            type: "stock",
            title: totalStock === 0 ? "Rupture de Stock" : "Stock Critique",
            message: totalStock === 0 
              ? `L'article "${p.designation}" (${p.reference}) est totalement ÉPUISÉ (0 unité).`
              : `L'article "${p.designation}" (${p.reference}) est à ${totalStock} unités (Seuil: ${min}).`,
            link: "/dashboard/stock",
            priority: totalStock === 0 ? "high" : "medium"
          });
        }
      });
    }

    // 2. Debt & Overdue Invoices Alerts
    const { data: unpaidInvoices } = await supabase
      .from("factures")
      .select("id, bl_number, total_ttc, montant_restant, date_echeance, date_facture, clients(nom, tel)")
      .eq("is_deleted", false)
      .gt("montant_restant", 0)
      .order("date_facture", { ascending: false })
      .limit(20);

    if (unpaidInvoices) {
      unpaidInvoices.forEach((inv: any) => {
        const isOverdue = inv.date_echeance && inv.date_echeance < todayStr;
        if (isOverdue || Number(inv.montant_restant) >= 500000) {
          notifications.push({
            id: `debt-${inv.id}`,
            type: "debt",
            title: isOverdue ? "Échéance Crédit Dépassée" : "Créance Importante",
            message: `Client: ${inv.clients?.nom || "Inconnu"} • Reste: ${Number(inv.montant_restant).toLocaleString("fr-FR")} FCFA (Facture ${inv.bl_number}).`,
            link: "/dashboard/invoices",
            priority: isOverdue ? "high" : "medium"
          });
        }
      });
    }

    // 3. Vehicle Document Alerts (Vignette & Assurance)
    try {
      const fifteenDaysFromNow = new Date();
      fifteenDaysFromNow.setDate(today.getDate() + 15);
      const limitDate = fifteenDaysFromNow.toISOString().split("T")[0];

      const { data: expVehicles } = await supabase
        .from("voitures")
        .select("id, marque, modele, immatriculation, date_expiration, date_assurance_exp")
        .or(`date_expiration.lte.${limitDate},date_assurance_exp.lte.${limitDate}`);

      if (expVehicles) {
        expVehicles.forEach((v: any) => {
          if (v.date_expiration && v.date_expiration <= limitDate) {
            notifications.push({
              id: `veh-vig-${v.id}`,
              type: "vehicle",
              title: "Vignette Véhicule Expire",
              message: `${v.marque} ${v.modele} (${v.immatriculation}) - Exp: ${v.date_expiration}.`,
              link: "/dashboard/vehicles",
              priority: "medium"
            });
          }
          if (v.date_assurance_exp && v.date_assurance_exp <= limitDate) {
            notifications.push({
              id: `veh-ass-${v.id}`,
              type: "vehicle",
              title: "Assurance Véhicule Expire",
              message: `${v.marque} ${v.modele} (${v.immatriculation}) - Exp: ${v.date_assurance_exp}.`,
              link: "/dashboard/vehicles",
              priority: "medium"
            });
          }
        });
      }
    } catch (e) {}

    // Sort by priority (high first)
    notifications.sort((a, b) => (a.priority === "high" ? -1 : 1));

    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error("Notification API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
