import { DEFAULT_TEXT_AREA, FRAME_TEXT_FONT } from '../config';
import type { TextArea } from './types';

export interface FrameOverlay {
  text: string;
  area: Partial<TextArea>;
}

/**
 * Splits text into user-perceived characters so Thai vowel and tone marks
 * stay attached to their base letter when placed one by one along the arc.
 */
function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('th', { granularity: 'grapheme' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return text.match(/.[ัิ-ฺ็-๎̀-ͯ]*/gsu) ?? [];
}

const font = (px: number) => `${FRAME_TEXT_FONT.weight} ${px}px ${FRAME_TEXT_FONT.family}`;

/** Ensures the text font (including the Thai subset) is ready for canvas. */
export function loadFrameTextFont(text: string): Promise<unknown> {
  if (!text.trim() || !document.fonts?.load) return Promise.resolve();
  return document.fonts.load(font(40), text).catch(() => undefined);
}

/**
 * Draws `text` upright along the bottom arc of a `size`×`size` circle,
 * centred on the bottom and shrunk to fit `maxAngle` when it is long.
 */
export function drawArcText(ctx: CanvasRenderingContext2D, size: number, overlay: FrameOverlay) {
  const text = overlay.text.trim();
  if (!text) return;
  const area = { ...DEFAULT_TEXT_AREA, ...overlay.area };
  const R = size / 2;
  const rc = area.radius * R;
  const chars = graphemes(text);

  // Size letters to the band, then shrink until the arc fits.
  let px = area.height * R * 1.35;
  ctx.font = font(px);
  const spacing = () => px * 0.04;
  const measure = () => {
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing() * (chars.length - 1);
    return { widths, total };
  };
  let { widths, total } = measure();
  const maxArc = ((area.maxAngle * Math.PI) / 180) * rc;
  if (total > maxArc) {
    px *= maxArc / total;
    ctx.font = font(px);
    ({ widths, total } = measure());
  }

  // Centre the cap height on the band's middle radius. On the bottom arc the
  // letter tops point inwards, so the baseline sits on the outer side.
  const capHeight = ctx.measureText('H').actualBoundingBoxAscent || px * 0.7;
  const baseline = rc + capHeight / 2;

  ctx.save();
  ctx.fillStyle = area.color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let offset = 0;
  const start = Math.PI / 2 + total / rc / 2; // left end of the arc
  chars.forEach((ch, i) => {
    const theta = start - (offset + widths[i] / 2) / rc;
    ctx.save();
    ctx.translate(R + baseline * Math.cos(theta), R + baseline * Math.sin(theta));
    ctx.rotate(theta - Math.PI / 2);
    ctx.fillText(ch, -widths[i] / 2, 0);
    ctx.restore();
    offset += widths[i] + spacing();
  });
  ctx.restore();
}
