// Weapons and passive upgrades. Every weapon fires automatically.
// A run carries the build through all 28 stages, so growth must never run out:
//   Lv 1–9   stat tables below
//   Lv 10    EVOLUTION: new name and a new trick
//   Lv 11+   overclock: +15% damage per level, no cap
import type { Game } from '../scenes/game';
import { line } from '../gfx';
import { ICONS } from './art';
import { T, tx, type Text } from '../i18n';

export type WeaponId = 'bolt' | 'orbit' | 'aura' | 'laser' | 'storm' | 'mine';
export type PassiveId = 'hp' | 'armor' | 'speed' | 'power' | 'haste' | 'magnet' | 'regen';

export interface OwnedWeapon { id: WeaponId; lvl: number; cd: number; locked: number; ticks: number }

export const EVO_LVL = 10;
const OVERCLOCK = 0.15;

type Table = Record<string, number[]>;
const tier = (w: { lvl: number }) => Math.min(w.lvl, EVO_LVL) - 1;
const over = (w: { lvl: number }) => 1 + Math.max(0, w.lvl - EVO_LVL) * OVERCLOCK;
const evolved = (w: { lvl: number }) => w.lvl >= EVO_LVL;

const BOLT: Table = {
  dmg: [12, 14, 17, 20, 24, 28, 32, 37, 42, 50], cd: [0.5, 0.45, 0.4, 0.36, 0.32, 0.3, 0.28, 0.26, 0.24, 0.2],
  n: [1, 1, 2, 2, 3, 3, 4, 4, 5, 6], pierce: [0, 1, 1, 2, 2, 3, 3, 4, 4, 6],
};
const ORBIT: Table = {
  n: [2, 3, 3, 4, 5, 5, 6, 6, 7, 8], dmg: [8, 10, 13, 16, 20, 24, 28, 32, 37, 45],
  r: [24, 26, 28, 30, 34, 36, 38, 40, 42, 46], spin: [2.8, 3, 3.2, 3.4, 3.8, 3.9, 4, 4.1, 4.2, 4.5],
};
const AURA: Table = { r: [22, 26, 30, 34, 40, 43, 46, 50, 54, 60], dmg: [5, 6, 8, 10, 13, 15, 17, 20, 23, 28] };
const LASER: Table = {
  dmg: [24, 30, 38, 48, 60, 70, 80, 92, 105, 120], cd: [1.8, 1.6, 1.4, 1.2, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7],
  len: [110, 130, 150, 170, 200, 210, 220, 230, 240, 260],
};
const STORM: Table = {
  n: [1, 2, 2, 3, 4, 4, 5, 5, 6, 8], dmg: [28, 32, 38, 44, 52, 58, 64, 72, 80, 95],
  cd: [2.0, 1.8, 1.6, 1.4, 1.2, 1.15, 1.1, 1.05, 1.0, 0.9], r: [12, 12, 14, 16, 18, 19, 20, 21, 22, 26],
};
const MINE: Table = {
  dmg: [30, 38, 46, 56, 70, 80, 90, 100, 115, 135], r: [18, 20, 22, 25, 28, 30, 32, 34, 36, 42],
  cd: [2.2, 2.0, 1.8, 1.6, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8],
};
for (const [name, t] of Object.entries({ BOLT, ORBIT, AURA, LASER, STORM, MINE })) {
  for (const [k, v] of Object.entries(t)) if (v.length !== EVO_LVL) throw new Error(`${name}.${k} has ${v.length} levels, expected ${EVO_LVL}`);
}

export function orbitPositions(g: Game, w: OwnedWeapon): [number, number][] {
  const i0 = tier(w);
  const n = ORBIT.n[i0], r = ORBIT.r[i0], spin = ORBIT.spin[i0];
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = g.time * spin + (i * Math.PI * 2) / n;
    out.push([g.player.x + Math.cos(a) * r, g.player.y - 5 + Math.sin(a) * r * 0.6]);
  }
  if (evolved(w)) { // Cold Storage Matrix: a second ring spinning the other way
    for (let i = 0; i < 4; i++) {
      const a = -g.time * spin * 1.4 + (i * Math.PI) / 2;
      out.push([g.player.x + Math.cos(a) * r * 0.55, g.player.y - 5 + Math.sin(a) * r * 0.55 * 0.6]);
    }
  }
  return out;
}

