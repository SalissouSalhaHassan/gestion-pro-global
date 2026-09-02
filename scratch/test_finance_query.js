const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Testing invoice query from finance route...");
  const { data: invs, error: invErr } = await supabase
    .from("factures")
    .select("id, bl_number, date_facture, total_ht, total_ttc, montant_paye, montant_restant, statut, mode_paiement, vendeur, emplacement, clients(id, nom, tel, ref_client)");

  if (invErr) {
    console.error("❌ Error in finance invoice query:", invErr.message);
  } else {
    console.log("✅ Success! Loaded invoices:", invs.length);
  }
}

main();
