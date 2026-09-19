import { apiRequest } from './api';
import type { PurgeFilters, PurgePreview } from './domainApi';

/**
 * Admin console and platform-permission API.
 *
 * Nothing here is a security boundary: every endpoint re-checks the caller's
 * permissions server-side. These calls exist so the console can render, and a 403 from
 * any of them is a normal, expected outcome rather than a bug.
 */

export type PermissionCategory = 'platform' | 'groups' | 'money' | 'insights';

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: PermissionCategory;
  defaultGranted: boolean;
  sensitive?: boolean;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  disabledAt: string | null;
  disabledReason: string | null;
  permissionOverrideCount: number;
  upiId: string | null;
  isVerified: boolean;
  createdAt: string;
  groupCount: number;
  expenseCount: number;
  activeSessions: number;
}

export interface AdminGroup {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  disabledAt: string | null;
  inviteCode: string;
  payday: number | null;
  creatorName: string;
  creatorEmail: string;
  memberCount: number;
  expenseCount: number;
  totalValuePaise: number;
  lastActivityAt: string | null;
  createdAt: string | null;
}

export type DashboardScope =
  | { kind: 'none' }
  | { kind: 'all_groups' }
  | { kind: 'selected_groups'; groupIds: string[] };

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/* ---- Telemetry ---- */

export const getStats = () => apiRequest<Record<string, number>>('/api/admin/stats');

/* ---- Users ---- */

export const listAdminUsers = (params: {
  limit: number;
  offset: number;
  search?: string;
  role?: 'all' | 'admin' | 'user';
  verified?: 'all' | 'true' | 'false';
  status?: 'all' | 'active' | 'disabled';
}) => {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    role: params.role ?? 'all',
    verified: params.verified ?? 'all',
    status: params.status ?? 'all',
  });
  if (params.search) query.set('search', params.search);
  return apiRequest<{ users: AdminUser[]; pagination: Pagination }>(
    `/api/admin/users?${query}`,
  );
};

export const setUserRole = (userId: string, role: 'admin' | 'user') =>
  apiRequest<{ user: AdminUser }>(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });

export const disableUser = (userId: string, reason?: string) =>
  apiRequest<{ user: AdminUser }>(`/api/admin/users/${userId}/disable`, {
    method: 'POST',
    body: JSON.stringify({ ...(reason ? { reason } : {}) }),
  });

export const enableUser = (userId: string) =>
  apiRequest<{ user: AdminUser }>(`/api/admin/users/${userId}/enable`, { method: 'POST' });

export const revokeUserSessions = (userId: string) =>
  apiRequest<{ revoked: boolean }>(`/api/admin/users/${userId}/revoke-sessions`, {
    method: 'POST',
  });

/**
 * Sets a new password for an account.
 *
 * The value is sent once and never returned. The administrator is responsible for
 * delivering it; the app deliberately offers no way to read it back later.
 */
