/**
 * Realtime event contract.
 *
 * Events carry the minimum a client needs to decide WHICH data region to refetch --
 * never a financial figure. That is deliberate: if a socket payload carried balances,
 * clients would end up with two sources of financial truth that could drift apart.
 * The server stays authoritative; the socket only says "this changed, ask again".
 */

export const REALTIME_EVENTS = {
  EXPENSE_CREATED: 'expense:created',
  EXPENSE_UPDATED: 'expense:updated',
  EXPENSE_DELETED: 'expense:deleted',
  SETTLEMENT_CREATED: 'settlement:created',
  SETTLEMENT_APPROVED: 'settlement:approved',
  SETTLEMENT_REJECTED: 'settlement:rejected',
  SETTLEMENT_CANCELLED: 'settlement:cancelled',
  SETTLEMENT_PROOF_UPDATED: 'settlement:proof_updated',
  MEMBER_JOINED: 'group:member_joined',
  MEMBER_LEFT: 'group:member_left',
  MEMBER_REMOVED: 'group:member_removed',
  GROUP_UPDATED: 'group:updated',
  INVITE_REGENERATED: 'group:invite_regenerated',
} as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

/**
 * Which client regions a given event invalidates.
 *
 * Centralised here so the server and client agree, and so no event can silently mean
 * "reload everything" -- the failure mode the reference implementation fell into.
 */
export const EVENT_REGIONS: Record<RealtimeEvent, ('live' | 'analytics' | 'chart')[]> = {
  // An expense changes both what people owe and the historical analytics.
  [REALTIME_EVENTS.EXPENSE_CREATED]: ['live', 'analytics', 'chart'],
  [REALTIME_EVENTS.EXPENSE_UPDATED]: ['live', 'analytics', 'chart'],
  [REALTIME_EVENTS.EXPENSE_DELETED]: ['live', 'analytics', 'chart'],

  // Settlements move obligations only. They never alter spending history, so the
  // analytics and chart regions are deliberately left alone.
  [REALTIME_EVENTS.SETTLEMENT_CREATED]: ['live'],
  [REALTIME_EVENTS.SETTLEMENT_APPROVED]: ['live'],
  [REALTIME_EVENTS.SETTLEMENT_REJECTED]: ['live'],
  [REALTIME_EVENTS.SETTLEMENT_CANCELLED]: ['live'],
  [REALTIME_EVENTS.SETTLEMENT_PROOF_UPDATED]: ['live'],

  // Membership changes the member list and who "everyone" means for future splits.
  [REALTIME_EVENTS.MEMBER_JOINED]: ['live'],
  [REALTIME_EVENTS.MEMBER_LEFT]: ['live'],
  [REALTIME_EVENTS.MEMBER_REMOVED]: ['live'],
  [REALTIME_EVENTS.GROUP_UPDATED]: ['live'],
  [REALTIME_EVENTS.INVITE_REGENERATED]: ['live'],
};

export type RealtimePayload = {
  event: RealtimeEvent;
  groupId: string;
  /** Who caused it, so a client can skip echoing its own action back to the user. */
  actorId: string;
  actorName: string;
  /** The affected record, for optimistic list updates. Never a balance. */
  entityId?: string;
  /** Short human sentence for the toast/activity feed. */
  message: string;
  regions: ('live' | 'analytics' | 'chart')[];
  timestamp: string;
};

export const buildPayload = (input: {
  event: RealtimeEvent;
  groupId: string;
  actorId: string;
  actorName: string;
  entityId?: string;
  message: string;
}): RealtimePayload => ({
  ...input,
  regions: EVENT_REGIONS[input.event],
  timestamp: new Date().toISOString(),
});
