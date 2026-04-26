import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSession, isAdminOrManager } from "@/lib/auth_helper";

export async function GET() {
  try {
    const supabase = await createClient();
    const session = await getServerSession();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = await isAdminOrManager(session);
    const notifications: any[] = [];
    const today = new Date();

    // 1. Stock Alerts (Only for Admin)
    if (isAdmin) {
      const { data: lowStockProducts } = await supabase
        .from("articles")
        .select("id, designation, reference, qte_min, stocks(quantite)")
        .eq("is_deleted", false);

      if (lowStockProducts) {
        lowStockProducts.forEach((p: any) => {
          const totalStock = p.stocks?.reduce((acc: number, s: any) => acc + (Number(s.quantite) || 0), 0) || 0;
          const min = Number(p.qte_min) || 5; // Default to 5 if not set
          if (totalStock <= min) {
            notifications.push({
              id: `stock-${p.id}`,
              type: "stock",
              title: "Stock Faible",
              message: `L'article "${p.designation}" (${p.reference}) est à ${totalStock} unités.`,
              link: "/dashboard/articles",
              priority: totalStock === 0 ? "high" : "medium"
            });
          }
        });
      }
    }

    // 2. Debt Alerts (Overdue Invoices)
    // We fetch invoices where montant_restant > 0 AND date_echeance < today
    const { data: overdueInvoices } = await supabase
      .from("factures")
      .select("id, bl_number, total_ttc, montant_restant, date_echeance, clients(nom, tel)")
      .eq("is_deleted", false)
      .gt("montant_restant", 0)
      .lt("date_echeance", today.toISOString().split('T')[0]);

    if (overdueInvoices) {
      overdueInvoices.forEach((inv: any) => {
        notifications.push({
          id: `debt-${inv.id}`,
          type: "debt",
          title: "Facture Échue",
          message: `Le client ${inv.clients?.nom || 'Inconnu'} doit ${inv.montant_restant} F (Facture ${inv.bl_number}).`,
          link: "/dashboard/invoices",
          priority: "high"
        });
      });
    }

    // 3. Vehicle Document Alerts (Admin Only)
    if (isAdmin) {
      const fifteenDaysFromNow = new Date();
      fifteenDaysFromNow.setDate(today.getDate() + 15);
      const limitDate = fifteenDaysFromNow.toISOString().split('T')[0];

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
              title: "Vignette Expire Bientôt",
              message: `La vignette de ${v.marque} ${v.modele} (${v.immatriculation}) expire le ${v.date_expiration}.`,
              link: "/dashboard/vehicles",
              priority: "medium"
            });
          }
          if (v.date_assurance_exp && v.date_assurance_exp <= limitDate) {
            notifications.push({
              id: `veh-ass-${v.id}`,
              type: "vehicle",
              title: "Assurance Expire Bientôt",
              message: `L'assurance de ${v.marque} ${v.modele} (${v.immatriculation}) expire le ${v.date_assurance_exp}.`,
              link: "/dashboard/vehicles",
              priority: "medium"
            });
          }
        });
      }
    }

    return NextResponse.json(notifications);
  } catch (error: any) {
    console.error("Notification API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
