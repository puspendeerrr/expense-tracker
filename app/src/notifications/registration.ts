import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import * as secureStore from '@/storage/secureStore';
import { devices as devicesApi } from '@/api/endpoints';

/**
 * Getting a push token, and telling the server about it.
 *
 * WHAT CAN GO WRONG, AND WHY EACH CASE IS NAMED
 *
 * Push on Android is not something an app can arrange by itself. It needs a real FCM
 * credential, which lives in an Expo project, which needs an EAS project id compiled into
 * the build. When any of that is missing, `getExpoPushTokenAsync` throws — and the worst
 * possible response would be a spinner that never resolves, or a vague "something went
 * wrong" that tells nobody what to do about it.
 *
 * So every outcome below is a named state the UI can explain, and `unsupported` in
 * particular carries the actual reason. This is deliberately honest rather than
 * reassuring: an app that claims notifications are on when no token exists is worse than
 * one that says plainly that it cannot get one yet.
 */

export type PushStatus =
  | 'idle'
  | 'requesting'
  /** OS permission granted, token obtained, server told. */
  | 'registered'
  /** The person said no. Do not ask again without them asking us to. */
  | 'denied'
  /** Android cannot deliver push in this build: no FCM credential or project id. */
  | 'unsupported'
  /** Permission and credentials fine, but registration itself failed. Retryable. */
  | 'error';

export type PushState = {
  status: PushStatus;
  /** Present for `unsupported` and `error`. Written for a developer to act on. */
  detail?: string;
  /** Whether the OS would let us ask again, or the user must go to Settings. */
  canAskAgain?: boolean;
};

const INSTALLATION_KEY = 'splitwise.installation-id';

/**
 * A random id for this install, minted once and kept in the keystore.
 *
 * Deliberately NOT a hardware identifier. `Device.osBuildId`, the Android id and the
 * advertising id all survive an uninstall and identify the handset rather than the app,
 * which is both more than the server needs and the kind of thing that should not be sent
 * anywhere. This is a random UUID: it dies with the install, and it exists only so the
 * server can recognise a repeat registration instead of accumulating a row per launch.
 *
 * `Crypto.randomUUID` is a CSPRNG. `Math.random` would not be.
 */
export const getInstallationId = async (): Promise<string> => {
  const existing = await secureStore.getItem(INSTALLATION_KEY);
  if (existing) return existing;

  const fresh = Crypto.randomUUID();
  await secureStore.setItem(INSTALLATION_KEY, fresh);
  return fresh;
};

/**
 * The EAS project id, which Expo's push service uses to attribute the token.
 *
 * Read from both places the Expo docs name, because which one is populated depends on
 * whether the build came from EAS Build or from a local `expo run:android`.
 */
const projectId = (): string | undefined => {
  const config = Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null;
  const easConfig = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig;
  return config?.extra?.eas?.projectId ?? easConfig?.projectId;
};

/** A readable name for this phone, for the Devices screen. */
const deviceLabel = (): string | null => {
  const name = Device.deviceName?.trim();
  if (name) return name.slice(0, 80);
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').trim();
  return model ? model.slice(0, 80) : null;
};

/** Reads the OS permission without asking for it. */
export const getPermissionState = async (): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> => {
  const settings = await Notifications.getPermissionsAsync();
  return { granted: settings.granted, canAskAgain: settings.canAskAgain ?? false };
};

/**
 * Asks for permission, gets a token, registers it.
 *
 * `interactive` false means "only proceed if permission has already been granted" — used
 * on launch, so an app restart never produces a permission dialog nobody asked for. The
 * dialog appears only when somebody taps the button on the Notifications screen.
 */
export const registerForPush = async (
  options: { interactive: boolean } = { interactive: true },
): Promise<PushState> => {
  // An emulator has no push service to register with, and says so clearly rather than
  // failing somewhere further in.
  if (!Device.isDevice) {
    return {
      status: 'unsupported',
      detail: 'Push notifications need a physical device; an emulator cannot receive them.',
    };
  }

  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;

  if (!granted) {
    if (!options.interactive) {
      return { status: 'idle', canAskAgain: current.canAskAgain ?? false };
    }
    if (!current.canAskAgain) {
      // Permanently denied: Android will not show the dialog again, so asking is futile
      // and the only route left is system settings.
      return { status: 'denied', canAskAgain: false };
    }

    const asked = await Notifications.requestPermissionsAsync();
    granted = asked.granted;
    if (!granted) return { status: 'denied', canAskAgain: asked.canAskAgain ?? false };
  }

  const id = projectId();
  if (!id) {
    return {
      status: 'unsupported',
      detail:
        'This build has no EAS project id, so Expo cannot issue a push token. Add extra.eas.projectId to app.config.ts and rebuild. See README, "Push notification architecture".',
    };
  }

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
  } catch (error: unknown) {
    /*
     * Almost always the missing Android FCM credential. The message from Expo is the
     * most useful thing we have, so it is surfaced rather than replaced with our own
     * guess at what went wrong.
     */
    return {
      status: 'unsupported',
      detail:
        (error instanceof Error ? error.message : 'Could not obtain a push token.') +
        ' — on Android this usually means FCM credentials are not configured for this project.',
    };
  }

  try {
    await devicesApi.register({
      installationId: await getInstallationId(),
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      deviceName: deviceLabel(),
      appVersion: Constants.expoConfig?.version ?? null,
    });
  } catch (error: unknown) {
    // The token is real; the server just could not be told. Worth retrying, and the
    // caller offers exactly that.
    return {
      status: 'error',
      detail:
        error instanceof Error
          ? error.message
          : 'The push token could not be registered with SplitMoney.',
    };
  }

  return { status: 'registered' };
};

/**
 * Detaches this install from the account. Called on sign-out.
 *
 * Without it, a phone that somebody else signs into would keep receiving the previous
 * account's notifications until their token happened to rotate.
 */
export const unregisterPush = async (): Promise<void> => {
  try {
    await devicesApi.unregister(await getInstallationId());
  } catch {
    // Signing out must not be blocked by a failed unregister. The server also reassigns
    // the row on the next registration, so the device cannot be left on two accounts.
  }
};
