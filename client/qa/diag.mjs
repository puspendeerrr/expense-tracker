import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 320, height: 720 } });
const p = await ctx.newPage();

const bad = [];
p.on('response', (r) => { if (r.status() === 403) bad.push(`${r.status()} ${r.url()}`); });

await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await p.fill('input[type="email"]', 'aarti@qa.local');
await p.fill('input[type="password"]', 'QaPassword1');
await p.click('button[type="submit"]');
await p.waitForURL('**/app', { timeout: 20000 });

for (const path of ['/app', '/app/admin']) {
  await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const offenders = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1) {
        out.push({ tag: el.tagName, cls: String(el.className).slice(0, 70), right: Math.round(r.right), w: Math.round(r.width), text: (el.textContent||'').trim().slice(0,30) });
      }
    }
    return out.slice(0, 6);
  });
  console.log(`\n=== ${path} (vw=320) ===`);
  for (const o of offenders) console.log(`  ${o.tag} w=${o.w} right=${o.right} "${o.text}" :: ${o.cls}`);
}

console.log('\n403 responses:');
for (const x of [...new Set(bad)]) console.log('  ', x);
await b.close();
