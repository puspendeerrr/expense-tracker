import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const errors = [];

for (const vp of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${vp.name}] ${e.message}`));
  page.on('console', (m) => { if (m.type()==='error' && !m.text().includes('401')) errors.push(`[${vp.name}] ${m.text()}`); });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'aarti@qa.local');
  await page.fill('input[type="password"]', 'QaPassword1');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app', { timeout: 20000 });
  await page.goto(`${BASE}/app/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const hasUsers = await page.locator('text=aarti@qa.local').count();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`  ${vp.name}: userRowsVisible=${hasUsers>0} overflow=${overflow}`);
  if (overflow > 0) errors.push(`[${vp.name}] admin overflow ${overflow}px`);
  if (!hasUsers) errors.push(`[${vp.name}] admin user list did not render`);

  await page.screenshot({ path: `qa/screenshots/${vp.name}-admin.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
console.log('\nERRORS:', errors.length);
for (const e of errors) console.log('  -', e);
process.exit(errors.length ? 1 : 0);
