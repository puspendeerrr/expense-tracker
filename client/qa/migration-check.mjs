import { chromium } from 'playwright';
import { signedInContext, BASE } from './session.mjs';

const browser = await chromium.launch();
const { page } = await signedInContext(browser, { width: 1440, height: 900 });

const groups = await page.evaluate(async () => {
  const res = await fetch('/api/admin/groups?limit=25&offset=0', { credentials: 'include' });
  return res.json();
});

console.log('ADMIN VIEW OF GROUPS:');
for (const g of groups.data.groups) {
  console.log(`  ${g.name}  code=${g.inviteCode}  members=${g.memberCount}  expenses=${g.expenseCount}  value=₹${(g.totalValuePaise/100).toLocaleString('en-IN')}  payday=${g.payday ?? '-'}`);
}

const stats = await page.evaluate(async () => (await fetch('/api/admin/stats', { credentials: 'include' })).json());
console.log('\nPLATFORM STATS:', JSON.stringify(stats.data, null, 1));

await page.goto(`${BASE}/app/admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('tab', { name: /groups/i }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: 'qa/screenshots/migration-admin-groups.png', fullPage: true });
await browser.close();
