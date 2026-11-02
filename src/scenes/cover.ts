// Title screen: an animated attract-mode scene.
import { W, H, makeCanvas, bayer, hexToRgb, line, mulberry32 } from '../gfx';
import { drawText, buildLogo, textWidth } from '../text';
import { panel, Menu, type App, type MenuItem } from './ui';
import { input } from '../input';
import { sfx, playMusic, isMuted } from '../audio';
import { tx, getLang, setLang } from '../i18n';
import { save, persist } from '../save';
import { usdShort, STAGES } from '../game/economy';
import { HERO, ENEMIES, GEM, COLD_WALLET, buildBoss, buildMoon, buildCandles, buildSkyline, type EnemyDef } from '../sprites';

const HORIZON = 98;
const HERO_X = 160, HERO_Y = 128; // feet position

export const BOSS_WAVES: { name: string; year: number; loss: string }[] = [
  { name: 'MT.GOX', year: 2014, loss: '850,000 BTC' },
  { name: 'THE DAO', year: 2016, loss: '3.6M ETH' },
  { name: 'BITFINEX', year: 2016, loss: '119,756 BTC' },
  { name: 'COINCHECK', year: 2018, loss: '$530M NEM' },
  { name: 'POLY NETWORK', year: 2021, loss: '$611M' },
  { name: 'RONIN BRIDGE', year: 2022, loss: '$625M' },
  { name: 'WORMHOLE', year: 2022, loss: '$326M' },
  { name: 'BYBIT', year: 2025, loss: '$1.5B' },
];

interface Enemy { def: EnemyDef; x: number; y: number; hp: number; flash: number; phase: number; dead: boolean }
interface Bullet { x: number; y: number; vx: number; vy: number; life: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }
interface Gem { x: number; y: number; vx: number; vy: number; age: number }
interface Floater { x: number; y: number; text: string; life: number; color: string }

