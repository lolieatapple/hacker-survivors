// Weapons and passive upgrades. Every weapon fires automatically.
import type { Game } from '../scenes/game';
import { line } from '../gfx';
import { ICONS } from './art';
import { T, tx, type Text } from '../i18n';

export type WeaponId = 'bolt' | 'orbit' | 'aura' | 'laser' | 'storm' | 'mine';
export type PassiveId = 'hp' | 'armor' | 'speed' | 'power' | 'haste' | 'magnet' | 'regen';

export interface OwnedWeapon { id: WeaponId; lvl: number; cd: number; locked: number }

export const MAX_LVL = 5;

interface WeaponDef {
  name: Text;
  icon: HTMLCanvasElement;
  desc: Text[]; // index = level being acquired - 1
  update(g: Game, w: OwnedWeapon, dt: number): void;
  draw?(g: Game, w: OwnedWeapon, ctx: CanvasRenderingContext2D): void;
}

const L = (w: OwnedWeapon) => w.lvl - 1;

const BOLT = { dmg: [12, 14, 17, 20, 24], cd: [0.5, 0.45, 0.4, 0.36, 0.32], n: [1, 1, 2, 2, 3], pierce: [0, 1, 1, 2, 2] };
const ORBIT = { n: [2, 3, 3, 4, 5], dmg: [8, 10, 13, 16, 20], r: [24, 26, 28, 30, 34], spin: [2.8, 3, 3.2, 3.4, 3.8] };
const AURA = { r: [22, 26, 30, 34, 40], dmg: [5, 6, 8, 10, 13] };
const LASER = { dmg: [24, 30, 38, 48, 60], cd: [1.8, 1.6, 1.4, 1.2, 1.0], len: [110, 130, 150, 170, 200] };
const STORM = { n: [1, 2, 2, 3, 4], dmg: [28, 32, 38, 44, 52], cd: [2.0, 1.8, 1.6, 1.4, 1.2], r: [12, 12, 14, 16, 18] };
const MINE = { dmg: [30, 38, 46, 56, 70], r: [18, 20, 22, 25, 28], cd: [2.2, 2.0, 1.8, 1.6, 1.3] };

