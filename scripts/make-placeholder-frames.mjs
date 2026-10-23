// Generates simple placeholder ring frames (transparent square PNGs) into
// public/frames/. Replace them with the real brand frames from the client's
// Google Drive "PNG" folder and update public/frames/frames.json.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SIZE = 1024;
const C = SIZE / 2;

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function canvas() {
  const px = new Float32Array(SIZE * SIZE * 4); // premultiplied floats
  const over = (i, [r, g, b], a) => {
    if (a <= 0) return;
    const k = 1 - a;
    px[i] = r * a + px[i] * k;
    px[i + 1] = g * a + px[i + 1] * k;
    px[i + 2] = b * a + px[i + 2] * k;
    px[i + 3] = a + px[i + 3] * k;
  };
  return {
    ring(r1, r2, color) {
      const col = hex(color);
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          const d = Math.hypot(x + 0.5 - C, y + 0.5 - C);
          over((y * SIZE + x) * 4, col, clamp01(d - r1 + 0.5) * clamp01(r2 - d + 0.5));
        }
    },
    dot(cx, cy, r, color) {
      const col = hex(color);
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          over((y * SIZE + x) * 4, col, clamp01(r - d + 0.5));
        }
    },
    dotsOnCircle(n, radius, r, color, phase = 0) {
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2 + phase;
        this.dot(C + Math.cos(t) * radius, C + Math.sin(t) * radius, r, color);
      }
    },
    png() {
      const out = Buffer.alloc(SIZE * SIZE * 4);
      for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3];
        out[i] = a ? Math.round(px[i] / a) : 0;
        out[i + 1] = a ? Math.round(px[i + 1] / a) : 0;
        out[i + 2] = a ? Math.round(px[i + 2] / a) : 0;
        out[i + 3] = Math.round(a * 255);
      }
      return encodePng(out);
    },
  };
}

const GREEN = '#2E6B3A';
const LEAF = '#7BA05B';
const GOLD = '#C9A24A';
const CREAM = '#FBF7EC';

const frames = [
  {
    file: 'placeholder-herbal-green.png',
    draw(c) {
      c.ring(436, 512, GREEN);
      c.ring(424, 432, GOLD);
      c.dotsOnCircle(24, 474, 9, CREAM);
    },
  },
  {
    file: 'placeholder-classic-gold.png',
    draw(c) {
      c.ring(464, 512, GOLD);
      c.ring(452, 458, GREEN);
      c.dotsOnCircle(36, 488, 5, CREAM, Math.PI / 36);
    },
  },
  {
    file: 'placeholder-leaf-minimal.png',
    draw(c) {
      c.ring(482, 512, CREAM);
      c.ring(474, 480, LEAF);
      c.dotsOnCircle(12, 497, 7, LEAF);
    },
  },
];

for (const f of frames) {
  const c = canvas();
  f.draw(c);
  writeFileSync(new URL(`../public/frames/${f.file}`, import.meta.url), c.png());
  console.log('wrote', f.file);
}
