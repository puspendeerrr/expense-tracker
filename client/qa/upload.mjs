import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { signedInContext, BASE } from './session.mjs';

/**
 * Group avatar upload, through the real UI.
 *
 * Drives the actual file input rather than calling Cloudinary directly, so it exercises
 * the whole path: picker -> client-side compression -> unsigned upload -> our PATCH ->
 * the image appearing in the sidebar.
 */

await mkdir('qa/screenshots', { recursive: true });
await mkdir('qa/tmp', { recursive: true });

// A real PNG, big enough that the compression step is exercised.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAP0lEQVR42u3QMQEAAAjDMPBv2hjA' +
    'CRMkVnpYQAwEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQPAYWZoAAT0lQDsAAAAASUVORK5CYII=',
  'base64',
);
const filePath = 'qa/tmp/avatar.png';
await writeFile(filePath, png);

const fails = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 900 });

page.on('pageerror', (e) => fails.push('pageerror: ' + e.message));

await page.goto(BASE + '/app/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const card = await page.locator('body').innerText();
if (!/group appearance/i.test(card)) fails.push('Group appearance card missing');

// The inputs are display:none; setInputFiles does not require visibility.
const inputs = page.locator('input[type="file"]');
const count = await inputs.count();
console.log('file inputs on the page:', count);
if (count < 2) fails.push('expected an avatar and a cover input');

await inputs.first().setInputFiles(filePath);

// Upload + PATCH round trip.
await page.waitForTimeout(6000);

const body = await page.locator('body').innerText();
const failed = /could not be uploaded|uploaded, but could not be saved|too large/i.test(body);
console.log('error message shown:', failed);
if (failed) {
  const msg = body.match(/(could not be uploaded[^\n]*|uploaded, but could not be saved[^\n]*)/i);
  fails.push('upload reported an error: ' + (msg ? msg[0] : 'unknown'));
}

// The saved URL should now be on the group.
const saved = await page.evaluate(async () => {
  const res = await fetch('/api/groups', { credentials: 'include' });
  const json = await res.json();
  const group = json.data.groups[0];
  return { avatarUrl: group?.avatarUrl ?? null };
});
console.log('group avatarUrl after upload:', saved.avatarUrl ? 'set' : 'null');
if (!saved.avatarUrl) fails.push('avatarUrl was not persisted on the group');
else if (!saved.avatarUrl.startsWith('https://res.cloudinary.com/')) {
  fails.push('avatarUrl is not a Cloudinary URL: ' + saved.avatarUrl);
}

// And it should be rendered.
const rendered = await page.evaluate(
  (url) => [...document.querySelectorAll('img')].some((i) => (i.currentSrc || i.src) === url),
  saved.avatarUrl,
);
console.log('avatar rendered on screen:', rendered);
if (saved.avatarUrl && !rendered) fails.push('avatar did not render after upload');

await page.screenshot({ path: 'qa/screenshots/upload-avatar.png' });

// Put the group back how it was.
await page.evaluate(async () => {
  const res = await fetch('/api/groups', { credentials: 'include' });
  const json = await res.json();
  const id = json.data.groups[0].id;
  await fetch(`/api/groups/${id}/media`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      avatar: { url: null, publicId: null },
      cover: { url: null, publicId: null },
    }),
  });
});

await context.close();
await browser.close();

console.log('\nFAILURES: ' + fails.length);
for (const f of fails) console.log(' - ' + f);
process.exit(fails.length ? 1 : 0);
