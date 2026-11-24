// THE WORLD IN ONE DAY — Tuesday 24 November 2026.
// A one-page newspaper poster drawn entirely in code (Node 22, stdlib only).
// Writes /output/entry.png (1024x1024 PNG, deterministic, <= 1 MiB).
// 36 stories, 14 illustrated features, world map, timeline, verdict + markets.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- palette ----------
const PAPER = [246, 241, 229];
const PAPER2 = [238, 231, 214];
const INK = [25, 25, 25];
const INKSOFT = [70, 70, 66];
const RED = [179, 39, 30];
const BLUE = [29, 78, 137];
const TEAL = [14, 122, 107];
const GOLD = [200, 155, 42];
const GREEN = [24, 128, 56];
const ORANGE = [224, 110, 24];
const DARK = [34, 34, 38];
const WHITE = [255, 255, 255];
const SKY = [168, 205, 232];
const SKY2 = [120, 170, 215];

// ---------- canvas ----------
const px = new Uint8Array(W * H * 3);
function fillAll(c: number[]) {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0]; px[i * 3 + 1] = c[1]; px[i * 3 + 2] = c[2];
  }
}
function setP(x: number, y: number, c: number[]) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) setP(xx, yy, c);
}
function hline(x0: number, x1: number, y: number, c: number[]) {
  for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setP(x, y, c);
}
function vline(x: number, y0: number, y1: number, c: number[]) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) setP(x, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[], th = 1) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps);
    const y = Math.round(y0 + (dy * i) / steps);
    for (let a = 0; a < th; a++) for (let b = 0; b < th; b++) setP(x + a, y + b, c);
  }
}
function circle(cx: number, cy: number, r: number, c: number[]) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setP(x, y, c);
    }
}
function circleOutline(cx: number, cy: number, r: number, c: number[]) {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    setP(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
// scanline polygon fill
function poly(pts: number[][], c: number[]) {
  let minY = 1e9, maxY = -1e9;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const t = (y - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2)
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) setP(x, y, c);
  }
}
function frame(x: number, y: number, w: number, h: number, c: number[], th = 1) {
  rect(x, y, w, th, c); rect(x, y + h - th, w, th, c);
  rect(x, y, th, h, c); rect(x + w - th, y, th, h, c);
}

