import { apiRequest } from './api';

/**
 * Account security API.
 *
 * Every endpoint is scoped server-side to the signed-in account, so none of these take
 * a user id. The session id in a path identifies which of *your* devices to act on.
 */

export interface Device {
  id: string;
  /** A name the account holder gave this device, or null. */
  name: string | null;
  /** Derived label, e.g. "Chrome on Windows". Shown when there is no name. */
  device: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export type AccountEventType =
  | 'login_succeeded'
  | 'login_failed'
  | 'logout'
  | 'new_device_detected'
  | 'session_revoked'
  | 'sessions_revoked_all'
  | 'password_changed'
  | 'password_reset'
  | 'device_renamed'
  | 'profile_updated'
  | 'account_deactivated'
  | 'account_reactivated'
  | 'data_exported';

export interface AccountEvent {
  id: string;
  type: AccountEventType;
  ipAddress: string | null;
  device: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  sessionActive: boolean;
}

export interface EventPage {
  events: AccountEvent[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

export const listDevices = () =>
  apiRequest<{ devices: Device[] }>('/api/auth/security/devices');

export const renameDevice = (sessionId: string, name: string | null) =>
  apiRequest<{ devices: Device[] }>(`/api/auth/security/devices/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });

/** `signedOut` is true when the revoked device was the one making the request. */
export const revokeDevice = (sessionId: string) =>
  apiRequest<{ devices: Device[]; signedOut: boolean }>(
    `/api/auth/security/devices/${sessionId}`,
    { method: 'DELETE' },
  );

export const revokeOtherDevices = () =>
  apiRequest<{ revoked: number; devices: Device[] }>(
    '/api/auth/security/devices/revoke-others',
    { method: 'POST' },
  );

export const listAccountEvents = (params: {
  scope: 'all' | 'logins';
  limit: number;
  offset: number;
}) => {
  const query = new URLSearchParams({
    scope: params.scope,
    limit: String(params.limit),
    offset: String(params.offset),
  });
  return apiRequest<EventPage>(`/api/auth/security/events?${query}`);
};
