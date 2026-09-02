const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Checking factures table schema in Supabase...");
  
  const { data, error } = await supabase.from('factures').select('*').limit(1);
  if (error) {
    console.error("Error reading factures:", error);
  } else {
    console.log("Factures table sample row keys:", data.length > 0 ? Object.keys(data[0]) : "Empty table");
  }
}

main();
