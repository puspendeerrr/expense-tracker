/**
 * Three failures a caller can tell apart.
 *
 * `ApiError`  the server answered and said no. It supplies the wording.
 * `NetworkError`  nothing came back, or what came back was not our envelope.
 * `ConfigurationError`  this build has no usable API address. A developer problem.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  /** The session is gone: revoked, expired, or never valid. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** Worth offering a retry button for; a rejected password is not. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 429;
  }
}

export class NetworkError extends Error {
  readonly timedOut: boolean;
  /** Held as a field rather than passed as an Error cause, which Hermes lacks. */
  readonly reason: unknown;

  constructor(message: string, options?: { timedOut?: boolean; reason?: unknown }) {
    super(message);
    this.name = 'NetworkError';
    this.timedOut = options?.timedOut ?? false;
    this.reason = options?.reason;
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export type ErrorPresentation = { title: string; message: string; retryable: boolean };

/**
 * One place that turns any thrown value into something worth putting on a screen.
 *
 * Server messages are used verbatim -- they are already written for people, and
 * rewording them here would mean maintaining the same sentence twice.
 */
export const describeError = (error: unknown): ErrorPresentation => {
  if (error instanceof ApiError) {
    return {
      title: error.isUnauthenticated ? 'Signed out' : 'That did not work',
      message: error.message,
      retryable: error.isRetryable,
    };
  }

  if (error instanceof NetworkError) {
    return {
      title: error.timedOut ? 'Taking too long' : 'No connection',
      message: error.timedOut
        ? 'The server did not answer in time. It may be waking up, or the connection may be slow.'
        : 'We could not reach SplitMoney. Check your connection and try again.',
      retryable: true,
    };
  }

  if (error instanceof ConfigurationError) {
    return { title: 'App not configured', message: error.message, retryable: false };
  }

  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    retryable: true,
  };
};