interface WeaponDef {
  name: Text;
  evoName: Text;
  evoDesc: Text;
  icon: HTMLCanvasElement;
  desc: Text[]; // hand-written text for Lv 1–5
  table: Table;
  update(g: Game, w: OwnedWeapon, dt: number): void;
  draw?(g: Game, w: OwnedWeapon, ctx: CanvasRenderingContext2D): void;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  bolt: {
    name: { zh: '防火墙弹', en: 'Firewall Bolt' }, evoName: { zh: '零知识弹幕', en: 'ZK Barrage' }, icon: ICONS.bolt, table: BOLT,
    desc: [{ zh: '自动射向最近的敌人，优先锁定 Boss', en: 'Auto-fires at the nearest enemy, locks onto bosses' }, { zh: '伤害提升，可穿透 1 个', en: 'More damage, pierces 1' }, { zh: '每次发射 2 发', en: 'Fires 2 bolts' }, { zh: '伤害提升，穿透 +1', en: 'More damage, +1 pierce' }, { zh: '每次发射 3 发，射速更快', en: 'Fires 3 bolts, faster' }],
    evoDesc: { zh: '金色弹幕，每 4 轮额外向四周齐射 12 发', en: 'Golden bolts; every 4th volley adds a 12-bolt ring' },
    update(g, w, dt) {
      w.cd -= dt * g.hasteMul();
      if (w.cd > 0) return;
      const i0 = tier(w), n = BOLT.n[i0], dmg = BOLT.dmg[i0] * over(w), evo = evolved(w);
      const boss = g.priorityTarget(170);
      const targets = g.nearestEnemies(n, 170).filter((e) => e !== boss);
      if (boss) { targets.unshift(boss); targets.length = Math.min(targets.length, n); }
      if (!targets.length) return;
      w.cd = BOLT.cd[i0];
      w.ticks++;
      const p = g.player;
      targets.forEach((t, i) => {
        const a = Math.atan2(t.y - t.r - (p.y - 8), t.x - p.x) + (i - (targets.length - 1) / 2) * 0.05;
        g.addShot(p.x, p.y - 8, Math.cos(a) * 190, Math.sin(a) * 190, dmg, BOLT.pierce[i0], t === boss, evo);
      });
      if (evo && w.ticks % 4 === 0) {
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + w.ticks; g.addShot(p.x, p.y - 8, Math.cos(a) * 170, Math.sin(a) * 170, dmg, BOLT.pierce[i0], false, true); }
      }
      g.sound('shoot');
    },
  },
  orbit: {
    name: { zh: '冷钱包护盾', en: 'Cold Wallet Shield' }, evoName: { zh: '冷存储矩阵', en: 'Cold Storage Matrix' }, icon: ICONS.orbit, table: ORBIT,
    desc: [{ zh: '2 个冷钱包环绕身边，撞击敌人、挡下子弹', en: '2 cold wallets orbit you, ram enemies and block bullets' }, { zh: '+1 个冷钱包', en: '+1 cold wallet' }, { zh: '伤害提升，范围扩大', en: 'More damage, wider orbit' }, { zh: '+1 个冷钱包', en: '+1 cold wallet' }, { zh: '+1 个冷钱包，转速提升', en: '+1 cold wallet, spins faster' }],
    evoDesc: { zh: '内圈再加 4 个冷钱包，反向旋转', en: 'Adds an inner ring of 4 wallets spinning the other way' },
    update(g, w) {
      if (g.fx.shieldOff > 0) return;
      const orbs = orbitPositions(g, w);
      const i0 = tier(w), reach = ORBIT.r[i0] + 14, dmg = ORBIT.dmg[i0] * over(w);
      g.queryEnemies(g.player.x, g.player.y - 5, reach, (e) => {
        if (e.orbCd > 0) return;
        for (const [ox, oy] of orbs) {
          if (Math.hypot(ox - e.x, oy - (e.y - e.r)) < e.r + 4) {
            e.orbCd = 0.45;
            g.damageEnemy(e, dmg, ox, oy);
            break;
          }
        }
      });
    },
  },
  aura: {
    name: { zh: '多签结界', en: 'Multisig Aura' }, evoName: { zh: '门限签名领域', en: 'Threshold Field' }, icon: ICONS.aura, table: AURA,
    desc: [{ zh: '持续伤害身边的敌人', en: 'Constantly damages nearby enemies' }, { zh: '范围扩大', en: 'Bigger radius' }, { zh: '伤害提升', en: 'More damage' }, { zh: '范围扩大', en: 'Bigger radius' }, { zh: '伤害与范围大幅提升', en: 'Huge damage and radius boost' }],
    evoDesc: { zh: '结界内的敌人移动速度减半', en: 'Enemies inside move at half speed' },
    update(g, w, dt) {
      w.cd -= dt;
      if (w.cd > 0) return;
      w.cd = 0.5;
      const i0 = tier(w), evo = evolved(w), dmg = AURA.dmg[i0] * over(w);
      g.queryEnemies(g.player.x, g.player.y - 4, AURA.r[i0], (e) => {
        if (evo && !e.boss) e.data.slowUntil = g.time + 0.6;
        g.damageEnemy(e, dmg);
      });
    },
    draw(g, w, ctx) {
      const r = AURA.r[tier(w)], evo = evolved(w);
      const [sx, sy] = g.toScreen(g.player.x, g.player.y - 4);
      const n = Math.round(r * 1.6);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < n; i++) {
        if (i % 4 === 0) continue;
        const a = (i / n) * Math.PI * 2 + g.time * 0.7;
        ctx.fillStyle = evo ? (i % 2 ? '#ffd23f' : '#39ff88') : i % 2 ? '#39ff88' : '#1e9e5a';
        ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r * 0.6), 1, 1);
        if (evo && i % 3 === 0) { // inner counter-ring
          const b = -(i / n) * Math.PI * 2 - g.time;
          ctx.fillRect(Math.round(sx + Math.cos(b) * r * 0.7), Math.round(sy + Math.sin(b) * r * 0.42), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    },
  },
  laser: {
    name: { zh: '审计激光', en: 'Audit Laser' }, evoName: { zh: '全链审计', en: 'Full-Chain Audit' }, icon: ICONS.laser, table: LASER,
    desc: [{ zh: '朝移动方向发射贯穿激光', en: 'Piercing beam in the direction you move' }, { zh: '伤害提升，射程更远', en: 'More damage, longer range' }, { zh: '冷却缩短', en: 'Shorter cooldown' }, { zh: '伤害提升，射程更远', en: 'More damage, longer range' }, { zh: '伤害大幅提升', en: 'Huge damage boost' }],
    evoDesc: { zh: '同时向前后左右 4 个方向发射', en: 'Fires in all 4 directions at once' },
    update(g, w, dt) {
      w.cd -= dt * g.hasteMul();
      if (w.cd > 0) return;
      const i0 = tier(w), evo = evolved(w);
      w.cd = LASER.cd[i0];
      const p = g.player;
      const [fx, fy] = p.facing;
      const dirs: [number, number][] = evo ? [[fx, fy], [-fx, -fy], [-fy, fx], [fy, -fx]] : [[fx, fy]];
      const len = LASER.len[i0], dmg = LASER.dmg[i0] * over(w);
      for (const [dx, dy] of dirs) {
        const x0 = p.x, y0 = p.y - 8, x1 = x0 + dx * len, y1 = y0 + dy * len;
        g.beams.push({ x0, y0, x1, y1, life: 0.18, color: evo ? '#ffd23f' : '#ff4545' });
        g.queryEnemies((x0 + x1) / 2, (y0 + y1) / 2, len / 2 + 20, (e) => {
          const ex = e.x, ey = e.y - e.r;
          const t = Math.max(0, Math.min(1, ((ex - x0) * dx + (ey - y0) * dy) / len));
          const d = Math.hypot(x0 + dx * len * t - ex, y0 + dy * len * t - ey);
          if (d < e.r + 3) g.damageEnemy(e, dmg);
        });
      }
      g.sound('zap');
    },
  },
  storm: {
    name: { zh: '哈希风暴', en: 'Hash Storm' }, evoName: { zh: '51% 风暴', en: '51% Storm' }, icon: ICONS.storm, table: STORM,
    desc: [{ zh: '随机雷击屏幕内的敌人', en: 'Lightning strikes random enemies on screen' }, { zh: '每次 2 道雷', en: '2 strikes' }, { zh: '伤害提升，范围扩大', en: 'More damage, bigger blast' }, { zh: '每次 3 道雷', en: '3 strikes' }, { zh: '每次 4 道雷', en: '4 strikes' }],
    evoDesc: { zh: '每道雷再连锁劈中附近 2 个敌人', en: 'Each strike chains to 2 more enemies nearby' },
    update(g, w, dt) {
      w.cd -= dt * g.hasteMul();
      if (w.cd > 0) return;
      const pool = g.onScreenEnemies();
      if (!pool.length) return;
      const i0 = tier(w), evo = evolved(w), dmg = STORM.dmg[i0] * over(w), r = STORM.r[i0];
      w.cd = STORM.cd[i0];
      for (let i = 0; i < STORM.n[i0]; i++) {
        const t = pool[Math.floor(Math.random() * pool.length)];
        g.lightning(t.x, t.y - t.r);
        g.queryEnemies(t.x, t.y, r, (e) => g.damageEnemy(e, dmg));
        if (evo) {
          const chain: typeof pool = [];
          g.queryEnemies(t.x, t.y, 60, (e) => { if (e !== t && chain.length < 2 && !e.dead) chain.push(e); });
          for (const c of chain) { g.lightning(c.x, c.y - c.r); g.damageEnemy(c, dmg); }
        }
      }
      g.sound('zap');
    },
  },
  mine: {
    name: { zh: 'Gas 地雷', en: 'Gas Mine' }, evoName: { zh: 'Gas 战争', en: 'Gas War' }, icon: ICONS.mine, table: MINE,
    desc: [{ zh: '在脚下布雷，敌人一碰就炸', en: 'Drops mines that blow up on contact' }, { zh: '伤害提升', en: 'More damage' }, { zh: '爆炸范围扩大', en: 'Bigger blast' }, { zh: '布雷更快', en: 'Drops mines faster' }, { zh: '伤害与范围大幅提升', en: 'Huge damage and blast boost' }],
    evoDesc: { zh: '每次在身边布下 3 颗雷', en: 'Drops 3 mines around you at once' },
    update(g, w, dt) {
      w.cd -= dt * g.hasteMul();
      if (w.cd > 0) return;
      const i0 = tier(w), dmg = MINE.dmg[i0] * over(w), r = MINE.r[i0];
      w.cd = MINE.cd[i0];
      if (evolved(w)) {
        for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + g.time; g.mines.push({ x: g.player.x + Math.cos(a) * 14, y: g.player.y + Math.sin(a) * 9, fuse: 4, dmg, r }); }
      } else g.mines.push({ x: g.player.x, y: g.player.y, fuse: 4, dmg, r });
    },
  },
};

