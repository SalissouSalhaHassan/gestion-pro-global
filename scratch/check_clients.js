const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Checking / adding created_by column in clients table...");
  
  // Try selecting created_by
  const { data, error } = await supabase.from('clients').select('id, nom, created_by').limit(1);
  if (error) {
    console.log("Error querying created_by:", error.message);
    
    // Call RPC or execute SQL if available, or test insert without created_by
    console.log("Adding created_by fallback is crucial!");
  } else {
    console.log("created_by column is accessible!", data);
  }
}

main();
