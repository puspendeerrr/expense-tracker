import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const b = await chromium.launch();

for (const vp of [{n:'mobile',w:390,h:844},{n:'desktop',w:1440,h:900}]) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', 'aarti@qa.local');
  await p.fill('input[type="password"]', 'QaPassword1');
  await p.click('button[type="submit"]');
  await p.waitForURL('**/app', { timeout: 20000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `qa/screenshots/v2-${vp.n}-dashboard.png`, fullPage: true });

  // Filter dialog first, on a clean page.
  await p.getByRole('button', { name: /^filters/i }).first().click();
  await p.waitForSelector('[role="dialog"]');
  await p.waitForTimeout(700);
  await p.screenshot({ path: `qa/screenshots/v2-${vp.n}-filters.png` });
  await p.getByRole('button', { name: /^cancel$/i }).click();
  await p.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 10000 });

  // Invite dialog from the groups page.
  await p.goto(`${BASE}/app/groups`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.getByRole('button', { name: /invite qr/i }).click();
  await p.waitForSelector('[role="dialog"]');
  await p.waitForTimeout(1500);
  const hasQr = await p.locator('[role="dialog"] img[alt*="QR"]').count();
  const qrBox = hasQr ? await p.locator('[role="dialog"] img[alt*="QR"]').boundingBox() : null;
  console.log(`  ${vp.n}: qrRendered=${hasQr > 0} size=${qrBox ? Math.round(qrBox.width)+'x'+Math.round(qrBox.height) : 'n/a'}`);
  await p.screenshot({ path: `qa/screenshots/v2-${vp.n}-invite.png` });
  await ctx.close();
}
await b.close();
console.log('done');
