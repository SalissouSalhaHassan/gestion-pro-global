const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Testing clean finance queries...");
  
  // 1. Factures
  const { data: invs, error: invErr } = await supabase
    .from("factures")
    .select("id, bl_number, date_facture, total_ht, total_ttc, montant_paye, montant_restant, statut, vendeur, clients(id, nom, tel, ref_client)")
    .neq("statut", "Annulée")
    .eq("is_deleted", false);

  if (invErr) console.error("❌ Factures error:", invErr.message);
  else console.log("✅ Factures success:", invs.length, invs);

  // 2. Paiements
  const { data: pays, error: payErr } = await supabase
    .from("paiements")
    .select("id, date_operation, montant_regle, moyen_reglement, reference_paiement, factures(id, bl_number, total_ttc, clients(nom))");

  if (payErr) console.error("❌ Paiements error:", payErr.message);
  else console.log("✅ Paiements success:", pays.length, pays);

  // 3. Depenses
  const { data: exps, error: expErr } = await supabase
    .from("depenses")
    .select("id, date_depense, montant, motif, operateur");

  if (expErr) console.error("❌ Depenses error:", expErr.message);
  else console.log("✅ Depenses success:", exps.length);
}

main();
