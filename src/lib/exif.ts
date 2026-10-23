import { MAX_PHOTO_PX } from '../config';
import type { Photo } from './types';

/**
 * Decodes an image with its EXIF orientation applied.
 *
 * `createImageBitmap(blob, { imageOrientation: 'from-image' })` is used where
 * it is reliable (Chromium/Firefox). Safari's support for that option has been
 * inconsistent, so everywhere else we decode through an <img>: all current
 * browsers apply EXIF orientation to <img> (CSS `image-orientation: from-image`
 * is the default) and `drawImage` honours it.
 */
async function decodeOriented(blob: Blob): Promise<Photo> {
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  if (!isSafari && 'createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bmp, width: bmp.width, height: bmp.height };
    } catch {
      // fall through to <img>
    }
  }
  return decodeWithImg(blob);
}

async function decodeWithImg(blob: Blob): Promise<Photo> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    // The decoded <img> stays drawable after the URL is revoked.
    URL.revokeObjectURL(url);
  }
}

function release(photo: Photo) {
  if (typeof ImageBitmap !== 'undefined' && photo.source instanceof ImageBitmap) photo.source.close();
}

/**
 * Prepares a picked file for editing: applies EXIF orientation, downscales
 * anything larger than MAX_PHOTO_PX, and bakes the result into a plain JPEG
 * (no EXIF) so the stored copy restores identically after a refresh.
 */
export async function preparePhoto(file: Blob): Promise<{ photo: Photo; blob: Blob }> {
  const decoded = await decodeOriented(file);
  const scale = Math.min(1, MAX_PHOTO_PX / Math.max(decoded.width, decoded.height));
  const w = Math.max(1, Math.round(decoded.width * scale));
  const h = Math.max(1, Math.round(decoded.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(decoded.source, 0, 0, w, h);
  release(decoded);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92),
  );
  return { photo: { source: canvas, width: w, height: h }, blob };
}

/** Decodes a photo previously baked by preparePhoto (no orientation handling needed). */
export function loadStoredPhoto(blob: Blob): Promise<Photo> {
  return decodeWithImg(blob);
}
