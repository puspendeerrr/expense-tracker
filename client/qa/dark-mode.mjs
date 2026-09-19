import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * Dark mode QA for the whole product.
 *
 * The app was authored in literal slate colours and migrated to semantic tokens, so the
 * failure this run is built to catch is a surface that was missed: a card, header or
 * control still painting itself light while everything around it went dark. Contrast is
 * measured rather than eyeballed, because a single stray `bg-white` reads as fine in a
 * screenshot thumbnail and is unusable in practice.
 *
 * The landing page is checked for the opposite property: it must stay light regardless
 * of the preference.
 */

await mkdir('qa/screenshots', { recursive: true });

const PAGES = [
  ['/app', 'dashboard'],
  ['/app/expenses', 'expenses'],
  ['/app/members', 'members'],
  ['/app/settlements', 'settlements'],
  ['/app/activity', 'activity'],
  ['/app/spending', 'spending'],
  ['/app/settings', 'settings'],
  ['/app/profile', 'profile'],
  ['/admin', 'admin-overview'],
  ['/admin/users', 'admin-users'],
];

const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '1280', width: 1280, height: 800 },
];

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 800 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));

const setTheme = async (value) => {
  await page.evaluate((v) => {
    try {
      localStorage.setItem('splitwise-theme', v);
    } catch {
      /* ignore */
    }
  }, value);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
};

/** Relative luminance of an `rgb(...)` string, 0 (black) to 1 (white). */
const luminance = (rgb) => {
  const [r, g, b] = (rgb.match(/\d+/g) ?? [0, 0, 0]).map(Number);
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/**
 * Finds elements painting a light background while the page is dark.
 *
 * Only elements with a genuinely opaque background count: a translucent overlay over a
 * dark page is fine, and reading its declared colour alone would flag it wrongly.
 */
const findLightSurfaces = () =>
  page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const style = getComputedStyle(el);
      const bg = style.backgroundColor;
      const match = bg.match(/rgba?\(([^)]+)\)/);
      if (!match) continue;
      const parts = match[1].split(',').map((p) => parseFloat(p));
      const alpha = parts.length > 3 ? parts[3] : 1;
      if (alpha < 0.9) continue;

      const [r, g, b] = parts;
      // Near-white and large enough to matter as a surface rather than a dot.
      const rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 20) continue;
      if (r > 230 && g > 230 && b > 230) {
        bad.push(
          `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} ${bg}`,
        );
      }
    }
    return [...new Set(bad)].slice(0, 5);
  });

/* ---- 1. Dark mode across every signed-in page ---- */

await setTheme('dark');

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });

  for (const [path, label] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);

    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    if (!isDark) {
      failures.push(`[${vp.name}] ${label}: dark class missing`);
      continue;
    }

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (luminance(bodyBg) > 0.3) {
      failures.push(`[${vp.name}] ${label}: body still light (${bodyBg})`);
    }

    const stray = await findLightSurfaces();
    if (stray.length) {
      failures.push(`[${vp.name}] ${label}: light surfaces in dark mode -> ${stray.join('; ')}`);
    }

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (overflow > 0) failures.push(`[${vp.name}] ${label}: overflow ${overflow}px`);

    if (vp.name === '1280') {
      await page.screenshot({ path: `qa/screenshots/dark-${label}.png` });
    }
  }

  console.log(`  ${vp.name}px: checked ${PAGES.length} pages`);
}

/* ---- 2. The toggle is reachable from the app navbar ---- */

await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const toggle = page.locator('button[aria-label^="Theme:"]');
const toggleCount = await toggle.count();
console.log('theme toggles in the app navbar:', toggleCount);
if (toggleCount === 0) failures.push('no theme toggle in the app navbar');

if (toggleCount > 0) {
  await toggle.first().click();
  await page.waitForTimeout(400);
  const options = await page.locator('[role="menuitem"]').allInnerTexts();
  console.log('options:', options.join(', '));
  for (const expected of ['Light', 'Dark', 'System']) {
    if (!options.some((o) => o.includes(expected))) {
      failures.push(`theme menu is missing "${expected}"`);
    }
  }

  // Switching to light from the navbar must actually repaint the page.
  await page.locator('[role="menuitem"]', { hasText: 'Light' }).first().click();
  await page.waitForTimeout(600);
  const afterBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('body after choosing Light:', afterBg);
  if (luminance(afterBg) < 0.5) failures.push(`light mode did not apply (${afterBg})`);
}

/* ---- 3. The landing page ignores a dark preference ---- */

await setTheme('dark');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const landingBg = await page.evaluate(() => {
  const el = document.querySelector('.force-light');
  return el ? getComputedStyle(el).backgroundColor : null;
});
console.log('landing surface under a dark preference:', landingBg);
if (!landingBg) failures.push('landing page is missing the force-light scope');
else if (luminance(landingBg) < 0.5) failures.push(`landing page went dark (${landingBg})`);
await page.screenshot({ path: 'qa/screenshots/dark-pref-landing.png' });

await setTheme('light');

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const failure of failures) console.log(' -', failure);
process.exit(failures.length ? 1 : 0);
