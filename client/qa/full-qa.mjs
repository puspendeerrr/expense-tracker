import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';


await mkdir('qa/screenshots', { recursive: true });

const PAGES = [
  ['/app', 'dashboard'],
  ['/app/expenses', 'expenses'],
  ['/app/members', 'members'],
  ['/app/settlements', 'settlements'],
  ['/app/activity', 'activity'],
  ['/app/spending', 'spending'],
  ['/app/settings', 'settings'],
];

const VIEWPORTS = [
  { name: '320', width: 320, height: 720, mobile: true },
  { name: '360', width: 360, height: 780, mobile: true },
  { name: '375', width: 375, height: 667, mobile: true },
  { name: '390', width: 390, height: 844, mobile: true },
  { name: '412', width: 412, height: 915, mobile: true },
  { name: '430', width: 430, height: 932, mobile: true },
  { name: '768', width: 768, height: 1024, mobile: false },
  { name: '1024', width: 1024, height: 768, mobile: false },
  { name: '1280', width: 1280, height: 800, mobile: false },
  { name: '1440', width: 1440, height: 900, mobile: false },
  { name: '1920', width: 1920, height: 1080, mobile: false },
];

const failures = [];
const warnings = [];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401')) failures.push(`console: ${m.text()}`);
});

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'aarti@qa.local');
await page.fill('input[type="password"]', 'QaPassword1');
await page.click('button[type="submit"]');
await page.waitForURL('**/app', { timeout: 20000 });
console.log('Signed in.\n');

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  let worst = 0;
  for (const [path, label] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 0) { failures.push(`[${vp.name}] ${label}: overflow ${overflow}px`); worst = Math.max(worst, overflow); }
    if (vp.name === '390' || vp.name === '1440') {
      await page.screenshot({ path: `qa/screenshots/final-${vp.name}-${label}.png`, fullPage: true });
    }
  }
  if (vp.mobile) {
    const small = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select, textarea')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none') continue;
        if (el.tagName === 'A' && st.display.includes('inline')) continue;
        if (r.height < 43.5) bad.push(`${el.tagName}"${(el.textContent||'').trim().slice(0,18)}" ${Math.round(r.height)}px`);
      }
      return bad.slice(0, 4);
    });
    if (small.length) warnings.push(`[${vp.name}] small targets: ${small.join('; ')}`);
  }
  console.log(`  ${vp.name}px: overflow=${worst}`);
}

await browser.close();
console.log('\nFAILURES:', failures.length);
for (const f of [...new Set(failures)]) console.log('  -', f);
console.log('WARNINGS:', warnings.length);
for (const w of [...new Set(warnings)]) console.log('  -', w);
process.exit(failures.length ? 1 : 0);
