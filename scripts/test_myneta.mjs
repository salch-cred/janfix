const sleep = ms => new Promise(r => setTimeout(r, ms));

const mlas = [
  { name: 'D. Vedavyas Kamath', id: 2 },
  { name: 'Y. Bharath Shetty', id: 3 },
  { name: 'Umanatha Kotian', id: 4 },
  { name: 'Ashok Kumar Rai', id: 5 },
  { name: 'Harish Poonja', id: 7 },
  { name: 'Bhageerathi Murulya', id: 82 },
  { name: 'Brijesh Chowta', id: 1 },
];

for (const mla of mlas) {
  await sleep(2000);
  const search = encodeURIComponent(mla.name.replace(/\.\s*/g, ' ').trim().replace(/\s+/g, '+'));
  const url = 'https://www.myneta.info/Karnataka2023/index.php?action=show_candidates&constituency_id=0&party_id=0&search=' + search;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) { console.log(mla.name + ': HTTP ' + res.status); continue; }
    const html = await res.text();

    // Find image URLs
    const resultPattern = /<img[^>]+src="([^"]+)"[^>]*>/gi;
    const images = [];
    let match;
    while ((match = resultPattern.exec(html)) !== null) {
      images.push(match[1]);
    }

    const photoImg = images.find(i => /photo|candidate|profile/i.test(i) && i.endsWith('.jpg'));
    if (photoImg) {
      console.log(mla.name + ': ' + photoImg);
    } else {
      console.log(mla.name + ': no photo image, found imgs: ' + images.join(', ').substring(0, 200));
    }
  } catch (e) {
    console.log(mla.name + ': ERROR ' + e.message);
  }
}
