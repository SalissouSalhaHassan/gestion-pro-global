
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listInvoices() {
  const { data, error } = await supabase
    .from('factures')
    .select('id, vendeur, emplacement, total_ttc, montant_restant, is_deleted')
    .eq('emplacement', 'BOUTIQUE SIEG')
    .limit(10);
    
  if (error) {
    console.error('Error fetching invoices:', error);
    return;
  }
  console.log('Invoices for BOUTIQUE SIEG:', JSON.stringify(data, null, 2));
}

listInvoices();
