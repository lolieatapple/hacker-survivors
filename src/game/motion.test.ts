import { describe, expect, test } from 'bun:test';
import { stepToward, pickupPull } from './motion';

describe('stepToward', () => {
  test('a slow mover covers exactly speed * dt', () => {
    const m = { x: 0, y: 0 };
    const left = stepToward(m, 100, 0, 90, 0.5);
    expect(m.x).toBeCloseTo(45);
    expect(left).toBeCloseTo(55);
  });

  // Regression: magnetised gems speed up with age (90 + 30 * age px/s). An old gem used to
  // jump past the player every frame and bounce back and forth instead of being collected.
  test('a fast mover never overshoots the target', () => {
    const speed = 90 + 100 * 30, dt = 1 / 60; // a gem that has been on the floor for 100 s
    const step = speed * dt; // 51.5 px per frame
    for (const start of [12, 40, 155, 300]) {
      const m = { x: start, y: 0 };
      let frames = 0, left = start;
      while (left > 0) {
        left = stepToward(m, 0, 0, speed, dt);
        frames++;
        expect(m.x).toBeGreaterThanOrEqual(0); // never crosses to the far side
        expect(frames).toBeLessThanOrEqual(Math.ceil(start / step));
      }
      expect(m.x).toBe(0);
      expect(frames).toBe(Math.ceil(start / step));
    }
  });

  test('random directions: lands within one frame when the step is long enough', () => {
    for (let i = 0; i < 200; i++) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 80;
      const m = { x: 50 + Math.cos(a) * r, y: -20 + Math.sin(a) * r };
      const left = stepToward(m, 50, -20, 6000, 1 / 60); // 100 px per frame
      expect(left).toBe(0);
    }
  });
});

describe('pickupPull', () => {
  const PLAYER_SPEED = 62; // base walk speed, before Node Boost
  test('real gems inside the pickup range fly in, and speed up with age', () => {
    expect(pickupPull('gem', 30, 36, 0, false)).toBe(90);
    expect(pickupPull('gem', 30, 36, 2, false)).toBe(150);
    expect(pickupPull('gem', 40, 36, 0, false)).toBe(0);
    expect(pickupPull('gem', 400, 36, 1, true)).toBe(120); // once pulled, it keeps coming
  });

  // Regression: fake (phishing) gems used the full pickup range and the fast gem pull, so with a
  // couple of Airdrop Hunter levels every fake the stage 6 boss dropped 30-70 px away was a sure hit.
  test('fake gems only lure from 60% of the range', () => {
    for (const magR of [36, 54, 90]) {
      expect(pickupPull('fake', magR * 0.8, magR, 0, false)).toBe(0);
      expect(pickupPull('fake', magR * 0.5, magR, 0, false)).toBeGreaterThan(0);
    }
  });
  test('fake gems drift slower than you walk, at any age, so you can always step away', () => {
    for (const age of [0, 1, 5, 30]) {
      const s = pickupPull('fake', 10, 36, age, true);
      expect(s).toBeGreaterThan(0);
      expect(s).toBeLessThan(PLAYER_SPEED);
    }
  });
});
