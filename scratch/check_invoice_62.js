
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInvoice62() {
  const { data, error } = await supabase.from('factures').select('*').eq('id', 62).single();
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Invoice 62:', JSON.stringify(data, null, 2));
}

checkInvoice62();
