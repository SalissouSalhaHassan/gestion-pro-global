
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findActiveInvoice() {
  const { data, error } = await supabase
    .from('factures')
    .select('id, vendeur, emplacement, total_ttc, montant_restant')
    .eq('is_deleted', false)
    .gt('montant_restant', 0)
    .limit(10);
    
  if (error) {
    console.error('Error fetching invoices:', error);
    return;
  }
  console.log('Active invoices:', JSON.stringify(data, null, 2));
}

findActiveInvoice();
