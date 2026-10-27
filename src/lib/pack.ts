/**
 * Circle sticker sheet packing.
 *
 * Every sheet is filled greedily: circles are placed left to right in rows,
 * and each circle drops to the highest spot where it doesn't overlap anything
 * already placed (keeping `gap` between circles and `margin` from the edge).
 * New rows either start flush left or offset by half a circle, whichever lets
 * the first circle sit higher, so equal circles nest in a honeycomb.
 *
 * Stickers smaller than ones already on the sheet don't follow the rows:
 * each one searches the whole sheet for the highest free spot, so they drop
 * into the gaps the bigger circles leave (row ends, honeycomb edges).
 *
 * Each sheet is tried four ways (honeycomb or straight rows, running across
 * or down the page) and the variant that covers the most area wins. Kinds are
 * placed largest first so smaller stickers can fill the gaps that remain.
 * Sheets are added until every sticker is placed.
 */

export interface PaperSize {
  id: string;
  widthMm: number;
  heightMm: number;
}

export const PAPERS = {
  A4: { id: 'A4', widthMm: 210, heightMm: 297 },
  A3: { id: 'A3', widthMm: 297, heightMm: 420 },
} as const satisfies Record<string, PaperSize>;
export type PaperId = keyof typeof PAPERS;

export interface PackKind {
  /** Identifies the sticker design. */
  key: string;
  diameterMm: number;
  count: number;
}

export interface Placement {
  key: string;
  /** Centre of the circle, in mm from the top-left of the page. */
  x: number;
  y: number;
  diameterMm: number;
}

export interface PackOptions {
  paper: PaperSize;
  /** Blank border the printer can't reach. */
  marginMm: number;
  /** Space between neighbouring circles, for cutting. */
  gapMm: number;
}

export interface PackResult {
  sheets: Placement[][];
  /** Kinds too big to fit on the paper at all (never placed). */
  tooBig: string[];
}

type Mode = 'hex' | 'square';

interface Circle {
  x: number;
  y: number;
  r: number;
}

const EPS = 1e-6;

/**
 * Highest y (smallest value) at which a circle of radius `r` centred at `x`
 * clears every placed circle, or null if it would cross the bottom margin.
 */
function lowestFreeY(x: number, r: number, placed: Circle[], top: number, bottom: number, gap: number): number | null {
  const blocked: [number, number][] = [];
  for (const c of placed) {
    const reach = c.r + r + gap;
    const dx = Math.abs(c.x - x);
    if (dx >= reach - EPS) continue;
    const dy = Math.sqrt(reach * reach - dx * dx);
    blocked.push([c.y - dy, c.y + dy]);
  }
  blocked.sort((a, b) => a[0] - b[0]);
  let y = top + r;
  // Slide down past every interval that contains y (intervals are sorted by start).
  let moved = true;
  while (moved) {
    moved = false;
    for (const [from, to] of blocked) {
      if (y > from + EPS && y < to - EPS) {
        y = to;
        moved = true;
      }
    }
  }
  return y + r <= bottom + EPS ? y : null;
}

/**
 * Highest free spot anywhere on the sheet (ties: leftmost). Candidates are a
 * 1 mm grid plus every x where the circle would touch a placed one side-on.
 */
function bestFreeSpot(
  r: number,
  placed: Circle[],
  left: number,
  right: number,
  top: number,
  bottom: number,
  gap: number,
): { x: number; y: number } | null {
  const xs = new Set<number>();
  for (let x = left + r; x <= right - r + EPS; x += 1) xs.add(x);
  xs.add(right - r);
  for (const c of placed) {
    xs.add(c.x - c.r - gap - r);
    xs.add(c.x + c.r + gap + r);
  }
  let best: { x: number; y: number } | null = null;
  for (const x of xs) {
    if (x < left + r - EPS || x > right - r + EPS) continue;
    const y = lowestFreeY(x, r, placed, top, bottom, gap);
    if (y !== null && (!best || y < best.y - EPS || (Math.abs(y - best.y) <= EPS && x < best.x))) best = { x, y };
  }
  return best;
}

