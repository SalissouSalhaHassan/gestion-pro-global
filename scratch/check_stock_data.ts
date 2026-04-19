import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStockData() {
  console.log("Checking User depots...");
  const { data: users } = await supabase.from("users").select("id, utilisateur, emplacement, admin");
  console.log("Users:", users);

  console.log("\nChecking Stocks...");
  const { data: stocks } = await supabase.from("stocks").select("depot_nom").limit(10);
  console.log("Stocks (depot_nom):", stocks?.map(s => s.depot_nom));

  console.log("\nChecking Articles join example...");
  const { data: artJoin } = await supabase
    .from("articles")
    .select("id, designation, stocks(quantite, depot_nom)")
    .limit(3);
  console.log("Articles with stocks:", JSON.stringify(artJoin, null, 2));
}

checkStockData();
