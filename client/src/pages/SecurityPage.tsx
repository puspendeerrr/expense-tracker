import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Check,
  Laptop,
  LogOut,
  MonitorSmartphone,
  Pencil,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  listAccountEvents,
  listDevices,
  renameDevice,
  revokeDevice,
  revokeOtherDevices,
  type AccountEvent,
  type AccountEventType,
  type Device,
} from '@/lib/securityApi';

/**
 * Account security.
 *
 * Two questions people actually come here with: "what is signed in to my account?" and
 * "has anything happened to it?". Devices answer the first, history the second, and
 * they are tabs rather than one long page because acting on a device and reading
 * history are separate jobs.
 *
 * No location is shown. This deployment has no geolocation provider, and a city guessed
 * from an IP is exactly the kind of detail someone would make a security decision on --
 * so the IP is shown as itself rather than dressed up as something it is not.
 */

const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ events */

const EVENT_LABELS: Record<AccountEventType, string> = {
  login_succeeded: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  logout: 'Signed out',
  new_device_detected: 'New device used',
  session_revoked: 'A device was signed out',
  sessions_revoked_all: 'All other devices signed out',
  password_changed: 'Password changed',
  password_reset: 'Password reset',
  device_renamed: 'Device renamed',
  profile_updated: 'Profile updated',
  account_deactivated: 'Account deactivated',
  account_reactivated: 'Account reactivated',
  data_exported: 'Data exported',
};

/** Events worth drawing the eye to. A failed sign-in is the one people scan for. */
const ALARMING: AccountEventType[] = [
  'login_failed',
  'new_device_detected',
  'password_reset',
  'password_changed',
];

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

const relative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const isPhone = (device: string): boolean => /iOS|Android/.test(device);

/* ------------------------------------------------------------------ devices */

