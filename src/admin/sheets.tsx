import { useId } from 'react';
import type { PaperSize, Placement } from '../lib/pack';

/**
 * A sticker sheet drawn as SVG in millimetres, so it prints at true size.
 * Each image is drawn `bleed` mm larger than its cut line and clipped to a
 * circle; the cut line itself is the circle of the sticker's diameter.
 */
export function SheetSvg({
  sheet,
  paper,
  images,
  bleedMm,
  cutGuide,
  className,
}: {
  sheet: Placement[];
  paper: PaperSize;
  images: Record<string, string | undefined>;
  bleedMm: number;
  cutGuide: boolean;
  className?: string;
}) {
  // Unique per instance: the preview and the print copy are both in the page.
  const clipId = `clip-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width={`${paper.widthMm}mm`}
      height={`${paper.heightMm}mm`}
      viewBox={`0 0 ${paper.widthMm} ${paper.heightMm}`}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <circle cx="0.5" cy="0.5" r="0.5" />
        </clipPath>
      </defs>
      <rect width={paper.widthMm} height={paper.heightMm} fill="#fff" />
      {sheet.map((p, i) => {
        const r = p.diameterMm / 2 + bleedMm;
        const href = images[p.key];
        return href ? (
          <image
            key={i}
            href={href}
            x={p.x - r}
            y={p.y - r}
            width={2 * r}
            height={2 * r}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <circle key={i} cx={p.x} cy={p.y} r={r} fill="#eee" />
        );
      })}
      {cutGuide &&
        sheet.map((p, i) => (
          <circle key={`c${i}`} cx={p.x} cy={p.y} r={p.diameterMm / 2} fill="none" stroke="#999" strokeWidth={0.15} />
        ))}
    </svg>
  );
}

const n = (v: number) => Number(v.toFixed(3));

/** Resolution of the sheet image inside the PDF (Epson's native 360 DPI). */
export const SHEET_RASTER_DPI = 360;

/**
 * Renders one sheet as a JPEG at SHEET_RASTER_DPI: every sticker clipped to
 * its circle (with bleed) on white. White prints as no ink on sticker paper.
 */
export async function renderSheetJpeg(
  sheet: Placement[],
  paper: PaperSize,
  sources: Record<string, Blob>,
  bleedMm: number,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const scale = SHEET_RASTER_DPI / 25.4;
  const width = Math.round(paper.widthMm * scale);
  const height = Math.round(paper.heightMm * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';

  const bitmaps = new Map<string, ImageBitmap>();
  try {
    for (const key of new Set(sheet.map((p) => p.key))) {
      const blob = sources[key];
      if (blob) bitmaps.set(key, await createImageBitmap(blob));
    }
    for (const p of sheet) {
      const bmp = bitmaps.get(p.key);
      if (!bmp) continue;
      const r = (p.diameterMm / 2 + bleedMm) * scale;
      const cx = p.x * scale;
      const cy = p.y * scale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      // Centre-crop to square, like preserveAspectRatio="slice".
      const s = Math.min(bmp.width, bmp.height);
      ctx.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, cx - r, cy - r, 2 * r, 2 * r);
      ctx.restore();
    }
  } finally {
    bitmaps.forEach((b) => b.close());
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92),
  );
  canvas.width = canvas.height = 0; // free the large canvas now
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}

/**
 * Print-and-cut PDF for one sheet: the sheet image, plus each cut circle
 * stroked in the "CutContour" spot colour (0.25 pt, 100% magenta), which
 * print-and-cut software uses to find the cut lines. The cut lines sit on a
 * "CutContour" layer that is visible on screen but never printed.
 */
export function sheetPdf(sheet: Placement[], paper: PaperSize, jpeg: { bytes: Uint8Array; width: number; height: number }) {
  const pt = 72 / 25.4;
  const W = n(paper.widthMm * pt);
  const H = n(paper.heightMm * pt);
  const K = 0.5522847498; // Bézier circle constant
  const paths = sheet
    .map((p) => {
      const cx = p.x * pt;
      const cy = H - p.y * pt;
      const r = (p.diameterMm / 2) * pt;
      const k = r * K;
      const f = (v: number) => v.toFixed(3);
      return [
        `${f(cx + r)} ${f(cy)} m`,
        `${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c`,
        `${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c`,
        `${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c`,
        `${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c`,
        'h S',
      ].join('\n');
    })
    .join('\n');
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q\n/OC /OC0 BDC\n/CS0 CS 1 SCN 0.25 w\n${paths}\nEMC\n`;

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const obj = (num: number, body: string | (() => void)) => {
    offsets[num] = length;
    push(`${num} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body();
    push('\nendobj\n');
  };

  push('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n');
  obj(
    1,
    '<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [8 0 R] /D << /Order [8 0 R] /ON [8 0 R] /AS [<< /Event /Print /OCGs [8 0 R] /Category [/Print] >>] >> >> >>',
  );
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 5 0 R >> /ColorSpace << /CS0 6 0 R >> /Properties << /OC0 8 0 R >> >> /Contents 4 0 R >>`,
  );
  obj(4, () => {
    push(`<< /Length ${enc.encode(content).length} >>\nstream\n`);
    push(content);
    push('endstream');
  });
  obj(5, () => {
    push(
      `<< /Type /XObject /Subtype /Image /Width ${jpeg.width} /Height ${jpeg.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.bytes.length} >>\nstream\n`,
    );
    push(jpeg.bytes);
    push('\nendstream');
  });
  obj(6, '[/Separation /CutContour /DeviceCMYK 7 0 R]');
  obj(7, '<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0 1 0 0] /N 1 >>');
  obj(8, '<< /Type /OCG /Name (CutContour) /Usage << /Print << /PrintState /OFF >> /View << /ViewState /ON >> >> >>');

  const xref = length;
  const count = offsets.length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/** Cut circles only, as an R12 ASCII DXF in millimetres (origin bottom-left). */
export function sheetDxf(sheet: Placement[], paper: PaperSize) {
  const lines = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', '4',
    '9', '$EXTMIN', '10', '0', '20', '0',
    '9', '$EXTMAX', '10', String(paper.widthMm), '20', String(paper.heightMm),
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '1',
    '0', 'LAYER', '2', 'CUT', '70', '0', '62', '6', '6', 'CONTINUOUS',
    '0', 'ENDTAB', '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
  ];
  for (const p of sheet) {
    lines.push('0', 'CIRCLE', '8', 'CUT', '10', String(n(p.x)), '20', String(n(paper.heightMm - p.y)), '30', '0', '40', String(n(p.diameterMm / 2)));
  }
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\r\n') + '\r\n';
}

