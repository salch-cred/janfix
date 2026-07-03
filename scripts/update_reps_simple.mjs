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
  // 1. Delete corporators
  const { data: deleted, error: delErr } = await supabase
    .from('representatives')
    .delete()
    .eq('role', 'corporator')
    .select('count');
  if (delErr) {
    console.error('Delete error:', delErr.message);
  } else {
    console.log('Deleted corporators. Count:', deleted);
  }

  // 2. Update authorities with logos
  const updates = [
    { slug: 'mcc', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/India_Mangalore_City_Corporation_2023.svg/320px-India_Mangalore_City_Corporation_2023.svg.png' },
    { slug: 'mescom', logo_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ7eICx1w2JA61YQ71Wqw9Czj8t1p7VOhGHfw&s' },
    { slug: 'traffic-police', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Karnataka_Police_logo.png/320px-Karnataka_Police_logo.png' },
  ];
  for (const u of updates) {
    const { error: e } = await supabase.from('authorities').update({ logo_url: u.logo_url }).eq('slug', u.slug);
    if (e) console.error(`Update ${u.slug} error:`, e.message);
    else console.log(`Updated ${u.slug} logo`);
  }

  // 3. Update representatives with photos
  const repUpdates = [
    { name: 'Brijesh Chowta', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Captain_Brijesh_Chowta_official_portrait.jpg/320px-Captain_Brijesh_Chowta_official_portrait.jpg' },
    { name: 'Vedavyas', photo_url: 'https://cf-images.assettype.com/newindianexpress/2025-03-04/zcz6wfi0/New-Project-2025-03-04T075250.394.jpg' },
    { name: 'Bharath Shetty', photo_url: 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Bharath%20Shetty%20Y..jpg' },
    { name: 'Umanath', photo_url: 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Umanatha%20Kotian.jpg' },
    { name: 'Ashok Kumar Rai', photo_url: 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Ashok%20Kumar%20Rai.jpg' },
    { name: 'Bhagirathi', photo_url: 'https://images.news9live.com/wp-content/uploads/2023/05/New-Project-2023-05-15T184542.472.jpg' },
    { name: 'Harish Poonja', photo_url: 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Harish%20Poonja.jpg' },
    { name: 'UT Khader', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/UT_Khader.jpg' },
    { name: 'Rajesh Naik', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3a/U_Rajesh_Naik.jpg' },
    { name: 'Manja', photo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Manja.jpg/320px-Manja.jpg' },
  ];
  for (const u of repUpdates) {
    const { error: e } = await supabase.from('representatives').update({ photo_url: u.photo_url }).ilike('name', `%${u.name}%`);
    if (e) console.error(`Update ${u.name} error:`, e.message);
    else console.log(`Updated ${u.name} photo`);
  }

  // Verify
  const { data: reps } = await supabase.from('representatives').select('id, name, role, photo_url');
  if (reps) {
    console.log(`\nRemaining representatives (${reps.length}):`);
    reps.forEach(r => console.log(`  ${r.id}: ${r.name} (${r.role})`));
  }
  
  const { data: auths } = await supabase.from('authorities').select('id, name, slug, logo_url');
  if (auths) {
    console.log(`\nAuthorities:`);
    auths.forEach(a => console.log(`  ${a.id}: ${a.name} - logo: ${a.logo_url ? 'set' : 'none'}`));
  }
}

run().catch(console.error);
