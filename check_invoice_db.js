const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ktunkjugqpebsdrvorka.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0dW5ranVncXBlYnNkcnZvcmthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMjYzMzUsImV4cCI6MjA5MTkwMjMzNX0.wrYZU8XCCwUSxxyidbrQXPxVNaDNNWc5gfR1ZPMljYc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInvoice() {
  const { data, error } = await supabase
    .from('factures')
    .select('*')
    .eq('bl_number', 'MOB-97134')
    .maybeSingle();

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data) {
    console.log('Invoice Found:', JSON.stringify(data, null, 2));
  } else {
    console.log('Invoice NOT found in DB');
  }
}

checkInvoice();
