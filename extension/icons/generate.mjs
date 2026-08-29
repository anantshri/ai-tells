// Generates the extension icons: a magnifying glass whose lens frames a
// highlighted "AI". Dependency-free — draws shapes as signed-distance tests,
// anti-aliases by 4x supersampling, and writes PNGs (icon16/32/48/128.png).
//
//   node icons/generate.mjs
//
// Geometry is defined in a normalized [0,1] space so it scales to any size.
// icon.svg is the vector master (kept in sync by hand); these PNGs are what the
// manifest ships.

import zlib from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const YELLOW = [0xfc, 0xd3, 0x4d];
const DARK = [0x1d, 0x1b, 0x17];
const WHITE = [0xff, 0xff, 0xff];

// Lens
const C = [0.44, 0.42];
const R_OUT = 0.30;
const R_IN = 0.225;
// Handle
const H1 = [0.652, 0.632];
const H2 = [0.86, 0.84];
const H_RAD = 0.058;
// Letter strokes
const LR = 0.027;

function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function roundedRectInside(px, py, r) {
  // full [0,1] square, corner radius r
  const qx = Math.abs(px - 0.5) - 0.5 + r;
  const qy = Math.abs(py - 0.5) - 0.5 + r;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return outside <= 0;
}

// Letter strokes as segments (normalized). "A" caret + crossbar, "I" stem + serifs.
const STROKES = [
  // A
  [0.30, 0.55, 0.36, 0.30], [0.36, 0.30, 0.42, 0.55], [0.325, 0.45, 0.395, 0.45],
  // I
  [0.52, 0.30, 0.52, 0.55], [0.485, 0.30, 0.555, 0.30], [0.485, 0.55, 0.555, 0.55],
];

function lettersInside(px, py) {
  for (const [ax, ay, bx, by] of STROKES) if (distToSeg(px, py, ax, ay, bx, by) <= LR) return true;
  return false;
}

// Painter order, bottom → top. Each returns its colour if the point is inside.
const LAYERS = [
  (x, y) => (roundedRectInside(x, y, 0.22) ? YELLOW : null),          // rounded background
  (x, y) => (dist(x, y, C[0], C[1]) <= R_OUT ? WHITE : null),         // lens fill
  (x, y) => (x >= 0.26 && x <= 0.58 && y >= 0.44 && y <= 0.55 ? YELLOW : null), // highlight band under AI
  (x, y) => (lettersInside(x, y) ? DARK : null),                       // "AI"
  (x, y) => (distToSeg(x, y, H1[0], H1[1], H2[0], H2[1]) <= H_RAD ? DARK : null), // handle
  (x, y) => {                                                          // lens ring (annulus)
    const d = dist(x, y, C[0], C[1]);
    return d <= R_OUT && d >= R_IN ? DARK : null;
  },
];

function colorAt(nx, ny) {
  let c = null;
  for (const layer of LAYERS) { const r = layer(nx, ny); if (r) c = r; }
  return c;
}

const SS = 4;

function renderSize(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 4)] = 0; // PNG filter: none
    for (let x = 0; x < size; x++) {
      let sr = 0, sg = 0, sb = 0, covered = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;
          const c = colorAt(nx, ny);
          if (c) { sr += c[0]; sg += c[1]; sb += c[2]; covered++; }
        }
      }
      const total = SS * SS;
      const o = y * (1 + size * 4) + 1 + x * 4;
      if (covered) {
        raw[o] = Math.round(sr / covered);
        raw[o + 1] = Math.round(sg / covered);
        raw[o + 2] = Math.round(sb / covered);
        raw[o + 3] = Math.round((covered / total) * 255);
      } // else transparent (already zeroed)
    }
  }
  return raw;
}

// ---- minimal PNG encoder ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const size of [16, 32, 48, 128]) {
  writeFileSync(resolve(here, `icon${size}.png`), png(size, renderSize(size)));
}
console.log('Wrote icon16/32/48/128.png');
