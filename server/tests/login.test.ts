import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, sessionCookie, signupUser, VALID_PASSWORD } from './helpers.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const EMAIL = 'grace@example.com';

describe('login', () => {
  it('signs in a verified user and sets a session cookie', async () => {
    await signupUser(EMAIL);

    const res = await api()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: VALID_PASSWORD })
      .expect(200);

    expect(res.body.data.user.email).toBe(EMAIL);
    expect(sessionCookie(res)).toMatch(/^sw_session=/);
  });

  it('accepts a differently-cased email', async () => {
    await signupUser(EMAIL);
    await api()
      .post('/api/auth/login')
      .send({ email: 'GRACE@Example.com', password: VALID_PASSWORD })
      .expect(200);
  });

  it('returns the same generic error for a wrong password and an unknown account', async () => {
    await signupUser(EMAIL);

    const wrongPassword = await api()
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'WrongPass123' })
      .expect(401);

    const unknownUser = await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPass123' })
      .expect(401);

    // No account enumeration: identical status, code and message.
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownUser.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.body.error.message).toBe('Invalid email or password.');
    expect(unknownUser.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('does not apply password-strength rules to the login field', async () => {
    // A short password must fail as INVALID_CREDENTIALS, not VALIDATION_ERROR, or the
    // error itself becomes an oracle.
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'x' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects a malformed email before touching the database', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: VALID_PASSWORD })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('signs in a seeded admin and confirms admin role in response and session', async () => {
    const { seedAdmin } = await import('../src/db/seedAdmin.js');
    await seedAdmin();

    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'admin@gmail.com', password: 'Master@123' })
      .expect(200);

    expect(res.body.data.user.email).toBe('admin@gmail.com');
    expect(res.body.data.user.role).toBe('admin');

    const cookie = sessionCookie(res)!;
    const meRes = await api().get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(meRes.body.data.user.role).toBe('admin');
  });
});

describe('session lifecycle', () => {
  it('rejects /me without a cookie', async () => {
    const res = await api().get('/api/auth/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects /me with a forged cookie and clears it', async () => {
    const res = await api().get('/api/auth/me').set('Cookie', 'sw_session=not-a-real-token').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
    expect(String(res.headers['set-cookie'] ?? '')).toContain('sw_session=;');
  });

  it('revokes the session on logout', async () => {
    const { cookie } = await signupUser(EMAIL);

    await api().get('/api/auth/me').set('Cookie', cookie).expect(200);
    await api().post('/api/auth/logout').set('Cookie', cookie).expect(200);

    // The same cookie is now dead server-side, not merely cleared in the browser.
    await api().get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('gates the protected placeholder route', async () => {
    const { cookie } = await signupUser(EMAIL);

    await api().get('/api/app/overview').expect(401);
    const ok = await api().get('/api/app/overview').set('Cookie', cookie).expect(200);
    expect(ok.body.data.greeting).toContain('Test');
  });
});
