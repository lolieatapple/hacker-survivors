import { describe, expect, test } from 'bun:test';
import { stepToward } from './motion';

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
