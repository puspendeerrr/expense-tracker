import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import searchRoutes from './routes/searchRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import pushRoutes from './routes/pushRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import insightRoutes from './routes/insightRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { loadSession, requireAuth } from './middleware/requireAuth.js';
import { asyncHandler, sendOk } from './utils/http.js';
import { logger } from './utils/logger.js';

export const createApp = (): Express => {
  const app = express();

  // Needed for correct `req.ip` (and therefore correct rate limiting) behind a proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // This process serves JSON only; the SPA is hosted separately.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      // The SPA is served from a different site in production, so `same-site` would
      // block it from reading responses.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  const allowed = new Set(env.CLIENT_ORIGINS);
  app.use(
    cors({
      origin: (origin, callback) => {
        // Same-origin/server-to-server requests send no Origin header.
        if (!origin) return callback(null, true);
        const normalized = origin.trim().replace(/\/+$/, '');
        if (allowed.has(normalized)) return callback(null, true);
        // Includes the allow-list: a blocked origin is almost always a typo or a
        // missing env var, and the log is useless without both halves of the comparison.
        logger.warn('cors.blocked', { origin, allowed: [...allowed] });
        return callback(null, false);
      },
      // Required for the session cookie to travel at all.
      credentials: true,
      // The API uses PATCH (expense edits, permission changes), PUT (dashboard scope)
      // and DELETE (expenses, groups, members). Omitting them makes every one of those
      // fail CORS preflight in a cross-origin deployment while working fine locally
      // behind the Vite proxy -- a failure that only ever shows up in production.
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Accept'],
      // The report download reads the filename from this header, which is not exposed
      // to cross-origin JavaScript unless it is named here.
      exposedHeaders: ['Content-Disposition'],
      maxAge: 600,
    }),
  );

  // Auth payloads are tiny; a small cap is free DoS protection.
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: false, limit: '5mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    sendOk(res, { status: 'ok', environment: env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/insights', insightRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/ai', aiRoutes);

  /**
   * Placeholder for the authenticated area. The real dashboard is out of scope for this
   * milestone; this exists so the protected-route contract is exercised end to end.
   */
  app.get(
    '/api/app/overview',
    asyncHandler(loadSession),
    requireAuth,
    asyncHandler(async (req, res) => {
      sendOk(res, {
        greeting: `Welcome back, ${req.user!.fullName.split(' ')[0]}`,
        placeholder: true,
      });
    }),
  );

  /*
   * Serve the built frontend from this same server, when it is present.
   *
   * Set CLIENT_DIST_PATH to the client's `dist` directory (the container image does
   * this) and the SPA is served from the same origin as the API. That is not merely
   * convenient -- it removes a whole class of deployment problem:
   *
   *   - no CORS, because there is no cross-origin request left to allow
   *   - the session cookie is same-site, so SameSite=Lax works and Safari's
   *     third-party cookie blocking never comes into it
   *   - the service worker and web push, which require a secure same-origin scope,
   *     both just work
   *
   * Left unset, nothing changes and the API serves only /api -- which is what the local
   * dev setup wants, where Vite serves the frontend and proxies across.
   */
  const clientDist = env.CLIENT_DIST_PATH;

  if (clientDist && existsSync(clientDist)) {
    /*
     * Vite emits content-hashed filenames, so an asset's URL changes whenever its
     * content does and it can be cached indefinitely.
     *
     * `index: false` means this middleware never serves index.html -- the fallback
     * below does, and that is where its caching is set. Handling it here too would be
     * dead code that looks like it is doing something.
     */
    app.use(express.static(clientDist, { index: false, maxAge: '1y' }));

    /*
     * SPA fallback.
     *
     * Registered after every API route and scoped to GET requests that are not /api,
     * so an unknown endpoint still returns the JSON 404 the client expects rather than
     * an HTML page it cannot parse. Without that scoping, a typo in an API path
     * surfaces as a confusing parse error instead of a clear 404.
     */
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) {
        next();
        return;
      }
      /*
       * Never cached.
       *
       * index.html names the hashed bundles, so a cached copy outlives the deploy that
       * replaced them and points browsers at files that no longer exist -- a blank page
       * that a refresh does not fix. Express's default here is `max-age=0`, which
       * merely revalidates; no-store is what actually guarantees a fresh shell.
       */
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.sendFile(path.join(clientDist, 'index.html'));
    });

    logger.info('static.serving', { path: clientDist });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
