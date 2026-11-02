// First-launch language picker. Its first tap also unlocks audio.
import { W, H } from '../gfx';
import { drawText } from '../text';
import { sfx } from '../audio';
import { setLang, type Lang } from '../i18n';
import { save, persist } from '../save';
import { Menu, type Scene } from './ui';

export class LangSelect implements Scene {
  private t = 0;
  private menu: Menu;
  private rain: { x: number; y: number; s: number; c: string }[] = [];

  constructor(onDone: () => void) {
    const pick = (l: Lang) => { setLang(l); save.lang = l; persist(); sfx('select'); onDone(); };
    this.menu = new Menu([
      { label: '中文', action: () => pick('zh') },
      { label: 'English', action: () => pick('en') },
    ], W / 2, 92, 120, 18, 8);
    for (let x = 4; x < W; x += 9) this.rain.push({ x, y: Math.random() * H, s: 10 + Math.random() * 25, c: '0123456789abcdef'[Math.floor(Math.random() * 16)] });
  }

  update(dt: number) {
    this.t += dt;
    for (const r of this.rain) { r.y += r.s * dt; if (r.y > H) { r.y = -8; r.c = '0123456789abcdef'[Math.floor(Math.random() * 16)]; } }
    this.menu.update();
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.25;
    for (const r of this.rain) drawText(ctx, r.c, r.x, Math.round(r.y), { size: 8, color: '#1e9e5a' });
    ctx.globalAlpha = 1;
    drawText(ctx, '黑客幸存者', W / 2, 22, { size: 12, color: '#39ff88', outline: '#0b0d17', align: 'center', scale: 2 });
    drawText(ctx, 'HACKER SURVIVORS', W / 2, 50, { size: 12, color: '#29d3ff', outline: '#0b0d17', align: 'center', spacing: 2 });
    drawText(ctx, '选择语言  ·  CHOOSE LANGUAGE', W / 2, 72, { size: 8, color: '#9aa3c7', align: 'center' });
    this.menu.draw(ctx, this.t);
    drawText(ctx, '可在封面右上角切换 · Switch anytime on the title screen', W / 2, H - 14, { size: 8, color: '#5d6690', align: 'center' });
  }
}
