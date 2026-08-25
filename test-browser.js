const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('response', response => {
    if (!response.ok()) console.log('HTTP ERROR:', response.status(), response.url());
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  
  // Click on the second session if it exists
  const sessions = await page.$$('.session-item');
  if (sessions.length > 1) {
    console.log('Clicking second session...');
    await sessions[1].click();
    await new Promise(r => setTimeout(r, 1000));
  }
  
  await browser.close();
})();
