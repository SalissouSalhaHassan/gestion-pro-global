import { createClient } from './lib/supabase/client';

const supabase = createClient();

async function checkData() {
  console.log("Checking roles...");
  const { data: roles, error: roleError } = await supabase.from('roles').select('*');
  if (roleError) console.error("Role error:", roleError.message);
  else console.log("Roles found:", roles);

  console.log("Checking users...");
  const { data: users, error: userError } = await supabase.from('users').select('*, roles(*)');
  if (userError) console.error("User error:", userError.message);
  else console.log("Users found:", users);
}

checkData();
