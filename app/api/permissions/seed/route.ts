import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST: Seed roles and permissions if tables are empty
export async function POST() {
  const supabase = await createClient();

  try {
    // Check if roles already exist
    const { data: existingRoles } = await supabase.from("roles").select("id").limit(1);
    if (existingRoles && existingRoles.length > 0) {
      return NextResponse.json({ message: "Les données existent déjà.", seeded: false });
    }

    // 1. Insert Roles
    const { error: rolesErr } = await supabase.from("roles").upsert([
      { id: 1, role_name: "Administrateur", description: "Accès complet à toutes les fonctionnalités" },
      { id: 2, role_name: "Vendeur", description: "Accès aux modules de vente et de suivi client" },
      { id: 3, role_name: "Magasinier", description: "Accès à la gestion du stock et des achats" },
    ], { onConflict: "id" });

    if (rolesErr) throw rolesErr;

    // 2. Insert Permissions
    const permissionsList = [
      { permission_key: "sale.dashboard", description: "Accéder au Tableau de Bord" },
      { permission_key: "pos.access", description: "Accéder au Point de Vente (POS)" },
      { permission_key: "sale.invoice_create", description: "Créer des Factures" },
      { permission_key: "sale.bl_create", description: "Créer des Bons de Livraison" },
      { permission_key: "sale.proforma_create", description: "Créer des Factures Proforma" },
      { permission_key: "sale.order_create", description: "Créer des Commandes" },
      { permission_key: "sale.invoices_view", description: "Voir la Liste des Factures" },
      { permission_key: "sale.bl_view", description: "Voir la Liste des Bons de Livraison" },
      { permission_key: "sale.orders_view", description: "Voir la Liste des Commandes" },
      { permission_key: "sale.receipts_view", description: "Voir la Liste des Reçus" },
      { permission_key: "client.access", description: "Gérer les Clients" },
      { permission_key: "supplier.access", description: "Gérer les Fournisseurs" },
      { permission_key: "stock.articles", description: "Gérer les Articles" },
      { permission_key: "stock.inventory", description: "Gérer les Inventaires" },
      { permission_key: "stock.adjustment", description: "Ajuster le Stock" },
      { permission_key: "stock.journal", description: "Voir le Journal de Stock" },
      { permission_key: "stock.transfer", description: "Transférer le Stock entre Dépôts" },
      { permission_key: "supplier.purchases", description: "Enregistrer des Achats" },
      { permission_key: "expense.access", description: "Gérer les Dépenses" },
      { permission_key: "expense.cash_balance", description: "Voir le Bilan de Caisse" },
      { permission_key: "report.sales", description: "Voir le Rapport des Ventes" },
      { permission_key: "report.receipts", description: "Voir le Rapport des Recettes" },
      { permission_key: "report.stock_valuation", description: "Voir la Valorisation du Stock" },
      { permission_key: "report.activity_log", description: "Voir le Journal d'Activité Système" },
      { permission_key: "admin.users", description: "Gérer les Utilisateurs" },
      { permission_key: "admin.permissions", description: "Gérer les Rôles et Permissions" },
      { permission_key: "admin.settings", description: "Modifier les Paramètres du Système" },
      { permission_key: "admin.backup", description: "Sauvegarder et Restaurer les Données" },
      { permission_key: "admin.db_tool", description: "Utiliser l'Outil SQL et DB Admin" },
      { permission_key: "deposit.access", description: "Gérer les Dépôts / Acomptes" },
      { permission_key: "pos.discount", description: "Appliquer des Remises au POS" },
      { permission_key: "pos.cancel_sale", description: "Annuler des Ventes au POS" },
      { permission_key: "client.credit_view", description: "Voir les Crédits Clients" },
      { permission_key: "client.credit_manage", description: "Gérer les Crédits Clients" },
      { permission_key: "user.profile_edit", description: "Modifier son Propre Profil" },
      { permission_key: "vehicles.access", description: "Accéder à la Gestion des Véhicules" },
      { permission_key: "rent.access", description: "Accéder à la Gestion des Loyers" },
      { permission_key: "cement.access", description: "Accéder à la Gestion du Ciment" },
    ];

    const { error: permsErr } = await supabase
      .from("permissions")
      .upsert(permissionsList, { onConflict: "permission_key" });

    if (permsErr) throw permsErr;

    // 3. Grant all permissions to Admin role
    const { data: allPerms } = await supabase.from("permissions").select("id");
    if (allPerms) {
      const adminPerms = allPerms.map(p => ({ role_id: 1, permission_id: p.id }));
      await supabase.from("role_permissions").upsert(adminPerms, { onConflict: "role_id,permission_id" });
    }

    // 4. Grant sales-related permissions to Vendeur role
    const { data: vendeurPerms } = await supabase
      .from("permissions")
      .select("id")
      .in("permission_key", [
        "sale.dashboard", "pos.access", "sale.invoice_create", "sale.bl_create",
        "sale.proforma_create", "sale.order_create", "sale.invoices_view", "sale.bl_view",
        "sale.orders_view", "sale.receipts_view", "client.access", "deposit.access",
        "client.credit_view", "user.profile_edit", "pos.discount"
      ]);

    if (vendeurPerms) {
      const vPerms = vendeurPerms.map(p => ({ role_id: 2, permission_id: p.id }));
      await supabase.from("role_permissions").upsert(vPerms, { onConflict: "role_id,permission_id" });
    }

    // 5. Grant stock-related permissions to Magasinier role
    const { data: magPerms } = await supabase
      .from("permissions")
      .select("id")
      .in("permission_key", [
        "sale.dashboard", "stock.articles", "stock.inventory", "stock.adjustment",
        "stock.journal", "stock.transfer", "supplier.purchases", "supplier.access",
        "user.profile_edit"
      ]);

    if (magPerms) {
      const mPerms = magPerms.map(p => ({ role_id: 3, permission_id: p.id }));
      await supabase.from("role_permissions").upsert(mPerms, { onConflict: "role_id,permission_id" });
    }

    return NextResponse.json({ success: true, message: "Rôles et permissions initialisés avec succès !", seeded: true });
  } catch (err: any) {
    console.error("Seed error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
