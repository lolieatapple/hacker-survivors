// Behaviour for the special wave enemies (see difficulty.ts specials). Plain walkers need no AI.
import type { Enemy, Game } from '../scenes/game';
import { spdMul } from './difficulty';

const slowed = (e: Enemy, g: Game) => ((e.data.slowUntil ?? 0) > g.time ? 0.5 : 1); // threshold-field aura

/** Bring stragglers that fell far behind back around the player. Returns true if it moved them. */
function recycle(e: Enemy, g: Game, d: number): boolean {
  if (d <= 340) return false;
  const a = Math.random() * 6.28;
  e.x = g.player.x + Math.cos(a) * 220; e.y = g.player.y + Math.sin(a) * 140;
  return true;
}

/** Phisher: hovers ~95 px away, strafes, and fires a slow aimed hook. Elites fire a spread of 3. */
export function phisherAi(e: Enemy, g: Game, dt: number) {
  const p = g.player, dx = p.x - e.x, dy = (p.y - 6) - e.y, d = Math.hypot(dx, dy) || 1;
  if (recycle(e, g, d)) return;
  const s = e.speed * g.fx.enemySpdMul * slowed(e, g);
  const radial = d > 110 ? 1 : d < 80 ? -0.7 : 0;
  const side = e.phase > 3.14 ? 1 : -1;
  e.x += ((dx / d) * radial + (-dy / d) * 0.35 * side) * s * dt;
  e.y += ((dy / d) * radial + (dx / d) * 0.35 * side) * s * dt;
  e.data.cd -= dt;
  e.data.tele = e.data.cd < 0.35 ? 1 : 0; // a beat of warning before each shot
  if (e.data.cd > 0) return;
  e.data.cd = 2.2 + Math.random() * 1.2;
  if (d > 180) return; // off screen: don't snipe from the dark
  const a = Math.atan2(dy, dx), speed = 72 + g.idx * 1.5;
  const n = e.elite ? 3 : 1;
  for (let i = 0; i < n; i++) {
    g.shoot(e.x, e.y - e.r, a + (i - (n - 1) / 2) * 0.28, speed, { dmg: e.dmg, color: '#ff3d8b', r: 2, wave: true });
  }
}

/** MEV bot: walks in, locks onto where you stand, winds up (shown by "!"), then dashes through. */
export function mevAi(e: Enemy, g: Game, dt: number) {
  const p = g.player, dx = p.x - e.x, dy = (p.y - 4) - e.y, d = Math.hypot(dx, dy) || 1;
  const k = e.data;
  k.t -= dt;
  if (k.state === 0) { // walk
    if (recycle(e, g, d)) return;
    const s = e.speed * g.fx.enemySpdMul * slowed(e, g);
    e.x += (dx / d) * s * dt; e.y += (dy / d) * s * dt;
    k.cd -= dt;
    if (k.cd <= 0 && d < 120) { k.state = 1; k.t = 0.55; k.dx = dx / d; k.dy = dy / d; k.tele = 1; }
  } else if (k.state === 1) { // wind-up: stand still and aim
    k.dx = dx / d; k.dy = dy / d;
    if (k.t <= 0) { k.state = 2; k.t = 0.45; k.tele = 0; }
  } else if (k.state === 2) { // dash; the slow aura can't stop a committed dash
    const s = 190 * spdMul(g.idx);
    e.x += k.dx * s * dt; e.y += k.dy * s * dt;
    // a sandwich hits once: the dash ends on contact (or after 0.45 s) and the bot staggers
    if (k.t <= 0 || d < e.r + g.player.r + 2) { k.state = 3; k.t = 0.7; }
  } else { // recover: stagger after the dash
    const s = e.speed * 0.3 * g.fx.enemySpdMul;
    e.x += (dx / d) * s * dt; e.y += (dy / d) * s * dt;
    if (k.t <= 0) { k.state = 0; k.cd = 1.6 + Math.random(); }
  }
}
