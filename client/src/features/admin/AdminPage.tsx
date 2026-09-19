import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Power,
  PowerOff,
  Receipt,
  Search,
  Settings2,
  Shield,
  Trash2,
  Users2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  disableGroup,
  enableGroup,
  type AdminGroup,
  type AdminUser,
} from '@/lib/adminApi';
import { UserActionsDialog } from './UserActionsDialog';
import { UserPermissionsDialog } from './UserPermissionsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiClientError, apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatPaise, formatPaiseCompact } from '@/lib/money';
import type { Pagination } from '@/types/domain';

/**
 * Admin console.
 *
 * Read-broad, write-narrow. An administrator can inspect every user, group and expense,
 * change a role, force a sign-out and delete records — but there is deliberately no
 * impersonation and no way to view a credential, so admin access can never be used to
 * transact as someone else.
 */

const PAGE_SIZE = 25;

interface AdminExpense {
  id: string;
  title: string;
  amountPaise: number;
  expenseDate: string;
  paymentMode: string;
  category: string | null;
  groupName: string;
  payerName: string;
  participantCount: number;
}

interface PlatformStats {
  users: { total: number; verified: number; admins: number; newLast30Days: number };
  groups: { total: number; active30Days: number };
  expenses: { total: number; totalValuePaise: number; last30Days: number };
  settlements: {
    total: number;
    completed: number;
    pending: number;
    completedValuePaise: number;
  };
}

const StatTile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
}> = ({ label, value, hint, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <p className="t-eyebrow">{label}</p>
      <span className="shrink-0 text-slate-400">{icon}</span>
    </div>
    <p className="t-money mt-2 text-xl text-slate-900 sm:text-2xl">{value}</p>
    {hint && <p className="mt-0.5 t-meta">{hint}</p>}
  </div>
);

/** Shared search + pagination chrome for each tab. */
const TableShell: React.FC<{
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  pagination: Pagination | null;
  page: number;
  onPage: (page: number) => void;
  children: React.ReactNode;
  extraFilters?: React.ReactNode;
}> = ({ search, onSearch, placeholder, pagination, page, onPage, children, extraFilters }) => (
  <div className="space-y-3">
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      {extraFilters}
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {children}

      {pagination && pagination.total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
          <span className="t-meta">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, pagination.total)} of{' '}
            {pagination.total}
          </span>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => onPage(Math.max(0, page - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => onPage(page + 1)}
              disabled={!pagination.hasMore}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  </div>
);

const RowSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => (
  <div className="space-y-3 p-4">
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="flex items-center gap-3">
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    ))}
  </div>
);

/** Debounces a value so typing does not fire a request per keystroke. */
const useDebounced = <T,>(value: T, delay = 350): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

