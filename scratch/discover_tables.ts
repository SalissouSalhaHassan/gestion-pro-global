import { createClient } from './lib/supabase/client';

const supabase = createClient();

async function listTables() {
    // This is a hacky way to get table names if the user has permissions
    const { data, error } = await supabase.rpc('get_tables');
    if (error) console.error(error);
    else console.log(data);
}

// Alternatively, try to fetch from common names
const tables = ['profiles', 'users', 'utilisateurs', 'staff', 'employees'];
tables.forEach(async (t) => {
    const { data, error } = await supabase.from(t).select('count', { count: 'exact', head: true });
    if (!error) console.log(`Table exists: ${t}`);
});
