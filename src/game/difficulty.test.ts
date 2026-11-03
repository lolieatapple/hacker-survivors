import { describe, expect, test } from 'bun:test';
import {
  armorMul, assistMul, bossDmgMul, bossSpawnCap, bossHpMul, dmgMul, eliteCount, eliteEvery, hpMul, phisherCap, ringEvery, ringSize, spawnCap, spawnRate,
  specialChance, specials, spdMul, xpMul,
} from './difficulty';
import { STAGES } from './economy';

const stages = Array.from({ length: STAGES }, (_, i) => i);

describe('difficulty grows on every axis, stage after stage', () => {
  test('no stage is easier than the one before it', () => {
    for (const i of stages.slice(1)) {
      expect(dmgMul(i)).toBeGreaterThan(dmgMul(i - 1));
      expect(spdMul(i)).toBeGreaterThan(spdMul(i - 1));
      expect(spawnRate(i, 60)).toBeGreaterThan(spawnRate(i - 1, 60));
      expect(spawnCap(i)).toBeGreaterThanOrEqual(spawnCap(i - 1));
      expect(ringSize(i)).toBeGreaterThan(ringSize(i - 1));
      expect(ringEvery(i)).toBeLessThanOrEqual(ringEvery(i - 1));
      expect(eliteEvery(i)).toBeLessThanOrEqual(eliteEvery(i - 1));
      expect(eliteCount(i)).toBeGreaterThanOrEqual(eliteCount(i - 1));
      expect(specialChance(i)).toBeGreaterThanOrEqual(specialChance(i - 1));
    }
  });

  // The old curve: damage +4% per stage and +0.1 spawns/s per stage, so by stage 5 a build was untouchable.
  // (Late damage growth was cut from x9 to x5.7, then x4.7, after the sim hit walls at stages 19-26.)
  test('the last stage is far harder than the first, not a few percent', () => {
    expect(dmgMul(27) / dmgMul(0)).toBeGreaterThan(4.5);
    expect(spawnRate(27, 60) / spawnRate(0, 60)).toBeGreaterThan(3.5);
    expect(spdMul(27) / spdMul(0)).toBeGreaterThan(1.3);
    expect(eliteCount(27)).toBeGreaterThanOrEqual(4);
  });

  test('stage 5 already hits noticeably harder than stage 1', () => {
    expect(dmgMul(4)).toBeGreaterThan(1.35);
    expect(spawnRate(4, 60) / spawnRate(0, 60)).toBeGreaterThan(1.4);
  });

  test('spawns ramp up within a stage too', () => {
    for (const i of [0, 9, 27]) expect(spawnRate(i, 110)).toBeGreaterThan(spawnRate(i, 10) * 2);
  });

  test('the enemy cap stays phone-friendly', () => {
    for (const i of stages) expect(spawnCap(i)).toBeLessThanOrEqual(320);
  });

  // Measured with tools/sim.js: at the full cap, 300+ enemies soaked up the weapons and late boss
  // fights ran 4-7 minutes.
  test('the horde thins out during the boss fight, but never vanishes', () => {
    for (const i of stages) {
      expect(bossSpawnCap(i)).toBeLessThanOrEqual(spawnCap(i) * 0.5 + 1);
      expect(bossSpawnCap(i)).toBeGreaterThanOrEqual(100);
    }
  });

  // Damage a typical build deals to a group of 40 enemies, relative to stage 1, measured in the game
  // (~5 levels per stage, mid-stage level). If HP lags behind, hordes melt on the way in: the old
  // curve lagged 2-5x behind and the player felt invincible from stage 5. If it runs too far ahead,
  // kills dry up, levels stall and the run spirals into a wall.
  const BUILD_DPS: Record<number, number> = { 1: 4.2, 2: 6.1, 4: 14, 6: 30, 8: 45, 10: 72, 13: 165, 15: 192, 18: 254, 20: 300, 27: 512 };
  const ratio = (i: number) => hpMul(i) / BUILD_DPS[i];
  test('HP keeps up with how fast builds grow, never far behind or far ahead', () => {
    for (const i of Object.keys(BUILD_DPS).map(Number)) {
      expect(ratio(i)).toBeGreaterThan(i < 4 ? 0.5 : 1.5); // stages 1-3 are forgiving on purpose
      expect(ratio(i)).toBeLessThan(3);
    }
  });
  // Measured with tools/sim.js on the plain curve: wave enemies lived 4-6 s in stages 5-12 (none
  // reached the player) but 10-16 s from stage 19 on (the horde became a wall at stage 25).
  test('mid stages get the most HP for the build, late stages ease off', () => {
    for (const mid of [6, 8, 10]) for (const late of [13, 15, 18, 20, 27]) expect(ratio(mid)).toBeGreaterThan(ratio(late));
  });

  // Not strictly slowing down: builds jump when weapons evolve (~stage 12), and HP follows that.
  test('HP rises every stage, with no stage-to-stage cliff and no late stall', () => {
    expect(hpMul(0)).toBeCloseTo(1, 3);
    for (const i of stages.slice(1)) {
      const step = hpMul(i) / hpMul(i - 1);
      expect(step).toBeGreaterThan(1.05);
      expect(step).toBeLessThan(4);
    }
    expect(hpMul(4) / hpMul(0)).toBeGreaterThan(15); // early builds grow fastest
  });

  // Measured with tools/sim.js: with the full curve, boss fights ran 60-320 s, past the 90 s mark
  // where recovery bottoms out at 40%. With the horde's mid-stage boost on top, 3-7 minutes.
  test('bosses get at most half of the horde\'s HP growth, and none of the mid-stage boost', () => {
    expect(bossHpMul(0)).toBeCloseTo(1, 3);
    for (const i of stages.slice(1)) {
      expect(bossHpMul(i)).toBeGreaterThan(bossHpMul(i - 1));
      expect(bossHpMul(i)).toBeLessThanOrEqual(1.03 * (1 + (hpMul(i) - 1) / 2)); // 3% slack: hpMul is normalised to stage 1
    }
    for (const i of [6, 8, 10]) expect(bossHpMul(i)).toBeLessThan(0.75 * (1 + (hpMul(i) - 1) / 2));
    expect(bossHpMul(27)).toBeGreaterThan(300); // still grows with the build
  });

  test('boss attacks scale more gently than the horde (bosses already live longer)', () => {
    expect(bossDmgMul(0)).toBe(1);
    for (const i of stages.slice(1)) {
      expect(bossDmgMul(i)).toBeGreaterThan(bossDmgMul(i - 1));
      expect(bossDmgMul(i)).toBeLessThan(dmgMul(i));
    }
  });

  // XP per kill grows, or late builds stall (kills are limited by HP vs damage, not by spawns), but
  // only gently, so levels never run away.
  test('XP per kill grows gently: never less per stage, at most 2.2x by the end', () => {
    expect(xpMul(0)).toBe(1);
    for (const i of stages.slice(1)) expect(xpMul(i)).toBeGreaterThan(xpMul(i - 1));
    expect(xpMul(27)).toBeGreaterThan(1.5);
    expect(xpMul(27)).toBeLessThanOrEqual(2.2);
  });
});

