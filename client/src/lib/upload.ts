import { env } from './env';

/**
 * Direct-to-Cloudinary image upload.
 *
 * The browser uploads straight to Cloudinary with an UNSIGNED preset, so no API secret
 * ever reaches the client and the image never transits our server. The resulting secure
 * URL and public id are what we persist.
 *
 * Images are compressed client-side first: receipts photographed on a phone are
 * routinely 4-8MB, which is slow on mobile data and pointless for something that will be
 * viewed at a few hundred pixels.
 */

export type UploadResult = { url: string; publicId: string };
export type UploadProgress = (percent: number) => void;

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/** Downscales and re-encodes an image; returns the original if anything goes wrong. */
export const compressImage = async (file: File): Promise<Blob> => {
  if (!file.type.startsWith('image/')) return file;
  // Vector images have no pixels to downscale.
  if (file.type === 'image/svg+xml') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    // Already small enough and not oversized on disk: leave it alone.
    if (scale === 1 && file.size <= 1_500_000) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );

    // Only use the re-encode if it actually helped.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
};

export class UploadError extends Error {}

/**
 * Uploads to Cloudinary with progress.
 *
 * Uses XMLHttpRequest rather than fetch because fetch still cannot report upload
 * progress, and a receipt upload on mobile data needs a real progress bar.
 */
export const uploadImage = async (
  file: File,
  options: { folder?: string; onProgress?: UploadProgress; signal?: AbortSignal } = {},
): Promise<UploadResult> => {
  if (!env.cloudinary.isConfigured) {
    throw new UploadError(
      'Image uploads are not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.',
    );
  }

  if (file.size > env.maxUploadBytes * 4) {
    throw new UploadError('That image is too large. Please choose a smaller file.');
  }

  const compressed = await compressImage(file);

  if (compressed.size > env.maxUploadBytes) {
    throw new UploadError(
      `That image is still ${(compressed.size / 1_048_576).toFixed(1)}MB after compression. Please choose a smaller one.`,
    );
  }

  const body = new FormData();
  body.append('file', compressed);
  body.append('upload_preset', env.cloudinary.uploadPreset);

  /*
   * Advisory, not authoritative.
   *
   * An unsigned preset that pins a folder wins over anything sent here -- which is the
   * safe configuration, because the preset name is public and a client-chosen folder
   * would let anyone holding it write anywhere in the account. This deployment's preset
   * pins `VITE_CLOUDINARY_FOLDER`, so every asset lands there whatever a caller asks
   * for. The parameter is still sent because a deployment whose preset leaves the
   * folder open does honour it.
   */
  body.append('folder', options.folder ?? env.cloudinary.folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`;

  return new Promise<UploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', endpoint);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new UploadError('The image could not be uploaded. Please try again.'));
        return;
      }
      try {
        const parsed = JSON.parse(request.responseText) as {
          secure_url?: string;
          public_id?: string;
        };
        if (!parsed.secure_url || !parsed.public_id) {
          reject(new UploadError('Upload succeeded but returned an unexpected response.'));
          return;
        }
        options.onProgress?.(100);
        resolve({ url: parsed.secure_url, publicId: parsed.public_id });
      } catch {
        reject(new UploadError('Upload succeeded but the response could not be read.'));
      }
    });

    request.addEventListener('error', () =>
      reject(new UploadError('Network error while uploading. Check your connection.')),
    );
    request.addEventListener('abort', () => reject(new UploadError('Upload cancelled.')));

    options.signal?.addEventListener('abort', () => request.abort());

    request.send(body);
  });
};
