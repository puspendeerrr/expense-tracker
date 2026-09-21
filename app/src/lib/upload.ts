import { runtime } from '@/constants/environment';

/**
 * Direct-to-Cloudinary image upload, mirroring what the web client does.
 *
 * The phone uploads straight to Cloudinary with an UNSIGNED preset, so no API secret is
 * involved and the image never passes through our server. What comes back is a URL, and
 * that URL is the only thing sent to the backend.
 *
 * The preset is configured server-side at Cloudinary with its own folder, allowed formats
 * and size ceiling. A preset-pinned folder overrides whatever `folder` we send, which is
 * the point: the client cannot choose where these land.
 */

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
  }
}

export type UploadResult = { url: string; publicId: string };

/** What `expo-image-picker` hands back for one chosen image. */
export type PickedImage = { uri: string; mimeType?: string | null; fileName?: string | null };

const extensionOf = (uri: string): string => {
  const match = uri.split('?')[0]?.match(/\.(\w+)$/);
  return match?.[1]?.toLowerCase() ?? 'jpg';
};

/**
 * Uploads one picked image and resolves to its Cloudinary URL.
 *
 * XMLHttpRequest rather than `fetch`, because fetch still cannot report upload progress
 * and a receipt going up over mobile data needs a real progress bar rather than an
 * indeterminate spinner.
 */
export const uploadImage = (
  image: PickedImage,
  options: { folder?: string; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadResult> =>
  new Promise((resolve, reject) => {
    const { cloudName, uploadPreset, folder, isConfigured } = runtime.cloudinary;

    if (!isConfigured || !cloudName || !uploadPreset) {
      reject(
        new UploadError(
          'Image uploads are not configured in this build. Set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET.',
        ),
      );
      return;
    }

    const extension = extensionOf(image.uri);
    const body = new FormData();

    /*
     * React Native's FormData takes a file as this {uri, name, type} shape rather than a
     * Blob. The cast is required because the DOM typings describe the browser's FormData,
     * which has no such notion.
     */
    body.append('file', {
      uri: image.uri,
      name: image.fileName ?? 'receipt.' + extension,
      type: image.mimeType ?? 'image/' + (extension === 'jpg' ? 'jpeg' : extension),
    } as unknown as Blob);

    body.append('upload_preset', uploadPreset);
    body.append('folder', options.folder ?? folder);

    const request = new XMLHttpRequest();
    request.open('POST', 'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload');

    // Cloudinary is slow on a poor connection and there is a real file in flight, so this
    // is much longer than an ordinary API call would get.
    request.timeout = 60_000;

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.(event.loaded / event.total);
      }
    });

    request.addEventListener('load', () => {
      if (request.status < 200 || request.status >= 300) {
        // Cloudinary explains refusals in its own body -- wrong preset, file too large,
        // format not allowed -- and that wording is far more useful than a status code.
        let detail: string;
        try {
          detail = (JSON.parse(request.responseText) as { error?: { message?: string } }).error?.message ?? '';
        } catch {
          detail = '';
        }
        reject(new UploadError(detail || 'The image could not be uploaded. Please try again.'));
        return;
      }

      try {
        const payload = JSON.parse(request.responseText) as { secure_url?: string; public_id?: string };
        if (!payload.secure_url) throw new Error('no url');
        resolve({ url: payload.secure_url, publicId: payload.public_id ?? '' });
      } catch {
        reject(new UploadError('The upload finished but the response could not be read.'));
      }
    });

    request.addEventListener('error', () =>
      reject(new UploadError('Network error while uploading. Check your connection.')),
    );
    request.addEventListener('timeout', () =>
      reject(new UploadError('The upload timed out. Try again on a better connection.')),
    );
    request.addEventListener('abort', () => reject(new UploadError('Upload cancelled.')));

    options.signal?.addEventListener('abort', () => request.abort());

    request.send(body);
  });
