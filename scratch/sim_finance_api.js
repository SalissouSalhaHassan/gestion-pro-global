const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Simulating full Finance Dashboard API logic...");

  // 1. Fetch Invoices
  const { data: invoices, error: invErr } = await supabase
    .from("factures")
    .select("id, bl_number, date_facture, total_ht, total_ttc, montant_paye, montant_restant, statut, vendeur, clients(id, nom, tel, ref_client)")
    .neq("statut", "Annulée")
    .eq("is_deleted", false)
    .order("id", { ascending: false });

  if (invErr) {
    console.error("❌ Factures query failed:", invErr.message);
    return;
  }

  // 2. Fetch Payments
  const { data: payments } = await supabase
    .from("paiements")
    .select("id, date_operation, montant_regle, moyen_reglement, reference_paiement, factures(id, bl_number, total_ttc, clients(nom))")
    .order("id", { ascending: false });

  // 3. Fetch Expenses
  const { data: expenses } = await supabase
    .from("depenses")
    .select("id, date_depense, montant, operateur, no_caisse");

  // 4. Fetch Clients
  const { data: clients } = await supabase
    .from("clients")
    .select("id, nom, tel, credit_facture, credit_bl")
    .eq("is_deleted", false);

  const totalAttendu = (invoices || []).reduce((acc, f) => acc + Number(f.total_ttc || 0), 0);
  const totalEncaisse = (invoices || []).reduce((acc, f) => acc + Number(f.montant_paye || 0), 0);
  const totalImpaye = (invoices || []).reduce((acc, f) => acc + Math.max(0, Number(f.montant_restant || 0)), 0);
  const totalDepenses = (expenses || []).reduce((acc, e) => acc + Number(e.montant || 0), 0);
  const soldeActuel = totalEncaisse - totalDepenses;

  console.log("Summary Metrics:", {
    totalAttendu,
    totalEncaisse,
    totalImpaye,
    totalDepenses,
    soldeActuel,
    invoicesCount: invoices.length,
    paymentsCount: payments?.length || 0,
  });
}

main();
