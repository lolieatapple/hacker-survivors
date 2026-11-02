// Global leaderboard: top 10 by assets, plus the player's own rank.
import { W, H } from '../gfx';
import { drawText } from '../text';
import { input } from '../input';
import { sfx, playMusic } from '../audio';
import { tx } from '../i18n';
import { save } from '../save';
import { fetchBoard, type Board, type Entry } from '../net';
import { usdFull, STAGES } from '../game/economy';
import { panel, type App, type Scene } from './ui';

export class Leaderboard implements Scene {
  private t = 0;
  private board: Board | null = null;
  private failed = false;
  private sel = 0;
  private buttons: { label: () => string; action: () => void }[];

  constructor(private app: App) {
    playMusic('title');
    this.buttons = [
      { label: () => (save.name ? tx('改名', 'Rename') : tx('设置昵称', 'Set Name')), action: () => this.app.rename() },
      { label: () => tx('晒到 X', 'Post to X'), action: () => this.app.share('best') },
    ];
    this.reload();
  }

  /** Called by the app after a rename so the new name shows up. */
  reload() {
    this.board = null;
    this.failed = false;
    fetchBoard(save.playerId)
      .then((b) => { this.board = b; })
      .catch((e) => { console.warn('[leaderboard] load failed:', e); this.failed = true; });
  }

  private btnRect(i: number): [number, number, number, number] { return [W / 2 - 104 + i * 108, H - 22, 100, 17]; }

  update(dt: number) {
    this.t += dt;
    if (input.pressed('Escape') || input.tapIn(2, 2, 40, 14)) { sfx('select'); this.app.toCover(); return; }
    if (input.pressed('ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD')) { this.sel = 1 - this.sel; sfx('select'); }
    if (input.pressed('Enter', 'Space')) { this.buttons[this.sel].action(); return; }
    this.buttons.forEach((b, i) => { if (input.tapIn(...this.btnRect(i))) { this.sel = i; b.action(); } });
  }

  private row(ctx: CanvasRenderingContext2D, e: Entry, y: number) {
    if (e.me) { ctx.fillStyle = '#2a1d3f'; ctx.fillRect(8, y + 1, W - 16, 10); }
    const c = e.me ? '#ffd23f' : e.rank <= 3 ? '#39ff88' : '#c8cde6';
    drawText(ctx, `#${e.rank}`, 34, y, { size: 8, color: c, align: 'right' });
    drawText(ctx, e.name, 42, y, { size: 8, color: c });
    drawText(ctx, e.won ? tx('通关', 'CLEARED') : `${e.cleared}/${STAGES}`, 196, y, { size: 8, color: e.won ? '#ffd23f' : '#9aa3c7', align: 'center' });
    drawText(ctx, usdFull(e.assets), W - 12, y, { size: 8, color: c, align: 'right' });
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#120f22';
    for (let y = 0; y < H; y += 16) ctx.fillRect(0, y, W, 1);
    drawText(ctx, tx('◀ 返回', '◀ BACK'), 4, 4, { size: 8, color: '#5d6690' });
    drawText(ctx, tx('排行榜 · 守住最多资产', 'LEADERBOARD · MOST ASSETS'), W / 2, 4, { size: 12, color: '#39ff88', outline: '#0b0d17', align: 'center' });
    panel(ctx, 6, 20, W - 12, H - 46, '#a3195b');
    drawText(ctx, tx('排名   昵称', 'RANK   NAME'), 14, 24, { size: 8, color: '#5d6690' });
    drawText(ctx, tx('关卡', 'STAGE'), 196, 24, { size: 8, color: '#5d6690', align: 'center' });
    drawText(ctx, tx('资产', 'ASSETS'), W - 12, 24, { size: 8, color: '#5d6690', align: 'right' });
    ctx.fillStyle = '#3a2e5c'; ctx.fillRect(10, 35, W - 20, 1);

    if (this.failed) {
      drawText(ctx, tx('排行榜连不上，稍后再试', 'Leaderboard is offline. Try again later.'), W / 2, 76, { size: 8, color: '#ff4545', align: 'center' });
    } else if (!this.board) {
      drawText(ctx, tx('加载中…', 'Loading…'), W / 2, 76, { size: 8, color: '#9aa3c7', align: 'center' });
    } else if (!this.board.top.length) {
      drawText(ctx, tx('还没有人上榜，快来当第一！', 'No one here yet. Be the first!'), W / 2, 76, { size: 8, color: '#9aa3c7', align: 'center' });
    } else {
      this.board.top.forEach((e, i) => this.row(ctx, e, 38 + i * 10));
      const me = this.board.me;
      if (me && !this.board.top.some((e) => e.me)) {
        drawText(ctx, '…', W / 2, 134, { size: 8, color: '#5d6690', align: 'center' });
        this.row(ctx, me, 143);
      }
    }
    if (!save.name) drawText(ctx, tx('设置昵称后，成绩会自动上榜', 'Set a name and your scores go up automatically'), W / 2, H - 33, { size: 8, color: '#9aa3c7', align: 'center' });

    this.buttons.forEach((b, i) => {
      const [x, y, w, h] = this.btnRect(i), on = i === this.sel;
      panel(ctx, x, y, w, h, on ? '#ffd23f' : '#3a2e5c', on ? '#2a1d3f' : '#110e22');
      drawText(ctx, b.label(), x + w / 2, y + 2, { size: 12, color: on ? '#ffd23f' : '#c8cde6', align: 'center' });
    });
  }
}
