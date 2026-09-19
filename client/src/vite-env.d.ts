/// <reference types="vite/client" />

/**
 * Typed frontend environment.
 *
 * Declaring the keys here means a typo in `import.meta.env.VITE_...` is a compile
 * error rather than a silent `undefined` at runtime. Only public values appear.
 */
interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SOCKET_URL?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  readonly VITE_CLOUDINARY_FOLDER?: string;
  readonly VITE_MAX_UPLOAD_BYTES?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
