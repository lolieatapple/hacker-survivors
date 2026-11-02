// One boss "brain" per historic hack. Each brain turns the hack's technique into a fight mechanic.
import type { Game, Enemy, Zone, EBullet } from '../scenes/game';
import type { LevelDef } from './levels';
import { bossSprites, shrink, chainNode, KEY, ORACLE_ORB } from './art';
import { silhouette, W } from '../gfx';
import { drawText } from '../text';
import { tx } from '../i18n';

export interface Brain {
  init?(g: Game): void;                       // level start
  start(g: Game): void;                       // boss arrives
  update(g: Game, dt: number): void;
  onDamage?(g: Game, e: Enemy, dmg: number): number; // return modified damage (negative heals)
  onKill?(g: Game, e: Enemy): boolean;        // false cancels the death
  defeated?(g: Game): boolean;
  end?(g: Game): void;
  onBlast?(g: Game, z: Zone, hitPlayer: boolean): void;
  drawUnder?(g: Game, ctx: CanvasRenderingContext2D): void;
  drawOver?(g: Game, ctx: CanvasRenderingContext2D): void;
  drawHud?(g: Game, ctx: CanvasRenderingContext2D): void;
}

// ---------- helpers ----------
class Timers {
  private t = new Map<string, number>();
  every(key: string, period: number, dt: number, fn: () => void, first = period) {
    let v = this.t.get(key);
    if (v === undefined) v = first;
    v -= dt;
    if (v <= 0) { fn(); v += period; }
    this.t.set(key, v);
  }
  reset(key: string, v: number) { this.t.set(key, v); }
}

function spawnBoss(g: Game, L: LevelDef, hpBase: number, o: Partial<Enemy> = {}, color = L.color): Enemy {
  const spr = bossSprites(L.art === 'duo' ? 'duo' : L.art, color);
  const hp = Math.round(hpBase * 0.65 * (1 + (L.id - 1) * 0.02));
  const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
  return g.spawnUnit({
    x: g.player.x + Math.cos(a) * 110, y: g.player.y + Math.sin(a) * 75,
    img: spr.img, flashImg: spr.flash, hp, maxHp: hp, speed: 20, dmg: 15, colors: [color, '#ffd23f', '#f4f4f8'], tag: 'boss', ...o,
  });
}
const main = (g: Game) => g.enemies.find((e) => e.tag === 'boss' && !e.dead);
const aimed = (g: Game, e: Enemy, n: number, spread: number, speed: number, o: Partial<EBullet> = {}) => {
  const a = g.angleTo(e.x, e.y - e.r);
  for (let i = 0; i < n; i++) g.shoot(e.x, e.y - e.r, a + (i - (n - 1) / 2) * spread, speed, o);
};
const ring = (g: Game, e: Enemy, n: number, speed: number, off = 0, o: Partial<EBullet> = {}) => g.radial(e.x, e.y - e.r, n, speed, off, o);
const near = (g: Game, d: number): [number, number] => { const a = Math.random() * 6.28; return [g.player.x + Math.cos(a) * d, g.player.y + Math.sin(a) * d * 0.7]; };
function summon(g: Game, kind: Parameters<Game['spawnEnemy']>[0], n: number, x: number, y: number, r = 24) {
  if (!g.canSpawn()) return;
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.28; g.spawnEnemy(kind, x + Math.cos(a) * r, y + Math.sin(a) * r); }
}
function teleport(g: Game, e: Enemy, x: number, y: number) {
  g.burst(e.x, e.y - e.r, e.colors, 14, 60);
  e.x = x; e.y = y;
  g.burst(e.x, e.y - e.r, e.colors, 14, 60);
}
function playerIn(g: Game, z: Zone | null) {
  return !!z && z.warn <= 0 && Math.hypot(g.player.x - z.x, (g.player.y - 3 - z.y) * 1.6) < z.r;
}

type Factory = (L: LevelDef) => Brain;

