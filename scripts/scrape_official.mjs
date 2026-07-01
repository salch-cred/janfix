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

const UA = 'Mozilla/5.0 (compatible; JanFix/2.0)';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── 1. Brijesh Chowta (MP) - Lok Sabha / Sansad ────────────────
async function findBrijeshChowtaPhoto() {
  console.log('\n=== Brijesh Chowta (MP) ===');

  // Try Sansad.in (new Lok Sabha site)
  const sansadUrls = [
    'https://sansad.in/ls/member/biography/5110',
    'https://sansad.in/getFile/memberphoto/5110.jpg',
    'https://loksabha.nic.in/Members/photo/5110.jpg',
    'https://loksabha.nic.in/Members/Photo/5110.jpg',
    'https://sansad.in/photo/5110.jpg',
  ];

  for (const url of sansadUrls) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        console.log(`FOUND MP photo: ${url}`);
        return url;
      } else if (res.ok) {
        const text = await res.text();
        // Look for image src
        const matches = text.match(/(?<=<img[^>]+src=["'])([^"']+\.(?:jpg|jpeg|png))(?=["'])/gi);
        if (matches) {
          const absUrls = matches.map(m => m.startsWith('http') ? m : new URL(m, url).href);
          for (const imgUrl of absUrls) {
            const ir = await fetchWithTimeout(imgUrl);
            if (ir.ok && ir.headers.get('content-type')?.startsWith('image/')) {
              console.log(`FOUND via page: ${imgUrl}`);
              return imgUrl;
            }
          }
        }
      }
    } catch {}
  }

  // Try Wikipedia Commons directly with known filename
  const commonsUrls = [
    'https://commons.wikimedia.org/wiki/Special:FilePath/Brijesh_Chowta.jpg?width=200',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Capt._Brijesh_Chowta.jpg?width=200',
    'https://commons.wikimedia.org/wiki/Special:FilePath/Captain_Brijesh_Chowta.jpg?width=200',
  ];
  for (const url of commonsUrls) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        console.log(`FOUND Commons: ${url}`);
        return url;
      }
    } catch {}
  }

  return null;
}

// ─── 2. MLA photos - Karnataka Assembly ──────────────────────────
async function findMLAphoto(name, constituency) {
  console.log(`\n=== ${name} (${constituency}) ===`);

  // Try Karnataka Legislative Assembly
  const kaSites = [
    `https://kla.kar.nic.in/assembly/member%20photos/photo%20of%20${encodeURIComponent(name.replace(/\s+/g, '%20'))}.jpg`,
    `https://kla.kar.nic.in/assembly/member photos/photo_of_${name.replace(/\s+/g, '_')}.jpg`,
    `https://kla.kar.nic.in/assembly/member%20photos/${encodeURIComponent(name.replace(/\s+/g, '_'))}.jpg`,
  ];

  for (const url of kaSites) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok && res.headers.get('content-type')?.startsWith('image/')) {
        console.log(`FOUND KA site: ${url}`);
        return url;
      }
    } catch {}
  }

  // Try MyNeta / ADR (Association for Democratic Reforms)
  const nameParts = name.split(/\s+/);
  const searchName = name.replace(/\.\s*/g, ' ').replace(/\s+/g, '+');
  const affUrls = [
    `https://www.myneta.info/Karnataka2023/candidate.php?candidate=${searchName}`,
    `https://www.myneta.info/LokSabha2024/candidate.php?candidate=${searchName}`,
  ];

  for (const url of affUrls) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const text = await res.text();
        const matches = text.match(/(?<=<img[^>]+src=["'])([^"']+\.(?:jpg|jpeg|png))(?=["'])/gi);
        if (matches) {
          for (const m of matches) {
            const absUrl = m.startsWith('http') ? m : new URL(m, url).href;
            if (absUrl.includes('photo') || absUrl.includes('candidate')) {
              const ir = await fetchWithTimeout(absUrl);
              if (ir.ok && ir.headers.get('content-type')?.startsWith('image/')) {
                console.log(`FOUND MyNeta: ${absUrl}`);
                return absUrl;
              }
            }
          }
        }
      }
    } catch {}
  }

  // Try Google-hosted images - search via Wikipedia/Wikidata for any image
  // These pages have the chance of having an image via infobox even if not in pageimages
  const wikipages = {
    'D. Vedavyas Kamath': 'D._Vedavyas_Kamath',
    'Dr. Bharath Shetty': 'Y._Bharath_Shetty',
    'Umanath A. Kotian': 'Umanatha_Kotian',
    'Ashok Kumar Rai': 'Ashok_Kumar_Rai_(Indian_politician)',
    'Harish Poonja': 'Harish_Poonja',
    'Bhagirathi Murulya': 'Bhageerathi_Murulya',
  };

  const wp = wikipages[name];
  if (wp) {
    // Parse the Wikipedia page HTML for images (more thorough than API)
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(wp)}&prop=images|text&format=json&section=0`;
      const res = await fetchWithTimeout(url);
      if (res.ok) {
        const data = await res.json();
        const images = data.parse?.images || [];
        // Filter for likely photo images
        const photoImgs = images.filter(i => /\.(jpg|jpeg|png)$/i.test(i) && !/flag|logo|crest|seal|emblem/i.test(i));
        for (const img of photoImgs) {
          const fm = img.replace(/ /g, '_');
          const imgUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fm)}?width=200`;
          const ir = await fetchWithTimeout(imgUrl);
          if (ir.ok && ir.headers.get('content-type')?.startsWith('image/')) {
            // Verify it's not Null.png
            const buf = await ir.arrayBuffer();
            const fileSize = buf.byteLength;
            if (fileSize > 1000) {
              console.log(`FOUND via WP parse: ${imgUrl}`);
              return imgUrl;
            }
          }
          await sleep(500);
        }
      }
    } catch {}
  }

  return null;
}

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  // Brijesh Chowta (MP)
  const brijeshUrl = await findBrijeshChowtaPhoto();
  if (brijeshUrl) {
    await supabase.from('representatives').update({ photo_url: brijeshUrl }).eq('id', 1);
    console.log('Updated Brijesh Chowta');
  } else {
    console.log('No photo found for Brijesh Chowta');
  }
  await sleep(2000);

  // MLAs
  const mlas = [
    { id: 2, name: 'D. Vedavyas Kamath', constituency: 'Karkala' },
    { id: 3, name: 'Dr. Bharath Shetty', constituency: 'Mangaluru City South' },
    { id: 4, name: 'Umanath A. Kotian', constituency: 'Mangaluru' },
    { id: 5, name: 'Ashok Kumar Rai', constituency: 'Mangaluru City North' },
    { id: 7, name: 'Harish Poonja', constituency: 'Bantwal' },
    { id: 82, name: 'Bhagirathi Murulya', constituency: 'Sullia' },
  ];

  for (const mla of mlas) {
    const url = await findMLAphoto(mla.name, mla.constituency);
    if (url) {
      await supabase.from('representatives').update({ photo_url: url }).eq('id', mla.id);
      console.log(`Updated ${mla.name}`);
    } else {
      console.log(`No photo found for ${mla.name}`);
    }
    await sleep(3000); // be nice to servers
  }

  console.log('\n=== SUMMARY ===');
  const { data: allReps } = await supabase.from('representatives').select('id, name, photo_url').order('id');
  for (const r of allReps) {
    const isPlaceholder = r.photo_url?.includes('ui-avatars');
    console.log(`${r.id}: ${r.name} → ${isPlaceholder ? '❌ PLACEHOLDER' : '✅ ' + r.photo_url?.substring(0, 60)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
