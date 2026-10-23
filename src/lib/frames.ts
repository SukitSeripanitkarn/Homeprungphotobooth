import { FRAMES_BASE_URL, FRAMES_MANIFEST_URL } from '../config';
import type { FrameDef, LoadedFrame } from './types';

function isFrameDef(v: unknown): v is FrameDef {
  const f = v as FrameDef;
  return !!f && typeof f.id === 'string' && typeof f.name === 'string' && typeof f.file === 'string';
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

function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => img);
}

/** Reads /frames/frames.json and decodes every frame listed in it. */
export async function loadFrames(): Promise<LoadedFrame[]> {
  const res = await fetch(FRAMES_MANIFEST_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`frames.json: HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error('frames.json must be an array');

  const defs = json.filter((d, i) => {
    if (isFrameDef(d)) return true;
    console.warn(`[frames] entry #${i} is missing "id", "name" or "file" and was skipped`, d);
    return false;
  });

  const loaded = await Promise.all(
    defs.map(async (def): Promise<LoadedFrame | null> => {
      const url = FRAMES_BASE_URL + encodeURIComponent(def.file);
      try {
        const image = await loadImage(url);
        checkFrame(def, image);
        return { ...def, url, image };
      } catch {
        console.warn(`[frames] could not load "${def.file}" — skipped`);
        return null;
      }
    }),
  );
  return loaded.filter((f): f is LoadedFrame => f !== null);
}
