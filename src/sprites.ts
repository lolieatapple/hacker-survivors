import { sprite, silhouette, makeCanvas, bayer, mulberry32 } from './gfx';

// ---------- hero: hooded hacker holding a laptop ----------
const HERO_TOP = [
  '....kkkkkk....',
  '..kkHHHHHHkk..',
  '.kHHHHHHHHHHk.',
  '.kHHhhhhhhHHk.',
  'kHHhkkkkkkhHHk',
  'kHhkddddddkhHk',
  'kHhkggGGggkhHk',
  'kHhkddddddkhHk',
  'kHHhkddddkhHHk',
  '.kHHhkkkkhHHk.',
  'kHHHHwHHwHHHHk',
  'kHHkkkkkkkkHHk',
  'kHskllggllksHk',
  'kHskllllllksHk',
  'kHHkkkkkkkkHHk',
  '.kHHHHHHHHHHk.',
];
export const HERO = [
  sprite('hero0', [...HERO_TOP, '..kddk..kddk..', '.kllkk..kkllk.']),
  sprite('hero1', [...HERO_TOP, '..kddk..kddk..', '..kllk..kllk..']),
];

// ---------- enemies ----------
// 假空投: a mimic gift box (phishing / fake airdrop)
export const AIRDROP = sprite('airdrop', [
  '.kyk..kyk.',
  '.kyykkyyk.',
  'kkkkyykkkk',
  'kmmmyymmmk',
  'kmwkyykwmk',
  'kkkkkkkkkk',
  'kwkwyywkwk',
  'kMMMyyMMMk',
  'kMMMyyMMMk',
  'kkkkkkkkkk',
]);
// Rug pull: a flying carpet with eyes
export const RUG = sprite('rug', [
  '.kkkkkkkkkkkk.',
  'lkrRrRrRrRrRkl',
  '.krywrrrrwyrk.',
  'lkrykrrrrkyrkl',
  '.krRrRmmRrRrk.',
  'lkrRrRrRrRrRkl',
  '.kkkkkkkkkkkk.',
]);
// Wallet drainer ghost
export const DRAINER = sprite('drainer', [
  '...kkkk...',
  '.kkwwwwkk.',
  'kwwwwwwwlk',
  'kwkkwwkklk',
  'kwkrwwkrlk',
  'kwwwwwwwlk',
  'kwwkrrklLk',
  'kwwwwwllLk',
  'kwlkwlkLLk',
  'kk.kk.kk.k',
]);
// Exploit bug (smart-contract bug)
export const BUG = sprite('bug', [
  '.k.....k.',
  '..k...k..',
  '.kkkkkkk.',
  'kRrrkrrRk',
  'kryrkryrk',
  'kRrrkrrRk',
  '.kRrkrRk.',
  'k.kkkkk.k',
]);

export interface EnemyDef { img: HTMLCanvasElement; flash: HTMLCanvasElement; hp: number; speed: number; colors: string[] }
function enemy(img: HTMLCanvasElement, hp: number, speed: number, colors: string[]): EnemyDef {
  return { img, flash: silhouette(img, '#ffffff'), hp, speed, colors };
}
export const ENEMIES: EnemyDef[] = [
  enemy(AIRDROP, 2, 14, ['#ff3d8b', '#ffd23f']),
  enemy(RUG, 3, 11, ['#ff4545', '#ffd23f']),
  enemy(DRAINER, 1, 18, ['#f4f4f8', '#9aa3c7']),
  enemy(BUG, 1, 22, ['#ff4545', '#9e1b2b']),
];

// ---------- pickups / weapons ----------
export const GEM = sprite('gem', [
  '..k..',
  '.kck.',
  'kcwbk',
  'kbbBk',
  '.kBk.',
  '..k..',
]);
export const COLD_WALLET = sprite('coldwallet', [
  'kkkkk',
  'kllLk',
  'kgggk',
  'kllLk',
  'klwlk',
  'kkkkk',
]);

// ---------- background set pieces (procedural) ----------

