
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking "contrats" table columns...');
  // We can't directly list columns with JS SDK easily without a query
  // Let's just try to fetch one row and see the keys
  const { data, error } = await supabase.from('contrats').select('*').limit(1);
  if (error) {
    console.error('Error fetching from contrats:', error);
    return;
  }
  if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]));
  } else {
    console.log('Table is empty. Trying to find column names via RPC or just guessing.');
    // Fallback: try to insert a dummy row and see what fails? No.
    // Let's try to select from information_schema via RPC if available, 
    // but usually it's not.
  }
}

checkSchema();
