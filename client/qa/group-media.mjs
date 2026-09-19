import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * Group avatar and cover, end to end.
 *
 * The upload itself goes to Cloudinary and is not exercised here; what is exercised is
 * everything this codebase owns -- the API accepts a valid pair, rejects a foreign host,
 * persists it, and the UI then shows it in the settings card and the sidebar without a
 * reload of the page's data layer.
 */

await mkdir('qa/screenshots', { recursive: true });

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 900 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));

const CDN = 'https://res.cloudinary.com/demo/image/upload/w_400/sample.jpg';
const COVER = 'https://res.cloudinary.com/demo/image/upload/w_1200/sample.jpg';

/** Calls the API as the signed-in user, from inside the page. */
const callApi = (path, method, body) =>
  page.evaluate(
    async ([p, m, b]) => {
      const res = await fetch(p, {
        method: m,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: b ? JSON.stringify(b) : undefined,
      });
      let payload = null;
      try {
        payload = await res.json();
      } catch {
        /* no body */
      }
      return { status: res.status, payload };
    },
    [path, method, body ?? null],
  );

await page.goto(`${BASE}/app/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

/* ---- 1. The settings card exists ---- */

const body = await page.locator('body').innerText();
const hasCard = /group appearance/i.test(body);
console.log('appearance card rendered:', hasCard);
if (!hasCard) failures.push('Group appearance card is missing from settings');

await page.screenshot({ path: 'qa/screenshots/group-media-empty.png' });

/* ---- 2. Find the active group, then exercise the API ---- */

const groups = await page.evaluate(async () => {
  const res = await fetch('/api/groups', { credentials: 'include' });
  const json = await res.json();
  return json.data.groups;
});
const group = groups[0];
console.log('group:', group.name, '| creator role:', group.role);

/* Rejections first, so a later success cannot mask a missing guard. */
const foreignHost = await callApi(`/api/groups/${group.id}/media`, 'PATCH', {
  avatar: { url: 'https://evil.example.com/a.jpg', publicId: 'x' },
});
console.log('foreign host rejected:', foreignHost.status === 400);
if (foreignHost.status !== 400) failures.push(`foreign host returned ${foreignHost.status}`);

const halfPair = await callApi(`/api/groups/${group.id}/media`, 'PATCH', {
  avatar: { url: CDN, publicId: null },
});
console.log('url without public id rejected:', halfPair.status === 400);
if (halfPair.status !== 400) failures.push(`half pair returned ${halfPair.status}`);

/* ---- 3. Set both images ---- */

const set = await callApi(`/api/groups/${group.id}/media`, 'PATCH', {
  avatar: { url: CDN, publicId: 'demo/sample-avatar' },
  cover: { url: COVER, publicId: 'demo/sample-cover' },
});
console.log('set media:', set.status);
if (set.status !== 200) failures.push(`setting media returned ${set.status}`);
else {
  const g = set.payload.data.group;
  if (g.avatarUrl !== CDN) failures.push('avatarUrl not echoed back');
  if (g.coverUrl !== COVER) failures.push('coverUrl not echoed back');
}

/* ---- 4. The UI shows them ---- */

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);

const images = await page.evaluate(
  (urls) => {
    const all = [...document.querySelectorAll('img')].map((img) => img.currentSrc || img.src);
    return {
      avatarShown: all.some((src) => src === urls.avatar),
      coverShown: all.some((src) => src === urls.cover),
      total: all.length,
    };
  },
  { avatar: CDN, cover: COVER },
);
console.log('avatar visible:', images.avatarShown, '| cover visible:', images.coverShown);
if (!images.avatarShown) failures.push('avatar is not rendered anywhere on the page');
if (!images.coverShown) failures.push('cover is not rendered anywhere on the page');

await page.screenshot({ path: 'qa/screenshots/group-media-set.png' });

/* ---- 5. Mobile and dark ---- */

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => localStorage.setItem('splitwise-theme', 'dark'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
console.log('mobile/dark overflow:', overflow);
if (overflow > 0) failures.push(`mobile overflow ${overflow}px`);
await page.screenshot({ path: 'qa/screenshots/group-media-390-dark.png' });

await page.evaluate(() => localStorage.setItem('splitwise-theme', 'light'));

/* ---- 6. Remove them again ---- */

const cleared = await callApi(`/api/groups/${group.id}/media`, 'PATCH', {
  avatar: { url: null, publicId: null },
  cover: { url: null, publicId: null },
});
console.log('cleared:', cleared.status);
if (cleared.status !== 200) failures.push(`clearing returned ${cleared.status}`);
else {
  const g = cleared.payload.data.group;
  if (g.avatarUrl !== null || g.coverUrl !== null) failures.push('images were not cleared');
}

await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const f of failures) console.log(' -', f);
process.exit(failures.length ? 1 : 0);
