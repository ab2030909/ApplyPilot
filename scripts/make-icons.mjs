// Generates the extension icons (dark rounded square, white chevron "A", orange dot) as PNGs without dependencies.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function render(size) {
  const S = 4; // supersample
  const N = size * S;
  const px = Buffer.alloc(size * size * 4);
  const r = 0.22 * N;
  const inside = (x, y) => {
    const cx = Math.min(Math.max(x, r), N - r), cy = Math.min(Math.max(y, r), N - r);
    return Math.hypot(x - cx, y - cy) <= r;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let a = 0, R = 0, G = 0, B = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const X = x * S + sx + 0.5, Y = y * S + sy + 0.5;
        if (!inside(X, Y)) continue;
        let col = [21, 21, 21];
        const u = X / N, v = Y / N;
        const w = 0.075;
        if (distToSeg(u, v, 0.28, 0.74, 0.5, 0.24) < w || distToSeg(u, v, 0.5, 0.24, 0.72, 0.74) < w || distToSeg(u, v, 0.37, 0.58, 0.63, 0.58) < w * 0.8) col = [247, 247, 245];
        if (Math.hypot(u - 0.5, v - 0.24) < 0.085) col = [255, 107, 53];
        a++; R += col[0]; G += col[1]; B += col[2];
      }
      const i = (y * size + x) * 4;
      const total = S * S;
      px[i] = a ? R / a : 0; px[i + 1] = a ? G / a : 0; px[i + 2] = a ? B / a : 0; px[i + 3] = Math.round((a / total) * 255);
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

mkdirSync('public/icons', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icons/icon${s}.png`, render(s));
console.log('icons written');
