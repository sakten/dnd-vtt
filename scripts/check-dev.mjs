import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) console.log('HTTP', r.status(), r.url());
});
await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
await page.waitForSelector('.join-card', { timeout: 15000 });
const disabled = await page.$$eval('.join-actions button.primary', (els) => els.map((e) => e.disabled));
console.log('join screen ok, buttons disabled:', JSON.stringify(disabled));
console.log(errors.length === 0 ? 'DEV MODE OK (no console errors)' : 'ERRORS: ' + errors.join(' | '));
await browser.close();
process.exit(errors.length === 0 ? 0 : 1);
