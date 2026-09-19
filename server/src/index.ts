import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';
import { logger } from './utils/logger.js';
import { closeRealtime, initRealtime } from './realtime/socketServer.js';

const app = createApp();

/**
 * Express is wrapped in a bare HTTP server so Socket.IO can share the same port and,
 * critically, the same session cookie as the REST API.
 */
const server = createServer(app);
initRealtime(server);

server.listen(env.PORT, () => {
  logger.info('server.started', {
    port: env.PORT,
    environment: env.NODE_ENV,
    allowedOrigins: env.CLIENT_ORIGINS,
    emailTransport: env.RESEND_API_KEY ? 'resend' : 'unconfigured',
    realtime: 'socket.io',
  });
});

const shutdown = (signal: string): void => {
  logger.info('server.shutdown', { signal });

  void closeRealtime().then(() => {
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });

  // Do not hang forever on lingering keep-alive sockets.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
