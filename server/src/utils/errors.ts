/** Stable, client-facing error codes. The frontend branches on these, never on message text. */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  OTP_INVALID: 'OTP_INVALID',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_COOLDOWN: 'OTP_COOLDOWN',
  OTP_MAX_ATTEMPTS: 'OTP_MAX_ATTEMPTS',
  OTP_NOT_FOUND: 'OTP_NOT_FOUND',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  RESET_TOKEN_EXPIRED: 'RESET_TOKEN_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  EMAIL_DELIVERY_FAILED: 'EMAIL_DELIVERY_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  GROUP_DISABLED: 'GROUP_DISABLED',
  PURGE_WOULD_CHANGE_BALANCES: 'PURGE_WOULD_CHANGE_BALANCES',
  NOT_FOUND: 'NOT_FOUND',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  /* ---- Groups ---- */
  INVITE_INVALID: 'INVITE_INVALID',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  NOT_GROUP_MEMBER: 'NOT_GROUP_MEMBER',
  OUTSTANDING_BALANCE: 'OUTSTANDING_BALANCE',
  LAST_CREATOR: 'LAST_CREATOR',

  /* ---- Expenses ---- */
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_PARTICIPANTS: 'INVALID_PARTICIPANTS',
  PAYER_NOT_IN_GROUP: 'PAYER_NOT_IN_GROUP',
  FUTURE_DATE: 'FUTURE_DATE',
  SHARE_RECONCILIATION_FAILED: 'SHARE_RECONCILIATION_FAILED',

  /* ---- Settlements ---- */
  SETTLEMENT_EXCEEDS_DEBT: 'SETTLEMENT_EXCEEDS_DEBT',
  SETTLEMENT_PROOF_REQUIRED: 'SETTLEMENT_PROOF_REQUIRED',
  SETTLEMENT_INVALID_STATE: 'SETTLEMENT_INVALID_STATE',
  SELF_SETTLEMENT: 'SELF_SETTLEMENT',

  /* ---- AI Assistant ---- */
  AI_DISABLED: 'AI_DISABLED',
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type FieldError = { field: string; message: string };

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  /** Extra, non-sensitive data the client needs (e.g. cooldown timestamps). */
  readonly details?: Record<string, unknown>;
  readonly fields?: FieldError[];

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: { details?: Record<string, unknown>; fields?: FieldError[] } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.fields = options.fields;
  }
}

export const badRequest = (code: ErrorCode, message: string, details?: Record<string, unknown>) =>
  new AppError(400, code, message, { details });

export const unauthorized = (code: ErrorCode, message: string) => new AppError(401, code, message);

export const tooManyRequests = (
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
) => new AppError(429, code, message, { details });

export const forbidden = (code: ErrorCode, message: string) => new AppError(403, code, message);

export const notFound = (message: string, code: ErrorCode = ERROR_CODES.NOT_FOUND) =>
  new AppError(404, code, message);

export const conflict = (code: ErrorCode, message: string, details?: Record<string, unknown>) =>
  new AppError(409, code, message, { details });