export const setUserPassword = (userId: string, password: string) =>
  apiRequest<{ updated: boolean }>(`/api/admin/users/${userId}/password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });

export const deleteUser = (userId: string) =>
  apiRequest<{ deleted: boolean }>(`/api/admin/users/${userId}`, { method: 'DELETE' });

/* ---- Permissions ---- */

export const getPermissionRegistry = () =>
  apiRequest<{ permissions: PermissionDefinition[] }>('/api/admin/permissions');

export const getUserPermissions = (userId: string) =>
  apiRequest<{
    role: 'admin' | 'user';
    permissions: string[];
    overrides: { permission: string; effect: 'allow' | 'deny'; updatedAt: string }[];
    dashboardScope: DashboardScope;
    registry: PermissionDefinition[];
  }>(`/api/admin/users/${userId}/permissions`);

export const setUserPermissions = (
  userId: string,
  changes: { permission: string; effect: 'allow' | 'deny' | null }[],
) =>
  apiRequest<{ role: string; permissions: string[] }>(
    `/api/admin/users/${userId}/permissions`,
    { method: 'PATCH', body: JSON.stringify({ changes }) },
  );

export const setDashboardScope = (
  userId: string,
  scope: 'all_groups' | 'selected_groups',
  groupIds: string[],
) =>
  apiRequest<{ scope: DashboardScope }>(`/api/admin/users/${userId}/dashboard-scope`, {
    method: 'PUT',
    body: JSON.stringify({ scope, groupIds }),
  });

export const clearDashboardScope = (userId: string) =>
  apiRequest<{ cleared: boolean }>(`/api/admin/users/${userId}/dashboard-scope`, {
    method: 'DELETE',
  });

/* ---- Groups ---- */

export const listAdminGroups = (params: {
  limit: number;
  offset: number;
  search?: string;
  status?: 'all' | 'active' | 'disabled';
}) => {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    status: params.status ?? 'all',
  });
  if (params.search) query.set('search', params.search);
  return apiRequest<{ groups: AdminGroup[]; pagination: Pagination }>(
    `/api/admin/groups?${query}`,
  );
};

export const disableGroup = (groupId: string) =>
  apiRequest<{ group: AdminGroup }>(`/api/admin/groups/${groupId}/disable`, { method: 'POST' });

export const enableGroup = (groupId: string) =>
  apiRequest<{ group: AdminGroup }>(`/api/admin/groups/${groupId}/enable`, { method: 'POST' });

export const deleteGroup = (groupId: string) =>
  apiRequest<{ deleted: boolean }>(`/api/admin/groups/${groupId}`, { method: 'DELETE' });

/* ---- Expenses ---- */

export const listAdminExpenses = (params: {
  limit: number;
  offset: number;
  search?: string;
  groupId?: string;
  from?: string;
  to?: string;
}) => {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.search) query.set('search', params.search);
  if (params.groupId) query.set('groupId', params.groupId);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  return apiRequest<{
    expenses: Record<string, unknown>[];
    totalValuePaise: number;
    pagination: Pagination;
  }>(`/api/admin/expenses?${query}`);
};

/* ---- Purge audit trail ---- */

export interface PurgeAudit {
  id: string;
  groupName: string;
  actorEmail: string;
  fromDate: string;
  toDate: string;
  expensesDeleted: number;
  settlementsDeleted: number;
  activitiesDeleted: number;
  amountPurgedPaise: number;
  createdAt: string;
}

/*
 * Admin history purge.
 *
 * Same request and response shapes as the group-scoped endpoints in domainApi, hitting
 * the admin routes instead. They are separate functions rather than a groupId switch
 * because the authorisation is genuinely different -- creator versus admin -- and the
 * call site should say which one it is relying on.
 */
export const adminPreviewPurge = (groupId: string, filters: PurgeFilters) =>
  apiRequest<PurgePreview>(`/api/admin/groups/${groupId}/purge/preview`, {
    method: 'POST',
    body: JSON.stringify(filters),
  });

export const adminExecutePurge = (
  groupId: string,
  filters: PurgeFilters & { confirmation: string },
) =>
  apiRequest<{
    expensesDeleted: number;
    settlementsDeleted: number;
    activitiesDeleted: number;
    amountPaise: number;
  }>(`/api/admin/groups/${groupId}/purge`, {
    method: 'POST',
    body: JSON.stringify(filters),
  });

export const listPurgeAudits = (params: { limit: number; offset: number }) =>
  apiRequest<{ audits: PurgeAudit[]; total: number }>(
    `/api/admin/purge-audits?limit=${params.limit}&offset=${params.offset}`,
  );

/* ---- Global search ---- */

export interface GlobalSearchResult {
  users: { id: string; fullName: string; email: string; status: 'active' | 'disabled' }[];
  groups: { id: string; name: string; inviteCode: string; status: 'active' | 'disabled' }[];
  expenses: { id: string; title: string; amountPaise: number; groupId: string }[];
}

export const globalSearch = (q: string, signal?: AbortSignal) =>
  apiRequest<GlobalSearchResult>(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal });

/* ---- Group detail ---- */

export interface AdminGroupDetail {
  group: {
    id: string;
    name: string;
    description: string | null;
    inviteCode: string;
    status: 'active' | 'disabled';
    disabledAt: string | null;
    payday: number | null;
    createdAt: string;
  };
  creator: { id: string; fullName: string; email: string };
  members: {
    id: string;
    fullName: string;
    email: string;
    status: 'active' | 'disabled';
    role: 'creator' | 'member';
    joinedAt: string;
  }[];
  stats: {
    memberCount: number;
    expenseCount: number;
    expenseValuePaise: number;
    settlementCount: number;
    settledValuePaise: number;
    pendingSettlements: number;
    activityCount: number;
    openDebtCount: number;
    openDebtValuePaise: number;
  };
  debts: {
    debtorId: string;
    debtorName: string;
    creditorId: string;
    creditorName: string;
    owedPaise: number;
  }[];
}

export const getAdminGroupDetail = (groupId: string, signal?: AbortSignal) =>
  apiRequest<AdminGroupDetail>(`/api/admin/groups/${groupId}`, { signal });

export const transferGroupCreator = (groupId: string, newCreatorId: string) =>
  apiRequest<{ groupId: string; newCreatorId: string }>(
    `/api/admin/groups/${groupId}/transfer-creator`,
    { method: 'POST', body: JSON.stringify({ newCreatorId }) },
  );

export const removeGroupMember = (groupId: string, userId: string) =>
  apiRequest<{ removed: boolean }>(`/api/admin/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
  });

