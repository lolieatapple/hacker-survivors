// Timeline of the 28 hacks. Locked levels open as you clear the previous one.
import { W, H } from '../gfx';
import { drawText } from '../text';
import { input } from '../input';
import { sfx, playMusic } from '../audio';
import { tx, T } from '../i18n';
import { save } from '../save';
import { LEVELS } from '../game/levels';
import { bossSprites } from '../game/art';
import { panel, wrap, type Scene, type App } from './ui';

const COLS = 7;
const CW = 44, CH = 21, GX = 6, GY = 20;

export class LevelSelect implements Scene {
  private t = 0;
  private sel: number;
  private thumbs = LEVELS.map((L) => bossSprites(L.art, L.color).img);

  constructor(private app: App, focus = save.unlocked) {
    this.sel = Math.min(focus, save.unlocked);
    playMusic('title');
  }

  private move(d: number) {
    const n = Math.max(0, Math.min(LEVELS.length - 1, this.sel + d));
    if (n !== this.sel) { this.sel = n; sfx('select'); }
  }

  update(dt: number) {
    this.t += dt;
    if (input.pressed('ArrowLeft', 'KeyA')) this.move(-1);
    if (input.pressed('ArrowRight', 'KeyD')) this.move(1);
    if (input.pressed('ArrowUp', 'KeyW')) this.move(-COLS);
    if (input.pressed('ArrowDown', 'KeyS')) this.move(COLS);
    if (input.pressed('Escape')) { this.app.toCover(); return; }
    if (input.pressed('Enter', 'Space')) this.start();
    for (let i = 0; i < LEVELS.length; i++) {
      const [x, y] = this.cell(i);
      if (input.tapIn(x, y, CW - 2, CH - 2)) {
        if (this.sel === i) this.start();
        else { this.sel = i; sfx('select'); }
      }
    }
    if (input.tapIn(W - 76, H - 24, 70, 17)) this.start();
    if (input.tapIn(2, 2, 30, 14)) this.app.toCover();
  }

  private start() {
    if (this.sel > save.unlocked) { sfx('hurt'); return; }
    sfx('select');
    this.app.play(this.sel);
  }

  private cell(i: number): [number, number] {
    return [GX + (i % COLS) * CW, GY + Math.floor(i / COLS) * CH];
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
    // faint grid backdrop
    ctx.fillStyle = '#120f22';
    for (let x = (-(this.t * 6) % 16); x < W; x += 16) ctx.fillRect(Math.round(x), 0, 1, H);
    for (let y = 0; y < H; y += 16) ctx.fillRect(0, y, W, 1);

    drawText(ctx, tx('◀ 返回', '◀ BACK'), 4, 4, { size: 8, color: '#5d6690' });
    drawText(ctx, tx('28 场黑客攻击 · 选择关卡', '28 HACKS · PICK YOUR BATTLE'), W / 2, 4, { size: 12, color: '#39ff88', outline: '#0b0d17', align: 'center' });

    // timeline connector
    LEVELS.forEach((L, i) => {
      const [x, y] = this.cell(i);
      const locked = i > save.unlocked;
      const cleared = !!save.cleared[i];
      const on = i === this.sel;
      const border = on ? '#ffd23f' : cleared ? '#1e9e5a' : locked ? '#2a2540' : '#a3195b';
      panel(ctx, x, y, CW - 2, CH - 2, border, on ? '#2a1d3f' : '#0e0c1c');
      drawText(ctx, L.date.slice(0, 4), x + 3, y + 1, { size: 8, color: locked ? '#3a3556' : on ? '#ffd23f' : '#c8cde6' });
      drawText(ctx, String(L.id).padStart(2, '0'), x + 3, y + 9, { size: 8, color: locked ? '#3a3556' : L.id === 28 ? '#f3ba2f' : '#5d6690' });
      const th = this.thumbs[i];
      const s = 14 / Math.max(th.width, th.height);
      ctx.globalAlpha = locked ? 0.15 : 1;
      ctx.drawImage(th, x + CW - 19, y + 2, Math.round(th.width * s), Math.round(th.height * s));
      ctx.globalAlpha = 1;
      if (locked) {
        ctx.fillStyle = '#5d6690';
        ctx.fillRect(x + CW - 15, y + 8, 6, 5); ctx.fillRect(x + CW - 14, y + 5, 1, 3); ctx.fillRect(x + CW - 11, y + 5, 1, 3); ctx.fillRect(x + CW - 14, y + 5, 4, 1);
      }
      if (cleared) drawText(ctx, '✓', x + CW - 9, y + 9, { size: 8, color: '#39ff88' });
    });

    // info panel
    const L = LEVELS[this.sel];
    const locked = this.sel > save.unlocked;
    const py = GY + 4 * CH + 2;
    panel(ctx, 6, py, W - 12, H - py - 4, '#ff3d8b');
    drawText(ctx, `${L.date}  ${L.name}`, 12, py + 4, { size: 12, color: '#39ff88' });
    drawText(ctx, tx('被盗 ', 'STOLEN ') + T(L.loss), W - 12, py + 4, { size: 12, color: '#ff4545', align: 'right' });
    let y = py + 19;
    drawText(ctx, tx('Boss：', 'BOSS: ') + T(L.boss) + '  ·  ' + T(L.tag), 12, y, { size: 8, color: '#ff9f1c' }); y += 11;
    for (const ln of wrap(T(L.hint), 8, W - 30).slice(0, 2)) { drawText(ctx, ln, 12, y, { size: 8, color: '#c8cde6' }); y += 10; }
    const best = save.cleared[this.sel];
    if (best) drawText(ctx, tx('最快 ', 'BEST ') + `${Math.floor(best.bestTime / 60)}:${String(Math.floor(best.bestTime % 60)).padStart(2, '0')}`, 12, H - 17, { size: 8, color: '#1e9e5a' });
    if (locked) drawText(ctx, tx('通关上一关解锁', 'Clear the previous level to unlock'), W - 12, H - 19, { size: 8, color: '#5d6690', align: 'right' });
    else {
      panel(ctx, W - 76, H - 24, 70, 17, '#ffd23f', '#2a1d3f');
      drawText(ctx, tx('开始', 'START'), W - 38, H - 22, { size: 12, color: '#ffd23f', align: 'center' });
      if (this.t % 0.9 < 0.6) drawText(ctx, '▶', W - 72, H - 22, { size: 12, color: '#ffd23f' });
    }
  }
}
