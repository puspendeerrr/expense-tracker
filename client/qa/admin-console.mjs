import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * Admin console QA.
 *
 * Walks every /admin route at phone and desktop width, in light and dark, checking for
 * overflow, console errors, undersized tap targets and the presence of the contextual
 * action menus.
 */

await mkdir('qa/screenshots', { recursive: true });

const ROUTES = [
  ['/admin', 'overview'],
  ['/admin/users', 'users'],
  ['/admin/groups', 'groups'],
  ['/admin/expenses', 'expenses'],
  ['/admin/settlements', 'settlements'],
  ['/admin/activity', 'activity'],
  ['/admin/permissions', 'permissions'],
  ['/admin/reports', 'reports'],
  ['/admin/audit', 'audit'],
];

const VIEWPORTS = [
  { name: '320', width: 320, height: 720, mobile: true },
  { name: '390', width: 390, height: 844, mobile: true },
  { name: '768', width: 768, height: 1024, mobile: false },
  { name: '1280', width: 1280, height: 800, mobile: false },
  { name: '1920', width: 1920, height: 1080, mobile: false },
];

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 800 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const text = m.text();
  if (m.type() === 'error' && !text.includes('401') && !text.includes('403')) {
    failures.push(`console: ${text}`);
  }
});

const overflow = () =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const setTheme = async (value) => {
  await page.evaluate((v) => {
    try {
      localStorage.setItem('splitmoney-theme', v);
    } catch {
      /* ignore */
    }
  }, value);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
};

/* ---- 1. Every route, every breakpoint ---- */

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  let worst = 0;

  for (const [path, label] of ROUTES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);

    const body = await page.locator('body').innerText();
    if (/do not have access to the admin console/i.test(body)) {
      failures.push(`[${vp.name}] ${label}: admin console denied access`);
      continue;
    }

    const over = await overflow();
    if (over > 0) {
      failures.push(`[${vp.name}] ${label}: overflow ${over}px`);
      worst = Math.max(worst, over);
    }

    if (vp.name === '390' || vp.name === '1280') {
      await page.screenshot({ path: `qa/screenshots/admin-${vp.name}-${label}.png` });
    }
  }

  if (vp.mobile) {
    const small = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || st.display === 'none') continue;
        if (el.tagName === 'A' && st.display.includes('inline')) continue;
        if (r.height < 43.5) bad.push(`${el.tagName}"${(el.textContent || '').trim().slice(0, 16)}" ${Math.round(r.height)}px`);
      }
      return bad.slice(0, 4);
    });
    if (small.length) failures.push(`[${vp.name}] small targets: ${small.join('; ')}`);
  }

  console.log(`  ${vp.name}px: overflow=${worst}`);
}

/* ---- 2. Contextual action menus ---- */

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const menuButtons = await page.locator('button[aria-label^="Actions for"]').count();
console.log('row action menus on users:', menuButtons);
if (menuButtons === 0) failures.push('no contextual action menus rendered on users');

if (menuButtons > 0) {
  await page.locator('button[aria-label^="Actions for"]').first().click();
  await page.waitForTimeout(500);
  const menuItems = await page.locator('[role="menuitem"]').count();
  console.log('items in the first action menu:', menuItems);
  if (menuItems === 0) failures.push('action menu opened with no items');
  await page.keyboard.press('Escape');
}

/* ---- 3. Debounced search ---- */

const searchBox = page.locator('input[aria-label="Search users"]');
if (await searchBox.count()) {
  await searchBox.fill('zzzzznomatch');
  await page.waitForTimeout(1200);
  const emptyText = await page.locator('body').innerText();
  const showsEmpty = /no users match/i.test(emptyText);
  console.log('search empty state:', showsEmpty);
  if (!showsEmpty) failures.push('search did not reach the empty state');
  await searchBox.fill('');
  await page.waitForTimeout(900);
} else {
  failures.push('user search box missing');
}

/* ---- 4. Dark mode ---- */

await setTheme('dark');
const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
console.log('dark class applied:', isDark, '| body background:', bg);
if (!isDark) failures.push('dark theme class was not applied');

const darkOverflow = await overflow();
if (darkOverflow > 0) failures.push(`dark mode overflow ${darkOverflow}px`);
await page.screenshot({ path: 'qa/screenshots/admin-dark-users.png' });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'qa/screenshots/admin-dark-mobile.png' });

await setTheme('light');

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const failure of failures) console.log(' -', failure);
process.exit(failures.length ? 1 : 0);