const STAT_LABEL: Record<string, Text> = {
  dmg: { zh: '伤害', en: 'DMG' }, cd: { zh: '冷却', en: 'CD' }, n: { zh: '数量', en: 'Count' }, pierce: { zh: '穿透', en: 'Pierce' },
  r: { zh: '范围', en: 'Area' }, len: { zh: '射程', en: 'Range' }, spin: { zh: '转速', en: 'Spin' },
};
const num = (v: number) => String(Math.round(v * 100) / 100);

export const weaponName = (id: WeaponId, lvl: number): string => T(lvl >= EVO_LVL ? WEAPONS[id].evoName : WEAPONS[id].name);

/** Card text for reaching `lvl`. Lv 6–9 list the exact stat changes. */
export function weaponDesc(id: WeaponId, lvl: number): string {
  const d = WEAPONS[id];
  if (lvl <= d.desc.length) return T(d.desc[lvl - 1]);
  if (lvl === EVO_LVL) return T(d.evoDesc);
  if (lvl > EVO_LVL) return tx(`超频：伤害 +${Math.round(OVERCLOCK * 100)}%`, `Overclock: +${Math.round(OVERCLOCK * 100)}% damage`);
  const parts: string[] = [];
  for (const [k, t] of Object.entries(d.table)) {
    const a = t[lvl - 2], b = t[lvl - 1];
    if (a !== b) parts.push(`${T(STAT_LABEL[k])} ${num(a)}→${num(b)}`);
  }
  if (!parts.length) throw new Error(`${id} Lv ${lvl} changes nothing`);
  return parts.join(tx('，', ', '));
}

