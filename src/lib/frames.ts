import { FRAMES_BASE_URL, FRAMES_MANIFEST_URL } from '../config';
import type { FrameDef, FrameEntry } from './types';

function isFrameDef(v: unknown): v is FrameDef {
  const f = v as FrameDef;
  return (
    !!f &&
    typeof f.id === 'string' &&
    typeof f.name === 'string' &&
    typeof f.file === 'string' &&
    (f.thumb === undefined || typeof f.thumb === 'string')
  );
}

/** Warns (dev console) about frames that aren't square or don't look circular. */
function checkFrame(def: FrameDef, img: HTMLImageElement) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w !== h) {
    console.warn(`[frames] "${def.file}" is ${w}×${h}, not square — it will be center-cropped to a square.`);
  }
  try {
    const n = 64;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const s = Math.min(w, h);
    ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, n, n);
    const corners = [
      [1, 1],
      [n - 2, 1],
      [1, n - 2],
      [n - 2, n - 2],
    ];
    const opaque = corners.some(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] > 16);
    if (opaque) {
      console.warn(
        `[frames] "${def.file}" has non-transparent corners — it may not be designed for a circular crop. Corners will be clipped.`,
      );
    }
  } catch {
    /* ignore */
  }
}

/** Reads /frames/frames.json. Frame images themselves are loaded on demand. */
export async function loadFrameManifest(): Promise<FrameEntry[]> {
  const res = await fetch(FRAMES_MANIFEST_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`frames.json: HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error('frames.json must be an array');

  return json
    .filter((d, i) => {
      if (isFrameDef(d)) return true;
      console.warn(`[frames] entry #${i} is missing "id", "name" or "file" and was skipped`, d);
      return false;
    })
    .map((def: FrameDef) => ({
      ...def,
      url: FRAMES_BASE_URL + encodeURI(def.file),
      thumbUrl: FRAMES_BASE_URL + encodeURI(def.thumb ?? def.file),
    }));
}

const cache = new Map<string, Promise<HTMLImageElement>>();

/** Decodes (once) the full-size image of a frame. */
export function loadFrameImage(frame: FrameEntry): Promise<HTMLImageElement> {
  let p = cache.get(frame.url);
  if (!p) {
    const img = new Image();
    img.decoding = 'async';
    img.src = frame.url;
    p = img.decode().then(() => {
      checkFrame(frame, img);
      return img;
    });
    p.catch(() => {
      cache.delete(frame.url);
      console.warn(`[frames] could not load "${frame.file}"`);
    });
    cache.set(frame.url, p);
  }
  return p;
}
