const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Checking factures in database...");
  const { data: facts, error: fErr } = await supabase
    .from('factures')
    .select('id, bl_number, date_facture, total_ttc, montant_paye, montant_restant, statut, vendeur')
    .limit(10);
  console.log("Factures count:", facts ? facts.length : 0, fErr ? fErr.message : facts);

  console.log("\nChecking paiements in database...");
  const { data: pays, error: pErr } = await supabase
    .from('paiements')
    .select('*')
    .limit(10);
  console.log("Paiements count:", pays ? pays.length : 0, pErr ? pErr.message : pays);

  console.log("\nChecking avances_clients in database...");
  const { data: advs, error: aErr } = await supabase
    .from('avances_clients')
    .select('*')
    .limit(10);
  console.log("Avances count:", advs ? advs.length : 0, aErr ? aErr.message : advs);
}

main();
