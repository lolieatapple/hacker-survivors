// How hard each stage is. Pure functions, unit tested in difficulty.test.ts, tuned with tools/sim.js.
//
// The build carries over and keeps growing (evolutions, endless overclock), so enemies must grow
// on every axis: more of them, faster, harder hitting, tankier, with new kinds that don't just walk
// into your weapons. `idx` is the 0-based stage; `t` is seconds into the stage's waves.

/**
 * Enemy and boss HP. It follows how fast a typical build's damage grows, measured in the game:
 * close to (1 + idx)^1.85, with a +45% step around stage 12, where most weapons hit Lv 10 and
 * evolve. On top of that, a slow ramp of +2% per stage.
 * The shaping below then gives x23 by stage 5, x305 by stage 15, x800 by stage 28. The old curve (1.22^idx with a hump)
 * lagged 2-5x behind builds, so hordes melted on the way in and bosses died in 2-5 s.
 */
const evolveStep = (idx: number) => 1 + 0.45 / (1 + Math.exp(-(idx - 11) / 1.2));
// Stages 2-8 grant part of the growth only: starting builds vary a lot (three random cards per
// level), and a weak one must still be able to kill its way to more levels.
const earlyEase = (idx: number) => Math.min(1, 0.4 + idx * 0.075);
const base = (idx: number) => 1 + ((1 + idx) ** 1.85 * evolveStep(idx) * (1 + idx * 0.02) - 1) * earlyEase(idx);
// Measured in tools/sim.js with sensible card picks: on the base curve, wave enemies lived only
// 4-6 s in stages 5-12 and almost none reached the player (the "invincible from stage 5" feel),
// while from stage 19 on they lived 10-16 s and the horde became a wall. So: up to x1.6 HP in
// stages 4-14, easing off to x0.75 by stage 28 (x0.85 still left stages 26-28 needing 4-6 tries).
const midBoost = (idx: number) => 1 + 0.7 / (1 + Math.exp(-(idx - 3) / 0.8)) / (1 + Math.exp((idx - 11) / 2.2));
const lateEase = (idx: number) => 1 - 0.25 / (1 + Math.exp(-(idx - 21) / 2));
const shape = (idx: number) => midBoost(idx) * lateEase(idx);
export const hpMul = (idx: number) => base(idx) * shape(idx) / shape(0); // stage 1 stays at x1

/**
 * Boss HP (and the props bosses summon): half of the base growth, so boss fights stay around a minute.
 * The mid-stage boost is for the horde only: passed on to bosses, tools/sim.js saw boss fights of
 * 3-7 minutes, long enough for the horde around them to wear the player down.
 */
export const bossHpMul = (idx: number) => 1 + (base(idx) * lateEase(idx) / lateEase(0) - 1) / 2;

/**
 * Damage from wave enemies (contact and phisher hooks): +8.5% per stage up to stage 17 (x3.7), then
 * +2.5% of that per stage (x4.7 at stage 28). Max HP tops out at 300 around stage 14, so late hits
 * must not keep climbing fast. In tools/sim.js, x9 at the end let elite whales hit for 128, and x5.7
 * still left stages 19-26 as walls: phisher hooks and MEV dashes did 70% of the damage in the waves.
 */
export const dmgMul = (idx: number) => (idx <= 16 ? 1.085 ** idx : 1.085 ** 16 * (1 + (idx - 16) * 0.025));

/** Damage from boss attacks. Gentler: bosses now live much longer, and their patterns were drawn for this range. */
export const bossDmgMul = (idx: number) => 1 + idx * 0.06;

/** Enemy move speed: +1.5% per stage, so late hordes can no longer be outwalked for free. */
export const spdMul = (idx: number) => 1 + idx * 0.015;

/**
 * XP per kill: +4% per stage. XP needed per level grows faster than kills do, and with a flatter
 * curve late builds gained only 2-3 levels per stage while HP kept growing (tools/sim.js stalled
 * at level ~113 from stage 23 on and hit a wall at stage 25).
 */
export const xpMul = (idx: number) => 1 + idx * 0.04;

/** Enemies spawned per second. Grows within a stage and by about 12% per stage. */
export const spawnRate = (idx: number, t: number) => (1.3 + t * 0.04) * (1 + idx * 0.12);

/** Most enemies alive at once (phones slow down past ~320). */
export const spawnCap = (idx: number) => Math.min(320, 200 + idx * 5);

/**
 * Most horde enemies alive during the boss fight. With the full cap the horde stayed at 300+ the
 * whole fight and soaked up the weapons: tools/sim.js saw late boss fights of 4-7 minutes.
 */
export const bossSpawnCap = (idx: number) => Math.round(spawnCap(idx) / 2);

/** Seconds between "surrounded" rings, and how many enemies form one. */
export const ringEvery = (idx: number) => Math.max(25, 45 - idx);
export const ringSize = (idx: number) => Math.round(20 + idx * 1.5);

/** Seconds between elite waves, and how many elites come in each. */
export const eliteEvery = (idx: number) => Math.max(18, 40 - idx);
export const eliteCount = (idx: number) => 1 + Math.floor(idx / 7);

export type SpecialKind = 'phisher' | 'mev' | 'lazarus';

/** New enemy kinds: phishers shoot (stage 4+), MEV bots dash (stage 7+), Lazarus agents are fast tanks (stage 13+). */
export function specials(idx: number): SpecialKind[] {
  const out: SpecialKind[] = [];
  if (idx >= 3) out.push('phisher');
  if (idx >= 6) out.push('mev');
  if (idx >= 12) out.push('lazarus');
  return out;
}

/** Most phishers alive at once. Uncapped, their hooks became a bullet storm by stage 18; 14 at stage 26 was still too many. */
export const phisherCap = (idx: number) => 5 + Math.floor(idx / 4);

/** Chance that a wave spawn is one of the unlocked special kinds. */
export const specialChance = (idx: number) => (idx < 3 ? 0 : Math.min(0.4, 0.1 + (idx - 3) * 0.015));

/** Damage taken after armor: each level cuts 7%, up to 35% at the cap of 5. */
export const armorMul = (lvl: number) => 1 - lvl * 0.07;

/**
 * Comeback assist: enemy HP and damage on a stage after `stageDeaths` deaths on it (-8% each,
 * down to 60%). A death retries the stage with the same build, so without this a stage too hard
 * for that build would be a dead end. Resets when the stage is cleared.
 */
export const assistMul = (stageDeaths: number) => 1 - 0.08 * Math.min(5, stageDeaths);