/** Hooded giant with raised claws: the boss looming on the skyline. */
export function buildBoss(): { img: HTMLCanvasElement; eyes: [number, number][] } {
  const w = 72, h = 74;
  const cx = 36;
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const hood = ((x - cx) / 14) ** 2 + ((y - 22) / 17) ** 2 <= 1 && y >= 6;
    const peak = y >= 0 && y < 10 && Math.abs(x - cx) <= y * 1.3;
    const cloak = y >= 30 && Math.abs(x - cx) <= Math.min(35, 14 + (y - 30) * 0.85);
    // arms raised outward with claws
    const arm = (ax: number, dir: number) => {
      for (let i = 0; i <= 20; i++) {
        const px = ax + dir * i * 0.75, py = 42 - i;
        if (Math.abs(x - px) <= 2 && Math.abs(y - py) <= 2) return true;
      }
      const hx = ax + dir * 15, hy = 22;
      for (const f of [-4, 0, 4]) {
        for (let i = 0; i < 6; i++) {
          if (Math.round(hx + dir * (f / 2 + i * 0.35) + f * 0.4) === x && Math.round(hy - i) === y) return true;
        }
      }
      return false;
    };
    return hood || peak || cloak || arm(cx - 14, -1) || arm(cx + 14, 1);
  };
  const [c, ctx] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1);
      let col = '#140a22';
      if (rim) col = '#7a2040';
      else if (((x - cx) / 7) ** 2 + ((y - 24) / 8) ** 2 <= 1) col = '#030206';
      else if (y > 36 && (x + y * 2) % 11 === 0 && bayer(x, y) < 0.6) col = '#22123a';
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return { img: c, eyes: [[cx - 5, 23], [cx + 2, 23]] };
}

export function buildMoon(r: number): HTMLCanvasElement {
  const pad = 4;
  const size = r * 2 + pad * 2 + 1;
  const [c, ctx] = makeCanvas(size, size);
  const o = r + pad;
  const craters: [number, number, number][] = [[-8, -6, 4], [6, 4, 5], [-3, 10, 3], [10, -9, 2], [-12, 5, 2]];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - o, dy = y - o;
      const d = Math.hypot(dx, dy);
      if (d > r + pad) continue;
      if (d > r) {
        // dithered halo
        const t = 1 - (d - r) / pad;
        if (bayer(x, y) < t * 0.5) { ctx.fillStyle = '#4a1230'; ctx.fillRect(x, y, 1, 1); }
        continue;
      }
      const light = (dx * 0.6 - dy * 0.8) / r; // lit from upper right
      let col = '#d8404c';
      if (light < -0.35) col = bayer(x, y) < 0.5 ? '#8e1f33' : '#b0303f';
      else if (light < 0.05) col = bayer(x, y) < 0.35 ? '#b0303f' : '#d8404c';
      else if (light > 0.65) col = '#f06a6a';
      for (const [cx, cy, cr] of craters) {
        const cd = Math.hypot(dx - cx, dy - cy);
        if (cd <= cr) col = cd > cr - 1 && dx - cx > 0 ? '#f06a6a' : '#a02a3a';
      }
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** A crashing candlestick chart. */
export function buildCandles(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(70, 70);
  const rnd = mulberry32(7);
  let price = 12;
  for (let i = 0; i < 11; i++) {
    const up = i === 3 || i === 7;
    const move = up ? -(2 + rnd() * 4) : 3 + rnd() * 5;
    const open = price, close = price + move;
    const top = Math.min(open, close), bot = Math.max(open, close);
    const x = 2 + i * 6;
    ctx.fillStyle = up ? '#2fbf71' : '#d8344a';
    ctx.fillRect(x + 1, Math.round(top - 2 - rnd() * 3), 1, Math.round(bot - top + 5 + rnd() * 3)); // wick
    ctx.fillRect(x, Math.round(top), 3, Math.max(2, Math.round(bot - top)));
    price = close;
  }
  return c;
}

export interface Skyline { img: HTMLCanvasElement; beacons: [number, number][]; windows: [number, number, string][] }
export function buildSkyline(width: number, height: number): Skyline {
  const [c, ctx] = makeCanvas(width, height);
  const rnd = mulberry32(42);
  const beacons: [number, number][] = [];
  const windows: [number, number, string][] = [];
  const lit = ['#ffd23f', '#29d3ff', '#ff3d8b', '#ffd23f'];
  let x = -4;
  while (x < width) {
    const bw = 9 + Math.floor(rnd() * 16);
    const bh = 8 + Math.floor(rnd() * (height - 12));
    const top = height - bh;
    ctx.fillStyle = '#0d0f22';
    ctx.fillRect(x, top, bw, bh);
    ctx.fillStyle = '#1c1f3d';
    ctx.fillRect(x, top, 1, bh);
    ctx.fillRect(x, top, bw, 1);
    for (let wy = top + 3; wy < height - 2; wy += 3) {
      for (let wx = x + 2; wx < x + bw - 1; wx += 3) {
        if (rnd() < 0.22) {
          const col = lit[Math.floor(rnd() * lit.length)];
          ctx.fillStyle = col;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(wx, wy, 1, 1);
          ctx.globalAlpha = 1;
          if (rnd() < 0.15) windows.push([wx, wy, col]);
        }
      }
    }
    if (bh > height * 0.6 && rnd() < 0.7) {
      const ax = x + Math.floor(bw / 2);
      ctx.fillStyle = '#1c1f3d';
      ctx.fillRect(ax, top - 5, 1, 5);
      beacons.push([ax, top - 6]);
    }
    x += bw + (rnd() < 0.3 ? 1 : 0);
  }
  return { img: c, beacons, windows };
}
