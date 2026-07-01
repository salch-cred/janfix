import { createClient } from '@supabase/supabase-js';
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
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment or .env file.");
  process.exit(1);
}

const UA = 'JanFixMangaluru/2.0 (photo-scraper; https://janfix.app)';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Manual Wikidata mappings (pre-verified) ──────────────────────────
// These are the Wikidata IDs for our representatives, manually verified
const WIKIDATA = {
  'Capt. Brijesh Chowta': { q: 'Q126753770', page: 'Brijesh_Chowta' },
  'Vedavyas Kamath':      { q: 'Q117103208', page: 'D._Vedavyas_Kamath' },
  'Dr. Bharath Shetty':   { q: 'Q127263688', page: 'Y._Bharath_Shetty' },
  'Umanath A. Kotian':    { q: 'Q126753744', page: 'Umanatha_Kotian' },
  'Ashok Kumar Rai':      { q: 'Q126753727', page: 'Ashok_Kumar_Rai_(Indian_politician)' },
  'U.T. Khader':          { q: null, page: null },  // already has photo
  'Harish Poonja':        { q: 'Q112969440', page: 'Harish_Poonja' },
  'U. Rajesh Naik':       { q: null, page: null },  // already correct
  'Bhagirathi Murulya':   { q: 'Q126753690', page: 'Bhageerathi_Murulya' },
};

// ── Wikidata Image Query ────────────────────────────────────────────
async function getWikidataImage(wikidataId) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const claims = data.entities?.[wikidataId]?.claims || {};

  // Property P18 = image
  const imageVal = claims.P18?.[0]?.mainsnak?.datavalue?.value;
  if (imageVal) {
    const file = imageVal.replace(/ /g, '_');
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=200`;
  }

  // Property P2910 = image
  const imgVal2 = claims.P2910?.[0]?.mainsnak?.datavalue?.value;
  if (imgVal2) {
    const file = imgVal2.replace(/ /g, '_');
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=200`;
  }

  return null;
}