// ---------- 5x7 bitmap font (uppercase; lowercase maps up) ----------
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e], D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f], F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f], H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e], J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11], N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d], R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e], T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e], V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11], X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04], Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e], "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f], "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02], "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e], "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e], "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0], ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08], ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08], "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  '"': [0x0a, 0x0a, 0, 0, 0, 0, 0], "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04], "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0], "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04], "/": [0x01, 0x02, 0x02, 0x04, 0x08, 0x08, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02], ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d], "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "*": [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0], "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02], ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
  _: [0, 0, 0, 0, 0, 0, 0x1f], "~": [0, 0, 0x0a, 0x15, 0, 0, 0],
};
function charW(scale: number) { return 6 * scale; }
function textW(s: string, scale: number) { return s.length * 6 * scale - scale; }
function drawChar(x: number, y: number, ch: string, scale: number, c: number[]) {
  const g = FONT[ch.toUpperCase()] || FONT["?"];
  for (let r = 0; r < 7; r++)
    for (let col = 0; col < 5; col++)
      if (g[r] & (1 << (4 - col)))
        for (let a = 0; a < scale; a++)
          for (let b = 0; b < scale; b++)
            setP(x + col * scale + a, y + r * scale + b, c);
}
function text(x: number, y: number, s: string, scale: number, c: number[]) {
  for (let i = 0; i < s.length; i++) drawChar(x + i * 6 * scale, y, s[i], scale, c);
}
function textC(cx: number, y: number, s: string, scale: number, c: number[]) {
  text(cx - Math.floor(textW(s, scale) / 2), y, s, scale, c);
}
function textR(xRight: number, y: number, s: string, scale: number, c: number[]) {
  text(xRight - textW(s, scale), y, s, scale, c);
}
// greedy word wrap; returns lines that fit maxChars
function wrap(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(x: number, y: number, s: string, scale: number, c: number[], maxChars: number, lh?: number) {
  const lines = wrap(s, maxChars);
  const step = lh || 7 * scale + 2;
  lines.forEach((ln, i) => text(x, y + i * step, ln, scale, c));
  return lines.length;
}

// ---------- PNG encoder (color type 2, 8-bit, filter 0) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- illustrations (each draws 3+ visual elements) ----------
// mini scenes live in a box (x, y, w, h); big features use the same drawers scaled up.
function skyBand(x: number, y: number, w: number, h: number) {
  rect(x, y, w, Math.floor(h * 0.55), SKY);
  rect(x, y + Math.floor(h * 0.55), w, h - Math.floor(h * 0.55), [232, 222, 196]);
}
function flame(x: number, y: number, s: number) {
  poly([[x, y], [x + s * 0.5, y - s], [x + s, y], [x + s * 0.75, y - s * 0.45], [x + s * 0.25, y - s * 0.45]], ORANGE);
  poly([[x + s * 0.25, y], [x + s * 0.5, y - s * 0.55], [x + s * 0.75, y]], [255, 200, 40]);
}
function smoke(x: number, y: number, s: number, c: number[]) {
  circle(x, y, s, c); circle(x + s, y - s * 0.5, s * 0.8, c); circle(x - s, y - s * 0.4, s * 0.7, c);
}
function drawFactory(x: number, y: number, w: number, h: number) {
  skyBand(x, y, w, h);
  const gy = y + Math.floor(h * 0.72);
  rect(x, gy, w, h - Math.floor(h * 0.72), [90, 86, 78]);
  rect(x + w * 0.08, y + h * 0.42, w * 0.5, h * 0.3, [120, 60, 50]);
  rect(x + w * 0.6, y + h * 0.5, w * 0.32, h * 0.22, [150, 80, 60]);
  rect(x + w * 0.14, y + h * 0.18, w * 0.07, h * 0.3, [90, 70, 64]);
  rect(x + w * 0.26, y + h * 0.1, w * 0.07, h * 0.38, [90, 70, 64]);
  for (let i = 0; i < 4; i++) rect(x + w * (0.13 + i * 0.11), y + h * 0.48, w * 0.05, h * 0.07, GOLD);
  flame(x + w * 0.1, y + h * 0.44, w * 0.16);
  flame(x + w * 0.62, y + h * 0.52, w * 0.13);
  smoke(x + w * 0.2, y + h * 0.26, w * 0.045, [60, 58, 55]);
  smoke(x + w * 0.45, y + h * 0.3, w * 0.04, [80, 76, 70]);
  rect(x, y + h - 4, w, 4, RED);
}
function drawKyiv(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [38, 48, 70]);
  circle(x + w * 0.8, y + h * 0.16, w * 0.06, [240, 230, 190]);
  const base = y + h * 0.78;
  const heights = [0.42, 0.6, 0.5, 0.68, 0.38, 0.55];
  for (let i = 0; i < 6; i++) {
    const bx = x + w * (0.03 + i * 0.16);
    const bh = h * heights[i];
    rect(bx, base - bh, w * 0.13, bh, [18, 22, 34]);
    for (let wy = 0; wy < 3; wy++)
      for (let wx = 0; wx < 2; wx++) rect(bx + 3 + wx * 7, base - bh + 5 + wy * 9, 3, 4, GOLD);
  }
  rect(x, base, w, h * 0.22, [14, 16, 24]);
  line(x + w * 0.1, y + h * 0.1, x + w * 0.45, y + h * 0.42, WHITE, 2);
  poly([[x + w * 0.45, y + h * 0.42], [x + w * 0.52, y + h * 0.36], [x + w * 0.5, y + h * 0.46]], WHITE);
  circle(x + w * 0.5, y + h * 0.45, w * 0.09, ORANGE);
  circle(x + w * 0.5, y + h * 0.45, w * 0.05, [255, 210, 60]);
  flame(x + w * 0.68, base - h * 0.05, w * 0.1);
  smoke(x + w * 0.72, y + h * 0.3, w * 0.06, [90, 88, 84]);
  line(x + w * 0.55, y + h * 0.55, x + w * 0.62, y + h * 0.5, [255, 210, 60], 2);
  line(x + w * 0.55, y + h * 0.55, x + w * 0.6, y + h * 0.62, [255, 210, 60], 2);
}
function drawNvidia(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [12, 26, 18]);
  rect(x + w * 0.08, y + h * 0.55, w * 0.34, h * 0.3, [30, 60, 38]);
  frame(x + w * 0.08, y + h * 0.55, w * 0.34, h * 0.3, GREEN, 2);
  rect(x + w * 0.16, y + h * 0.63, w * 0.18, h * 0.14, [80, 200, 110]);
  for (let i = 0; i < 4; i++) {
    rect(x + w * (0.1 + i * 0.09), y + h * 0.5, 2, h * 0.05, GREEN);
    rect(x + w * (0.1 + i * 0.09), y + h * 0.85, 2, h * 0.05, GREEN);
  }
  const pts: number[][] = [
    [x + w * 0.06, y + h * 0.5], [x + w * 0.24, y + h * 0.44], [x + w * 0.4, y + h * 0.46],
    [x + w * 0.56, y + h * 0.3], [x + w * 0.72, y + h * 0.32], [x + w * 0.9, y + h * 0.1],
  ];
  for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], [90, 230, 120], 3);
  for (const p of pts) circle(p[0], p[1], 3, [150, 255, 170]);
  poly([[x + w * 0.9, y + h * 0.1], [x + w * 0.82, y + h * 0.1], [x + w * 0.9, y + h * 0.2]], [90, 230, 120]);
  text(x + w * 0.5, y + h * 0.06, "+31%", 2, [150, 255, 170]);
}
function drawCOP(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [16, 60, 90]);
  circle(x + w * 0.5, y + h * 0.52, w * 0.36, [70, 160, 200]);
  circle(x + w * 0.5, y + h * 0.52, w * 0.36, [70, 160, 200]);
  poly([[x + w * 0.3, y + h * 0.3], [x + w * 0.44, y + h * 0.28], [x + w * 0.5, y + h * 0.4], [x + w * 0.38, y + h * 0.48]], GREEN);
  poly([[x + w * 0.55, y + h * 0.55], [x + w * 0.72, y + h * 0.5], [x + w * 0.7, y + h * 0.68], [x + w * 0.56, y + h * 0.7]], GREEN);
  poly([[x + w * 0.32, y + h * 0.62], [x + w * 0.44, y + h * 0.6], [x + w * 0.42, y + h * 0.74], [x + w * 0.3, y + h * 0.72]], GREEN);
  circle(x + w * 0.14, y + h * 0.14, w * 0.09, [255, 200, 60]);
  for (let i = 0; i < 5; i++) line(x + w * (0.06 + i * 0.045), y + h * 0.05, x + w * (0.06 + i * 0.045), y + h * 0.1, [255, 200, 60], 2);
  smoke(x + w * 0.82, y + h * 0.2, w * 0.06, [150, 150, 145]);
  rect(x + w * 0.06, y + h * 0.86, w * 0.88, 3, RED);
  line(x + w * 0.06, y + h * 0.86, x + w * 0.5, y + h * 0.86, RED, 3);
  poly([[x + w * 0.5, y + h * 0.8], [x + w * 0.56, y + h * 0.86], [x + w * 0.5, y + h * 0.92]], RED);
  text(x + w * 0.06, y + h * 0.82, "NO DEAL", 1, WHITE);
}
function drawShip(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, SKY2);
  for (let i = 0; i < 3; i++) rect(x + w * (0.05 + i * 0.32), y + h * (0.6 + i * 0.1), w * 0.26, 3, WHITE);
  poly([[x + w * 0.08, y + h * 0.55], [x + w * 0.92, y + h * 0.55], [x + w * 0.84, y + h * 0.78], [x + w * 0.16, y + h * 0.78]], [40, 44, 52]);
  rect(x + w * 0.3, y + h * 0.32, w * 0.4, h * 0.23, [200, 200, 195]);
  rect(x + w * 0.42, y + h * 0.2, w * 0.16, h * 0.12, [160, 50, 40]);
  for (let i = 0; i < 3; i++) rect(x + w * (0.33 + i * 0.12), y + h * 0.38, w * 0.07, h * 0.08, BLUE);
  flame(x + w * 0.58, y + h * 0.34, w * 0.15);
  smoke(x + w * 0.66, y + h * 0.22, w * 0.05, [50, 50, 50]);
  circle(x + w * 0.82, y + h * 0.12, 3, DARK);
  line(x + w * 0.82, y + h * 0.12, x + w * 0.7, y + h * 0.3, DARK, 1);
  rect(x + w * 0.06, y + h * 0.82, w * 0.88, 3, [20, 60, 110]);
}
function drawWarship(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [30, 40, 60]);
  rect(x, y + h * 0.62, w, h * 0.38, [20, 50, 80]);
  for (let i = 0; i < 4; i++) rect(x + w * (0.04 + i * 0.24), y + h * 0.72, w * 0.18, 2, WHITE);
  poly([[x + w * 0.1, y + h * 0.6], [x + w * 0.9, y + h * 0.6], [x + w * 0.8, y + h * 0.7], [x + w * 0.2, y + h * 0.7]], [70, 74, 80]);
  rect(x + w * 0.42, y + h * 0.42, w * 0.12, h * 0.18, [90, 94, 100]);
  rect(x + w * 0.3, y + h * 0.5, w * 0.4, h * 0.1, [90, 94, 100]);
  circle(x + w * 0.55, y + h * 0.35, w * 0.13, ORANGE);
  circle(x + w * 0.55, y + h * 0.35, w * 0.08, [255, 210, 60]);
  circle(x + w * 0.42, y + h * 0.28, w * 0.06, [255, 210, 60]);
  circle(x + w * 0.68, y + h * 0.3, w * 0.05, ORANGE);
  smoke(x + w * 0.55, y + h * 0.12, w * 0.07, [60, 60, 58]);
  line(x + w * 0.2, y + h * 0.2, x + w * 0.4, y + h * 0.4, WHITE, 2);
  text(x + w * 0.4, y + h * 0.84, "BENGHAZI", 1, WHITE);
}
function drawCrowd(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [200, 220, 235]);
  rect(x, y + h * 0.75, w, h * 0.25, [120, 130, 140]);
  const skin = [[230, 190, 150], [200, 150, 110], [240, 205, 170], [170, 120, 90]];
  for (let i = 0; i < 8; i++) {
    const cx = x + w * (0.08 + i * 0.11);
    const cy = y + h * (0.62 + (i % 3) * 0.08);
    circle(cx, cy, w * 0.05, skin[i % 4]);
    rect(cx - w * 0.05, cy + w * 0.05, w * 0.1, h * 0.18, [60 + i * 12, 70, 110]);
  }
  rect(x + w * 0.04, y + h * 0.18, w * 0.42, h * 0.22, WHITE);
  frame(x + w * 0.04, y + h * 0.18, w * 0.42, h * 0.22, INK, 1);
  line(x + w * 0.25, y + h * 0.4, x + w * 0.25, y + h * 0.62, INK, 2);
  rect(x + w * 0.52, y + h * 0.12, w * 0.44, h * 0.2, RED);
  frame(x + w * 0.52, y + h * 0.12, w * 0.44, h * 0.2, INK, 1);
  line(x + w * 0.74, y + h * 0.32, x + w * 0.74, y + h * 0.58, INK, 2);
  text(x + w * 0.06, y + h * 0.26, "COSTS", 1, INK);
  text(x + w * 0.53, y + h * 0.18, "ENOUGH", 1, WHITE);
}
function drawChartDown(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [245, 240, 230]);
  for (let i = 0; i < 4; i++) hline(x + 4, x + w - 4, y + h * (0.2 + i * 0.2), [220, 214, 200]);
  const bars = [0.5, 0.62, 0.45, 0.7, 0.55, 0.82];
  for (let i = 0; i < 6; i++) {
    const bx = x + w * (0.08 + i * 0.15);
    rect(bx, y + h * (0.85 - bars[i] * 0.6), w * 0.09, h * bars[i] * 0.6, i === 5 ? RED : [150, 40, 32]);
  }
  const pts: number[][] = [
    [x + w * 0.08, y + h * 0.3], [x + w * 0.26, y + h * 0.42], [x + w * 0.44, y + h * 0.36],
    [x + w * 0.62, y + h * 0.58], [x + w * 0.8, y + h * 0.66], [x + w * 0.94, y + h * 0.82],
  ];
  for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED, 3);
  poly([[x + w * 0.94, y + h * 0.82], [x + w * 0.86, y + h * 0.8], [x + w * 0.94, y + h * 0.72]], RED);
  text(x + w * 0.5, y + h * 0.05, "-1,484", 1, RED);
}
function drawTrain(x: number, y: number, w: number, h: number) {
  skyBand(x, y, w, h);
  const gy = y + h * 0.7;
  rect(x, gy, w, h * 0.3, [110, 105, 90]);
  hline(x, x + w, gy + h * 0.12, DARK); hline(x, x + w, gy + h * 0.2, DARK);
  for (let i = 0; i < 8; i++) vline(x + w * (0.05 + i * 0.12), gy + h * 0.12, gy + h * 0.2, DARK);
  rect(x + w * 0.06, y + h * 0.34, w * 0.88, h * 0.36, [200, 60, 40]);
  rect(x + w * 0.06, y + h * 0.34, w * 0.88, h * 0.1, [230, 90, 60]);
  for (let i = 0; i < 5; i++) rect(x + w * (0.12 + i * 0.17), y + h * 0.48, w * 0.1, h * 0.12, [200, 230, 245]);
  circle(x + w * 0.16, gy + h * 0.06, w * 0.04, DARK);
  circle(x + w * 0.84, gy + h * 0.06, w * 0.04, DARK);
  poly([[x + w * 0.06, y + h * 0.34], [x + w * 0.14, y + h * 0.2], [x + w * 0.22, y + h * 0.34]], GOLD);
  rect(x + w * 0.4, y + h * 0.1, w * 0.2, h * 0.1, [255, 150, 30]);
  rect(x + w * 0.4, y + h * 0.1, w * 0.2, h * 0.05, [20, 90, 160]);
}
function drawToxic(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [210, 200, 170]);
  poly([[x, y + h * 0.7], [x + w * 0.3, y + h * 0.55], [x + w * 0.6, y + h * 0.68], [x + w, y + h * 0.6], [x + w, y + h], [x, y + h]], [150, 140, 110]);
  const cols = [GREEN, [200, 160, 30], RED];
  for (let i = 0; i < 3; i++) {
    const bx = x + w * (0.12 + i * 0.28);
    rect(bx, y + h * 0.45, w * 0.2, h * 0.35, cols[i]);
    rect(bx, y + h * 0.42, w * 0.2, h * 0.05, DARK);
    poly([[bx + w * 0.1, y + h * 0.55], [bx + w * 0.16, y + h * 0.68], [bx + w * 0.04, y + h * 0.68]], WHITE);
  }
  smoke(x + w * 0.8, y + h * 0.25, w * 0.08, [100, 140, 90]);
  circle(x + w * 0.82, y + h * 0.18, w * 0.05, [120, 160, 110]);
}
function drawCourt(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [225, 225, 220]);
  poly([[x + w * 0.1, y + h * 0.3], [x + w * 0.5, y + h * 0.08], [x + w * 0.9, y + h * 0.3]], [90, 90, 100]);
  rect(x + w * 0.1, y + h * 0.3, w * 0.8, h * 0.08, [120, 120, 125]);
  for (let i = 0; i < 4; i++) rect(x + w * (0.16 + i * 0.19), y + h * 0.38, w * 0.07, h * 0.34, [200, 200, 195]);
  rect(x + w * 0.1, y + h * 0.72, w * 0.8, h * 0.08, [120, 120, 125]);
  circle(x + w * 0.78, y + h * 0.2, w * 0.13, GOLD);
  circleOutline(x + w * 0.78, y + h * 0.2, w * 0.13, [150, 110, 20]);
  text(x + w * 0.74, y + h * 0.13, "$", 2, [120, 85, 10]);
  text(x + w * 0.08, y + h * 0.84, "$1.1BN", 1, INK);
}
function drawTrophy(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [30, 50, 90]);
  circle(x + w * 0.15, y + h * 0.2, 2, GOLD); circle(x + w * 0.85, y + h * 0.15, 2, WHITE);
  circle(x + w * 0.7, y + h * 0.85, 2, GOLD); circle(x + w * 0.25, y + h * 0.85, 2, [255, 120, 120]);
  poly([[x + w * 0.32, y + h * 0.18], [x + w * 0.68, y + h * 0.18], [x + w * 0.62, y + h * 0.55], [x + w * 0.38, y + h * 0.55]], GOLD);
  poly([[x + w * 0.32, y + h * 0.18], [x + w * 0.18, y + h * 0.3], [x + w * 0.3, y + h * 0.4]], GOLD);
  poly([[x + w * 0.68, y + h * 0.18], [x + w * 0.82, y + h * 0.3], [x + w * 0.7, y + h * 0.4]], GOLD);
  rect(x + w * 0.44, y + h * 0.55, w * 0.12, h * 0.12, GOLD);
  rect(x + w * 0.36, y + h * 0.67, w * 0.28, h * 0.08, GOLD);
  rect(x + w * 0.3, y + h * 0.75, w * 0.4, h * 0.08, [120, 90, 30]);
  text(x + w * 0.3, y + h * 0.86, "CHAMPION", 1, WHITE);
}
function drawRaceCar(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [25, 25, 40]);
  for (let i = 0; i < 8; i++) rect(x + w * (0.05 + i * 0.11), y + h * 0.08, w * 0.055, h * 0.08, i % 2 ? WHITE : DARK);
  for (let i = 0; i < 8; i++) rect(x + w * (0.05 + i * 0.11), y + h * 0.16, w * 0.055, h * 0.08, i % 2 ? DARK : WHITE);
  poly([[x + w * 0.12, y + h * 0.62], [x + w * 0.2, y + h * 0.45], [x + w * 0.45, y + h * 0.42], [x + w * 0.62, y + h * 0.5], [x + w * 0.9, y + h * 0.55], [x + w * 0.88, y + h * 0.66], [x + w * 0.12, y + h * 0.66]], RED);
  rect(x + w * 0.28, y + h * 0.46, w * 0.16, h * 0.1, [180, 220, 240]);
  circle(x + w * 0.28, y + h * 0.68, w * 0.09, DARK); circle(x + w * 0.28, y + h * 0.68, w * 0.04, [180, 180, 180]);
  circle(x + w * 0.74, y + h * 0.68, w * 0.09, DARK); circle(x + w * 0.74, y + h * 0.68, w * 0.04, [180, 180, 180]);
  for (let i = 0; i < 3; i++) hline(x + w * 0.02, x + w * 0.12, y + h * (0.5 + i * 0.07), GOLD);
  text(x + w * 0.1, y + h * 0.8, "LAS VEGAS", 1, WHITE);
}
function drawChess(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, [60, 40, 25]);
  const s = w / 4;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      rect(x + c * s, y + r * s, s, s, (r + c) % 2 ? [240, 225, 195] : [120, 80, 45]);
  circle(x + w * 0.3, y + h * 0.32, w * 0.09, WHITE);
  circle(x + w * 0.3, y + h * 0.32, w * 0.09, WHITE);
  rect(x + w * 0.26, y + h * 0.18, w * 0.08, h * 0.12, WHITE);
  circle(x + w * 0.3, y + h * 0.16, w * 0.03, WHITE);
  rect(x + w * 0.22, y + h * 0.38, w * 0.16, h * 0.06, WHITE);
  circle(x + w * 0.68, y + h * 0.68, w * 0.09, DARK);
  rect(x + w * 0.64, y + h * 0.54, w * 0.08, h * 0.12, DARK);
  circle(x + w * 0.68, y + h * 0.52, w * 0.03, DARK);
  rect(x + w * 0.6, y + h * 0.74, w * 0.16, h * 0.06, DARK);
  text(x + w * 0.06, y + h * 0.86, "GENEVA", 1, WHITE);
}

