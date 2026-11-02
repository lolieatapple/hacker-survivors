// Core survivor gameplay for one level.
import { W, H, silhouette, line } from '../gfx';
import { drawText, textWidth } from '../text';
import { tx, T } from '../i18n';
import { input } from '../input';
import { sfx, playMusic, duckMusic, isMuted } from '../audio';
import { markCleared } from '../save';
import { HERO, AIRDROP, RUG, DRAINER, BUG } from '../sprites';
import { NINJA, BOT, WHALE, GEMS, FAKE_GEM, USDT, BTC, CHEST, MINE, ICONS } from '../game/art';
import { LEVELS, type LevelDef, type EnemyKind } from '../game/levels';
import { WEAPONS, PASSIVES, MAX_LVL, rollChoices, orbitPositions, drawLightning, type OwnedWeapon, type PassiveId, type Choice, type WeaponId } from '../game/weapons';
import { makeBrain, type Brain } from '../game/bosses';
import { panel, dim, wrap, Menu, type Scene, type App } from './ui';

const params = new URLSearchParams(location.search);
const GOD = params.get('god') === '1';
const SKIP_TO_BOSS = params.get('boss') === '1';

export interface Enemy {
  x: number; y: number; vx: number; vy: number;
  r: number; hp: number; maxHp: number; speed: number; dmg: number; xp: number;
  img: HTMLCanvasElement; flashImg: HTMLCanvasElement; colors: string[];
  elite: boolean; boss: boolean; tag: string;
  flash: number; phase: number; dead: boolean; orbCd: number;
  invuln: boolean; hidden: boolean; alpha: number; noContact: boolean; noKnock: boolean;
  ghost: boolean; // projectiles pass through (decoys)
  ai?: (e: Enemy, g: Game, dt: number) => void;
  data: Record<string, number>;
}
interface Shot { x: number; y: number; vx: number; vy: number; dmg: number; pierce: number; life: number; hit: Set<Enemy>; bossOnly: boolean }
export interface EBullet { x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; color: string; split?: number; pierceShield?: boolean }
export interface Zone { x: number; y: number; r: number; warn: number; life: number; dmg: number; color: string; kind: 'hurt' | 'debt' | 'peg' | 'blast'; tick: number }
type PickKind = 'gem' | 'heal' | 'chest' | 'btc' | 'fake';
interface Pickup { x: number; y: number; kind: PickKind; value: number; vx: number; vy: number; magnet: boolean; age: number }
interface Mine { x: number; y: number; fuse: number; dmg: number; r: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }
interface Floater { x: number; y: number; text: string; life: number; color: string }
interface Beam { x0: number; y0: number; x1: number; y1: number; life: number; color: string }
interface Banner { text: string; sub?: string; color: string; life: number }

interface EnemyDef { img: HTMLCanvasElement; flash: HTMLCanvasElement; hp: number; speed: number; dmg: number; xp: number; r: number; colors: string[] }
const def = (img: HTMLCanvasElement, hp: number, speed: number, dmg: number, xp: number, colors: string[]): EnemyDef =>
  ({ img, flash: silhouette(img, '#ffffff'), hp, speed, dmg, xp, r: Math.ceil(Math.max(img.width, img.height) / 2) - 1, colors });
const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  bug: def(BUG, 6, 36, 4, 1, ['#ff4545', '#9e1b2b']),
  drainer: def(DRAINER, 10, 28, 5, 1, ['#f4f4f8', '#9aa3c7']),
  bot: def(BOT, 13, 31, 5, 1, ['#9aa3c7', '#29d3ff']),
  airdrop: def(AIRDROP, 15, 23, 6, 2, ['#ff3d8b', '#ffd23f']),
  rug: def(RUG, 20, 19, 8, 2, ['#ff4545', '#ffd23f']),
  whale: def(WHALE, 60, 14, 12, 5, ['#627eea', '#3c4fa8']),
  ninja: def(NINJA, 14, 38, 7, 2, ['#1b2140', '#ff4545']),
};
const ELITE_CACHE = new Map<HTMLCanvasElement, [HTMLCanvasElement, HTMLCanvasElement]>();
function eliteImgs(d: EnemyDef): [HTMLCanvasElement, HTMLCanvasElement] {
  let hit = ELITE_CACHE.get(d.img);
  if (!hit) {
    const c = document.createElement('canvas');
    c.width = d.img.width * 2; c.height = d.img.height * 2;
    const x = c.getContext('2d')!;
    x.imageSmoothingEnabled = false;
    x.drawImage(d.img, 0, 0, c.width, c.height);
    hit = [c, silhouette(c, '#ffffff')];
    ELITE_CACHE.set(d.img, hit);
  }
  return hit;
}

const xpNeed = (l: number) => 3 + (l - 1) * 2 + Math.floor((l - 1) ** 1.3);
type Overlay = null | 'intro' | 'levelup' | 'pause' | 'clear' | 'dead';

