const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Testing depenses columns...");
  const cols = ['id', 'date_depense', 'montant', 'designation', 'description', 'motif', 'categorie', 'operateur', 'no_caisse'];
  for (const c of cols) {
    const { error } = await supabase.from('depenses').select(c).limit(1);
    if (!error) console.log(`✅ depenses column '${c}' EXISTS`);
    else console.log(`❌ depenses column '${c}' DOES NOT EXIST:`, error.message);
  }
}

main();
