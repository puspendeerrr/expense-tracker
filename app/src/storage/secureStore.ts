import * as SecureStore from 'expo-secure-store';

/**
 * The app's only persistence.
 *
 * On Android this is encrypted SharedPreferences held under a Keystore key, so a value
 * written here survives a restart without ever sitting on disk as readable text. That is
 * the reason the session token lives here rather than in AsyncStorage.
 *
 * Every call is wrapped. A device with an unusable keystore -- it happens, most often
 * after restoring the app from a device backup -- must degrade to "you have to sign in
 * again", never to a crash on launch. `memory` keeps the current run working in that
 * case, and `durable` lets callers tell the user why they will be asked again tomorrow.
 */

const memory = new Map<string, string>();
let durable = true;

/** False once any keystore call has failed; values then last only for this process. */
export const isDurable = (): boolean => durable;

const degrade = (operation: string, error: unknown): void => {
  if (durable) {
    durable = false;
    // The key is named, never the value: these are secrets.
    console.warn(`secureStore.${operation} failed; falling back to memory`, error);
  }
};

export const getItem = async (key: string): Promise<string | null> => {
  try {
    const value = await SecureStore.getItemAsync(key);
    return value ?? memory.get(key) ?? null;
  } catch (error: unknown) {
    degrade('get', error);
    return memory.get(key) ?? null;
  }
};

export const setItem = async (key: string, value: string): Promise<void> => {
  memory.set(key, value);
  try {
    await SecureStore.setItemAsync(key, value, {
      // Readable only while the device is unlocked, and never copied into a backup that
      // could be restored onto a different phone.
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch (error: unknown) {
    degrade('set', error);
  }
};

export const removeItem = async (key: string): Promise<void> => {
  memory.delete(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error: unknown) {
    degrade('remove', error);
  }
};
