import 'dotenv/config';
import { z } from 'zod';

const nonEmpty = (name: string) =>
  z.string({ required_error: `${name} is required` }).trim().min(1, `${name} must not be empty`);

const intFromEnv = (fallback: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((value) => (value === undefined || value.trim() === '' ? fallback : Number(value)))
    .pipe(z.number().int().min(min).max(max));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: intFromEnv(5000, 1, 65535),

  CLIENT_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean),
    ),

  DATABASE_URL: nonEmpty('DATABASE_URL'),

  /**
   * Separate database for the test suite.
   *
   * The suite truncates every table between tests, so it must never be pointed at the
   * development database -- doing so silently deletes real accounts and data. This is
   * required when NODE_ENV=test (enforced below) and ignored otherwise.
   */
  TEST_DATABASE_URL: z.string().trim().optional(),

  /**
   * Legacy MongoDB Atlas database, used only by the one-way migration tool.
   *
   * READ-ONLY: the migration copies data out and never writes to it. Optional, because
   * the application itself does not need it.
   */
  SOURCE_MONGODB_URI: z.string().trim().optional(),

  RESEND_API_KEY: z.string().trim().optional(),
  RESEND_FROM_EMAIL: z.string().trim().default('SplitWise <onboarding@resend.dev>'),

  // No fallback values here on purpose: a silently-defaulted secret is a silent vulnerability.
  JWT_SECRET: nonEmpty('JWT_SECRET').min(16, 'JWT_SECRET must be at least 16 characters'),
  OTP_HASH_SECRET: nonEmpty('OTP_HASH_SECRET').min(
    16,
    'OTP_HASH_SECRET must be at least 16 characters',
  ),

  OTP_EXPIRES_SECONDS: intFromEnv(600, 30, 3600),
  OTP_RESEND_COOLDOWN_SECONDS: intFromEnv(120, 0, 3600),
  OTP_MAX_ATTEMPTS: intFromEnv(5, 1, 20),

  SESSION_TTL_SECONDS: intFromEnv(60 * 60 * 24 * 30, 60, 60 * 60 * 24 * 365),
  RESET_TOKEN_TTL_SECONDS: intFromEnv(600, 60, 3600),
  COOKIE_DOMAIN: z.string().trim().optional(),
  /**
   * SameSite policy for the session cookie.
   *
   * 'none' is required when the SPA and the API are on different sites (for example a
   * Vercel frontend calling a Render backend) -- with 'lax' the browser simply will not
   * send the cookie and every request looks signed-out. 'none' also requires Secure,
   * which is enforced below. Use 'lax' only when both are served from one origin.
   */
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).optional(),

  /* ---- Web push (VAPID) ----
   * Optional: push is simply disabled when absent. The public key is also served to
   * the client, which is by design -- it identifies the server to the push service. */
  VAPID_PUBLIC_KEY: z.string().trim().optional(),
  VAPID_PRIVATE_KEY: z.string().trim().optional(),
  VAPID_SUBJECT: z.string().trim().optional(),

  /* ---- Cloudinary ----
   * Only needed server-side for deleting orphaned assets; the browser uploads with an
   * unsigned preset, so the secret never reaches the client. */
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
  CLOUDINARY_UPLOAD_PRESET: z.string().trim().optional(),
  CLOUDINARY_FOLDER: z.string().trim().default('splitwise'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Fail fast and loudly; never boot a half-configured auth server.
  console.error(`\n[config] Invalid environment configuration:\n${details}\n`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/**
 * The database the process actually connects to.
 *
 * Under NODE_ENV=test this MUST be a dedicated database: the suite truncates every
 * table between tests, and pointing that at the development database destroys real
 * accounts. Refusing to start is the only safe behaviour -- a warning would be ignored
 * exactly once too often.
 */
export const activeDatabaseUrl = ((): string => {
  if (!isTest) return env.DATABASE_URL;

  const testUrl = env.TEST_DATABASE_URL;
  if (!testUrl) {
    console.error(
      '\n[config] NODE_ENV=test requires TEST_DATABASE_URL.\n' +
        '         The test suite truncates every table, so it must never run against\n' +
        '         the development database. Run: npm run db:test:setup\n',
    );
    process.exit(1);
  }

  if (testUrl === env.DATABASE_URL) {
    console.error(
      '\n[config] TEST_DATABASE_URL must differ from DATABASE_URL.\n' +
        '         Running the suite against the development database would delete its data.\n',
    );
    process.exit(1);
  }

  return testUrl;
})();

/** Last-resort guard for destructive test helpers. */
export const isTestDatabase = (): boolean =>
  isTest && Boolean(env.TEST_DATABASE_URL) && activeDatabaseUrl === env.TEST_DATABASE_URL;

/**
 * Guards against the commonest production misconfiguration: a deployed API still using
 * the localhost default for CLIENT_ORIGINS because the variable was never set.
 *
 * Left alone this fails silently and confusingly. The server runs, `/api/health`
 * returns 200, and every browser request from the real frontend is rejected with no
 * `Access-Control-Allow-Origin` header -- which surfaces as an opaque CORS error in the
 * browser and nothing at all in the server logs. An API in production that trusts only
 * localhost is misconfigured by definition, so it refuses to start and says why.
 */
if (isProduction) {
  const onlyLocalhost = env.CLIENT_ORIGINS.every((origin) =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin),
  );

  if (onlyLocalhost) {
    console.error(
      '\n[config] CLIENT_ORIGINS is not set for production.\n' +
        `         Resolved to: ${env.CLIENT_ORIGINS.join(', ') || '(empty)'}\n` +
        '         Every browser request from the real frontend will fail CORS.\n' +
        '         Set CLIENT_ORIGINS to your frontend origin(s), comma-separated,\n' +
        '         with no trailing slash. Example:\n' +
        '           CLIENT_ORIGINS=https://app.example.com,https://www.example.com\n',
    );
    process.exit(1);
  }
}
