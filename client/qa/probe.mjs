import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await p.fill('input[type="email"]', 'aarti@qa.local');
await p.fill('input[type="password"]', 'QaPassword1');
await p.click('button[type="submit"]');
await p.waitForURL('**/app', { timeout: 20000 });
for (const path of ['/api/admin/stats', '/api/admin/users?limit=5&offset=0&role=all&verified=all']) {
  const r = await p.evaluate(async (u) => {
    const res = await fetch(u, { credentials: 'include' });
    return { status: res.status, body: (await res.text()).slice(0, 600) };
  }, path);
  console.log(path, '->', r.status);
  console.log(r.body);
  console.log('---');
}
await b.close();
