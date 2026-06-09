const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ktunkjugqpebsdrvorka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0dW5ranVncXBlYnNkcnZvcmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjYzMzUsImV4cCI6MjA5MTkwMjMzNX0.wrYZU8XCCwUSxxyidbrQXPxVNaDNNWc5gfR1ZPMljYc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentInvoices() {
  const { data, error } = await supabase
    .from('factures')
    .select('id, bl_number, vendeur, total_ttc, date_facture, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Recent Invoices:', JSON.stringify(data, null, 2));
}

checkRecentInvoices();
