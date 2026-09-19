import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await p.fill('input[type="email"]', 'aarti@qa.local');
await p.fill('input[type="password"]', 'QaPassword1');
await p.click('button[type="submit"]');
await p.waitForURL('**/app', { timeout: 20000 });
await p.waitForTimeout(3500);

const info = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent||'').trim().startsWith('Filters'));
  if (!btn) return { found: false };
  const r = btn.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const top = document.elementFromPoint(cx, cy);
  const st = getComputedStyle(btn);
  return {
    found: true,
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    visibility: st.visibility, display: st.display, opacity: st.opacity,
    bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
    bodyAriaHidden: document.body.getAttribute('aria-hidden'),
    topElement: top ? `${top.tagName}.${String(top.className).slice(0,60)}` : 'none',
    topIsBtnOrChild: top ? btn.contains(top) : false,
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
