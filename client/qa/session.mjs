import { existsSync, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Shared QA session.
 *
 * Logs in once and reuses the stored cookie across runs. Repeatedly signing in trips the
 * login rate limiter (10 attempts per 15 minutes per email) -- which is the control
 * working correctly, but it makes QA unrunnable. Reusing the session is both faster and
 * closer to how a real user behaves.
 */

export const BASE = process.env.QA_BASE_URL ?? 'http://localhost:5173';
export const QA_EMAIL = process.env.QA_EMAIL ?? 'aarti@qa.local';
export const QA_PASSWORD = process.env.QA_PASSWORD ?? 'QaPassword1';

const STATE_PATH = path.resolve('qa/.auth.json');
/** Sessions last 30 days server-side; refresh well inside that. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

const isFresh = () => {
  if (!existsSync(STATE_PATH)) return false;
  return Date.now() - statSync(STATE_PATH).mtimeMs < MAX_AGE_MS;
};

/** Returns a context that is already signed in, logging in only when necessary. */
export const signedInContext = async (browser, viewport) => {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });

  if (isFresh()) {
    const context = await browser.newContext({ viewport, storageState: STATE_PATH });
    const page = await context.newPage();
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });

    // The stored cookie may have been revoked; fall through to a fresh login if so.
    if (page.url().includes('/app')) return { context, page };
    await context.close();
  }

  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', QA_EMAIL);
  await page.fill('input[type="password"]', QA_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/app', { timeout: 25_000 });
  await context.storageState({ path: STATE_PATH });
  return { context, page };
};
