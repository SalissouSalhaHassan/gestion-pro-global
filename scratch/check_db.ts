import { createClient } from './lib/supabase/client';

const supabase = createClient();

async function testConnection() {
  console.log("Checking tables...");
  
  const { data: users, error: userError } = await supabase.from('users').select('count', { count: 'exact', head: true });
  if (userError) {
    console.error("User table error:", userError.message);
  } else {
    console.log("User table exists. Count:", users);
  }

  const { data: roles, error: roleError } = await supabase.from('roles').select('count', { count: 'exact', head: true });
  if (roleError) {
    console.error("Role table error:", roleError.message);
  } else {
    console.log("Role table exists. Count:", roles);
  }
}

testConnection();
