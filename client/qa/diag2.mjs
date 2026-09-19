import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await p.fill('input[type="email"]', 'aarti@qa.local');
await p.fill('input[type="password"]', 'QaPassword1');
await p.click('button[type="submit"]');
await p.waitForURL('**/app', { timeout: 20000 });
await p.waitForTimeout(3000);
const buttons = await p.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => (b.textContent||'').trim() || b.getAttribute('aria-label') || '(icon)').slice(0, 25)
);
console.log('BUTTONS:', JSON.stringify(buttons, null, 1));
await b.close();
