const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  const { data, error } = await supabase
    .from('achats')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching achats:', error);
  } else {
    console.log('Columns in achats:', Object.keys(data[0] || {}));
  }
}

checkColumns();
