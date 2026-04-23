
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findStock() {
  const { data, error } = await supabase
    .from('stocks')
    .select('article_id, quantite, depot_nom')
    .eq('depot_nom', 'BOUTIQUE SIEG')
    .gt('quantite', 0)
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Stock item:', JSON.stringify(data[0], null, 2));
}

findStock();
