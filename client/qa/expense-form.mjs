import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * The Add Expense form must not lose what you have typed.
 *
 * The bug: the seeding effect listed `members` in its dependencies, and `members` is a
 * fresh array whenever the parent re-renders or refetches. A realtime event arriving
 * mid-typing therefore reran the effect and cleared the form.
 *
 * Reproducing it needs a *real* refetch, not a bare fetch call -- the dashboard only
 * rebuilds `members` when its own React state changes. So a second browser session
 * creates an expense, which emits the socket event the first session reacts to. That is
 * exactly the situation a user hits: filling the form while somebody else is active.
 */

await mkdir('qa/screenshots', { recursive: true });

const fails = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 900 });

page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));

await page.goto(BASE + '/app', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

/* ---- Open the dialog and fill it in ---- */

await page.locator('button', { hasText: 'Add Expense' }).first().click();
await page.waitForTimeout(1000);

const dialog = page.locator('[role="dialog"]');
if ((await dialog.count()) === 0) {
  fails.push('Add Expense dialog did not open');
} else {
  const title = dialog.locator('input').first();
  await title.fill('Dinner at the new place');

  const amount = dialog.locator('input[inputmode="decimal"]').first();
  const hasAmount = (await amount.count()) > 0;
  if (hasAmount) await amount.fill('1250.50');
  await page.waitForTimeout(400);

  const before = {
    title: await title.inputValue(),
    amount: hasAmount ? await amount.inputValue() : null,
  };
  console.log('typed:', JSON.stringify(before));

  /* ---- Cause a genuine refetch from another session ---- */

  const groupId = await page.evaluate(async () => {
    const res = await fetch('/api/groups', { credentials: 'include' });
    return (await res.json()).data.groups[0].id;
  });

  const other = await browser.newContext({ storageState: 'qa/.auth.json' });
  const otherPage = await other.newPage();
  await otherPage.goto(BASE + '/app', { waitUntil: 'networkidle' });
  await otherPage.waitForTimeout(1200);

  for (let i = 0; i < 2; i++) {
    const status = await otherPage.evaluate(
      async ([id, n]) => {
        const res = await fetch(`/api/groups/${id}/expenses`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `QA form-retention probe ${n}`,
            amount: 11,
            expenseDate: new Date().toISOString().slice(0, 10),
          }),
        });
        return res.status;
      },
      [groupId, `${Date.now()}-${i}`],
    );
    console.log('  probe expense created:', status);
    await page.waitForTimeout(2200);
  }

  await page.waitForTimeout(1500);

  const after = {
    title: await title.inputValue(),
    amount: hasAmount ? await amount.inputValue() : null,
  };
  console.log('after realtime refetches:', JSON.stringify(after));

  if (after.title !== before.title) {
    fails.push(`title was lost: "${before.title}" -> "${after.title}"`);
  }
  if (hasAmount && after.amount !== before.amount) {
    fails.push(`amount was lost: "${before.amount}" -> "${after.amount}"`);
  }

  await page.screenshot({ path: 'qa/screenshots/expense-form-kept.png' });
  await other.close();

  /* ---- Closing and reopening must give a clean form ---- */

  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  await page.locator('button', { hasText: 'Add Expense' }).first().click();
  await page.waitForTimeout(1200);

  const reopened = await page.locator('[role="dialog"] input').first().inputValue();
  console.log('title after reopening:', JSON.stringify(reopened));
  if (reopened !== '') fails.push(`reopened form still held "${reopened}"`);

  await page.keyboard.press('Escape');
}

await context.close();
await browser.close();

console.log('\nFAILURES: ' + fails.length);
for (const f of fails) console.log(' - ' + f);
process.exit(fails.length ? 1 : 0);
