
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  const filter = 'user_id.eq.5,created_by.eq.5,vendeur.eq."KADER",emplacement.eq."BOUTIQUE SIEG"';
  console.log('Testing filter:', filter);
  
  const { data, error } = await supabase
    .from('factures')
    .select('*')
    .eq('id', 65)
    .or(filter);
    
  if (error) {
    console.error('Query Error:', error);
    return;
  }
  console.log('Results:', data.length);
  if (data.length > 0) {
    console.log('Found:', data[0].id, data[0].vendeur, data[0].emplacement);
  } else {
    console.log('No results found for ID 65 with this filter.');
  }
}

testQuery();
