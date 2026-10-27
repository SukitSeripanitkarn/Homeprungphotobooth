// Sanity checks for the sticker sheet packer: no overlaps, nothing outside
// the margins, and better use of the sheet than a plain grid.
// Run with `npm run test:pack` (Node 22.18+ runs TypeScript directly).
import { packStickers, PAPERS, type PackResult } from '../src/lib/pack.ts';

const opts = (paper: 'A4' | 'A3') => ({ paper: PAPERS[paper], marginMm: 5, gapMm: 2 });
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error('FAIL', msg);
};

function check(label: string, res: PackResult, o: ReturnType<typeof opts>) {
  for (const s of res.sheets) {
    for (const p of s) {
      const r = p.diameterMm / 2;
      const out =
        p.x - r < o.marginMm - 1e-6 ||
        p.y - r < o.marginMm - 1e-6 ||
        p.x + r > o.paper.widthMm - o.marginMm + 1e-6 ||
        p.y + r > o.paper.heightMm - o.marginMm + 1e-6;
      if (out) fail(`${label}: sticker outside margin`);
    }
    for (let i = 0; i < s.length; i++)
      for (let j = i + 1; j < s.length; j++) {
        const a = s[i];
        const b = s[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.diameterMm / 2 + b.diameterMm / 2 + o.gapMm - 1e-6) fail(`${label}: overlap`);
      }
  }
}

const grid = (W: number, H: number, d: number) => Math.floor((W - 10 + 2) / (d + 2)) * Math.floor((H - 10 + 2) / (d + 2));

for (const paper of ['A4', 'A3'] as const)
  for (const d of [25, 30, 35, 50]) {
    const o = opts(paper);
    const res = packStickers([{ key: 'a', diameterMm: d, count: 500 }], o);
    check(`${paper} ${d}mm`, res, o);
    const per = res.sheets[0].length;
    const g = grid(o.paper.widthMm, o.paper.heightMm, d);
    if (per < g) fail(`${paper} ${d}mm: ${per} per sheet is worse than a grid (${g})`);
    if (res.sheets.reduce((n, s) => n + s.length, 0) !== 500) fail(`${paper} ${d}mm: lost stickers`);
    console.log(`${paper} ${d}mm: ${per} per sheet (grid ${g})`);
  }

for (const paper of ['A4', 'A3'] as const) {
  const o = opts(paper);
  const kinds = [
    { key: 'A', diameterMm: 35, count: 20 },
    { key: 'B', diameterMm: 25, count: 30 },
    { key: 'C', diameterMm: 50, count: 40 },
  ];
  const res = packStickers(kinds, o);
  check(`${paper} mixed`, res, o);
  for (const k of kinds) {
    const placed = res.sheets.flat().filter((p) => p.key === k.key).length;
    if (placed !== k.count) fail(`${paper} mixed: ${k.key} placed ${placed}/${k.count}`);
  }
  console.log(`${paper} mixed 20×35 + 30×25 + 40×50 mm: ${res.sheets.map((s) => s.length).join(' + ')}`);
}

const big = packStickers([{ key: 'X', diameterMm: 250, count: 1 }], opts('A4'));
if (big.tooBig[0] !== 'X' || big.sheets.length) fail('oversized sticker not reported');

if (failures) process.exit(1);
console.log('all packing checks passed');
