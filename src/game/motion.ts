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
