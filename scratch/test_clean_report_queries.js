const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Testing clean fQuery (factures)...");
  const { data: fData, error: fErr } = await supabase
    .from("factures")
    .select("id, date_facture, bl_number, total_ttc, montant_paye, montant_restant, vendeur, statut, clients(nom)")
    .neq("statut", "Annulée")
    .eq("is_deleted", false);

  if (fErr) console.error("❌ fQuery error:", fErr.message);
  else console.log("✅ fQuery success! Loaded invoices count:", fData.length, fData);

  console.log("\nTesting clean pQuery (paiements with factures)...");
  const { data: pData, error: pErr } = await supabase
    .from("paiements")
    .select("id, date_operation, montant_regle, moyen_reglement, reference_paiement, factures(id, bl_number, total_ttc, montant_paye, montant_restant, statut, vendeur)")
    .neq("moyen_reglement", "Crédit");

  if (pErr) console.error("❌ pQuery error:", pErr.message);
  else console.log("✅ pQuery success! Loaded payments count:", pData.length, pData);
}

main();