const DeviceRow: React.FC<{
  device: Device;
  isBusy: boolean;
  onRename: (device: Device) => void;
  onRevoke: (device: Device) => void;
}> = ({ device, isBusy, onRename, onRevoke }) => {
  const Icon = isPhone(device.device) ? Smartphone : Laptop;

  return (
    <li className="flex items-start gap-3 px-3.5 py-3">
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          device.isCurrent
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground',
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold">
            {device.name ?? device.device}
          </span>
          {device.isCurrent && (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              This device
            </span>
          )}
        </p>
        <p className="t-meta">
          {device.name ? `${device.device} · ` : ''}
          {device.ipAddress ?? 'unknown address'}
        </p>
        <p className="t-meta">Last used {relative(device.lastUsedAt)}</p>
      </div>

      <div className="flex shrink-0 gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={isBusy}
          onClick={() => onRename(device)}
          aria-label={`Rename ${device.name ?? device.device}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-destructive"
          disabled={isBusy}
          onClick={() => onRevoke(device)}
          aria-label={`Sign out ${device.name ?? device.device}`}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
};

/* ------------------------------------------------------------------ screen */

export const SecurityPage: React.FC = () => {
  const { refreshUser } = useAuth();

  const [devices, setDevices] = useState<Device[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [busyDevice, setBusyDevice] = useState<string | null>(null);

  const [scope, setScope] = useState<'logins' | 'all'>('logins');
  const [events, setEvents] = useState<AccountEvent[] | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [renaming, setRenaming] = useState<Device | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [revoking, setRevoking] = useState<Device | null>(null);
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);

  const loadDevices = useCallback(async () => {
    setDevicesError(null);
    try {
      setDevices((await listDevices()).devices);
    } catch (err: unknown) {
      setDevicesError(
        err instanceof ApiClientError ? err.message : 'Could not load your devices.',
      );
    }
  }, []);

  const loadEvents = useCallback(
    async (offset: number) => {
      setEventsError(null);
      if (offset > 0) setIsLoadingMore(true);
      try {
        const page = await listAccountEvents({ scope, limit: PAGE_SIZE, offset });
        setEvents((prev) => (offset > 0 ? [...(prev ?? []), ...page.events] : page.events));
        setHasMore(page.pagination.hasMore);
      } catch (err: unknown) {
        setEventsError(
          err instanceof ApiClientError ? err.message : 'Could not load your history.',
        );
      } finally {
        setIsLoadingMore(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    setEvents(null);
    void loadEvents(0);
  }, [loadEvents]);

  const saveName = async () => {
    if (!renaming) return;
    const trimmed = nameDraft.trim();
    setBusyDevice(renaming.id);
    try {
      const result = await renameDevice(renaming.id, trimmed === '' ? null : trimmed);
      setDevices(result.devices);
      setRenaming(null);
      toast.success(trimmed === '' ? 'Device name cleared' : 'Device renamed');
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not rename that device.');
    } finally {
      setBusyDevice(null);
    }
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    setBusyDevice(revoking.id);
    try {
      const result = await revokeDevice(revoking.id);
      setRevoking(null);

      if (result.signedOut) {
        // We just revoked our own session; the cookie is gone, so re-checking auth
        // sends us to the login screen rather than leaving a dead page behind.
        toast.success('Signed out');
        await refreshUser();
        return;
      }

      setDevices(result.devices);
      void loadEvents(0);
      toast.success('That device was signed out');
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not sign out that device.');
    } finally {
      setBusyDevice(null);
    }
  };

  const confirmRevokeAll = async () => {
    setBusyDevice('all');
    try {
      const result = await revokeOtherDevices();
      setDevices(result.devices);
      setRevokeAllOpen(false);
      void loadEvents(0);
      toast.success(
        result.revoked === 0
          ? 'No other devices were signed in'
          : `${result.revoked} other ${result.revoked === 1 ? 'device' : 'devices'} signed out`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not sign out other devices.');
    } finally {
      setBusyDevice(null);
    }
  };

  const otherCount = (devices ?? []).filter((d) => !d.isCurrent).length;

  return (
    <AppShell title="Security">
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6">
        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList>
            <TabsTrigger value="devices">
              <MonitorSmartphone className="h-4 w-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="history">
              <ShieldCheck className="h-4 w-4" />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* ---- Devices ---- */}
          <TabsContent value="devices" className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="t-subtitle">Where you are signed in</h2>
                <p className="t-meta">
                  Signing a device out ends its session immediately.
                </p>
              </div>
              {otherCount > 0 && (
                <Button
                  variant="outline"
                  className="h-11 shrink-0"
                  onClick={() => setRevokeAllOpen(true)}
                  disabled={busyDevice !== null}
                >
                  <LogOut className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Sign out others</span>
                </Button>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {devicesError ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">{devicesError}</p>
                  <Button variant="outline" className="mt-3 h-11" onClick={() => void loadDevices()}>
                    Retry
                  </Button>
                </div>
              ) : !devices ? (
                <div className="space-y-3 p-3.5">
                  {[0, 1].map((index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-40" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : devices.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No active sessions.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {devices.map((device) => (
                    <DeviceRow
                      key={device.id}
                      device={device}
                      isBusy={busyDevice !== null}
                      onRename={(d) => {
                        setRenaming(d);
                        setNameDraft(d.name ?? '');
                      }}
                      onRevoke={setRevoking}
                    />
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* ---- History ---- */}
          <TabsContent value="history" className="space-y-3">
            <div className="flex gap-2">
              {(['logins', 'all'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  aria-pressed={scope === value}
                  className={cn(
                    'press min-h-[44px] flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    scope === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {value === 'logins' ? 'Sign-ins' : 'Everything'}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {eventsError ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">{eventsError}</p>
                  <Button variant="outline" className="mt-3 h-11" onClick={() => void loadEvents(0)}>
                    Retry
                  </Button>
                </div>
              ) : !events ? (
                <div className="space-y-3 p-3.5">
                  {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} className="h-10 w-full" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing recorded yet.
                </p>
              ) : (
                <>
                  <ul className="divide-y divide-border">
                    {events.map((event) => {
                      const alarming = ALARMING.includes(event.type);
                      const failed = event.type === 'login_failed';

                      return (
                        <li key={event.id} className="flex items-start gap-3 px-3.5 py-2.5">
                          <span
                            className={cn(
                              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                              failed
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                : alarming
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'bg-muted text-muted-foreground',
                            )}
                            aria-hidden
                          >
                            {failed ? (
                              <X className="h-3.5 w-3.5" />
                            ) : alarming ? (
                              <AlertTriangle className="h-3.5 w-3.5" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{EVENT_LABELS[event.type]}</p>
                            <p className="t-meta">
                              {[event.device, event.ipAddress].filter(Boolean).join(' · ') ||
                                'no device details'}
                            </p>
                          </div>

                          <span className="shrink-0 whitespace-nowrap t-meta">
                            {when(event.createdAt)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {hasMore && (
                    <div className="border-t border-border p-3">
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={isLoadingMore}
                        onClick={() => void loadEvents(events.length)}
                      >
                        {isLoadingMore ? 'Loading…' : 'Load older'}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ---- Rename ---- */}
      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent variant="sheet" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Name this device</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-2">
            <Input
              autoFocus
              value={nameDraft}
              maxLength={60}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder={renaming?.device ?? 'My laptop'}
              aria-label="Device name"
            />
            <p className="t-meta">
              A name helps you tell two identical-looking sessions apart. Leave it empty to
              go back to &ldquo;{renaming?.device}&rdquo;.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveName()} disabled={busyDevice !== null}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Revoke one ---- */}
      <Dialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <DialogContent variant="sheet" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {revoking?.isCurrent ? 'Sign out this device?' : 'Sign out that device?'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {revoking?.isCurrent
                ? 'This is the device you are using now. You will be returned to the sign-in screen.'
                : `${revoking?.name ?? revoking?.device} will be signed out immediately and will need to sign in again. Nothing else about your account changes.`}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRevoke()}
              disabled={busyDevice !== null}
            >
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Revoke all others ---- */}
      <Dialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <DialogContent variant="sheet" className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out every other device?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              {otherCount} other {otherCount === 1 ? 'session' : 'sessions'} will end
              immediately. This device stays signed in. Your password is unchanged, so
              anyone who knows it can sign in again &mdash; change it too if you think it
              is known.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeAllOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRevokeAll()}
              disabled={busyDevice !== null}
            >
              Sign out others
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};
