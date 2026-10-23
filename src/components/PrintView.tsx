import { createPortal } from 'react-dom';
import { PRINT_DIAMETER_MM, SHEET } from '../config';

export type PrintMode = 'single' | 'sheet';

/**
 * Print-only markup, rendered into #print-root (hidden on screen). It is kept
 * mounted with the latest export so that window.print() can run synchronously
 * inside the click handler (required by iOS Safari).
 */
export function PrintView({ url, count }: { url: string; count: number }) {
  const root = document.getElementById('print-root');
  if (!root) return null;
  const size = `${PRINT_DIAMETER_MM}mm`;
  const gridW = SHEET.columns * PRINT_DIAMETER_MM + (SHEET.columns - 1) * SHEET.gutterMm;
  const gridH = SHEET.rows * PRINT_DIAMETER_MM + (SHEET.rows - 1) * SHEET.gutterMm;
  const padX = (SHEET.pageWidthMm - gridW) / 2;
  // Slightly less than the exact vertical centre so rounding never spills onto a 2nd page.
  const padY = Math.max(0, (SHEET.pageHeightMm - gridH) / 2 - 4);
  return createPortal(
    <>
      <div className="print-single">
        <img src={url} alt="" style={{ width: size, height: size }} />
      </div>
      <div
        className="print-sheet"
        style={{
          padding: `${padY}mm ${padX}mm 0`,
          gridTemplateColumns: `repeat(${SHEET.columns}, ${size})`,
          gridAutoRows: size,
          gap: `${SHEET.gutterMm}mm`,
        }}
      >
        {Array.from({ length: count }, (_, i) => (
          <img key={i} src={url} alt="" style={{ width: size, height: size }} />
        ))}
      </div>
    </>,
    root,
  );
}

const PAGE_RULES: Record<PrintMode, string> = {
  single: '@page { size: auto; margin: 0; }',
  sheet: '@page { size: A4 portrait; margin: 0; }',
};

/** Selects the print layout and opens the browser print dialog. */
export function printNow(mode: PrintMode) {
  let style = document.getElementById('print-page-style') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'print-page-style';
    document.head.appendChild(style);
  }
  style.textContent = PAGE_RULES[mode];
  document.documentElement.dataset.printMode = mode;
  window.print();
}
