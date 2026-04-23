
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmplacements() {
  const { data, error } = await supabase.from('factures').select('emplacement, id').limit(100);
  if (error) {
    console.error('Error:', error);
    return;
  }
  const counts = {};
  data.forEach(r => {
    counts[r.emplacement] = (counts[r.emplacement] || 0) + 1;
  });
  console.log('Emplacement counts:', counts);
}

checkEmplacements();
