// Keyboard + pointer input. Pointer positions are reported in buffer (320x180) coords.
import { W, H } from './gfx';

export interface Tap { x: number; y: number }

class Input {
  private keys = new Set<string>();
  private edges = new Set<string>();
  taps: Tap[] = [];
  /** virtual joystick (touch / mouse drag) */
  stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  pointer = { x: -1, y: -1 };
  private map = { dx: 0, dy: 0, s: 1 };
  private unlockCbs: (() => void)[] = [];

  setViewport(dx: number, dy: number, s: number) { this.map = { dx, dy, s }; }

  toBuffer(cx: number, cy: number): [number, number] {
    const dpr = window.devicePixelRatio || 1;
    return [(cx * dpr - this.map.dx) / this.map.s, (cy * dpr - this.map.dy) / this.map.s];
  }

  onFirstGesture(cb: () => void) { this.unlockCbs.push(cb); }
  private gesture() {
    const cbs = this.unlockCbs;
    this.unlockCbs = [];
    cbs.forEach((c) => c());
  }

  attach(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return; // typing a nickname, not playing
      if (!this.keys.has(e.code)) this.edges.add(e.code);
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      this.gesture();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.stick.active = false; });
    el.addEventListener('pointerdown', (e) => {
      const [x, y] = this.toBuffer(e.clientX, e.clientY);
      this.taps.push({ x, y });
      if (!this.stick.active) this.stick = { active: true, id: e.pointerId, ox: x, oy: y, x, y };
      el.setPointerCapture(e.pointerId);
      this.gesture();
    });
    el.addEventListener('pointermove', (e) => {
      const [x, y] = this.toBuffer(e.clientX, e.clientY);
      this.pointer = { x, y };
      if (this.stick.active && e.pointerId === this.stick.id) { this.stick.x = x; this.stick.y = y; }
    });
    const end = (e: PointerEvent) => { if (e.pointerId === this.stick.id) this.stick.active = false; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(...codes: string[]) { return codes.some((c) => this.keys.has(c)); }
  pressed(...codes: string[]) { return codes.some((c) => this.edges.has(c)); }
  anyKey() { return this.edges.size > 0; }

  /** Movement vector, length <= 1. */
  axis(): [number, number] {
    let x = 0, y = 0;
    if (this.down('KeyA', 'ArrowLeft')) x -= 1;
    if (this.down('KeyD', 'ArrowRight')) x += 1;
    if (this.down('KeyW', 'ArrowUp')) y -= 1;
    if (this.down('KeyS', 'ArrowDown')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return [x / l, y / l]; }
    if (this.stick.active) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      const l = Math.hypot(dx, dy);
      if (l > 3) { const m = Math.min(1, l / 18); return [(dx / l) * m, (dy / l) * m]; }
    }
    return [0, 0];
  }

  tapIn(x: number, y: number, w: number, h: number): boolean {
    return this.taps.some((t) => t.x >= x && t.x < x + w && t.y >= y && t.y < y + h);
  }

  endFrame() { this.edges.clear(); this.taps = []; }
}

export const input = new Input();
export const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