/** Fills one page of size w×h; consumes from `queue` (mutated). */
function fillSheet(
  w: number,
  h: number,
  queue: { key: string; d: number; left: number }[],
  mode: Mode,
  margin: number,
  gap: number,
): Placement[] {
  const placed: Circle[] = [];
  const out: Placement[] = [];
  const left = margin;
  const right = w - margin;
  const top = margin;
  const bottom = h - margin;

  // Cursor: x of the next circle's left edge in the current row (null = start a new row).
  let cursor: number | null = null;
  let largest = 0;

  for (const kind of queue) {
    const r = kind.d / 2;
    if (kind.d < largest - EPS) {
      // Smaller than what is already on the sheet: fill gaps wherever they are.
      while (kind.left > 0) {
        const spot = bestFreeSpot(r, placed, left, right, top, bottom, gap);
        if (!spot) break;
        placed.push({ x: spot.x, y: spot.y, r });
        out.push({ key: kind.key, x: spot.x, y: spot.y, diameterMm: kind.d });
        kind.left--;
      }
      continue;
    }
    largest = Math.max(largest, kind.d);
    while (kind.left > 0) {
      let x: number;
      let y: number | null;
      if (cursor !== null && cursor + kind.d <= right + EPS) {
        x = cursor + r;
        y = lowestFreeY(x, r, placed, top, bottom, gap);
      } else {
        y = null;
        x = 0;
      }
      if (y === null) {
        // Start a new row: flush left, or (honeycomb) offset by half a pitch.
        const starts = mode === 'hex' ? [left + r, left + r + (kind.d + gap) / 2] : [left + r];
        let best: { x: number; y: number } | null = null;
        for (const sx of starts) {
          if (sx + r > right + EPS) continue;
          const sy = lowestFreeY(sx, r, placed, top, bottom, gap);
          if (sy !== null && (!best || sy < best.y - EPS)) best = { x: sx, y: sy };
        }
        if (!best) break; // this size no longer fits on the sheet; try smaller kinds
        x = best.x;
        y = best.y;
      }
      placed.push({ x, y, r });
      out.push({ key: kind.key, x, y, diameterMm: kind.d });
      kind.left--;
      cursor = x + r + gap;
    }
  }
  return out;
}

export function packStickers(kinds: PackKind[], opts: PackOptions): PackResult {
  const { paper, marginMm: margin, gapMm: gap } = opts;
  const usableW = paper.widthMm - 2 * margin;
  const usableH = paper.heightMm - 2 * margin;
  const tooBig: string[] = [];

  // Largest first; equal sizes keep their input order (so a class stays together).
  let remaining = kinds
    .filter((k) => k.count > 0)
    .filter((k) => {
      const fits = k.diameterMm <= Math.min(usableW, usableH) + EPS;
      if (!fits) tooBig.push(k.key);
      return fits;
    })
    .map((k, i) => ({ key: k.key, d: k.diameterMm, left: Math.floor(k.count), i }))
    .sort((a, b) => b.d - a.d || a.i - b.i);

  const sheets: Placement[][] = [];
  while (remaining.some((k) => k.left > 0)) {
    let best: { placements: Placement[]; area: number; extent: number } | null = null;
    for (const mode of ['hex', 'square'] as const) {
      for (const transposed of [false, true]) {
        const queue = remaining.map((k) => ({ ...k }));
        const [w, h] = transposed ? [paper.heightMm, paper.widthMm] : [paper.widthMm, paper.heightMm];
        let placements = fillSheet(w, h, queue, mode, margin, gap);
        if (transposed) placements = placements.map((p) => ({ ...p, x: p.y, y: p.x }));
        const area = placements.reduce((s, p) => s + p.diameterMm * p.diameterMm, 0);
        // Among equally full layouts prefer the most compact one (less paper used).
        const extent = placements.reduce((m, p) => Math.max(m, p.y + p.diameterMm / 2), 0);
        if (!best || area > best.area + EPS || (Math.abs(area - best.area) <= EPS && extent < best.extent - EPS)) {
          best = { placements, area, extent };
        }
      }
    }
    if (!best || best.placements.length === 0) break; // cannot happen once tooBig is filtered; guards loops
    for (const p of best.placements) {
      const k = remaining.find((r) => r.key === p.key);
      if (k) k.left--;
    }
    remaining = remaining.filter((k) => k.left > 0);
    sheets.push(best.placements);
  }
  return { sheets, tooBig };
}
