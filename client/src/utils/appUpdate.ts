import { App as CapacitorApp } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNativePlatform, APP_VERSION, DOWNLOAD_URL } from '../components/common/DownloadAppModal';

export interface UpdateManifest {
  version: string;
  minNativeVersion?: string;
  url?: string;
  downloadUrl?: string;
  releaseNotes?: string;
  channel?: string;
  isMandatory?: boolean;
  updatedAt?: string;
}

export interface AppVersionInfo {
  webVersion: string;
  nativeVersion: string;
  channel: string;
  isNative: boolean;
}

const MANIFEST_URL =
  import.meta.env.VITE_UPDATE_MANIFEST_URL ||
  `${import.meta.env.VITE_API_URL || ''}/api/app/update-manifest`;

/**
 * Signal to CapacitorUpdater that the web bundle has booted cleanly.
 * Crucial for rollback safety: if boot fails or crashes before this,
 * the plugin reverts to the last known good bundle automatically.
 */
export const notifyAppReady = async (): Promise<void> => {
  if (!isNativePlatform()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
    console.log('[LiveUpdate] App ready notified successfully.');
  } catch (err) {
    console.warn('[LiveUpdate] notifyAppReady error:', err);
  }
};

/**
 * Compare two semver strings cleanly (e.g. "1.0.10" vs "1.0.9").
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 * 
 * Examples:
 *  compareVersions("1.0.10", "1.0.9") => 1
 *  compareVersions("1.1.0", "1.0.9")  => 1
 *  compareVersions("2.0.0", "1.9.9")  => 1
 *  compareVersions("2.0.1", "2.0.1")  => 0
 */
export const compareVersions = (v1: string, v2: string): number => {
  if (!v1 || !v2) return 0;

  // Clean version strings (strip 'v' prefix, whitespace, and metadata suffix like '-beta')
  const clean1 = v1.replace(/^v/i, '').split('-')[0].trim();
  const clean2 = v2.replace(/^v/i, '').split('-')[0].trim();

  const parts1 = clean1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map(p => parseInt(p, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
};

/**
 * Get current application version information.
 * Uses `@capacitor/app` (`App.getInfo()`) on native Android runtime
 * to query actual PackageManager version instead of relying on hardcoded strings.
 */
export const getAppVersionInfo = async (): Promise<AppVersionInfo> => {
  const isNative = isNativePlatform();
  let nativeVersion = APP_VERSION;
  let webVersion = APP_VERSION;

  if (isNative) {
    // 1. Get real native package versionName from Android via @capacitor/app
    try {
      const appInfo = await CapacitorApp.getInfo();
      if (appInfo && appInfo.version) {
        nativeVersion = appInfo.version;
      }
    } catch (err) {
      console.warn('[LiveUpdate] CapacitorApp.getInfo() failed, falling back to APP_VERSION:', err);
    }

    // 2. Get active CapacitorUpdater live web bundle version if set
    try {
      const currentBundle = await CapacitorUpdater.current();
      if (currentBundle?.bundle?.version) {
        webVersion = currentBundle.bundle.version;
      } else {
        webVersion = nativeVersion;
      }
    } catch {
      webVersion = nativeVersion;
    }
  }

  return {
    webVersion,
    nativeVersion,
    channel: 'production',
    isNative,
  };
};

export interface UpdateCheckResult {
  hasUpdate: boolean;
  requiresNativeUpdate: boolean;
  manifest?: UpdateManifest;
  currentVersion?: string;
  error?: string;
}

/**
 * Check server for available live updates or native APK releases.
 */
export const checkForLiveUpdate = async (): Promise<UpdateCheckResult> => {
  const currentInfo = await getAppVersionInfo();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s network timeout

    const res = await fetch(MANIFEST_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        hasUpdate: false,
        requiresNativeUpdate: false,
        currentVersion: currentInfo.nativeVersion,
        error: `Manifest server returned status ${res.status} (${res.statusText})`,
      };
    }

    let manifest: UpdateManifest;
    try {
      manifest = await res.json();
    } catch (parseErr) {
      return {
        hasUpdate: false,
        requiresNativeUpdate: false,
        currentVersion: currentInfo.nativeVersion,
        error: 'Invalid manifest format received from update server.',
      };
    }

    if (!manifest || !manifest.version) {
      return {
        hasUpdate: false,
        requiresNativeUpdate: false,
        currentVersion: currentInfo.nativeVersion,
        error: 'Update manifest missing required version field.',
      };
    }

    // Ensure fallback downloadUrl if omitted in manifest
    if (!manifest.downloadUrl) {
      manifest.downloadUrl = DOWNLOAD_URL;
    }

    // 1. Check Native APK Compatibility / Release
    const isMinNativeNewer = Boolean(
      manifest.minNativeVersion && compareVersions(manifest.minNativeVersion, currentInfo.nativeVersion) > 0
    );
    const isManifestVersionNewer = compareVersions(manifest.version, currentInfo.nativeVersion) > 0;

    if (isMinNativeNewer || (currentInfo.isNative && isManifestVersionNewer && manifest.downloadUrl)) {
      console.warn(`[LiveUpdate] Native APK update available: server v${manifest.version}, installed v${currentInfo.nativeVersion}`);
      return {
        hasUpdate: false,
        requiresNativeUpdate: true,
        manifest,
        currentVersion: currentInfo.nativeVersion,
      };
    }

    // 2. Check if Live Web Bundle Version is newer
    if (compareVersions(manifest.version, currentInfo.webVersion) > 0) {
      return {
        hasUpdate: true,
        requiresNativeUpdate: false,
        manifest,
        currentVersion: currentInfo.webVersion,
      };
    }

    return {
      hasUpdate: false,
      requiresNativeUpdate: false,
      manifest,
      currentVersion: currentInfo.nativeVersion,
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    const errorMsg = isTimeout
      ? 'Network request timed out. Please check your internet connection.'
      : (err?.message || 'Network error occurred while checking for updates');

    console.warn('[LiveUpdate] Check error:', errorMsg);
    return {
      hasUpdate: false,
      requiresNativeUpdate: false,
      currentVersion: currentInfo.nativeVersion,
      error: errorMsg,
    };
  }
};

/**
 * Download, validate integrity, and set new web bundle atomically
 */
export const applyLiveUpdate = async (manifest: UpdateManifest): Promise<boolean> => {
  if (!isNativePlatform() || !manifest.url) return false;

  try {
    console.log(`[LiveUpdate] Downloading web bundle update v${manifest.version} from ${manifest.url}...`);

    const downloadResult = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });

    if (!downloadResult || !downloadResult.version) {
      throw new Error('Download failed or returned empty bundle version.');
    }

    console.log(`[LiveUpdate] Applying bundle v${downloadResult.version}...`);
    await CapacitorUpdater.set({ id: downloadResult.version });
    return true;
  } catch (err: any) {
    console.error('[LiveUpdate] Apply error:', err);
    return false;
  }
};
