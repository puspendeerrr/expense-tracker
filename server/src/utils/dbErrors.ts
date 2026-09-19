/**
 * PostgreSQL error inspection.
 *
 * Drizzle wraps driver errors in its own error type and hangs the original off `cause`,
 * so checking `error.code` on the thrown value alone silently never matches. Every
 * helper here walks the cause chain instead -- getting this wrong turns a recoverable
 * race (a losing concurrent INSERT) into a 500.
 */

type PostgresError = { code?: string; constraint?: string; message?: string };

/** Walks the `cause` chain collecting anything that looks like a driver error. */
const unwrap = (error: unknown): PostgresError[] => {
  const found: PostgresError[] = [];
  let current: unknown = error;
  // Bounded so a self-referencing cause cannot loop forever.
  for (let depth = 0; depth < 10 && current; depth += 1) {
    if (typeof current === 'object') {
      const candidate = current as PostgresError & { cause?: unknown };
      if (typeof candidate.code === 'string') found.push(candidate);
      current = candidate.cause;
    } else {
      break;
    }
  }
  return found;
};

/** SQLSTATE 23505 — unique_violation. Optionally narrowed to one constraint. */
export const isUniqueViolation = (error: unknown, constraint?: string): boolean =>
  unwrap(error).some(
    (candidate) =>
      candidate.code === '23505' && (!constraint || candidate.constraint === constraint),
  );

/** SQLSTATE 23503 — foreign_key_violation. */
export const isForeignKeyViolation = (error: unknown): boolean =>
  unwrap(error).some((candidate) => candidate.code === '23503');

/**
 * SQLSTATE 23514 — check_violation, which is also what the share-reconciliation
 * trigger raises.
 */
export const isCheckViolation = (error: unknown): boolean =>
  unwrap(error).some((candidate) => candidate.code === '23514');

/** Full message chain, for assertions and structured logging. Never user-facing. */
export const describeDbError = (error: unknown): string => {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 10 && current instanceof Error; depth += 1) {
    messages.push(current.message);
    current = (current as Error & { cause?: unknown }).cause;
  }
  return messages.join(' | ');
};