export const PASSIVES: Record<PassiveId, { name: Text; icon: HTMLCanvasElement; desc: Text; max: number }> = {
  hp: { name: { zh: '硬件钱包', en: 'Hardware Wallet' }, icon: ICONS.hp, desc: { zh: '最大生命 +20', en: 'Max HP +20' }, max: 10 },
  armor: { name: { zh: '2FA 认证', en: '2FA' }, icon: ICONS.armor, desc: { zh: '受到的伤害 -7%', en: 'Take 7% less damage' }, max: 5 },
  speed: { name: { zh: '节点加速', en: 'Node Boost' }, icon: ICONS.speed, desc: { zh: '移动速度 +8%', en: 'Move speed +8%' }, max: 5 },
  power: { name: { zh: '算力提升', en: 'Hashpower' }, icon: ICONS.power, desc: { zh: '所有伤害 +10%', en: 'All damage +10%' }, max: 10 },
  haste: { name: { zh: '低 Gas 费', en: 'Low Gas' }, icon: ICONS.haste, desc: { zh: '武器冷却 -8%', en: 'Weapon cooldown -8%' }, max: 5 },
  magnet: { name: { zh: '空投猎人', en: 'Airdrop Hunter' }, icon: ICONS.magnet, desc: { zh: '拾取范围 +30%', en: 'Pickup range +30%' }, max: 5 },
  regen: { name: { zh: '质押收益', en: 'Staking Yield' }, icon: ICONS.regen, desc: { zh: '每秒回复 0.4 生命', en: 'Regenerate 0.4 HP/s' }, max: 10 },
};

export interface Choice {
  kind: 'weapon' | 'passive';
  id: WeaponId | PassiveId;
  name: string;
  icon: HTMLCanvasElement;
  lvl: number;  // level after picking
  desc: string;
  fake?: boolean;
}

/** Three random upgrades. Weapons never cap, so the pool is never empty. */
export function rollChoices(weapons: readonly { id: WeaponId; lvl: number }[], passives: Record<PassiveId, number>, n: number): Choice[] {
  const pool: Choice[] = [];
  for (const id of Object.keys(WEAPONS) as WeaponId[]) {
    const owned = weapons.find((w) => w.id === id);
    const lvl = owned ? owned.lvl + 1 : 1;
    pool.push({ kind: 'weapon', id, name: weaponName(id, lvl), icon: WEAPONS[id].icon, lvl, desc: weaponDesc(id, lvl) });
  }
  for (const id of Object.keys(PASSIVES) as PassiveId[]) {
    const lvl = passives[id] + 1;
    if (lvl > PASSIVES[id].max) continue;
    pool.push({ kind: 'passive', id, name: T(PASSIVES[id].name), icon: PASSIVES[id].icon, lvl, desc: T(PASSIVES[id].desc) });
  }
  const out: Choice[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
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
