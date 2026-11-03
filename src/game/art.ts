// In-game art: extra enemies, pickups, upgrade icons, and procedural bosses.
import { sprite, silhouette, makeCanvas, hexToRgb } from '../gfx';
import type { BossArt } from './levels';

export const NINJA = sprite('ninja', [
  '..kkkkkk..',
  '.kddddddk.',
  'kddddddddk',
  'kdkkkkkkdk',
  'kdkrkkrkdk',
  'kddddddddk',
  '.kRRRRRRk.',
  'kddddddddR',
  'kdkddddkdk',
  '.kdk..kdk.',
  '.kk....kk.',
]);
export const BOT = sprite('bot', [
  '....ky....',
  '....kk....',
  '.kkkkkkkk.',
  'kLllllllLk',
  'kLckllckLk',
  'kLllllllLk',
  'kLkkkkkkLk',
  '.kLLkkLLk.',
  '.kk....kk.',
]);
export const WHALE = sprite('whale', [
  '......kkkk......',
  '....kkBBBBkk....',
  '..kkBBbbbbBBkk..',
  '.kBBbbbbbbbbBBk.',
  'kBbbwkbbbbbbbbBk',
  'kBbbkkbbbbbbbbBk',
  'kBbbbbbbbbbbbbBk',
  '.kBwwwwwwwwwwBk.',
  '..kkBBBBBBBBkk..',
  '....kkkkkkkk....',
]);

// Stage 4+: keeps its distance and fires phishing hooks.
export const PHISHER = sprite('phisher', [
  '...kkkk...',
  '..kmmmmk..',
  '.kmwwwwmk.',
  'kmwkwwkwmk',
  'kmwwwwwwmk',
  'kmmwkkwmmk',
  '.kmmmmmmk.',
  '..kk..kk..',
  '...kyyk...',
  '....kyk...',
]);
// Stage 7+: MEV sandwich bot. Locks on, winds up, then dashes through you.
export const MEV = sprite('mev', [
  '..kkkkkk..',
  '.kooooook.',
  'kowkoowkok',
  'kggggggggk',
  'krrrrrrrrk',
  'kyyyyyyyyk',
  '.kOOOOOOk.',
  '..kkkkkk..',
]);
// Stage 13+: Lazarus agent. Fast, tough, hits hard.
export const LAZARUS = sprite('lazarus', [
  '....kkkk....',
  '...khhhhk...',
  '..khHHHHhk..',
  '..khkkkkhk..',
  '..kkrkkrkk..',
  '..khkkkkhk..',
  '.khhhhhhhhk.',
  'khHhrrrrhHhk',
  'khhhhhhhhhhk',
  '.khhk..khhk.',
  '.kkk....kkk.',
]);

export const USDT = sprite('usdt', [
  '.kkkkk.',
  'kGgggGk',
  'kgwwwgk',
  'kggwggk',
  'kggwggk',
  'kGgggGk',
  '.kkkkk.',
]);
export const BTC = sprite('btc', [
  '.kkkkk.',
  'kowwook',
  'kowowok',
  'kowwook',
  'kowowok',
  'kowwook',
  '.kkkkk.',
]);
export const CHEST = sprite('chest', [
  '.kkkkkkk.',
  'kyOOyOOyk',
  'kOOOyOOOk',
  'kkkkykkkk',
  'kOOOwOOOk',
  'kOOOyOOOk',
  'kyOOyOOyk',
  '.kkkkkkk.',
]);
export const KEY = sprite('key', [
  '..kkk..',
  '.kyyyk.',
  '.kykyk.',
  '.kyyyk.',
  '..kyk..',
  '..kyyk.',
  '..kyk..',
  '..kkk..',
]);
export const MINE = sprite('mine', [
  '.kkk.',
  'kRrRk',
  'krwrk',
  'kRrRk',
  '.kkk.',
]);

const GEM_ROWS = ['..k..', '.kck.', 'kcwbk', 'kbbBk', '.kBk.', '..k..'];
export const GEMS = {
  blue: sprite('gem1', GEM_ROWS),
  green: sprite('gem5', GEM_ROWS.map((r) => r.replace(/c/g, 'g').replace(/b/g, 'g').replace(/B/g, 'G'))),
  red: sprite('gem20', GEM_ROWS.map((r) => r.replace(/c/g, 'm').replace(/b/g, 'r').replace(/B/g, 'R'))),
};
export const FAKE_GEM = sprite('fakegem', GEM_ROWS.map((r) => r.replace(/c/g, 'r').replace(/b/g, 'r').replace(/B/g, 'R').replace(/w/g, 'y')));

