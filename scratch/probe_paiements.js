const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Testing columns in paiements table...");
  const cols = ['id', 'facture_id', 'date_paiement', 'montant_regle', 'moyen_reglement', 'caissier', 'reference_paiement', 'is_deleted'];
  for (const c of cols) {
    const { error } = await supabase.from('paiements').select(c).limit(1);
    if (error) console.log(`❌ paiements column '${c}' DOES NOT EXIST:`, error.message);
    else console.log(`✅ paiements column '${c}' EXISTS`);
  }
}

main();
