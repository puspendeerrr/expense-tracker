import { apiRequest } from './api';

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
}) => {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
    role: params.role ?? 'all',
    verified: params.verified ?? 'all',
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

export const listAdminGroups = (params: { limit: number; offset: number; search?: string }) => {
  const query = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
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

export const listPurgeAudits = (params: { limit: number; offset: number }) =>
  apiRequest<{ audits: PurgeAudit[]; total: number }>(
    `/api/admin/purge-audits?limit=${params.limit}&offset=${params.offset}`,
  );
