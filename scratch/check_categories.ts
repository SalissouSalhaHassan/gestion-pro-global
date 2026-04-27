import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
  console.log("--- Checking Categories ---");
  const { data: cats, error: catError } = await supabase.from("categories").select("*");
  if (catError) {
    console.error("Error fetching categories:", catError);
  } else {
    console.log(`Found ${cats?.length} categories:`, cats);
  }

  console.log("\n--- Checking Articles Category Distribution ---");
  const { data: arts, error: artError } = await supabase.from("articles").select("id, designation, categorie_id").limit(10);
  if (artError) {
    console.error("Error fetching articles:", artError);
  } else {
    console.log("Articles sample:", arts);
  }
}

checkCategories();
