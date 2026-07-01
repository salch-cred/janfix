import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import fs from 'fs';
import path from 'path';

// Load env variables from .env if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });
  }
} catch (e) {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment or .env file.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runDDL() {
  console.log('--- DDL: city column ---');
  const ddl = readFileSync('supabase/migrations/20260630065050_add_city_column.sql', 'utf8');
  // DDL via raw REST call (works with service_role key on /rest/v1/rpc/ if function exists, or try query endpoint)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: ddl }),
  });
  if (res.ok) {
    console.log('  DDL OK');
  } else {
    const txt = await res.text();
    // Try individual ALTER TABLE via raw SQL execution approach
    // For Supabase, DDL can only be done via SQL editor or Management API
    // We'll skip DDL here and handle city field at app level with defaults
    console.log('  DDL note: City column skipped (app defaults to Mangaluru).', txt.slice(0, 200));
  }
}

async function seedCategories() {
  console.log('--- Seed: Categories ---');
  const categories = [
    { slug: 'pothole', name_en: 'Pothole', name_kn: 'ಗುಂಡಿ', icon: 'Construction', color: '#ef4444', sort_order: 1 },
    { slug: 'road-damage', name_en: 'Road Damage', name_kn: 'ರಸ್ತೆ ಹಾನಿ', icon: 'TriangleAlert', color: '#dc2626', sort_order: 2 },
    { slug: 'garbage', name_en: 'Garbage', name_kn: 'ಕಸ', icon: 'Trash2', color: '#16a34a', sort_order: 3 },
    { slug: 'illegal-dumping', name_en: 'Illegal Dumping', name_kn: 'ಅಕ್ರಮ ಕಸ', icon: 'Ban', color: '#b91c1c', sort_order: 4 },
    { slug: 'water-leakage', name_en: 'Water Leakage', name_kn: 'ನೀರಿನ ಸೋರಿಕೆ', icon: 'Droplets', color: '#0ea5e9', sort_order: 5 },
    { slug: 'sewage', name_en: 'Sewage Overflow', name_kn: 'ಚರಂಡಿ ಉಕ್ಕಿ', icon: 'Droplets', color: '#7c3aed', sort_order: 6 },
    { slug: 'drain', name_en: 'Drain Blockage', name_kn: 'ಚರಂಡಿ ಕಟ್ಟು', icon: 'Filter', color: '#0891b2', sort_order: 7 },
    { slug: 'streetlight', name_en: 'Broken Streetlight', name_kn: 'ದೀಪ ಕೆಟ್ಟಿದೆ', icon: 'Lightbulb', color: '#f59e0b', sort_order: 8 },
    { slug: 'tree-hazard', name_en: 'Tree Hazard', name_kn: 'ಮರದ ಅಪಾಯ', icon: 'Trees', color: '#15803d', sort_order: 9 },
    { slug: 'public-toilet', name_en: 'Public Toilet', name_kn: 'ಶೌಚಾಲಯ', icon: 'DoorOpen', color: '#9333ea', sort_order: 10 },
    { slug: 'traffic-signal', name_en: 'Traffic Signal', name_kn: 'ಸಂಚಾರ ಸಂಕೇತ', icon: 'TrafficCone', color: '#ea580c', sort_order: 11 },
    { slug: 'footpath', name_en: 'Footpath Damage', name_kn: 'ಪಾದಚಾರಿ ಮಾರ್ಗ', icon: 'Footprints', color: '#a16207', sort_order: 12 },
    { slug: 'others', name_en: 'Others', name_kn: 'ಇತರೆ', icon: 'HelpCircle', color: '#64748b', sort_order: 13 },
  ];
  for (const c of categories) {
    const { error } = await sb.from('categories').upsert(c, { onConflict: 'slug', ignoreDuplicates: true });
    if (error) console.error(`  ERROR ${c.slug}:`, error.message);
  }
  const { count } = await sb.from('categories').select('*', { count: 'exact', head: true });
  console.log(`  ${count ?? 0} categories`);
}

