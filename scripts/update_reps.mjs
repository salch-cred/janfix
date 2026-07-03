import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env
try {
  const envPath = resolve(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !key.startsWith('#')) {
        process.env[key] = val;
      }
    }
  });
} catch (e) {
  // Ignore missing .env
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.');
  process.exit(1);
}

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
