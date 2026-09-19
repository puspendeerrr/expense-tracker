/**
 * Responsive QA.
 *
 * Drives the real app in Chromium at every target width, screenshots each one, and
 * asserts the things that are easy to break and easy to miss:
 *
 *   - no horizontal overflow (scrollWidth > clientWidth)
 *   - no element bleeding past the right edge of the viewport
 *   - every interactive control meets a 44px touch target on phones
 *   - opening a dialog locks background scroll, and closing restores it
 *   - the dialog body scrolls independently of the page
 *
 *   node qa/responsive.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:5173';
const EMAIL = 'aarti@qa.local';
const PASSWORD = 'QaPassword1';
const OUT = path.resolve('qa/screenshots');

const VIEWPORTS = [
  { name: '320-galaxy-fold', width: 320, height: 720, mobile: true },
  { name: '360-android', width: 360, height: 780, mobile: true },
  { name: '375-iphone-se', width: 375, height: 667, mobile: true },
  { name: '390-iphone-14', width: 390, height: 844, mobile: true },
  { name: '412-pixel', width: 412, height: 915, mobile: true },
  { name: '430-iphone-pro-max', width: 430, height: 932, mobile: true },
  { name: '768-tablet', width: 768, height: 1024, mobile: false },
  { name: '1024-tablet-landscape', width: 1024, height: 768, mobile: false },
  { name: '1280-laptop', width: 1280, height: 800, mobile: false },
  { name: '1440-desktop', width: 1440, height: 900, mobile: false },
  { name: '1920-wide', width: 1920, height: 1080, mobile: false },
];

const failures = [];
const warnings = [];

const fail = (viewport, message) => {
  failures.push(`[${viewport}] ${message}`);
  console.log(`  FAIL  ${message}`);
};
const warn = (viewport, message) => {
  warnings.push(`[${viewport}] ${message}`);
  console.log(`  WARN  ${message}`);
};
const pass = (message) => console.log(`  pass  ${message}`);

/** Page-level horizontal overflow plus the specific element that causes it. */
const checkOverflow = async (page, viewport, label) => {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth - doc.clientWidth;
    const offenders = [];

    if (overflow > 0) {
      const viewportWidth = doc.clientWidth;
      for (const element of document.querySelectorAll('body *')) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.right > viewportWidth + 1) {
          offenders.push({
            tag: element.tagName.toLowerCase(),
            cls: (element.className || '').toString().slice(0, 80),
            right: Math.round(rect.right),
          });
          if (offenders.length >= 3) break;
        }
      }
    }
    return { overflow, offenders, clientWidth: doc.clientWidth };
  });

  if (result.overflow > 0) {
    const detail = result.offenders
      .map((o) => `${o.tag}.${o.cls.split(' ')[0]} right=${o.right}`)
      .join('; ');
    fail(viewport, `${label}: horizontal overflow of ${result.overflow}px — ${detail}`);
    return false;
  }
  pass(`${label}: no horizontal overflow`);
  return true;
};

/** Touch-target audit for phone widths. */
const checkTouchTargets = async (page, viewport, label) => {
  const small = await page.evaluate(() => {
    const MIN = 44;
    const bad = [];
    const selector = 'button, a[href], [role="button"], input, select, textarea';
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      // Inline text links are not thumb targets in the same way.
      if (element.tagName === 'A' && style.display.includes('inline')) continue;
      if (rect.height < MIN - 0.5) {
        bad.push({
          tag: element.tagName.toLowerCase(),
          text: (element.textContent || '').trim().slice(0, 24),
          h: Math.round(rect.height),
        });
      }
    }
    return bad.slice(0, 6);
  });

  if (small.length > 0) {
    const detail = small.map((s) => `${s.tag}"${s.text}" ${s.h}px`).join('; ');
    warn(viewport, `${label}: ${small.length} control(s) under 44px — ${detail}`);
    return false;
  }
  pass(`${label}: touch targets >= 44px`);
  return true;
};

/** Font sizes below 16px on inputs cause iOS Safari to zoom the viewport on focus. */
const checkInputFontSize = async (page, viewport) => {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('input, textarea, select')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0) return false;
        return parseFloat(getComputedStyle(element).fontSize) < 16;
      })
      .map((element) => ({
        type: element.getAttribute('type') || element.tagName.toLowerCase(),
        size: getComputedStyle(element).fontSize,
      }))
      .slice(0, 5),
  );

  if (small.length > 0) {
    warn(
      viewport,
      `inputs below 16px would trigger iOS zoom: ${small.map((s) => `${s.type}=${s.size}`).join(', ')}`,
    );
    return false;
  }
  pass('inputs at 16px+ (no iOS zoom)');
  return true;
};

