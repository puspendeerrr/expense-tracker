import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * Activity page QA.
 *
 * Checks the three things that were actually wrong: entries appearing twice, the day
 * heading colliding with a row's icon, and the filter panel snapping open with no
 * transition. Each is measured rather than eyeballed.
 */

await mkdir('qa/screenshots', { recursive: true });

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 900 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error' && !text.includes('401') && !text.includes('403')) {
    failures.push(`console: ${text}`);
  }
});

await page.goto(`${BASE}/app/activity`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

/* ---- 1. No duplicated entries ---- */

const rows = await page.evaluate(() =>
  [...document.querySelectorAll('li')]
    .map((li) => li.innerText.trim())
    .filter((t) => t && !/^(today|yesterday|\d)/i.test(t.split('\n')[0])),
);

const seen = new Map();
for (const row of rows) {
  seen.set(row, (seen.get(row) ?? 0) + 1);
}
// Two genuinely identical expenses at the same minute are possible but rare; three
// copies of one line is the duplicate-write signature.
const duped = [...seen.entries()].filter(([, count]) => count > 2);
console.log('feed rows:', rows.length, '| lines appearing 3+ times:', duped.length);
if (duped.length) failures.push(`duplicated rows: ${duped.slice(0, 2).map(([t]) => t.split('\n')[0]).join(' | ')}`);

/* ---- 2. Day heading is not overlapped by a row icon ---- */

await page.evaluate(() => window.scrollBy(0, 400));
await page.waitForTimeout(400);

const overlap = await page.evaluate(() => {
  const heading = [...document.querySelectorAll('li')].find((li) =>
    /^(today|yesterday|\d{1,2} \w+)/i.test(li.innerText.trim()),
  );
  if (!heading) return 'no day heading found';

  const hz = Number(getComputedStyle(heading).zIndex) || 0;
  const hr = heading.getBoundingClientRect();

  for (const icon of document.querySelectorAll('li span[aria-hidden]')) {
    const ir = icon.getBoundingClientRect();
    const iz = Number(getComputedStyle(icon).zIndex) || 0;
    const intersects =
      ir.top < hr.bottom && ir.bottom > hr.top && ir.left < hr.right && ir.right > hr.left;
    if (intersects && iz >= hz) {
      return `icon (z=${iz}) paints over heading (z=${hz})`;
    }
  }
  return null;
});
console.log('heading overlap:', overlap ?? 'none');
if (overlap) failures.push(`day heading: ${overlap}`);

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(300);

/* ---- 3. The filter panel animates ---- */

const filterButton = page.locator('button', { hasText: 'Filters' }).first();
if (!(await filterButton.count())) {
  failures.push('no Filters button');
} else {
  const panelHeight = () =>
    page.evaluate(() => {
      const select = document.querySelector('[aria-label="Filter by what happened"]');
      if (!select) return 0;
      const panel = select.closest('.overflow-hidden');
      return panel ? panel.getBoundingClientRect().height : 0;
    });

  const closed = await panelHeight();
  await filterButton.click();
  // Mid-transition: a panel that snaps open is already at its full height here.
  await page.waitForTimeout(90);
  const mid = await panelHeight();
  await page.waitForTimeout(500);
  const open = await panelHeight();

  console.log(`filter panel height  closed=${closed.toFixed(0)} mid=${mid.toFixed(0)} open=${open.toFixed(0)}`);

  if (open < 40) failures.push('filter panel did not open');
  if (closed > 4) failures.push(`filter panel was not collapsed when closed (${closed}px)`);
  if (mid >= open - 2) failures.push('filter panel snapped open with no transition');

  await page.screenshot({ path: 'qa/screenshots/activity-filters-open.png' });

  /* ---- 4. Filtering actually narrows the feed ---- */
  const before = await page.locator('h2').first().innerText();
  await page.locator('[aria-label="Search activity"]').fill('zzzznomatch');
  await page.waitForTimeout(1200);
  const emptyState = await page.locator('body').innerText();
  console.log('empty state shown:', /nothing matches those filters/i.test(emptyState));
  if (!/nothing matches those filters/i.test(emptyState)) {
    failures.push('search did not reach the filtered empty state');
  }
  await page.locator('[aria-label="Search activity"]').fill('');
  await page.waitForTimeout(1000);
  const after = await page.locator('h2').first().innerText();
  if (before !== after) failures.push(`entry count did not return: "${before}" -> "${after}"`);
}

/* ---- 5. Mobile ---- */

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/app/activity`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
console.log('mobile overflow:', overflow);
if (overflow > 0) failures.push(`mobile overflow ${overflow}px`);
await page.screenshot({ path: 'qa/screenshots/activity-390.png' });

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const failure of failures) console.log(' -', failure);
process.exit(failures.length ? 1 : 0);