export class Game implements Scene {
  readonly level: LevelDef;
  player = { x: 0, y: 0, r: 5, hp: 100, maxHp: 100, speed: 62, iframes: 0, facing: [1, 0] as [number, number], lvl: 1, xp: 0, moving: false, hurt: 0 };
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  ebullets: EBullet[] = [];
  zones: Zone[] = [];
  pickups: Pickup[] = [];
  mines: Mine[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  beams: Beam[] = [];
  bolts: { x: number; y: number; life: number; seed: number }[] = [];
  banners: Banner[] = [];
  weapons: OwnedWeapon[] = [{ id: 'bolt', lvl: 1, cd: 0.3, locked: 0 }];
  passives: Record<PassiveId, number> = { hp: 0, armor: 0, speed: 0, power: 0, haste: 0, magnet: 0, regen: 0 };
  fx = { drain: 0, invert: 0, freeze: 0, gemsLocked: false, shieldOff: 0, fakeCards: false, enemyDmgMul: 1, enemySpdMul: 1, spawnMul: 1, pegZone: null as Zone | null };
  arena: { x: number; y: number; r: number } | null = null;

  time = 0;          // world time (pauses with overlays)
  bossTime = 0;      // seconds since boss arrived
  phase: 'waves' | 'warning' | 'boss' | 'won' = 'waves';
  overlay: Overlay = 'intro';
  kills = 0;
  cam = { x: 0, y: 0 };
  private shakeT = 0;
  private spawnAcc = 0;
  private warnT = 0;
  private nextElite = 45;
  private nextRing = 30;
  brain: Brain;
  private grid = new Map<number, Enemy[]>();
  private choices: Choice[] = [];
  private choiceSel = 0;
  private pendingLevelups = 0;
  private chestPending = 0;
  private menu: Menu | null = null;
  private realT = 0;
  private wonAt = 0;

  constructor(private app: App, readonly idx: number) {
    this.level = LEVELS[idx];
    this.brain = makeBrain(this.level);
    this.brain.init?.(this);
    playMusic('waves');
    if (SKIP_TO_BOSS) this.time = this.level.duration - 3;
    this.nextElite = Math.max(this.nextElite, this.time + 20);
    this.nextRing = Math.max(this.nextRing, this.time + 10);
    (window as unknown as { __game: Game }).__game = this;
  }

  // ---------------- API used by weapons & bosses ----------------
  sound(n: Parameters<typeof sfx>[0]) { sfx(n); }
  hasteMul() { return 1 + this.passives.haste * 0.08; }
  dmgMul() { return 1 + this.passives.power * 0.1; }
  toScreen(x: number, y: number): [number, number] { return [Math.round(x - this.cam.x), Math.round(y - this.cam.y)]; }
  onScreen(x: number, y: number, m = 16) { const [sx, sy] = this.toScreen(x, y); return sx > -m && sy > -m && sx < W + m && sy < H + m; }
  angleTo(x: number, y: number) { return Math.atan2(this.player.y - 6 - y, this.player.x - x); }

  queryEnemies(x: number, y: number, r: number, cb: (e: Enemy) => void) {
    const c0x = Math.floor((x - r) / 32), c1x = Math.floor((x + r) / 32);
    const c0y = Math.floor((y - r) / 32), c1y = Math.floor((y + r) / 32);
    for (let cx = c0x; cx <= c1x; cx++) for (let cy = c0y; cy <= c1y; cy++) {
      const cell = this.grid.get(((cx & 0xffff) << 16) | (cy & 0xffff));
      if (!cell) continue;
      for (const e of cell) if (!e.dead && Math.hypot(e.x - x, e.y - e.r - y) < r + e.r) cb(e);
    }
  }
  nearestEnemies(n: number, range: number): Enemy[] {
    const p = this.player;
    return this.enemies
      .filter((e) => !e.dead && !e.hidden && Math.hypot(e.x - p.x, e.y - p.y) < range)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, n);
  }
  /** Nearest damageable boss unit in range: auto-aim leads with it so boss fights always progress. */
  priorityTarget(range: number): Enemy | null {
    const p = this.player;
    let best: Enemy | null = null, bd = range;
    for (const e of this.enemies) {
      if (!e.boss || e.dead || e.invuln || e.hidden || e.ghost) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  onScreenEnemies() { return this.enemies.filter((e) => !e.dead && !e.hidden && this.onScreen(e.x, e.y, -4)); }

  addShot(x: number, y: number, vx: number, vy: number, dmg: number, pierce: number, bossOnly = false) {
    this.shots.push({ x, y, vx, vy, dmg, pierce, life: 1.1, hit: new Set(), bossOnly });
  }
  shoot(x: number, y: number, a: number, speed: number, o: Partial<EBullet> = {}): EBullet {
    const b: EBullet = { x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 2, dmg: 8, life: 5, color: '#ff4545', ...o };
    this.ebullets.push(b);
    return b;
  }
  radial(x: number, y: number, n: number, speed: number, offset = 0, o: Partial<EBullet> = {}) {
    for (let i = 0; i < n; i++) this.shoot(x, y, offset + (i / n) * Math.PI * 2, speed, o);
  }
  zone(z: Partial<Zone> & { x: number; y: number; r: number }): Zone {
    const full: Zone = { warn: 0.8, life: 3, dmg: 10, color: '#ff4545', kind: 'hurt', tick: 0, ...z };
    this.zones.push(full);
    return full;
  }
  lightning(x: number, y: number) { this.bolts.push({ x, y, life: 0.15, seed: 1 + Math.floor(Math.random() * 1e6) }); }
  floater(text: string, x: number, y: number, color = '#ffd23f') { this.floaters.push({ x, y, text, life: 0.7, color }); }
  banner(text: string, color = '#ffd23f', sub?: string, life = 2) { this.banners = [{ text, sub, color, life }]; }
  shake(t = 0.15) { this.shakeT = Math.max(this.shakeT, t); }
  burst(x: number, y: number, colors: string[], n = 8, speed = 50) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = speed * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: 0, max: 0.3 + Math.random() * 0.4, color: colors[i % colors.length] });
    }
  }
  addPickup(kind: PickKind, x: number, y: number, value = 1) {
    if (kind === 'gem' && this.pickups.length > 320) {
      const near = this.pickups.find((p) => p.kind === 'gem' && Math.hypot(p.x - x, p.y - y) < 60);
      if (near) { near.value += value; return; }
    }
    this.pickups.push({ x, y, kind, value, vx: (Math.random() - 0.5) * 30, vy: -30, magnet: false, age: 0 });
  }

  /** Boss summons respect this so swarms stay playable on phones. */
  canSpawn() { return this.enemies.length < 320; }

  spawnEnemy(kind: EnemyKind, x: number, y: number, elite = false): Enemy {
    const d = ENEMY_DEFS[kind];
    const hpScale = (1 + this.idx * 0.01) * (1 + (Math.min(this.time, this.level.duration) / this.level.duration) * 0.7);
    const [img, flashImg] = elite ? eliteImgs(d) : [d.img, d.flash];
    const hp = Math.round(d.hp * hpScale * (elite ? 10 : 1));
    const e: Enemy = {
      x, y, vx: 0, vy: 0, r: elite ? d.r * 2 : d.r, hp, maxHp: hp, speed: d.speed * (elite ? 0.8 : 1) * (0.9 + Math.random() * 0.2),
      dmg: d.dmg * (elite ? 2 : 1), xp: d.xp * (elite ? 10 : 1), img, flashImg, colors: d.colors,
      elite, boss: false, tag: kind, flash: 0, phase: Math.random() * 6.28, dead: false, orbCd: 0,
      invuln: false, hidden: false, alpha: 1, noContact: false, noKnock: elite, ghost: false, data: {},
    };
    this.enemies.push(e);
    return e;
  }
  /** Generic unit for bosses and their props. */
  spawnUnit(o: Partial<Enemy> & { x: number; y: number; img: HTMLCanvasElement; hp: number }): Enemy {
    const e: Enemy = {
      vx: 0, vy: 0, r: Math.ceil(Math.max(o.img.width, o.img.height) / 2) - 2, maxHp: o.hp, speed: 20, dmg: 15, xp: 0,
      flashImg: silhouette(o.img, '#ffffff'), colors: ['#ff4545', '#ffd23f'], elite: false, boss: true, tag: 'boss',
      flash: 0, phase: 0, dead: false, orbCd: 0, invuln: false, hidden: false, alpha: 1, noContact: false, noKnock: true, ghost: false, data: {},
      ...o,
    };
    this.enemies.push(e);
    return e;
  }

  damageEnemy(e: Enemy, raw: number, _sx?: number, _sy?: number) {
    if (e.dead) return;
    if (e.invuln) {
      if (Math.random() < 0.15) this.floater(tx('免疫', 'IMMUNE'), e.x, e.y - e.r * 2, '#9aa3c7');
      return;
    }
    let dmg = Math.max(1, Math.round(raw * this.dmgMul()));
    if (this.brain.onDamage) dmg = this.brain.onDamage(this, e, dmg);
    if (dmg === 0) return;
    e.hp -= dmg;
    e.flash = 0.08;
    if (!e.noKnock) {
      const a = Math.atan2(e.y - this.player.y, e.x - this.player.x);
      e.vx += Math.cos(a) * 40; e.vy += Math.sin(a) * 40;
    }
    if (dmg < 0) this.floater(`+${-dmg}`, e.x, e.y - e.r * 2 - 2, '#39ff88');
    else this.floater(String(dmg), e.x + (Math.random() - 0.5) * 6, e.y - e.r * 2 - 2, e.boss ? '#ff9f1c' : '#ffd23f');
    this.sound('hit');
    if (e.hp > e.maxHp) e.hp = e.maxHp;
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy) {
    if (this.brain.onKill && !this.brain.onKill(this, e)) return;
    e.dead = true;
    this.burst(e.x, e.y - e.r, e.colors, e.boss ? 24 : 8, e.boss ? 90 : 50);
    if (e.boss) { this.shake(0.25); this.sound('explode'); return; }
    this.kills++;
    this.addPickup('gem', e.x, e.y - 3, e.xp);
    if (e.elite) this.addPickup('chest', e.x + 6, e.y - 3);
    else if (Math.random() < 0.012) this.addPickup('heal', e.x, e.y - 3);
  }

  hurtPlayer(raw: number) {
    const p = this.player;
    if (p.iframes > 0 || GOD || this.phase === 'won') return;
    const dmg = Math.max(1, Math.round(raw * this.fx.enemyDmgMul) - this.passives.armor);
    p.hp -= dmg;
    p.iframes = 0.6;
    p.hurt = 0.2;
    this.floater(`-${dmg}`, p.x, p.y - 22, '#ff4545');
    this.shake(0.12);
    this.sound('hurt');
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }
  heal(n: number) {
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + n);
    this.floater(`+${Math.round(n)}`, p.x, p.y - 22, '#39ff88');
  }
  gainXp(n: number) {
    const p = this.player;
    p.xp += n;
    while (p.xp >= xpNeed(p.lvl)) { p.xp -= xpNeed(p.lvl); p.lvl++; this.pendingLevelups++; }
  }
  /** Take XP away (Poly Network). Returns amount taken. */
  stealXp(n: number): number {
    const p = this.player;
    const take = Math.min(p.xp, n);
    p.xp -= take;
    return take;
  }
  lockRandomWeapon(seconds: number): string | null {
    const open = this.weapons.filter((w) => w.locked <= 0);
    if (!open.length) return null;
    const w = open[Math.floor(Math.random() * open.length)];
    w.locked = seconds;
    return T(WEAPONS[w.id].name);
  }
  bossUnits() { return this.enemies.filter((e) => e.boss && !e.dead); }

  // ---------------- lifecycle ----------------
  private die() {
    this.overlay = 'dead';
    playMusic(null);
    this.sound('dead');
    this.menu = new Menu([
      { label: tx('重新挑战', 'Retry'), action: () => this.app.play(this.idx) },
      { label: tx('关卡列表', 'Level Select'), action: () => this.app.toLevelSelect(this.idx) },
    ], W / 2, 116);
  }
  private win() {
    this.phase = 'won';
    this.wonAt = this.realT;
    this.brain.end?.(this);
    this.ebullets = [];
    this.zones = [];
    for (const e of this.enemies) if (!e.dead && !e.boss) this.killEnemy(e);
    for (const p of this.pickups) p.magnet = true;
    markCleared(this.idx, this.time, this.kills);
    playMusic(null);
    this.sound('clear');
    this.banner(tx('胜利！', 'VICTORY!'), '#39ff88', tx(`${T(this.level.boss)} 已被击败`, `${T(this.level.boss)} defeated`), 3);
  }
  private openClear() {
    this.overlay = 'clear';
    const items = [];
    if (this.idx < LEVELS.length - 1) items.push({ label: tx('下一关', 'Next Level'), action: () => this.app.play(this.idx + 1) });
    items.push({ label: tx('关卡列表', 'Level Select'), action: () => this.app.toLevelSelect(Math.min(LEVELS.length - 1, this.idx + 1)) });
    this.menu = new Menu(items, W / 2, 118);
  }
  private openPause() {
    this.overlay = 'pause';
    duckMusic(true);
    this.menu = new Menu([
      { label: tx('继续', 'Resume'), action: () => this.resume() },
      { label: () => tx(`声音：${isMuted() ? '关' : '开'}`, `Sound: ${isMuted() ? 'OFF' : 'ON'}`), action: () => window.dispatchEvent(new CustomEvent('toggle-mute')) },
      { label: tx('重新开始', 'Restart'), action: () => this.app.play(this.idx) },
      { label: tx('关卡列表', 'Level Select'), action: () => this.app.toLevelSelect(this.idx) },
    ], W / 2, 64);
  }
  private resume() { this.overlay = null; this.menu = null; duckMusic(false); }
  private openLevelup(chest: boolean) {
    this.overlay = 'levelup';
    this.choices = rollChoices(this, 3);
    if (this.fx.fakeCards && Math.random() < 0.85) {
      const i = Math.floor(Math.random() * 3);
      this.choices[i] = { ...this.choices[i], fake: true };
    }
    this.choiceSel = 0;
    this.sound('levelup');
    void chest;
  }
  private applyChoice(c: Choice) {
    if (c.fake) {
      const lost = this.lockRandomWeapon(15);
      this.player.maxHp = Math.max(40, this.player.maxHp - 15);
      this.player.hp = Math.min(this.player.hp, this.player.maxHp);
      this.banner(tx('盲签了伪造交易！', 'YOU BLIND-SIGNED A FAKE!'), '#ff4545', lost ? tx(`${lost} 被冻结 15 秒，最大生命 -15`, `${lost} frozen for 15s, max HP -15`) : tx('最大生命 -15', 'Max HP -15'), 2.5);
      this.sound('hurt');
      return;
    }
    if (c.kind === 'weapon') {
      const id = c.id as WeaponId;
      const owned = this.weapons.find((w) => w.id === id);
      if (owned) owned.lvl = Math.min(MAX_LVL, owned.lvl + 1);
      else this.weapons.push({ id, lvl: 1, cd: 0, locked: 0 });
    } else if (c.kind === 'passive') {
      const id = c.id as PassiveId;
      this.passives[id]++;
      if (id === 'hp') { this.player.maxHp += 20; this.player.hp += 20; }
    } else this.heal(30);
    this.sound('select');
  }

  // ---------------- update ----------------
  update(dt: number) {
    this.realT += dt;
    switch (this.overlay) {
      case 'intro':
        if (this.realT > 0.4 && (input.anyKey() || input.taps.length)) { this.overlay = null; this.sound('select'); }
        return;
      case 'levelup': this.updateLevelup(); return;
      case 'pause': case 'clear': case 'dead':
        if (this.overlay === 'pause' && input.pressed('Escape', 'KeyP')) { this.resume(); return; }
        this.menu?.update();
        return;
    }
    if (input.pressed('Escape', 'KeyP') || input.tapIn(W - 14, 5, 13, 13)) { this.openPause(); return; }
    if (this.phase === 'won') {
      this.world(dt);
      if (this.realT - this.wonAt > 2.6) this.openClear();
      return;
    }
    this.world(dt);
    if (this.overlay) return;
    if (this.chestPending > 0) { this.chestPending--; this.openLevelup(true); return; }
    if (this.pendingLevelups > 0) { this.pendingLevelups--; this.openLevelup(false); }
  }

  private updateLevelup() {
    const n = this.choices.length;
    if (input.pressed('ArrowLeft', 'KeyA')) this.choiceSel = (this.choiceSel + n - 1) % n;
    if (input.pressed('ArrowRight', 'KeyD')) this.choiceSel = (this.choiceSel + 1) % n;
    let pick = -1;
    if (input.pressed('Enter', 'Space')) pick = this.choiceSel;
    ['Digit1', 'Digit2', 'Digit3'].forEach((k, i) => { if (input.pressed(k)) pick = i; });
    this.choices.forEach((_, i) => { if (input.tapIn(this.cardX(i), 46, 96, 100)) pick = i; });
    if (pick >= 0 && pick < n) {
      this.applyChoice(this.choices[pick]);
      this.overlay = null;
    }
  }
  private cardX(i: number) { return 10 + i * 102; }

  private world(dt: number) {
    this.time += dt;
    const p = this.player;
    const fx = this.fx;

    // player
    let [ax, ay] = input.axis();
    if (fx.invert > 0) { ax = -ax; ay = -ay; }
    if (fx.freeze > 0) { ax = 0; ay = 0; }
    p.moving = !!(ax || ay);
    if (p.moving) { const l = Math.hypot(ax, ay); p.facing = [ax / l, ay / l]; }
    const spd = p.speed * (1 + this.passives.speed * 0.08);
    p.x += ax * spd * dt; p.y += ay * spd * dt;
    if (this.arena) {
      const d = Math.hypot(p.x - this.arena.x, p.y - this.arena.y);
      if (d > this.arena.r) { this.hurtPlayer(6); }
    }
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    if (this.passives.regen) p.hp = Math.min(p.maxHp, p.hp + this.passives.regen * 0.4 * dt);
    if (fx.drain > 0 && this.phase === 'boss' && !GOD) { p.hp -= fx.drain * dt; if (p.hp <= 0) { p.hp = 0; this.die(); return; } }
    fx.invert = Math.max(0, fx.invert - dt);
    fx.freeze = Math.max(0, fx.freeze - dt);
    fx.shieldOff = Math.max(0, fx.shieldOff - dt);

    this.cam.x = p.x - W / 2;
    this.cam.y = p.y - 8 - H / 2;

    // grid
    this.grid.clear();
    for (const e of this.enemies) {
      if (e.dead) continue;
      const k = ((Math.floor(e.x / 32) & 0xffff) << 16) | (Math.floor((e.y - e.r) / 32) & 0xffff);
      let cell = this.grid.get(k);
      if (!cell) this.grid.set(k, (cell = []));
      cell.push(e);
    }

    // weapons
    for (const w of this.weapons) {
      if (w.locked > 0) { w.locked -= dt; continue; }
      WEAPONS[w.id].update(this, w, dt);
    }

    // spawning + phases
    if (this.phase === 'waves') {
      this.spawnWaves(dt, 1);
      if (this.time >= this.level.duration) {
        this.phase = 'warning';
        this.warnT = 0;
        this.sound('boss');
        this.banner(tx('⚠ BOSS 来袭', '⚠ BOSS INCOMING'), '#ff4545', `${T(this.level.boss)} · ${this.level.date} ${this.level.name}`, 3);
      }
    } else if (this.phase === 'warning') {
      this.warnT += dt;
      if (this.warnT > 3) {
        this.phase = 'boss';
        this.bossTime = 0;
        this.brain.start(this);
        this.banner(T(this.level.tag), '#ffd23f', T(this.level.hint), 3.5);
        playMusic(this.idx === LEVELS.length - 1 ? 'final' : 'boss');
      }
    } else if (this.phase === 'boss') {
      this.bossTime += dt;
      this.spawnWaves(dt, 0.35 * fx.spawnMul);
      this.brain.update(this, dt);
      if (this.overlay) return;
      const done = this.brain.defeated ? this.brain.defeated(this) : this.bossUnits().filter((e) => e.tag === 'boss').length === 0;
      if (done) this.win();
    }

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.orbCd = Math.max(0, e.orbCd - dt);
      if (e.ai) e.ai(e, this, dt);
      else {
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        const s = e.speed * fx.enemySpdMul;
        e.x += (dx / d) * s * dt; e.y += (dy / d) * s * dt;
        if (d > 340 && !e.boss) { // recycle far stragglers around the player
          const a = Math.random() * 6.28;
          e.x = p.x + Math.cos(a) * 220; e.y = p.y + Math.sin(a) * 140;
        }
      }
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= 0.85; e.vy *= 0.85;
      if (!e.noContact && Math.hypot(p.x - e.x, (p.y - 4) - (e.y - e.r)) < e.r + p.r) this.hurtPlayer(e.dmg);
    }
    // separation (cheap, per cell)
    for (const cell of this.grid.values()) {
      for (let i = 0; i < cell.length; i++) for (let j = i + 1; j < cell.length; j++) {
        const a = cell[i], b = cell[j];
        if (a.boss || b.boss) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r - 2;
        if (d > 0 && d < m) {
          const push = ((m - d) / d) * 0.25;
          a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
        }
      }
    }

    // player shots
    for (const s of this.shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) continue;
      this.queryEnemies(s.x, s.y, 2, (e) => {
        if (s.life <= 0 || s.hit.has(e) || e.hidden || e.ghost || (s.bossOnly && !e.boss)) return;
        s.hit.add(e);
        this.damageEnemy(e, s.dmg);
        if (s.pierce-- <= 0) s.life = 0;
      });
    }
    this.shots = this.shots.filter((s) => s.life > 0);

    // enemy bullets
    const orbs = this.weapons.find((w) => w.id === 'orbit' && w.locked <= 0);
    const orbPos = orbs && fx.shieldOff <= 0 ? orbitPositions(this, orbs) : [];
    for (const b of this.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) continue;
      if (!b.pierceShield && orbPos.some(([ox, oy]) => Math.hypot(ox - b.x, oy - b.y) < 4)) { b.life = 0; continue; }
      if (Math.hypot(b.x - p.x, b.y - (p.y - 7)) < b.r + 4) { b.life = 0; this.hurtPlayer(b.dmg); }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0 && Math.abs(b.x - p.x) < 400 && Math.abs(b.y - p.y) < 300);

    // zones
    for (const z of this.zones) {
      if (z.warn > 0) { z.warn -= dt; continue; }
      z.life -= dt;
      z.tick -= dt;
      const inside = Math.hypot(p.x - z.x, (p.y - 3 - z.y) * 1.6) < z.r;
      if (z.kind === 'hurt' && inside && z.tick <= 0) { this.hurtPlayer(z.dmg); z.tick = 0.4; }
      if (z.kind === 'blast' && z.tick <= 0) {
        z.tick = 99;
        this.burst(z.x, z.y, ['#ffd23f', '#ff4545', '#f4f4f8'], 18, 90);
        this.shake(0.2);
        if (inside) this.hurtPlayer(z.dmg);
        this.brain.onBlast?.(this, z, inside);
      }
    }
    this.zones = this.zones.filter((z) => z.warn > 0 || z.life > 0);

    // mines
    for (const m of this.mines) {
      m.fuse -= dt;
      let boom = m.fuse <= 0;
      if (!boom) this.queryEnemies(m.x, m.y, 4, () => { boom = true; });
      if (boom) {
        m.fuse = -99;
        this.queryEnemies(m.x, m.y, m.r, (e) => this.damageEnemy(e, m.dmg));
        this.burst(m.x, m.y, ['#ff4545', '#ffd23f', '#ff9f1c'], 12, 70);
        this.sound('explode');
      }
    }
    this.mines = this.mines.filter((m) => m.fuse > -99);

    // pickups
    const magR = 36 * (1 + this.passives.magnet * 0.3);
    for (const k of this.pickups) {
      k.age += dt;
      if (k.age < 0.35) { k.x += k.vx * dt; k.y += k.vy * dt; k.vy += 120 * dt; continue; }
      const locked = fx.gemsLocked && k.kind === 'gem';
      const d = Math.hypot(p.x - k.x, p.y - 6 - k.y);
      if (!locked && (k.magnet || d < magR || (k.kind === 'fake' && d < magR * 0.6))) {
        k.magnet = true;
        const s = 90 + k.age * 30;
        k.x += ((p.x - k.x) / d) * s * dt; k.y += ((p.y - 6 - k.y) / d) * s * dt;
      }
      if (!locked && d < 7) {
        k.age = -1;
        if (k.kind === 'gem') { this.gainXp(k.value); this.sound('pickup'); }
        else if (k.kind === 'heal') { this.heal(25); this.sound('pickup'); }
        else if (k.kind === 'btc') { this.heal(k.value); this.sound('pickup'); }
        else if (k.kind === 'chest') { this.chestPending++; this.banner(tx('空投箱！', 'AIRDROP CRATE!'), '#ffd23f', tx('免费升级一次', 'Free upgrade'), 1.2); this.sound('chest'); }
        else if (k.kind === 'fake') { this.hurtPlayer(12); this.floater(tx('钓鱼！', 'PHISHED!'), p.x, p.y - 30, '#ff4545'); }
      }
    }
    this.pickups = this.pickups.filter((k) => k.age >= 0 && Math.hypot(k.x - p.x, k.y - p.y) < 600);

    // fx
    for (const q of this.particles) { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 140 * dt; q.vx *= 0.95; }
    this.particles = this.particles.filter((q) => q.life < q.max);
    for (const f of this.floaters) { f.life -= dt; f.y -= 20 * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    for (const b of this.banners) b.life -= dt;
    this.banners = this.banners.filter((b) => b.life > 0);
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private spawnWaves(dt: number, mul: number) {
    const t = Math.min(this.time, this.level.duration);
    const rate = (1.3 + t * 0.04 + this.idx * 0.03) * mul;
    const cap = 240;
    this.spawnAcc += rate * dt;
    const pool = this.level.pool;
    const p = this.player;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (this.enemies.length >= cap) continue;
      // later in a level, tougher enemies appear more often
      const span = Math.max(1, Math.round(pool.length * (0.4 + 0.6 * (t / this.level.duration))));
      const kind = pool[Math.floor(Math.random() * span)];
      const a = Math.random() * Math.PI * 2;
      this.spawnEnemy(kind, p.x + Math.cos(a) * 210, p.y + Math.sin(a) * 130);
    }
    if (this.phase !== 'waves') return;
    if (this.time >= this.nextRing) {
      this.nextRing += 45;
      const n = 20 + this.idx;
      const kind = pool[Math.floor(Math.random() * pool.length)];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnEnemy(kind, p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 100);
      }
      this.banner(tx('被包围了！', 'SURROUNDED!'), '#ff3d8b', undefined, 1.2);
    }
    if (this.time >= this.nextElite) {
      this.nextElite += 40;
      const kind = pool[Math.floor(Math.random() * pool.length)];
      const a = Math.random() * 6.28;
      this.spawnEnemy(kind, p.x + Math.cos(a) * 200, p.y + Math.sin(a) * 120, true);
    }
  }

  // ---------------- draw ----------------
  draw(ctx: CanvasRenderingContext2D) {
    const sh = this.shakeT > 0 ? 2 : 0;
    const ox = sh ? Math.round((Math.random() - 0.5) * sh * 2) : 0, oy = sh ? Math.round((Math.random() - 0.5) * sh * 2) : 0;
    this.cam.x -= ox; this.cam.y -= oy;
    this.drawFloor(ctx);
    if (this.arena) this.drawArena(ctx);
    this.drawZones(ctx);
    this.brain.drawUnder?.(this, ctx);

    for (const k of this.pickups) {
      if (!this.onScreen(k.x, k.y)) continue;
      const img = k.kind === 'gem' ? (k.value >= 20 ? GEMS.red : k.value >= 5 ? GEMS.green : GEMS.blue)
        : k.kind === 'heal' ? USDT : k.kind === 'btc' ? BTC : k.kind === 'chest' ? CHEST : FAKE_GEM;
      const [sx, sy] = this.toScreen(k.x, k.y);
      const bob = k.kind === 'chest' ? Math.round(Math.sin(this.time * 4)) : 0;
      if (this.fx.gemsLocked && k.kind === 'gem') ctx.globalAlpha = 0.45;
      ctx.drawImage(img, sx - (img.width >> 1), sy - (img.height >> 1) + bob);
      ctx.globalAlpha = 1;
    }
    for (const m of this.mines) {
      const [sx, sy] = this.toScreen(m.x, m.y);
      if (m.fuse > 1 || Math.floor(this.time * 10) % 2) ctx.drawImage(MINE, sx - 2, sy - 2);
    }

    // shadows
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const e of this.enemies) {
      if (e.hidden || !this.onScreen(e.x, e.y, 30)) continue;
      const [sx, sy] = this.toScreen(e.x, e.y);
      ctx.fillRect(sx - e.r + 1, sy - 1, e.r * 2 - 2, 2);
    }
    const p = this.player;
    {
      const [sx, sy] = this.toScreen(p.x, p.y);
      ctx.fillRect(sx - 5, sy - 1, 10, 2);
    }

    // actors sorted by y
    const list: { y: number; fn: () => void }[] = [];
    for (const e of this.enemies) {
      if (!this.onScreen(e.x, e.y, 40)) continue;
      list.push({ y: e.y, fn: () => this.drawEnemy(ctx, e) });
    }
    list.push({ y: p.y, fn: () => this.drawPlayer(ctx) });
    const orb = this.weapons.find((w) => w.id === 'orbit');
    if (orb && orb.locked <= 0 && this.fx.shieldOff <= 0) {
      for (const [x, y] of orbitPositions(this, orb)) list.push({ y: y + 5, fn: () => { const [sx, sy] = this.toScreen(x, y); ctx.drawImage(ICONS.orbit, sx - 4, sy - 4); } });
    }
    list.sort((a, b) => a.y - b.y).forEach((d) => d.fn());

    for (const w of this.weapons) if (w.locked <= 0) WEAPONS[w.id].draw?.(this, w, ctx);

    for (const s of this.shots) {
      const [sx, sy] = this.toScreen(s.x, s.y);
      ctx.fillStyle = '#1670a8'; ctx.fillRect(Math.round(sx - s.vx * 0.012), Math.round(sy - s.vy * 0.012), 1, 1);
      ctx.fillStyle = '#29d3ff'; ctx.fillRect(Math.round(sx - s.vx * 0.006), Math.round(sy - s.vy * 0.006), 1, 1);
      ctx.fillStyle = '#e6fbff'; ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
    for (const b of this.ebullets) {
      if (!this.onScreen(b.x, b.y, 4)) continue;
      const [sx, sy] = this.toScreen(b.x, b.y);
      ctx.fillStyle = '#0b0d17'; ctx.fillRect(sx - b.r - 1, sy - b.r, b.r * 2 + 2, b.r * 2); ctx.fillRect(sx - b.r, sy - b.r - 1, b.r * 2, b.r * 2 + 2);
      ctx.fillStyle = b.color; ctx.fillRect(sx - b.r, sy - b.r, b.r * 2, b.r * 2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx - b.r + 1, sy - b.r + 1, 1, 1);
    }
    for (const b of this.beams) {
      const [x0, y0] = this.toScreen(b.x0, b.y0), [x1, y1] = this.toScreen(b.x1, b.y1);
      const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
      line(ctx, x0 + (nx / l), y0 + (ny / l), x1 + (nx / l), y1 + (ny / l), b.color);
      line(ctx, x0 - (nx / l), y0 - (ny / l), x1 - (nx / l), y1 - (ny / l), b.color);
      line(ctx, x0, y0, x1, y1, '#ffffff');
    }
    for (const b of this.bolts) {
      const [sx, sy] = this.toScreen(b.x, b.y);
      drawLightning(ctx, sx, sy, b.seed);
      ctx.fillStyle = '#fff6c0'; ctx.fillRect(sx - 3, sy - 1, 7, 3); ctx.fillRect(sx - 1, sy - 3, 3, 7);
    }
    for (const q of this.particles) {
      const [sx, sy] = this.toScreen(q.x, q.y);
      ctx.fillStyle = q.color; ctx.fillRect(sx, sy, 1, 1);
    }
    this.brain.drawOver?.(this, ctx);
    for (const f of this.floaters) {
      const [sx, sy] = this.toScreen(f.x, f.y);
      ctx.globalAlpha = Math.min(1, f.life * 3);
      drawText(ctx, f.text, sx, sy, { size: 8, color: f.color, outline: '#0b0d17', align: 'center' });
    }
    ctx.globalAlpha = 1;
    this.cam.x += ox; this.cam.y += oy;

    this.drawHud(ctx);
    this.drawOverlay(ctx);
  }

  private drawFloor(ctx: CanvasRenderingContext2D) {
    const [base, grid, accent] = this.level.floor;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const T = 32;
    const x0 = Math.floor(this.cam.x / T) * T, y0 = Math.floor(this.cam.y / T) * T;
    for (let gx = x0; gx < this.cam.x + W + T; gx += T) {
      for (let gy = y0; gy < this.cam.y + H + T; gy += T) {
        const sx = Math.round(gx - this.cam.x), sy = Math.round(gy - this.cam.y);
        ctx.fillStyle = grid;
        ctx.fillRect(sx, sy, T, 1); ctx.fillRect(sx, sy, 1, T);
        const h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
        if (h % 7 === 0) { // circuit trace
          ctx.fillRect(sx + 6, sy + 10, 12, 1); ctx.fillRect(sx + 17, sy + 10, 1, 8);
          ctx.fillStyle = accent; ctx.globalAlpha = 0.35; ctx.fillRect(sx + 17, sy + 18, 2, 2); ctx.globalAlpha = 1;
        } else if (h % 11 === 0) {
          ctx.fillStyle = accent; ctx.globalAlpha = 0.25;
          drawText(ctx, (h % 256).toString(16).padStart(2, '0'), sx + 10, sy + 12, { size: 8, color: accent });
          ctx.globalAlpha = 1;
        } else if (h % 5 === 0) {
          ctx.fillRect(sx + 16, sy + 16, 1, 1);
        }
      }
    }
  }

  private drawArena(ctx: CanvasRenderingContext2D) {
    const a = this.arena!;
    const [cx, cy] = this.toScreen(a.x, a.y);
    // darken outside, draw dashed ring
    ctx.fillStyle = 'rgba(40,0,10,0.45)';
    for (let y = 0; y < H; y += 2) {
      const dy = y - cy;
      if (Math.abs(dy) >= a.r) { ctx.fillRect(0, y, W, 2); continue; }
      const half = Math.sqrt(a.r * a.r - dy * dy);
      ctx.fillRect(0, y, Math.max(0, cx - half), 2);
      ctx.fillRect(cx + half, y, Math.max(0, W - cx - half), 2);
    }
    const n = Math.round(a.r * 0.8);
    for (let i = 0; i < n; i++) {
      if ((i + Math.floor(this.time * 8)) % 3 === 0) continue;
      const t = (i / n) * Math.PI * 2;
      ctx.fillStyle = '#ff4545';
      ctx.fillRect(Math.round(cx + Math.cos(t) * a.r), Math.round(cy + Math.sin(t) * a.r), 1, 1);
    }
  }

  private drawZones(ctx: CanvasRenderingContext2D) {
    for (const z of this.zones) {
      const [cx, cy] = this.toScreen(z.x, z.y);
      if (!this.onScreen(z.x, z.y, z.r + 4)) continue;
      const warn = z.warn > 0;
      const ry = z.r / 1.6;
      ctx.fillStyle = z.color;
      for (let y = -Math.ceil(ry); y <= ry; y++) {
        const half = Math.round(z.r * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
        if (warn) {
          if (Math.floor(this.time * 10) % 2) { ctx.fillRect(cx - half, cy + y, 1, 1); ctx.fillRect(cx + half, cy + y, 1, 1); }
        } else {
          ctx.globalAlpha = z.kind === 'peg' ? 0.25 : 0.35;
          for (let x = -half; x <= half; x++) if (((x + y + Math.floor(this.time * 6)) & 3) === 0 || Math.abs(x) >= half - 1) ctx.fillRect(cx + x, cy + y, 1, 1);
          ctx.globalAlpha = 1;
        }
      }
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    if (e.alpha <= 0) return;
    const img = e.flash > 0 ? e.flashImg : e.img;
    const bob = e.boss ? Math.round(Math.sin(this.time * 2 + e.phase)) : Math.round(Math.sin(this.time * 8 + e.phase));
    const [sx, sy] = this.toScreen(e.x, e.y);
    const dx = sx - (img.width >> 1), dy = sy - img.height + bob;
    ctx.globalAlpha = e.alpha;
    if (!e.boss && e.x > this.player.x) {
      ctx.save(); ctx.translate(dx + img.width, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
    } else ctx.drawImage(img, dx, dy);
    ctx.globalAlpha = 1;
    if (e.invuln && !e.hidden) {
      ctx.fillStyle = '#29d3ff';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 6.28 + this.time * 2;
        ctx.fillRect(Math.round(sx + Math.cos(a) * (e.r + 4)), Math.round(sy - e.r + Math.sin(a) * (e.r + 4) * 0.7), 1, 1);
      }
    }
    if (e.elite || (e.boss && e.tag !== 'boss' && e.maxHp > 1)) {
      const w = Math.max(10, e.r * 2);
      ctx.fillStyle = '#0b0d17'; ctx.fillRect(sx - w / 2, dy - 4, w, 3);
      ctx.fillStyle = e.elite ? '#ffd23f' : '#ff3d8b'; ctx.fillRect(sx - w / 2 + 1, dy - 3, Math.max(0, Math.round((w - 2) * e.hp / e.maxHp)), 1);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const frame = p.moving ? HERO[Math.floor(this.time * 8) % 2] : HERO[0];
    const bob = p.moving ? Math.floor(this.time * 8) % 2 : Math.floor(this.time * 2) % 2;
    const [sx, sy] = this.toScreen(p.x, p.y);
    if (p.iframes > 0 && Math.floor(this.time * 20) % 2) ctx.globalAlpha = 0.5;
    if (p.facing[0] < -0.1) {
      ctx.save(); ctx.translate(sx + 7, sy - 18 + bob); ctx.scale(-1, 1); ctx.drawImage(frame, 0, 0); ctx.restore();
    } else ctx.drawImage(frame, sx - 7, sy - 18 + bob);
    ctx.globalAlpha = 1;
    if (p.hurt > 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ff4545'; ctx.fillRect(sx - 7, sy - 18 + bob, 14, 18); ctx.globalAlpha = 1; }
    if (this.fx.freeze > 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#29d3ff'; ctx.fillRect(sx - 8, sy - 19, 16, 20); ctx.globalAlpha = 1; }
    // hp bar
    ctx.fillStyle = '#0b0d17'; ctx.fillRect(sx - 8, sy + 2, 16, 3);
    ctx.fillStyle = p.hp / p.maxHp > 0.3 ? '#39ff88' : '#ff4545';
    ctx.fillRect(sx - 7, sy + 3, Math.round(14 * p.hp / p.maxHp), 1);
  }

  private drawHud(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const L = this.level;
    // xp bar
    ctx.fillStyle = '#05040b'; ctx.fillRect(0, 0, W, 4);
    ctx.fillStyle = '#1670a8'; ctx.fillRect(1, 1, Math.round((W - 2) * p.xp / xpNeed(p.lvl)), 2);
    ctx.fillStyle = '#29d3ff'; ctx.fillRect(1, 1, Math.round((W - 2) * p.xp / xpNeed(p.lvl)), 1);
    drawText(ctx, `#${String(L.id).padStart(2, '0')} ${L.name}`, 3, 5, { size: 8, color: '#c8cde6', outline: '#0b0d17' });
    drawText(ctx, `LV ${p.lvl}`, 3, 14, { size: 8, color: '#29d3ff', outline: '#0b0d17' });
    drawText(ctx, `☠ ${this.kills}`, 34, 14, { size: 8, color: '#9aa3c7', outline: '#0b0d17' });
    // timer + objective
    const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    if (this.phase === 'waves') {
      const left = Math.max(0, L.duration - this.time);
      drawText(ctx, fmt(left), W / 2, 5, { size: 12, color: left < 10 ? '#ff9f1c' : '#f4f4f8', outline: '#0b0d17', align: 'center' });
      const bw = 80, bx = W / 2 - bw / 2;
      ctx.fillStyle = '#0b0d17'; ctx.fillRect(bx - 1, 18, bw + 2, 4);
      ctx.fillStyle = '#3a2e5c'; ctx.fillRect(bx, 19, bw, 2);
      ctx.fillStyle = '#ff3d8b'; ctx.fillRect(bx, 19, Math.round(bw * Math.min(1, this.time / L.duration)), 2);
      drawText(ctx, tx('▶ 存活，直到 Boss 降临', '▶ SURVIVE UNTIL THE BOSS ARRIVES'), W / 2, 23, { size: 8, color: '#9aa3c7', outline: '#0b0d17', align: 'center' });
    } else if (this.phase === 'warning') {
      if (Math.floor(this.realT * 4) % 2) drawText(ctx, tx('⚠ Boss 即将降临', '⚠ BOSS INCOMING'), W / 2, 5, { size: 12, color: '#ff4545', outline: '#0b0d17', align: 'center' });
    } else if (this.phase === 'boss') {
      drawText(ctx, `BOSS ${fmt(this.bossTime)}`, W / 2, 5, { size: 12, color: '#ff4545', outline: '#0b0d17', align: 'center' });
      drawText(ctx, tx('目标：', 'GOAL: ') + T(L.goal), W / 2, 18, { size: 8, color: '#ffd23f', outline: '#0b0d17', align: 'center' });
    }
    // pause button
    panel(ctx, W - 14, 6, 11, 11, '#3a2e5c', '#110e22');
    ctx.fillStyle = '#c8cde6'; ctx.fillRect(W - 11, 9, 2, 5); ctx.fillRect(W - 7, 9, 2, 5);
    // weapon slots
    this.weapons.forEach((w, i) => {
      const x = 3 + i * 12, y = H - 13;
      ctx.fillStyle = '#05040b'; ctx.fillRect(x - 1, y - 1, 11, 11);
      ctx.globalAlpha = w.locked > 0 ? 0.3 : 1;
      ctx.drawImage(WEAPONS[w.id].icon, x, y);
      ctx.globalAlpha = 1;
      if (w.locked > 0) { ctx.fillStyle = '#ff4545'; ctx.fillRect(x + 1, y + 4, 7, 1); ctx.fillRect(x + 4, y + 1, 1, 7); }
      ctx.fillStyle = '#ffd23f';
      for (let l = 0; l < w.lvl; l++) ctx.fillRect(x + l * 2, y + 10, 1, 1);
    });
    // status effects
    const fx = this.fx;
    const tags: [string, string][] = [];
    if (fx.invert > 0) tags.push([tx('方向反转', 'INVERTED'), '#ff3d8b']);
    if (fx.freeze > 0) tags.push([tx('链停摆', 'FROZEN'), '#29d3ff']);
    if (fx.gemsLocked) tags.push([tx('暂停提现', 'NO PICKUPS'), '#ff9f1c']);
    if (fx.shieldOff > 0) tags.push([tx('护盾失灵', 'SHIELD DOWN'), '#ff4545']);
    if (fx.drain > 0 && this.phase === 'boss') tags.push([tx('漏财中', 'LEAKING HP'), '#f7931a']);
    tags.forEach(([t, c], i) => drawText(ctx, t, W - 4, 20 + i * 9, { size: 8, color: c, outline: '#0b0d17', align: 'right' }));

    // boss bar
    if (this.phase === 'boss') {
      const bosses = this.bossUnits().filter((e) => e.tag === 'boss');
      const hp = bosses.reduce((s, e) => s + Math.max(0, e.hp), 0), max = bosses.reduce((s, e) => s + e.maxHp, 0);
      const bw = 180, bx = (W - bw) / 2, by = H - 9;
      const immune = bosses.length > 0 && bosses.every((e) => e.invuln);
      drawText(ctx, T(L.boss) + (immune ? tx('  [无敌]', '  [IMMUNE]') : ''), W / 2, by - 10, { size: 8, color: immune ? '#29d3ff' : '#ff9f1c', outline: '#0b0d17', align: 'center' });
      ctx.fillStyle = '#0b0d17'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = '#3a0d16'; ctx.fillRect(bx, by, bw, 4);
      if (max > 0) {
        ctx.fillStyle = immune ? '#1670a8' : '#ff4545'; ctx.fillRect(bx, by, Math.round(bw * hp / max), 4);
        ctx.fillStyle = immune ? '#29d3ff' : '#ff9a9a'; ctx.fillRect(bx, by, Math.round(bw * hp / max), 1);
      }
      this.brain.drawHud?.(this, ctx);
      for (const b of bosses) {
        if (this.onScreen(b.x, b.y, -8) || b.hidden) continue;
        const [sx, sy] = this.toScreen(b.x, b.y - b.r);
        const a = Math.atan2(sy - H / 2, sx - W / 2);
        const px = Math.round(W / 2 + Math.cos(a) * 140), py = Math.round(H / 2 + Math.sin(a) * 70);
        ctx.fillStyle = '#ff4545'; ctx.fillRect(px - 2, py - 2, 5, 5);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(px - 1, py - 1, 3, 3);
      }
    }
    // banners
    for (const b of this.banners) {
      ctx.globalAlpha = Math.min(1, b.life * 2);
      drawText(ctx, b.text, W / 2, 48, { size: 12, color: b.color, outline: '#0b0d17', align: 'center', scale: 2 });
      if (b.sub) {
        let y = 76;
        for (const ln of wrap(b.sub, 8, 260)) { drawText(ctx, ln, W / 2, y, { size: 8, color: '#f4f4f8', outline: '#0b0d17', align: 'center' }); y += 10; }
      }
      ctx.globalAlpha = 1;
    }
    // joystick
    const st = input.stick;
    if (st.active && !this.overlay) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#f4f4f8';
      for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.28; ctx.fillRect(Math.round(st.ox + Math.cos(a) * 18), Math.round(st.oy + Math.sin(a) * 18), 1, 1); }
      const dx = st.x - st.ox, dy = st.y - st.oy, l = Math.hypot(dx, dy), m = Math.min(18, l);
      const kx = l ? st.ox + (dx / l) * m : st.ox, ky = l ? st.oy + (dy / l) * m : st.oy;
      ctx.fillRect(Math.round(kx) - 3, Math.round(ky) - 3, 7, 7);
      ctx.globalAlpha = 1;
    }
  }

  private drawOverlay(ctx: CanvasRenderingContext2D) {
    const t = this.realT;
    const L = this.level;
    const lines = (text: string, y: number, color: string, maxW = 260, max = 3, size: 8 | 12 = 8) => {
      for (const ln of wrap(text, size, maxW).slice(0, max)) { drawText(ctx, ln, W / 2, y, { size, color, align: 'center' }); y += size === 8 ? 10 : 13; }
      return y;
    };
    if (this.overlay === 'intro') {
      dim(ctx, 0.8);
      panel(ctx, 16, 10, 288, 162, '#ff3d8b');
      drawText(ctx, `LEVEL ${String(L.id).padStart(2, '0')} / ${LEVELS.length}  ·  ${L.date}`, W / 2, 14, { size: 8, color: '#9aa3c7', align: 'center' });
      drawText(ctx, L.name, W / 2, 24, { size: 12, color: '#39ff88', outline: '#0b0d17', align: 'center', scale: 2 });
      drawText(ctx, tx('被盗 ', 'STOLEN ') + T(L.loss), W / 2, 51, { size: 12, color: '#ff4545', align: 'center' });
      lines(T(L.flavor), 66, '#c8cde6', 268, 3);
      ctx.fillStyle = '#3a2e5c'; ctx.fillRect(40, 98, 240, 1);
      drawText(ctx, tx('胜利条件', 'HOW TO WIN'), W / 2, 101, { size: 8, color: '#ffd23f', align: 'center' });
      const mm = Math.floor(L.duration / 60), ss = String(L.duration % 60).padStart(2, '0');
      drawText(ctx, tx(`① 坚持 ${mm}:${ss}，直到 Boss 降临`, `① Survive ${mm}:${ss} until the boss arrives`), W / 2, 111, { size: 8, color: '#f4f4f8', align: 'center' });
      drawText(ctx, tx('② ', '② ') + T(L.goal), W / 2, 121, { size: 8, color: '#f4f4f8', align: 'center' });
      lines(tx('Boss「', 'BOSS ') + T(L.boss) + tx('」：', ': ') + T(L.hint), 134, '#29d3ff', 268, 2);
      if (t % 1 < 0.7) drawText(ctx, tx('▶ 点击 / 按任意键开战', '▶ TAP / PRESS ANY KEY TO FIGHT'), W / 2, 155, { size: 12, color: '#f4f4f8', align: 'center' });
    } else if (this.overlay === 'levelup') {
      dim(ctx, 0.7);
      drawText(ctx, tx('升级！选一张卡', 'LEVEL UP! PICK ONE'), W / 2, 24, { size: 12, color: '#ffd23f', outline: '#0b0d17', align: 'center' });
      this.choices.forEach((c, i) => {
        const x = this.cardX(i), y = 46, on = i === this.choiceSel;
        panel(ctx, x, y, 96, 100, on ? '#ffd23f' : '#3a2e5c', on ? '#221a38' : '#110e22');
        const glitch = c.fake && Math.floor(t * 7) % 9 === 0;
        ctx.save();
        ctx.translate(x + 48 - 9, y + 8);
        ctx.scale(2, 2);
        ctx.drawImage(c.icon, glitch ? 1 : 0, 0);
        ctx.restore();
        let name = c.name;
        if (glitch) name = name.slice(0, -1) + '▒';
        const nameSize = textWidth(name, 12) <= 90 ? 12 : 8;
        drawText(ctx, name, x + 48, y + (nameSize === 12 ? 30 : 32), { size: nameSize, color: '#f4f4f8', align: 'center' });
        const isNew = c.lvl === 1 && c.kind === 'weapon';
        drawText(ctx, c.kind === 'heal' ? '' : isNew ? tx('新武器', 'NEW WEAPON') : `Lv ${c.lvl}`, x + 48, y + 44, { size: 8, color: isNew ? '#39ff88' : '#29d3ff', align: 'center' });
        let ly = y + 57;
        for (const ln of wrap(c.desc, 8, 88).slice(0, 4)) { drawText(ctx, ln, x + 48, ly, { size: 8, color: '#c8cde6', align: 'center' }); ly += 10; }
        drawText(ctx, String(i + 1), x + 4, y + 2, { size: 8, color: '#5d6690' });
      });
      drawText(ctx, tx('点击卡片 / 方向键 + 回车 / 数字键 1-3', 'Tap a card / Arrows + Enter / Keys 1-3'), W / 2, 154, { size: 8, color: '#5d6690', align: 'center' });
    } else if (this.overlay === 'pause') {
      dim(ctx, 0.7);
      drawText(ctx, tx('暂停', 'PAUSED'), W / 2, 22, { size: 12, color: '#f4f4f8', outline: '#0b0d17', align: 'center', scale: 2 });
      drawText(ctx, tx('目标：', 'GOAL: ') + T(L.goal), W / 2, 50, { size: 8, color: '#ffd23f', align: 'center' });
      this.drawBuild(ctx, 160);
      this.menu?.draw(ctx, t);
    } else if (this.overlay === 'clear') {
      dim(ctx, 0.85);
      drawText(ctx, tx('胜利！', 'VICTORY!'), W / 2, 20, { size: 12, color: '#39ff88', outline: '#0b0d17', align: 'center', scale: 3 });
      drawText(ctx, tx(`${T(L.boss)} 已被击败`, `${T(L.boss)} defeated`), W / 2, 60, { size: 12, color: '#f4f4f8', align: 'center' });
      const mm = Math.floor(this.time / 60), ss = String(Math.floor(this.time % 60)).padStart(2, '0');
      drawText(ctx, tx(`用时 ${mm}:${ss}   击杀 ${this.kills}   等级 ${this.player.lvl}`, `Time ${mm}:${ss}   Kills ${this.kills}   Level ${this.player.lvl}`), W / 2, 76, { size: 8, color: '#ffd23f', align: 'center' });
      const next = LEVELS[this.idx + 1];
      drawText(ctx, next ? tx(`已解锁第 ${next.id} 关：${next.date} ${next.name}`, `Unlocked level ${next.id}: ${next.date} ${next.name}`) : tx('你在整部 Crypto 黑客史中幸存了下来！', 'You survived the entire history of crypto hacks!'), W / 2, 92, { size: 8, color: '#29d3ff', align: 'center' });
      this.menu?.draw(ctx, t);
    } else if (this.overlay === 'dead') {
      dim(ctx, 0.85);
      drawText(ctx, 'REKT', W / 2, 18, { size: 12, color: '#ff4545', outline: '#0b0d17', align: 'center', scale: 3 });
      const killer = this.phase === 'boss'
        ? tx(`你被「${T(L.boss)}」掏空了`, `${T(L.boss)} drained you`)
        : tx(`倒在黑客大军中，离 Boss 还差 ${Math.ceil(L.duration - this.time)} 秒`, `Swarmed ${Math.ceil(L.duration - this.time)}s before the boss`);
      drawText(ctx, killer, W / 2, 58, { size: 12, color: '#f4f4f8', align: 'center' });
      drawText(ctx, tx(`坚持 ${Math.floor(this.time)} 秒 · 击杀 ${this.kills} · 等级 ${this.player.lvl}`, `Survived ${Math.floor(this.time)}s · Kills ${this.kills} · Level ${this.player.lvl}`), W / 2, 74, { size: 8, color: '#9aa3c7', align: 'center' });
      lines(tx('提示：', 'TIP: ') + T(L.hint), 88, '#29d3ff', 260, 2);
      this.menu?.draw(ctx, t);
    }
  }

  private drawBuild(ctx: CanvasRenderingContext2D, y: number) {
    const items: [HTMLCanvasElement, number][] = [
      ...this.weapons.map((w) => [WEAPONS[w.id].icon, w.lvl] as [HTMLCanvasElement, number]),
      ...(Object.keys(this.passives) as PassiveId[]).filter((k) => this.passives[k] > 0).map((k) => [PASSIVES[k].icon, this.passives[k]] as [HTMLCanvasElement, number]),
    ];
    const x0 = W / 2 - (items.length * 14) / 2;
    items.forEach(([icon, lvl], i) => {
      ctx.drawImage(icon, x0 + i * 14, y);
      drawText(ctx, String(lvl), x0 + i * 14 + 10, y + 4, { size: 8, color: '#ffd23f' });
    });
  }
}
