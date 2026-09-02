const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const columnsToTest = [
    'id', 'client_id', 'user_id', 'date_facture', 'total_ht', 'total_tva', 
    'total_ttc', 'montant_paye', 'montant_restant', 'statut', 'vendeur', 
    'emplacement', 'depot_id', 'depot_nom', 'moyen_reglement', 'nbr_art', 
    'bl_number', 'is_deleted', 'created_at', 'updated_at'
  ];

  console.log("Testing which columns exist in factures table...");
  for (const col of columnsToTest) {
    const { data, error } = await supabase.from('factures').select(col).limit(1);
    if (error) {
      console.log(`❌ Column '${col}' DOES NOT EXIST:`, error.message);
    } else {
      console.log(`✅ Column '${col}' EXISTS`);
    }
  }

  console.log("\nTesting which columns exist in facture_items table...");
  const itemCols = ['id', 'facture_id', 'article_id', 'qte', 'pu_ht', 'pu_ttc', 'total_item_ht', 'total_item_ttc', 'taux_tva_item', 'montant_tva_item', 'designation'];
  for (const col of itemCols) {
    const { data, error } = await supabase.from('facture_items').select(col).limit(1);
    if (error) {
      console.log(`❌ facture_items column '${col}' DOES NOT EXIST:`, error.message);
    } else {
      console.log(`✅ facture_items column '${col}' EXISTS`);
    }
  }
}

main();