// ---------- the 28 brains ----------
const BRAINS: Record<number, Factory> = {
  // 1 Mt.Gox: your funds leak; the vault sprays BTC you can pick up
  1: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1300); g.fx.drain = 2.5; },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('coins', 1.4, dt, () => { for (let i = 0; i < 3; i++) g.addPickup('btc', b.x + (Math.random() - 0.5) * 30, b.y - 10, 8); });
      T.every('ring', 3, dt, () => ring(g, b, 12, 45, g.time));
    },
    end(g) { g.fx.drain = 0; },
  }; },

  // 2 The DAO: reentrancy — every kill re-enters and spawns two children
  2: (L) => { const T = new Timers(); return {
    start(g) { const b = spawnBoss(g, L, 800); b.data.depth = 0; },
    update(g, dt) {
      T.every('shoot', 2.2, dt, () => g.bossUnits().filter((e) => e.tag === 'boss').forEach((e) => aimed(g, e, 1, 0, 70)));
    },
    onKill(g, e) {
      if (e.tag === 'boss' && (e.data.depth ?? 0) < 2) {
        const img = shrink(e.img);
        for (let i = 0; i < 2; i++) {
          const hp = Math.round(e.maxHp * 0.4);
          g.spawnUnit({ x: e.x + (i ? 12 : -12), y: e.y, img, hp, maxHp: hp, speed: e.speed * 1.35, dmg: 10, colors: e.colors, tag: 'boss', data: { depth: (e.data.depth ?? 0) + 1 } });
        }
        g.floater(tx('重入！', 'Reentered!'), e.x, e.y - e.r * 2 - 8, '#ff3d8b');
      }
      return true;
    },
  }; },

  // 3 Bitfinex: two thieves; when one falls the other enrages
  3: (L) => { const T = new Timers(); let enraged = false; return {
    start(g) {
      const a = spawnBoss(g, L, 650, {}, '#2fbf71'); a.data.who = 0;
      const b = spawnBoss(g, L, 650, {}, '#ff3d8b'); b.data.who = 1; b.x += 50;
    },
    update(g, dt) {
      const units = g.bossUnits().filter((e) => e.tag === 'boss');
      if (units.length === 1 && !enraged) {
        enraged = true; units[0].speed *= 1.8;
        g.banner(tx('同伙暴走！', 'PARTNER ENRAGED!'), '#ff4545', undefined, 1.5);
      }
      const k = enraged ? 0.5 : 1;
      T.every('a', 2.2 * k, dt, () => units.filter((e) => e.data.who === 0).forEach((e) => aimed(g, e, 3, 0.25, 80)));
      T.every('b', 3 * k, dt, () => units.filter((e) => e.data.who === 1).forEach((e) => ring(g, e, 10, 50, g.time, { color: '#ff3d8b' })));
    },
  }; },

  // 4 Parity: self-destruct on death; getting caught freezes a weapon
  4: (L) => { const T = new Timers(); let death: Zone | null = null; let boss: Enemy | null = null; return {
    start(g) { boss = spawnBoss(g, L, 1300); },
    update(g, dt) {
      const b = main(g); if (!b || death) return;
      T.every('kill', 2.6, dt, () => { for (let i = 0; i < 3; i++) { const [x, y] = near(g, Math.random() * 40); g.zone({ x, y, r: 18, warn: 1.1, life: 0.1, kind: 'blast', dmg: 14 }); } });
      T.every('ring', 3.4, dt, () => ring(g, b, 10, 55));
    },
    onKill(g, e) {
      if (e === boss && !death) {
        death = g.zone({ x: e.x, y: e.y - e.r, r: 70, warn: 2.2, life: 0.1, kind: 'blast', dmg: 25 });
        e.invuln = true; e.hp = 1; e.speed = 0;
        g.banner(tx('自毁倒计时！', 'SELF-DESTRUCT!'), '#ff4545', tx('快逃出红圈，否则武器被冻结', 'Get out of the red circle or lose a weapon'), 2);
        return false;
      }
      return true;
    },
    onBlast(g, z, hit) {
      if (z !== death || !boss) return;
      if (hit) { const n = g.lockRandomWeapon(20); if (n) g.banner(tx('被自毁波及！', 'CAUGHT IN THE BLAST!'), '#ff4545', tx(`${n} 被冻结 20 秒`, `${n} frozen for 20s`), 2); }
      boss.invuln = false;
      g.killEnemy(boss);
    },
  }; },

  // 5 Coincheck: hot wallet — the floor keeps catching fire
  5: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('fire', 1.1, dt, () => { const [x, y] = near(g, Math.random() * 60); g.zone({ x, y, r: 16, warn: 0.8, life: 5, dmg: 8, color: '#ff7a3d' }); });
      T.every('trail', 0.5, dt, () => g.zone({ x: b.x, y: b.y, r: 12, warn: 0.2, life: 3, dmg: 8, color: '#ff7a3d' }));
      T.every('ring', 4, dt, () => ring(g, b, 14, 50, 0, { color: '#ff7a3d' }));
    },
  }; },

  // 6 Binance 2019: phishing — red fake gems hurt; SAFU heals you after
  6: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('phish', 1.8, dt, () => { for (let i = 0; i < 4; i++) { const [x, y] = near(g, 30 + Math.random() * 40); g.addPickup('fake', x, y); } });
      T.every('shot', 2.4, dt, () => aimed(g, b, 5, 0.18, 75, { color: '#f3ba2f' }));
    },
    end(g) { g.player.hp = g.player.maxHp; g.banner('FUNDS ARE SAFU', '#f3ba2f', tx('生命值已回满', 'HP fully restored'), 2.5); },
  }; },

  // 7 KuCoin: Lazarus debut — teleports and calls ninjas
  7: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('tp', 3.5, dt, () => { const [x, y] = near(g, 70); teleport(g, b, x, y); ring(g, b, 10, 60, Math.random()); g.sound('zap'); });
      T.every('ninja', 6, dt, () => summon(g, 'ninja', 4, b.x, b.y), 2);
    },
  }; },

  // 8 Poly Network: Mr. White Hat steals XP, then returns it with a bounty
  8: (L) => { const T = new Timers(); let stolen = 0; let tether = 0; return {
    start(g) { spawnBoss(g, L, 1500); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      tether = Math.max(0, tether - dt);
      T.every('steal', 2, dt, () => {
        const n = g.stealXp(Math.max(2, Math.ceil(g.player.xp * 0.25)));
        if (n > 0) { stolen += n; tether = 0.4; g.floater(`-${n} XP`, g.player.x, g.player.y - 30, '#f4f4f8'); }
      });
      T.every('spiral', 0.25, dt, () => ring(g, b, 2, 60, g.time * 2, { color: '#f4f4f8' }));
    },
    drawOver(g, ctx) {
      const b = main(g); if (!b || tether <= 0) return;
      const [x0, y0] = g.toScreen(b.x, b.y - b.r), [x1, y1] = g.toScreen(g.player.x, g.player.y - 8);
      ctx.fillStyle = '#f4f4f8';
      for (let i = 0; i < 20; i++) if ((i + Math.floor(g.time * 20)) % 2) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / 20), Math.round(y0 + (y1 - y0) * i / 20), 1, 1);
    },
    drawHud(g, ctx) { if (stolen) drawText(ctx, tx(`被白帽"保管"：${stolen} XP`, `"Safe-kept" by White Hat: ${stolen} XP`), W / 2, 27, { size: 8, color: '#f4f4f8', outline: '#0b0d17', align: 'center' }); void g; },
    end(g) { const back = stolen * 2 + 20; g.gainXp(back); g.banner(tx('资金已归还', 'FUNDS RETURNED'), '#f4f4f8', tx(`返还 ${back} XP（含赏金）`, `+${back} XP (bounty included)`), 2.5); },
  }; },

  // 9 Wormhole: forged signatures — decoys, only the real one bleeds
  9: (L) => { const T = new Timers(); let real: Enemy | null = null; return {
    start(g) {
      real = spawnBoss(g, L, 1300);
      for (let i = 0; i < 3; i++) {
        const [x, y] = near(g, 100);
        g.spawnUnit({ x, y, img: real.img, flashImg: real.flashImg, hp: 1, maxHp: 1, speed: 22, dmg: 10, tag: 'decoy', colors: real.colors, ghost: true });
      }
    },
    update(g, dt) {
      const all = g.bossUnits().filter((e) => e.tag === 'boss' || e.tag === 'decoy');
      T.every('shuffle', 5, dt, () => {
        const pos = all.map((e) => [e.x, e.y]).sort(() => Math.random() - 0.5);
        all.forEach((e, i) => teleport(g, e, pos[i][0], pos[i][1]));
      });
      T.every('shoot', 2.6, dt, () => all.forEach((e) => aimed(g, e, 1, 0, 60, { color: '#b07cff' })));
    },
    onDamage(g, e, dmg) {
      if (e.tag === 'decoy') { if (Math.random() < 0.2) g.floater(tx('伪造签名', 'FAKE SIG'), e.x, e.y - e.r * 2, '#b07cff'); return 0; }
      return dmg;
    },
    drawOver(g, ctx) {
      if (!real || real.dead || Math.floor(g.time * 2) % 2) return;
      const [x, y] = g.toScreen(real.x, real.y - real.img.height - 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x - 2, y, 5, 1);
    },
    end(g) { g.bossUnits().forEach((e) => { if (e.tag === 'decoy') { e.dead = true; g.burst(e.x, e.y, e.colors, 10); } }); },
  }; },

  // 10 Ronin: 5-of-9 validator keys — boss is immune while 5+ keys remain
  10: (L) => { const T = new Timers(); let open = false; return {
    start(g) {
      const b = spawnBoss(g, L, 1300);
      b.invuln = true;
      for (let i = 0; i < 9; i++) {
        g.spawnUnit({ x: b.x, y: b.y, img: KEY, hp: 70, maxHp: 70, tag: 'key', noContact: true, colors: ['#ffd23f', '#f4f4f8'], data: { i },
          ai: (k, gg) => { const m = main(gg); if (!m) return; const a = gg.time * 0.8 + (k.data.i / 9) * 6.28; k.x = m.x + Math.cos(a) * 36; k.y = m.y - 10 + Math.sin(a) * 24; } });
      }
    },
    update(g, dt) {
      const b = main(g); if (!b) return;
      const keys = g.bossUnits().filter((e) => e.tag === 'key').length;
      if (keys < 5 && !open) { open = true; b.invuln = false; g.banner(tx('门槛失守！', 'THRESHOLD BROKEN!'), '#39ff88', tx('钥匙不足 5 把，Boss 可以被攻击了', 'Fewer than 5 keys left — the boss is vulnerable'), 2); }
      T.every('ring', 2.6, dt, () => ring(g, b, 9, 55, g.time, { color: '#1273ea' }));
      T.every('pdf', 5, dt, () => { for (let i = 0; i < 3; i++) { const [x, y] = near(g, 40); g.addPickup('fake', x, y); } });
    },
    drawHud(g, ctx) { const n = g.bossUnits().filter((e) => e.tag === 'key').length; drawText(ctx, tx(`验证者钥匙 ${n}/9（门槛 5）`, `Validator keys ${n}/9 (threshold 5)`), W / 2, 27, { size: 8, color: '#ffd23f', outline: '#0b0d17', align: 'center' }); },
    end(g) { g.bossUnits().forEach((e) => { if (e.tag === 'key') e.dead = true; }); },
  }; },

  // 11 Beanstalk: flash loan — immune & huge, then weak while repaying
  11: (L) => { let st = 'normal', t = 0; const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      t += dt;
      if (st === 'normal' && t > 6) { st = 'loan'; t = 0; b.invuln = true; b.speed = 70; b.dmg = 25; g.banner(tx('闪电贷！', 'FLASH LOAN!'), '#ffd23f', tx('Boss 借来巨量战力：无敌 4 秒', 'Borrowed power: immune for 4s'), 1.5); }
      else if (st === 'loan' && t > 4) { st = 'repay'; t = 0; b.invuln = false; b.speed = 0; b.dmg = 10; g.banner(tx('还款中', 'REPAYING'), '#39ff88', tx('Boss 虚弱：受到双倍伤害，快打！', 'Weakened: double damage — hit it now!'), 1.5); }
      else if (st === 'repay' && t > 3) { st = 'normal'; t = 0; b.speed = 20; b.dmg = 15; }
      if (st === 'loan') T.every('l', 0.5, dt, () => ring(g, b, 12, 70, g.time, { color: '#ffd23f' }));
      if (st === 'normal') T.every('n', 2, dt, () => aimed(g, b, 3, 0.2, 70, { color: '#3fc35f' }));
    },
    onDamage(_g, e, dmg) { return e.tag === 'boss' && st === 'repay' ? dmg * 2 : dmg; },
  }; },

  // 12 Nomad: copy-paste — minions duplicate themselves
  12: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1300); g.fx.spawnMul = 1.5; },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('copy', 3.5, dt, () => {
        if (!g.canSpawn()) return;
        const src = g.enemies.filter((e) => !e.boss && !e.dead && Math.hypot(e.x - g.player.x, e.y - g.player.y) < 140).slice(0, 20);
        src.forEach((e) => g.spawnEnemy(e.tag as Parameters<Game['spawnEnemy']>[0], e.x + 6, e.y + 4));
        if (src.length) g.banner(tx('复制粘贴！', 'COPY-PASTE!'), '#ff9f1c', tx(`${src.length} 个攻击者复制了同一笔交易`, `${src.length} attackers copied the same tx`), 1.2);
      });
      T.every('bots', 4, dt, () => summon(g, 'bot', 5, b.x, b.y));
      T.every('shot', 2.5, dt, () => aimed(g, b, 3, 0.3, 70, { color: '#ff9f1c' }));
    },
    end(g) { g.fx.spawnMul = 1; },
  }; },

  // 13 BNB bridge: chain halt — you freeze, the boss charges
  13: (L) => { let st = 'idle', t = 0; const T = new Timers(); let dash: [number, number] = [0, 0]; return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      t += dt;
      if (st === 'idle' && t > 6) { st = 'warn'; t = 0; g.banner(tx('链即将停摆', 'CHAIN HALT INCOMING'), '#29d3ff', tx('你会被冻结，提前走位！', "You'll freeze — move now!"), 1.2); g.sound('warn'); }
      else if (st === 'warn' && t > 1.2) {
        st = 'halt'; t = 0; g.fx.freeze = 1.2;
        const a = Math.atan2(g.player.y - b.y, g.player.x - b.x); dash = [Math.cos(a), Math.sin(a)];
      } else if (st === 'halt') {
        b.x += dash[0] * 110 * dt; b.y += dash[1] * 110 * dt;
        if (t > 1.2) { st = 'idle'; t = 0; }
      }
      T.every('mint', 4, dt, () => summon(g, 'airdrop', 4, b.x, b.y, 20));
      T.every('ring', 3, dt, () => ring(g, b, 10, 55, 0, { color: '#f3ba2f' }));
    },
  }; },

  // 14 Mango: oracle manipulation — price pumps enemy power; break the oracle to dump it
  14: (L) => { let price = 1; let orb: Enemy | null = null; const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      price = Math.min(3, price + dt * 0.06);
      g.fx.enemyDmgMul = price; g.fx.enemySpdMul = 0.8 + price * 0.2;
      if (!orb || orb.dead) T.every('orb', 8, dt, () => {
        const [x, y] = near(g, 80);
        orb = g.spawnUnit({ x, y, img: ORACLE_ORB, hp: 160, maxHp: 160, tag: 'oracle', noContact: true, speed: 0, colors: ['#ffd23f', '#39ff88'], ai: () => {} });
      }, 1);
      T.every('shot', 2, dt, () => aimed(g, b, Math.round(2 + price * 2), 0.15, 60 + price * 15, { color: '#ffb000' }));
    },
    onKill(g, e) { if (e.tag === 'oracle') { price = 1; g.banner(tx('预言机被砸盘！', 'ORACLE DUMPED!'), '#39ff88', tx('价格回落，敌人恢复正常', 'Price reset — enemies back to normal'), 1.5); } return true; },
    drawHud(g, ctx) { drawText(ctx, tx(`MNGO 价格 x${price.toFixed(2)}`, `MNGO price x${price.toFixed(2)}`), W / 2, 27, { size: 8, color: price > 2 ? '#ff4545' : '#ffb000', outline: '#0b0d17', align: 'center' }); void g; },
    end(g) { g.fx.enemyDmgMul = 1; g.fx.enemySpdMul = 1; },
  }; },

  // 15 FTX: withdrawals paused — you can't collect XP while it lives
  15: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1000); g.fx.gemsLocked = true; },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('run', 10, dt, () => { if (!g.canSpawn()) return; const n = 16; for (let i = 0; i < n; i++) { const a = (i / n) * 6.28; g.spawnEnemy('drainer', g.player.x + Math.cos(a) * 130, g.player.y + Math.sin(a) * 90); } g.banner(tx('挤兑！', 'BANK RUN!'), '#5fcade', undefined, 1); }, 3);
      T.every('shot', 2, dt, () => aimed(g, b, 3, 0.2, 75, { color: '#5fcade' }));
    },
    end(g) { g.fx.gemsLocked = false; },
  }; },

  // 16 Euler: bad-debt zones — attacking from inside heals the boss
  16: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('debt', 3.5, dt, () => { const a = Math.random() * 6.28; g.zone({ x: b.x + Math.cos(a) * 20, y: b.y + Math.sin(a) * 14, r: 24, warn: 0.6, life: 5, kind: 'debt', color: '#b04fff', dmg: 0 }); });
      T.every('ring', 3, dt, () => ring(g, b, 12, 55, g.time, { color: '#e05bd9' }));
    },
    onDamage(g, e, dmg) {
      if (e.tag === 'boss' && g.zones.some((z) => z.kind === 'debt' && playerIn(g, z))) return -dmg;
      return dmg;
    },
    end(g) { g.gainXp(30); g.banner(tx('资金已归还', 'FUNDS RETURNED'), '#e05bd9', '+30 XP', 2); },
  }; },

  // 17 Curve/Vyper: broken reentrancy lock — shields fail, bullets split
  17: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('lock', 7, dt, () => { g.fx.shieldOff = 3; g.banner(tx('重入锁失效', 'LOCK FAILED'), '#ff4f6d', tx('冷钱包护盾失灵 3 秒', 'Cold Wallet Shield down for 3s'), 1.3); }, 4);
      T.every('shot', 2, dt, () => aimed(g, b, 2, 0.4, 65, { color: '#ff4f6d', split: 3 }));
      for (const s of g.ebullets) {
        if (s.split && s.life < 4.3) {
          const a = Math.atan2(s.vy, s.vx);
          for (let i = 0; i < s.split; i++) g.shoot(s.x, s.y, a + (i - (s.split - 1) / 2) * 0.5, 70, { color: '#ff9fb0' });
          s.life = 0; s.split = 0;
        }
      }
    },
  }; },

  // 18 Multichain: the CEO vanishes, the safe zone shrinks
  18: (L) => { let st = 'shown', t = 0; const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); g.arena = { x: g.player.x, y: g.player.y, r: 160 }; },
    update(g, dt) {
      const b = main(g); if (!b || !g.arena) return;
      g.arena.r = Math.max(70, g.arena.r - dt * 1.6);
      t += dt;
      if (st === 'shown' && t > 5) { st = 'gone'; t = 0; b.hidden = true; b.invuln = true; b.alpha = 0; b.noContact = true; g.banner(tx('CEO 失联', 'CEO WENT DARK'), '#5f6bff', undefined, 1); }
      else if (st === 'gone' && t > 3) {
        st = 'shown'; t = 0;
        const a = Math.random() * 6.28, r = Math.random() * g.arena.r * 0.6;
        teleport(g, b, g.arena.x + Math.cos(a) * r, g.arena.y + Math.sin(a) * r);
        b.hidden = false; b.invuln = false; b.alpha = 1; b.noContact = false;
        ring(g, b, 16, 60, 0, { color: '#5f6bff' });
      }
      if (st === 'shown') T.every('shot', 1.8, dt, () => aimed(g, b, 3, 0.25, 70, { color: '#5f6bff' }));
    },
    end(g) { g.arena = null; },
  }; },

  // 19 DMM Bitcoin: elite ninja — telegraphed dashes leaving afterimages
  19: (L) => { let st = 'chase', t = 0; let dir: [number, number] = [0, 0]; const ghosts: { x: number; y: number; life: number }[] = []; const T = new Timers(); let img: HTMLCanvasElement | null = null; return {
    start(g) { const b = spawnBoss(g, L, 1500); img = b.img; },
    update(g, dt) {
      const b = main(g); if (!b) return;
      t += dt;
      for (const gh of ghosts) gh.life -= dt;
      while (ghosts.length && ghosts[0].life <= 0) ghosts.shift();
      if (st === 'chase' && t > 2.2) { st = 'aim'; t = 0; b.speed = 0; }
      else if (st === 'aim') { b.flash = Math.floor(t * 12) % 2 ? 0.05 : 0; if (t > 0.5) { st = 'dash'; t = 0; const a = Math.atan2(g.player.y - b.y, g.player.x - b.x); dir = [Math.cos(a), Math.sin(a)]; g.sound('zap'); } }
      else if (st === 'dash') {
        b.x += dir[0] * 230 * dt; b.y += dir[1] * 230 * dt;
        T.every('ghost', 0.05, dt, () => ghosts.push({ x: b.x, y: b.y, life: 0.5 }));
        if (t > 0.45) { st = 'chase'; t = 0; b.speed = 26; ring(g, b, 6, 50, Math.random(), { color: '#c0c0d0' }); }
      }
      T.every('ninja', 8, dt, () => summon(g, 'ninja', 4, b.x, b.y), 3);
    },
    drawUnder(g, ctx) {
      if (!img) return;
      for (const gh of ghosts) { const [x, y] = g.toScreen(gh.x, gh.y); ctx.globalAlpha = gh.life; ctx.drawImage(img, x - (img.width >> 1), y - img.height); }
      ctx.globalAlpha = 1;
    },
  }; },

  // 20 WazirX: tampered UI — controls invert
  20: (L) => { let st = 'idle', t = 0; const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      t += dt;
      if (st === 'idle' && t > 6) { st = 'warn'; t = 0; g.banner(tx('界面即将被篡改', 'UI TAMPERING'), '#ff3d8b', tx('方向即将反转', 'Controls about to invert'), 1); g.sound('warn'); }
      else if (st === 'warn' && t > 1) { st = 'idle'; t = 0; g.fx.invert = 4; }
      T.every('ring', 2.4, dt, () => ring(g, b, 10, 55, g.time, { color: '#3067f0' }));
      T.every('aim', 3, dt, () => aimed(g, b, 3, 0.2, 75, { color: '#3067f0' }));
    },
    end(g) { g.fx.invert = 0; },
  }; },

  // 21 Bybit: blind signing — fake upgrade cards all level long
  21: (L) => { const T = new Timers(); return {
    init(g) { g.fx.fakeCards = true; },
    start(g) { spawnBoss(g, L, 1600); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('spiral', 0.2, dt, () => ring(g, b, 3, 55, g.time * 1.4, { color: '#f7a600' }));
      T.every('fake', 3, dt, () => { for (let i = 0; i < 4; i++) { const [x, y] = near(g, 30 + Math.random() * 30); g.addPickup('fake', x, y); } });
    },
  }; },

  // 22 Cetus: overflow — hitting it while it glows red wraps damage into healing
  22: (L) => { let st = 'normal', t = 0; const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1300); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      t += dt;
      if (st === 'normal' && t > 5) { st = 'overflow'; t = 0; g.banner(tx('溢出窗口！', 'OVERFLOW!'), '#ff4545', tx('别打它，拉开距离', 'Stop hitting it — back off'), 1.2); g.sound('warn'); }
      else if (st === 'overflow' && t > 2.5) { st = 'normal'; t = 0; }
      T.every('shot', 1.6, dt, () => aimed(g, b, 3, 0.25, 75, { color: '#2ad4c9' }));
    },
    onDamage(_g, e, dmg) { return e.tag === 'boss' && st === 'overflow' ? -Math.ceil(dmg / 2) : dmg; },
    drawOver(g, ctx) {
      const b = main(g); if (!b || st !== 'overflow') return;
      const [x, y] = g.toScreen(b.x, b.y - b.r);
      ctx.fillStyle = '#ff4545';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28 - g.time * 3; ctx.fillRect(Math.round(x + Math.cos(a) * (b.r + 6)), Math.round(y + Math.sin(a) * (b.r + 6)), 2, 2); }
      drawText(ctx, 'u64 MAX', x, y - b.r - 14, { size: 8, color: '#ff4545', outline: '#0b0d17', align: 'center' });
    },
  }; },

  // 23 Balancer: rounding — every hit deals exactly 1
  23: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 260); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('ring', 1.6, dt, () => ring(g, b, 18, 40, g.time, { color: '#e0e0e0' }));
    },
    onDamage(_g, e, dmg) { return e.tag === 'boss' ? 1 : dmg; },
  }; },

  // 24 Drift: drained in minutes — 60 seconds to win
  24: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1300, { speed: 34 }); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      if (g.bossTime > 60) { g.player.iframes = 0; g.hurtPlayer(99999); return; }
      T.every('burst', 1.3, dt, () => aimed(g, b, 4, 0.15, 95, { color: '#9b6bff' }));
    },
    drawHud(g, ctx) { const left = Math.max(0, 60 - g.bossTime); drawText(ctx, tx(`资产剩余 ${left.toFixed(1)} 秒`, `Funds left: ${left.toFixed(1)}s`), W / 2, 27, { size: 12, color: left < 15 ? '#ff4545' : '#9b6bff', outline: '#0b0d17', align: 'center' }); },
  }; },

  // 25 KelpDAO: portal hopping — destroy the gates first
  25: (L) => { const T = new Timers(); let open = false; return {
    start(g) {
      const b = spawnBoss(g, L, 1300);
      b.invuln = true;
      const gate = bossSprites('portal', '#14b8a6');
      const img = shrink(gate.img);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * 6.28;
        g.spawnUnit({ x: g.player.x + Math.cos(a) * 95, y: g.player.y + Math.sin(a) * 65, img, flashImg: silhouette(img, '#fff'), hp: 260, maxHp: 260, tag: 'gate', speed: 0, noContact: true, ai: () => {} });
      }
    },
    update(g, dt) {
      const b = main(g); if (!b) return;
      const gates = g.bossUnits().filter((e) => e.tag === 'gate');
      if (!gates.length && !open) { open = true; b.invuln = false; g.banner(tx('传送门已拆除', 'PORTALS DOWN'), '#39ff88', tx('Boss 无处可逃，现在可以攻击了', 'Nowhere to run — attack now'), 1.5); }
      T.every('hop', 3, dt, () => { if (gates.length) { const gt = gates[Math.floor(Math.random() * gates.length)]; teleport(g, b, gt.x, gt.y + 4); ring(g, b, 10, 60, 0, { color: '#14b8a6' }); } });
      T.every('spawn', 4, dt, () => gates.forEach((gt) => summon(g, 'ninja', 2, gt.x, gt.y, 10)));
      if (open) T.every('aim', 1.8, dt, () => aimed(g, b, 3, 0.2, 75, { color: '#14b8a6' }));
    },
  }; },

  // 26 Liquid: peg zone — the boss can only be hurt while you stand in the peg circle
  26: (L) => { let peg: Zone | null = null; const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1400); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('peg', 6, dt, () => {
        if (peg) peg.life = 0;
        const [x, y] = near(g, 50 + Math.random() * 30);
        peg = g.zone({ x, y, r: 28, warn: 0.3, life: 6.2, kind: 'peg', color: '#39ff88', dmg: 0 });
      }, 0.01);
      b.invuln = !playerIn(g, peg);
      T.every('ring', 2.8, dt, () => ring(g, b, 12, 50, g.time, { color: '#f7931a' }));
    },
    drawOver(g, ctx) { if (peg && peg.warn <= 0) { const [x, y] = g.toScreen(peg.x, peg.y); drawText(ctx, 'PEG', x, y - 4, { size: 8, color: '#39ff88', outline: '#0b0d17', align: 'center' }); } },
    end(g) { g.gainXp(40); g.banner(tx('85% 资金已归还', '85% RETURNED'), '#f7931a', '+40 XP', 2); },
  }; },

  // 27 Bitget: TraderTraitor vanguard — spiral bullet hell
  27: (L) => { const T = new Timers(); return {
    start(g) { spawnBoss(g, L, 1600, { speed: 8 }); },
    update(g, dt) {
      const b = main(g); if (!b) return;
      T.every('spiral', 0.12, dt, () => { const a = g.time * 2.2; g.shoot(b.x, b.y - b.r, a, 52, { color: '#00c4c4' }); g.shoot(b.x, b.y - b.r, a + Math.PI, 52, { color: '#00c4c4' }); });
      T.every('ring', 5, dt, () => ring(g, b, 20, 45, 0, { color: '#f4f4f8' }));
    },
  }; },

  // 28 Binance 2026: 10 chains, then every trick in the book
  28: (L) => {
    const T = new Timers();
    const CHAINS: [string, string][] = [['BTC', '#f7931a'], ['ETH', '#627eea'], ['BNB', '#f3ba2f'], ['SOL', '#9945ff'], ['TRX', '#ff0013'], ['ARB', '#28a0f0'], ['BASE', '#0052ff'], ['OP', '#ff0420'], ['AVAX', '#e84142'], ['POL', '#8247e5']];
    let phase = 1, mech = 0, mt = 0, st = '';
    let drained = 0;
    return {
      init(g) { g.fx.fakeCards = true; },
      start(g) {
        const b = spawnBoss(g, L, 2200, { speed: 14 });
        b.invuln = true;
        CHAINS.forEach(([name, col], i) => {
          const img = chainNode(col);
          const a = (i / 10) * 6.28;
          g.spawnUnit({ x: g.player.x + Math.cos(a) * 110, y: g.player.y + Math.sin(a) * 75, img, hp: 180, maxHp: 180, tag: 'node', speed: 0, noContact: true, colors: [col, '#f4f4f8'], data: { i }, ai: () => {} });
          void name;
        });
        g.banner(tx('10 条链同时告急', '10 CHAINS HIT'), '#f3ba2f', tx('先切断每条链上的攻击节点', 'Cut the attack node on every chain'), 2);
      },
      update(g, dt) {
        const b = main(g); if (!b) return;
        drained = Math.min(6.3, g.bossTime / 240 * 6.3);
        if (drained >= 6.3) { g.player.iframes = 0; g.hurtPlayer(99999); return; }
        const nodes = g.bossUnits().filter((e) => e.tag === 'node');
        if (phase === 1) {
          T.every('nodes', 2.8, dt, () => nodes.forEach((n) => aimed(g, n, 1, 0, 55, { color: n.colors[0] })));
          T.every('ring', 4, dt, () => ring(g, b, 12, 45, 0, { color: '#f3ba2f' }));
          if (!nodes.length) { phase = 2; b.invuln = false; b.speed = 22; g.banner(tx('TraderTraitor 现身', 'TRADERTRAITOR'), '#ff4545', tx('历代攻击手法轮番上演', 'Every trick in the book, incoming'), 2); mt = 0; }
          return;
        }
        if (phase === 2 && b.hp < b.maxHp * 0.3) { phase = 3; g.banner(tx('最后的疯狂', 'FINAL FRENZY'), '#ff4545', undefined, 1.5); }
        mt += dt;
        if (mt > 8) {
          mt = 0; mech = (mech + 1) % 5;
          st = ['flash', 'invert', 'phish', 'reenter', 'halt'][mech];
          if (st === 'flash') { b.invuln = true; g.banner(tx('闪电贷', 'FLASH LOAN'), '#ffd23f', tx('Boss 无敌 3 秒', 'Immune for 3s'), 1); }
          if (st === 'invert') { g.fx.invert = 3.5; g.banner(tx('界面篡改', 'UI TAMPERED'), '#ff3d8b', tx('方向反转', 'Controls inverted'), 1); }
          if (st === 'phish') { for (let i = 0; i < 8; i++) { const [x, y] = near(g, 25 + Math.random() * 45); g.addPickup('fake', x, y); } g.banner(tx('钓鱼空投', 'PHISHING DROP'), '#ff4545', tx('别碰红色宝石', 'Avoid the red gems'), 1); }
          if (st === 'reenter') { const img = shrink(b.img); for (let i = 0; i < 2; i++) { const [x, y] = near(g, 70); g.spawnUnit({ x, y, img, hp: 300, maxHp: 300, tag: 'clone', speed: 30, dmg: 10 }); } g.banner(tx('重入分身', 'CLONES'), '#ff3d8b', undefined, 1); }
          if (st === 'halt') { g.fx.freeze = 0.9; g.banner(tx('链停摆', 'CHAIN HALT'), '#29d3ff', undefined, 1); }
        }
        if (st === 'flash' && mt > 3) b.invuln = false;
        T.every('aim', phase === 3 ? 1 : 1.8, dt, () => aimed(g, b, phase === 3 ? 5 : 3, 0.18, 80, { color: '#f3ba2f' }));
        if (phase === 3) T.every('spiral', 0.14, dt, () => { const a = g.time * 2; g.shoot(b.x, b.y - b.r, a, 50, { color: '#ff4545' }); g.shoot(b.x, b.y - b.r, a + Math.PI, 50, { color: '#ff4545' }); });
        T.every('ninja', 7, dt, () => summon(g, 'ninja', 5, b.x, b.y));
      },
      defeated(g) { return !main(g); },
      end(g) { g.bossUnits().forEach((e) => { e.dead = true; }); },
      drawHud(g, ctx) {
        drawText(ctx, tx(`已被转走 $${drained.toFixed(2)}B / $6.3B`, `Stolen $${drained.toFixed(2)}B / $6.3B`), W / 2, 27, { size: 8, color: drained > 5 ? '#ff4545' : '#f3ba2f', outline: '#0b0d17', align: 'center' });
        if (phase === 1) {
          const nodes = g.bossUnits().filter((e) => e.tag === 'node');
          drawText(ctx, tx(`剩余攻击节点 ${nodes.length}/10`, `Attack nodes left ${nodes.length}/10`), W / 2, 36, { size: 8, color: '#f4f4f8', outline: '#0b0d17', align: 'center' });
        }
      },
      drawOver(g, ctx) {
        for (const n of g.bossUnits().filter((e) => e.tag === 'node')) {
          const [x, y] = g.toScreen(n.x, n.y);
          drawText(ctx, CHAINS[n.data.i][0], x, y - n.img.height - 10, { size: 8, color: n.colors[0], outline: '#0b0d17', align: 'center' });
        }
      },
    };
  },
};

export function makeBrain(L: LevelDef): Brain {
  const f = BRAINS[L.id];
  if (!f) throw new Error(`no boss brain for level ${L.id}`);
  return f(L);
}