// ---------- upgrade icons (9x9) ----------
export const ICONS: Record<string, HTMLCanvasElement> = {
  bolt: sprite('i-bolt', ['.........', '....kk...', '...kcck..', 'kkkkcwck.', 'kcccwwwck', 'kkkkcwck.', '...kcck..', '....kk...', '.........']),
  orbit: sprite('i-orbit', ['.........', '..kkkkk..', '..kllLk..', '..kgggk..', '..kllLk..', '..klwlk..', '..kkkkk..', '.........', '.........']),
  aura: sprite('i-aura', ['...ggg...', '.gg...gg.', '.g.....g.', 'g...w...g', 'g..www..g', 'g...w...g', '.g.....g.', '.gg...gg.', '...ggg...']),
  laser: sprite('i-laser', ['.........', '.........', 'kkk......', 'kRkrrrrrr', 'kmkwwwwww', 'kRkrrrrrr', 'kkk......', '.........', '.........']),
  storm: sprite('i-storm', ['.....kk..', '....kyk..', '...kyk...', '..kyyyyk.', '..kkkyk..', '....kyk..', '...kyk...', '...kk....', '.........']),
  mine: sprite('i-mine', ['....kk...', '...k.yk..', '..kkkk...', '.kRRRRk..', 'kRrrrrRk.', 'kRrwrrRk.', 'kRrrrrRk.', '.kRRRRk..', '..kkkk...']),
  hp: sprite('i-hp', ['.........', '.kk...kk.', 'krrk.krrk', 'krwrkrrrk', 'krrrrrrrk', '.krrrrrk.', '..krrrk..', '...krk...', '....k....']),
  armor: sprite('i-armor', ['.kkkkkkk.', 'kcccccCCk', 'kcwccCCCk', 'kcccccCCk', 'kcccccCCk', '.kcccCCk.', '.kccCCCk.', '..kcCCk..', '...kkk...']),
  speed: sprite('i-speed', ['.........', 'kk..kk...', 'kgk.kgk..', '.kgk.kgk.', '..kgk.kgk', '.kgk.kgk.', 'kgk.kgk..', 'kk..kk...', '.........']),
  power: sprite('i-power', ['.k.k.k.k.', 'kkkkkkkkk', '.kppppPk.', 'kkpwwpPkk', '.kpwwpPk.', 'kkppppPkk', '.kPPPPPk.', 'kkkkkkkkk', '.k.k.k.k.']),
  haste: sprite('i-haste', ['..kkkkk..', '.kwwwwwk.', 'kwwwkwwwk', 'kwwwkwwwk', 'kwwwkkkwk', 'kwwwwwwwk', 'kwwwwwwwk', '.kwwwwwk.', '..kkkkk..']),
  magnet: sprite('i-magnet', ['.........', '.kkk.kkk.', '.kwk.kwk.', '.krk.kck.', '.krkkkck.', '.krrrcck.', '..krrck..', '...kkk...', '.........']),
  regen: sprite('i-regen', ['.........', '..kkkkk..', '.kyyyyyk.', '.kOOOOOk.', '.kyyyyyk.', '.kOOOOOk.', '.kyyyyyk.', '.kOOOOOk.', '..kkkkk..']),
  heal: sprite('i-heal', ['.........', '.kkkkkkk.', '.kGgggGk.', '.kgwwwgk.', '.kggwggk.', '.kggwggk.', '.kGgggGk.', '.kkkkkkk.', '.........']),
};

// ---------- procedural bosses ----------
type Painter = {
  rect(x: number, y: number, w: number, h: number, c: string): void;
  ell(cx: number, cy: number, rx: number, ry: number, c: string): void;
  px(x: number, y: number, c: string): void;
};

