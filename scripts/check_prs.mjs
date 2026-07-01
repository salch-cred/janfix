import https from 'node:https';

function check(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
      if (res.statusCode === 200 && res.headers['content-type']?.startsWith('image/')) {
        let d = [];
        res.on('data', c => d.push(c));
        res.on('end', () => {
          const size = Buffer.concat(d).length;
          resolve(size > 2000 ? url : null);
        });
      } else { resolve(null); }
    }).on('error', () => resolve(null));
  });
}

const candidates = [
  ['Vedavyas Kamath', 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/D.%20Vedavyas%20Kamath.jpg'],
  ['Vedavyas Kamath', 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Vedavyas%20Kamath.jpg'],
  ['Bharath Shetty', 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Bharath%20Shetty%20Y..jpg'],
  ['Umanath Kotian', 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Umanatha%20Kotian.jpg'],
  ['Ashok Kumar Rai', 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Ashok%20Kumar%20Rai.jpg'],
  ['Harish Poonja', 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Harish%20Poonja.jpg'],
  ['Bhagirathi Murulya', 'https://prsindia.org/files/mlatrack/karnataka/16/mla_images/Bhageerathi%20Murulya.jpg'],
];

for (const [name, url] of candidates) {
  const result = await check(url);
  console.log(name + ': ' + (result || 'NOT FOUND'));
}
