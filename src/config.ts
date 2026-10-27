/** How often the class-end check (and countdown) runs. The class length is CLASS_SESSION_MINUTES in api/_lib/classSession.ts. */
export const SESSION_CHECK_INTERVAL_MS = 30_000;

/** Physical print size of the circle. Everything below (export size, sheet text, filename) follows it. */
export const PRINT_DIAMETER_MM = 40;
/** Same size in centimetres for UI copy, e.g. "3.5". */
export const PRINT_DIAMETER_CM = String(PRINT_DIAMETER_MM / 10);
/** Export resolution. Change for a different print shop requirement. */
export const EXPORT_DPI = 600;
/** Export width/height in px: 40 mm at 600 DPI = 945 px (the frame artwork's own size). */
export const EXPORT_PX = Math.round((PRINT_DIAMETER_MM / 25.4) * EXPORT_DPI);
/** Pixels per metre written into the PNG pHYs chunk (EXPORT_PX / diameter). */
export const EXPORT_PX_PER_METRE = Math.round(EXPORT_PX / (PRINT_DIAMETER_MM / 1000));

/** Photos larger than this (longest side) are downscaled before editing. */
export const MAX_PHOTO_PX = 4000;

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

/**
 * Admin sticker sheet defaults, chosen for the Epson L18050 (A3) + MicroCut
 * 30Q print-and-cut kit. All of them can be changed on the admin page.
 */
export const SHEET_DEFAULTS = {
  paper: 'A3',
  /** Room around the edge for the cutter's registration marks. */
  marginMm: 12,
  /** Space between cut lines. Must be more than 2 × bleed. */
  gapMm: 3,
  /** Each image prints this much larger than its cut line, so a slightly off cut shows no white edge. */
  bleedMm: 1,
  copiesPerPerson: 1,
} as const;

/**
 * Custom text band defaults, measured from the HOMPRUNG BY BAIHOR frames:
 * the empty bottom band spans 0.63–0.82 of the radius, and the printed
 * "Your Own Herbal Inhaler" text sits at 0.68–0.78 over ~155°.
 */
export const DEFAULT_TEXT_AREA = {
  radius: 0.726,
  height: 0.1,
  maxAngle: 150,
  color: '#4A8A2E',
} as const;
/** In UTF-16 units, so Thai vowel and tone marks count too. */
export const FRAME_TEXT_MAX_LENGTH = 40;
/** Must be one of the weights loaded from Google Fonts in index.html. */
export const FRAME_TEXT_FONT = { weight: 600, family: "Niramit, 'Noto Sans Thai', sans-serif" } as const;

export const FRAMES_MANIFEST_URL = '/frames/frames.json';
export const FRAMES_BASE_URL = '/frames/';
