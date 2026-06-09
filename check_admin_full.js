const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ktunkjugqpebsdrvorka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0dW5ranVncXBlYnNkcnZvcmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjYzMzUsImV4cCI6MjA5MTkwMjMzNX0.wrYZU8XCCwUSxxyidbrQXPxVNaDNNWc5gfR1ZPMljYc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('utilisateur', 'admin');

  console.log('Admin Details:', JSON.stringify(data, null, 2));
}

checkAdmin();
