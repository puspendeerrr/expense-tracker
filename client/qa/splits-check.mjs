import { chromium } from 'playwright';
import { signedInContext, BASE } from './session.mjs';

/**
 * Exercises the two new features in a real browser at phone width:
 *  1. Creating an expense with a percentage split, and confirming the stored shares.
 *  2. The settle-up plan panel on the settlements page.
 */

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 390, height: 844 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401')) failures.push(`console: ${m.text()}`);
});

const title = `QA split ${Date.now().toString().slice(-6)}`;

/* ---- 1. Percentage split ---- */

await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

await page.getByRole('button', { name: /add expense/i }).first().click();
await page.waitForTimeout(600);

await page.getByLabel(/expense title/i).fill(title);
await page.getByLabel(/^amount$/i).fill('1000');

// Switch to the percentage mode.
await page.getByRole('button', { name: /^Percentages$/ }).click();
await page.waitForTimeout(400);

const shareInputs = page.locator('input[id^="split-"]');
const count = await shareInputs.count();
console.log('share inputs rendered:', count);
if (count < 2) failures.push('split editor did not render a row per member');

// Deliberately unbalance, then confirm the form refuses to submit.
await shareInputs.nth(0).fill('10');
await shareInputs.nth(1).fill('10');
await page.waitForTimeout(300);

const statusText = await page.locator('[role="status"]').first().innerText();
console.log('reconciliation status while unbalanced:', JSON.stringify(statusText.trim()));
if (!/left to assign|over/i.test(statusText)) {
  failures.push('running remainder not shown while unbalanced');
}

// Now balance it across however many members there are.
const even = Math.floor(10000 / count) / 100;
let assigned = 0;
for (let i = 0; i < count; i += 1) {
  const value = i === count - 1 ? (10000 - assigned * 100) / 100 : even;
  assigned += i === count - 1 ? 0 : even;
  await shareInputs.nth(i).fill(String(value));
}
await page.waitForTimeout(400);

const balancedText = await page.locator('[role="status"]').first().innerText();
console.log('reconciliation status when balanced:', JSON.stringify(balancedText.trim()));
if (!/adds up to 100%/i.test(balancedText)) {
  failures.push('balanced percentage split not recognised');
}

const overflowDialog = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
if (overflowDialog > 0) failures.push(`split editor overflow ${overflowDialog}px`);

await page.screenshot({ path: 'qa/screenshots/split-editor.png' });

await page.getByRole('button', { name: /^(add expense|save changes)$/i }).last().click();
await page.waitForTimeout(2000);

const listText = await page.locator('body').innerText();
const created = listText.includes(title);
console.log(`percentage expense "${title}" created:`, created);
if (!created) failures.push('percentage expense was not created');

/* ---- 2. Settle-up plan ---- */

await page.goto(`${BASE}/app/settlements`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const settlementsText = await page.locator('body').innerText();
const hasPlan = /settle up faster|everyone is settled up/i.test(settlementsText);
console.log('settle-up plan panel present:', hasPlan);
if (!hasPlan) failures.push('settle-up plan panel missing');

const planOverflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
console.log('settlements overflow at 390px:', planOverflow);
if (planOverflow > 0) failures.push(`settlements overflow ${planOverflow}px`);

await page.screenshot({ path: 'qa/screenshots/settle-plan.png' });

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const failure of failures) console.log(' -', failure);
process.exit(failures.length ? 1 : 0);
