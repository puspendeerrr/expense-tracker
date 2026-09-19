import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import {
  clearDashboardScope,
  getUserPermissions,
  listAdminGroups,
  setDashboardScope,
  setUserPermissions,
  type AdminGroup,
  type AdminUser,
  type DashboardScope,
  type PermissionDefinition,
} from '@/lib/adminApi';

/**
 * Per-user permission editor.
 *
 * Three states per capability, not two: granted, denied, or "default". Default matters
 * because it is not the same as an explicit grant -- if the product later changes what
 * ordinary accounts can do, everyone left on default moves with it, while explicit rows
 * stay put. Collapsing the three into a checkbox would quietly freeze people's
 * permissions at whatever the defaults happened to be on the day someone opened this
 * dialog.
 *
 * Changes are staged locally and saved together, so a half-applied permission set is
 * never written while the administrator is still deciding.
 */

type Effect = 'allow' | 'deny' | null;

const CATEGORY_LABELS: Record<string, string> = {
  platform: 'Platform administration',
  groups: 'Groups',
  money: 'Money',
  insights: 'Insights',
};

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
  onSaved: () => void;
}

export const UserPermissionsDialog: React.FC<UserPermissionsDialogProps> = ({
  open,
  onOpenChange,
  user,
  onSaved,
}) => {
  const [registry, setRegistry] = useState<PermissionDefinition[]>([]);
  const [effects, setEffects] = useState<Record<string, Effect>>({});
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [scope, setScope] = useState<DashboardScope>({ kind: 'none' });
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [data, groupList] = await Promise.all([
        getUserPermissions(user.id),
        listAdminGroups({ limit: 100, offset: 0 }),
      ]);

      setRegistry(data.registry);
      setRole(data.role);
      setGroups(groupList.groups);
      setEffects(
        Object.fromEntries(
          data.registry.map((permission) => [
            permission.key,
            (data.overrides.find((override) => override.permission === permission.key)
              ?.effect ?? null) as Effect,
          ]),
        ),
      );
      setScope(data.dashboardScope);
      setSelectedGroupIds(
        data.dashboardScope.kind === 'selected_groups' ? data.dashboardScope.groupIds : [],
      );
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load permissions.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, PermissionDefinition[]>();
    for (const permission of registry) {
      const list = byCategory.get(permission.category) ?? [];
      list.push(permission);
      byCategory.set(permission.category, list);
    }
    return [...byCategory.entries()];
  }, [registry]);

  /** What the account effectively holds given the staged state. */
  const isEffective = (permission: PermissionDefinition): boolean => {
    if (role === 'admin') return true;
    const effect = effects[permission.key] ?? null;
    if (effect === 'allow') return true;
    if (effect === 'deny') return false;
    return permission.defaultGranted;
  };

  const cycle = (permission: PermissionDefinition) => {
    setEffects((prev) => {
      const current = prev[permission.key] ?? null;
      // default -> opposite of the default -> back to default.
      const next: Effect =
        current === null ? (permission.defaultGranted ? 'deny' : 'allow') : null;
      return { ...prev, [permission.key]: next };
    });
  };

  const spendingGranted = registry.some(
    (permission) => permission.key === 'dashboard.spending' && isEffective(permission),
  );

  const save = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const changes = registry.map((permission) => ({
        permission: permission.key,
        effect: effects[permission.key] ?? null,
      }));

      await setUserPermissions(user.id, changes);

      // Scope only means anything alongside the permission, so the two are kept in step
      // here rather than leaving a stale grant behind.
      if (spendingGranted) {
        await setDashboardScope(
          user.id,
          scope.kind === 'all_groups' ? 'all_groups' : 'selected_groups',
          scope.kind === 'all_groups' ? [] : selectedGroupIds,
        );
      } else if (scope.kind !== 'none') {
        await clearDashboardScope(user.id);
      }

      toast.success(`Permissions updated for ${user.fullName}.`);
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  const scopeValid =
    !spendingGranted || scope.kind === 'all_groups' || selectedGroupIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissions &mdash; {user?.fullName}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              {role === 'admin' && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-900">
                    This account is a platform administrator, so it holds every
                    permission regardless of what is set here. Change its role first to
                    manage individual capabilities.
                  </p>
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              {grouped.map(([category, permissions]) => (
                <section key={category} className="space-y-2">
                  <h3 className="t-eyebrow">{CATEGORY_LABELS[category] ?? category}</h3>
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    {permissions.map((permission, index) => {
                      const effect = effects[permission.key] ?? null;
                      const on = isEffective(permission);

                      return (
                        <div
                          key={permission.key}
                          className={cn(
                            'flex items-start gap-3 bg-white px-3 py-2.5 transition-colors',
                            index > 0 && 'border-t border-slate-100',
                            role !== 'admin' && 'hover:bg-slate-50',
                          )}
                        >
                          <Checkbox
                            id={`perm-${permission.key}`}
                            className="mt-0.5"
                            checked={on}
                            disabled={role === 'admin'}
                            onCheckedChange={() => cycle(permission)}
                          />
                          <div className="min-w-0 flex-1">
                            <Label
                              htmlFor={`perm-${permission.key}`}
                              className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900"
                            >
                              {permission.label}
                              {permission.sensitive && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                  Sensitive
                                </span>
                              )}
                              {effect !== null && role !== 'admin' && (
                                <span
                                  className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                    effect === 'allow'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-red-100 text-red-700',
                                  )}
                                >
                                  {effect === 'allow' ? 'Granted' : 'Revoked'}
                                </span>
                              )}
                            </Label>
                            <p className="t-meta mt-0.5">{permission.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              {/* ---- Spending dashboard scope ---- */}
              {spendingGranted && role !== 'admin' && (
                <section className="animate-fade-in-up space-y-2">
                  <h3 className="t-eyebrow">Spending dashboard &mdash; what they may see</h3>
                  <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                    <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5">
                      <input
                        type="radio"
                        name="dashboard-scope"
                        className="h-4 w-4"
                        checked={scope.kind === 'all_groups'}
                        onChange={() => setScope({ kind: 'all_groups' })}
                      />
                      <span className="text-sm text-slate-800">
                        Every group on the platform
                      </span>
                    </label>

                    <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5">
                      <input
                        type="radio"
                        name="dashboard-scope"
                        className="h-4 w-4"
                        checked={scope.kind !== 'all_groups'}
                        onChange={() =>
                          setScope({ kind: 'selected_groups', groupIds: selectedGroupIds })
                        }
                      />
                      <span className="text-sm text-slate-800">Selected groups only</span>
                    </label>

                    {scope.kind !== 'all_groups' && (
                      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-100">
                        {groups.length === 0 ? (
                          <p className="px-3 py-4 text-sm text-slate-500">
                            No groups on the platform yet.
                          </p>
                        ) : (
                          groups.map((group, index) => (
                            <label
                              key={group.id}
                              className={cn(
                                'flex min-h-[40px] cursor-pointer items-center gap-2.5 px-3 py-1.5',
                                index > 0 && 'border-t border-slate-100',
                              )}
                            >
                              <Checkbox
                                checked={selectedGroupIds.includes(group.id)}
                                onCheckedChange={() =>
                                  setSelectedGroupIds((prev) =>
                                    prev.includes(group.id)
                                      ? prev.filter((id) => id !== group.id)
                                      : [...prev, group.id],
                                  )
                                }
                              />
                              <span className="min-w-0 flex-1 truncate text-sm text-slate-800">
                                {group.name}
                              </span>
                              <span className="t-meta shrink-0">
                                {group.memberCount} members
                              </span>
                            </label>
                          ))
                        )}
                      </div>
                    )}

                    {!scopeValid && (
                      <p role="alert" className="text-sm text-destructive">
                        Choose at least one group, or grant access to all of them.
                      </p>
                    )}
                  </div>
                </section>
              )}

              <p className="flex items-start gap-2 t-meta">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Unticking a capability an ordinary account normally has records an
                explicit revocation; ticking one it normally lacks records a grant.
                Everything else stays on the platform default.
              </p>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            disabled={isSaving || isLoading || role === 'admin' || !scopeValid}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving…' : 'Save permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
