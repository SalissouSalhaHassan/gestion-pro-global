const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Checking if 'voitures' exists...");
  const { data, error } = await supabase.from('voitures').select('*').limit(1);
  if (error) {
    console.log("Error querying voitures:", error.message);
  } else {
    console.log("Voitures table query success:", data);
  }
}

main();
