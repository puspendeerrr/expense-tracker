import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiRequest } from '@/lib/api';
import { env } from '@/lib/env';

/**
 * Web push subscription management.
 *
 * A push subscription belongs to a browser, not to an account, so this is a per-device
 * toggle. The state reported here is the browser's actual subscription, not a stored
 * preference -- otherwise the UI would claim push was on after the user revoked
 * permission in browser settings.
 */

/**
 * VAPID keys travel as base64url; the Push API wants raw bytes.
 *
 * Backed by an explicit ArrayBuffer because `applicationServerKey` requires a
 * BufferSource over ArrayBuffer specifically, not the SharedArrayBuffer-compatible
 * Uint8Array that `new Uint8Array(length)` widens to.
 */
const urlBase64ToBytes = (base64: string): ArrayBuffer => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalized);

  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
};

export interface PushState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unsupported';
  isBusy: boolean;
  toggle: () => Promise<void>;
}

const isSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const usePushNotifications = (): PushState => {
  const supported = isSupported();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    supported ? Notification.permission : 'unsupported',
  );
  const [isBusy, setIsBusy] = useState(false);

  // Read the browser's real subscription state on mount.
  useEffect(() => {
    if (!supported || !env.pushEnabled) return;
    let cancelled = false;

    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setIsSubscribed(Boolean(subscription));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [supported]);

  const subscribe = useCallback(async () => {
    const result = await Notification.requestPermission();
    setPermission(result);

    if (result !== 'granted') {
      toast.error('Notifications were not allowed', {
        description:
          result === 'denied'
            ? 'You can re-enable them in your browser site settings.'
            : 'Permission was dismissed.',
      });
      return;
    }

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      // Required by Chrome: every message must be user-visible.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(env.vapidPublicKey),
    });

    const json = subscription.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    await apiRequest('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      }),
    });

    setIsSubscribed(true);
    toast.success('Push notifications enabled on this device');
  }, []);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      setIsSubscribed(false);
      return;
    }

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    // Tell the server too, so it stops sending to a dead endpoint.
    await apiRequest('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }).catch(() => undefined);

    setIsSubscribed(false);
    toast.success('Push notifications turned off for this device');
  }, []);

  const toggle = useCallback(async () => {
    if (!supported || !env.pushEnabled || isBusy) return;
    setIsBusy(true);
    try {
      if (isSubscribed) await unsubscribe();
      else await subscribe();
    } catch (error: unknown) {
      toast.error('Could not change your notification setting', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsBusy(false);
    }
  }, [supported, isBusy, isSubscribed, subscribe, unsubscribe]);

  return { isSupported: supported, isSubscribed, permission, isBusy, toggle };
};
