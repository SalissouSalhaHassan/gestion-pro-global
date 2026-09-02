const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Testing top products query...");
  const { data: items, error: iErr } = await supabase
    .from("facture_items")
    .select("article_id, qte, articles(designation), factures!inner(is_deleted, date_facture, vendeur)")
    .eq("factures.is_deleted", false);

  if (iErr) {
    console.error("❌ Error querying facture_items:", iErr.message);
  } else {
    console.log("✅ Success! Facture items loaded:", items.length, items);
  }

  console.log("\nTesting top sellers query (instead of non-existent emplacement)...");
  const { data: facts, error: fErr } = await supabase
    .from("factures")
    .select("vendeur, total_ttc")
    .eq("is_deleted", false);

  if (fErr) {
    console.error("❌ Error querying factures:", fErr.message);
  } else {
    console.log("✅ Success! Factures by seller loaded:", facts.length, facts);
  }
}

main();
