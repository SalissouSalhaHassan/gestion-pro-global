const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Testing complete direct POS checkout workflow with date_operation...");

  const clientId = 1;
  const items = [{ id: 1, quantite: 10, prix: 2400 }];
  const totalTTC = 24000;
  const totalHT = 24000;
  const totalTVA = 0;
  const blNumber = `FA-TEST-FLOW-${Date.now()}`;

  // 1. Insert Facture
  const { data: inv, error: invErr } = await supabase.from('factures').insert([{
    client_id: clientId,
    vendeur: 'admin',
    total_ht: totalHT,
    total_ttc: totalTTC,
    total_tva: totalTVA,
    montant_paye: totalTTC,
    montant_restant: 0,
    statut: 'Payée',
    nbr_art: items.length,
    bl_number: blNumber,
    date_facture: new Date().toISOString(),
    is_deleted: true, // test record marked deleted
  }]).select('id').single();

  if (invErr) {
    console.error("❌ Facture insert error:", invErr.message);
    return;
  }
  console.log("✅ 1. Facture created with ID:", inv.id);

  // 2. Insert Facture Items
  const { error: itemsErr } = await supabase.from('facture_items').insert([{
    facture_id: inv.id,
    article_id: items[0].id,
    qte: items[0].quantite,
    pu_ht: items[0].prix,
    pu_ttc: items[0].prix,
    total_item_ht: totalHT,
    total_item_ttc: totalTTC,
    taux_tva_item: 0,
    montant_tva_item: 0,
  }]);

  if (itemsErr) {
    console.error("❌ Facture items error:", itemsErr.message);
    return;
  }
  console.log("✅ 2. Facture items inserted successfully");

  // 3. Insert Paiement
  const { error: payErr } = await supabase.from('paiements').insert([{
    facture_id: inv.id,
    date_operation: new Date().toISOString(),
    montant_regle: totalTTC,
    moyen_reglement: 'Cash',
    reference_paiement: `REG-${inv.id}`,
  }]);

  if (payErr) {
    console.error("❌ Paiement insert error:", payErr.message);
    return;
  }
  console.log("✅ 3. Paiement recorded successfully");

  // Cleanup
  await supabase.from('paiements').delete().eq('facture_id', inv.id);
  await supabase.from('facture_items').delete().eq('facture_id', inv.id);
  await supabase.from('factures').delete().eq('id', inv.id);
  console.log("✅ 4. All test data cleaned up cleanly!");
}

main();
