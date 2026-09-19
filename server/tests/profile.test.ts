import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, closeDatabase, resetAll, signupUser, VALID_PASSWORD } from './helpers.js';

beforeEach(resetAll);
afterAll(closeDatabase);

const EMAIL = 'profile-test@example.com';

describe('profile management', () => {
  describe('PATCH /api/auth/profile', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await api()
        .patch('/api/auth/profile')
        .send({ fullName: 'New Name' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('updates full name, upiId, and qrCodeUrl successfully', async () => {
      const { cookie } = await signupUser(EMAIL);

      const updateRes = await api()
        .patch('/api/auth/profile')
        .set('Cookie', cookie)
        .send({
          fullName: 'Alex Morgan',
          upiId: 'alex@oksbi',
          qrCodeUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD',
        })
        .expect(200);

      expect(updateRes.body.data.user.fullName).toBe('Alex Morgan');
      expect(updateRes.body.data.user.upiId).toBe('alex@oksbi');
      expect(updateRes.body.data.user.qrCodeUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD');

      // Check /me reflects the changes
      const meRes = await api()
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(meRes.body.data.user.fullName).toBe('Alex Morgan');
      expect(meRes.body.data.user.upiId).toBe('alex@oksbi');
      expect(meRes.body.data.user.qrCodeUrl).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD');
    });

    it('allows clearing upiId and qrCodeUrl with empty strings or null', async () => {
      const { cookie } = await signupUser(EMAIL);

      // First set them
      await api()
        .patch('/api/auth/profile')
        .set('Cookie', cookie)
        .send({
          upiId: 'user@upi',
          qrCodeUrl: 'https://example.com/qr.png',
        })
        .expect(200);

      // Now clear them
      const clearRes = await api()
        .patch('/api/auth/profile')
        .set('Cookie', cookie)
        .send({
          upiId: '',
          qrCodeUrl: null,
        })
        .expect(200);

      expect(clearRes.body.data.user.upiId).toBeNull();
      expect(clearRes.body.data.user.qrCodeUrl).toBeNull();
    });

    it('rejects an invalid UPI ID format', async () => {
      const { cookie } = await signupUser(EMAIL);

      const res = await api()
        .patch('/api/auth/profile')
        .set('Cookie', cookie)
        .send({
          upiId: 'invalid-upi-without-at',
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields.some((f: { field: string }) => f.field === 'upiId')).toBe(true);
    });

    it('rejects too short a full name', async () => {
      const { cookie } = await signupUser(EMAIL);

      const res = await api()
        .patch('/api/auth/profile')
        .set('Cookie', cookie)
        .send({
          fullName: 'A',
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields.some((f: { field: string }) => f.field === 'fullName')).toBe(true);
    });
  });

  describe('POST /api/auth/profile/password', () => {
    it('rejects unauthenticated requests', async () => {
      const res = await api()
        .post('/api/auth/profile/password')
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: 'BrandNewPassword123',
          confirmPassword: 'BrandNewPassword123',
        })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects incorrect current password', async () => {
      const { cookie } = await signupUser(EMAIL);

      const res = await api()
        .post('/api/auth/profile/password')
        .set('Cookie', cookie)
        .send({
          currentPassword: 'WrongPassword999',
          newPassword: 'BrandNewPassword123',
          confirmPassword: 'BrandNewPassword123',
        })
        .expect(400);

      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Current password is not correct.');
    });

    it('rejects mismatched new passwords', async () => {
      const { cookie } = await signupUser(EMAIL);

      const res = await api()
        .post('/api/auth/profile/password')
        .set('Cookie', cookie)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: 'BrandNewPassword123',
          confirmPassword: 'DifferentPassword123',
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects weak new passwords', async () => {
      const { cookie } = await signupUser(EMAIL);

      const res = await api()
        .post('/api/auth/profile/password')
        .set('Cookie', cookie)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: 'weak',
          confirmPassword: 'weak',
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully changes password and allows login with new password', async () => {
      const { cookie } = await signupUser(EMAIL);
      const NEW_PASSWORD = 'BrandNewPassword123';

      const changeRes = await api()
        .post('/api/auth/profile/password')
        .set('Cookie', cookie)
        .send({
          currentPassword: VALID_PASSWORD,
          newPassword: NEW_PASSWORD,
          confirmPassword: NEW_PASSWORD,
        })
        .expect(200);

      expect(changeRes.body.data.passwordChanged).toBe(true);

      // Old password should now fail login
      await api()
        .post('/api/auth/login')
        .send({ email: EMAIL, password: VALID_PASSWORD })
        .expect(401);

      // New password should succeed
      const loginRes = await api()
        .post('/api/auth/login')
        .send({ email: EMAIL, password: NEW_PASSWORD })
        .expect(200);

      expect(loginRes.body.data.user.email).toBe(EMAIL);
    });
  });
});
