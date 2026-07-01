import https from 'https';
import http from 'http';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function httpGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': UA, ...options.headers },
      timeout: 15000,
      ...options,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ─── PRSIndia image checker ──────────────────────────────────────
// PRSIndia stores MLA/MP images at known paths
// MP: /files/mptrack/{term}/profile_image/{id}.jpg
// MLA: /files/mlatrack/{state}/{term}/profile_image/{id}.jpg

async function checkPRSImage(path) {
  try {
    const url = `https://prsindia.org${path}`;
    const res = await httpGet(url);
    if (res.status === 200 && res.headers['content-type']?.startsWith('image/')) {
      const size = res.data.length;
      if (size > 1000) { // valid image (not empty placeholder)
        return url;
      }
    }
  } catch {}
  return null;
}

const PRS_MP_PATHS = [
  '/files/mptrack/18-lok-sabha/profile_image/180167.jpg', // Brijesh Chowta
];

const PRS_MLA_PATHS = {
  'D. Vedavyas Kamath': [
    '/files/mlatrack/karnataka/16-assembly/profile_image/160042.jpg',
    '/files/mlatrack/karnataka/15-assembly/profile_image/150042.jpg',
  ],
  'Y. Bharath Shetty': [
    '/files/mlatrack/karnataka/16-assembly/profile_image/160051.jpg',
    '/files/mlatrack/karnataka/15-assembly/profile_image/150051.jpg',
  ],
  'Umanatha Kotian': [
    '/files/mlatrack/karnataka/16-assembly/profile_image/160052.jpg',
    '/files/mlatrack/karnataka/15-assembly/profile_image/150052.jpg',
  ],
  'Ashok Kumar Rai': [
    '/files/mlatrack/karnataka/16-assembly/profile_image/160053.jpg',
    '/files/mlatrack/karnataka/15-assembly/profile_image/150053.jpg',
  ],
  'Harish Poonja': [
    '/files/mlatrack/karnataka/16-assembly/profile_image/160054.jpg',
    '/files/mlatrack/karnataka/15-assembly/profile_image/150054.jpg',
  ],
  'Bhagirathi Murulya': [
    '/files/mlatrack/karnataka/16-assembly/profile_image/160055.jpg',
  ],
};

// ─── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('Checking PRSIndia for photos...\n');
  
  // Check Brijesh Chowta (MP)
  for (const path of PRS_MP_PATHS) {
    const url = await checkPRSImage(path);
    if (url) {
      console.log(`✅ Brijesh Chowta (id=1): ${url}`);
    }
  }
  
  // Check MLAs
  for (const [name, paths] of Object.entries(PRS_MLA_PATHS)) {
    let found = false;
    for (const path of paths) {
      const url = await checkPRSImage(path);
      if (url) {
        console.log(`✅ ${name}: ${url}`);
        found = true;
        break;
      }
    }
    if (!found) {
      console.log(`❌ ${name}: no PRSIndia photo`);
    }
  }
  
  // Check ABP News/Election sites
  console.log('\nChecking other sources...\n');
  
  // Try election sites that embed candidate photos
  const candidates = [
    { name: 'Vedavyas Kamath', urls: [
      'https://www.oneindia.com/politicians/d-vedavyasa-kamath-72325.html',
    ]},
    { name: 'Bharath Shetty', urls: [
      'https://www.oneindia.com/politicians/dr-bharath-shetty-y-72324.html',
    ]},
  ];
  
  for (const c of candidates) {
    for (const url of c.urls) {
      try {
        const res = await httpGet(url);
        if (res.status === 200) {
          // Find first profile image
          const imgs = res.data.match(/<img[^>]+src="([^"]+)"[^>]*>/g) || [];
          for (const img of imgs) {
            const src = img.match(/src="([^"]+)"/)?.[1];
            if (src && !src.includes('logo') && !src.includes('icon') && 
                (src.includes('photo') || src.includes('profile') || src.endsWith('.jpg'))) {
              const fullUrl = src.startsWith('http') ? src : new URL(src, url).href;
              if (!fullUrl.includes('placeholder') && !fullUrl.includes('blank')) {
                console.log(`  ${c.name}: ${fullUrl.substring(0, 100)}`);
              }
            }
          }
        }
      } catch {}
    }
  }
}

main().catch(e => console.error(e));
