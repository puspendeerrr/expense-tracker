import { chromium } from 'playwright';
import { signedInContext, BASE } from './session.mjs';

const browser = await chromium.launch();
const failures = [];
const { page } = await signedInContext(browser, { width: 390, height: 844 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !t.includes('401') && !t.includes('ws://localhost:5173')) failures.push(t);
});

// --- Activity feed (392 migrated rows live in the Survivor's group) ---
const groups = await page.evaluate(async () => (await fetch('/api/groups', { credentials: 'include' })).json());
const survivors = groups.data.groups.find((g) => g.inviteCode === 'IOWUVL');
console.log('Survivor\'s group visible to admin account:', Boolean(survivors));

await page.goto(`${BASE}/app/activity`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const activityRows = await page.locator('li').count();
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(`activity page: rows=${activityRows} overflow=${overflow}`);
if (overflow > 0) failures.push(`activity overflow ${overflow}px`);
await page.screenshot({ path: 'qa/screenshots/feat-activity.png', fullPage: true });

// --- UPI panel in the settle dialog ---
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const settle = page.getByRole('button', { name: /^settle$/i }).first();
if (await settle.count()) {
  await settle.click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(2000);
  const hasUpiHeading = await page.locator('[role="dialog"]').getByText(/pay over upi/i).count();
  const hasQr = await page.locator('[role="dialog"] img[alt*="UPI QR"]').count();
  console.log(`settle dialog: upiPanel=${hasUpiHeading > 0} qr=${hasQr > 0}`);
  await page.screenshot({ path: 'qa/screenshots/feat-upi.png' });
  const o2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (o2 > 0) failures.push(`settle dialog overflow ${o2}px`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
} else {
  console.log('settle dialog: no debts for this account (skipped)');
}

// --- Receipt upload control appears in Add Expense ---
await page.getByRole('button', { name: /add expense/i }).first().click();
await page.waitForSelector('[role="dialog"]');
await page.waitForTimeout(800);
const receiptControl = await page.locator('[role="dialog"]').getByText(/receipt/i).count();
console.log(`add expense: receipt control present=${receiptControl > 0}`);
await page.screenshot({ path: 'qa/screenshots/feat-receipt.png' });
await page.keyboard.press('Escape');

await browser.close();
console.log('\nFAILURES:', failures.length);
for (const f of [...new Set(failures)]) console.log('  -', f);
process.exit(failures.length ? 1 : 0);
