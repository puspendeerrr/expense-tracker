import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * Command palette and global search.
 *
 * Drives it the way a person would -- keyboard first -- and checks the two things that
 * are easy to get wrong: that "/" does not hijack typing inside a field, and that
 * arrow-key navigation actually moves the selection rather than just repainting it.
 */

await mkdir('qa/screenshots', { recursive: true });

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 900 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const paletteOpen = () => page.locator('[role="listbox"]').isVisible().catch(() => false);

/* ---- 1. Ctrl-K opens it ---- */

await page.keyboard.press('Control+k');
await page.waitForTimeout(600);
console.log('opens with Ctrl-K:', await paletteOpen());
if (!(await paletteOpen())) failures.push('Ctrl-K did not open the palette');

const commandCount = await page.locator('[role="option"]').count();
console.log('commands listed with an empty query:', commandCount);
if (commandCount < 5) failures.push(`only ${commandCount} commands listed`);

await page.screenshot({ path: 'qa/screenshots/palette.png' });

/* ---- 2. Arrow keys move the selection ---- */

const selected = () =>
  page.evaluate(() => {
    const el = document.querySelector('[role="option"][aria-selected="true"]');
    return el ? el.textContent.trim().slice(0, 40) : null;
  });

const first = await selected();
await page.keyboard.press('ArrowDown');
await page.waitForTimeout(200);
const second = await selected();
console.log('selection moved:', first !== second, `(${first} -> ${second})`);
if (first === second) failures.push('ArrowDown did not move the selection');

await page.keyboard.press('ArrowUp');
await page.waitForTimeout(200);
const back = await selected();
if (back !== first) failures.push('ArrowUp did not return to the first row');

/* ---- 3. Commands filter as you type ---- */

await page.locator('input[aria-label="Search or run a command"]').fill('secur');
await page.waitForTimeout(400);
const filtered = await page.locator('[role="option"]').allInnerTexts();
console.log('filtered to:', filtered.length, 'rows');
if (!filtered.some((t) => /Security/i.test(t))) failures.push('Security command not matched');

/* ---- 4. Server search returns grouped results ---- */

await page.locator('input[aria-label="Search or run a command"]').fill('Apartment');
await page.waitForTimeout(1400);

const body = await page.locator('[role="listbox"]').innerText();
// innerText returns the rendered text, which CSS has uppercased.
const hasGroupHeading = /groups/i.test(body);
console.log('server results grouped under headings:', hasGroupHeading);
if (!hasGroupHeading) failures.push('no Groups heading for a matching term');

await page.screenshot({ path: 'qa/screenshots/palette-results.png' });

/* ---- 5. Results are scoped server-side ---- */

const scoped = await page.evaluate(async () => {
  const res = await fetch('/api/search?q=Apartment', { credentials: 'include' });
  const json = await res.json();
  return { status: res.status, groups: json.data.groups.length };
});
console.log('search API:', scoped.status, '| groups:', scoped.groups);
if (scoped.status !== 200) failures.push(`search API returned ${scoped.status}`);

const tooShort = await page.evaluate(async () => {
  const res = await fetch('/api/search?q=a', { credentials: 'include' });
  return res.status;
});
console.log('one-character term rejected:', tooShort === 400);
if (tooShort !== 400) failures.push(`short term returned ${tooShort}`);

/* ---- 6. Enter activates ---- */

await page.locator('input[aria-label="Search or run a command"]').fill('settings');
await page.waitForTimeout(500);
await page.keyboard.press('Enter');
await page.waitForTimeout(1200);

const url = page.url();
console.log('Enter navigated to:', url);
if (!url.includes('/app/settings')) failures.push(`Enter did not navigate (at ${url})`);

/* ---- 7. Escape closes ---- */

await page.keyboard.press('Control+k');
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
console.log('closes with Escape:', !(await paletteOpen()));
if (await paletteOpen()) failures.push('Escape did not close the palette');

/* ---- 8. "/" opens it, but not while typing in a field ---- */

await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.keyboard.press('/');
await page.waitForTimeout(500);
console.log('opens with /:', await paletteOpen());
if (!(await paletteOpen())) failures.push('"/" did not open the palette');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Now with focus inside a text field: the slash must be typed, not swallowed.
await page.goto(`${BASE}/app/activity`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const field = page.locator('input[aria-label="Search activity"]');
await field.click();
await field.type('a/b');
await page.waitForTimeout(400);

const typed = await field.inputValue();
const hijacked = await paletteOpen();
console.log(`typed "${typed}" | palette hijacked:`, hijacked);
if (typed !== 'a/b') failures.push(`"/" was swallowed while typing (got "${typed}")`);
if (hijacked) failures.push('"/" opened the palette while typing in a field');

/* ---- 9. Mobile ---- */

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const mobileTrigger = page.locator('button[aria-label="Search"]');
console.log('mobile search button present:', (await mobileTrigger.count()) > 0);
if ((await mobileTrigger.count()) === 0) failures.push('no mobile search trigger');
else {
  await mobileTrigger.first().click();
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log('mobile overflow:', overflow);
  if (overflow > 0) failures.push(`mobile overflow ${overflow}px`);
  await page.screenshot({ path: 'qa/screenshots/palette-390.png' });
}

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const f of failures) console.log(' -', f);
process.exit(failures.length ? 1 : 0);
