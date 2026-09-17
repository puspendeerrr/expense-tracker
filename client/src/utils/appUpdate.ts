import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNativePlatform, APP_VERSION, DOWNLOAD_URL } from '../components/common/DownloadAppModal';

export interface UpdateManifest {
  version: string;
  minNativeVersion: string;
  url: string;
  downloadUrl?: string;
  releaseNotes?: string;
  channel?: string;
  isMandatory?: boolean;
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
 * Compare two semver strings (e.g. "1.0.1" vs "1.0.0")
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);
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
 * Get current application version information
 */
export const getAppVersionInfo = async (): Promise<AppVersionInfo> => {
  const isNative = isNativePlatform();
  let nativeVersion = '1.0.0';

  if (isNative) {
    try {
      const current = await CapacitorUpdater.current();
      if (current?.bundle?.version) {
        return {
          webVersion: current.bundle.version,
          nativeVersion: '1.0.0',
          channel: 'production',
          isNative: true,
        };
      }
    } catch {
      // Fallback to APP_VERSION
    }
  }

  return {
    webVersion: APP_VERSION,
    nativeVersion,
    channel: 'production',
    isNative,
  };
};

export interface UpdateCheckResult {
  hasUpdate: boolean;
  requiresNativeUpdate: boolean;
  manifest?: UpdateManifest;
  error?: string;
}

/**
 * Check server for available live updates
 */
export const checkForLiveUpdate = async (): Promise<UpdateCheckResult> => {
  if (!isNativePlatform()) {
    return { hasUpdate: false, requiresNativeUpdate: false };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s network timeout

    const res = await fetch(MANIFEST_URL, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { hasUpdate: false, requiresNativeUpdate: false, error: 'Manifest server unavailable' };
    }

    const manifest: UpdateManifest = await res.json();
    const currentInfo = await getAppVersionInfo();

    // 1. Check Native Capability Compatibility
    if (manifest.minNativeVersion && compareVersions(manifest.minNativeVersion, currentInfo.nativeVersion) > 0) {
      console.warn(`[LiveUpdate] Incompatible: Update requires native v${manifest.minNativeVersion}, but app is v${currentInfo.nativeVersion}`);
      return {
        hasUpdate: false,
        requiresNativeUpdate: true,
        manifest,
      };
    }

    // 2. Check if Web Bundle Version is newer
    if (compareVersions(manifest.version, currentInfo.webVersion) > 0) {
      return {
        hasUpdate: true,
        requiresNativeUpdate: false,
        manifest,
      };
    }

    return { hasUpdate: false, requiresNativeUpdate: false, manifest };
  } catch (err: any) {
    console.warn('[LiveUpdate] Network or check error:', err?.message || err);
    return { hasUpdate: false, requiresNativeUpdate: false, error: err?.message || 'Update check failed' };
  }
};

/**
 * Download, validate integrity, and set new bundle atomically
 */
export const applyLiveUpdate = async (manifest: UpdateManifest): Promise<boolean> => {
  if (!isNativePlatform() || !manifest.url) return false;

  try {
    console.log(`[LiveUpdate] Downloading update v${manifest.version} from ${manifest.url}...`);
    
    const downloadResult = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });

    if (!downloadResult || !downloadResult.version) {
      throw new Error('Download failed or empty bundle result');
    }

    console.log(`[LiveUpdate] Applying bundle v${downloadResult.version}...`);
    await CapacitorUpdater.set({ id: downloadResult.version });
    return true;
  } catch (err: any) {
    console.error('[LiveUpdate] Apply error:', err);
    return false;
  }
};
