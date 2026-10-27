import { EXPORT_PX, EXPORT_PX_PER_METRE, PRINT_DIAMETER_MM } from '../config';
import type { FrameOverlay } from './arcText';
import { compose } from './compose';
import type { EditState, Photo } from './types';

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Returns a copy of `png` with a pHYs chunk (pixels per metre, unit = metre)
 * right after IHDR, replacing any existing pHYs chunk.
 */
export function setPngDpi(png: Uint8Array, pxPerMetre: number): Uint8Array {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Uint8Array[] = [png.subarray(0, 8)];
  let off = 8;
  let inserted = false;
  while (off < png.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    const end = off + 12 + len;
    if (type !== 'pHYs') chunks.push(png.subarray(off, end));
    if (type === 'IHDR' && !inserted) {
      chunks.push(physChunk(pxPerMetre));
      inserted = true;
    }
    off = end;
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

function physChunk(ppm: number): Uint8Array {
  const chunk = new Uint8Array(4 + 4 + 9 + 4);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unit: metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  return chunk;
}

/** Renders the final square (EXPORT_PX by default) with a circular alpha mask. */
export function renderExportCanvas(
  photo: Photo,
  edit: EditState,
  frame: HTMLImageElement | null,
  overlay: FrameOverlay | null = null,
  px = EXPORT_PX,
) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  compose(ctx, px, photo, edit, frame, overlay);
  return canvas;
}

/** Final print PNG: EXPORT_PX², transparent corners, ≈600 DPI pHYs metadata. */
export async function exportPng(
  photo: Photo,
  edit: EditState,
  frame: HTMLImageElement | null,
  overlay: FrameOverlay | null = null,
): Promise<Blob> {
  const canvas = renderExportCanvas(photo, edit, frame, overlay);
  const raw = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
  );
  const bytes = setPngDpi(new Uint8Array(await raw.arrayBuffer()), EXPORT_PX_PER_METRE);
  return new Blob([bytes as BlobPart], { type: 'image/png' });
}

export const EXPORT_FILENAME = `homprung-photobooth-${PRINT_DIAMETER_MM}mm.png`;

export function downloadBlob(blob: Blob, filename = EXPORT_FILENAME) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
