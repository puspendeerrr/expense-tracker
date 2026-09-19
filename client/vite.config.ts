import { createLogger, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { ProxyOptions } from 'vite';

/**
 * Errors that mean "the browser went away", not "something is broken".
 *
 * Every HMR update, route change and closed tab tears down the open WebSocket while the
 * proxy may still be mid-write, and the write then fails with one of these. They are
 * the normal end of a socket's life, not a fault, and printing a fourteen-frame stack
 * trace for each one buries the errors that do matter.
 */
const BENIGN = ['ECONNABORTED', 'ECONNRESET', 'EPIPE', 'ERR_STREAM_WRITE_AFTER_END'];

const isBenign = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  BENIGN.includes(String((error as NodeJS.ErrnoException).code));

/**
 * Attaches error handling to a proxy entry.
 *
 * A socket with no 'error' listener throws on failure, so each upgraded socket needs
 * one regardless of whether anything is logged. Vite installs its own listener too and
 * does the printing, which is why the noise is filtered in the logger below rather than
 * here -- swallowing it at this level would not remove Vite's copy.
 */
const quietProxy: ProxyOptions['configure'] = (proxy) => {
  proxy.on('error', () => {
    /* handled by the custom logger */
  });

  proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
    socket.on('error', () => {
      /* handled by the custom logger */
    });
  });
};

/**
 * Quietens the proxy's socket teardown messages.
 *
 * Vite prints proxy failures through `config.logger.error`, so the only place to filter
 * them is the logger itself. Two things are deliberately preserved: ECONNREFUSED, which
 * means the API is not running and is the single most useful message in this file, and
 * every error that is not a proxy message at all.
 */
const logger = createLogger();
const originalError = logger.error.bind(logger);

logger.error = (message, options) => {
  const text = String(message);
  const isProxyMessage = text.includes('proxy socket error') || text.includes('proxy error');

  if (isProxyMessage) {
    if (BENIGN.some((code) => text.includes(code))) return;
    if (text.includes('ECONNREFUSED')) {
      // One line instead of a stack: the cause is always the same and the fix is too.
      originalError('[proxy] API server is not reachable on http://localhost:5000', options);
      return;
    }
  }

  originalError(message, options);
};

export default defineConfig({
  plugins: [react()],
  customLogger: logger,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        configure: quietProxy,
      },
      // Socket.IO shares the API origin so the session cookie is sent with the
      // handshake. `ws: true` is required or the upgrade request is not forwarded and
      // the client silently falls back to reporting itself offline.
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: quietProxy,
      },
    },
  },
});
