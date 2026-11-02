// Scene contract and small UI widgets drawn in buffer space.
import { drawText, textWidth, type FontSize } from '../text';
import { input } from '../input';
import type { StageResult } from './game';

export interface Scene {
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
}

export type ShareKind = 'progress' | 'dead' | 'won' | 'best';

/** Scene switching plus the run in progress (one run = all 28 stages in a row). */
export interface App {
  toCover(): void;
  newRun(): void;
  /** Play the run's current stage from its checkpoint. */
  play(): void;
  stageCleared(r: StageResult): void;
  /** Applies the death fee to the run and returns the USD lost. */
  stageFailed(): number;
  toLeaderboard(): void;
  share(kind: ShareKind): void;
  /** Ask for a leaderboard nickname, then submit the best score under it. */
  rename(): void;
}

export function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, border = '#ff3d8b', fill = '#0b0a18') {
  ctx.fillStyle = '#05040b';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  // corner notches
  ctx.fillStyle = '#05040b';
  ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + w - 1, y, 1, 1); ctx.fillRect(x, y + h - 1, 1, 1); ctx.fillRect(x + w - 1, y + h - 1, 1, 1);
}

export function dim(ctx: CanvasRenderingContext2D, a = 0.6) {
  ctx.fillStyle = `rgba(4,3,10,${a})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

// Chinese line-break rule: these never start a line.
const NO_LINE_START = /^[，。！？、：；」）…,.!?:;)]/;

/** Wrap text: CJK breaks between any characters, latin words stay whole. */
export function wrap(text: string, size: FontSize, maxW: number): string[] {
  const tokens = text.match(/[\u2e80-\u9fff\uff00-\uffef，。！？、：；「」（）]|[^\s\u2e80-\u9fff\uff00-\uffef，。！？、：；「」（）]+|\s+/g) ?? [];
  const lines: string[] = [];
  let cur: string[] = [];
  const join = (a: string[]) => a.join('').trimEnd();
  for (const tok of tokens) {
    if (cur.length && textWidth(join(cur) + tok, size) > maxW) {
      // Closing marks never start a line: carry the previous token down with them.
      const carry = NO_LINE_START.test(tok) && cur.length > 1 ? [cur.pop() as string] : [];
      lines.push(join(cur));
      cur = tok.trim() ? [...carry, tok] : carry;
    } else cur.push(tok);
  }
  if (join(cur).trim()) lines.push(join(cur));
  return lines;
}

export interface MenuItem { label: string | (() => string); action: () => void; color?: string }

/** Vertical button list with keyboard + tap support. */
export class Menu {
  sel = 0;
  // h = 17: 12px glyphs need about 14px, plus the 1px border
  constructor(public items: MenuItem[], public x: number, public y: number, public w = 110, public h = 17, public gap = 4) {}

  update() {
    if (input.pressed('ArrowUp', 'KeyW')) this.sel = (this.sel + this.items.length - 1) % this.items.length;
    if (input.pressed('ArrowDown', 'KeyS')) this.sel = (this.sel + 1) % this.items.length;
    if (input.pressed('Enter', 'Space')) { this.items[this.sel].action(); return; }
    this.items.forEach((it, i) => {
      if (input.tapIn(this.x - this.w / 2, this.y + i * (this.h + this.gap), this.w, this.h)) { this.sel = i; it.action(); }
    });
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    this.items.forEach((it, i) => {
      const bx = Math.round(this.x - this.w / 2), by = this.y + i * (this.h + this.gap);
      const on = i === this.sel;
      panel(ctx, bx, by, this.w, this.h, on ? '#ffd23f' : '#3a2e5c', on ? '#2a1d3f' : '#110e22');
      const label = typeof it.label === 'function' ? it.label() : it.label;
      drawText(ctx, label, this.x, by + 2, { size: 12, color: it.color ?? (on ? '#ffd23f' : '#c8cde6'), align: 'center' });
      if (on && t % 0.8 < 0.55) drawText(ctx, '▶', bx + 6, by + 2, { size: 12, color: '#ffd23f' });
    });
  }
}
