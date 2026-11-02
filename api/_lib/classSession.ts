/**
 * Types and limits shared by the browser app and the /api functions.
 * Keep this file free of browser- or Node-only APIs.
 *
 * It lives inside api/ on purpose: Vercel only compiles TypeScript under
 * api/, so a runtime import of a .ts file elsewhere fails in production.
 * (The leading underscore keeps _lib/ from becoming an endpoint.)
 */

/** A class runs for this long after the admin starts it; then everything is deleted. */
export const CLASS_SESSION_MINUTES = 60;
/** Upper bound on photos per class, to stop abuse of the public submit endpoint. */
export const MAX_SUBMISSIONS_PER_CLASS = 200;
/** Largest accepted sticker image (decoded bytes). Uploads are ≤ 1200 px JPEGs, ~150–500 KB. */
export const MAX_IMAGE_BYTES = 1_500_000;
export const MAX_NAME_LENGTH = 40;
export const MAX_WORKSHOP_LENGTH = 60;

/**
 * A workshop type fixes the sticker size and the sheet layout; all types use
 * the same frames, and the admin only picks A3 or A4 (bleed is always 0).
 * The super admin edits the list (/superadmin); it is stored in Redis, and
 * DEFAULT_WORKSHOP_TYPES apply until then.
 */
export interface WorkshopType {
  /** Stable id (kept when the type is renamed). */
  id: string;
  th: string;
  en: string;
  diameterMm: number;
  marginMm: number;
  gapMm: number;
}

export const DEFAULT_WORKSHOP_TYPES: WorkshopType[] = [
  { id: 'herbal-inhaler', th: 'ยาดมสมุนไพร', en: 'Herbal inhaler', diameterMm: 35, marginMm: 12, gapMm: 3 },
  { id: 'thai-tea', th: 'ชาไทย', en: 'Thai tea', diameterMm: 78, marginMm: 12, gapMm: 3 },
  { id: 'giant-inhaler', th: 'ยาดมยักษ์', en: 'Giant herbal inhaler', diameterMm: 104, marginMm: 12, gapMm: 3 },
];

export const WORKSHOP_LIMITS = {
  maxTypes: 20,
  maxNameLength: 40,
  diameterMm: [10, 270],
  marginMm: [0, 40],
  gapMm: [0, 20],
  /** The largest paper (A3, 297 × 420 mm) must fit one sticker with its margins. */
  a3WidthMm: 297,
} as const;

/** The type with `id` from `types`, else the first one (e.g. it was deleted). */
export const findWorkshopType = (types: readonly WorkshopType[], id: string | undefined): WorkshopType =>
  types.find((t) => t.id === id) ?? types[0] ?? DEFAULT_WORKSHOP_TYPES[0];

/**
 * The type a class runs with. Classes keep a copy of their type, so later
 * edits don't change a running class; older classes stored only an id.
 */
export const sessionWorkshopType = (type: WorkshopType | string | undefined): WorkshopType =>
  typeof type === 'object' && type ? type : findWorkshopType(DEFAULT_WORKSHOP_TYPES, type);

const round01 = (n: number) => Math.round(n * 10) / 10; // 0.1 mm

/** Checks and cleans a workshop type list from the super admin. */
/** Why a workshop list was rejected; `row` is 1-based. The page shows a translated message. */
export type WorkshopInvalidReason = 'empty' | 'tooMany' | 'name' | 'size' | 'margin' | 'gap' | 'fit';

export function validateWorkshopTypes(
  input: unknown,
): { ok: true; types: WorkshopType[] } | { ok: false; error: string; reason: WorkshopInvalidReason; row?: number } {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, reason: 'empty', error: 'At least one workshop type is required' };
  if (input.length > WORKSHOP_LIMITS.maxTypes) return { ok: false, reason: 'tooMany', error: `At most ${WORKSHOP_LIMITS.maxTypes} workshop types` };
  const L = WORKSHOP_LIMITS;
  const types: WorkshopType[] = [];
  const ids = new Set<string>();
  for (const [i, raw] of input.entries()) {
    const t = raw as Partial<WorkshopType>;
    const th = String(t.th ?? '').trim().slice(0, L.maxNameLength);
    const en = String(t.en ?? '').trim().slice(0, L.maxNameLength);
    const diameterMm = round01(Number(t.diameterMm));
    const marginMm = round01(Number(t.marginMm));
    const gapMm = round01(Number(t.gapMm));
    const row = `Workshop ${i + 1}`;
    if (!th) return { ok: false, reason: 'name', row: i + 1, error: `${row}: Thai name is required` };
    const inRange = (v: number, [lo, hi]: readonly [number, number]) => Number.isFinite(v) && v >= lo && v <= hi;
    if (!inRange(diameterMm, L.diameterMm)) return { ok: false, reason: 'size', row: i + 1, error: `${row}: sticker size must be ${L.diameterMm[0] / 10}–${L.diameterMm[1] / 10} cm` };
    if (!inRange(marginMm, L.marginMm)) return { ok: false, reason: 'margin', row: i + 1, error: `${row}: margin must be 0–${L.marginMm[1] / 10} cm` };
    if (!inRange(gapMm, L.gapMm)) return { ok: false, reason: 'gap', row: i + 1, error: `${row}: gap must be 0–${L.gapMm[1] / 10} cm` };
    if (diameterMm + 2 * marginMm > L.a3WidthMm) return { ok: false, reason: 'fit', row: i + 1, error: `${row}: the sticker and its margins don't fit on A3` };
    let id = String(t.id ?? '').trim();
    if (!/^[a-z0-9-]{1,40}$/.test(id) || ids.has(id)) id = `type-${Date.now().toString(36)}-${i}`;
    ids.add(id);
    types.push({ id, th, en: en || th, diameterMm, marginMm, gapMm });
  }
  return { ok: true, types };
}

/** Public view of the running class, as students see it. */
export interface PublicClassSession {
  workshop: string;
  /** The class's workshop type (size and layout), as it was when the class started. */
  type: WorkshopType;
  expiresAt: number;
  /** Server clock, so phones with a wrong clock still count down correctly. */
  now: number;
}

export interface ClassSession {
  id: string;
  /** Short code in the QR link; students need it to send photos. */
  code: string;
  workshop: string;
  /** Copy of the workshop type at start (older classes stored only its id). */
  type: WorkshopType | string;
  startedAt: number;
  expiresAt: number;
}

export interface SubmissionMeta {
  id: string;
  name: string;
  /** Image MIME type. */
  type: string;
  bytes: number;
  createdAt: number;
  updatedAt: number;
}

export interface SubmitRequest {
  code: string;
  name: string;
  /** Base64 data URL of the finished sticker (square; the circle is clipped when printing). */
  image: string;
  /** Present when replacing an earlier submission from the same phone. */
  id?: string;
  token?: string;
}

export interface SubmitResponse {
  id: string;
  token: string;
  expiresAt: number;
}

export interface AdminSessionResponse {
  session: ClassSession | null;
  /** Current workshop types, for starting the next class and batch sticker sizes. */
  workshopTypes: WorkshopType[];
  submissions: SubmissionMeta[];
  now: number;
}
