import { request } from './client';
import type {
  AccountEvent,
  GroupShareInfo,
  InvitePreview,
  OtpChallenge,
  AiChatResponse,
  AiHistoryItem,
  Activity,
  AnalyticsRegion,
  NotificationListPayload,
  NotificationPreferences,
  Pagination,
  PushDevice,
  SessionDevice,
  ActivityFilters,
  ActivityListPayload,
  AttentionPayload,
  Expense,
  ExpenseFilters,
  ExpenseInput,
  ExpenseListPayload,
  Group,
  GroupDetail,
  LiveRegion,
  Outstanding,
  SessionPayload,
  Settlement,
  SettlementInput,
  SettlementListPayload,
  User,
} from './types';

/**
 * Every call the app makes, named once.
 *
 * Screens import from here rather than building paths of their own, so the day a route
 * moves there is exactly one line to change, and no component ever holds a URL.
 *
 * Everything below `groups` is nested under `/groups/:groupId/...`, which mirrors the
 * backend: there is no flat expense or settlement route that could be reached without
 * naming a group, and `requireGroupMember` proves membership on every one of them.
 */

const query = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    // `undefined` means "no opinion"; the server applies its own default. Sending an
    // empty string instead would be a value, and a different one.
    if (value !== undefined && value !== '') search.append(key, String(value));
  }
  const text = search.toString();
  return text ? '?' + text : '';
};