export const AdminPage: React.FC = () => {
  const { user, can } = useAuth();
  // The redirect below renders on the next commit, so without this the loaders would
  // still fire once for a non-admin and take four 403s.
  // Entry is a permission now, not a role: an administrator can hand someone the
  // console without making them an administrator.
  const isAdmin = can('admin.access');
  const canManageUsers = can('admin.users.manage');
  const canManagePermissions = can('admin.permissions.manage');
  const canManageGroups = can('admin.groups.manage');
  const [groupBusyId, setGroupBusyId] = useState<string | null>(null);
  const [actionsFor, setActionsFor] = useState<AdminUser | null>(null);
  const [permissionsFor, setPermissionsFor] = useState<AdminUser | null>(null);

  const [stats, setStats] = useState<PlatformStats | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [userRole, setUserRole] = useState<'all' | 'admin' | 'user'>('all');
  const [userPage, setUserPage] = useState(0);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [userPagination, setUserPagination] = useState<Pagination | null>(null);

  const [groupSearch, setGroupSearch] = useState('');
  const [groupPage, setGroupPage] = useState(0);
  const [groups, setGroups] = useState<AdminGroup[] | null>(null);
  const [groupPagination, setGroupPagination] = useState<Pagination | null>(null);

  const [expenseSearch, setExpenseSearch] = useState('');
  const [expensePage, setExpensePage] = useState(0);
  const [expenses, setExpenses] = useState<AdminExpense[] | null>(null);
  const [expensePagination, setExpensePagination] = useState<Pagination | null>(null);
  const [expenseValue, setExpenseValue] = useState(0);

  const [confirm, setConfirm] = useState<
    | { kind: 'delete-user'; user: AdminUser }
    | { kind: 'delete-group'; group: AdminGroup }
    | { kind: 'revoke'; user: AdminUser }
    | null
  >(null);
  const [isBusy, setIsBusy] = useState(false);

  const debouncedUserSearch = useDebounced(userSearch);
  const debouncedGroupSearch = useDebounced(groupSearch);
  const debouncedExpenseSearch = useDebounced(expenseSearch);

  useEffect(() => {
    if (!isAdmin) return;
    void apiRequest<PlatformStats>('/api/admin/stats')
      .then(setStats)
      .catch(() => undefined);
  }, [isAdmin]);

  /**
   * Disabling a group makes it read-only for its members rather than hiding it: their
   * financial history stays visible and exportable, but nothing new can be written.
   */
  const toggleGroupStatus = async (group: AdminGroup) => {
    if (groupBusyId) return;
    setGroupBusyId(group.id);
    try {
      if (group.status === 'disabled') {
        await enableGroup(group.id);
        toast.success(`${group.name} re-enabled.`);
      } else {
        await disableGroup(group.id);
        toast.success(`${group.name} is now read-only.`);
      }
      void loadGroups();
    } catch (err: unknown) {
      toast.error(
        err instanceof ApiClientError ? err.message : 'Could not change that group.',
      );
    } finally {
      setGroupBusyId(null);
    }
  };

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(userPage * PAGE_SIZE),
      role: userRole,
    });
    if (debouncedUserSearch) params.set('search', debouncedUserSearch);

    try {
      const data = await apiRequest<{ users: AdminUser[]; pagination: Pagination }>(
        `/api/admin/users?${params}`,
      );
      setUsers(data.users);
      setUserPagination(data.pagination);
    } catch {
      setUsers([]);
    }
  }, [isAdmin, userPage, userRole, debouncedUserSearch]);

  const loadGroups = useCallback(async () => {
    if (!isAdmin) return;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(groupPage * PAGE_SIZE),
    });
    if (debouncedGroupSearch) params.set('search', debouncedGroupSearch);

    try {
      const data = await apiRequest<{ groups: AdminGroup[]; pagination: Pagination }>(
        `/api/admin/groups?${params}`,
      );
      setGroups(data.groups);
      setGroupPagination(data.pagination);
    } catch {
      setGroups([]);
    }
  }, [isAdmin, groupPage, debouncedGroupSearch]);

  const loadExpenses = useCallback(async () => {
    if (!isAdmin) return;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(expensePage * PAGE_SIZE),
    });
    if (debouncedExpenseSearch) params.set('search', debouncedExpenseSearch);

    try {
      const data = await apiRequest<{
        expenses: AdminExpense[];
        pagination: Pagination;
        totalValuePaise: number;
      }>(`/api/admin/expenses?${params}`);
      setExpenses(data.expenses);
      setExpensePagination(data.pagination);
      setExpenseValue(data.totalValuePaise);
    } catch {
      setExpenses([]);
    }
  }, [isAdmin, expensePage, debouncedExpenseSearch]);

  useEffect(() => void loadUsers(), [loadUsers]);
  useEffect(() => void loadGroups(), [loadGroups]);
  useEffect(() => void loadExpenses(), [loadExpenses]);

  // Route guard: the server enforces this too, but rendering the console to a
  // non-admin would be confusing regardless.
  if (user && !can('admin.access')) return <Navigate to="/app" replace />;


  const runConfirmed = async () => {
    if (!confirm || isBusy) return;
    setIsBusy(true);
    try {
      if (confirm.kind === 'delete-user') {
        await apiRequest(`/api/admin/users/${confirm.user.id}`, { method: 'DELETE' });
        toast.success('User deleted');
        void loadUsers();
      } else if (confirm.kind === 'delete-group') {
        await apiRequest(`/api/admin/groups/${confirm.group.id}`, { method: 'DELETE' });
        toast.success('Group deleted');
        void loadGroups();
        void loadExpenses();
      } else {
        await apiRequest(`/api/admin/users/${confirm.user.id}/revoke-sessions`, {
          method: 'POST',
        });
        toast.success(`${confirm.user.fullName} was signed out everywhere`);
        void loadUsers();
      }
      setConfirm(null);
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'That action failed.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AppShell title="Admin console">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        {/* ---- Telemetry ---- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats ? (
            <>
              <StatTile
                label="Users"
                value={String(stats.users.total)}
                hint={`${stats.users.verified} verified · ${stats.users.admins} admin`}
                icon={<Users2 className="h-4 w-4" />}
              />
              <StatTile
                label="Groups"
                value={String(stats.groups.total)}
                hint={`${stats.groups.active30Days} active in 30d`}
                icon={<Users2 className="h-4 w-4" />}
              />
              <StatTile
                label="Expenses"
                value={String(stats.expenses.total)}
                hint={formatPaiseCompact(stats.expenses.totalValuePaise)}
                icon={<Receipt className="h-4 w-4" />}
              />
              <StatTile
                label="Settled"
                value={formatPaiseCompact(stats.settlements.completedValuePaise)}
                hint={`${stats.settlements.pending} awaiting confirmation`}
                icon={<Shield className="h-4 w-4" />}
              />
            </>
          ) : (
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))
          )}
        </div>

        <Tabs defaultValue="users">
          <TabsList className="sm:max-w-md">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>

          {/* ---- Users ---- */}
          <TabsContent value="users">
            <TableShell
              search={userSearch}
              onSearch={(value) => {
                setUserSearch(value);
                setUserPage(0);
              }}
              placeholder="Search by name or email"
              pagination={userPagination}
              page={userPage}
              onPage={setUserPage}
              extraFilters={
                <Select
                  value={userRole}
                  onValueChange={(value) => {
                    setUserRole(value as typeof userRole);
                    setUserPage(0);
                  }}
                >
                  <SelectTrigger className="sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="admin">Admins only</SelectItem>
                    <SelectItem value="user">Users only</SelectItem>
                  </SelectContent>
                </Select>
              }
            >
              {users === null ? (
                <RowSkeleton />
              ) : users.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">No users found.</p>
              ) : (
                <ul>
                  {users.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900">
                          <span className="truncate">{row.fullName}</span>
                          {row.role === 'admin' && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              ADMIN
                            </span>
                          )}
                          {!row.isVerified && (
                            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                              UNVERIFIED
                            </span>
                          )}
                        </p>
                        <p className="truncate t-meta">{row.email}</p>
                        <p className="t-meta">
                          {row.groupCount} groups · {row.expenseCount} expenses ·{' '}
                          {row.activeSessions} active sessions
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {row.status === 'disabled' && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                            Disabled
                          </span>
                        )}
                        {row.permissionOverrideCount > 0 && (
                          <span
                            className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700"
                            title={`${row.permissionOverrideCount} permission overrides`}
                          >
                            {row.permissionOverrideCount} custom
                          </span>
                        )}
                        {canManagePermissions && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11"
                            onClick={() => setPermissionsFor(row)}
                          >
                            <Shield className="mr-1.5 h-3.5 w-3.5" />
                            Permissions
                          </Button>
                        )}
                        {canManageUsers && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11"
                            onClick={() => setActionsFor(row)}
                          >
                            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                            Manage
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 text-destructive hover:bg-red-50"
                          disabled={row.id === user?.id || !canManageUsers}
                          onClick={() => setConfirm({ kind: 'delete-user', user: row })}
                          aria-label={`Delete ${row.fullName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TableShell>
          </TabsContent>

          {/* ---- Groups ---- */}
          <TabsContent value="groups">
            <TableShell
              search={groupSearch}
              onSearch={(value) => {
                setGroupSearch(value);
                setGroupPage(0);
              }}
              placeholder="Search by group name or invite code"
              pagination={groupPagination}
              page={groupPage}
              onPage={setGroupPage}
            >
              {groups === null ? (
                <RowSkeleton />
              ) : groups.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">No groups found.</p>
              ) : (
                <ul>
                  {groups.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {row.name}
                        </p>
                        <p className="truncate t-meta">
                          Created by {row.creatorName} · code{' '}
                          <span className="font-mono">{row.inviteCode}</span>
                        </p>
                        <p className="t-meta">
                          {row.memberCount} members · {row.expenseCount} expenses ·{' '}
                          {formatPaise(row.totalValuePaise)}
                          {row.payday && ` · payday ${row.payday}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {row.status === 'disabled' && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                            Disabled
                          </span>
                        )}
                        {canManageGroups && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11"
                            disabled={groupBusyId === row.id}
                            onClick={() => void toggleGroupStatus(row)}
                          >
                            {groupBusyId === row.id ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : row.status === 'disabled' ? (
                              <Power className="mr-1.5 h-3.5 w-3.5" />
                            ) : (
                              <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            {row.status === 'disabled' ? 'Enable' : 'Disable'}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 text-destructive hover:bg-red-50"
                          disabled={!canManageGroups}
                          onClick={() => setConfirm({ kind: 'delete-group', group: row })}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TableShell>
          </TabsContent>

          {/* ---- Expenses ---- */}
          <TabsContent value="expenses">
            <TableShell
              search={expenseSearch}
              onSearch={(value) => {
                setExpenseSearch(value);
                setExpensePage(0);
              }}
              placeholder="Search expense titles"
              pagination={expensePagination}
              page={expensePage}
              onPage={setExpensePage}
            >
              {expenses === null ? (
                <RowSkeleton />
              ) : expenses.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">
                  No expenses found.
                </p>
              ) : (
                <>
                  <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2">
                    <p className="t-meta">
                      Matching total:{' '}
                      <span className="t-money text-slate-900">
                        {formatPaise(expenseValue)}
                      </span>
                    </p>
                  </div>
                  <ul>
                    {expenses.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center gap-3 border-t border-slate-100 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {row.title}
                          </p>
                          <p className="truncate t-meta">
                            {row.groupName} · paid by {row.payerName} · {row.expenseDate}
                          </p>
                        </div>
                        <span className="t-money shrink-0 text-sm text-slate-900">
                          {formatPaise(row.amountPaise)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </TableShell>
          </TabsContent>
        </Tabs>

        <p className="px-1 t-meta">
          Administrators can inspect and manage records, but cannot sign in as another user
          or view anyone&apos;s credentials. To deal with a compromised account, revoke its
          sessions.
        </p>
      </div>

      {/* ---- Confirmation ---- */}
      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent variant="centered" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === 'delete-user'
                ? `Delete ${confirm.user.fullName}?`
                : confirm?.kind === 'delete-group'
                  ? `Delete ${confirm.group.name}?`
                  : `Sign out ${confirm?.user.fullName}?`}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm leading-relaxed text-slate-600">
              {confirm?.kind === 'delete-user'
                ? 'Their account will be removed. Users who funded expenses cannot be deleted, because doing so would orphan financial records.'
                : confirm?.kind === 'delete-group'
                  ? `Every expense, settlement and balance in this group will be permanently deleted for all ${confirm.group.memberCount} members.`
                  : 'They will be signed out of every device and will need to sign in again. Nothing else changes.'}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              variant={confirm?.kind === 'revoke' ? 'default' : 'destructive'}
              onClick={runConfirmed}
              disabled={isBusy}
            >
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirm?.kind === 'revoke' ? 'Sign out everywhere' : 'Delete permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <UserActionsDialog
        open={actionsFor !== null}
        onOpenChange={(next) => !next && setActionsFor(null)}
        user={actionsFor}
        currentUserId={user?.id ?? ''}
        onChanged={() => void loadUsers()}
      />

      <UserPermissionsDialog
        open={permissionsFor !== null}
        onOpenChange={(next) => !next && setPermissionsFor(null)}
        user={permissionsFor}
        onSaved={() => void loadUsers()}
      />

    </AppShell>
  );
};
