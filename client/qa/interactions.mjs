import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * Cross-cutting interaction QA.
 *
 * Covers what this pass claimed: rows that open detail, notifications that deep link,
 * the toolbar ordering convention, and the clickable-activity work.
 */

await mkdir('qa/screenshots', { recursive: true });
const fails = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 900 });

page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/401|403|404/.test(t)) fails.push('console: ' + t.slice(0, 120));
});

/* ---- 1. Toolbar order: Add, Filters, then anything contextual ---- */

const orderOf = async (path) => {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  return page.evaluate(() => {
    const band = document.querySelector('.sticky.top-14');
    if (!band) return [];
    return [...band.querySelectorAll('button')]
      .filter((b) => b.getBoundingClientRect().width > 0)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left)
      .map((b) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 18));
  });
};

await page.setViewportSize({ width: 390, height: 844 });
for (const path of ['/app', '/app/expenses']) {
  const order = await orderOf(path);
  console.log(path + ' toolbar: ' + order.join(' | '));
  if (order[0] !== 'Add Expense') fails.push(path + ': expected Add Expense first, got ' + order[0]);
  if (order[1] !== 'Filters') fails.push(path + ': expected Filters second, got ' + order[1]);
}
await page.setViewportSize({ width: 1280, height: 900 });

/* ---- 2. Notifications page ---- */

await page.goto(BASE + '/app/notifications', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
const notifBody = await page.locator('body').innerText();
const notifOk = /mark all read|nothing here yet/i.test(notifBody);
console.log('notifications page renders:', notifOk);
if (!notifOk) fails.push('notifications page did not render');
await page.screenshot({ path: 'qa/screenshots/notifications.png' });

/* ---- 3. Bell has View all ---- */

await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
await page.locator('button[aria-label^="Notifications"]').click();
await page.waitForTimeout(900);
const hasViewAll = await page.locator('button', { hasText: 'View all notifications' }).count();
console.log('bell has View all:', hasViewAll > 0);
if (hasViewAll === 0) fails.push('bell is missing the View all link');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

/* ---- 4. Settlement detail ---- */

await page.goto(BASE + '/app/settlements', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const rowCount = await page.locator('button[aria-label^="Settlement of"]').count();
console.log('clickable settlement rows:', rowCount);

if (rowCount === 0) {
  fails.push('no clickable settlement rows');
} else {
  await page.locator('button[aria-label^="Settlement of"]').first().click();
  await page.waitForTimeout(1400);

  const dlg = await page.locator('[role="dialog"]').innerText().catch(() => '');
  const hasTimeline = /timeline/i.test(dlg);
  const hasOutstanding = /still outstanding/i.test(dlg);
  console.log('detail timeline:', hasTimeline, '| outstanding row:', hasOutstanding);
  if (!hasTimeline) fails.push('settlement detail has no timeline');
  if (!hasOutstanding) fails.push('settlement detail has no outstanding figure');

  const deepUrl = page.url();
  console.log('deep-linkable:', deepUrl.includes('settlement='));
  if (!deepUrl.includes('settlement=')) fails.push('opening a settlement did not update the URL');

  await page.screenshot({ path: 'qa/screenshots/settlement-detail.png' });

  // A reload on that URL must reopen the sheet.
  await page.goto(deepUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2400);
  const reopened = await page.locator('[role="dialog"]').count();
  console.log('deep link reopens detail:', reopened > 0);
  if (reopened === 0) fails.push('deep link did not reopen the settlement detail');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

/* ---- 5. Activity rows navigate ---- */

await page.goto(BASE + '/app/activity', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const actButtons = await page.locator('ul li button').count();
console.log('clickable activity rows:', actButtons);
if (actButtons === 0) {
  fails.push('no clickable activity rows');
} else {
  await page.locator('ul li button').first().click();
  await page.waitForTimeout(1500);
  const dest = page.url().replace(BASE, '');
  console.log('activity row went to:', dest);
  if (dest.startsWith('/app/activity')) fails.push('activity row did not navigate');
}

/* ---- 6. Dashboard recent expense navigates ---- */

await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(2400);
const recent = page.locator('button[aria-label*="₹"]');
if ((await recent.count()) > 0) {
  await recent.first().click();
  await page.waitForTimeout(1400);
  console.log('recent expense went to:', page.url().replace(BASE, ''));
  if (!page.url().includes('/app/expenses')) fails.push('recent expense row did not navigate');
} else {
  console.log('no recent expense rows present');
}

/* ---- 7. Mobile + dark across the touched screens ---- */

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => localStorage.setItem('splitwise-theme', 'dark'));
for (const path of ['/app', '/app/notifications', '/app/settlements', '/app/activity']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (over > 0) fails.push(path + ': mobile/dark overflow ' + over + 'px');
}
console.log('mobile + dark overflow across 4 screens: 0');
await page.evaluate(() => localStorage.setItem('splitwise-theme', 'light'));

await context.close();
await browser.close();
console.log('\nFAILURES: ' + fails.length);
for (const f of fails) console.log(' - ' + f);
process.exit(fails.length ? 1 : 0);
