import { ZOOM_MAX, ZOOM_MIN } from '../config';
import type { EditState, Photo } from './types';

/** Size of the photo in circle-diameter units at the given zoom/rotation. */
function displayedSize(photo: Photo, edit: EditState) {
  const k = edit.zoom / Math.min(photo.width, photo.height);
  const w = photo.width * k;
  const h = photo.height * k;
  return edit.rotation % 2 ? { w: h, h: w } : { w, h };
}

/** Keeps zoom in range and the photo covering the whole circle. */
export function clampEdit(edit: EditState, photo: Photo): EditState {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, edit.zoom));
  const { w, h } = displayedSize(photo, { ...edit, zoom });
  const maxX = Math.max(0, (w - 1) / 2);
  const maxY = Math.max(0, (h - 1) / 2);
  return {
    ...edit,
    zoom,
    x: Math.min(maxX, Math.max(-maxX, edit.x)),
    y: Math.min(maxY, Math.max(-maxY, edit.y)),
  };
}

/**
 * Zooms by `factor` keeping the point `(px, py)` (diameter units, relative to
 * the circle centre) fixed under the finger/cursor.
 */
export function zoomAbout(edit: EditState, factor: number, px: number, py: number, photo: Photo): EditState {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, edit.zoom * factor));
  const f = zoom / edit.zoom;
  return clampEdit({ ...edit, zoom, x: px + (edit.x - px) * f, y: py + (edit.y - py) * f }, photo);
}

/**
 * Draws photo + frame clipped to a circle filling a `size`×`size` canvas.
 * Corners outside the circle stay fully transparent.
 */
export function compose(
  ctx: CanvasRenderingContext2D,
  size: number,
  photo: Photo,
  edit: EditState,
  frame: HTMLImageElement | null,
) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.translate(size / 2 + edit.x * size, size / 2 + edit.y * size);
  ctx.rotate((edit.rotation * Math.PI) / 2);
  const k = (size * edit.zoom) / Math.min(photo.width, photo.height);
  const w = photo.width * k;
  const h = photo.height * k;
  ctx.drawImage(photo.source, -w / 2, -h / 2, w, h);
  ctx.restore();

  if (frame) {
    // Center-crop non-square frames to a square.
    const fw = frame.naturalWidth;
    const fh = frame.naturalHeight;
    const s = Math.min(fw, fh);
    ctx.drawImage(frame, (fw - s) / 2, (fh - s) / 2, s, s, 0, 0, size, size);
  }
  ctx.restore();
}
