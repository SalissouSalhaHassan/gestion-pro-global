const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ktunkjugqpebsdrvorka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0dW5ranVncXBlYnNkcnZvcmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjYzMzUsImV4cCI6MjA5MTkwMjMzNX0.wrYZU8XCCwUSxxyidbrQXPxVNaDNNWc5gfR1ZPMljYc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminUser() {
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, utilisateur')
    .ilike('utilisateur', 'admin');

  console.log('Admin Users:', JSON.stringify(users, null, 2));

  if (users && users.length > 0) {
    const adminId = users[0].id;
    const { data: invoices, error: invError } = await supabase
      .from('factures')
      .select('*')
      .eq('user_id', adminId)
      .gte('created_at', '2026-04-30T00:00:00Z');
    
    console.log('Invoices for Admin Today:', JSON.stringify(invoices, null, 2));
  }
}

checkAdminUser();
