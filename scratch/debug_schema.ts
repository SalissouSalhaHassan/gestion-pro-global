import { createClient } from './lib/supabase/client';

const supabase = createClient();

async function debugSchema() {
  console.log("--- ROLES ---");
  const { data: roles, error: rErr } = await supabase.from('roles').select('*');
  if (rErr) console.error("Roles fetch error:", rErr.message);
  else console.log(roles);

  console.log("--- USERS (Sample) ---");
  const { data: users, error: uErr } = await supabase.from('users').select('*, roles(*)').limit(1);
  if (uErr) {
    console.error("Users join error:", uErr.message);
    console.log("Trying users join with role_id...");
    const { data: users2, error: uErr2 } = await supabase.from('users').select('*, roles:role_id(*)').limit(1);
    if (uErr2) console.error("Users join error with role_id:", uErr2.message);
    else console.log("Join with roles:role_id worked!");
  } else {
    console.log("Join with roles worked!");
  }
}

debugSchema();