const run = async () => {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  // ---- Sign in once; the session cookie persists across viewports. ----
  console.log('\nSigning in…');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app', { timeout: 20_000 });
  await page.waitForSelector('text=Your position', { timeout: 20_000 });
  console.log('Signed in.\n');

  for (const viewport of VIEWPORTS) {
    console.log(`── ${viewport.name} (${viewport.width}×${viewport.height})`);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Your position', { timeout: 20_000 });
    // Let charts finish their resize pass.
    await page.waitForTimeout(700);

    await checkOverflow(page, viewport.name, 'dashboard');
    if (viewport.mobile) await checkTouchTargets(page, viewport.name, 'dashboard');

    await page.screenshot({
      path: path.join(OUT, `${viewport.name}-dashboard.png`),
      fullPage: true,
    });

    /* ---- Filter dialog ---- */
    const filterButton = page.getByRole('button', { name: /filters/i }).first();
    if (await filterButton.count()) {
      await filterButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
      await page.waitForTimeout(350);

      await checkOverflow(page, viewport.name, 'filter dialog');
      await page.screenshot({ path: path.join(OUT, `${viewport.name}-filters.png`) });

      // Background scroll must be locked while a dialog is open.
      const locked = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.overflow === 'hidden' || style.position === 'fixed';
      });
      if (locked) pass('filter dialog locks background scroll');
      else fail(viewport.name, 'filter dialog does NOT lock background scroll');

      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);

      const restored = await page.evaluate(
        () => getComputedStyle(document.body).overflow !== 'hidden',
      );
      if (restored) pass('background scroll restored on close');
      else fail(viewport.name, 'background scroll NOT restored after closing filter dialog');
    }

    /* ---- Add expense dialog ---- */
    const addButton = page.getByRole('button', { name: /add expense/i }).first();
    if (await addButton.count()) {
      await addButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
      await page.waitForTimeout(350);

      await checkOverflow(page, viewport.name, 'add expense dialog');
      if (viewport.mobile) await checkInputFontSize(page, viewport.name);

      // The sticky footer submit must be inside the viewport, not below the fold.
      const submitVisible = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        const submit = dialog.querySelector('button[type="submit"]');
        if (!submit) return false;
        const rect = submit.getBoundingClientRect();
        return rect.bottom <= window.innerHeight + 1 && rect.top >= 0;
      });
      if (submitVisible) pass('sticky submit button reachable without scrolling');
      else fail(viewport.name, 'submit button is NOT visible within the dialog viewport');

      // The dialog body, not the page, is what scrolls.
      const bodyScrolls = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        const scroller = [...dialog.querySelectorAll('div')].find(
          (element) => element.scrollHeight > element.clientHeight + 4,
        );
        return Boolean(scroller);
      });
      if (bodyScrolls) pass('dialog body scrolls independently');
      else warn(viewport.name, 'dialog content fits without scrolling (not necessarily a bug)');

      await page.screenshot({ path: path.join(OUT, `${viewport.name}-add-expense.png`) });

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    console.log('');
  }

  /* ---- Filter application must not blank the dashboard ---- */
  console.log('── filter application (no full reload)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Your position');
  await page.waitForTimeout(600);

  const balanceBefore = await page
    .locator('text=Net balance')
    .locator('xpath=../..')
    .innerText();

  await page.getByRole('button', { name: /filters/i }).first().click();
  await page.waitForSelector('[role="dialog"]');
  await page.getByRole('button', { name: 'This month', exact: true }).click();
  await page.getByRole('button', { name: /apply filters/i }).click();
  await page.waitForTimeout(200);

  // Immediately after applying, the balance card must still be on screen.
  const stillPresent = await page.locator('text=Net balance').count();
  if (stillPresent > 0) pass('balances stay rendered while analytics refetch');
  else fail('390-filter', 'dashboard blanked after applying a filter');

  await page.waitForTimeout(1200);
  const balanceAfter = await page
    .locator('text=Net balance')
    .locator('xpath=../..')
    .innerText();

  if (balanceBefore === balanceAfter) pass('date filter did NOT change the live balance');
  else fail('390-filter', `date filter changed the balance: "${balanceBefore}" -> "${balanceAfter}"`);

  await page.screenshot({ path: path.join(OUT, 'filter-applied-390.png'), fullPage: true });

  await browser.close();

  /* ---- Report ---- */
  console.log('\n' + '='.repeat(70));
  if (consoleErrors.length) {
    console.log(`\nConsole errors (${consoleErrors.length}):`);
    for (const error of consoleErrors.slice(0, 10)) console.log(`  - ${error}`);
  } else {
    console.log('\nNo console errors.');
  }

  console.log(`\nFAILURES: ${failures.length}`);
  for (const failure of failures) console.log(`  ${failure}`);
  console.log(`\nWARNINGS: ${warnings.length}`);
  for (const warning of warnings) console.log(`  ${warning}`);
  console.log(`\nScreenshots: ${OUT}`);

  process.exit(failures.length > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error('QA run failed:', error);
  process.exit(1);
});
