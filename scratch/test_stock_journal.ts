import { createClient } from "@/lib/supabase/client";

async function testJournalCalculations() {
    const supabase = createClient();
    const testDate = new Date().toISOString().split('T')[0];
    
    console.log(`--- Testing Stock Journal for ${testDate} ---`);
    
    const res = await fetch(`http://localhost:3000/api/stock/journal?date=${testDate}`);
    const data = await res.json();
    
    if (data.error) {
        console.error("API Error:", data.error);
        return;
    }
    
    console.log(`Found ${data.items.length} articles.`);
    
    const problematic = data.items.filter((item: any) => {
        const expectedApres = item.avant + item.variation;
        return Math.abs(expectedApres - item.apres) > 0.001;
    });
    
    if (problematic.length > 0) {
        console.error("❌ Calculation mismatch found for articles:");
        problematic.forEach((p: any) => {
            console.log(`Ref: ${p.reference} | Avant: ${p.avant} | Var: ${p.variation} | Apres: ${p.apres} (Expected: ${p.avant + p.variation})`);
        });
    } else {
        console.log("✅ All calculations are mathematically consistent (Avant + Variation = Après Stock).");
    }
    
    // Cross-verify with current stock for today
    console.log("--- Verifying against current live stock ---");
    const { data: liveStocks } = await supabase.from("stocks").select("article_id, quantite");
    
    let liveMatchCount = 0;
    data.items.forEach((item: any) => {
        const live = liveStocks?.find(s => s.article_id === item.id);
        if (live && Math.abs(Number(live.quantite) - item.apres) < 0.001) {
            liveMatchCount++;
        }
    });
    
    console.log(`Matched ${liveMatchCount} / ${data.items.length} articles with live stock levels.`);
}

// testJournalCalculations();
