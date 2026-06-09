const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: movements, error } = await supabase
    .from('mouvements')
    .select('*')
    .limit(10);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Sample movements fields:');
  movements.forEach(m => {
    console.log(`Type: ${m.type} | quantite: ${m.quantite} | entree: ${m.entree} | sortie: ${m.sortie} | stock_avant: ${m.stock_avant} | stock_apres: ${m.stock_apres}`);
  });
}

main();
