export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  upiId?: string | null;
  qrCodeUrl?: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface ChallengePayload {
  email: string;
  maskedEmail: string;
  expiresAt: string;
  resendAvailableAt: string;
  serverTime: string;
  maxAttempts: number;
}

export interface ResetAuthorizationPayload {
  resetToken: string;
  expiresAt: string;
  serverTime: string;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  fields?: ApiFieldError[];
  details?: {
    attemptsRemaining?: number;
    retryAfterSeconds?: number;
    resendAvailableAt?: string;
    serverTime?: string;
    resetAt?: string;
  };
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiErrorDetail;
}

