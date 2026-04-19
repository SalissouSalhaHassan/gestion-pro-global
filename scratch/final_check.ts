import { createClient } from './lib/supabase/client';

const supabase = createClient();

async function checkAuthAndRoles() {
  console.log("--- Checking Roles ---");
  const { data: roles, error: rErr } = await supabase.from('roles').select('*');
  if (rErr) {
    console.error("Error fetching roles:", rErr.message);
  } else {
    console.log("Found roles:", roles.length);
    console.log(roles);
  }

  console.log("--- Checking Users ---");
  const { data: users, error: uErr } = await supabase.from('users').select('count');
  if (uErr) {
    console.error("Error fetching users:", uErr.message);
  } else {
    console.log("Found users count:", users);
  }
}

checkAuthAndRoles();
