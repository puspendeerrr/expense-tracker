const rawUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const environment = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';

function readApiUrl(): { url: string | null; status: string } {
  if (!rawUrl) return { url: null, status: 'Not configured' };
  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid base URL');
    if (environment === 'production' && url.protocol !== 'https:') return { url: null, status: 'Production requires HTTPS' };
    return { url: rawUrl.replace(/\/+$/, ''), status: 'Configured · connection not tested' };
  } catch { return { url: null, status: 'Invalid API base URL' }; }
}

/**
 * Cloudinary, for receipt and payment-proof images.
 *
 * Only the cloud name, an UNSIGNED upload preset and a folder appear here, which is the
 * same arrangement the web client uses. An unsigned preset is designed to be public: it
 * is what lets a client upload directly without a server round trip, and it carries no
 * ability to read, overwrite or delete anything.
 *
 * The API key and secret are not here and must never be. Everything under EXPO_PUBLIC_
 * is compiled into the bundle and readable by anyone holding the APK.
 */
function readCloudinary(): {
  cloudName: string | null;
  uploadPreset: string | null;
  folder: string;
  isConfigured: boolean;
} {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || null;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET?.trim() || null;
  const folder = process.env.EXPO_PUBLIC_CLOUDINARY_FOLDER?.trim() || 'splitwise';
  return { cloudName, uploadPreset, folder, isConfigured: Boolean(cloudName && uploadPreset) };
}

export const runtime = {
  environment,
  api: readApiUrl(),
  cloudinary: readCloudinary(),
};
