import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = 'http://localhost:5173';
await mkdir('qa/screenshots', { recursive: true });

const browser = await chromium.launch();
const errors = [];

for (const vp of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${vp.name}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('401')) errors.push(`[${vp.name}] ${m.text()}`); });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'aarti@qa.local');
  await page.fill('input[type="password"]', 'QaPassword1');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app', { timeout: 20000 });
  await page.waitForTimeout(2500);

  for (const [path, label] of [
    ['/app', 'dashboard'],
    ['/app/expenses', 'expenses'],
    ['/app/members', 'members'],
    ['/app/settlements', 'settlements'],
    ['/app/settings', 'settings'],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) errors.push(`[${vp.name}] ${label}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: `qa/screenshots/${vp.name}-${label}.png`, fullPage: true });
    console.log(`  ${vp.name}/${label}: overflow=${overflow}`);
  }
  await ctx.close();
}

await browser.close();
console.log('\nERRORS:', errors.length);
for (const e of errors) console.log('  -', e);
process.exit(errors.length ? 1 : 0);