export function orbitPositions(g: Game, w: OwnedWeapon): [number, number][] {
  const n = ORBIT.n[L(w)], r = ORBIT.r[L(w)], spin = ORBIT.spin[L(w)];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = g.time * spin + (i * Math.PI * 2) / n;
    out.push([g.player.x + Math.cos(a) * r, g.player.y - 5 + Math.sin(a) * r * 0.6]);
  }
  return out;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bolt: {
    name: { zh: '防火墙弹', en: 'Firewall Bolt' }, icon: ICONS.bolt,
    desc: [{ zh: '自动射向最近的敌人，优先锁定 Boss', en: 'Auto-fires at the nearest enemy, locks onto bosses' }, { zh: '伤害提升，可穿透 1 个', en: 'More damage, pierces 1' }, { zh: '每次发射 2 发', en: 'Fires 2 bolts' }, { zh: '伤害提升，穿透 +1', en: 'More damage, +1 pierce' }, { zh: '每次发射 3 发，射速更快', en: 'Fires 3 bolts, faster' }],
    update(g, w, dt) {
      w.cd -= dt * g.hasteMul();
      if (w.cd > 0) return;
      const boss = g.priorityTarget(170);
      const targets = g.nearestEnemies(BOLT.n[L(w)], 170).filter((e) => e !== boss);
      if (boss) { targets.unshift(boss); targets.length = Math.min(targets.length, BOLT.n[L(w)]); }
      if (!targets.length) return;
      w.cd = BOLT.cd[L(w)];
      const p = g.player;
      targets.forEach((t, i) => {
        const a = Math.atan2(t.y - t.r - (p.y - 8), t.x - p.x) + (i - (targets.length - 1) / 2) * 0.05;
        g.addShot(p.x, p.y - 8, Math.cos(a) * 190, Math.sin(a) * 190, BOLT.dmg[L(w)], BOLT.pierce[L(w)], t === boss);
      });
      g.sound('shoot');
    },
  },
  orbit: {
    name: { zh: '冷钱包护盾', en: 'Cold Wallet Shield' }, icon: ICONS.orbit,
    desc: [{ zh: '2 个冷钱包环绕身边，撞击敌人、挡下子弹', en: '2 cold wallets orbit you, ram enemies and block bullets' }, { zh: '+1 个冷钱包', en: '+1 cold wallet' }, { zh: '伤害提升，范围扩大', en: 'More damage, wider orbit' }, { zh: '+1 个冷钱包', en: '+1 cold wallet' }, { zh: '+1 个冷钱包，转速提升', en: '+1 cold wallet, spins faster' }],
    update(g, w) {
      if (g.fx.shieldOff > 0) return;
      const orbs = orbitPositions(g, w);
      const reach = ORBIT.r[L(w)] + 14;
      g.queryEnemies(g.player.x, g.player.y - 5, reach, (e) => {
        if (e.orbCd > 0) return;
        for (const [ox, oy] of orbs) {
          if (Math.hypot(ox - e.x, oy - (e.y - e.r)) < e.r + 4) {
            e.orbCd = 0.45;
            g.damageEnemy(e, ORBIT.dmg[L(w)], ox, oy);
            break;
          }
        }
      });
    },
  },
  aura: {
    name: { zh: '多签结界', en: 'Multisig Aura' }, icon: ICONS.aura,
    desc: [{ zh: '持续伤害身边的敌人', en: 'Constantly damages nearby enemies' }, { zh: '范围扩大', en: 'Bigger radius' }, { zh: '伤害提升', en: 'More damage' }, { zh: '范围扩大', en: 'Bigger radius' }, { zh: '伤害与范围大幅提升', en: 'Huge damage and radius boost' }],
    update(g, w, dt) {
      w.cd -= dt;
      if (w.cd > 0) return;
      w.cd = 0.5;
      g.queryEnemies(g.player.x, g.player.y - 4, AURA.r[L(w)], (e) => g.damageEnemy(e, AURA.dmg[L(w)]));
    },
    draw(g, w, ctx) {
      const r = AURA.r[L(w)];
      const [sx, sy] = g.toScreen(g.player.x, g.player.y - 4);
      const n = Math.round(r * 1.6);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < n; i++) {
        if (i % 4 === 0) continue;
        const a = (i / n) * Math.PI * 2 + g.time * 0.7;
        ctx.fillStyle = i % 2 ? '#39ff88' : '#1e9e5a';
        ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r * 0.6), 1, 1);
      }
      ctx.globalAlpha = 1;
    },
  },
  laser: {
    name: { zh: '审计激光', en: 'Audit Laser' }, icon: ICONS.laser,
    desc: [{ zh: '朝移动方向发射贯穿激光', en: 'Piercing beam in the direction you move' }, { zh: '伤害提升，射程更远', en: 'More damage, longer range' }, { zh: '冷却缩短', en: 'Shorter cooldown' }, { zh: '伤害提升，射程更远', en: 'More damage, longer range' }, { zh: '伤害大幅提升', en: 'Huge damage boost' }],
    update(g, w, dt) {
      w.cd -= dt * g.hasteMul();
      if (w.cd > 0) return;
      w.cd = LASER.cd[L(w)];
      const p = g.player;
      const [fx, fy] = p.facing;
      const len = LASER.len[L(w)];
      const x0 = p.x, y0 = p.y - 8, x1 = x0 + fx * len, y1 = y0 + fy * len;
      g.beams.push({ x0, y0, x1, y1, life: 0.18, color: '#ff4545' });
      g.queryEnemies((x0 + x1) / 2, (y0 + y1) / 2, len / 2 + 20, (e) => {
        const ex = e.x, ey = e.y - e.r;
        const t = Math.max(0, Math.min(1, ((ex - x0) * fx + (ey - y0) * fy) / len));
        const d = Math.hypot(x0 + fx * len * t - ex, y0 + fy * len * t - ey);
        if (d < e.r + 3) g.damageEnemy(e, LASER.dmg[L(w)]);
      });
      g.sound('zap');
    },
  },
  storm: {
    name: { zh: '哈希风暴', en: 'Hash Storm' }, icon: ICONS.storm,
    desc: [{ zh: '随机雷击屏幕内的敌人', en: 'Lightning strikes random enemies on screen' }, { zh: '每次 2 道雷', en: '2 strikes' }, { zh: '伤害提升，范围扩大', en: 'More damage, bigger blast' }, { zh: '每次 3 道雷', en: '3 strikes' }, { zh: '每次 4 道雷', en: '4 strikes' }],
    update(g, w, dt) {
      w.cd -= dt * g.hasteMul();
      if (w.cd > 0) return;
      const pool = g.onScreenEnemies();
      if (!pool.length) return;
      w.cd = STORM.cd[L(w)];
      for (let i = 0; i < STORM.n[L(w)]; i++) {
        const t = pool[Math.floor(Math.random() * pool.length)];
        g.lightning(t.x, t.y - t.r);
        g.queryEnemies(t.x, t.y, STORM.r[L(w)], (e) => g.damageEnemy(e, STORM.dmg[L(w)]));
      }
      g.sound('zap');
    },
  },
  mine: {
    name: { zh: 'Gas 地雷', en: 'Gas Mine' }, icon: ICONS.mine,
    desc: [{ zh: '在脚下布雷，敌人一碰就炸', en: 'Drops mines that blow up on contact' }, { zh: '伤害提升', en: 'More damage' }, { zh: '爆炸范围扩大', en: 'Bigger blast' }, { zh: '布雷更快', en: 'Drops mines faster' }, { zh: '伤害与范围大幅提升', en: 'Huge damage and blast boost' }],
    update(g, w, dt) {
      w.cd -= dt * g.hasteMul();
      if (w.cd > 0) return;
      w.cd = MINE.cd[L(w)];
      g.mines.push({ x: g.player.x, y: g.player.y, fuse: 4, dmg: MINE.dmg[L(w)], r: MINE.r[L(w)] });
    },
  },
};

