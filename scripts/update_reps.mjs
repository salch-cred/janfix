import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabaseUrl = 'https://yhectwrnjmaxybfseadt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZWN0d3Juam1heHliZnNlYWR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgwMzI3MiwiZXhwIjoyMDk4Mzc5MjcyfQ.Zt1SokyXYdj20R5K3vL-Pmtzk9MB_5oLwRXD9vhhRvw';

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  const sql = readFileSync(resolve(__dirname, '..', 'supabase', 'migrations', 'update_representatives.sql'), 'utf8');
  const { error } = await supabase.rpc('exec_sql', { query: sql }).single();
  if (error && error.message?.includes('function "exec_sql" does not exist')) {
    // Fallback: execute statements line by line via REST
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      const { error: e } = await supabase.from('_sql_exec').select('*').limit(0);
      if (e) console.log(`Executing: ${stmt.substring(0, 80)}...`);
      // Try direct query
      const { data, error: e2 } = await supabase.rpc('exec', { sql: stmt }).single().maybeSingle();
      if (e2 && !e2.message?.includes('does not exist')) {
        console.error('Error:', e2.message);
      }
    }
    console.log('Done - execute the SQL manually in Supabase SQL Editor');
  } else if (error) {
    console.error('RPC error:', error.message);
  } else {
    console.log('Migration completed successfully');
  }
  
  // Verify: check representatives count
  const { data: reps, error: repsErr } = await supabase.from('representatives').select('id, name, role, photo_url', { count: 'exact', head: false });
  if (!repsErr) {
    console.log(`\nRemaining representatives: ${reps.length}`);
    reps.forEach(r => console.log(`  - ${r.name} (${r.role}) photo: ${r.photo_url || 'none'}`));
  }
  
  const { data: auths, error: authsErr } = await supabase.from('authorities').select('id, name, slug, logo_url', { count: 'exact', head: false });
  if (!authsErr) {
    console.log(`\nAuthorities:`);
    auths.forEach(a => console.log(`  - ${a.name} (${a.slug}) logo: ${a.logo_url || 'none'}`));
  }
}

run().catch(console.error);
