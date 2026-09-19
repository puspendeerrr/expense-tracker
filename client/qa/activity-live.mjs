import { chromium } from 'playwright';
import { signedInContext, BASE } from './session.mjs';

/**
 * Confirms that an action taken now produces a readable activity entry.
 *
 * The earlier feed check only ever saw migrated rows, which render from
 * `metadata.legacyAction`. This exercises the other branch: a row this system wrote,
 * whose wording is composed in the client from the activity type and metadata.
 */

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 390, height: 844 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401')) failures.push(`console: ${m.text()}`);
});

const title = `QA activity ${Date.now().toString().slice(-6)}`;

await page.goto(`${BASE}/app/expenses`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);

await page.getByRole('button', { name: /add expense/i }).first().click();
await page.waitForTimeout(600);

await page.getByLabel(/title|description/i).first().fill(title);
await page.getByLabel(/amount/i).first().fill('240');
await page.getByRole('button', { name: /^(add|save|create)/i }).last().click();
await page.waitForTimeout(1800);

await page.goto(`${BASE}/app/activity`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const text = await page.locator('main, body').first().innerText();
const found = text.includes(title);
console.log(`new expense "${title}" appears in feed:`, found);
if (!found) failures.push('fresh activity row missing from the feed');

// The composed sentence must name the actor and the action, not a raw enum value.
const hasRawType = /expense_created|settlement_created/.test(text);
console.log('raw enum leaked into wording:', hasRawType);
if (hasRawType) failures.push('raw activity type rendered instead of a sentence');

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
console.log('overflow at 390px:', overflow);
if (overflow > 0) failures.push(`activity overflow ${overflow}px`);

await page.screenshot({ path: 'qa/screenshots/activity-live.png', fullPage: false });

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const failure of failures) console.log(' -', failure);
process.exit(failures.length ? 1 : 0);
