import { apiRequest } from './api';
import { apiUrl } from './env';
import type {
  AnalyticsRegion,
  AttentionPayload,
  ChartRegion,
  Expense,
  ExpenseCategory,
  Group,
  GroupMemberSummary,
  LiveRegion,
  Pagination,
  PersonRef,
  PaymentMode,
  RelationshipRow,
  Settlement,
  SettlementStatus,
  SplitType,
  BillingCycle,
} from '@/types/domain';

/**
 * Domain API.
 *
 * Every group-scoped call goes through `/api/groups/:groupId/...`, mirroring the
 * server's nesting. There is no endpoint that takes a group id in a body.
 */

/* ---- Groups ---- */

export const listGroups = () => apiRequest<{ groups: Group[] }>('/api/groups');

export const createGroup = (input: { name: string; description?: string }) =>
  apiRequest<{ group: Group }>('/api/groups', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const joinGroup = (invite: string) =>
  apiRequest<{ group: Group; alreadyMember: boolean }>('/api/groups/join', {
    method: 'POST',
    body: JSON.stringify({ invite }),
  });

export const previewInvite = (invite: string) =>
  apiRequest<{
    groupId: string;
    groupName: string;
    description: string | null;
    memberCount: number;
    isAlreadyMember: boolean;
  }>(`/api/groups/invite/${encodeURIComponent(invite)}/preview`);

export const getGroup = (groupId: string) =>
  apiRequest<{ group: Group; billingCycle: BillingCycle; members: GroupMemberSummary[] }>(
    `/api/groups/${groupId}`,
  );

export const getShareInfo = (groupId: string) =>
  apiRequest<{
    groupId: string;
    groupName: string;
    inviteCode: string;
    inviteToken: string;
    invitePath: string;
    inviteRotatedAt: string;
    memberCount: number;
    isCreator: boolean;
  }>(`/api/groups/${groupId}/share`);

export const regenerateInvite = (groupId: string) =>
  apiRequest<{ inviteCode: string; inviteToken: string; invitePath: string }>(
    `/api/groups/${groupId}/invite/regenerate`,
    { method: 'POST' },
  );

export const setPayday = (groupId: string, payday: number | null) =>
  apiRequest<{ group: Group; billingCycle: BillingCycle }>(`/api/groups/${groupId}/payday`, {
    method: 'PATCH',
    body: JSON.stringify({ payday }),
  });

export const leaveGroup = (groupId: string) =>
  apiRequest<{ groupDeleted: boolean; newCreatorId: string | null }>(
    `/api/groups/${groupId}/leave`,
    { method: 'POST' },
  );

export const removeMember = (groupId: string, userId: string) =>
  apiRequest<{ removed: boolean }>(`/api/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
  });

/** Nudges someone who owes you. The amount comes from the server, never the client. */
export const remindMember = (groupId: string, userId: string) =>
  apiRequest<{ sent: boolean; amountPaise: number; amount: string }>(
    `/api/groups/${groupId}/members/${userId}/remind`,
    { method: 'POST' },
  );

export const deleteGroup = (groupId: string) =>
  apiRequest<{ deleted: boolean }>(`/api/groups/${groupId}`, { method: 'DELETE' });

/* ---- Expenses ---- */

export interface ExpenseInput {
  title: string;
  amount: string | number;
  paidBy?: string;
  splitType: SplitType;
  participantIds?: string[];
  /**
   * Per-person figures for an unequal split, in the unit the mode uses: rupees for
   * `exact`, percent for `percentage`, a raw weight for `shares`.
   */
  splits?: { userId: string; value: number }[];
  paymentMode: PaymentMode;
  category?: ExpenseCategory | null;
  expenseDate: string;
  notes?: string;
  receiptUrl?: string | null;
  receiptStorageKey?: string | null;
}

export const listExpenses = (groupId: string, options: { limit: number; offset: number }) =>
  apiRequest<{ expenses: Expense[]; pagination: Pagination }>(
    `/api/groups/${groupId}/expenses?limit=${options.limit}&offset=${options.offset}`,
  );

export const getExpense = (groupId: string, expenseId: string) =>
  apiRequest<{ expense: Expense }>(`/api/groups/${groupId}/expenses/${expenseId}`);

export const createExpense = (groupId: string, input: ExpenseInput) =>
  apiRequest<{ expense: Expense }>(`/api/groups/${groupId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateExpense = (
  groupId: string,
  expenseId: string,
  input: Partial<ExpenseInput>,
) =>
  apiRequest<{ expense: Expense }>(`/api/groups/${groupId}/expenses/${expenseId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteExpense = (groupId: string, expenseId: string) =>
  apiRequest<{ deleted: boolean }>(`/api/groups/${groupId}/expenses/${expenseId}`, {
    method: 'DELETE',
  });

/* ---- Settlements ---- */

export const listSettlements = (
  groupId: string,
  options: { status?: SettlementStatus | 'all'; limit: number; offset: number },
) => {
  const params = new URLSearchParams({
    status: options.status ?? 'all',
    limit: String(options.limit),
    offset: String(options.offset),
  });
  return apiRequest<{ settlements: Settlement[]; pagination: Pagination }>(
    `/api/groups/${groupId}/settlements?${params}`,
  );
};

export const getAttention = (groupId: string) =>
  apiRequest<AttentionPayload>(`/api/groups/${groupId}/settlements/attention`);

/**
 * How much may still be settled with one person.
 *
 * The settle dialog pre-fills from this rather than from any figure already on screen,
 * so the amount offered always matches what the server will accept.
 */
export const getOutstanding = (groupId: string, userId: string) =>
  apiRequest<{
    counterpartId: string;
    iOwePaise: number;
    iOwe: number;
    theyOwePaise: number;
    theyOwe: number;
    maxSettleablePaise: number;
  }>(`/api/groups/${groupId}/settlements/outstanding/${userId}`);

/**
 * The suggested settle-up plan.
 *
 * Read-only advice derived from the balance engine. It never changes how debts are
 * stored, and `recordable` says whether a given transfer is backed by a direct debt
 * the settlement engine would actually accept today.
 */
export const getSettlementPlan = (groupId: string, signal?: AbortSignal) =>
  apiRequest<{
    currentTransferCount: number;
    suggestedTransferCount: number;
    allSettled: boolean;
    transfers: {
      from: PersonRef;
      to: PersonRef;
      amountPaise: number;
      amount: number;
      recordablePaise: number;
      recordable: boolean;
      involvesMe: boolean;
    }[];
    netPositions: {
      user: PersonRef;
      netPaise: number;
      net: number;
      isMe: boolean;
    }[];
  }>(`/api/groups/${groupId}/settlements/plan`, { signal });

export const createSettlement = (
  groupId: string,
  input: {
    receiverId: string;
    amount: string | number;
    paymentMethod: PaymentMode;
    actionType: 'payment' | 'will_pay_soon';
    proofUrl?: string | null;
    note?: string;
  },
) =>
  apiRequest<{ settlement: Settlement }>(`/api/groups/${groupId}/settlements`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const approveSettlement = (groupId: string, settlementId: string) =>
  apiRequest<{ settlement: Settlement }>(
    `/api/groups/${groupId}/settlements/${settlementId}/approve`,
    { method: 'POST' },
  );

export const rejectSettlement = (
  groupId: string,
  settlementId: string,
  rejectionReason: string,
) =>
  apiRequest<{ settlement: Settlement }>(
    `/api/groups/${groupId}/settlements/${settlementId}/reject`,
    { method: 'POST', body: JSON.stringify({ rejectionReason }) },
  );

export const cancelSettlement = (groupId: string, settlementId: string) =>
  apiRequest<{ settlement: Settlement }>(
    `/api/groups/${groupId}/settlements/${settlementId}/cancel`,
    { method: 'POST', body: JSON.stringify({}) },
  );

/* ---- Reports ---- */

export const fetchLiveRegion = (groupId: string, signal?: AbortSignal) =>
  apiRequest<LiveRegion>(`/api/groups/${groupId}/reports/dashboard?scope=live`, { signal });

export const fetchAnalyticsRegion = (
  groupId: string,
  params: URLSearchParams,
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams(params);
  query.set('scope', 'analytics');
  return apiRequest<AnalyticsRegion>(
    `/api/groups/${groupId}/reports/dashboard?${query}`,
    { signal },
  );
};

export const fetchChartRegion = (
  groupId: string,
  params: URLSearchParams,
  groupBy: string,
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams(params);
  query.set('scope', 'chart');
  query.set('groupBy', groupBy);
  return apiRequest<ChartRegion>(`/api/groups/${groupId}/reports/dashboard?${query}`, {
    signal,
  });
};

export const fetchRelationships = (
  groupId: string,
  params: URLSearchParams,
  signal?: AbortSignal,
) =>
  apiRequest<{ relationships: RelationshipRow[] }>(
    `/api/groups/${groupId}/reports/relationships?${params}`,
    { signal },
  );

/**
 * Downloads the workbook.
 *
 * Bypasses `apiRequest` because the response is binary, not the JSON envelope. The
 * filename comes from Content-Disposition, which the server explicitly exposes to CORS.
 */
export const downloadExport = async (
  groupId: string,
  params: URLSearchParams,
): Promise<{ blob: Blob; filename: string }> => {
  // Must go through `apiUrl`, not a bare relative path: with the SPA and the API on
  // different hosts a relative URL resolves against the frontend and 404s.
  const response = await fetch(apiUrl(`/api/groups/${groupId}/reports/export?${params}`), {
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'Could not generate the report.';
    try {
      const body = await response.json();
      message = body?.error?.message ?? message;
    } catch {
      // Binary or empty body; keep the generic message.
    }
    throw new Error(message);
  }

  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);

  return {
    blob: await response.blob(),
    filename: match?.[1] ?? `splitwise-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
  };
};

/* ---- History purge (group creator only; the server enforces it) ---- */

export interface PurgeFilters {
  from: string;
  to: string;
  memberId?: string;
  category?: ExpenseCategory;
  paymentMode?: PaymentMode;
  includeActivities?: boolean;
}

export interface PurgePreview {
  from: string;
  to: string;
  expenseCount: number;
  settlementCount: number;
  activityCount: number;
  amountPaise: number;
  safe: boolean;
  blockingDebts: {
    debtorId: string;
    debtorName: string;
    creditorId: string;
    creditorName: string;
    owedPaise: number;
    beforePaise: number;
    afterPaise: number;
  }[];
}

/** Describes what a purge would destroy. Safe to call freely; changes nothing. */
export const previewPurge = (groupId: string, filters: PurgeFilters) =>
  apiRequest<PurgePreview>(`/api/groups/${groupId}/purge/preview`, {
    method: 'POST',
    body: JSON.stringify(filters),
  });

/** Irreversible. `confirmation` must equal the group's name exactly. */
export const executePurge = (
  groupId: string,
  filters: PurgeFilters & { confirmation: string },
) =>
  apiRequest<{
    expensesDeleted: number;
    settlementsDeleted: number;
    activitiesDeleted: number;
    amountPaise: number;
  }>(`/api/groups/${groupId}/purge`, {
    method: 'POST',
    body: JSON.stringify(filters),
  });

export const listGroupPurgeAudits = (groupId: string) =>
  apiRequest<{
    audits: {
      id: string;
      from: string;
      to: string;
      actorEmail: string;
      expensesDeleted: number;
      settlementsDeleted: number;
      activitiesDeleted: number;
      amountPaise: number;
      createdAt: string;
    }[];
    total: number;
  }>(`/api/groups/${groupId}/purge/audits`);

/* ---- Cross-group spending insights (granted by an administrator) ---- */

export interface SpendingReport {
  scope: { kind: 'none' | 'all_groups' | 'selected_groups'; groupIds?: string[] };
  groups: { id: string; name: string }[];
  people: {
    userId: string;
    fullName: string;
    email: string;
    spentPaise: number;
    paidPaise: number;
    expenseCount: number;
  }[];
  categories: { category: string | null; spentPaise: number }[];
  months: { month: string; spentPaise: number }[];
  totals: {
    spentPaise: number;
    expenseCount: number;
    groupCount: number;
    personCount: number;
  };
}

export const getSpendingReport = (
  params: { from?: string; to?: string; groupId?: string },
  signal?: AbortSignal,
) => {
  const query = new URLSearchParams();
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.groupId) query.set('groupId', params.groupId);
  return apiRequest<SpendingReport>(`/api/insights/spending?${query}`, { signal });
};
