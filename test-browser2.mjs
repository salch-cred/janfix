import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message || err));
  await page.goto('http://localhost:8081/explore', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); // wait 3s
  await page.screenshot({ path: 'screenshot.png' });
  const html = await page.content();
  fs.writeFileSync('page.html', html);
  await browser.close();
})();