export const PASSIVES: Record<PassiveId, { name: Text; icon: HTMLCanvasElement; desc: Text }> = {
  hp: { name: { zh: '硬件钱包', en: 'Hardware Wallet' }, icon: ICONS.hp, desc: { zh: '最大生命 +20', en: 'Max HP +20' } },
  armor: { name: { zh: '2FA 认证', en: '2FA' }, icon: ICONS.armor, desc: { zh: '每次受到的伤害 -1', en: 'Take 1 less damage per hit' } },
  speed: { name: { zh: '节点加速', en: 'Node Boost' }, icon: ICONS.speed, desc: { zh: '移动速度 +8%', en: 'Move speed +8%' } },
  power: { name: { zh: '算力提升', en: 'Hashpower' }, icon: ICONS.power, desc: { zh: '所有伤害 +10%', en: 'All damage +10%' } },
  haste: { name: { zh: '低 Gas 费', en: 'Low Gas' }, icon: ICONS.haste, desc: { zh: '武器冷却 -8%', en: 'Weapon cooldown -8%' } },
  magnet: { name: { zh: '空投猎人', en: 'Airdrop Hunter' }, icon: ICONS.magnet, desc: { zh: '拾取范围 +30%', en: 'Pickup range +30%' } },
  regen: { name: { zh: '质押收益', en: 'Staking Yield' }, icon: ICONS.regen, desc: { zh: '每秒回复 0.4 生命', en: 'Regenerate 0.4 HP/s' } },
};

export interface Choice {
  kind: 'weapon' | 'passive' | 'heal';
  id: WeaponId | PassiveId | 'heal';
  name: string;
  icon: HTMLCanvasElement;
  lvl: number;  // level after picking
  desc: string;
  fake?: boolean;
}

export function rollChoices(g: Game, n: number): Choice[] {
  const pool: Choice[] = [];
  for (const id of Object.keys(WEAPONS) as WeaponId[]) {
    const owned = g.weapons.find((w) => w.id === id);
    if (owned && owned.lvl >= MAX_LVL) continue;
    if (!owned && g.weapons.length >= 5) continue;
    const lvl = owned ? owned.lvl + 1 : 1;
    pool.push({ kind: 'weapon', id, name: T(WEAPONS[id].name), icon: WEAPONS[id].icon, lvl, desc: T(WEAPONS[id].desc[lvl - 1]) });
  }
  for (const id of Object.keys(PASSIVES) as PassiveId[]) {
    const lvl = g.passives[id] + 1;
    if (lvl > MAX_LVL) continue;
    pool.push({ kind: 'passive', id, name: T(PASSIVES[id].name), icon: PASSIVES[id].icon, lvl, desc: T(PASSIVES[id].desc) });
  }
  const out: Choice[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  while (out.length < n) out.push({ kind: 'heal', id: 'heal', name: tx('稳定币补给', 'Stablecoin Refill'), icon: ICONS.heal, lvl: 0, desc: tx('回复 30 生命', 'Restore 30 HP') });
  return out;
}

/** Visual helpers used by weapons that draw lines/bolts. */
export function drawLightning(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  let cx = x, cy = -4;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  while (cy < y) {
    const nx = x + (rnd() - 0.5) * 14 * (1 - cy / Math.max(1, y)), ny = Math.min(y, cy + 6 + rnd() * 8);
    line(ctx, cx, cy, nx, ny, '#ffd23f');
    line(ctx, cx + 1, cy, nx + 1, ny, '#fff6c0');
    cx = nx; cy = ny;
  }
}