export const auth = {
  /**
   * Sends no cookie: any token we still hold is irrelevant to signing in, and offering
   * one would only invite the server to answer about that session instead of this one.
   * The session token arrives as `set-cookie` and the client stores it.
   */
  signIn: (email: string, password: string): Promise<{ user: User }> =>
    request('/auth/login', { method: 'POST', body: { email, password }, anonymous: true }),

  /** The session check. A 401 here is normal and means "not signed in". */
  me: (signal?: AbortSignal): Promise<SessionPayload> => request('/auth/me', { signal }),

  /** Revokes the session server-side. The response clears the cookie, so the token goes. */
  signOut: (): Promise<{ loggedOut: boolean }> => request('/auth/logout', { method: 'POST' }),

  /*
   * Sign-up is a two-step flow: an account is staged and a code emailed, then the code is
   * verified. Verification creates the session itself, so there is no separate sign-in
   * afterwards -- the response carries the user and sets the cookie.
   */
  signUpRequest: (input: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<OtpChallenge> =>
    request('/auth/signup/request-otp', { method: 'POST', body: input, anonymous: true }),

  signUpVerify: (email: string, otp: string): Promise<{ user: User }> =>
    request('/auth/signup/verify-otp', { method: 'POST', body: { email, otp }, anonymous: true }),

  signUpResend: (email: string): Promise<OtpChallenge> =>
    request('/auth/signup/resend-otp', { method: 'POST', body: { email }, anonymous: true }),

  /*
   * Password reset is three steps: request a code, exchange the code for a short-lived
   * reset token, then set the password with that token. The token is held in memory for
   * the few seconds between the last two and never written anywhere.
   */
  passwordRequest: (email: string): Promise<OtpChallenge> =>
    request('/auth/password/request-otp', { method: 'POST', body: { email }, anonymous: true }),

  passwordVerify: (email: string, otp: string): Promise<{ resetToken: string }> =>
    request('/auth/password/verify-otp', { method: 'POST', body: { email, otp }, anonymous: true }),

  passwordReset: (input: {
    resetToken: string;
    password: string;
    confirmPassword: string;
  }): Promise<{ passwordReset: boolean }> =>
    request('/auth/password/reset', { method: 'POST', body: input, anonymous: true }),
};

export const groups = {
  list: (signal?: AbortSignal): Promise<{ groups: Group[] }> => request('/groups', { signal }),

  /** Group, billing cycle and members with their balance totals from the engine. */
  get: (groupId: string, signal?: AbortSignal): Promise<GroupDetail> =>
    request('/groups/' + groupId, { signal }),

  /**
   * The authoritative current picture: totals, who I owe, who owes me, members, and
   * what needs my attention. This is the only place the app reads balances from.
   */
  live: (groupId: string, signal?: AbortSignal): Promise<LiveRegion> =>
    request('/groups/' + groupId + '/reports/dashboard?scope=live', { signal }),

  /**
   * Spending history. Fetched only by the Overview section, and only when it is shown,
   * so opening a group does not pay for a report nobody has looked at yet.
   */
  analytics: (groupId: string, signal?: AbortSignal): Promise<AnalyticsRegion> =>
    request('/groups/' + groupId + '/reports/dashboard?scope=analytics', { signal }),

  activities: (
    groupId: string,
    filters: ActivityFilters = {},
    signal?: AbortSignal,
  ): Promise<ActivityListPayload> =>
    request('/groups/' + groupId + '/activities' + query({ ...filters }), { signal }),

  activityTypes: (groupId: string, signal?: AbortSignal): Promise<{ types: string[] }> =>
    request('/groups/' + groupId + '/activities/types', { signal }),

  create: (name: string, description?: string): Promise<{ group: Group }> =>
    request('/groups', {
      method: 'POST',
      body: { name, ...(description?.trim() ? { description: description.trim() } : {}) },
    }),

  /** Accepts either the short code or the long invite token; the server decides which. */
  join: (invite: string): Promise<{ group: Group; alreadyMember: boolean }> =>
    request('/groups/join', { method: 'POST', body: { invite } }),

  /** Unauthenticated-safe look before joining. */
  previewInvite: (invite: string, signal?: AbortSignal): Promise<InvitePreview> =>
    request('/groups/invite/' + encodeURIComponent(invite) + '/preview', { signal }),

  update: (groupId: string, input: { name?: string; description?: string | null }): Promise<{ group: Group }> =>
    request('/groups/' + groupId, { method: 'PATCH', body: input }),

  setPayday: (groupId: string, payday: number | null): Promise<{ group: Group }> =>
    request('/groups/' + groupId + '/payday', { method: 'PATCH', body: { payday } }),

  setMedia: (groupId: string, input: { avatarUrl?: string | null; coverUrl?: string | null }): Promise<{ group: Group }> =>
    request('/groups/' + groupId + '/media', { method: 'PATCH', body: input }),

  share: (groupId: string, signal?: AbortSignal): Promise<GroupShareInfo> =>
    request('/groups/' + groupId + '/share', { signal }),

  regenerateInvite: (groupId: string): Promise<GroupShareInfo> =>
    request('/groups/' + groupId + '/invite/regenerate', { method: 'POST' }),

  /*
   * Both of these can be refused by the server on domain grounds -- an outstanding
   * balance blocks a departure, and the last creator cannot leave. The refusal carries
   * the reason, and that reason is what the user is shown.
   */
  leave: (groupId: string): Promise<{ left: boolean }> =>
    request('/groups/' + groupId + '/leave', { method: 'POST' }),

  removeMember: (groupId: string, userId: string): Promise<{ removed: boolean }> =>
    request('/groups/' + groupId + '/members/' + userId, { method: 'DELETE' }),

  /** Nudges someone who owes you. Rate limited per sender on the server. */
  remind: (groupId: string, userId: string): Promise<{ reminded: boolean }> =>
    request('/groups/' + groupId + '/members/' + userId + '/remind', { method: 'POST' }),
};

export const expenses = {
  list: (
    groupId: string,
    filters: ExpenseFilters = {},
    signal?: AbortSignal,
  ): Promise<ExpenseListPayload> =>
    request('/groups/' + groupId + '/expenses' + query({ ...filters }), { signal }),

  get: (groupId: string, expenseId: string, signal?: AbortSignal): Promise<{ expense: Expense }> =>
    request('/groups/' + groupId + '/expenses/' + expenseId, { signal }),

  create: (groupId: string, input: ExpenseInput): Promise<{ expense: Expense }> =>
    request('/groups/' + groupId + '/expenses', { method: 'POST', body: input }),

  update: (
    groupId: string,
    expenseId: string,
    input: Partial<ExpenseInput>,
  ): Promise<{ expense: Expense }> =>
    request('/groups/' + groupId + '/expenses/' + expenseId, { method: 'PATCH', body: input }),

  remove: (groupId: string, expenseId: string): Promise<{ deleted: boolean }> =>
    request('/groups/' + groupId + '/expenses/' + expenseId, { method: 'DELETE' }),
};

export const settlements = {
  list: (
    groupId: string,
    options: { status?: string; limit?: number; offset?: number } = {},
    signal?: AbortSignal,
  ): Promise<SettlementListPayload> =>
    request('/groups/' + groupId + '/settlements' + query({ ...options }), { signal }),

  /** What needs the viewer's attention, plus their headline balances. */
  attention: (groupId: string, signal?: AbortSignal): Promise<AttentionPayload> =>
    request('/groups/' + groupId + '/settlements/attention', { signal }),

  /**
   * Live debt in both directions with one person.
   *
   * `maxSettleablePaise` is the ceiling the Settle Up screen shows. It is re-checked by
   * the server when the settlement is actually created, so a balance that moves between
   * opening the screen and submitting it is caught there, not here.
   */
  outstanding: (groupId: string, userId: string, signal?: AbortSignal): Promise<Outstanding> =>
    request('/groups/' + groupId + '/settlements/outstanding/' + userId, { signal }),

  /** The payer is always the authenticated caller; the server ignores any other claim. */
  create: (groupId: string, input: SettlementInput): Promise<{ settlement: Settlement }> =>
    request('/groups/' + groupId + '/settlements', { method: 'POST', body: input }),

  approve: (groupId: string, settlementId: string): Promise<{ settlement: Settlement }> =>
    request('/groups/' + groupId + '/settlements/' + settlementId + '/approve', { method: 'POST' }),

  reject: (
    groupId: string,
    settlementId: string,
    rejectionReason?: string,
  ): Promise<{ settlement: Settlement }> =>
    request('/groups/' + groupId + '/settlements/' + settlementId + '/reject', {
      method: 'POST',
      body: rejectionReason ? { rejectionReason } : {},
    }),

  cancel: (groupId: string, settlementId: string): Promise<{ settlement: Settlement }> =>
    request('/groups/' + groupId + '/settlements/' + settlementId + '/cancel', { method: 'POST' }),

  reuploadProof: (
    groupId: string,
    settlementId: string,
    proofUrl: string,
  ): Promise<{ settlement: Settlement }> =>
    request('/groups/' + groupId + '/settlements/' + settlementId + '/proof', {
      method: 'POST',
      body: { proofUrl },
    }),
};

/**
 * Unauthenticated liveness check. Used to tell "the server is unreachable" apart from
 * "the server is fine and refused you", which are the same spinner otherwise.
 */
export const health = (signal?: AbortSignal): Promise<unknown> =>
  request('/health', { anonymous: true, timeoutMs: 6_000, signal });


/* -------------------------------------------------------------------------- */
/* Notifications, devices and security (Phase 4)                              */
/* -------------------------------------------------------------------------- */

export const notifications = {
  list: (
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<NotificationListPayload> =>
    request(
      '/notifications' +
        query({
          limit: options.limit,
          offset: options.offset,
          ...(options.unreadOnly ? { unreadOnly: 'true' } : {}),
        }),
      { signal },
    ),

  /** Deliberately cheap: one indexed COUNT, so the bell can ask often. */
  unreadCount: (signal?: AbortSignal): Promise<{ unreadCount: number }> =>
    request('/notifications/unread-count', { signal }),

  markRead: (ids: string[]): Promise<{ updated: number; unreadCount: number }> =>
    request('/notifications/read', { method: 'POST', body: { ids } }),

  markAllRead: (): Promise<{ updated: number; unreadCount: number }> =>
    request('/notifications/read-all', { method: 'POST' }),

  clearAll: (): Promise<{ cleared: boolean }> =>
    request('/notifications', { method: 'DELETE' }),
};

/**
 * Native push registration.
 *
 * The push token goes up and is never returned by anything below; `list` exists for the
 * Devices screen and deliberately omits it.
 */
export const devices = {
  register: (input: {
    installationId: string;
    token: string;
    platform: 'android' | 'ios';
    deviceName: string | null;
    appVersion: string | null;
  }): Promise<{ registered: boolean }> =>
    request('/devices/register', { method: 'POST', body: input }),

  unregister: (installationId: string): Promise<{ unregistered: boolean }> =>
    request('/devices/unregister', { method: 'POST', body: { installationId } }),

  list: (signal?: AbortSignal): Promise<{ devices: PushDevice[] }> =>
    request('/devices', { signal }),

  setEnabled: (installationId: string, enabled: boolean): Promise<{ devices: PushDevice[] }> =>
    request('/devices/enabled', { method: 'POST', body: { installationId, enabled } }),

  preferences: (signal?: AbortSignal): Promise<{ preferences: NotificationPreferences }> =>
    request('/devices/preferences', { signal }),

  savePreferences: (
    input: Partial<NotificationPreferences>,
  ): Promise<{ preferences: NotificationPreferences }> =>
    request('/devices/preferences', { method: 'PUT', body: input }),
};

/**
 * Sessions and account history.
 *
 * Every one of these is scoped to the caller by the server — there is no user id in any
 * path or body — so it is impossible to address another account's sessions through them.
 */
export const security = {
  devices: (signal?: AbortSignal): Promise<{ devices: SessionDevice[] }> =>
    request('/auth/security/devices', { signal }),

  rename: (sessionId: string, name: string | null): Promise<{ devices: SessionDevice[] }> =>
    request('/auth/security/devices/' + sessionId, { method: 'PATCH', body: { name } }),

  /** Revoking your own session is a logout; the response says which happened. */
  revoke: (sessionId: string): Promise<{ devices: SessionDevice[]; signedOut: boolean }> =>
    request('/auth/security/devices/' + sessionId, { method: 'DELETE' }),

  revokeOthers: (): Promise<{ revoked: number; devices: SessionDevice[] }> =>
    request('/auth/security/devices/revoke-others', { method: 'POST' }),

  events: (
    options: { limit?: number; offset?: number; scope?: 'all' | 'logins' } = {},
    signal?: AbortSignal,
  ): Promise<{ events: AccountEvent[]; pagination: Pagination }> =>
    request('/auth/security/events' + query({ ...options }), { signal }),
};

/* -------------------------------------------------------------------------- */
/* AI assistant (Phase 5)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The existing backend assistant. There is no AI in this app.
 *
 * Gemini, the retrieval from PostgreSQL and the authorisation all live on the server;
 * this is one POST. The mobile client sends a question and a bounded history and renders
 * what comes back.
 *
 * THE TIMEOUT IS THE INTERESTING PART. Every other call in this file uses the 15s
 * default, which is right for a query. A grounded AI answer measured 8–25 seconds against
 * the real backend, so the default would abort perfectly good responses most of the time.
 * 90s is chosen to sit well clear of the slowest observed answer while still guaranteeing
 * the UI cannot hang for ever.
 */
export const ai = {
  chat: (
    message: string,
    history: AiHistoryItem[] = [],
    signal?: AbortSignal,
  ): Promise<AiChatResponse> =>
    request('/ai/chat', {
      method: 'POST',
      body: { message, history },
      timeoutMs: 90_000,
      signal,
    }),
};

export type { Activity };
