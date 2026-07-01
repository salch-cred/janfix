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

const UA = 'JanFix/1.0 (photo-scraper; +https://janfix.app)';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Wikipedia image extraction
// ---------------------------------------------------------------------------

async function wikiSearchPage(title) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages|images&format=json&pithumbsize=400`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${title}`);
  return res.json();
}

async function getFileUrl(filename) {
  const fm = filename.replace(/^File:/, '').replace(/^Image:/, '');
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fm)}&prop=imageinfo&iiprop=url|extmetadata&format=json`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  return page?.imageinfo?.[0]?.url || null;
}

async function getWikipediaPhoto(personName, knownPage) {
  // Step 1: search for the best Wikipedia page
  let titles = [];
  if (knownPage) {
    titles = [knownPage];
  } else {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(personName + ' politician')}&format=json&srlimit=5&srprop=`;
    const sr = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
    const sdata = await sr.json();
    titles = (sdata.query?.search || []).map(s => s.title);
  }

  for (const title of titles) {
    await sleep(350);
    try {
      const data = await wikiSearchPage(title);
      const pages = data.query?.pages;
      if (!pages) continue;
      const page = Object.values(pages)[0];
      if (!page || page.missing) continue;

      // Try pageimage/thumbnail first (WP extracts infobox image)
      if (page.thumbnail?.source) {
        return { url: page.thumbnail.source.replace('/thumb/', '/').replace(/\/\d+px-.+$/, ''), source: title };
      }

      // Fallback: iterate images
      const images = page.images || [];
      // Score images: prefer .jpg/.png photos, exclude icons/crest/logo/flag
      const scored = images
        .map(img => {
          const f = img.title;
          let score = 0;
          if (/\.(jpg|jpeg|png)$/i.test(f)) score += 2;
          if (personName.split(' ').some(w => w.length > 2 && f.toLowerCase().includes(w.toLowerCase()))) score += 3;
          if (/portrait|headshot|photo/i.test(f)) score += 2;
          if (/crest|logo|flag|coat|emblem|seal/i.test(f)) score -= 10;
          if (/svg$/i.test(f)) score -= 5;
          return { file: f, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored.find(s => s.score > 0);
      if (best) {
        const url = await getFileUrl(best.file);
        if (url) return { url, source: title };
      }
    } catch {
      // continue to next title
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Wikimedia Commons logo search
// ---------------------------------------------------------------------------

async function getWikimediaCommonsLogo(query) {
  const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + ' logo')}&format=json&srlimit=10&srnamespace=6`;
  const res = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const results = data.query?.search || [];

  // Score results: prefer SVG > PNG > JPG, prefer logo/emblem keywords
  const scored = [];
  for (const r of results) {
    const f = r.title.replace(/^File:/, '');
    let score = 0;
    if (/\.svg$/i.test(f)) score += 5;
    else if (/\.png$/i.test(f)) score += 3;
    else if (/\.(jpg|jpeg)$/i.test(f)) score += 1;
    if (/logo/i.test(f)) score += 3;
    if (/emblem/i.test(f)) score += 2;
    if (query.split(' ').some(w => w.length > 2 && f.toLowerCase().includes(w.toLowerCase()))) score += 2;
    if (/icon|button|badge|marker/i.test(f)) score -= 5;
    scored.push({ file: f, score });
  }
  scored.sort((a, b) => b.score - a.score);

  for (const s of scored) {
    if (s.score < 3) break;
    await sleep(300);
    const fmu = s.file;
    const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fmu)}&prop=imageinfo&iiprop=url&format=json`;
    const ires = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!ires.ok) continue;
    const idata = await ires.json();
    const ipage = Object.values(idata.query?.pages || {})[0];
    if (ipage?.imageinfo?.[0]?.url) {
      return ipage.imageinfo[0].url;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Authority logo definitions
// ---------------------------------------------------------------------------

const AUTHORITY_LOGOS = [
  { id: 1, name: 'MCC', keywords: ['Mangaluru City Corporation', 'Mangalore Municipal'], fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Mangaluru_City_Corporation_logo.svg/200px-Mangaluru_City_Corporation_logo.svg.png' },
  { id: 2, name: 'MCC Health', keywords: ['Mangaluru health department'] },
  { id: 3, name: 'KUWS&DB', keywords: ['Karnataka Urban Water Supply', 'KUWSDB'], fallback: null },
  { id: 4, name: 'MESCOM', keywords: ['MESCOM', 'Mangalore Electricity Supply Company'], fallback: null },
  { id: 5, name: 'Mangaluru Traffic Police', keywords: ['Karnataka Police', 'Mangaluru Police'], fallback: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Karnataka_Police_logo.svg/200px-Karnataka_Police_logo.svg.png' },
  { id: 6, name: 'PWD Karnataka', keywords: ['Public Works Department Karnataka', 'PWD Karnataka'], fallback: null },
  { id: 7, name: 'NHAI', keywords: ['NHAI', 'National Highways Authority of India'], fallback: null },
  { id: 8, name: 'MCC Horticulture', keywords: ['Mangaluru horticulture'] },
  { id: 9, name: 'MCC General', keywords: ['Mangaluru City Corporation'], fallback: 'https://ui-avatars.com/api/?name=MCC&background=1d4ed8&color=fff' },
  { id: 10, name: 'MCC Engineering', keywords: ['Mangaluru City Corporation'], fallback: 'https://ui-avatars.com/api/?name=MCC&background=1d4ed8&color=fff' },
  { id: 11, name: 'ZP Dakshina Kannada', keywords: ['Zilla Panchayat Dakshina Kannada', 'ZP DK'], fallback: null },
  { id: 12, name: 'DK District Administration', keywords: ['Dakshina Kannada district'], fallback: null },
];

const ALREADY_HAS_PHOTO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/UT'; // U.T. Khader

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function processRepresentatives() {
  console.log('\n=== REPRESENTATIVES ===\n');

  const { data: reps } = await supabase.from('representatives').select('id, name, role, photo_url').order('id');
  if (!reps) { console.log('No reps found'); return; }

  for (const rep of reps) {
    // Skip if already has a real photo (not UI Avatar placeholder)
    if (rep.photo_url && !rep.photo_url.includes('ui-avatars') && rep.photo_url !== ALREADY_HAS_PHOTO) {
      console.log(`SKIP ${rep.name}: already has real photo`);
      continue;
    }

    // Determine known Wikipedia page title based on manual mapping
    const pageMap = {
      1: 'Brijesh Chowta',
      2: 'D. Vedavyas Kamath',
      3: 'Y. Bharath Shetty',
      4: 'Umanatha Kotian',
      5: 'Ashok Kumar Rai (Indian politician)',
      6: null, // U.T. Khader - already has photo
      7: 'Harish Poonja',
      8: 'U. Rajesh Naik',
      82: 'Bhageerathi Murulya',
    };
    const knownPage = pageMap[rep.id];
    if (knownPage === null) {
      console.log(`SKIP ${rep.name}: already has real photo (known)`);
      continue;
    }

    process.stdout.write(`FETCH ${rep.name}... `);
    const result = await getWikipediaPhoto(rep.name, knownPage);
    if (result) {
      await supabase.from('representatives').update({ photo_url: result.url }).eq('id', rep.id);
      console.log(`OK → ${result.url.substring(0, 70)}... (from ${result.source})`);
    } else {
      console.log('NOT FOUND (kept existing placeholder)');
    }
    await sleep(500);
  }
}

async function processAuthorities() {
  console.log('\n=== AUTHORITIES ===\n');

  const { data: auths } = await supabase.from('authorities').select('id, name, logo_url').order('id');
  if (!auths) { return; }

  for (const auth of auths) {
    if (auth.logo_url && !auth.logo_url.includes('ui-avatars')) {
      console.log(`SKIP ${auth.name}: already has real logo`);
      continue;
    }

    const cfg = AUTHORITY_LOGOS.find(a => a.id === auth.id);
    if (!cfg) {
      console.log(`SKIP ${auth.name}: no config`);
      continue;
    }

    let url = null;
    for (const kw of cfg.keywords) {
      process.stdout.write(`FETCH logo for ${auth.name} (${kw})... `);
      url = await getWikimediaCommonsLogo(kw);
      if (url) {
        console.log(`OK → ${url.substring(0, 70)}...`);
        break;
      }
      console.log('not found');
      await sleep(300);
    }

    if (!url && cfg.fallback) {
      url = cfg.fallback;
      console.log(`FALLBACK for ${auth.name}: ${url.substring(0, 60)}...`);
    }

    if (url) {
      await supabase.from('authorities').update({ logo_url: url }).eq('id', auth.id);
    } else {
      console.log(`NO LOGO found for ${auth.name}`);
    }
    await sleep(500);
  }
}

async function main() {
  console.log('Photo/Logo Scraper v1.0');
  await processRepresentatives();
  await processAuthorities();
  console.log('\nDone!');
}

main().catch(console.error);
