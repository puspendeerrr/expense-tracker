/**
 * End-to-end: add an expense, and prove the other member's dashboard updates live.
 *
 * This is the test that ties the whole stack together. It asserts that a second user's
 * balance changes WITHOUT a page reload, and that the page object identity is preserved
 * (i.e. React re-rendered; the browser did not navigate).
 *
 *   node qa/e2e-realtime.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:5173';
const failures = [];

const check = (condition, message) => {
  if (condition) {
    console.log(`  pass  ${message}`);
  } else {
    console.log(`  FAIL  ${message}`);
    failures.push(message);
  }
};

const signIn = async (context, email) => {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'QaPassword1');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app', { timeout: 20_000 });
  await page.waitForSelector('text=Your position', { timeout: 20_000 });
  await page.waitForTimeout(1500);
  return page;
};

/** Reads the "You need to pay" figure off the dashboard. */
const readOwed = async (page) => {
  const card = page.locator('text=YOU NEED TO PAY').locator('xpath=../..');
  return (await card.innerText()).replace(/\s+/g, ' ').trim();
};

const run = async () => {
  const browser = await chromium.launch();

  const aartiContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const rahulContext = await browser.newContext({ viewport: { width: 390, height: 844 } });

  console.log('\nSigning both members in…');
  const aarti = await signIn(aartiContext, 'aarti@qa.local');
  const rahul = await signIn(rahulContext, 'rahul@qa.local');

  // Tag the window so a full page reload would be detectable.
  await rahul.evaluate(() => {
    window.__qaSentinel = 'alive';
  });

  const rahulBefore = await readOwed(rahul);
  console.log(`\nRahul owes (before): ${rahulBefore}`);

  /* ---- Aarti adds an expense ---- */
  console.log('\nAarti adds an expense…');
  await aarti.getByRole('button', { name: /add expense/i }).first().click();
  await aarti.waitForSelector('[role="dialog"]');
  await aarti.fill('#expense-title', 'Realtime QA dinner');
  await aarti.fill('#expense-amount', '4000');
  await aarti.getByRole('button', { name: /^add expense$/i }).last().click();
  await aarti.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 });
  console.log('  expense created');

  /* ---- Rahul's view must update on its own ---- */
  console.log('\nWaiting for Rahul to update (no reload)…');
  let rahulAfter = rahulBefore;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await rahul.waitForTimeout(500);
    rahulAfter = await readOwed(rahul);
    if (rahulAfter !== rahulBefore) break;
  }

  console.log(`Rahul owes (after):  ${rahulAfter}`);

  check(rahulAfter !== rahulBefore, 'second member balance updated live');

  const sentinel = await rahul.evaluate(() => window.__qaSentinel);
  check(sentinel === 'alive', 'no page reload occurred (window state preserved)');

  // Aarti's own view must also reflect it immediately.
  await aarti.waitForTimeout(1500);
  const aartiText = await aarti.locator('text=Recent expenses').locator('xpath=../..').innerText();
  check(/Realtime QA dinner/.test(aartiText), 'author sees the new expense in the feed');

  /* ---- Settlement moves only the live region ---- */
  console.log('\nChecking a settlement updates balances…');
  const rahulOwedBeforeSettle = await readOwed(rahul);
  await rahul.getByRole('button', { name: /^settle$/i }).first().click();
  await rahul.waitForSelector('[role="dialog"]');
  await rahul.waitForTimeout(1200);
  await rahul.fill('#settle-amount', '100');
  await rahul.getByRole('button', { name: /record payment/i }).click();
  await rahul.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15_000 });
  console.log('  settlement submitted');

  // Pending settlements must NOT change a balance until approved.
  await rahul.waitForTimeout(2000);
  const rahulOwedAfterSettle = await readOwed(rahul);
  check(
    rahulOwedAfterSettle === rahulOwedBeforeSettle,
    'a pending settlement does NOT change the balance',
  );

  await rahul.screenshot({ path: 'qa/screenshots/e2e-rahul-mobile.png', fullPage: true });
  await aarti.screenshot({ path: 'qa/screenshots/e2e-aarti-desktop.png', fullPage: true });

  await browser.close();

  console.log('\n' + '='.repeat(60));
  console.log(`FAILURES: ${failures.length}`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(failures.length > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error('E2E failed:', error);
  process.exit(1);
});