// ---------- story data (all events of Tuesday 24 November 2026) ----------
type Label = "REPORTED" | "CLAIM" | "FORECAST";
interface Story {
  n: number; region: string; headline: string; sub: string; label: Label;
  draw: (x: number, y: number, w: number, h: number) => void;
}
const LABEL_C: Record<Label, number[]> = { REPORTED: GREEN, CLAIM: ORANGE, FORECAST: BLUE };
const FEATURES: Story[] = [
  { n: 1, region: "INDONESIA", headline: "FACTORY FIRE KILLS 24", sub: "24 DEAD - ~30 MISSING IN BANTEN", label: "REPORTED", draw: drawFactory },
  { n: 2, region: "UKRAINE", headline: "RUSSIAN STRIKES HIT KYIV REGION", sub: "SEVERAL KILLED - HOMES HIT IN DYMER", label: "REPORTED", draw: drawKyiv },
  { n: 3, region: "MARKETS", headline: "HUANG BACK AT NVIDIA", sub: "+31% IN A DAY - ABOUT $1TN ADDED", label: "REPORTED", draw: drawNvidia },
  { n: 4, region: "CLIMATE - COP31", headline: "COP31 ENDS WITH NO DEAL", sub: "NO FOSSIL-FUEL DEAL AGREED", label: "REPORTED", draw: drawCOP },
  { n: 5, region: "GULF OF FINLAND", headline: "RUSSIAN SHIP ABLAZE", sub: "DRONE HIT OFF FINLAND", label: "REPORTED", draw: drawShip },
  { n: 6, region: "LIBYA", headline: "ZELENSKYY HAILS WARSHIP STRIKE", sub: "CORVETTE ABLAZE, BENGHAZI", label: "CLAIM", draw: drawWarship },
  { n: 7, region: "PORTUGAL", headline: "THOUSANDS MARCH IN LISBON", sub: "COST-OF-LIVING PROTEST", label: "REPORTED", draw: drawCrowd },
  { n: 8, region: "INDIA", headline: "SENSEX DIVES 1,484 POINTS", sub: "-1.77% TO 82,435", label: "REPORTED", draw: drawChartDown },
  { n: 9, region: "INDIA - NEPAL", headline: "NEW TRAIN LINKS AYODHYA-JANAKPUR", sub: "EXPRESS FLAGGED OFF TODAY", label: "REPORTED", draw: drawTrain },
  { n: 10, region: "GAZA", headline: "GAZA TOXIC FOR DECADES", sub: "OXFAM: TOXIC FOR DECADES", label: "REPORTED", draw: drawToxic },
  { n: 11, region: "USA", headline: "DOJ SEEKS $1.1BN BACK", sub: "N. KOREA-LINKED THEFT", label: "REPORTED", draw: drawCourt },
  { n: 12, region: "SPORT - TENNIS", headline: "ALCARAZ WINS ATP FINALS", sub: "BEATS ZVEREV - MAIDEN TITLE", label: "REPORTED", draw: drawTrophy },
  { n: 13, region: "SPORT - F1", headline: "VERSTAPPEN WINS IN VEGAS", sub: "LAS VEGAS GRAND PRIX", label: "REPORTED", draw: drawRaceCar },
  { n: 14, region: "CHESS", headline: "GUKESH DEFENDS CROWN", sub: "GAME 1 TODAY IN GENEVA", label: "FORECAST", draw: drawChess },
];
const ALSO: string[] = [
  "MYANMAR SLAMS ASEAN RULING",
  "BANGLADESH: ARREST HASINA IF SHE RETURNS",
  "CHINA SETS 2030 WELFARE TARGETS",
  "S. KOREA RESHUFFLES CABINET",
  "ARMENIA PROPOSES NEW CONSTITUTION",
  "LAHORE AQI TOPS 500",
  "PAKISTAN QUAKE, MAGNITUDE 4.0",
  "GERMANY: 450 SCHOOLS GET BOMB THREATS",
  "DUTCH ACTIVIST DIES BY EUTHANASIA, 28",
  "JEWELLER PAOLO BULGARI DIES, 89",
  "O'HARE GROUND STOP IN HOLIDAY RUSH",
  "CAMBRIDGE TRIALS AI MAMMOGRAMS",
  "TALIBAN ERASES WOMEN'S NAMES IN BALKH",
  "TRUMP ATTACKS NEWSOM AT DOJ SPEECH",
  "COURT MAY ERASE TRUMP HUSH-MONEY CASE",
  "EXPERTS SLAM DIVIDED ICJ RULING",
  "FIFA PICKS WOMEN'S WORLD CUP HOSTS",
  "PANT 128 AS INDIA-NZ TEST DRAWN",
  "INDIA-CHINA BORDER TALKS IN ARUNACHAL",
  "MODI OPENS AI CENTRE AT IIT PATNA",
  "WALL ST WORST WEEK SINCE COVID",
  "FERRARI UNVEILS TWO NEW 296 MODELS",
];
const STATS: [string, string][] = [
  ["24", "DEAD IN FACTORY FIRE"],
  ["+31%", "NVIDIA IN A DAY"],
  ["-1,484", "SENSEX POINTS"],
  ["30", "WORKERS MISSING"],
  ["$1.1BN", "DOJ SEEKS BACK"],
  ["450", "SCHOOLS THREATENED"],
];
const HOURS: [string, string][] = [
  ["EARLY", "FACTORY FIRE IN BANTEN REPORTED: 24 DEAD"],
  ["MORNING", "RUSSIAN STRIKES HIT KYIV REGION"],
  ["MIDDAY", "COP31 ENDS WITH NO FOSSIL-FUEL DEAL"],
  ["AFTERNOON", "SENSEX CLOSES DOWN 1,484 POINTS"],
  ["EVENING", "ALCARAZ LIFTS FIRST ATP FINALS TITLE"],
  ["NIGHT", "O'HARE GROUND STOP IN HOLIDAY RUSH"],
];
// map pins: [story n, x, y] inside map box (8..600, 676..786)
const PINS: [number, number, number][] = [
  [1, 492, 742], [2, 360, 700], [3, 88, 716], [4, 346, 714], [5, 352, 692],
  [6, 322, 730], [7, 296, 712], [8, 432, 728], [9, 448, 722], [10, 338, 724],
  [11, 112, 720], [12, 318, 706], [13, 72, 722], [14, 312, 702],
];