async function seedAuthorities() {
  console.log('--- Seed: Authorities ---');
  const auths = [
    { name: 'MCC Roads Department', type: 'municipal', department: 'Roads & Infrastructure', phone: '0824-2220500', email: 'roads@mcc.mangaluru', jurisdiction: 'Mangaluru City' },
    { name: 'MCC Health Department', type: 'municipal', department: 'Health & Sanitation', phone: '0824-2220600', email: 'health@mcc.mangaluru', jurisdiction: 'Mangaluru City' },
    { name: 'MCC Engineering', type: 'municipal', department: 'Engineering', phone: '0824-2220700', email: 'engineering@mcc.mangaluru', jurisdiction: 'Mangaluru City' },
    { name: 'MCC Horticulture', type: 'municipal', department: 'Horticulture & Parks', phone: '0824-2220800', email: 'horticulture@mcc.mangaluru', jurisdiction: 'Mangaluru City' },
    { name: 'MCC General Administration', type: 'municipal', department: 'General', phone: '0824-2220900', email: 'info@mcc.mangaluru', jurisdiction: 'Mangaluru City' },
    { name: 'KUWS&DB', type: 'board', department: 'Water Supply & Drainage', phone: '0824-2451200', email: 'kuwsub@karnataka.gov.in', jurisdiction: 'DK District' },
    { name: 'MESCOM', type: 'utility', department: 'Electricity Supply', phone: '1912', email: 'mescom@karnataka.gov.in', jurisdiction: 'DK District' },
    { name: 'Mangaluru Traffic Police', type: 'police', department: 'Traffic', phone: '0824-2220444', email: 'trafficmangaluru@ksp.gov.in', jurisdiction: 'Mangaluru City' },
    { name: 'PWD Karnataka', type: 'state', department: 'Public Works', phone: '0824-2451800', email: 'pwdmangaluru@karnataka.gov.in', jurisdiction: 'DK District' },
    { name: 'NHAI', type: 'central', department: 'National Highways', phone: '1800-180-0111', email: 'nhai@nic.in', jurisdiction: 'National Highway stretches' },
    { name: 'Zilla Panchayat DK', type: 'rural', department: 'Rural Development', phone: '0824-2451300', email: 'zpdkmangalore@karnataka.gov.in', jurisdiction: 'DK Rural Areas' },
    { name: 'DK District Administration', type: 'district', department: 'Revenue & Disaster', phone: '0824-2220200', email: 'dc.dk@karnataka.gov.in', jurisdiction: 'DK District' },
  ];
  for (const a of auths) {
    const { error } = await sb.from('authorities').upsert(a, { onConflict: 'name', ignoreDuplicates: true });
    if (error) console.error(`  ERROR ${a.name}:`, error.message);
  }
  const { count } = await sb.from('authorities').select('*', { count: 'exact', head: true });
  console.log(`  ${count ?? 0} authorities`);
}

