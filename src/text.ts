// Pixel text: rasterise Fusion Pixel glyphs at native size, hard-threshold alpha,
// then scale with nearest-neighbour so every glyph stays on the pixel grid.
import { makeCanvas } from './gfx';

export type FontSize = 8 | 12;

export async function loadFonts(): Promise<void> {
  const base = import.meta.env.BASE_URL;
  const faces = [
    new FontFace('FP8', `url(${base}fonts/fusion-pixel-8px.woff2)`),
    new FontFace('FP12', `url(${base}fonts/fusion-pixel-12px.woff2)`),
  ];
  for (const f of faces) {
    await f.load();
    document.fonts.add(f);
  }
}

interface Mask { c: HTMLCanvasElement; adv: number; h: number }
const masks = new Map<string, Mask>();
const tints = new Map<string, HTMLCanvasElement>();

function mask(text: string, size: FontSize): Mask {
  const key = `${size}|${text}`;
  const hit = masks.get(key);
  if (hit) return hit;
  const font = `${size}px FP${size}`;
  const [, probe] = makeCanvas(1, 1);
  probe.font = font;
  const m = probe.measureText(text);
  const adv = Math.round(m.width);
  const asc = Math.ceil(m.fontBoundingBoxAscent);
  const h = asc + Math.ceil(m.fontBoundingBoxDescent);
  const [c, ctx] = makeCanvas(Math.max(1, adv + 1), Math.max(1, h));
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 0, asc);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] >= 128;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  const out = { c, adv, h };
  masks.set(key, out);
  return out;
}

function tinted(text: string, size: FontSize, color: string, scale: number): HTMLCanvasElement {
  const key = `${size}|${color}|${scale}|${text}`;
  const hit = tints.get(key);
  if (hit) return hit;
  const m = mask(text, size);
  const [c, ctx] = makeCanvas(m.c.width * scale, m.c.height * scale);
  ctx.drawImage(m.c, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  tints.set(key, c);
  return c;
}

export function textWidth(text: string, size: FontSize = 12, scale = 1, spacing = 0): number {
  if (spacing === 0) return mask(text, size).adv * scale;
  let w = 0;
  for (const ch of text) w += mask(ch, size).adv * scale + spacing;
  return w - spacing;
}

export interface TextOpts {
  size?: FontSize;
  color?: string;
  scale?: number;
  align?: 'left' | 'center' | 'right';
  outline?: string;
  shadow?: string;
  spacing?: number;
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOpts = {}): number {
  const size = o.size ?? 12;
  const scale = o.scale ?? 1;
  const spacing = o.spacing ?? 0;
  const w = textWidth(text, size, scale, spacing);
  let left = x;
  if (o.align === 'center') left = x - w / 2;
  else if (o.align === 'right') left = x - w;
  left = Math.round(left);
  y = Math.round(y);
  const pieces: [string, number][] = [];
  if (spacing === 0) pieces.push([text, left]);
  else {
    let cx = left;
    for (const ch of text) {
      pieces.push([ch, cx]);
      cx += mask(ch, size).adv * scale + spacing;
    }
  }
  const s = scale;
  const ring = [[-s, -s], [0, -s], [s, -s], [-s, 0], [s, 0], [-s, s], [0, s], [s, s]];
  if (o.shadow) {
    for (const [t, px] of pieces) {
      const img = tinted(t, size, o.shadow, scale);
      for (const [dx, dy] of ring) ctx.drawImage(img, px + dx, y + dy + s);
      ctx.drawImage(img, px, y + 2 * s);
    }
  }
  if (o.outline) {
    for (const [t, px] of pieces) {
      const img = tinted(t, size, o.outline, scale);
      for (const [dx, dy] of ring) ctx.drawImage(img, px + dx, y + dy);
    }
  }
  for (const [t, px] of pieces) ctx.drawImage(tinted(t, size, o.color ?? '#fff', scale), px, y);
  return w;
}

/**
 * Large logo text: vertical colour bands, thick outline, coloured drop shadow.
 * Returns a ready-made canvas so the per-frame cost is one drawImage.
 */
export function buildLogo(text: string, scale: number, bands: string[], outline: string, shadow: string): HTMLCanvasElement {
  const m = mask(text, 12);
  const gw = m.c.width * scale, gh = m.c.height * scale;
  const [fill, fctx] = makeCanvas(gw, gh);
  fctx.drawImage(m.c, 0, 0, gw, gh);
  fctx.globalCompositeOperation = 'source-in';
  // find the inked row range so the bands span the glyphs, not the em box
  let top = m.c.height, bot = 0;
  const [, pctx] = makeCanvas(m.c.width, m.c.height);
  pctx.drawImage(m.c, 0, 0);
  const d = pctx.getImageData(0, 0, m.c.width, m.c.height).data;
  for (let yy = 0; yy < m.c.height; yy++)
    for (let xx = 0; xx < m.c.width; xx++)
      if (d[(yy * m.c.width + xx) * 4 + 3]) { top = Math.min(top, yy); bot = Math.max(bot, yy); }
  // paint bands on their own layer, then mask once (source-in per row would erase earlier rows)
  const [bandLayer, bctx] = makeCanvas(gw, gh);
  for (let yy = 0; yy < m.c.height; yy++) {
    const t = Math.min(1, Math.max(0, (yy - top) / Math.max(1, bot - top)));
    bctx.fillStyle = bands[Math.min(bands.length - 1, Math.floor(t * bands.length))];
    bctx.fillRect(0, yy * scale, gw, scale);
  }
  fctx.drawImage(bandLayer, 0, 0);
  // per-glyph-pixel bevel: light top-left pixel on each font pixel
  fctx.globalCompositeOperation = 'source-atop';
  fctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let yy = 0; yy < m.c.height; yy++)
    for (let xx = 0; xx < m.c.width; xx++)
      if (d[(yy * m.c.width + xx) * 4 + 3] && !d[((yy - 1) * m.c.width + xx) * 4 + 3])
        fctx.fillRect(xx * scale, yy * scale, scale, 1);

  const o = scale; // outline thickness = one font pixel
  const sh = scale; // shadow drop
  const [out, octx] = makeCanvas(gw + o * 2, gh + o * 2 + sh * 2);
  const sil = (color: string) => {
    const [c, cx] = makeCanvas(gw, gh);
    cx.drawImage(m.c, 0, 0, gw, gh);
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = color;
    cx.fillRect(0, 0, gw, gh);
    return c;
  };
  const shadowSil = sil(shadow), outlineSil = sil(outline);
  for (let dy = -o; dy <= o; dy += o)
    for (let dx = -o; dx <= o; dx += o) octx.drawImage(shadowSil, o + dx, o + dy + sh * 2);
  for (let dy = -o; dy <= o; dy += o)
    for (let dx = -o; dx <= o; dx += o) octx.drawImage(outlineSil, o + dx, o + dy);
  octx.drawImage(fill, o, o);
  return out;
}
