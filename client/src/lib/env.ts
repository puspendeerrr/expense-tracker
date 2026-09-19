/**
 * Typed, validated frontend configuration.
 *
 * Reading `import.meta.env` directly all over the app makes missing values fail at the
 * point of use, usually as a confusing runtime error. Parsing once here means a missing
 * or malformed value is visible immediately and every consumer gets a typed default.
 *
 * Everything in this file is PUBLIC -- Vite inlines `VITE_*` into the bundle. No secret
 * may ever be read here.
 */

const raw = import.meta.env;

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const int = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  appName: str(raw.VITE_APP_NAME, 'SplitWise'),

  /** Blank means same-origin, which is what the dev proxy provides. */
  apiBaseUrl: str(raw.VITE_API_BASE_URL).replace(/\/+$/, ''),
  /** Blank falls back to the API origin, then to same-origin. See `socketTarget`. */
  socketUrl: str(raw.VITE_SOCKET_URL).replace(/\/+$/, ''),

  cloudinary: {
    cloudName: str(raw.VITE_CLOUDINARY_CLOUD_NAME),
    uploadPreset: str(raw.VITE_CLOUDINARY_UPLOAD_PRESET),
    folder: str(raw.VITE_CLOUDINARY_FOLDER, 'splitwise'),
    /** Uploads are only offered when both values are present. */
    get isConfigured(): boolean {
      return Boolean(this.cloudName && this.uploadPreset);
    },
  },

  maxUploadBytes: int(raw.VITE_MAX_UPLOAD_BYTES, 5 * 1024 * 1024),

  vapidPublicKey: str(raw.VITE_VAPID_PUBLIC_KEY),
  get pushEnabled(): boolean {
    return Boolean(this.vapidPublicKey);
  },

  isDev: Boolean(raw.DEV),
} as const;

/**
 * Where the realtime server lives.
 *
 * Socket.IO defaults to the page's own origin when given no URL, which is right in
 * development (the Vite proxy forwards /socket.io) and wrong in a split deployment,
 * where it points the WebSocket at the static host and gets a 404.
 *
 * Falls back to the API origin because the realtime server is mounted on the same HTTP
 * server as the API -- so a deployment that sets VITE_API_BASE_URL is already telling
 * us where the socket is, and VITE_SOCKET_URL only needs setting when the two differ.
 *
 * Returns undefined for same-origin, which is what `io()` expects.
 */
export const socketTarget = (): string | undefined =>
  env.socketUrl || env.apiBaseUrl || undefined;

/** Builds an absolute API URL, or a relative one when same-origin. */
export const apiUrl = (path: string): string => {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return env.apiBaseUrl ? `${env.apiBaseUrl}${normalized}` : normalized;
};