describe('new enemy types unlock by stage', () => {
  test('stages 1-3 only have the classic enemies', () => {
    for (const i of [0, 1, 2]) { expect(specials(i)).toEqual([]); expect(specialChance(i)).toBe(0); }
  });
  test('phishers from stage 4, MEV bots from stage 7, Lazarus agents from stage 13', () => {
    expect(specials(3)).toEqual(['phisher']);
    expect(specials(5)).toEqual(['phisher']);
    expect(specials(6)).toEqual(['phisher', 'mev']);
    expect(specials(11)).toEqual(['phisher', 'mev']);
    expect(specials(12)).toEqual(['phisher', 'mev', 'lazarus']);
    expect(specials(27)).toEqual(['phisher', 'mev', 'lazarus']);
  });
  // Measured with tools/sim.js: uncapped phishers firing spreads did most of the damage at stage 18.
  test('live phishers are capped, so their hooks stay dodgeable', () => {
    expect(phisherCap(3)).toBeGreaterThanOrEqual(5);
    for (const i of stages.slice(1)) expect(phisherCap(i)).toBeGreaterThanOrEqual(phisherCap(i - 1));
    for (const i of stages) expect(phisherCap(i)).toBeLessThanOrEqual(16);
  });

  test('specials are a real share of the horde once unlocked, but never most of it', () => {
    expect(specialChance(3)).toBeGreaterThan(0.05);
    for (const i of stages) expect(specialChance(i)).toBeLessThanOrEqual(0.45);
  });
});

describe('armor', () => {
  // Old armor: -1 flat per hit, so 5 levels turned a 4-damage bug into 1 damage (-75%).
  test('each level cuts a share of the damage, so late hits still hurt', () => {
    expect(armorMul(0)).toBe(1);
    expect(armorMul(5)).toBeCloseTo(0.65);
    for (let l = 1; l <= 5; l++) expect(armorMul(l)).toBeLessThan(armorMul(l - 1));
  });
});

describe('comeback assist', () => {
  // The run retries a stage with the same build. Without help, a stage too hard for that build
  // would be retried forever (measured with tools/sim.js: some builds hit such walls).
  test('each death on the same stage softens it by 8%, down to 60%', () => {
    expect(assistMul(0)).toBe(1);
    expect(assistMul(1)).toBeCloseTo(0.92);
    expect(assistMul(3)).toBeCloseTo(0.76);
    expect(assistMul(5)).toBeCloseTo(0.6);
    expect(assistMul(12)).toBeCloseTo(0.6);
  });
});
