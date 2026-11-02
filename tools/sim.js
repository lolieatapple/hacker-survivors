// Dev-only balance harness. Not bundled. Open the game with ?sim=1 (add &god=1 for god mode),
// then in devtools:
//   const { sim } = await import('/tools/sim.js'); (await sim(0, 27)).join('\n')
// Plays one continuous run like a player: the build carries over, and a death retries the
// stage from its checkpoint (up to `retries` times) before giving up.
// Autopilot: kites in a circle during waves; during the boss it orbits the current
// target at ~70px (switching to keys/gates/nodes while the boss is immune) and walks
// into peg zones. Upgrade cards are picked at random.
export async function sim(from, to, { seconds = 600, retries = 2 } = {}) {
  const out = [];
  window.__debugRun(from);
  let tries = 0;
  for (let i = from; i <= to; ) {
    const startRun = window.__run();
    const startLvl = startRun.build.lvl;
    window.__app.play();
    const g = window.__game;
    g.overlay = null;
    const dt = 1 / 20;
    let steps = 0, err = null, bossStartLvl = null, maxEnemies = 0, ang = 0, wonT = null;
    try {
      while (steps < seconds / dt) {
        steps++;
        const p = g.player;
        let tx = Math.cos(ang), ty = Math.sin(ang);
        ang += dt * 0.6;
        // flee from nearby enemies (weighted by 1/d^2), otherwise go collect the nearest gem
        let fx = 0, fy = 0;
        for (const e of g.enemies) {
          const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
          if (d2 < 70 * 70 && d2 > 0) { fx += dx / d2; fy += dy / d2; }
        }
        for (const b of g.ebullets) {
          const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 < 30 * 30 && d2 > 0) { fx += (dx / d2) * 2; fy += (dy / d2) * 2; }
        }
        if (Math.hypot(fx, fy) > 0.002) { const l = Math.hypot(fx, fy); tx = fx / l + Math.cos(ang) * 0.3; ty = fy / l + Math.sin(ang) * 0.3; }
        else {
          const gem = g.pickups.filter((k) => k.kind !== 'fake').sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
          if (gem && Math.hypot(gem.x - p.x, gem.y - p.y) < 150) { tx = gem.x - p.x; ty = gem.y - p.y; }
        }
        { const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; }
        if (g.phase === 'boss') {
          const all = g.bossUnits().filter((e) => !e.hidden);
          const bossInv = all.some((e) => e.tag === 'boss' && e.invuln);
          const tgt = (bossInv && all.find((e) => !['boss', 'decoy', 'clone'].includes(e.tag))) || all.find((e) => e.tag === 'boss') || all[0];
          if (tgt) {
            const dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1;
            const radial = (d - 70) / 30;
            tx = (dx / d) * radial + (-dy / d) * 0.8; ty = (dy / d) * radial + (dx / d) * 0.8;
            const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
          }
        }
        const peg = g.zones.find((z) => z.kind === 'peg' && z.warn <= 0);
        if (peg) { const d = Math.hypot(peg.x - p.x, peg.y - p.y) || 1; tx = (peg.x - p.x) / d; ty = (peg.y - p.y) / d; if (d < 8) { tx = 0; ty = 0; } }
        if (g.fx.invert > 0) { tx = -tx; ty = -ty; }
        if (g.fx.freeze > 0) { tx = 0; ty = 0; }
        p.x += tx * p.speed * dt; p.y += ty * p.speed * dt;
        if (tx || ty) p.facing = [tx, ty];
        if (g.overlay === 'levelup') { g.applyChoice(g.choices[Math.floor(Math.random() * g.choices.length)]); g.overlay = null; }
        if (g.overlay === 'clear' || g.overlay === 'dead') break;
        if (g.phase === 'boss' && bossStartLvl === null) bossStartLvl = p.lvl;
        if (g.phase === 'won' && wonT === null) wonT = g.time;
        g.update(dt);
        maxEnemies = Math.max(maxEnemies, g.enemies.length);
        if (steps % 400 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    } catch (e) { err = String((e && e.stack) || e).slice(0, 400); }
    const weapons = g.weapons.map((w) => w.id + w.lvl).join(',');
    const run = window.__run();
    const assets = run ? run.assets : g.banked + g.earned; // run is null after the final stage
    out.push(`L${i + 1}${tries ? ' retry' + tries : ''} ${g.overlay || g.phase} t=${Math.round(g.time)} wonT=${wonT === null ? '-' : Math.round(wonT)} bossT=${Math.round(g.bossTime)} lvl=${startLvl}->${g.player.lvl} hp=${g.player.maxHp} kills=${g.kills} assets=$${(assets / 1e6).toFixed(0)}M [${weapons}] maxE=${maxEnemies}${err ? ' ERR ' + err : ''}`);
    if (err) break;
    if (g.overlay === 'clear') { i++; tries = 0; }
    else if (++tries > retries) { out.push(`gave up at L${i + 1}`); break; }
  }
  return out;
}
