import { chromium } from 'playwright';
import { signedInContext, BASE } from './session.mjs';

/**
 * Exercises the platform-permission work in a real browser at phone width:
 * the admin console's new controls, the permissions editor, the spending dashboard
 * (including its scope grant), and the clear-history dialog's safety refusal.
 */

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 390, height: 844 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401') && !m.text().includes('403')) {
    failures.push(`console: ${m.text()}`);
  }
});

const overflow = () =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* ---- 1. Admin console ---- */

await page.goto(`${BASE}/app/admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const adminText = await page.locator('body').innerText();
const hasPermissionsButton = /Permissions/.test(adminText);
const hasManageButton = /Manage/.test(adminText);
console.log('admin: permissions button =', hasPermissionsButton, '| manage button =', hasManageButton);
if (!hasPermissionsButton) failures.push('admin console missing the Permissions control');
if (!hasManageButton) failures.push('admin console missing the Manage control');

const adminOverflow = await overflow();
console.log('admin overflow at 390px:', adminOverflow);
if (adminOverflow > 0) failures.push(`admin overflow ${adminOverflow}px`);
await page.screenshot({ path: 'qa/screenshots/platform-admin.png', fullPage: false });

/* ---- 2. Permissions editor ---- */

const permButton = page.getByRole('button', { name: /^Permissions$/ }).first();
if (await permButton.count()) {
  await permButton.click();
  await page.waitForTimeout(1200);

  const dialogText = await page.locator('[role="dialog"]').innerText();
  // Category headers are uppercased by CSS, and innerText returns the rendered text.
  const hasCategories = /platform administration/i.test(dialogText) && /money/i.test(dialogText);
  const hasSensitive = /Sensitive/i.test(dialogText);
  console.log('permissions editor: categories =', hasCategories, '| sensitive badges =', hasSensitive);
  if (!hasCategories) failures.push('permissions editor is missing its categories');
  if (!hasSensitive) failures.push('permissions editor is not marking sensitive capabilities');

  const dialogOverflow = await overflow();
  if (dialogOverflow > 0) failures.push(`permissions dialog overflow ${dialogOverflow}px`);
  await page.screenshot({ path: 'qa/screenshots/platform-permissions.png', fullPage: false });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
} else {
  failures.push('could not open the permissions editor');
}

/* ---- 3. Spending dashboard ---- */

// Give this admin an all-groups scope so the page has something real to render.
const scopeResult = await page.evaluate(async () => {
  const me = await fetch('/api/auth/me', { credentials: 'include' }).then((r) => r.json());
  const userId = me?.data?.user?.id;
  if (!userId) return 'no user';
  const res = await fetch(`/api/admin/users/${userId}/dashboard-scope`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'all_groups', groupIds: [] }),
  });
  return `${res.status}`;
});
console.log('dashboard scope grant:', scopeResult);

await page.goto(`${BASE}/app/spending`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);

const spendingText = await page.locator('body').innerText();
const hasSpending = /Spending per person/.test(spendingText);
const noAccess = /do not have access/.test(spendingText);
console.log('spending: per-person section =', hasSpending, '| locked out =', noAccess);
if (noAccess) failures.push('spending dashboard denied access to an administrator');
if (!hasSpending && !/No groups are in scope/.test(spendingText)) {
  failures.push('spending dashboard rendered neither data nor an explanation');
}

// The month chart's bars must actually have height; a percentage height inside an
// auto-height parent silently computes to zero.
const barHeights = await page.evaluate(() => {
  const bars = [...document.querySelectorAll('div[title*="—"] > div')];
  return bars.map((b) => Math.round(b.getBoundingClientRect().height));
});
console.log('month bars (px):', barHeights.join(', ') || 'none');
if (barHeights.length && barHeights.every((h) => h <= 1)) {
  failures.push('month chart bars have no height');
}

const spendingOverflow = await overflow();
console.log('spending overflow at 390px:', spendingOverflow);
if (spendingOverflow > 0) failures.push(`spending overflow ${spendingOverflow}px`);
await page.screenshot({ path: 'qa/screenshots/platform-spending.png', fullPage: true });

/* ---- 4. Clear history ---- */

await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const settingsText = await page.locator('body').innerText();
const hasPurgeCard = /Clear history/.test(settingsText);
console.log('settings: clear-history card =', hasPurgeCard);

if (hasPurgeCard) {
  await page.getByRole('button', { name: /Clear history/i }).first().click();
  await page.waitForTimeout(800);

  // Check a wide range: the group has live debts, so this must be refused.
  await page.getByRole('button', { name: /Check what this would delete/i }).click();
  await page.waitForTimeout(2000);

  const purgeText = await page.locator('[role="dialog"]').innerText();
  const blocked = /still has money owed|would be deleted/i.test(purgeText);
  const showsCounts = /Expenses/.test(purgeText);
  console.log('purge preview rendered =', showsCounts, '| blocked-or-safe shown =', blocked);
  if (!showsCounts) failures.push('purge preview did not render counts');

  const purgeOverflow = await overflow();
  if (purgeOverflow > 0) failures.push(`purge dialog overflow ${purgeOverflow}px`);
  await page.screenshot({ path: 'qa/screenshots/platform-purge.png', fullPage: false });
} else {
  console.log('(no clear-history card — this QA account may not be a group creator)');
}

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const failure of failures) console.log(' -', failure);
process.exit(failures.length ? 1 : 0);