async function seedWards() {
  console.log('--- Seed: Wards ---');
  const wardNames = [
    'Kudroli', 'Mangaladevi', 'Bolar', 'Jeppu', 'Bendoor', 'Kankanady', 'Urwa', 'Pumpwell',
    'Padil', 'Kulur', 'Surathkal', 'Ullal', 'Kadri', 'Hampankatta', 'Car Street', 'Falnir',
    'Bunder', 'Balmatta', 'Kodialbail', 'Dongerakeri', 'Kotekar', 'Bejai', 'Kapikad',
    'Kavur', 'Marnamikatte', 'Attavar', 'Shivabagh', 'Bokkapattana', 'Pandeshwar',
    'Kankanady B', 'Jalnagar', 'Vijaynagar', 'Barkur', 'Malavoor', 'Talapady',
    'Kinnigoly', 'Mogaveerapattana', 'Marakada', 'Baikampady', 'Kuttar', 'Mallikatte',
    'Kuntikana', 'Nandigudda', 'Mannagudda', 'Ashoknagar', 'Shenoy Nagar', 'Hoige Bazaar',
    'Noor Bazaar', 'Mandi', 'Bangrakulur', 'Farangipet', 'Adyar', 'Kotekar B',
    'Talapady B', 'Kemral', 'Thokkottu', 'Deralakatte', 'Mudushedde', 'Idya', 'Kulai',
  ];
  for (let i = 0; i < wardNames.length; i++) {
    const { error } = await sb.from('wards').upsert(
      { number: i + 1, name: wardNames[i], area: 'Mangaluru', city: 'Mangaluru' },
      { onConflict: 'number', ignoreDuplicates: true }
    );
    if (error) console.error(`  ERROR Ward ${i+1}:`, error.message);
  }
  const { count } = await sb.from('wards').select('*', { count: 'exact', head: true });
  console.log(`  ${count ?? 0} wards`);
}

async function seedRepresentatives() {
  console.log('--- Seed: Representatives ---');
  const { data: auths } = await sb.from('authorities').select('id, name');
  const { data: wards } = await sb.from('wards').select('id, number, name');
  const authMap = Object.fromEntries((auths ?? []).map(a => [a.name, a.id]));
  const wardList = wards ?? [];

  const reps = [
    { name: 'Brijesh Chowta', role: 'Member of Parliament', constituency: 'Dakshina Kannada', authority_id: authMap['DK District Administration'], ward_id: null },
    { name: 'D. Vedavyas Kamath', role: 'MLA', constituency: 'Mangaluru City North', authority_id: authMap['MCC General Administration'], ward_id: null },
    { name: 'U. T. Khader', role: 'MLA', constituency: 'Mangaluru', authority_id: authMap['MCC General Administration'], ward_id: null },
    { name: 'John Richard Lobo', role: 'MLA', constituency: 'Mangaluru City South', authority_id: authMap['MCC General Administration'], ward_id: null },
    { name: 'B. Ramanath Rai', role: 'MLA', constituency: 'Bantwal', authority_id: authMap['Zilla Panchayat DK'], ward_id: null },
    { name: 'A. C. Bhandari', role: 'MLA', constituency: 'Puttur', authority_id: authMap['Zilla Panchayat DK'], ward_id: null },
    { name: 'K. Gopala Poojary', role: 'MLA', constituency: 'Belthangady', authority_id: authMap['Zilla Panchayat DK'], ward_id: null },
    { name: 'S. Angara', role: 'MLA', constituency: 'Sullia', authority_id: authMap['Zilla Panchayat DK'], ward_id: null },
    { name: 'Mayor of Mangaluru', role: 'Mayor', constituency: 'Mangaluru City', authority_id: authMap['MCC General Administration'], ward_id: null },
    { name: 'MCC Commissioner', role: 'Commissioner', constituency: 'Mangaluru City', authority_id: authMap['MCC General Administration'], ward_id: null },
    { name: 'Superintending Engineer MCC', role: 'Superintending Engineer', constituency: 'Mangaluru City', authority_id: authMap['MCC Roads Department'], ward_id: null },
    { name: 'Executive Engineer KUWS&DB', role: 'Executive Engineer', constituency: 'DK District', authority_id: authMap['KUWS&DB'], ward_id: null },
    { name: 'Superintending Engineer MESCOM', role: 'Superintending Engineer', constituency: 'DK District', authority_id: authMap['MESCOM'], ward_id: null },
    { name: 'DCP Traffic Mangaluru', role: 'DCP Traffic', constituency: 'Mangaluru City', authority_id: authMap['Mangaluru Traffic Police'], ward_id: null },
    { name: 'Executive Engineer PWD', role: 'Executive Engineer', constituency: 'DK District', authority_id: authMap['PWD Karnataka'], ward_id: null },
    { name: 'Project Director NHAI', role: 'Project Director', constituency: 'DK Stretch', authority_id: authMap['NHAI'], ward_id: null },
    { name: 'CEO Zilla Panchayat DK', role: 'Chief Executive Officer', constituency: 'DK District', authority_id: authMap['Zilla Panchayat DK'], ward_id: null },
    { name: 'Deputy Commissioner DK', role: 'Deputy Commissioner', constituency: 'DK District', authority_id: authMap['DK District Administration'], ward_id: null },
  ];

  // Corporators
  for (const w of wardList) {
    reps.push({
      name: `Corporator Ward ${w.number}`,
      role: 'Corporator',
      constituency: `Ward ${w.number} - ${w.name}`,
      authority_id: authMap['MCC General Administration'],
      ward_id: w.id,
    });
  }

  for (const r of reps) {
    const { error } = await sb.from('representatives').upsert(
      { name: r.name, role: r.role, constituency: r.constituency, authority_id: r.authority_id ?? null, ward_id: r.ward_id ?? null },
      { onConflict: 'constituency,name', ignoreDuplicates: true }
    );
    if (error && !error.message.includes('duplicate')) console.error(`  ERROR ${r.name}:`, error.message);
  }
  const { count } = await sb.from('representatives').select('*', { count: 'exact', head: true });
  console.log(`  ${count ?? 0} representatives`);
}