// ---------- layout helpers ----------
function chip(x: number, y: number, label: Label) {
  const w = textW(label, 1) + 8;
  rect(x, y, w, 11, LABEL_C[label]);
  text(x + 4, y + 2, label, 1, WHITE);
  return w;
}
function numBadge(x: number, y: number, n: number, r = 8) {
  circle(x, y, r, RED);
  const s = String(n);
  text(x - Math.floor(textW(s, 1) / 2), y - 3, s, 1, WHITE);
}
function sectionBar(y: number, label: string) {
  rect(8, y, 1008, 16, INK);
  text(14, y + 4, label, 1, WHITE);
}
function bigCard(x: number, y: number, w: number, h: number, s: Story) {
  frame(x, y, w, h, INK, 2);
  s.draw(x + 2, y + 2, w - 4, 118);
  frame(x + 2, y + 2, w - 4, 118, INK, 1);
  numBadge(x + 14, y + 14, s.n, 9);
  text(x + 6, y + 128, s.region, 1, RED);
  chip(x + w - textW(s.label, 1) - 14, y + 126, s.label);
  para(x + 6, y + 142, s.headline, 2, INK, Math.floor((w - 12) / 12));
  text(x + 6, y + h - 14, s.sub, 1, INKSOFT);
}
function smallCard(x: number, y: number, w: number, h: number, s: Story) {
  frame(x, y, w, h, INK, 1);
  s.draw(x + 3, y + 3, 74, h - 6);
  frame(x + 3, y + 3, 74, h - 6, INK, 1);
  numBadge(x + 12, y + 12, s.n, 8);
  const tx = x + 82;
  const mc = Math.floor((w - 86) / 6);
  text(tx, y + 4, s.region, 1, RED);
  const hl = para(tx, y + 15, s.headline, 1, INK, mc, 9);
  para(tx, y + 15 + hl * 9 + 1, s.sub, 1, INKSOFT, mc, 9);
  chip(tx, y + h - 14, s.label);
}

