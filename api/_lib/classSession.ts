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
 * The three Homprung workshop classes. Each fixes the sticker size and the
 * sheet layout; all use the same frames. The admin only picks A3 or A4.
 * Bleed is always 0 (cut exactly on the artwork edge).
 */
export const WORKSHOP_TYPES = [
  { id: 'herbal-inhaler', th: 'ยาดมสมุนไพร', en: 'Herbal inhaler', diameterMm: 35, marginMm: 12, gapMm: 3 },
  { id: 'thai-tea', th: 'ชาไทย', en: 'Thai tea', diameterMm: 78, marginMm: 12, gapMm: 3 },
  { id: 'giant-inhaler', th: 'ยาดมยักษ์', en: 'Giant herbal inhaler', diameterMm: 104, marginMm: 12, gapMm: 3 },
] as const;
export type WorkshopTypeId = (typeof WORKSHOP_TYPES)[number]['id'];
export type WorkshopType = (typeof WORKSHOP_TYPES)[number];
export const DEFAULT_WORKSHOP_TYPE: WorkshopTypeId = 'herbal-inhaler';

/** The workshop type for an id; unknown or missing ids (older classes) fall back to the default. */
export const workshopType = (id: string | undefined): WorkshopType =>
  WORKSHOP_TYPES.find((t) => t.id === id) ?? WORKSHOP_TYPES[0];

/** Public view of the running class, as students see it. */
export interface PublicClassSession {
  workshop: string;
  /** Workshop type id (see WORKSHOP_TYPES). */
  type: WorkshopTypeId;
  expiresAt: number;
  /** Server clock, so phones with a wrong clock still count down correctly. */
  now: number;
}

export interface ClassSession {
  id: string;
  /** Short code in the QR link; students need it to send photos. */
  code: string;
  workshop: string;
  type: WorkshopTypeId;
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
  submissions: SubmissionMeta[];
  now: number;
}