function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  const k = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${k(r)},${k(g)},${k(b)})`;
}

function proc(w: number, h: number, paint: (p: Painter) => void): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w + 2, h + 2);
  const p: Painter = {
    rect: (x, y, rw, rh, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(rw), Math.round(rh)); },
    ell: (cx, cy, rx, ry, col) => {
      ctx.fillStyle = col;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) ctx.fillRect(x + 1, y + 1, 1, 1);
    },
    px: (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, 1, 1); },
  };
  paint(p);
  // auto outline
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < c.width && y < c.height && d[(y * c.width + x) * 4 + 3] > 0;
  const edge: number[] = [];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push(x, y);
  ctx.fillStyle = '#0b0d17';
  for (let i = 0; i < edge.length; i += 2) ctx.fillRect(edge[i], edge[i + 1], 1, 1);
  return c;
}

function eyes(p: Painter, cx: number, y: number, gap: number, col = '#ff3030') {
  p.rect(cx - gap - 2, y, 3, 2, col);
  p.rect(cx + gap, y, 3, 2, col);
  p.px(cx - gap - 1, y, '#ffd0c0');
  p.px(cx + gap + 1, y, '#ffd0c0');
}

export function bossArt(kind: BossArt, color: string): HTMLCanvasElement {
  const c0 = color, cD = shade(color, -0.45), cL = shade(color, 0.4);
  switch (kind) {
    case 'vault': return proc(30, 30, (p) => {
      p.rect(0, 2, 30, 26, cD); p.rect(1, 3, 28, 24, c0); p.rect(1, 3, 28, 2, cL);
      p.ell(15, 15, 9, 9, cD); p.ell(15, 15, 7, 7, shade(c0, 0.15));
      for (let a = 0; a < 6; a++) { const t = (a / 6) * Math.PI * 2; p.rect(15 + Math.cos(t) * 5, 15 + Math.sin(t) * 5, 2, 2, '#ffd23f'); }
      p.ell(15, 15, 2, 2, '#ffd23f');
      eyes(p, 15, 7, 6);
      for (let x = 3; x < 28; x += 3) { p.px(x, 26, '#f4f4f8'); p.px(x + 1, 25, '#f4f4f8'); }
      p.rect(2, 28, 4, 2, cD); p.rect(24, 28, 4, 2, cD);
    });
    case 'slime': return proc(30, 24, (p) => {
      p.ell(15, 15, 15, 9, cD); p.ell(15, 13, 14, 9, c0); p.ell(11, 9, 5, 3, cL);
      p.ell(15, 5, 4, 5, c0);
      eyes(p, 15, 12, 4, '#0b0d17');
      p.px(10, 12, '#ffffff'); p.px(19, 12, '#ffffff');
      p.rect(11, 17, 8, 2, '#0b0d17'); p.rect(12, 17, 1, 1, '#f4f4f8'); p.rect(17, 17, 1, 1, '#f4f4f8');
      for (let x = 2; x < 28; x += 5) p.ell(x, 22, 2, 2, cD);
    });
    case 'duo': return proc(16, 22, (p) => {
      p.ell(8, 6, 6, 6, cD); p.ell(8, 6, 5, 5, c0);
      p.ell(8, 7, 3, 3, '#05030a'); p.px(6, 7, '#ff3030'); p.px(9, 7, '#ff3030');
      p.rect(2, 11, 12, 9, c0); p.rect(2, 11, 12, 2, cL); p.rect(6, 13, 4, 4, '#f7931a');
      p.rect(3, 20, 3, 2, cD); p.rect(10, 20, 3, 2, cD);
    });
    case 'bomb': return proc(28, 30, (p) => {
      p.ell(14, 17, 13, 13, '#1b2140'); p.ell(12, 14, 9, 9, '#2c3566'); p.ell(9, 10, 3, 3, '#5d6690');
      p.rect(11, 1, 6, 5, '#5d6690'); p.rect(15, 0, 2, 2, '#ffd23f'); p.px(17, 0, '#ff4545');
      p.ell(14, 18, 5, 4, '#f4f4f8'); p.rect(11, 17, 2, 2, '#0b0d17'); p.rect(16, 17, 2, 2, '#0b0d17');
      p.rect(12, 22, 5, 2, '#f4f4f8'); p.px(13, 22, '#0b0d17'); p.px(15, 22, '#0b0d17');
      p.rect(4, 26, 20, 1, c0);
    });
    case 'hood': case 'final': {
      const s = kind === 'final' ? 1.5 : 1;
      return proc(Math.round(34 * s), Math.round(36 * s), (p) => {
        const cx = 17 * s;
        p.ell(cx, 22 * s, 16 * s, 14 * s, cD);
        p.ell(cx, 12 * s, 10 * s, 11 * s, cD);
        p.ell(cx, 12 * s, 9 * s, 10 * s, c0);
        for (let y = 0; y < 5 * s; y++) p.rect(cx - y * 0.8, y + 1, y * 1.6 + 1, 1, c0);
        p.ell(cx, 14 * s, 6 * s, 6 * s, '#05030a');
        eyes(p, Math.round(cx), Math.round(13 * s), Math.round(2 * s));
        p.rect(cx - 12 * s, 22 * s, 24 * s, 2 * s, cL);
        p.rect(cx - 2 * s, 24 * s, 4 * s, 8 * s, '#05030a');
        p.rect(1, 18 * s, 4 * s, 6 * s, c0); p.rect(29 * s, 18 * s, 4 * s, 6 * s, c0);
        if (kind === 'final') {
          for (let i = 0; i < 5; i++) p.rect(cx - 10 + i * 5, 0, 3, 4, '#ffd23f');
          p.rect(cx - 11, 3, 24, 2, '#ffd23f');
        }
      });
    }
    case 'portal': return proc(32, 32, (p) => {
      p.ell(16, 16, 15, 15, cD); p.ell(16, 16, 13, 13, c0); p.ell(16, 16, 10, 10, cD); p.ell(16, 16, 8, 8, '#05030a');
      p.ell(16, 16, 5, 4, '#f4f4f8'); p.ell(16, 16, 2, 3, '#ff3030'); p.px(16, 15, '#0b0d17');
      for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; p.rect(16 + Math.cos(t) * 13, 16 + Math.sin(t) * 13, 2, 2, cL); }
    });
    case 'tower': return proc(26, 36, (p) => {
      p.rect(3, 6, 20, 28, cD); p.rect(4, 6, 18, 28, c0); p.rect(4, 6, 2, 28, cL);
      p.rect(11, 0, 4, 6, cD); p.px(12, 0, '#ff4545');
      for (let y = 18; y < 31; y += 3) for (let x = 7; x < 20; x += 3) p.px(x, y, '#ffd23f');
      p.rect(6, 9, 14, 6, '#05030a'); eyes(p, 13, 11, 3);
      p.rect(2, 34, 6, 2, cD); p.rect(18, 34, 6, 2, cD);
    });
    case 'oracle': return proc(32, 28, (p) => {
      p.ell(16, 14, 15, 6, cD); p.ell(16, 14, 14, 5, c0);
      p.ell(16, 13, 9, 9, cD); p.ell(16, 13, 8, 8, '#f4f4f8'); p.ell(16, 13, 4, 4, c0); p.ell(16, 13, 2, 2, '#05030a');
      p.px(14, 11, '#ffffff');
      p.rect(15, 0, 2, 4, cD); p.rect(13, 0, 6, 1, cL);
      for (let i = 0; i < 4; i++) p.rect(4 + i * 7, 22, 2, 5, cD);
    });
  }
}

export interface BossSprites { img: HTMLCanvasElement; flash: HTMLCanvasElement }
export function bossSprites(kind: BossArt, color: string): BossSprites {
  const img = bossArt(kind, color);
  return { img, flash: silhouette(img, '#ffffff') };
}

/** A chain node for the final level: a hexagon in the chain's colour. */
export function chainNode(color: string): HTMLCanvasElement {
  return proc(14, 14, (p) => {
    for (let y = 0; y < 14; y++) {
      const inset = Math.abs(y - 6.5) > 3.5 ? Math.round(Math.abs(y - 6.5) - 3.5) * 2 : 0;
      p.rect(inset, y, 14 - inset * 2, 1, shade(color, -0.35));
    }
    for (let y = 1; y < 13; y++) {
      const inset = Math.abs(y - 6.5) > 3.5 ? Math.round(Math.abs(y - 6.5) - 3.5) * 2 + 1 : 1;
      p.rect(inset, y, 14 - inset * 2, 1, color);
    }
    p.rect(4, 5, 6, 4, '#0b0d17');
    p.rect(5, 6, 1, 2, '#ff3030'); p.rect(8, 6, 1, 2, '#ff3030');
    p.rect(3, 2, 4, 1, shade(color, 0.5));
  });
}

/** Price-oracle orb (Mango level). */
export const ORACLE_ORB = sprite('oracle-orb', [
  '...kkkkk...',
  '..kyyyyyk..',
  '.kyyyyyyyk.',
  'kyyyykgkyyk',
  'kyyykgggkyk',
  'kyykgggggkk',
  'kyyyykgkyyk',
  'kyyyykgkyyk',
  '.kyyyyyyyk.',
  '..kyyyyyk..',
  '...kkkkk...',
]);

/** Nearest-neighbour half-size copy (for recursive split children). */
export function shrink(img: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(Math.ceil(img.width / 2), Math.ceil(img.height / 2));
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
