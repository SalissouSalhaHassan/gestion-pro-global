const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('inspect_triggers');
  
  if (error) {
    // If inspect_triggers RPC doesn't exist, we can query pg_trigger directly if we can, but since rpc is limited,
    // let's try querying pg_catalog via an sql execution or check if we can query it another way.
    // Let's run a query on pg_trigger using a custom function or see what functions exist in the DB.
    console.error('RPC Error:', error);
    
    // Let's try querying a list of functions or triggers using standard tables if allowed
    const { data: dbObjects, error: dbErr } = await supabase
      .from('pg_trigger')
      .select('*')
      .limit(5);
    console.log('Direct query pg_trigger:', dbErr || dbObjects);
    return;
  }
  
  console.log('Triggers:', data);
}

main();