// ---------- world map ----------
function drawMap(x0: number, y0: number, w: number, h: number) {
  rect(x0, y0, w, h, [190, 215, 232]);
  frame(x0, y0, w, h, INK, 1);
  const land: number[][][] = [
    [[28, 16], [75, 6], [125, 4], [165, 10], [180, 24], [155, 38], [132, 56], [108, 72], [84, 64], [58, 44], [34, 32]],
    [[185, 4], [208, 2], [216, 10], [198, 16]],
    [[148, 78], [172, 70], [192, 80], [188, 98], [172, 106], [158, 96], [148, 86]],
    [[298, 16], [328, 6], [352, 12], [344, 28], [318, 30], [298, 24]],
    [[298, 44], [338, 36], [362, 48], [354, 74], [334, 94], [314, 80], [298, 58]],
    [[366, 8], [420, 2], [482, 6], [522, 16], [502, 34], [472, 28], [452, 44], [422, 40], [402, 54], [382, 38], [366, 24]],
    [[468, 58], [488, 56], [504, 64], [486, 70]],
    [[478, 84], [518, 78], [538, 88], [518, 100], [488, 98]],
  ];
  const sx = w / 560, sy = h / 112;
  for (const cont of land) {
    const pts = cont.map((p) => [x0 + p[0] * sx, y0 + p[1] * sy]);
    poly(pts, [210, 195, 150]);
    for (let i = 0; i < pts.length; i++) line(pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], [140, 125, 90], 1);
  }
  text(x0 + 30 * sx, y0 + 12 * sy, "N. AMERICA", 1, [90, 80, 60]);
  text(x0 + 132 * sx, y0 + 96 * sy, "S. AMERICA", 1, [90, 80, 60]);
  text(x0 + 296 * sx, y0 + 62 * sy, "AFRICA", 1, [90, 80, 60]);
  text(x0 + 408 * sx, y0 + 12 * sy, "ASIA", 1, [90, 80, 60]);
  text(x0 + 472 * sx, y0 + 96 * sy, "AUSTRALIA", 1, [90, 80, 60]);
  for (const [n, px2, py2] of PINS) {
    circle(x0 + px2 * sx, y0 + py2 * sy, 7, RED);
    const s = String(n);
    text(x0 + px2 * sx - Math.floor(textW(s, 1) / 2), y0 + py2 * sy - 3, s, 1, WHITE);
  }
}