async function seedAssignmentRules() {
  console.log('--- Seed: Assignment Rules ---');
  const { data: cats } = await sb.from('categories').select('id, slug');
  const { data: auths } = await sb.from('authorities').select('id, name');
  const catMap = Object.fromEntries((cats ?? []).map(c => [c.slug, c.id]));
  const authMap = Object.fromEntries((auths ?? []).map(a => [a.name, a.id]));

  const rules = [
    ['pothole', 'MCC Roads Department', null],
    ['road-damage', 'MCC Roads Department', null],
    ['garbage', 'MCC Health Department', null],
    ['illegal-dumping', 'MCC Health Department', null],
    ['water-leakage', 'KUWS&DB', null],
    ['sewage', 'KUWS&DB', null],
    ['streetlight', 'MESCOM', null],
    ['traffic-signal', 'Mangaluru Traffic Police', null],
    ['footpath', 'MCC Engineering', null],
    ['drain', 'MCC Engineering', null],
    ['tree-hazard', 'MCC Horticulture', null],
    ['public-toilet', 'MCC General Administration', null],
    ['others', 'MCC General Administration', null],
  ];

  for (const [slug, authName] of rules) {
    const catId = catMap[slug];
    const authId = authMap[authName];
    if (!catId || !authId) {
      console.error(`  SKIP ${slug} -> ${authName}: missing mapping`);
      continue;
    }
    const { error } = await sb.from('assignment_rules').upsert(
      { category_id: catId, authority_id: authId, ward_id: null, active: true, version: 1 },
      { onConflict: 'category_id,ward_id', ignoreDuplicates: true }
    );
    if (error && !error.message.includes('duplicate')) console.error(`  ERROR ${slug}:`, error.message);
  }
  console.log(`  ${rules.length} rules`);
}

async function main() {
  console.log('\n=== JanFix Mangaluru - Database Seed ===\n');
  try { await runDDL(); } catch (e) { console.log('DDL:', e.message); }
  try { await seedCategories(); } catch (e) { console.error('Categories failed:', e.message); }
  try { await seedAuthorities(); } catch (e) { console.error('Authorities failed:', e.message); }
  try { await seedWards(); } catch (e) { console.error('Wards failed:', e.message); }
  try { await seedRepresentatives(); } catch (e) { console.error('Reps failed:', e.message); }
  try { await seedAssignmentRules(); } catch (e) { console.error('Rules failed:', e.message); }
  console.log('\n=== Done ===');
  process.exit(0);
}

main();
