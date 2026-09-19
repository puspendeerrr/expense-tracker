/**
 * Minimal structured logger.
 *
 * Secrets are kept out by construction: callers pass identifiers and codes, never
 * OTPs, passwords, session tokens or API keys. `redactEmail` exists so that even
 * addresses are partially masked in server logs.
 */
type Fields = Record<string, unknown>;

const emit = (level: 'info' | 'warn' | 'error', message: string, fields?: Fields): void => {
  const line = { level, time: new Date().toISOString(), message, ...(fields ?? {}) };
  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
};

export const logger = {
  info: (message: string, fields?: Fields) => emit('info', message, fields),
  warn: (message: string, fields?: Fields) => emit('warn', message, fields),
  error: (message: string, fields?: Fields) => emit('error', message, fields),
};

/** `alice@example.com` -> `a***e@example.com`. Enough to correlate, not enough to harvest. */
export const redactEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  if (local.length <= 2) return `${local[0] ?? '*'}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};
