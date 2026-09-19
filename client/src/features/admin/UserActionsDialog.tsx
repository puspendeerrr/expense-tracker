import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import {
  disableUser,
  enableUser,
  revokeUserSessions,
  setUserPassword,
  setUserRole,
  type AdminUser,
} from '@/lib/adminApi';

/**
 * Account actions for one user.
 *
 * Grouped into one dialog rather than a row of icon buttons because each of these has
 * a consequence worth reading before clicking, and several of them (disable, reset
 * password) end the person's sessions.
 *
 * There is deliberately no "sign in as this user". An administrator can end a session
 * or reset a credential, but never act as somebody else -- that keeps every action in
 * the audit log attributable to a real person.
 */

interface UserActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
  /** The signed-in administrator, so the dialog can refuse self-destructive actions. */
  currentUserId: string;
  onChanged: () => void;
}

export const UserActionsDialog: React.FC<UserActionsDialogProps> = ({
  open,
  onOpenChange,
  user,
  currentUserId,
  onChanged,
}) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setReason('');
    setError(null);
    setBusy(null);
  }, [open]);

  if (!user) return null;

  const isSelf = user.id === currentUserId;

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await action();
      toast.success(success);
      onChanged();
    } catch (err: unknown) {
      const message =
        err instanceof ApiClientError ? err.message : 'That action could not be completed.';
      setError(message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user.fullName}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-700">{user.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                  user.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700',
                )}
              >
                {user.status}
              </span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                {user.role}
              </span>
              <span className="t-meta">{user.activeSessions} active sessions</span>
            </div>
            {user.disabledReason && (
              <p className="t-meta mt-1.5">Reason: {user.disabledReason}</p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {isSelf && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-900">
                This is your own account. Actions that would lock you out are disabled.
              </p>
            </div>
          )}

          {/* ---- Access ---- */}
          <section className="space-y-2">
            <h3 className="t-eyebrow">Access</h3>
            <div className="flex flex-col gap-2">
              {user.status === 'active' ? (
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <Label htmlFor="disable-reason">Reason (shown to them at sign-in)</Label>
                  <Input
                    id="disable-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Left the company"
                    maxLength={200}
                  />
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:bg-red-50"
                    disabled={isSelf || busy !== null}
                    onClick={() =>
                      void run(
                        'disable',
                        () => disableUser(user.id, reason.trim() || undefined),
                        'Account disabled and signed out.',
                      )
                    }
                  >
                    {busy === 'disable' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserX className="mr-2 h-4 w-4" />
                    )}
                    Disable account
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() =>
                    void run('enable', () => enableUser(user.id), 'Account re-enabled.')
                  }
                >
                  {busy === 'enable' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserCheck className="mr-2 h-4 w-4" />
                  )}
                  Enable account
                </Button>
              )}

              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    'revoke',
                    () => revokeUserSessions(user.id),
                    'Signed out of every device.',
                  )
                }
              >
                {busy === 'revoke' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Sign out everywhere
              </Button>
            </div>
          </section>

          {/* ---- Role ---- */}
          <section className="space-y-2">
            <h3 className="t-eyebrow">Role</h3>
            <Button
              variant="outline"
              className="w-full"
              disabled={isSelf || busy !== null}
              onClick={() =>
                void run(
                  'role',
                  () => setUserRole(user.id, user.role === 'admin' ? 'user' : 'admin'),
                  user.role === 'admin'
                    ? 'Demoted to an ordinary account.'
                    : 'Promoted to administrator.',
                )
              }
            >
              {busy === 'role' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {user.role === 'admin' ? 'Remove administrator' : 'Make administrator'}
            </Button>
            <p className="t-meta">
              An administrator implicitly holds every permission. For anything narrower,
              use the permissions editor instead.
            </p>
          </section>

          {/* ---- Password ---- */}
          <section className="space-y-2">
            <h3 className="t-eyebrow">Set a new password</h3>
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters, with a number"
                autoComplete="off"
              />
              <p className="t-meta">
                Shown only here, once. Deliver it to them yourself &mdash; it is never
                stored in readable form and cannot be looked up later. Setting it signs
                them out everywhere.
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={password.trim().length < 8 || busy !== null}
                onClick={() =>
                  void run(
                    'password',
                    async () => {
                      await setUserPassword(user.id, password);
                      setPassword('');
                    },
                    'Password set and sessions revoked.',
                  )
                }
              >
                {busy === 'password' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Set password
              </Button>
            </div>
          </section>
        </DialogBody>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
