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
    .like('nr_doc', 'MOB-%')
    .limit(10);
    
  if (error) {
    console.error('Error fetching movements:', error);
    return;
  }
  
  console.log(`Found ${movements.length} MOB- movements:`);
  movements.forEach(m => {
    console.log(JSON.stringify(m, null, 2));
  });
}

main();
