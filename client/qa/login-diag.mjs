import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', (m) => { if (m.type()==='error') console.log('CONSOLE:', m.text().slice(0,200)); });
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await p.fill('input[type="email"]', 'aarti@qa.local');
await p.fill('input[type="password"]', 'QaPassword1');

const [resp] = await Promise.all([
  p.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 15000 }).catch(() => null),
  p.click('button[type="submit"]'),
]);
if (resp) console.log('LOGIN', resp.status(), (await resp.text()).slice(0, 300));
await p.waitForTimeout(2000);
console.log('URL:', p.url());
const alert = await p.locator('[role="alert"]').allTextContents();
console.log('ALERTS:', alert);
await p.screenshot({ path: 'qa/screenshots/login-diag.png' });
await b.close();
