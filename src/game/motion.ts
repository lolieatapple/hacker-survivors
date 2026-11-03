// Small pure movement helpers (no DOM), so they can be unit tested with `bun test`.

export interface Mover { x: number; y: number }

/**
 * Move `m` toward (tx, ty) at `speed` px/s for `dt` seconds.
 * Returns the distance left after the step.
 */
export function stepToward(m: Mover, tx: number, ty: number, speed: number, dt: number): number {
  const d = Math.hypot(tx - m.x, ty - m.y);
  const step = speed * dt;
  if (step >= d) { m.x = tx; m.y = ty; return 0; } // arrive instead of flying past
  m.x += ((tx - m.x) / d) * step;
  m.y += ((ty - m.y) / d) * step;
  return d - step;
}

/**
 * How fast a pickup flies toward the player this frame (px/s), or 0 if it stays put.
 * `already`: it was pulled before and keeps coming. Real pickups within `magR` are pulled in.
 * Fake (phishing) gems lure only from 60% of the range and creep slower than the player walks,
 * so they can always be dodged.
 */
export const FAKE_PULL = 40;
export function pickupPull(kind: string, d: number, magR: number, age: number, already: boolean): number {
  if (kind === 'fake') return already || d < magR * 0.6 ? FAKE_PULL : 0;
  return already || d < magR ? 90 + age * 30 : 0;
}
