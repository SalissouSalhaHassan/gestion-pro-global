const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ktunkjugqpebsdrvorka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0dW5ranVncXBlYnNkcnZvcmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjYzMzUsImV4cCI6MjA5MTkwMjMzNX0.wrYZU8XCCwUSxxyidbrQXPxVNaDNNWc5gfR1ZPMljYc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAnyInvoiceToday() {
  const { data, error } = await supabase
    .from('factures')
    .select('*')
    .gte('created_at', '2026-04-30T00:00:00Z');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('ALL Invoices Today:', JSON.stringify(data, null, 2));
}

checkAnyInvoiceToday();