// ── Direct Wikimedia Commons search ─────────────────────────────────
async function searchCommonsFilename(name) {
  // Try common filename patterns
  const variants = [
    name.replace(/\s+/g, '_'),
    name.replace(/\s+/g, '_') + '.jpg',
    name.replace(/\s+/g, '_') + '.jpeg',
    name.replace(/\s+/g, '_') + '.png',
    name.replace(/\.\s*/g, '_') + '.jpg',
    name.replace(/\.\s*/g, '') + '.jpg',
    name.replace(/\.\s*/g, '') + '.jpeg',
    // With "MLA" or "MP" suffix
    name.replace(/\s+/g, '_') + '_MLA.jpg',
    name.replace(/\s+/g, '_') + '_MLA.png',
    name.replace(/\s+/g, '_') + '_MP.jpg',
  ];

  for (const variant of variants) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(variant)}&prop=imageinfo&iiprop=url&format=json`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) continue;
    const data = await res.json();
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];
    if (page && !page.missing && page.imageinfo?.[0]?.url) {
      return page.imageinfo[0].url;
    }
  }
  return null;
}

// ── Process Representatives ─────────────────────────────────────────
async function main() {
  console.log('=== Fetching REAL photos for representatives ===\n');
  const { data: reps } = await supabase
    .from('representatives')
    .select('id, name, role, photo_url')
    .order('id');

  for (const rep of reps) {
    // Skip job-role representatives (IDs 10-21: generic titles)
    if (rep.role === 'Engineer' || rep.role === 'Commissioner' || rep.name.includes('Engineer') || rep.name.includes('Officer') || rep.name.includes('Director') || rep.name === 'Manja') {
      // For specific names like "Manja", keep searching
      if (rep.id === 9) {
        // Manja - Mayor, try to find photo
      } else {
        console.log(`SKIP ${rep.name} (${rep.role}) – job role, not a specific person`);
        continue;
      }
    }

    // Skip if already has a real photo
    if (rep.photo_url && !rep.photo_url.includes('ui-avatars')) {
      console.log(`SKIP ${rep.name} – already has real photo`);
      continue;
    }

    process.stdout.write(`${rep.name} (id=${rep.id})... `);

    const wd = WIKIDATA[rep.name];
    let imageUrl = null;

    if (wd?.q) {
      await sleep(2000);
      imageUrl = await getWikidataImage(wd.q);
      if (imageUrl) {
        console.log(`WIKIDATA OK`);
      } else {
        console.log(`WIKIDATA no image, trying Commons search...`);
      }
    }

    if (!imageUrl) {
      await sleep(1500);
      // Try Commons direct filename
      imageUrl = await searchCommonsFilename(rep.name);
      if (imageUrl) {
        console.log(`COMMONS OK`);
      }
    }

    if (!imageUrl) {
      // Try searching Commons by keyword
      await sleep(1500);
      const searchName = rep.name.replace(/\.\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchName + ' MLA Karnataka portrait')}&format=json&srnamespace=6&srlimit=5`;
      const res = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const sdata = await res.json();
        const results = sdata.query?.search || [];
        for (const r of results) {
          const f = r.title.replace(/^File:/, '');
          // Check if filename matches person name
          const nameParts = searchName.toLowerCase().split(' ');
          const fLow = f.toLowerCase();
          const nameMatch = nameParts.filter(w => w.length > 2).some(w => fLow.includes(w));
          if (!nameMatch && !fLow.includes(searchName.replace(/\s+/g, '_').toLowerCase())) continue;
          if (/\.svg$/i.test(f)) continue;

          await sleep(1000);
          const fUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(f)}&prop=imageinfo&iiprop=url&format=json`;
          const fRes = await fetch(fUrl, { headers: { 'User-Agent': UA } });
          if (fRes.ok) {
            const fData = await fRes.json();
            const fPage = Object.values(fData.query?.pages || {})[0];
            if (fPage?.imageinfo?.[0]?.url) {
              imageUrl = fPage.imageinfo[0].url;
              break;
            }
          }
        }
      }

      if (imageUrl) {
        console.log(`COMMONS SEARCH OK`);
      }
    }

    if (imageUrl) {
      await supabase.from('representatives').update({ photo_url: imageUrl }).eq('id', rep.id);
      console.log(`  → UPDATED: ${imageUrl.substring(0, 90)}`);
    } else {
      console.log(`  → NO PHOTO FOUND (kept placeholder)`);
    }
  }

  // ── Authorities ─────────────────────────────────────────────────
  console.log('\n=== Fetching authority logos ===\n');

  const logoConfig = [
    { id: 1, name: 'MCC Roads', search: 'Mangaluru_City_Corporation_logo', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Mangaluru_City_Corporation_logo.svg/200px-Mangaluru_City_Corporation_logo.svg.png' },
    { id: 2, name: 'MCC Health', search: null, fallback: 'https://ui-avatars.com/api/?name=MCC+H&background=dc2626&color=fff' },
    { id: 3, name: 'KUWS&DB', search: 'Karnataka_Urban_Water_Supply_and_Drainage_Board_logo', fallback: null },
    { id: 4, name: 'MESCOM', search: 'MESCOM_logo', fallback: null },
    { id: 5, name: 'Mangaluru Traffic Police', search: null, fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Karnataka_Police_logo.svg/200px-Karnataka_Police_logo.svg.png' },
    { id: 6, name: 'PWD Karnataka', search: 'Public_Works_Department_Karnataka_logo', fallback: null },
    { id: 7, name: 'NHAI', search: 'National_Highways_Authority_of_India_logo', fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/NHAI_logo.svg/200px-NHAI_logo.svg.png' },
    { id: 8, name: 'MCC Horticulture', search: null, fallback: 'https://ui-avatars.com/api/?name=MCC+H&background=15803d&color=fff' },
    { id: 9, name: 'MCC General', search: null, fallback: 'https://ui-avatars.com/api/?name=MCC&background=1d4ed8&color=fff' },
    { id: 10, name: 'MCC Engineering', search: null, fallback: 'https://ui-avatars.com/api/?name=MCC+E&background=1d4ed8&color=fff' },
    { id: 11, name: 'ZP DK', search: 'Zilla_Panchayat_Dakshina_Kannada_logo', fallback: 'https://ui-avatars.com/api/?name=ZP+DK&background=1d4ed8&color=fff' },
    { id: 12, name: 'DK District Admin', search: null, fallback: 'https://ui-avatars.com/api/?name=DK+DA&background=1d4ed8&color=fff' },
  ];

  for (const cfg of logoConfig) {
    let logoUrl = null;

    if (cfg.search) {
      await sleep(1000);
      // Try exact filename first
      const fUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${cfg.search}.svg&prop=imageinfo&iiprop=url&format=json`;
      const res = await fetch(fUrl, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const data = await res.json();
        const page = Object.values(data.query?.pages || {})[0];
        if (page && !page.missing && page.imageinfo?.[0]?.url) {
          logoUrl = page.imageinfo[0].url;
        }
      }
    }

    if (!logoUrl) {
      await sleep(1000);
      const fUrl2 = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${cfg.search}.png&prop=imageinfo&iiprop=url&format=json`;
      const res2 = await fetch(fUrl2, { headers: { 'User-Agent': UA } });
      if (res2.ok) {
        const data2 = await res2.json();
        const page2 = Object.values(data2.query?.pages || {})[0];
        if (page2 && !page2.missing && page2.imageinfo?.[0]?.url) {
          logoUrl = page2.imageinfo[0].url;
        }
      }
    }

    if (!logoUrl && cfg.fallback) {
      logoUrl = cfg.fallback;
    }

    process.stdout.write(`${cfg.name}... `);
    if (logoUrl) {
      await supabase.from('authorities').update({ logo_url: logoUrl }).eq('id', cfg.id);
      console.log(`OK → ${logoUrl.substring(0, 80)}`);
    } else {
      console.log(`NO LOGO`);
    }
  }

  // ── Fix Manja (Mayor) ───────────────────────────────────────────
  // Manja is the mayor of Mangaluru. Try to find a photo.
  console.log('\n=== Manja (Mayor) special handling ===');
  const manjaUrls = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Mangalore_Mayor_Manja.jpg/200px-Mangalore_Mayor_Manja.jpg',
    'https://www.mangalurucitycorporation.gov.in/sites/default/files/mayor.jpg',
  ];
  for (const url of manjaUrls) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) {
        await supabase.from('representatives').update({ photo_url: url }).eq('id', 9);
        console.log(`Manja photo found: ${url}`);
        break;
      }
    } catch {}
  }

  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
