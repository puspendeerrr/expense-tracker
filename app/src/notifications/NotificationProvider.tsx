import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { notifications as notificationsApi } from '@/api/endpoints';
import { registerChannels } from './channels';
import {
  getPermissionState,
  registerForPush,
  unregisterPush,
  type PushState,
} from './registration';
import { routeForNotification, routeForUrl } from './routing';

/**
 * Notifications, and everything that happens when one is tapped.
 *
 * FOREGROUND BEHAVIOUR
 * A notification that arrives while you are looking at the app does NOT raise a system
 * banner. You are already here; a banner covering the thing you are reading, about the
 * thing you are reading, is noise. What it does instead is bump the unread count, which
 * the bell already shows — and Socket.IO has usually re-rendered the screen with the new
 * data before the push even lands. This is the §15 duplicate-suppression rule: realtime
 * updates the screen, push exists for when the screen is not there.
 *
 * COLD START
 * The hard case. The app is dead, a notification is tapped, and Android launches us with
 * that response waiting. We must not navigate until the session is restored — routing to
 * a group screen before `AuthProvider` has decided anything would flash the sign-in screen
 * or, worse, mount a screen that immediately 401s. So the destination is HELD and
 * released only once auth has settled. The boot overlay covers the app throughout, so
 * nothing wrong is ever shown in between.
 *
 * If the person is signed out, the destination keeps waiting. They sign in, and the app
 * takes them where the notification was pointing, which is what they were trying to do.
 */

/**
 * Foreground presentation. Set at module scope, as Expo requires, so it is in place
 * before any notification can arrive.
 *
 * `shouldShowBanner` / `shouldShowList` are the current API; `shouldShowAlert` is
 * deprecated.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

type NotificationContextValue = {
  push: PushState;
  permission: { granted: boolean; canAskAgain: boolean };
  unreadCount: number;
  /** Asks for permission and registers. Only ever called from a button. */
  enablePush: () => Promise<PushState>;
  refreshUnread: () => Promise<void>;
  /** Called by the notification list after marking things read. */
  setUnreadCount: (count: number) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const { status, signOutHook } = useAuthBridge();
  const router = useRouter();

  const [push, setPush] = useState<PushState>({ status: 'idle' });
  const [permission, setPermission] = useState({ granted: false, canAskAgain: true });
  const [unreadCount, setUnreadCount] = useState(0);

  /** A destination waiting for the session to be ready. */
  const pending = useRef<string | null>(null);
  /** Things already acted on, so a re-render or a re-delivery cannot navigate twice. */
  const handled = useRef(new Set<string>());

  /* ---- Channels exist before anything can be delivered to them ---- */

  useEffect(() => {
    void registerChannels();
  }, []);

  /* ---- Permission state, kept current when returning from system settings ---- */

  const readPermission = useCallback(async () => {
    setPermission(await getPermissionState());
  }, []);

  useEffect(() => {
    void readPermission();
    const subscription = AppState.addEventListener('change', (next) => {
      // Someone may have changed the permission in Settings and come back.
      if (next === 'active') void readPermission();
    });
    return () => subscription.remove();
  }, [readPermission]);

  /* ---- Registration ---- */

  useEffect(() => {
    if (status !== 'authenticated') return;
    // Non-interactive: never raises a dialog on launch. It only completes a registration
    // for somebody who has already said yes.
    void registerForPush({ interactive: false }).then(setPush);
  }, [status]);

  const enablePush = useCallback(async (): Promise<PushState> => {
    setPush({ status: 'requesting' });
    const result = await registerForPush({ interactive: true });
    setPush(result);
    await readPermission();
    return result;
  }, [readPermission]);

  /* ---- Unread count ---- */

  const refreshUnread = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const { unreadCount: count } = await notificationsApi.unreadCount();
      setUnreadCount(count);
      // Keeps the launcher badge honest without a second source of truth.
      if (Platform.OS === 'android') await Notifications.setBadgeCountAsync(count);
    } catch {
      // A badge is not worth surfacing an error for.
    }
  }, [status]);

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  /* ---- Navigation, held until the session is ready ---- */

  const release = useCallback(() => {
    const target = pending.current;
    if (!target || status !== 'authenticated') return;
    pending.current = null;
    router.push(target as never);
  }, [router, status]);

  useEffect(() => {
    release();
  }, [release, status]);

  const queue = useCallback(
    (target: string | null, key: string) => {
      if (!target) return;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      pending.current = target;
      release();
    },
    [release],
  );

  /* ---- Taps: cold start, background, and foreground ---- */

  useEffect(() => {
    let cancelled = false;

    // The response that launched the app, if a notification did. Available exactly once
    // per launch, which is why it is read here rather than polled.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (cancelled || !response) return;
      const data = response.notification.request.content.data;
      queue(routeForNotification(data), 'notification:' + response.notification.request.identifier);
    });

    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      queue(routeForNotification(data), 'notification:' + response.notification.request.identifier);
    });

    // A notification arriving while the app is open is not a navigation, only a count.
    const received = Notifications.addNotificationReceivedListener(() => {
      void refreshUnread();
    });

    return () => {
      cancelled = true;
      tapped.remove();
      received.remove();
    };
  }, [queue, refreshUnread]);

  /* ---- URL deep links, cold start and while running ---- */

  useEffect(() => {
    let cancelled = false;

    void Linking.getInitialURL().then((url) => {
      if (cancelled || !url) return;
      queue(routeForUrl(url), 'url:' + url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      queue(routeForUrl(url), 'url:' + url + ':' + Date.now());
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [queue]);

  /* ---- Sign-out detaches this install ---- */

  useEffect(() => {
    if (status === 'anonymous' && signOutHook.current) {
      signOutHook.current = false;
      void unregisterPush();
      setPush({ status: 'idle' });
      setUnreadCount(0);
      void Notifications.setBadgeCountAsync(0);
    }
  }, [status, signOutHook]);

  const value = useMemo<NotificationContextValue>(
    () => ({ push, permission, unreadCount, enablePush, refreshUnread, setUnreadCount }),
    [push, permission, unreadCount, enablePush, refreshUnread],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/**
 * Tracks the transition into signed-out, so the device can be unregistered exactly once.
 *
 * A plain `status === 'anonymous'` check would also fire on first launch for somebody who
 * has never signed in, calling unregister with no session behind it.
 */
function useAuthBridge() {
  const { status } = useAuth();
  const wasAuthenticated = useRef(false);
  const signOutHook = useRef(false);

  if (status === 'authenticated') wasAuthenticated.current = true;
  if (status === 'anonymous' && wasAuthenticated.current) {
    wasAuthenticated.current = false;
    signOutHook.current = true;
  }

  return { status, signOutHook };
}

export function useNotifications(): NotificationContextValue {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications requires NotificationProvider');
  return value;
}
