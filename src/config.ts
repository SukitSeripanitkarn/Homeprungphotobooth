/** How often the class-end check (and countdown) runs. The class length is CLASS_SESSION_MINUTES in api/_lib/classSession.ts. */
export const SESSION_CHECK_INTERVAL_MS = 30_000;

/**
 * Sticker sizes come from the workshop type (WORKSHOP_TYPES in
 * api/_lib/classSession.ts): 3.5 / 7.8 / 10.4 cm.
 */
/** Target print resolution of a sticker image. */
export const EXPORT_DPI = 600;
/**
 * Largest sticker image a phone uploads. 600 DPI would make a 10.4 cm sticker
 * ~2,460 px (too big to upload and store reliably); 1,200 px still gives
 * ~290–390 DPI for the big stickers. Frames are 1,280 px (2,560 px HD copies
 * are used for the admin's full-600-DPI batch stickers).
 */
export const MAX_STICKER_PX = 1200;

/** Pixel size of a sticker image of `diameterMm`, at EXPORT_DPI but no larger than `maxPx`. */
export const stickerPx = (diameterMm: number, maxPx = MAX_STICKER_PX) =>
  Math.min(maxPx, Math.round((diameterMm / 25.4) * EXPORT_DPI));

/** "3.5" for 35 mm, "7.8" for 78 mm, "10.4" for 104 mm. */
export const formatCm = (mm: number) => String(Math.round(mm * 100) / 1000);

/** Photos larger than this (longest side) are downscaled before editing. */
export const MAX_PHOTO_PX = 4000;

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 5;

/** Paper the admin page starts on (the Epson L18050 prints A3). */
export const DEFAULT_PAPER = 'A3' as const;

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
