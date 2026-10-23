/** How long a customer's photo + edit state survives in their own browser. */
export const SESSION_TTL_MINUTES = 60;
/** How often the expiry check (and countdown) runs. */
export const SESSION_CHECK_INTERVAL_MS = 30_000;

/** Physical print size of the circle. */
export const PRINT_DIAMETER_MM = 30;
/** Export resolution. 709 px over 30 mm ≈ 600 DPI. Change for a different print shop resolution. */
export const EXPORT_PX = 709;
/** Pixels per metre written into the PNG pHYs chunk (EXPORT_PX / 30 mm). */
export const EXPORT_PX_PER_METRE = Math.round(EXPORT_PX / (PRINT_DIAMETER_MM / 1000));

/** Photos larger than this (longest side) are downscaled before editing. */
export const MAX_PHOTO_PX = 4000;

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

/** A4 sticker sheet layout. */
export const SHEET = {
  columns: 6,
  rows: 8,
  gutterMm: 2,
  pageWidthMm: 210,
  pageHeightMm: 297,
} as const;
export const SHEET_MAX = SHEET.columns * SHEET.rows;

export const FRAMES_MANIFEST_URL = '/frames/frames.json';
export const FRAMES_BASE_URL = '/frames/';
