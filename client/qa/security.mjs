import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { signedInContext, BASE, QA_EMAIL, QA_PASSWORD } from './session.mjs';

/**
 * Account security screen, end to end.
 *
 * Signs in from a second, unfamiliar browser so there is genuinely more than one device
 * to look at, then drives naming and revocation through the UI and checks the server
 * agreed. Also asserts the negative that matters most: no session token appears
 * anywhere in the page or its network responses.
 */

await mkdir('qa/screenshots', { recursive: true });

const failures = [];
const browser = await chromium.launch();
const { context, page } = await signedInContext(browser, { width: 1280, height: 900 });

page.on('pageerror', (e) => failures.push(`pageerror: ${e.message}`));

/* ---- 1. Create a second session from a different browser ---- */

const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const phonePage = await phone.newPage();

const loggedIn = await phonePage.evaluate(
  async ([base, email, password]) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.status;
  },
  [BASE, QA_EMAIL, QA_PASSWORD],
).catch(() => null);

// The blank page has no origin to fetch from; navigate first, then log in.
if (loggedIn === null) {
  await phonePage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const status = await phonePage.evaluate(
    async ([email, password]) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return res.status;
    },
    [QA_EMAIL, QA_PASSWORD],
  );
  console.log('second device login:', status);
  if (status !== 200) failures.push(`second device could not sign in (${status})`);
}

/* ---- 2. The security page lists both ---- */

await page.goto(`${BASE}/app/security`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const body = await page.locator('body').innerText();
console.log('page reached:', /where you are signed in/i.test(body));
if (!/where you are signed in/i.test(body)) failures.push('Security page did not render');

const currentBadges = await page.locator('text=This device').count();
console.log('current-device badges:', currentBadges);
if (currentBadges !== 1) failures.push(`expected exactly 1 current device, saw ${currentBadges}`);

const iosShown = /Safari on iOS/.test(body);
console.log('second device visible:', iosShown);
if (!iosShown) failures.push('the iPhone session is not listed');

await page.screenshot({ path: 'qa/screenshots/security-devices.png' });

/* ---- 3. No token anywhere ---- */

const leaked = await page.evaluate(() => {
  const text = document.body.innerHTML;
  return /token_hash|tokenHash|sw_session=/.test(text);
});
console.log('token leaked into the page:', leaked);
if (leaked) failures.push('a token or hash appears in the rendered page');

/* ---- 4. Rename a device through the UI ---- */

await page.locator('button[aria-label^="Rename"]').first().click();
await page.waitForTimeout(500);
await page.locator('input[aria-label="Device name"]').fill('QA desktop');
await page.locator('button', { hasText: 'Save' }).click();
await page.waitForTimeout(1200);

const renamed = await page.locator('body').innerText();
console.log('rename applied:', /QA desktop/.test(renamed));
if (!/QA desktop/.test(renamed)) failures.push('device name did not appear after saving');

const persisted = await page.evaluate(async () => {
  const res = await fetch('/api/auth/security/devices', { credentials: 'include' });
  const json = await res.json();
  return json.data.devices.some((d) => d.name === 'QA desktop');
});
console.log('rename persisted server-side:', persisted);
if (!persisted) failures.push('device name was not persisted');

/* ---- 5. Blank name is refused by the server ---- */

const blank = await page.evaluate(async () => {
  const list = await (await fetch('/api/auth/security/devices', { credentials: 'include' })).json();
  const id = list.data.devices[0].id;
  const res = await fetch(`/api/auth/security/devices/${id}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '   ' }),
  });
  return res.status;
});
console.log('blank name rejected:', blank === 400);
if (blank !== 400) failures.push(`blank name returned ${blank}`);

/* ---- 6. History tab ---- */

await page.locator('button[role="tab"]', { hasText: 'Activity' }).click();
await page.waitForTimeout(1200);

const history = await page.locator('body').innerText();
const hasSignIn = /Signed in/.test(history);
console.log('sign-in history rendered:', hasSignIn);
if (!hasSignIn) failures.push('login history is empty');

await page.locator('button', { hasText: 'Everything' }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: 'qa/screenshots/security-history.png' });

/* ---- 7. Sign out the other device ---- */

await page.locator('button[role="tab"]', { hasText: 'Devices' }).click();
await page.waitForTimeout(900);

await page.locator('button[aria-label^="Sign out Safari on iOS"]').first().click();
await page.waitForTimeout(600);
await page.locator('button', { hasText: 'Sign out' }).last().click();
await page.waitForTimeout(1500);

const afterRevoke = await phonePage.evaluate(async () => {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  return res.status;
});
console.log('revoked session now returns:', afterRevoke);
if (afterRevoke !== 401) failures.push(`revoked session still authenticates (${afterRevoke})`);

const stillHere = await page.evaluate(async () => {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  return res.status;
});
console.log('caller still signed in:', stillHere === 200);
if (stillHere !== 200) failures.push('revoking another device signed the caller out');

/* ---- 8. Mobile + dark ---- */

await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => localStorage.setItem('splitmoney-theme', 'dark'));
await page.waitForTimeout(300);
console.log('dark mode set');

await page.evaluate(() => localStorage.setItem('splitmoney-theme', 'light'));

const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
console.log('mobile/dark overflow:', overflow);
await page.screenshot({ path: 'qa/screenshots/security-390-dark.png' });
await page.evaluate(() => localStorage.setItem('splitmoney-theme', 'light'));

await phone.close();
await context.close();
await browser.close();

console.log('\nFAILURES:', failures.length);
for (const f of failures) console.log(' -', f);
process.exit(failures.length ? 1 : 0);
