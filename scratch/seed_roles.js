const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://mxairvfgklibhamkpeqq.supabase.co';
const SERVICE_KEY = 'sb_secret_Bj4CF6U_1aAwYu3DlLQuNg_XWQwE_N0';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("Seeding standard roles into Supabase...");
  const roles = [
    { id: 1, role_name: "Admin", description: "Administrateur Général / Super Admin" },
    { id: 2, role_name: "Manager", description: "Directeur Commercial / Manager Général" },
    { id: 3, role_name: "Gérant de Dépôt", description: "Responsable de Magasin / Dépôt" },
    { id: 4, role_name: "Caissier", description: "Caissier / Vendeur POS" },
    { id: 5, role_name: "Comptable", description: "Comptable / Auditeur Financier" },
    { id: 6, role_name: "Livreur", description: "Chauffeur / Responsable Livraisons" },
  ];

  for (const r of roles) {
    const { data, error } = await supabase.from('roles').upsert(r, { onConflict: 'id' });
    if (error) {
      console.log(`Error upserting role ${r.role_name}:`, error.message);
    } else {
      console.log(`Role ${r.role_name} upserted successfully.`);
    }
  }

  const { data: allRoles } = await supabase.from('roles').select('*');
  console.log("Current roles in DB:", allRoles);
}

main();