/* ---- Expenses ---- */

export const deleteAdminExpense = (expenseId: string) =>
  apiRequest<{ deleted: boolean }>(`/api/admin/expenses/${expenseId}`, { method: 'DELETE' });

/* ---- Settlements ---- */

export interface AdminSettlement {
  id: string;
  group: { id: string; name: string };
  payer: { id: string; fullName: string; email: string };
  receiver: { id: string; fullName: string; email: string } | null;
  amountPaise: number;
  status: string;
  paymentMethod: string;
  hasProof: boolean;
  note: string;
  paidAt: string;
  createdAt: string;
  /** Live debt between the two, straight from the balance engine. */
  outstandingPaise: number;
}

export const listAdminSettlements = (params: {
  limit: number;
  offset: number;
  search?: string;
  groupId?: string;
  status?: string;
}) => {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    status: params.status ?? 'all',
  });
  if (params.search) query.set('search', params.search);
  if (params.groupId) query.set('groupId', params.groupId);
  return apiRequest<{ settlements: AdminSettlement[]; pagination: Pagination }>(
    `/api/admin/settlements?${query}`,
  );
};

export const cancelAdminSettlement = (settlementId: string) =>
  apiRequest<{ settlement: { id: string; status: string } }>(
    `/api/admin/settlements/${settlementId}/cancel`,
    { method: 'POST' },
  );

/* ---- Activity ---- */

export interface AdminActivity {
  id: string;
  type: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; fullName: string; email: string };
  group: { id: string; name: string };
}

export const listAdminActivity = (params: {
  limit: number;
  offset: number;
  search?: string;
  groupId?: string;
  actorId?: string;
  type?: string;
  from?: string;
  to?: string;
}) => {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  for (const key of ['search', 'groupId', 'actorId', 'type', 'from', 'to'] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  return apiRequest<{ activities: AdminActivity[]; pagination: Pagination }>(
    `/api/admin/activity?${query}`,
  );
};

/* ---- Audit log ---- */

export interface AdminAudit {
  id: string;
  action: string;
  actor: { id: string; fullName: string; email: string } | null;
  actorEmail: string;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export const listAdminAudit = (params: {
  limit: number;
  offset: number;
  search?: string;
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}) => {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  for (const key of [
    'search',
    'action',
    'actorId',
    'targetType',
    'targetId',
    'from',
    'to',
  ] as const) {
    const value = params[key];
    if (value) query.set(key, value);
  }
  return apiRequest<{ audits: AdminAudit[]; pagination: Pagination }>(
    `/api/admin/audit?${query}`,
  );
};

export const listAuditActions = () =>
  apiRequest<{ actions: string[] }>('/api/admin/audit/actions');