function buildSky(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(W, HORIZON);
  const stops: [number, string][] = [[0, '#05060d'], [40, '#0c0a20'], [72, '#1d1140'], [HORIZON, '#3d1652']];
  const img = ctx.createImageData(W, HORIZON);
  for (let y = 0; y < HORIZON; y++) {
    let i = 0;
    while (i < stops.length - 2 && y > stops[i + 1][0]) i++;
    const [y0, c0] = stops[i], [y1, c1] = stops[i + 1];
    const f = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    // quantise to 4 steps between stops, dither between neighbouring steps
    const steps = 4;
    const q = f * steps;
    const lo = Math.floor(q), frac = q - lo;
    const a = hexToRgb(c0), b = hexToRgb(c1);
    for (let x = 0; x < W; x++) {
      const k = Math.min(steps, lo + (bayer(x, y) < frac ? 1 : 0)) / steps;
      const p = (y * W + x) * 4;
      img.data[p] = a[0] + (b[0] - a[0]) * k;
      img.data[p + 1] = a[1] + (b[1] - a[1]) * k;
      img.data[p + 2] = a[2] + (b[2] - a[2]) * k;
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function buildTicker(): HTMLCanvasElement {
  const segs: [string, string][] = [];
  BOSS_WAVES.forEach((w, i) => {
    segs.push([`WAVE ${String(i + 1).padStart(2, '0')} `, '#ffd23f']);
    segs.push([`${w.name} ${w.year} `, '#f4f4f8']);
    segs.push([`-${w.loss}`, '#ff4545']);
    segs.push(['   //   ', '#a3195b']);
  });
  const total = segs.reduce((s, [t]) => s + textWidth(t, 8), 0);
  const [c, ctx] = makeCanvas(total, 10);
  let x = 0;
  for (const [t, col] of segs) x += drawText(ctx, t, x, 0, { size: 8, color: col });
  return c;
}

export class Cover {
  private t = 0;
  private sky = buildSky();
  private moon = buildMoon(24);
  private boss = buildBoss();
  private candles = buildCandles();
  private skyline = buildSkyline(W, 34);
  private logos = new Map<string, [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement]>();
  private get logoSet(): [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] {
    const lang = getLang();
    let set = this.logos.get(lang);
    if (!set) {
      const [text, scale] = lang === 'zh' ? ['黑客幸存者', 3] : ['HACKER SURVIVORS', 2];
      set = [
        buildLogo(text, scale, ['#d6ffe6', '#7dffb5', '#39ff88', '#39ff88', '#1fcf6d', '#159c55'], '#0b0d17', '#c2185b'),
        buildLogo(text, scale, ['#ff3d8b'], '#ff3d8b', '#ff3d8b'),
        buildLogo(text, scale, ['#29d3ff'], '#29d3ff', '#29d3ff'),
      ];
      this.logos.set(lang, set);
    }
    return set;
  }
  private get logo() { return this.logoSet[0]; }
  private get logoGhostA() { return this.logoSet[1]; }
  private get logoGhostB() { return this.logoSet[2]; }
  private ticker = buildTicker();
  private stars: [number, number, number, string][] = [];
  private rain: { x: number; y: number; speed: number; chars: string[] }[] = [];
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private gems: Gem[] = [];
  private floaters: Floater[] = [];
  private fireCd = 0;
  private glitch = 0;
  private nextGlitch = 2.5;
  private heroHurt = 0;
  private rnd = mulberry32(1337);
  private menu: Menu | null = null;
  constructor(private app: App) {
    playMusic('title');
    const r = mulberry32(99);
    for (let i = 0; i < 70; i++) {
      this.stars.push([Math.floor(r() * W), Math.floor(r() * (HORIZON - 30)), r() * 6.28, r() < 0.2 ? '#29d3ff' : r() < 0.5 ? '#9aa3c7' : '#f4f4f8']);
    }
    const hex = '0123456789abcdef';
    for (let x = 4; x < W; x += 11) {
      if (r() < 0.45) continue;
      const chars = Array.from({ length: 8 }, () => hex[Math.floor(r() * 16)]);
      this.rain.push({ x, y: r() * 140 - 40, speed: 14 + r() * 22, chars });
    }
    for (let i = 0; i < 24; i++) this.spawn(true);
  }

  private spawn(anywhere = false) {
    const r = this.rnd;
    const def = ENEMIES[Math.floor(r() * ENEMIES.length)];
    let x: number, y: number;
    if (anywhere) {
      do {
        x = r() * W; y = HORIZON + 6 + r() * (H - HORIZON - 18);
      } while (Math.hypot(x - HERO_X, (y - HERO_Y) * 2) < 70);
    } else if (r() < 0.75) {
      x = r() < 0.5 ? -14 : W + 14; y = HORIZON + 6 + r() * (H - HORIZON - 18);
    } else {
      x = r() * W; y = H + 12;
    }
    this.enemies.push({ def, x, y, hp: def.hp, flash: 0, phase: r() * 6.28, dead: false });
  }

  private orbitPos(i: number): [number, number] {
    const a = this.t * 2.4 + (i * Math.PI * 2) / 3;
    return [HERO_X + Math.cos(a) * 26, HERO_Y - 6 + Math.sin(a) * 13];
  }

  private kill(e: Enemy) {
    e.dead = true;
    const r = this.rnd;
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.28, s = 20 + r() * 50;
      this.particles.push({ x: e.x, y: e.y - 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: 0, max: 0.35 + r() * 0.4, color: e.def.colors[i % e.def.colors.length] });
    }
    this.gems.push({ x: e.x, y: e.y - 3, vx: (r() - 0.5) * 30, vy: -25, age: 0 });
  }

  private hit(e: Enemy, dmg: number) {
    e.hp -= dmg;
    e.flash = 0.08;
    this.floaters.push({ x: e.x + (this.rnd() - 0.5) * 6, y: e.y - e.def.img.height - 2, text: String(dmg * (7 + Math.floor(this.rnd() * 30))), life: 0.6, color: '#ffd23f' });
    if (e.hp <= 0) this.kill(e);
  }

  update(dt: number) {
    this.t += dt;
    // corner buttons: language + sound (handled before "press anything to start")
    const langTap = input.tapIn(W - 44, 2, 42, 13), muteTap = input.tapIn(W - 80, 2, 34, 13);
    if (langTap || input.pressed('KeyL')) {
      setLang(getLang() === 'zh' ? 'en' : 'zh');
      save.lang = getLang();
      persist();
      sfx('select');
    } else if (muteTap || input.pressed('KeyM')) {
      if (muteTap) window.dispatchEvent(new CustomEvent('toggle-mute'));
    } else if (this.menu) this.menu.update();
    else if (this.t > 0.3 && (input.anyKey() || input.taps.length)) { sfx('select'); this.openMenu(); }
    const r = this.rnd;

    for (const d of this.rain) {
      d.y += d.speed * dt;
      if (d.y > HORIZON + 50) { d.y = -60 - r() * 60; d.chars = d.chars.map(() => '0123456789abcdef'[Math.floor(r() * 16)]); }
    }

    // enemies seek the hero
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      const dx = HERO_X - e.x, dy = HERO_Y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const wob = Math.sin(this.t * 3 + e.phase) * 0.35;
      e.x += ((dx / d) * Math.cos(wob) - (dy / d) * Math.sin(wob)) * e.def.speed * dt;
      e.y += ((dy / d) * Math.cos(wob) + (dx / d) * Math.sin(wob)) * e.def.speed * dt * 0.75;
      e.y = Math.max(HORIZON + 4, e.y);
      if (d < 9) { this.heroHurt = 0.15; this.kill(e); continue; }
      for (let i = 0; i < 3; i++) {
        const [ox, oy] = this.orbitPos(i);
        if (Math.hypot(ox - e.x, oy - (e.y - 4)) < 8 && e.flash <= 0) this.hit(e, 1);
      }
    }

    // auto-fire at the nearest enemy
    this.fireCd -= dt;
    if (this.fireCd <= 0) {
      this.fireCd = 0.16;
      let best: Enemy | null = null, bd = 150;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - HERO_X, e.y - HERO_Y);
        if (d < bd && d > 20) { bd = d; best = e; }
      }
      if (best) {
        const sx = HERO_X, sy = HERO_Y - 9;
        const a = Math.atan2(best.y - 4 - sy, best.x - sx) + (r() - 0.5) * 0.1;
        this.bullets.push({ x: sx, y: sy, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, life: 1.2 });
      }
    }
    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      for (const e of this.enemies) {
        if (e.dead || b.life <= 0) continue;
        if (Math.abs(b.x - e.x) < e.def.img.width / 2 + 1 && b.y > e.y - e.def.img.height - 1 && b.y < e.y + 1) {
          b.life = 0;
          this.hit(e, 1);
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);

    for (const p of this.particles) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; p.vx *= 0.96; }
    this.particles = this.particles.filter((p) => p.life < p.max);

    for (const g of this.gems) {
      g.age += dt;
      if (g.age < 0.5) { g.x += g.vx * dt; g.y += g.vy * dt; g.vy += 90 * dt; g.vx *= 0.92; }
      else {
        const dx = HERO_X - g.x, dy = HERO_Y - 8 - g.y, d = Math.hypot(dx, dy) || 1;
        const s = 40 + (g.age - 0.5) * 220;
        g.x += (dx / d) * s * dt; g.y += (dy / d) * s * dt;
        if (d < 5) g.age = -1;
      }
    }
    this.gems = this.gems.filter((g) => g.age >= 0);

    for (const f of this.floaters) { f.life -= dt; f.y -= 18 * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    this.enemies = this.enemies.filter((e) => !e.dead);
    while (this.enemies.length < 24) this.spawn();

    this.heroHurt = Math.max(0, this.heroHurt - dt);
    this.nextGlitch -= dt;
    if (this.nextGlitch <= 0) { this.glitch = 0.22; this.nextGlitch = 2.5 + r() * 3; }
    this.glitch = Math.max(0, this.glitch - dt);
  }

  draw(ctx: CanvasRenderingContext2D) {
    const t = this.t;
    ctx.drawImage(this.sky, 0, 0);

    for (const [x, y, ph, col] of this.stars) {
      const tw = Math.sin(t * 2 + ph);
      if (tw < -0.6) continue;
      ctx.fillStyle = col;
      ctx.globalAlpha = tw > 0.7 ? 1 : 0.55;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;

    // hex rain
    for (const d of this.rain) {
      d.chars.forEach((ch, i) => {
        const y = Math.round(d.y - i * 7);
        if (y < -8 || y > HORIZON - 4) return;
        ctx.globalAlpha = i === 0 ? 0.55 : 0.32 * (1 - i / d.chars.length);
        drawText(ctx, ch, d.x, y, { size: 8, color: i === 0 ? '#7dffb5' : '#1e9e5a' });
      });
    }
    ctx.globalAlpha = 1;

    // crashing chart (left), moon + boss (right)
    ctx.globalAlpha = 0.6;
    ctx.drawImage(this.candles, 6, 30);
    ctx.globalAlpha = 1;
    const moonX = 282, moonY = 50;
    ctx.drawImage(this.moon, moonX - this.moon.width / 2, moonY - this.moon.height / 2);
    const bx = moonX - this.boss.img.width / 2, by = 30 + Math.round(Math.sin(t * 0.9) * 1.5);
    ctx.drawImage(this.boss.img, bx, by);
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    for (const [ex, ey] of this.boss.eyes) {
      ctx.fillStyle = '#5a0f1c';
      ctx.fillRect(bx + ex - 1, by + ey - 1, 5, 4);
      ctx.fillStyle = pulse > 0.5 ? '#ff3030' : '#c41e2a';
      ctx.fillRect(bx + ex, by + ey, 3, 2);
      ctx.fillStyle = '#ffd0c0';
      ctx.fillRect(bx + ex + 1, by + ey, 1, 1);
    }

    // skyline
    const skyY = HORIZON - this.skyline.img.height;
    ctx.drawImage(this.skyline.img, 0, skyY);
    this.skyline.windows.forEach(([x, y, col], i) => {
      if (Math.sin(t * 1.3 + i * 1.7) > 0.2) { ctx.fillStyle = col; ctx.fillRect(x, skyY + y, 1, 1); }
    });
    this.skyline.beacons.forEach(([x, y], i) => {
      if ((t * 1.5 + i * 0.37) % 1 < 0.5) { ctx.fillStyle = '#ff4545'; ctx.fillRect(x, skyY + y, 1, 1); }
    });

    this.drawFloor(ctx);

    // arena: shadows, then y-sorted actors
    ctx.fillStyle = 'rgba(5,3,12,0.55)';
    for (const e of this.enemies) ctx.fillRect(Math.round(e.x - e.def.img.width / 2 + 1), Math.round(e.y), e.def.img.width - 2, 2);
    ctx.fillRect(HERO_X - 6, HERO_Y, 12, 2);
    this.drawAura(ctx);

    type Draw = { y: number; fn: () => void };
    const list: Draw[] = [];
    for (const e of this.enemies) {
      list.push({ y: e.y, fn: () => {
        const img = e.flash > 0 ? e.def.flash : e.def.img;
        const bob = Math.round(Math.sin(t * 8 + e.phase));
        const flip = e.x > HERO_X;
        const dx = Math.round(e.x - img.width / 2), dy = Math.round(e.y - img.height + bob);
        if (flip) {
          ctx.save(); ctx.translate(dx + img.width, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
        } else ctx.drawImage(img, dx, dy);
      } });
    }
    list.push({ y: HERO_Y, fn: () => {
      const frame = HERO[Math.floor(t * 3) % 2];
      const bob = Math.floor(t * 3) % 2;
      ctx.drawImage(frame, HERO_X - frame.width / 2, HERO_Y - frame.height + bob);
      if (this.heroHurt > 0) {
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#ff4545';
        ctx.fillRect(HERO_X - 7, HERO_Y - 18 + bob, 14, 18); ctx.globalAlpha = 1;
      }
    } });
    for (let i = 0; i < 3; i++) {
      const [ox, oy] = this.orbitPos(i);
      list.push({ y: oy + 6, fn: () => ctx.drawImage(COLD_WALLET, Math.round(ox - 2), Math.round(oy - 3)) });
    }
    list.sort((a, b) => a.y - b.y).forEach((d) => d.fn());

    for (const g of this.gems) ctx.drawImage(GEM, Math.round(g.x - 2), Math.round(g.y - 3 + Math.sin(g.age * 10)));

    for (const b of this.bullets) {
      ctx.fillStyle = '#1670a8';
      ctx.fillRect(Math.round(b.x - b.vx * 0.012), Math.round(b.y - b.vy * 0.012), 1, 1);
      ctx.fillStyle = '#29d3ff';
      ctx.fillRect(Math.round(b.x - b.vx * 0.006), Math.round(b.y - b.vy * 0.006), 1, 1);
      ctx.fillStyle = '#e6fbff';
      ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
    }
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 3);
      drawText(ctx, f.text, f.x, f.y, { size: 8, color: f.color, outline: '#0b0d17', align: 'center' });
    }
    ctx.globalAlpha = 1;

    this.drawLogo(ctx);
    this.drawPrompt(ctx);
    this.drawTicker(ctx);
  }

  private drawFloor(ctx: CanvasRenderingContext2D) {
    // base
    for (let y = HORIZON; y < H; y++) {
      const f = (y - HORIZON) / (H - HORIZON);
      ctx.fillStyle = f < 0.15 ? '#1a0c30' : f < 0.45 ? '#140a26' : '#0e071c';
      ctx.fillRect(0, y, W, 1);
    }
    // horizon glow
    for (let y = HORIZON - 3; y < HORIZON + 3; y++) {
      for (let x = 0; x < W; x++) {
        const k = 1 - Math.abs(y - HORIZON + 0.5) / 3;
        if (bayer(x, y) < k * 0.8) { ctx.fillStyle = y < HORIZON ? '#7a1f63' : '#ff3d8b'; ctx.fillRect(x, y, 1, 1); }
      }
    }
    ctx.fillStyle = '#ff6fae';
    ctx.fillRect(0, HORIZON, W, 1);
    // perspective grid
    const vx = W / 2;
    for (let k = -14; k <= 14; k++) line(ctx, vx + k * 4, HORIZON + 1, vx + k * 46, H, '#3a1556');
    const phase = (this.t * 0.9) % 1;
    for (let i = 1; i < 18; i++) {
      const dd = i + 1 - phase;
      const y = Math.round(HORIZON + 150 / dd);
      if (y >= H || y <= HORIZON + 1) continue;
      ctx.fillStyle = dd < 5 ? '#5a1f78' : '#3a1556';
      ctx.fillRect(0, y, W, 1);
    }
  }

  private drawAura(ctx: CanvasRenderingContext2D) {
    const n = 36;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.t * 0.8;
      if (i % 3 === 0) continue;
      const x = Math.round(HERO_X + Math.cos(a) * 30), y = Math.round(HERO_Y - 1 + Math.sin(a) * 12);
      ctx.fillStyle = i % 3 === 1 ? '#1e9e5a' : '#39ff88';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  private drawLogo(ctx: CanvasRenderingContext2D) {
    const lx = Math.round(W / 2 - this.logo.width / 2), ly = 8 + Math.round(Math.sin(this.t * 1.6));
    if (this.glitch > 0) {
      const off = Math.round(2 + Math.random() * 2);
      ctx.globalAlpha = 0.7;
      ctx.drawImage(this.logoGhostA, lx - off, ly);
      ctx.drawImage(this.logoGhostB, lx + off, ly);
      ctx.globalAlpha = 1;
      // horizontal slice tearing
      const h = this.logo.height;
      for (let y = 0; y < h; y += 4) {
        const shift = Math.random() < 0.3 ? Math.round((Math.random() - 0.5) * 10) : 0;
        ctx.drawImage(this.logo, 0, y, this.logo.width, 4, lx + shift, ly + y, this.logo.width, 4);
      }
    } else {
      ctx.drawImage(this.logo, lx, ly);
    }
    const sy = ly + this.logo.height + 1;
    drawText(ctx, tx('HACKER SURVIVORS', '28 HACKS · 1 SURVIVOR'), W / 2, sy, { size: 12, color: '#29d3ff', outline: '#0b0d17', align: 'center', spacing: getLang() === 'zh' ? 2 : 0 });
    drawText(ctx, tx('活过加密史上 28 场最狠的黑客攻击', "Survive the 28 nastiest hacks in crypto history"), W / 2, sy + 14, { size: 8, color: '#9aa3c7', outline: '#0b0d17', align: 'center' });
    // corner buttons
    panel(ctx, W - 44, 2, 42, 13, '#3a2e5c', '#110e22');
    drawText(ctx, getLang() === 'zh' ? '中 / EN' : 'EN / 中', W - 23, 4, { size: 8, color: '#c8cde6', align: 'center' });
    panel(ctx, W - 80, 2, 34, 13, '#3a2e5c', '#110e22');
    drawText(ctx, isMuted() ? '♪ OFF' : '♪ ON', W - 63, 4, { size: 8, color: isMuted() ? '#5d6690' : '#39ff88', align: 'center' });
  }

  private openMenu() {
    const run = save.run;
    let confirm = false; // a new run overwrites the saved one: ask twice
    const items: MenuItem[] = [];
    if (run) items.push({ label: () => tx(`继续 · 第 ${run.stage + 1} 关`, `Continue · Stage ${run.stage + 1}`), action: () => this.app.play() });
    items.push({
      label: () => (confirm ? tx('确定覆盖进度？', 'Overwrite run?') : tx('新游戏', 'New Run')),
      action: () => { if (run && !confirm) { confirm = true; sfx('hurt'); return; } this.app.newRun(); },
    });
    items.push({ label: () => tx('排行榜', 'Leaderboard'), action: () => this.app.toLeaderboard() });
    this.menu = new Menu(items, W / 2, 166 - items.length * 19, 160, 17, 2);
  }

  private drawPrompt(ctx: CanvasRenderingContext2D) {
    if (this.menu) {
      const run = save.run, best = save.best;
      const info = run ? tx(`进行中：第 ${run.stage + 1}/${STAGES} 关 · 资产 ${usdShort(run.assets)}`, `In progress: stage ${run.stage + 1}/${STAGES} · ${usdShort(run.assets)}`)
        : best ? tx(`最佳：${usdShort(best.assets)} · ${best.won ? '全部通关' : `过了 ${best.cleared} 关`}`, `Best: ${usdShort(best.assets)} · ${best.won ? 'all cleared' : `${best.cleared} stages`}`)
        : '';
      if (info) drawText(ctx, info, W / 2, this.menu.y - 11, { size: 8, color: '#ffd23f', outline: '#0b0d17', align: 'center' });
      this.menu.draw(ctx, this.t);
      return;
    }
    if (this.t % 1.1 >= 0.75) return;
    drawText(ctx, tx('▶ 点击 / 按任意键开始', '▶ TAP / PRESS ANY KEY'), W / 2, 148, { size: 12, color: '#ffd23f', outline: '#0b0d17', align: 'center' });
  }

  private drawTicker(ctx: CanvasRenderingContext2D) {
    const y0 = 168;
    ctx.fillStyle = '#07060d';
    ctx.fillRect(0, y0, W, H - y0);
    ctx.fillStyle = '#a3195b';
    ctx.fillRect(0, y0, W, 1);
    const lw = 50;
    const tw = this.ticker.width;
    const off = Math.floor((this.t * 22) % tw);
    for (let x = lw - off; x < W; x += tw) ctx.drawImage(this.ticker, x, y0 + 2);
    // fixed label on the left
    ctx.fillStyle = '#ff4545';
    ctx.fillRect(0, y0 + 1, lw, H - y0 - 1);
    drawText(ctx, tx('BOSS 关', 'BOSSES'), lw / 2, y0 + 2, { size: 8, color: '#ffffff', align: 'center' });
  }
}
