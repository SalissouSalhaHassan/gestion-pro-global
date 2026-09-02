const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Testing clean insert into factures...");
  
  const payload = {
    client_id: 1,
    vendeur: 'Caisse Test',
    total_ht: 24000,
    total_ttc: 24000,
    total_tva: 0,
    montant_paye: 24000,
    montant_restant: 0,
    statut: 'Payée',
    nbr_art: 1,
    bl_number: `FA-2026-TEST1`,
    date_facture: new Date().toISOString(),
    is_deleted: true, // test record marked deleted
  };

  const { data, error } = await supabase.from('factures').insert([payload]).select().single();
  if (error) {
    console.error("❌ Facture insert failed:", error.message);
  } else {
    console.log("✅ Facture created successfully with ID:", data.id);

    // Clean up test record
    await supabase.from('factures').delete().eq('id', data.id);
    console.log("✅ Cleaned up test record.");
  }
}

main();
