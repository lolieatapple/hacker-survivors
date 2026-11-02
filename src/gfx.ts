// Low-level pixel helpers shared by every scene.

export const W = 320;
export const H = 180;

export const PAL: Record<string, string> = {
  k: '#0b0d17', // outline black
  d: '#1b2140', // dark navy
  n: '#2c3566', // navy
  g: '#39ff88', // neon green
  G: '#1e9e5a', // dark green
  c: '#29d3ff', // cyan
  C: '#1670a8', // dark cyan
  m: '#ff3d8b', // magenta
  M: '#a3195b', // dark magenta
  r: '#ff4545', // red
  R: '#9e1b2b', // dark red
  o: '#f7931a', // btc orange
  O: '#a85a00', // dark orange
  y: '#ffd23f', // yellow
  w: '#f4f4f8', // white
  l: '#9aa3c7', // light gray
  L: '#5d6690', // gray
  s: '#f2c29b', // skin
  S: '#c98a64', // skin shadow
  p: '#8a5cd6', // purple
  P: '#4a2c80', // dark purple
  h: '#2a2f45', // hoodie dark
  H: '#444b6e', // hoodie mid
  b: '#627eea', // eth blue
  B: '#3c4fa8', // dark eth blue
};

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Build a sprite from ASCII rows. '.' is transparent, other chars index PAL. */
export function sprite(name: string, rows: string[]): HTMLCanvasElement {
  const w = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`sprite ${name}: row ${i} has width ${r.length}, expected ${w}`);
  });
  const [c, ctx] = makeCanvas(w, rows.length);
  rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const ch = r[x];
      if (ch === '.') continue;
      const col = PAL[ch];
      if (!col) throw new Error(`sprite ${name}: unknown palette char '${ch}' at ${x},${y}`);
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

/** Solid-colour silhouette of an image (for hit flashes, shadows, outlines). */
export function silhouette(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold in [0,1) for a pixel. */
export function bayer(x: number, y: number): number {
  return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Pixel-exact line (Bresenham). Canvas lines would anti-alias and blur. */
export function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = color;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