// ---------- build ----------
function build() {
  fillAll(PAPER);
  rect(0, 0, W, 6, RED);
  // masthead
  textC(512, 14, "THE WORLD IN ONE DAY", 4, INK);
  rect(8, 50, 1008, 2, INK);
  textC(512, 58, "TUESDAY, 24 NOVEMBER 2026", 2, RED);
  textC(512, 78, "36 STORIES  -  14 ILLUSTRATED  -  6 REGIONS  -  ALL REPORTED TODAY", 1, INKSOFT);
  rect(8, 92, 1008, 2, INK);
  // stat strip
  const sw = 168;
  STATS.forEach(([num, lab], i) => {
    const x = 8 + i * sw;
    frame(x, 98, sw - 4, 48, INK, 1);
    rect(x, 98, sw - 4, 48, PAPER2);
    textC(x + (sw - 4) / 2, 104, num, 3, RED);
    textC(x + (sw - 4) / 2, 130, lab, 1, INK);
  });
  // top 3
  sectionBar(152, "TOP STORIES - THE DAY'S BIGGEST");
  for (let i = 0; i < 3; i++) bigCard(8 + i * 338, 172, 332, 200, FEATURES[i]);
  // grid of remaining 11 features
  sectionBar(378, "MORE OF THE DAY - 11 MORE STORIES, EACH WITH ITS OWN PICTURE");
  const gw = 247, gh = 82;
  for (let i = 3; i < 14; i++) {
    const k = i - 3;
    const cx = 8 + (k % 4) * (gw + 6);
    const cy = 396 + Math.floor(k / 4) * (gh + 3);
    smallCard(cx, cy, gw, gh, FEATURES[i]);
  }
  // map + timeline
  sectionBar(656, "WHERE IT HAPPENED");
  drawMap(8, 676, 592, 110);
  rect(608, 676, 408, 110, PAPER2);
  frame(608, 676, 408, 110, INK, 1);
  text(616, 682, "THE DAY BY HOURS", 1, RED);
  HOURS.forEach(([t, ev], i) => {
    const y = 698 + i * 14;
    text(616, y, t, 1, BLUE);
    text(616 + 78, y, ev, 1, INK);
  });
  // verdict + markets
  sectionBar(792, "THE VERDICT  +  MARKETS & MONEY");
  rect(8, 812, 500, 66, PAPER2);
  frame(8, 812, 500, 66, INK, 1);
  text(14, 818, "THE VERDICT", 1, RED);
  para(14, 830, "A DAY OF FIRE AND FALLING MARKETS. THE DEADLIEST STORY WAS THE BANTEN FACTORY FIRE; THE BIGGEST MARKET STORY WAS JENSEN HUANG'S RETURN TO NVIDIA. COP31 ENDED WITH NO DEAL - THE CLIMATE FIGHT GOES ON WITHOUT ONE.", 1, INK, 78, 9);
  rect(516, 812, 500, 66, PAPER2);
  frame(516, 812, 500, 66, INK, 1);
  text(522, 818, "MARKETS & MONEY", 1, RED);
  para(522, 830, "NVIDIA +31% IN A DAY, ABOUT $1TN ADDED - SENSEX -1,484 (-1.77%) - NIFTY -451 - INDIA OIL BILL +60% TO $16BN - WALL STREET'S WORST WEEK SINCE COVID.", 1, INK, 78, 9);
  // also list
  sectionBar(884, "ALSO ON 24 NOVEMBER - 22 MORE STORIES");
  ALSO.forEach((item, i) => {
    const col = Math.floor(i / 6), row = i % 6;
    const x = 12 + col * 254;
    const y = 906 + row * 13;
    text(x, y, String(i + 15) + ".", 1, RED);
    text(x + 22, y, item, 1, INK);
  });
  // footer
  rect(8, 984, 1008, 2, INK);
  text(8, 992, "DATE CHECK: EVERY STORY ABOVE HAPPENED OR WAS FIRST REPORTED ON TUESDAY 24 NOVEMBER 2026.", 1, RED);
  text(8, 1004, "HOW SURE ARE WE?  REPORTED = CONFIRMED BY SEVERAL OUTLETS  -  CLAIM = ONE SIDE'S CLAIM  -  FORECAST = SCHEDULED OR EXPECTED.", 1, INKSOFT);
  text(8, 1014, "SOURCES: AP - REUTERS - BBC - THE GUARDIAN - THE TIMES OF INDIA - NYT - WSJ - OXFAM - NAVAL NEWS.  THE WORLD IN ONE DAY - 24 NOV 2026.", 1, INKSOFT);
}

function main() {
  build();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  const buf = encodePNG();
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, buf);
  // Output validation gate: re-read the file just written and verify it is
  // a valid 1024x1024 PNG within the 1 MiB size limit before reporting success.
  const written = fs.readFileSync(outPath);
  if (written.length > 1048576) throw new Error(`entry.png too large: ${written.length} bytes (limit 1048576)`);
  const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (written[i] !== PNG_MAGIC[i]) throw new Error(`entry.png has bad PNG magic byte at offset ${i}`);
  }
  if (written.readUInt32BE(16) !== 1024 || written.readUInt32BE(20) !== 1024) {
    throw new Error(`entry.png IHDR dimensions are ${written.readUInt32BE(16)}x${written.readUInt32BE(20)}, expected 1024x1024`);
  }
  console.log("wrote", outPath, buf.length, "bytes");
}
main();
